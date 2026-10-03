// Web Audio API Sound Generator for Scanning Feedback

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playSuccessChime(isPerfect = false) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Notes: C5 -> E5 -> G5 (or high C6 if perfect)
    const frequencies = isPerfect ? [523.25, 659.25, 783.99, 1046.50] : [587.33, 880.00];
    const duration = isPerfect ? 0.12 : 0.15;

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isPerfect ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * duration);

      gain.gain.setValueAtTime(0, now + idx * duration);
      gain.gain.linearRampToValueAtTime(0.25, now + idx * duration + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * duration + duration + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * duration);
      osc.stop(now + idx * duration + duration + 0.25);
    });

    // Device vibration if supported
    if ('vibrate' in navigator) {
      navigator.vibrate(isPerfect ? [100, 50, 150] : [120]);
    }
  } catch (err) {
    console.warn('Audio feedback failed:', err);
  }
}

export function playTickSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch (err) {
    // ignore
  }
}
