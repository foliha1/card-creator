// Audio effects + persisted settings.
//
// Effects are real recordings from /sounds/*.mp3, decoded once into
// AudioBuffers and played through the shared AudioContext. Buffers have no
// replay latency and can overlap, so repeated taps never queue up.
//
// Two independent flags: sfxEnabled controls the six effect functions;
// musicEnabled is exposed for future use (theme music, ambience). Both persist
// to localStorage so a page refresh preserves the user's choice.
//
// unlockAudio() must be called from a user gesture — it resumes the context and
// kicks off the (lazy) fetch+decode of every clip. In multiplayer, effects fire
// from remote broadcasts with no local gesture, so a joiner's AudioContext
// would otherwise remain suspended and silent forever.

let audioCtx: AudioContext | null = null;

const SFX_KEY = "ww_sfx_enabled";
const MUSIC_KEY = "ww_music_enabled";

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "true";
  } catch { return fallback; }
}
function writeFlag(key: string, value: boolean) {
  try { localStorage.setItem(key, value ? "true" : "false"); } catch { /* ignore */ }
}

let sfxEnabled = readFlag(SFX_KEY, true);
let musicEnabled = readFlag(MUSIC_KEY, true);

export function getSfxEnabled(): boolean { return sfxEnabled; }
export function setSfxEnabled(value: boolean): void {
  sfxEnabled = value;
  writeFlag(SFX_KEY, value);
}
export function getMusicEnabled(): boolean { return musicEnabled; }
export function setMusicEnabled(value: boolean): void {
  musicEnabled = value;
  writeFlag(MUSIC_KEY, value);
  // Honour the flag live: off fades out and stops, on fades back in when the
  // current screen still wants music.
  if (!value) fadeOutTheme(true);
  else if (themeDesired) startTheme();
}


// Back-compat wrappers — GameWindow (solo) uses these. `muted` is the inverse
// of sfxEnabled.
export function setMuted(value: boolean): void { setSfxEnabled(!value); }
export function isMuted(): boolean { return !sfxEnabled; }

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

// ---------------------------------------------------------------------------
// Clips + balance
// ---------------------------------------------------------------------------

type ClipName =
  | "flip"
  | "deal"
  | "dice"
  | "correct"
  | "wrong"
  | "whoop"
  | "peek"
  | "reveal"
  | "start";

const CLIP_FILES: Record<ClipName, string> = {
  flip: "/sounds/flip.mp3",
  deal: "/sounds/deal.mp3",
  dice: "/sounds/dice.mp3",
  correct: "/sounds/correct.mp3",
  wrong: "/sounds/wrong.mp3",
  whoop: "/sounds/whoop.mp3",
  // NOTE: the shipped file is spelled peak.mp3.
  peek: "/sounds/peak.mp3",
  reveal: "/sounds/reveal.mp3",
  start: "/sounds/start.mp3",
};

/** Single place to tune the mix. `correct` is the loudest thing in the app. */
export const CLIP_GAIN: Record<ClipName, number> = {
  flip: 0.25,
  deal: 0.9,
  dice: 0.50,
  wrong: 0.50,
  whoop: 0.60,
  correct: 1.0,
  peek: 0.45,
  reveal: 0.55,
  start: 0.7,
};


/** Gain for the placeholder select cue (a detuned flip). */
const SELECT_GAIN = 0.3;

/** A play() request for an undecoded clip is honoured if it arrives by then. */
const LATE_PLAY_MS = 400;


interface Clip {
  buffer: AudioBuffer;
  /** Seconds of near-silence to skip so a tap never sounds late. */
  offset: number;
}

const clips = new Map<ClipName, Clip>();
const loading = new Map<ClipName, Promise<void>>();

const SILENCE_THRESHOLD = 0.01;
const MAX_LEAD_MS = 20;

