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

type ClipName = "flip" | "deal" | "dice" | "correct" | "wrong" | "whoop";

const CLIP_FILES: Record<ClipName, string> = {
  flip: "/sounds/flip.mp3",
  deal: "/sounds/deal.mp3",
  dice: "/sounds/dice.mp3",
  correct: "/sounds/correct.mp3",
  wrong: "/sounds/wrong.mp3",
  whoop: "/sounds/whoop.mp3",
};

/** Single place to tune the mix. `correct` is the loudest thing in the app. */
export const CLIP_GAIN: Record<ClipName, number> = {
  flip: 0.25,
  deal: 0.20,
  dice: 0.50,
  wrong: 0.50,
  whoop: 0.60,
  correct: 1.0,
};

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

// Safe to call repeatedly. Resumes a suspended context (browsers require a
// user gesture before audio starts) and lazily loads the clips.
export function unlockAudio(): void {
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") {
      // Fire-and-forget; resume() returns a Promise but we don't await it.
      void ctx.resume();
    }
    preload();
  } catch { /* ignore — no AudioContext available */ }
}

interface PlayOpts {
  /** Extra multiplier on top of the clip's mix level. */
  gain?: number;
  /** Playback rate for subtle detune (1 = no change). */
  rate?: number;
  /** Delay before playback, in seconds. */
  delay?: number;
}

function play(name: ClipName, opts: PlayOpts = {}): void {
  if (!sfxEnabled) return;
  try {
    const clip = clips.get(name);
    if (!clip) {
      // Not decoded yet — start it so the next call has it, then stay silent.
      void loadClip(name);
      return;
    }
    const ctx = getCtx();
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
