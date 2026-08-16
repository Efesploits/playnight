/* PLAY NIGHT — WebAudio ile sentezlenen ses efektleri (dosya yok, tamamen kod) */
(function (w) {
  'use strict';

  let ctx = null;
  let master = null;
  let musicGain = null;
  let musicNodes = [];
  const cfg = { sound: true, music: true, volume: 0.6 };

  function ensure() {
    if (ctx) return ctx;
    try {
      ctx = new (w.AudioContext || w.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = cfg.volume;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0;
      musicGain.connect(master);
    } catch { ctx = null; }
    return ctx;
  }

  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  /* --- temel ses üreteci --- */
  function tone(opts) {
    if (!cfg.sound || !ensure()) return;
    resume();
    const {
      freq = 440, to = null, type = 'sine', dur = 0.16,
      vol = 0.2, delay = 0, attack = 0.006, curve = 'exp', pan = 0,
    } = opts;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) {
      if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
      else osc.frequency.linearRampToValueAtTime(to, t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g);
    if (p) { p.pan.value = pan; g.connect(p); p.connect(master); } else g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }

  /* --- gürültü tabanlı (taş sesi) --- */
  function noise(opts) {
    if (!cfg.sound || !ensure()) return;
    resume();
    const { dur = 0.09, vol = 0.16, delay = 0, lp = 2600, hp = 320 } = opts || {};
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f1 = ctx.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.value = lp;
    const f2 = ctx.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = hp;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f2); f2.connect(f1); f1.connect(g); g.connect(master);
    src.start(t0);
  }

  /* ------------------------------------------------------------- SFX --- */
  const SFX = {
    hover:  () => tone({ freq: 880, to: 1180, type: 'sine', dur: 0.05, vol: 0.035 }),
    click:  () => { tone({ freq: 520, to: 780, type: 'triangle', dur: 0.07, vol: 0.11 }); noise({ dur: 0.04, vol: 0.05 }); },
    back:   () => tone({ freq: 520, to: 300, type: 'triangle', dur: 0.1, vol: 0.1 }),
    tile:   () => { noise({ dur: 0.07, vol: 0.2, lp: 3600, hp: 500 }); tone({ freq: 300 + Math.random() * 90, to: 170, type: 'square', dur: 0.05, vol: 0.05 }); },
    pick:   () => { noise({ dur: 0.05, vol: 0.13, lp: 4200, hp: 900 }); tone({ freq: 700, to: 980, type: 'sine', dur: 0.06, vol: 0.07 }); },
    draw:   () => { noise({ dur: 0.1, vol: 0.16, lp: 2200 }); tone({ freq: 380, to: 620, type: 'sine', dur: 0.13, vol: 0.09 }); },
    deal:   (i) => { noise({ dur: 0.055, vol: 0.11, lp: 3800, hp: 600, delay: (i || 0) * 0.035 }); },
    meld:   () => { [0, 0.07, 0.14].forEach((d, i) => tone({ freq: [523, 659, 784][i], type: 'triangle', dur: 0.2, vol: 0.13, delay: d })); noise({ dur: 0.1, vol: 0.12 }); },
    open:   () => { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.34, vol: 0.15, delay: i * 0.085 })); },
    turn:   () => { tone({ freq: 660, to: 990, type: 'sine', dur: 0.2, vol: 0.13 }); tone({ freq: 990, type: 'sine', dur: 0.3, vol: 0.06, delay: 0.09 }); },
    warn:   () => { tone({ freq: 300, to: 220, type: 'sawtooth', dur: 0.2, vol: 0.11 }); },
    err:    () => { tone({ freq: 220, to: 130, type: 'square', dur: 0.22, vol: 0.11 }); },
    ok:     () => { tone({ freq: 740, to: 1180, type: 'sine', dur: 0.15, vol: 0.12 }); },
    win:    () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.5, vol: 0.16, delay: i * 0.1 })); },
    lose:   () => { [440, 392, 330, 262].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.42, vol: 0.12, delay: i * 0.13 })); },
    invite: () => { [784, 1047, 784, 1319].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.24, vol: 0.14, delay: i * 0.12 })); },
    join:   () => { tone({ freq: 440, to: 880, type: 'sine', dur: 0.22, vol: 0.12 }); },
    leave:  () => { tone({ freq: 660, to: 330, type: 'sine', dur: 0.24, vol: 0.1 }); },
    chat:   () => tone({ freq: 1100, to: 1400, type: 'sine', dur: 0.07, vol: 0.07 }),
    intro:  () => {
      if (!cfg.sound || !ensure()) return;
      resume();
      /* derin bir "whoosh" + akor */
      noise({ dur: 1.5, vol: 0.13, lp: 900, hp: 60 });
      [65.4, 98, 130.8, 196].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 2.6, vol: 0.1, delay: i * 0.05 }));
      [523.25, 659.25, 783.99].forEach((f, i) => tone({ freq: f * 0.5, to: f, type: 'triangle', dur: 1.6, vol: 0.07, delay: 0.7 + i * 0.09 }));
    },
    introHit: () => { noise({ dur: 0.3, vol: 0.16, lp: 1400 }); tone({ freq: 120, to: 55, type: 'sine', dur: 0.6, vol: 0.2 }); },
  };

  function play(name, arg) {
    const fn = SFX[name];
    if (fn) { try { fn(arg); } catch { /* sessizce geç */ } }
  }

  /* --------------------------------------------------- arkaplan müziği -- */
  /* Yavaş, atmosferik pad — döngü yok, sürekli evrilen akorlar */
  const CHORDS = [
    [146.83, 220.00, 293.66, 369.99],  // Dm9 benzeri
    [130.81, 196.00, 261.63, 329.63],  // Cadd9
    [110.00, 164.81, 220.00, 277.18],  // Am
    [123.47, 185.00, 246.94, 311.13],  // Bdim / renk
  ];
  let chordIdx = 0;
  let musicTimer = null;

  function playChord() {
    if (!ctx || !cfg.music) return;
    const now = ctx.currentTime;
    const chord = CHORDS[chordIdx % CHORDS.length];
    chordIdx++;
    chord.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(500, now);
      flt.frequency.linearRampToValueAtTime(1400, now + 4);
      flt.frequency.linearRampToValueAtTime(500, now + 9);
      osc.type = i % 2 ? 'sine' : 'triangle';
      osc.frequency.value = f * (i === 3 ? 2 : 1);
      osc.detune.value = (Math.random() - 0.5) * 12;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.055 / (i + 1), now + 3);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 9);
      osc.connect(flt); flt.connect(g); g.connect(musicGain);
      osc.start(now); osc.stop(now + 9.4);
      musicNodes.push(osc);
    });
    musicNodes = musicNodes.slice(-40);
  }

  function startMusic() {
    if (!cfg.music || !ensure()) return;
    resume();
    if (musicTimer) return;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 3);
    playChord();
    musicTimer = setInterval(playChord, 8000);
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (ctx && musicGain) {
      musicGain.gain.cancelScheduledValues(ctx.currentTime);
      musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
      musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
    }
  }

  function configure(s) {
    if (!s) return;
    if ('sound' in s) cfg.sound = !!s.sound;
    if ('volume' in s) { cfg.volume = Math.max(0, Math.min(1, s.volume)); if (master) master.gain.value = cfg.volume; }
    if ('music' in s) {
      cfg.music = !!s.music;
      if (cfg.music) startMusic(); else stopMusic();
    }
  }

  w.SFX = { play, configure, startMusic, stopMusic, resume, get ctx() { return ctx; } };
})(window);
