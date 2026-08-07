// Synthesized audio effects + persisted settings.
//
// Every effect is built at play time from Web Audio nodes — there are no
// recorded effect files any more. The technique: physical sounds are filtered
// noise, not pitch. Each cue is a short white-noise burst shaped by a filter
// and a fast gain envelope, with a tuned oscillator only where a real object
// would resonate (the wood knock in `correct`, the body under `whoop`).
//
// Every effect jitters its filter frequency, decay and level slightly, so a
// repeated tap never sounds like the same sample twice.
//
// Two independent flags: sfxEnabled controls the effect functions; musicEnabled
// controls the background theme (still a real recording, /sounds/theme.mp3).
// Both persist to localStorage so a refresh preserves the user's choice.
//
// unlockAudio() must be called from a user gesture — it resumes the context and
// starts the theme if a screen has asked for it.

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
// Mix balance — one place to tune every effect's level
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
  | "start"
  | "select"
  | "dieLand"
  | "tick"
  | "deselect"
  | "roundAdvance"
  | "subscribed";

/**
 * Single place to tune the mix. `correct` is the loudest thing in the app.
 *
 * These numbers were set by measuring each cue's real output peak (filtered
 * noise loses a lot of energy in the bandpass, so the raw levels inside the
 * effects are not comparable). Each gain is scaled so the cue hits its
 * intended peak, keeping the old hierarchy: correct loudest, flip and deal
 * near-subliminal.
 */
export const CLIP_GAIN: Record<ClipName, number> = {
  flip: 0.95,
  deal: 1.0,
  dice: 0.95,
  wrong: 1.8,
  whoop: 0.72,
  correct: 1.7,
  peek: 1.5,
  reveal: 0.9,
  start: 0.95,
  select: 0.85,
  dieLand: 2.2,
  tick: 0.75,
  deselect: 0.66,
  roundAdvance: 1.2,
  subscribed: 1.1,
};


/** True once a user gesture has run through unlockAudio(). */
let audioUnlocked = false;
export function hasAudioUnlocked(): boolean { return audioUnlocked; }

// Safe to call repeatedly. Resumes a suspended context (browsers require a
// user gesture before audio starts) and starts the theme if one is wanted.
export function unlockAudio(): void {
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") {
      // Fire-and-forget; resume() returns a Promise but we don't await it.
      void ctx.resume();
    }
    audioUnlocked = true;
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

// ---------------------------------------------------------------------------
// Synthesis primitives
// ---------------------------------------------------------------------------

/** One second of white noise, generated once and reused by every burst. */
let noiseBuffer: AudioBuffer | null = null;
function getNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const len = Math.floor(ctx.sampleRate);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

/** Random number in [a, b). */
function rand(a: number, b: number): number { return a + Math.random() * (b - a); }
/** Multiplicative jitter around 1, e.g. jitter(0.08) → 0.92..1.08. */
function jitter(amount: number): number { return 1 + rand(-amount, amount); }

/** Prepares the context for a cue; returns null when audio is unavailable. */
function begin(): { ctx: AudioContext; t0: number } | null {
  if (!sfxEnabled) return null;
  try {
    const ctx = getCtx();
    // Browsers can suspend the context at any time (tab switch, autoplay
    // policy), so resume on every cue, not just on unlock.
    if (ctx.state === "suspended") void ctx.resume();
    return { ctx, t0: ctx.currentTime };
  } catch { return null; }
}

interface NoiseOpts {
  /** Start time, seconds from now. */
  at?: number;
  /** Burst length in seconds — also the envelope's decay. */
  dur: number;
  /** Peak level before the master gain is applied. */
  level: number;
  filter?: BiquadFilterType;
  freq?: number;
  q?: number;
  /** Attack in seconds; keep tiny for a click. */
  attack?: number;
  /** Optional filter sweep target, for rising/falling textures. */
  freqTo?: number;
}