/** Detects leading near-silence; returns 0 when it is under ~20ms. */
function leadingSilence(buffer: AudioBuffer): number {
  try {
    const data = buffer.getChannelData(0);
    const limit = Math.min(data.length, Math.floor(buffer.sampleRate * 0.5));
    let i = 0;
    while (i < limit && Math.abs(data[i]) < SILENCE_THRESHOLD) i++;
    const ms = (i / buffer.sampleRate) * 1000;
    return ms > MAX_LEAD_MS ? i / buffer.sampleRate : 0;
  } catch { return 0; }
}

function loadClip(name: ClipName): Promise<void> {
  const existing = loading.get(name);
  if (existing) return existing;
  const p = (async () => {
    try {
      const res = await fetch(CLIP_FILES[name]);
      if (!res.ok) return;
      const bytes = await res.arrayBuffer();
      const buffer = await getCtx().decodeAudioData(bytes);
      clips.set(name, { buffer, offset: leadingSilence(buffer) });
    } catch {
      // A missing or undecodable file simply makes that effect a no-op.
    }
  })();
  loading.set(name, p);
  return p;
}

function preload(): void {
  (Object.keys(CLIP_FILES) as ClipName[]).forEach((n) => { void loadClip(n); });
}

/** True once a user gesture has run through unlockAudio(). */
let audioUnlocked = false;
export function hasAudioUnlocked(): boolean { return audioUnlocked; }

// Safe to call repeatedly. Resumes a suspended context (browsers require a
// user gesture before audio starts) and lazily loads the clips.
export function unlockAudio(): void {
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") {
      // Fire-and-forget; resume() returns a Promise but we don't await it.
      void ctx.resume();
    }
    audioUnlocked = true;
    preload();
    // A screen that wants music may have asked for it before the gesture.
    if (themeDesired) startTheme();
  } catch { /* ignore — no AudioContext available */ }
}

// ---------------------------------------------------------------------------
// Background theme — music, behind musicEnabled, never an effect
// ---------------------------------------------------------------------------

const THEME_FILE = "/sounds/theme.mp3";
const THEME_GAIN = 0.15;
const THEME_FADE_IN_MS = 600;
const THEME_FADE_OUT_MS = 400;

let themeBuffer: AudioBuffer | null = null;
let themeLoading: Promise<void> | null = null;
let themeSource: AudioBufferSourceNode | null = null;
let themeGainNode: GainNode | null = null;
/** The screen wants music, regardless of whether it is audible right now. */
let themeDesired = false;
let themeStopTimer: ReturnType<typeof setTimeout> | null = null;

function loadTheme(): Promise<void> {
  if (themeLoading) return themeLoading;
  themeLoading = (async () => {
    try {
      const res = await fetch(THEME_FILE);
      if (!res.ok) return;
      themeBuffer = await getCtx().decodeAudioData(await res.arrayBuffer());
    } catch { /* missing file: music is simply a no-op */ }
  })();
  return themeLoading;
}

function ramp(node: GainNode, to: number, ms: number) {
  const ctx = getCtx();
  const now = ctx.currentTime;
  const current = node.gain.value;
  node.gain.cancelScheduledValues(now);
  node.gain.setValueAtTime(current, now);
  node.gain.linearRampToValueAtTime(to, now + ms / 1000);
}

/**
 * Fade the theme in and keep it looping. Called from screens that should have
 * music; a no-op until a gesture has unlocked audio, and it never restarts an
 * already-running loop — it just ramps the level back up.
 */
export function startTheme(): void {
  themeDesired = true;
  if (!musicEnabled || !audioUnlocked) return;
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") void ctx.resume();
    if (themeStopTimer) { clearTimeout(themeStopTimer); themeStopTimer = null; }

    if (themeSource && themeGainNode) {
      ramp(themeGainNode, THEME_GAIN, THEME_FADE_IN_MS);
      return;
    }
    if (!themeBuffer) {
      void loadTheme().then(() => { if (themeDesired) startTheme(); });
      return;
    }
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(ctx.destination);
    const src = ctx.createBufferSource();
    src.buffer = themeBuffer;
    src.loop = true;
    src.connect(g);
    src.start();
    themeSource = src;
    themeGainNode = g;
    ramp(g, THEME_GAIN, THEME_FADE_IN_MS);
  } catch { /* never throw from audio */ }
}

