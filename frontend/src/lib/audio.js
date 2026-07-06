// Motor de áudio do Lusorae — tudo sintetizado com Web Audio API, sem
// ficheiros externos. Estética noir: pads menores, sub-baixo, sinos esparsos,
// sirenes de duas notas e "ka-ching" metálico para dinheiro.
//
// Arquitetura: AudioContext preguiçoso (os browsers exigem um gesto do
// utilizador antes de tocar som — desbloqueado no primeiro clique/tecla),
// com um grafo master → { música, efeitos } para volumes independentes.

let ctx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let unlocked = false;

const prefs = {
  enabled: true,
  music: true,
  sfx: true,
  musicVolume: 0.25,
  sfxVolume: 0.5,
};

function getCtx() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.connect(masterGain);
    sfxGain = ctx.createGain();
    sfxGain.connect(masterGain);
    applyVolumes();
  }
  return ctx;
}

function applyVolumes() {
  if (!ctx) return;
  masterGain.gain.value = prefs.enabled ? 1 : 0;
  musicGain.gain.value = prefs.music ? prefs.musicVolume : 0;
  sfxGain.gain.value = prefs.sfx ? prefs.sfxVolume : 0;
}

// ---------------- Primitivas de síntese ----------------

// Uma nota simples: oscilador → (filtro opcional) → envelope → destino.
function tone({ freq, type = "sine", dur = 0.15, gain = 0.2, when = 0, attack = 0.005, release = 0.08, slideTo = null, filterFreq = null, dest = null }) {
  const c = getCtx();
  if (!c || !unlocked) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  const env = c.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + attack);
  env.gain.setValueAtTime(gain, t0 + Math.max(attack, dur - release));
  env.gain.linearRampToValueAtTime(0, t0 + dur);
  let node = osc;
  if (filterFreq) {
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterFreq;
    osc.connect(f);
    node = f;
  }
  node.connect(env);
  env.connect(dest || sfxGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// Rajada de ruído filtrado — para "whooshes", estalos e texturas.
function noiseBurst({ dur = 0.2, gain = 0.15, when = 0, filterType = "bandpass", filterFreq = 1200, q = 1, slideTo = null, dest = null }) {
  const c = getCtx();
  if (!c || !unlocked) return;
  const t0 = c.currentTime + when;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = filterType;
  f.frequency.setValueAtTime(filterFreq, t0);
  if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  f.Q.value = q;
  const env = c.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f);
  f.connect(env);
  env.connect(dest || sfxGain);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

// ---------------- Efeitos sonoros ----------------

const sfx = {
  // Toque suave de interface — quase impercetível, só textura tátil.
  click() {
    tone({ freq: 1800, type: "sine", dur: 0.04, gain: 0.05, attack: 0.001, release: 0.03 });
  },

  // Equipa destacada: motivo ascendente com "whoosh" de partida.
  dispatch() {
    tone({ freq: 220, type: "sawtooth", dur: 0.16, gain: 0.10, filterFreq: 1200, slideTo: 330 });
    tone({ freq: 330, type: "sawtooth", dur: 0.18, gain: 0.10, when: 0.12, filterFreq: 1400, slideTo: 440 });
    noiseBurst({ dur: 0.35, gain: 0.06, filterFreq: 900, slideTo: 2400, q: 0.7 });
  },

  // Equipa chamada de volta: o inverso — motivo descendente.
  recall() {
    tone({ freq: 440, type: "sawtooth", dur: 0.16, gain: 0.09, filterFreq: 1400, slideTo: 330 });
    tone({ freq: 330, type: "sawtooth", dur: 0.2, gain: 0.09, when: 0.12, filterFreq: 1000, slideTo: 220 });
  },

  // Sucesso: resolução de duas notas (Lá → Mi) com brilho.
  success() {
    tone({ freq: 440, type: "triangle", dur: 0.14, gain: 0.14 });
    tone({ freq: 659.25, type: "triangle", dur: 0.30, gain: 0.14, when: 0.12 });
    tone({ freq: 1318.5, type: "sine", dur: 0.35, gain: 0.05, when: 0.16, release: 0.25 });
  },

  // Dinheiro entregue: "ka-ching" metálico.
  cash() {
    noiseBurst({ dur: 0.06, gain: 0.10, filterFreq: 5000, q: 2 });
    tone({ freq: 1567.98, type: "triangle", dur: 0.10, gain: 0.12, when: 0.05 });
    tone({ freq: 2093.0, type: "triangle", dur: 0.28, gain: 0.12, when: 0.13, release: 0.2 });
  },

  // Falha: segunda menor dissonante, seca.
  failure() {
    tone({ freq: 220, type: "sawtooth", dur: 0.3, gain: 0.10, filterFreq: 700 });
    tone({ freq: 233.08, type: "sawtooth", dur: 0.3, gain: 0.10, filterFreq: 700 });
  },

  // Polícia: dois toques rápidos de sirene (interceção, prisão).
  police() {
    for (let i = 0; i < 2; i++) {
      tone({ freq: 660, type: "square", dur: 0.14, gain: 0.06, when: i * 0.3, filterFreq: 2000 });
      tone({ freq: 880, type: "square", dur: 0.14, gain: 0.06, when: i * 0.3 + 0.15, filterFreq: 2000 });
    }
  },

  // Notificação neutra: ping suave com harmónico.
  notify() {
    tone({ freq: 880, type: "sine", dur: 0.18, gain: 0.10, release: 0.12 });
    tone({ freq: 1760, type: "sine", dur: 0.22, gain: 0.04, when: 0.02, release: 0.16 });
  },

  // Aviso: dois pings graves — algo precisa de atenção.
  warning() {
    tone({ freq: 392, type: "sine", dur: 0.15, gain: 0.11 });
    tone({ freq: 392, type: "sine", dur: 0.2, gain: 0.11, when: 0.22 });
  },

  // Erro de ação: zumbido curto e seco.
  error() {
    tone({ freq: 130.81, type: "square", dur: 0.18, gain: 0.08, filterFreq: 600 });
  },

  // Subida de nível: arpejo ascendente em Lá menor — momento de glória.
  levelup() {
    const notes = [220, 261.63, 329.63, 440, 523.25];
    notes.forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.22, gain: 0.12, when: i * 0.09, release: 0.15 }));
    tone({ freq: 880, type: "sine", dur: 0.6, gain: 0.05, when: 0.45, release: 0.5 });
  },

  // Contratação: rabisco de papel + toque de acordo fechado.
  hire() {
    noiseBurst({ dur: 0.15, gain: 0.06, filterFreq: 3500, q: 0.8 });
    tone({ freq: 523.25, type: "triangle", dur: 0.16, gain: 0.10, when: 0.12 });
  },

  // Reparação: clanque metálico de oficina.
  repair() {
    noiseBurst({ dur: 0.08, gain: 0.10, filterFreq: 2400, q: 4 });
    tone({ freq: 293.66, type: "triangle", dur: 0.2, gain: 0.10, when: 0.05, filterFreq: 900 });
  },

  // Abastecimento: "glug" líquido descendente.
  refuel() {
    tone({ freq: 500, type: "sine", dur: 0.1, gain: 0.08, slideTo: 300 });
    tone({ freq: 420, type: "sine", dur: 0.12, gain: 0.08, when: 0.11, slideTo: 240 });
  },
};

