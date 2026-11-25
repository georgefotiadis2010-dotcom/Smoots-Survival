/**
 * EXOTIC-017: Zero-Dependency Web Audio Engine
 * Pure procedural Web Audio API music sequencer & SFX synthesizer.
 * Safe in headless Node/test environments (guards AudioContext availability)
 * and respects browser autoplay policies via lazy unlock().
 */

const VALID_MODES = new Set(['explore', 'stealth', 'boss', 'victory']);

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// 16-step musical patterns (MIDI note numbers, null = rest)
const PATTERNS = {
  // ~112 BPM — Warm C-major pentatonic tropical marimba + soft bongo/shaker groove
  explore: {
    bpm: 112,
    stepsPerBeat: 2, // 8th notes
    melody: [72, null, 76, 79, null, 81, 79, 76, 74, null, 76, 72, null, 79, 76, null],
    bass: [48, null, null, 48, 55, null, null, 55, 57, null, null, 57, 53, null, 55, null],
    bongo: ['low', null, 'high', null, 'low', 'high', null, 'high', 'low', null, 'high', null, 'low', null, 'high', 'low'],
    shaker: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
  },
  // ~106 BPM — Tense pulsing low-pass spy bassline + subtle rim clicks
  stealth: {
    bpm: 106,
    stepsPerBeat: 2,
    melody: [null, null, 64, null, null, null, 67, null, null, null, 65, null, null, 64, null, null],
    bass: [40, 40, null, 40, 41, null, 40, null, 40, 40, null, 43, 41, null, 38, null],
    rim: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1],
    shaker: [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1],
  },
  // ~138 BPM — Driving synth bass + urgent D-minor lead arpeggio for Director Vance
  boss: {
    bpm: 138,
    stepsPerBeat: 2,
    melody: [74, 77, 81, 77, 82, 81, 77, 74, 72, 76, 79, 76, 81, 79, 76, 73],
    bass: [38, 38, 41, 38, 43, 38, 45, 43, 36, 36, 40, 36, 41, 40, 38, 37],
    kick: [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0],
    snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1],
  },
  // ~124 BPM — Bright tropical brass + marimba celebration loop
  victory: {
    bpm: 124,
    stepsPerBeat: 2,
    melody: [72, 76, 79, 84, null, 81, 79, 76, 77, 81, 84, 86, null, 84, 79, 84],
    bass: [48, null, 55, null, 57, null, 52, null, 53, null, 48, null, 55, null, 55, 59],
    brass: [60, null, null, null, 64, null, null, null, 65, null, null, null, 67, null, 72, null],
    bongo: ['low', 'high', null, 'high', 'low', null, 'high', 'low', 'low', 'high', null, 'high', 'low', 'high', 'high', null],
    shaker: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1],
  },
};