/** A filtered, enveloped white-noise burst — the workhorse of every effect. */
function noise(ctx: AudioContext, t0: number, master: number, o: NoiseOpts): void {
  const start = t0 + (o.at ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  src.loop = true;
  // A random read position keeps the grain different on every hit.
  const readAt = Math.random() * 0.9;

  const biquad = ctx.createBiquadFilter();
  biquad.type = o.filter ?? "bandpass";
  const freq = Math.max(40, Math.min(18000, o.freq ?? 3000));
  biquad.frequency.setValueAtTime(freq, start);
  if (o.freqTo !== undefined) {
    biquad.frequency.exponentialRampToValueAtTime(
      Math.max(40, Math.min(18000, o.freqTo)),
      start + o.dur
    );
  }
  biquad.Q.value = o.q ?? 1;

  const g = ctx.createGain();
  const peak = Math.max(0.0001, o.level * master);
  const attack = o.attack ?? 0.002;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + o.dur);

  src.connect(biquad);
  biquad.connect(g);
  g.connect(ctx.destination);
  src.start(start, readAt);
  src.stop(start + o.dur + 0.02);
}

interface ToneOpts {
  at?: number;
  dur: number;
  level: number;
  freq: number;
  /** Optional glide target. */
  freqTo?: number;
  type?: OscillatorType;
  attack?: number;
}

/** A short enveloped oscillator — only for things that would truly resonate. */
function tone(ctx: AudioContext, t0: number, master: number, o: ToneOpts): void {
  const start = t0 + (o.at ?? 0);
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, start);
  if (o.freqTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqTo), start + o.dur);
  }
  const g = ctx.createGain();
  const peak = Math.max(0.0001, o.level * master);
  const attack = o.attack ?? 0.004;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + o.dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + o.dur + 0.02);
}