// ---------------- Sirene de perseguição (contínua) ----------------

let sirenHandle = null;

function sirenStart() {
  const c = getCtx();
  if (!c || !unlocked || sirenHandle) return;
  // Sirene europeia clássica: frequência alterna 660/880 via LFO quadrado.
  const osc = c.createOscillator();
  osc.type = "square";
  osc.frequency.value = 770;
  const lfo = c.createOscillator();
  lfo.type = "square";
  lfo.frequency.value = 1.4;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 110;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1800;
  const env = c.createGain();
  env.gain.setValueAtTime(0, c.currentTime);
  env.gain.linearRampToValueAtTime(0.045, c.currentTime + 0.6);
  osc.connect(filter);
  filter.connect(env);
  env.connect(sfxGain);
  osc.start();
  lfo.start();
  sirenHandle = { osc, lfo, env };
}

function sirenStop() {
  const c = ctx;
  if (!c || !sirenHandle) return;
  const { osc, lfo, env } = sirenHandle;
  sirenHandle = null;
  env.gain.cancelScheduledValues(c.currentTime);
  env.gain.setValueAtTime(env.gain.value, c.currentTime);
  env.gain.linearRampToValueAtTime(0, c.currentTime + 0.8);
  setTimeout(() => {
    try { osc.stop(); lfo.stop(); } catch { /* já parados */ }
  }, 900);
}

// ---------------- Música ambiente (loop noir) ----------------
//
// Progressão em Lá menor (i–VI–iv–V): Am → F → Dm → E. Cada acorde dura 8s
// com pads de serra filtrados, sub-baixo a pulsar e, ocasionalmente, um sino
// esparso — tensão baixa e constante, sem cansar.

const CHORDS = [
  { root: 110.0, third: 130.81, fifth: 164.81 },   // Am (A2 C3 E3)
  { root: 87.31, third: 110.0, fifth: 130.81 },    // F  (F2 A2 C3)
  { root: 73.42, third: 87.31, fifth: 110.0 },     // Dm (D2 F2 A2)
  { root: 82.41, third: 103.83, fifth: 123.47 },   // E  (E2 G#2 B2)
];
const CHORD_DUR_S = 8;
// Notas de sino (pentatónica de Lá menor, uma oitava acima dos pads).
const BELL_NOTES = [440, 523.25, 659.25, 783.99, 880];

let musicTimer = null;
let musicPlaying = false;
let chordIdx = 0;