export function createAudioSystem(ctx) {
  let audioCtx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let noiseBuffer = null;

  let unlocked = false;
  let muted = false;
  let musicMode = 'explore';
  let stepIndex = 0;
  let stepAccum = 0;

  let lastDetected = false;
  let alertSfxCooldown = 0;

  function getAudioContextCtor() {
    if (typeof window === 'undefined') return null;
    return window.AudioContext || window.webkitAudioContext || null;
  }

  function createNoiseBuffer(ac) {
    const length = Math.floor(ac.sampleRate * 1.0);
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function ensureContext() {
    if (audioCtx) return audioCtx;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;

    try {
      audioCtx = new Ctor();
      masterGain = audioCtx.createGain();
      musicGain = audioCtx.createGain();
      sfxGain = audioCtx.createGain();

      masterGain.gain.value = muted ? 0.0001 : 0.6;
      musicGain.gain.value = 0.34;
      sfxGain.gain.value = 0.78;

      musicGain.connect(masterGain);
      sfxGain.connect(masterGain);
      masterGain.connect(audioCtx.destination);

      noiseBuffer = createNoiseBuffer(audioCtx);
      return audioCtx;
    } catch {
      audioCtx = null;
      return null;
    }
  }

  function unlock() {
    const ac = ensureContext();
    if (!ac) return false;
    unlocked = true;
    if (ac.state === 'suspended') {
      ac.resume().catch(() => {});
    }
    return true;
  }

  function isReady() {
    if (muted || !unlocked || !audioCtx) return false;
    if (audioCtx.state === 'suspended') return false;
    return true;
  }

  function setMusicMode(mode) {
    if (!VALID_MODES.has(mode)) return false;
    if (musicMode === mode) return true;
    musicMode = mode;
    stepIndex = 0;
    stepAccum = 0;
    return true;
  }

  function toggleMute() {
    muted = !muted;
    if (audioCtx && masterGain) {
      const now = audioCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setTargetAtTime(muted ? 0.0001 : 0.6, now, 0.03);
    }
    return muted;
  }

  function isMuted() {
    return muted;
  }

  // --- Low-level Synthesis Helpers ---

  function playTone({
    freq = 440,
    endFreq = null,
    type = 'sine',
    duration = 0.2,
    gain = 0.2,
    attack = 0.006,
    detune = 0,
    filterFreq = null,
    filterQ = 1,
    dest = sfxGain,
    startOffset = 0,
  }) {
    if (!audioCtx || !dest) return;
    const now = audioCtx.currentTime + startOffset;
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    if (detune) {
      osc.detune.setValueAtTime(detune, now);
    }

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(Math.max(0.0002, gain), now + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    if (filterFreq) {
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, now);
      filter.Q.setValueAtTime(filterQ, now);
      osc.connect(filter);
      filter.connect(env);
    } else {
      osc.connect(env);
    }

    env.connect(dest);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playNoise({
    duration = 0.12,
    gain = 0.18,
    filterType = 'bandpass',
    filterFreq = 1200,
    endFilterFreq = null,
    filterQ = 1.2,
    attack = 0.004,
    dest = sfxGain,
    startOffset = 0,
  }) {
    if (!audioCtx || !dest || !noiseBuffer) return;
    const now = audioCtx.currentTime + startOffset;
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(40, filterFreq), now);
    if (endFilterFreq !== null) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFilterFreq), now + duration);
    }
    filter.Q.setValueAtTime(filterQ, now);

    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(Math.max(0.0002, gain), now + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(env);
    env.connect(dest);

    src.start(now);
    src.stop(now + duration + 0.02);
  }

  // --- Music Instruments ---

  function playMarimba(midi, velocity = 0.22, duration = 0.28) {
    const f = midiToFreq(midi);
    playTone({ freq: f, type: 'sine', duration, gain: velocity, attack: 0.004, dest: musicGain });
    // Woody 4th harmonic overtone with very short decay
    playTone({
      freq: f * 4,
      type: 'sine',
      duration: duration * 0.22,
      gain: velocity * 0.25,
      attack: 0.002,
      dest: musicGain,
    });
  }

  function playBongo(pitch) {
    const startFreq = pitch === 'high' ? 280 : 175;
    const endFreq = pitch === 'high' ? 195 : 112;
    playTone({
      freq: startFreq,
      endFreq,
      type: 'sine',
      duration: 0.12,
      gain: 0.22,
      attack: 0.003,
      dest: musicGain,
    });
  }

  function playShaker(accent = 0.08) {
    playNoise({
      duration: 0.045,
      gain: accent,
      filterType: 'highpass',
      filterFreq: 5200,
      filterQ: 0.8,
      attack: 0.002,
      dest: musicGain,
    });
  }

  function playRimClick() {
    playTone({
      freq: 920,
      endFreq: 540,
      type: 'triangle',
      duration: 0.038,
      gain: 0.14,
      attack: 0.002,
      dest: musicGain,
    });
    playNoise({
      duration: 0.025,
      gain: 0.07,
      filterType: 'bandpass',
      filterFreq: 2400,
      filterQ: 2.0,
      dest: musicGain,
    });
  }

  function playKick() {
    playTone({
      freq: 140,
      endFreq: 42,
      type: 'sine',
      duration: 0.15,
      gain: 0.34,
      attack: 0.003,
      dest: musicGain,
    });
  }

  function playSnare() {
    playTone({
      freq: 210,
      endFreq: 110,
      type: 'triangle',
      duration: 0.09,
      gain: 0.14,
      attack: 0.002,
      dest: musicGain,
    });
    playNoise({
      duration: 0.11,
      gain: 0.16,
      filterType: 'bandpass',
      filterFreq: 1900,
      filterQ: 0.9,
      dest: musicGain,
    });
  }

  function triggerMusicStep(mode, idx) {
    const pat = PATTERNS[mode];
    if (!pat) return;
    const step = idx % 16;

    if (mode === 'explore') {
      const m = pat.melody[step];
      if (m) playMarimba(m, 0.2, 0.28);
      const b = pat.bass[step];
      if (b) {
        playTone({
          freq: midiToFreq(b),
          type: 'triangle',
          duration: 0.34,
          gain: 0.22,
          attack: 0.01,
          filterFreq: 520,
          dest: musicGain,
        });
      }
      if (pat.bongo[step]) playBongo(pat.bongo[step]);
      if (pat.shaker[step]) playShaker(0.055);
      return;
    }

    if (mode === 'stealth') {
      const b = pat.bass[step];
      if (b) {
        playTone({
          freq: midiToFreq(b),
          type: 'sawtooth',
          duration: 0.24,
          gain: 0.2,
          attack: 0.012,
          filterFreq: 340 + (step % 4) * 55,
          filterQ: 3.2,
          dest: musicGain,
        });
      }
      const m = pat.melody[step];
      if (m) {
        playTone({
          freq: midiToFreq(m),
          type: 'sine',
          duration: 0.32,
          gain: 0.1,
          attack: 0.02,
          dest: musicGain,
        });
      }
      if (pat.rim[step]) playRimClick();
      if (pat.shaker[step]) playShaker(0.04);
      return;
    }

    if (mode === 'boss') {
      const b = pat.bass[step];
      if (b) {
        playTone({
          freq: midiToFreq(b),
          type: 'sawtooth',
          duration: 0.19,
          gain: 0.24,
          attack: 0.005,
          filterFreq: 640,
          filterQ: 2.5,
          dest: musicGain,
        });
      }
      const m = pat.melody[step];
      if (m) {
        playTone({
          freq: midiToFreq(m),
          type: 'square',
          duration: 0.16,
          gain: 0.12,
          attack: 0.005,
          filterFreq: 1900,
          dest: musicGain,
        });
      }
      if (pat.kick[step]) playKick();
      if (pat.snare[step]) playSnare();
      return;
    }

    if (mode === 'victory') {
      const m = pat.melody[step];
      if (m) playMarimba(m, 0.22, 0.3);
      const b = pat.bass[step];
      if (b) {
        playTone({
          freq: midiToFreq(b),
          type: 'triangle',
          duration: 0.3,
          gain: 0.22,
          attack: 0.008,
          dest: musicGain,
        });
      }
      const br = pat.brass[step];
      if (br) {
        // Warm tropical brass triad stab
        const f = midiToFreq(br);
        playTone({ freq: f, type: 'sawtooth', duration: 0.34, gain: 0.11, attack: 0.02, filterFreq: 1650, dest: musicGain });
        playTone({ freq: f * 1.25, type: 'sawtooth', duration: 0.34, gain: 0.09, attack: 0.02, filterFreq: 1650, dest: musicGain });
        playTone({ freq: f * 1.5, type: 'sawtooth', duration: 0.34, gain: 0.09, attack: 0.02, filterFreq: 1650, dest: musicGain });
      }
      if (pat.bongo[step]) playBongo(pat.bongo[step]);
      if (pat.shaker[step]) playShaker(0.065);
    }
  }

  // --- Procedural SFX Library ---

  function playSfx(name) {
    if (!name || !isReady()) return false;
    const key = String(name).toLowerCase();

    switch (key) {
      case 'chop': {
        playTone({ freq: 185, endFreq: 68, type: 'triangle', duration: 0.11, gain: 0.34 });
        playNoise({ duration: 0.08, gain: 0.22, filterType: 'bandpass', filterFreq: 950, filterQ: 1.4 });
        return true;
      }

      case 'mine': {
        playTone({ freq: 1180, endFreq: 980, type: 'triangle', duration: 0.13, gain: 0.22 });
        playTone({ freq: 1840, endFreq: 1520, type: 'sine', duration: 0.11, gain: 0.16 });
        playNoise({ duration: 0.07, gain: 0.18, filterType: 'highpass', filterFreq: 2100 });
        return true;
      }

      case 'chirp': {
        // Cute Tarcy monkey double chirp!
        playTone({ freq: 640, endFreq: 1420, type: 'sine', duration: 0.085, gain: 0.24, attack: 0.005 });
        playTone({ freq: 1360, endFreq: 860, type: 'sine', duration: 0.09, gain: 0.2, startOffset: 0.075 });
        playTone({ freq: 780, endFreq: 1560, type: 'triangle', duration: 0.075, gain: 0.14, startOffset: 0.155 });
        return true;
      }

      case 'radio': {
        // Dos FBI walkie-talkie static squelch + dual beep
        playNoise({ duration: 0.06, gain: 0.14, filterType: 'bandpass', filterFreq: 2600, filterQ: 2.2 });
        playTone({ freq: 1760, type: 'square', duration: 0.055, gain: 0.12, filterFreq: 2400, startOffset: 0.05 });
        playTone({ freq: 1320, type: 'square', duration: 0.075, gain: 0.12, filterFreq: 2400, startOffset: 0.115 });
        playNoise({ duration: 0.05, gain: 0.11, filterType: 'bandpass', filterFreq: 2200, filterQ: 2.0, startOffset: 0.195 });
        return true;
      }

      case 'roar': {
        // Crockstar low crocodile growl/roar
        playTone({ freq: 115, endFreq: 52, type: 'sawtooth', duration: 0.48, gain: 0.3, attack: 0.03, filterFreq: 380, filterQ: 2.6 });
        playTone({ freq: 88, endFreq: 42, type: 'square', duration: 0.44, gain: 0.18, attack: 0.04, filterFreq: 260, startOffset: 0.03 });
        playNoise({ duration: 0.42, gain: 0.24, filterType: 'bandpass', filterFreq: 420, endFilterFreq: 160, filterQ: 1.5, attack: 0.03 });
        return true;
      }

      case 'tranq': {
        // Silenced dart phwt
        playNoise({ duration: 0.09, gain: 0.24, filterType: 'bandpass', filterFreq: 2800, endFilterFreq: 750, filterQ: 1.8 });
        playTone({ freq: 1850, endFreq: 520, type: 'sine', duration: 0.085, gain: 0.14 });
        return true;
      }

      case 'blip': {
        // Soft typewriter dialogue tick with slight organic pitch jitter
        const jitter = 0.94 + Math.random() * 0.12;
        playTone({
          freq: 690 * jitter,
          endFreq: 620 * jitter,
          type: 'triangle',
          duration: 0.038,
          gain: 0.11,
          attack: 0.003,
        });
        return true;
      }

      case 'craft': {
        // Satisfying double wood-tap + bright fifth chime
        playTone({ freq: 240, endFreq: 130, type: 'triangle', duration: 0.07, gain: 0.22 });
        playTone({ freq: 523.25, type: 'sine', duration: 0.14, gain: 0.2, startOffset: 0.07 });
        playTone({ freq: 783.99, type: 'sine', duration: 0.22, gain: 0.22, startOffset: 0.14 });
        return true;
      }

      case 'hit': {
        playTone({ freq: 165, endFreq: 46, type: 'sine', duration: 0.12, gain: 0.36 });
        playNoise({ duration: 0.09, gain: 0.24, filterType: 'lowpass', filterFreq: 1100 });
        return true;
      }

      case 'explosion': {
        // Fiery jammer / EMP boom
        playTone({ freq: 120, endFreq: 24, type: 'sine', duration: 0.52, gain: 0.46, attack: 0.005 });
        playTone({ freq: 95, endFreq: 30, type: 'sawtooth', duration: 0.38, gain: 0.22, filterFreq: 280 });
        playNoise({
          duration: 0.56,
          gain: 0.36,
          filterType: 'lowpass',
          filterFreq: 1800,
          endFilterFreq: 140,
          filterQ: 0.9,
          attack: 0.006,
        });
        return true;
      }

      case 'heal': {
        // Sparkling ascending chime arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((f, idx) => {
          playTone({
            freq: f,
            type: 'sine',
            duration: 0.22,
            gain: 0.18,
            attack: 0.008,
            startOffset: idx * 0.065,
          });
        });
        return true;
      }

      case 'alert': {
        // Sharp stealth "!" sting
        playTone({ freq: 440, type: 'sawtooth', duration: 0.12, gain: 0.22, filterFreq: 2200 });
        playTone({ freq: 622.25, type: 'sawtooth', duration: 0.14, gain: 0.24, filterFreq: 2600, startOffset: 0.08 });
        playTone({ freq: 880, type: 'square', duration: 0.22, gain: 0.18, filterFreq: 2800, startOffset: 0.16 });
        return true;
      }

      case 'death': {
        // Dramatic descending defeat glide
        playTone({ freq: 440, endFreq: 290, type: 'triangle', duration: 0.22, gain: 0.26 });
        playTone({ freq: 290, endFreq: 195, type: 'triangle', duration: 0.24, gain: 0.24, startOffset: 0.18 });
        playTone({ freq: 195, endFreq: 92, type: 'sawtooth', duration: 0.38, gain: 0.2, filterFreq: 480, startOffset: 0.36 });
        return true;
      }

      case 'victory': {
        // Bright 4-note tropical celebration fanfare
        const fanfare = [
          { f: 523.25, t: 0.0, d: 0.16 },
          { f: 659.25, t: 0.12, d: 0.16 },
          { f: 783.99, t: 0.24, d: 0.18 },
          { f: 1046.5, t: 0.38, d: 0.55 },
        ];
        for (const n of fanfare) {
          playTone({ freq: n.f, type: 'triangle', duration: n.d, gain: 0.24, startOffset: n.t });
          playTone({ freq: n.f * 0.5, type: 'sawtooth', duration: n.d, gain: 0.12, filterFreq: 1500, startOffset: n.t });
        }
        return true;
      }

      case 'deflect':
      case 'shield': {
        // Metallic shield deflect ping
        playTone({ freq: 1480, endFreq: 2120, type: 'sine', duration: 0.16, gain: 0.2 });
        playTone({ freq: 920, endFreq: 680, type: 'triangle', duration: 0.14, gain: 0.14 });
        return true;
      }

      default: {
        // Subtle fallback tick for any custom SFX string
        playTone({ freq: 560, endFreq: 480, type: 'triangle', duration: 0.06, gain: 0.12 });
        return true;
      }
    }
  }

  function update(rawDt) {
    const dt = Math.min(Math.max(Number(rawDt) || 0, 0), 0.1);
    if (alertSfxCooldown > 0) {
      alertSfxCooldown = Math.max(0, alertSfxCooldown - dt);
    }

    // Dynamic music switching between explore <-> stealth based on FBI global alert
    const alertLevel = Number(ctx?.fbi?.globalAlert || 0);
    const detected = Boolean(ctx?.fbi?.isPlayerDetected);

    if (detected && !lastDetected && alertSfxCooldown <= 0) {
      alertSfxCooldown = 7.0;
      playSfx('alert');
    }
    lastDetected = detected;

    if (musicMode === 'explore' && alertLevel >= 30) {
      setMusicMode('stealth');
    } else if (musicMode === 'stealth' && alertLevel < 20) {
      setMusicMode('explore');
    }

    if (!isReady()) return;

    const pat = PATTERNS[musicMode] || PATTERNS.explore;
    const stepDuration = 60 / (pat.bpm * pat.stepsPerBeat);
    stepAccum += dt;

    let stepsTriggered = 0;
    while (stepAccum >= stepDuration && stepsTriggered < 2) {
      stepAccum -= stepDuration;
      triggerMusicStep(musicMode, stepIndex);
      stepIndex = (stepIndex + 1) % 16;
      stepsTriggered++;
    }
    if (stepAccum > stepDuration) {
      stepAccum = 0;
    }
  }

  return {
    unlock,
    update,
    playSfx,
    setMusicMode,
    toggleMute,
    isMuted,
    getMusicMode: () => musicMode,
  };
}
