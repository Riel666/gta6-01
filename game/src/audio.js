// Synthesized sound only: every effect is an oscillator or filtered noise built
// with the Web Audio API, so the game ships no audio files at all. Nothing here
// throws when audio is unavailable (headless browsers, muted tabs); the context
// is created lazily on the first user gesture.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    try {
      if (c.state === 'suspended') void c.resume();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g).connect(c.destination);
      o.start();
      o.stop(c.currentTime + dur + 0.02);
    } catch { /* sound is decoration; never break the game */ }
  }

  function noiseBurst(dur, vol, lowFreq) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    try {
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buf;
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowFreq || 1200;
      const g = c.createGain();
      g.gain.value = vol;
      src.connect(filter).connect(g).connect(c.destination);
      src.start();
    } catch { /* ignore */ }
  }

  return {
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      if (muted) this.stopEngine();
      return muted;
    },
    isMuted() { return muted; },
    punch() { noiseBurst(0.12, 0.5, 900); tone(140, 0.1, 'square', 0.18, 70); },
    thud() { noiseBurst(0.2, 0.5, 500); tone(90, 0.18, 'sine', 0.35, 45); },
    pickup() { tone(660, 0.09, 'sine', 0.25); setTimeout(() => tone(880, 0.12, 'sine', 0.25), 90); },
    missionDone() {
      tone(523, 0.14, 'triangle', 0.3);
      setTimeout(() => tone(659, 0.14, 'triangle', 0.3), 140);
      setTimeout(() => tone(784, 0.26, 'triangle', 0.32), 280);
    },
    missionStart() { tone(392, 0.12, 'triangle', 0.28); setTimeout(() => tone(523, 0.2, 'triangle', 0.28), 120); },
    busted() { tone(220, 0.5, 'sawtooth', 0.25, 110); },
    crash() { noiseBurst(0.3, 0.6, 700); },
    horn() { tone(370, 0.28, 'square', 0.16); setTimeout(() => tone(311, 0.28, 'square', 0.16), 30); },
    startEngine(speed01) {
      if (muted) return;
      const c = ensure();
      if (!c) return;
      try {
        if (!engineOsc) {
          engineOsc = c.createOscillator();
          engineGain = c.createGain();
          engineOsc.type = 'sawtooth';
          engineOsc.frequency.value = 60;
          engineGain.gain.value = 0.0;
          const filter = c.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 420;
          engineOsc.connect(filter).connect(engineGain).connect(c.destination);
          engineOsc.start();
        }
        engineOsc.frequency.value = 55 + speed01 * 130;
        engineGain.gain.value = 0.05 + speed01 * 0.05;
      } catch { /* ignore */ }
    },
    stopEngine() {
      try {
        if (engineOsc) { engineOsc.stop(); engineOsc = null; engineGain = null; }
      } catch { engineOsc = null; }
    },
    updateSiren(dt, wanted) {
      if (muted || wanted === 0) {
        try { if (sirenOsc) { sirenOsc.stop(); sirenOsc = null; sirenGain = null; } } catch { sirenOsc = null; }
        return;
      }
      const c = ensure();
      if (!c) return;
      try {
        if (!sirenOsc) {
          sirenOsc = c.createOscillator();
          sirenGain = c.createGain();
          sirenOsc.type = 'sine';
          sirenOsc.frequency.value = 700;
          sirenGain.gain.value = 0.035;
          sirenOsc.connect(sirenGain).connect(c.destination);
          sirenOsc.start();
        }
        sirenTimer += dt;
        sirenOsc.frequency.value = (Math.floor(sirenTimer * 1.6) % 2 === 0) ? 700 : 950;
      } catch { /* ignore */ }
    },
  };
}