function playChord(chord) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const dur = CHORD_DUR_S + 2; // sobreposição de 2s entre acordes (crossfade)
  [chord.root, chord.third, chord.fifth, chord.root * 2].forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = i === 3 ? "sine" : "sawtooth";
    osc.frequency.value = freq;
    osc.detune.value = (i - 1.5) * 4; // leve desafinação entre vozes
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(350, t0);
    f.frequency.linearRampToValueAtTime(550, t0 + dur / 2);
    f.frequency.linearRampToValueAtTime(350, t0 + dur);
    const env = c.createGain();
    const vGain = i === 3 ? 0.05 : 0.09;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(vGain, t0 + 2.5);
    env.gain.setValueAtTime(vGain, t0 + dur - 3);
    env.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.connect(f);
    f.connect(env);
    env.connect(musicGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.1);
  });
  // Sub-baixo: uma oitava abaixo da raiz, com pulsação lenta.
  const sub = c.createOscillator();
  sub.type = "sine";
  sub.frequency.value = chord.root / 2;
  const subEnv = c.createGain();
  subEnv.gain.setValueAtTime(0, t0);
  subEnv.gain.linearRampToValueAtTime(0.10, t0 + 1.5);
  subEnv.gain.setValueAtTime(0.10, t0 + dur - 2);
  subEnv.gain.linearRampToValueAtTime(0, t0 + dur);
  const pulse = c.createOscillator();
  pulse.type = "sine";
  pulse.frequency.value = 0.45;
  const pulseGain = c.createGain();
  pulseGain.gain.value = 0.04;
  pulse.connect(pulseGain);
  pulseGain.connect(subEnv.gain);
  sub.connect(subEnv);
  subEnv.connect(musicGain);
  sub.start(t0);
  sub.stop(t0 + dur + 0.1);
  pulse.start(t0);
  pulse.stop(t0 + dur + 0.1);
  // Sino noir esparso — nem sempre, para respirar.
  if (Math.random() < 0.4) {
    const note = BELL_NOTES[Math.floor(Math.random() * BELL_NOTES.length)];
    const when = 1.5 + Math.random() * 4;
    tone({ freq: note, type: "sine", dur: 2.2, gain: 0.035, when, attack: 0.01, release: 2.0, dest: musicGain });
    tone({ freq: note * 2, type: "sine", dur: 1.6, gain: 0.012, when: when + 0.02, release: 1.4, dest: musicGain });
  }
}

function musicTick() {
  if (!musicPlaying) return;
  playChord(CHORDS[chordIdx % CHORDS.length]);
  chordIdx += 1;
  musicTimer = setTimeout(musicTick, CHORD_DUR_S * 1000);
}

function startMusic() {
  if (musicPlaying || !prefs.enabled || !prefs.music) return;
  const c = getCtx();
  if (!c || !unlocked) return;
  musicPlaying = true;
  musicTick();
}

function stopMusic() {
  musicPlaying = false;
  if (musicTimer) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
}

// ---------------- Desbloqueio, cliques de interface e visibilidade ----------------

let listenersAttached = false;

function unlock() {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume();
  if (!unlocked) {
    unlocked = true;
    // Se a música está ativa nas preferências, arranca no primeiro gesto —
    // os browsers não deixam tocar nada antes disso.
    if (prefs.enabled && prefs.music) startMusic();
  }
}

function onDocClick(ev) {
  // Toque subtil apenas em elementos interativos reais — nunca no mapa.
  if (ev.target && ev.target.closest && ev.target.closest("button, [role='button'], a, [role='tab']")) {
    sfx.click();
  }
}

function onVisibility() {
  // Pausar a música quando o separador fica em segundo plano poupa bateria
  // e evita bandas sonoras fantasma; os efeitos pontuais não precisam disto.
  if (document.hidden) {
    stopMusic();
  } else if (prefs.enabled && prefs.music && unlocked) {
    startMusic();
  }
}

function attachListeners() {
  if (listenersAttached || typeof document === "undefined") return;
  listenersAttached = true;
  document.addEventListener("pointerdown", unlock, { capture: true });
  document.addEventListener("keydown", unlock, { capture: true });
  document.addEventListener("click", onDocClick);
  document.addEventListener("visibilitychange", onVisibility);
}

// ---------------- API pública ----------------

export const audio = {
  sfx: Object.fromEntries(
    Object.entries(sfx).map(([name, fn]) => [
      name,
      () => {
        if (prefs.enabled && prefs.sfx) fn();
      },
    ])
  ),
  sirenStart() {
    if (prefs.enabled && prefs.sfx) sirenStart();
  },
  sirenStop,
  configure(partial) {
    Object.assign(prefs, partial);
    applyVolumes();
    if (!prefs.enabled || !prefs.music) stopMusic();
    else if (unlocked && !document.hidden) startMusic();
    if (!prefs.enabled || !prefs.sfx) sirenStop();
  },
  init() {
    attachListeners();
  },
  shutdown() {
    stopMusic();
    sirenStop();
  },
};