function fadeOutTheme(hard: boolean): void {
  try {
    if (!themeSource || !themeGainNode) return;
    ramp(themeGainNode, 0, THEME_FADE_OUT_MS);
    if (!hard) return;
    // Only a musicEnabled=false toggle tears the node down; a screen change
    // leaves the loop running so it resumes mid-phrase, not from the top.
    if (themeStopTimer) clearTimeout(themeStopTimer);
    themeStopTimer = setTimeout(() => {
      try { themeSource?.stop(); } catch { /* ignore */ }
      themeSource = null;
      themeGainNode = null;
      themeStopTimer = null;
    }, THEME_FADE_OUT_MS + 40);
  } catch { /* ignore */ }
}

/** Fade the theme out. The loop keeps running silently underneath. */
export function stopTheme(): void {
  themeDesired = false;
  fadeOutTheme(false);
}


interface PlayOpts {
  /** Extra multiplier on top of the clip's mix level. */
  gain?: number;
  /** Playback rate for subtle detune (1 = no change). */
  rate?: number;
  /** Delay before playback, in seconds. */
  delay?: number;
}

function emit(name: ClipName, opts: PlayOpts): void {
  const clip = clips.get(name);
  if (!clip) return;
  const ctx = getCtx();
  // Browsers can suspend the context at any time (tab switch, autoplay
  // policy), so resume on every play, not just on unlock.
  if (ctx.state === "suspended") void ctx.resume();
  const src = ctx.createBufferSource();
  src.buffer = clip.buffer;
  src.playbackRate.value = opts.rate ?? 1;
  const g = ctx.createGain();
  g.gain.value = CLIP_GAIN[name] * (opts.gain ?? 1);
  src.connect(g);
  g.connect(ctx.destination);
  const when = ctx.currentTime + (opts.delay ?? 0);
  src.start(when, clip.offset);
}

function play(name: ClipName, opts: PlayOpts = {}): void {
  if (!sfxEnabled) return;
  try {
    if (clips.has(name)) {
      emit(name, opts);
      return;
    }
    // Not decoded yet: load it and still play it when it lands, as long as the
    // cue has not gone stale. A late sound beats a dropped one.
    const requestedAt = Date.now();
    void loadClip(name).then(() => {
      if (!sfxEnabled) return;
      if (Date.now() - requestedAt > LATE_PLAY_MS) return;
      try { emit(name, opts); } catch { /* ignore */ }
    });
  } catch { /* never throw from audio */ }
}

// ---------------------------------------------------------------------------
// Public effects — signatures unchanged
// ---------------------------------------------------------------------------

export function playFlip() {
  play("flip");
}

export function playDeal(count: number = 1) {
  if (!sfxEnabled) return;
  const n = Math.max(1, Math.floor(count));
  for (let i = 0; i < n; i++) {
    // ~70ms stagger, with a touch of detune/level jitter so repeated cards
    // never sound like the same sample twice.
    play("deal", {
      delay: i * 0.07,
      rate: 0.94 + Math.random() * 0.12,
      gain: 0.85 + Math.random() * 0.3,
    });
  }
}

export function playDiceRoll() {
  play("dice");
}

export function playCorrect() {
  play("correct");
}

export function playWrong() {
  play("wrong");
}

export function playWhoopCall() {
  play("whoop");
}

export function playPeek() {
  play("peek");
}

export function playReveal() {
  play("reveal");
}

/**
 * Card-select cue. Placeholder: a detuned, quiet flip until a real
 * select.mp3 ships — swap the body, keep the name.
 */
export function playSelect() {
  play("flip", { rate: 1.35, gain: SELECT_GAIN / CLIP_GAIN.flip });
}

