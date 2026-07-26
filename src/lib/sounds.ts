// Audio effects + persisted settings.
//
// Two independent flags: sfxEnabled controls the six effect functions;
// musicEnabled is exposed for future use (theme music, ambience). Both persist
// to localStorage so a page refresh preserves the user's choice.
//
// unlockAudio() must be called from a user gesture — in multiplayer, effects
// fire from remote broadcasts with no local gesture, so a joiner's AudioContext
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

// Safe to call repeatedly. Resumes a suspended context (browsers require a
// user gesture before audio starts).
export function unlockAudio(): void {
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") {
      // Fire-and-forget; resume() returns a Promise but we don't await it.
      void ctx.resume();
    }
  } catch { /* ignore — no AudioContext available */ }
}

function playTone(freq: number, duration: number, type: OscillatorType = "square", volume = 0.15) {
  if (!sfxEnabled) return;
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration / 1000);
}

export function playFlip() {
  playTone(800, 80, "square", 0.1);
}

export function playDeal(count: number = 1) {
  if (!sfxEnabled) return;
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      playTone(320 + Math.random() * 80, 55, "triangle", 0.06);
      setTimeout(() => playTone(180, 35, "sine", 0.05), 30);
    }, i * 70);
  }
}

export function playDiceRoll() {
  if (!sfxEnabled) return;
  const freqs = [640, 580, 520, 470, 600, 540, 480, 430, 560, 500, 440];
  freqs.forEach((f, i) => {
    setTimeout(() => playTone(f, 60, "square", 0.07), i * 75);
  });
}

export function playCorrect() {
  if (!sfxEnabled) return;
  playTone(523, 200, "sine", 0.15);
  setTimeout(() => playTone(659, 200, "sine", 0.15), 120);
}

export function playWrong() {
  playTone(200, 150, "sawtooth", 0.1);
}

export function playWhoopCall() {
  if (!sfxEnabled) return;
  playTone(520, 90, "sine", 0.12);
  setTimeout(() => playTone(720, 90, "sine", 0.12), 110);
}