/** Never let an audio failure reach gameplay. */
function safe(fn: () => void): void {
  try { fn(); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// The card textures, shared by flip / deal / select / reveal
// ---------------------------------------------------------------------------

function flipTexture(
  ctx: AudioContext,
  t0: number,
  master: number,
  at = 0,
  scale = 1
): void {
  noise(ctx, t0, master, {
    at,
    dur: 0.06 * jitter(0.15),
    level: 0.9 * scale,
    filter: "bandpass",
    freq: 3000 * jitter(0.18),
    q: 1.1 * jitter(0.2),
    attack: 0.001,
  });
}

/** Low-frequency body: the card, palm or die meeting the table. */
function thump(
  ctx: AudioContext,
  t0: number,
  master: number,
  at: number,
  freq: number,
  dur: number,
  level: number
): void {
  noise(ctx, t0, master, {
    at,
    dur: dur * jitter(0.15),
    level,
    filter: "lowpass",
    freq: freq * jitter(0.15),
    q: 0.8,
    attack: 0.002,
  });
}

/** A wood knock: resonant lowpassed noise plus a fast-dying low sine. */
function woodKnock(
  ctx: AudioContext,
  t0: number,
  master: number,
  at: number,
  level = 1
): void {
  noise(ctx, t0, master, {
    at,
    dur: 0.085 * jitter(0.12),
    level: 0.85 * level,
    filter: "lowpass",
    freq: 1100 * jitter(0.14),
    q: 6 * jitter(0.2),
    attack: 0.001,
  });
  tone(ctx, t0, master, {
    at,
    dur: 0.08 * jitter(0.12),
    level: 0.45 * level,
    freq: 190 * jitter(0.1),
    freqTo: 120,
    attack: 0.002,
  });
}

// ---------------------------------------------------------------------------
// Public effects — signatures unchanged
// ---------------------------------------------------------------------------

export function playFlip(): void {
  const b = begin();
  if (!b) return;
  safe(() => flipTexture(b.ctx, b.t0, CLIP_GAIN.flip));
}

export function playDeal(count: number = 1): void {
  const b = begin();
  if (!b) return;
  const n = Math.max(1, Math.floor(count));
  safe(() => {
    for (let i = 0; i < n; i++) {
      // ~70ms stagger with per-card jitter, so repeated cards never sound like
      // the same sample twice.
      const at = i * 0.07 * jitter(0.12);
      flipTexture(b.ctx, b.t0, CLIP_GAIN.deal, at, rand(0.8, 1.1));
      thump(b.ctx, b.t0, CLIP_GAIN.deal, at + 0.012, 320, 0.07, rand(0.3, 0.45));
    }
  });
}

/**
 * Card-select cue: a very short, bright tick — quieter than flip.
 */
export function playSelect(): void {
  const b = begin();
  if (!b) return;
  safe(() => {
    noise(b.ctx, b.t0, CLIP_GAIN.select, {
      dur: 0.03 * jitter(0.15),
      level: 0.9,
      filter: "highpass",
      freq: 5200 * jitter(0.15),
      q: 0.9,
      attack: 0.0008,
    });
  });
}

/** Deselect: the same tick, lower and softer. */
export function playDeselect(): void {
  const b = begin();
  if (!b) return;
  safe(() => {
    noise(b.ctx, b.t0, CLIP_GAIN.deselect, {
      dur: 0.045 * jitter(0.15),
      level: 0.85,
      filter: "bandpass",
      freq: 1500 * jitter(0.18),
      q: 1.2,
      attack: 0.001,
    });
  });
}

/** A palm on a table: broadband slap with a short low body under it. */
export function playWhoopCall(): void {
  const b = begin();
  if (!b) return;
  safe(() => {
    noise(b.ctx, b.t0, CLIP_GAIN.whoop, {
      dur: 0.075 * jitter(0.12),
      level: 1,
      filter: "highpass",
      freq: 900 * jitter(0.2),
      q: 0.7,
      attack: 0.0006,
    });
    thump(b.ctx, b.t0, CLIP_GAIN.whoop, 0.004, 240, 0.13, 0.8);
  });
}

/** Wood knock, then two soft filtered tones. Warm, not a chime. */
export function playCorrect(): void {
  const b = begin();
  if (!b) return;
  safe(() => {
    woodKnock(b.ctx, b.t0, CLIP_GAIN.correct, 0);
    const base = 392 * jitter(0.02);
    noise(b.ctx, b.t0, CLIP_GAIN.correct, {
      at: 0.1,
      dur: 0.16,
      level: 0.22,
      filter: "bandpass",
      freq: base * 2,
      q: 9,
      attack: 0.01,
    });
    tone(b.ctx, b.t0, CLIP_GAIN.correct, {
      at: 0.1, dur: 0.2 * jitter(0.1), level: 0.2, freq: base, attack: 0.012,
    });
    tone(b.ctx, b.t0, CLIP_GAIN.correct, {
      at: 0.24, dur: 0.28 * jitter(0.1), level: 0.18, freq: base * 1.5, attack: 0.014,
    });
  });
}

/** A dull, short lowpassed thud. No buzz. */
export function playWrong(): void {
  const b = begin();
  if (!b) return;
  safe(() => {
    thump(b.ctx, b.t0, CLIP_GAIN.wrong, 0, 320, 0.16, 1);
    tone(b.ctx, b.t0, CLIP_GAIN.wrong, {
      dur: 0.14 * jitter(0.12), level: 0.3, freq: 130 * jitter(0.08), freqTo: 80,
    });
  });
}

/** Five or six clicks decelerating over ~900ms, then a settling click. */
export function playDiceRoll(): void {
  const b = begin();
  if (!b) return;
  safe(() => {
    const n = 5 + Math.floor(Math.random() * 2);
    let at = 0.02;
    let gap = 0.075 * jitter(0.15);
    for (let i = 0; i < n; i++) {
      noise(b.ctx, b.t0, CLIP_GAIN.dice, {
        at,
        dur: 0.04 * jitter(0.2),
        level: rand(0.7, 1),
        filter: "bandpass",
        freq: 2400 * jitter(0.3),
        q: 2.4 * jitter(0.25),
        attack: 0.0008,
      });
      at += gap;
      gap *= rand(1.35, 1.6); // decelerate
    }
    const settle = Math.min(at, 0.86);
    noise(b.ctx, b.t0, CLIP_GAIN.dice, {
      at: settle,
      dur: 0.06,
      level: 0.9,
      filter: "lowpass",
      freq: 1400 * jitter(0.15),
      q: 3,
      attack: 0.001,
    });
  });
}

/** The die landing: one firm knock with a little body. */
export function playDieLand(): void {
  const b = begin();
  if (!b) return;
  safe(() => {
    noise(b.ctx, b.t0, CLIP_GAIN.dieLand, {
      dur: 0.055 * jitter(0.15),
      level: 0.95,
      filter: "lowpass",
      freq: 1800 * jitter(0.18),
      q: 4 * jitter(0.2),
      attack: 0.0008,
    });
    thump(b.ctx, b.t0, CLIP_GAIN.dieLand, 0.008, 280, 0.1, 0.55);
  });
}

/** A soft rising filtered sweep — an intake of breath. */
export function playPeek(): void {
  const b = begin();
  if (!b) return;
  safe(() => {
    noise(b.ctx, b.t0, CLIP_GAIN.peek, {
      dur: 0.34 * jitter(0.12),
      level: 0.9,
      filter: "bandpass",
      freq: 500 * jitter(0.15),
      freqTo: 4200 * jitter(0.15),
      q: 1.6,
      attack: 0.07,
    });
  });
}

/** Nine overlapping flip textures scattered across ~400ms. */
export function playReveal(): void {
  const b = begin();
  if (!b) return;
  safe(() => {
    for (let i = 0; i < 9; i++) {
      flipTexture(b.ctx, b.t0, CLIP_GAIN.reveal, rand(0, 0.4), rand(0.7, 1.05));
    }
  });
}

/** Run-start cue: a low swell into a single wood knock. */
export function playStart(): void {
  const b = begin();
  if (!b) return;
  safe(() => {
    noise(b.ctx, b.t0, CLIP_GAIN.start, {
      dur: 0.42 * jitter(0.1),
      level: 0.5,
      filter: "lowpass",
      freq: 220 * jitter(0.15),
      freqTo: 900,
      q: 1,
      attack: 0.3,
    });
    woodKnock(b.ctx, b.t0, CLIP_GAIN.start, 0.42, 1);
  });
}

/** A brief marker between rounds. */
export function playRoundAdvance(): void {
  const b = begin();
  if (!b) return;
  safe(() => {
    noise(b.ctx, b.t0, CLIP_GAIN.roundAdvance, {
      dur: 0.12 * jitter(0.15),
      level: 0.7,
      filter: "bandpass",
      freq: 1600 * jitter(0.2),
      freqTo: 3000,
      q: 2,
      attack: 0.006,
    });
    tone(b.ctx, b.t0, CLIP_GAIN.roundAdvance, {
      at: 0.02, dur: 0.16 * jitter(0.12), level: 0.16, freq: 300 * jitter(0.06), freqTo: 440,
    });
  });
}

/** A soft tick for the closing seconds of the study countdown. */
export function playTick(): void {
  const b = begin();
  if (!b) return;
  safe(() => {
    noise(b.ctx, b.t0, CLIP_GAIN.tick, {
      dur: 0.025 * jitter(0.2),
      level: 0.9,
      filter: "bandpass",
      freq: 2600 * jitter(0.2),
      q: 3,
      attack: 0.0008,
    });
  });
}

/** One small confirm when the email signup lands. */
export function playSubscribed(): void {
  const b = begin();
  if (!b) return;
  safe(() => {
    const base = 523 * jitter(0.02);
    tone(b.ctx, b.t0, CLIP_GAIN.subscribed, {
      dur: 0.13 * jitter(0.1), level: 0.3, freq: base, attack: 0.008,
    });
    tone(b.ctx, b.t0, CLIP_GAIN.subscribed, {
      at: 0.1, dur: 0.2 * jitter(0.1), level: 0.26, freq: base * 1.5, attack: 0.01,
    });
    noise(b.ctx, b.t0, CLIP_GAIN.subscribed, {
      dur: 0.05, level: 0.3, filter: "highpass", freq: 4000 * jitter(0.15), attack: 0.001,
    });
  });
}
