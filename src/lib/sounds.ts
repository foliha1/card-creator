let audioCtx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = "square", volume = 0.15) {
  if (muted) return;
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

export function setMuted(value: boolean) {
  muted = value;
}

export function isMuted() {
  return muted;
}

export function playFlip() {
  playTone(800, 80, "square", 0.1);
}

export function playDeal(count: number = 1) {
  if (muted) return;
  // Soft "whoosh-tick" per card, slightly staggered
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      playTone(320 + Math.random() * 80, 55, "triangle", 0.06);
      setTimeout(() => playTone(180, 35, "sine", 0.05), 30);
    }, i * 70);
  }
}

export function playDiceRoll() {
  if (muted) return;
  // Spans ~800ms to stay in sync with the dice-tumble / dieValues cycling window.
  const freqs = [640, 580, 520, 470, 600, 540, 480, 430, 560, 500, 440];
  freqs.forEach((f, i) => {
    setTimeout(() => playTone(f, 60, "square", 0.07), i * 75);
  });
}

export function playCorrect() {
  if (muted) return;
  playTone(523, 200, "sine", 0.15);
  setTimeout(() => playTone(659, 200, "sine", 0.15), 120);
}

export function playWrong() {
  playTone(200, 150, "sawtooth", 0.1);
}

export function playDoubleMatch() {
  if (muted) return;
  const freqs = [440, 554, 659];
  freqs.forEach((f, i) => {
    setTimeout(() => playTone(f, 180, "sine", 0.15), i * 140);
  });
}
