// ============================================================================
// buildingGen.js — Geração procedural de interiores coerentes por tipo de missão
// ============================================================================
//
// Mesma filosofia do motor exterior (choreo.js): 100% determinístico no
// cliente — a planta é derivada do seed do id da missão, por isso é única por
// missão mas reproduzível após refresh, sem estado adicional no servidor.
//
// Arquétipos: joalharia, banco, armazém, moradia, loja, escritório, casino,
// museu — cada um com bandas (sala frontal → corredor opcional → divisões
// traseiras), mobiliário próprio, obstáculos, entradas e objetivos físicos.
// Adicionar um arquétipo novo = acrescentar uma entrada em ARCHDEFS.
//
// Grelha (célula ≈ 0.55 m):
//   OUT   0 — rua/exterior (não transitável no pathfinding interior)
//   FLOOR 1 — chão transitável
//   WALL  2 — parede (nunca atravessável)
//   DOOR  3 — porta (transitável, canaliza os trajetos)
//   BLOCK 4 — mobiliário/obstáculo (não transitável, contornado por A*)

import { hashStr, mulberry32 } from "../simCore";

export const OUT = 0, FLOOR = 1, WALL = 2, DOOR = 3, BLOCK = 4;
export const MARGIN = 5; // células de rua em redor do edifício (fila de entrada)

// ---------------------------------------------------------------------------
// Tipo de missão → [arquétipo, tipo de objetivo]
// ---------------------------------------------------------------------------
const TYPE_BUILDING = {
  // assalto
  roubo_joalharia: ["joalharia", "safe"], assalto_penhores: ["joalharia", "safe"],
  assalto: ["loja", "safe"], roubo: ["loja", "collect"], assalto_licorista: ["loja", "collect"],
  assalto_armado: ["banco", "safe"], assalto_blindado: ["banco", "safe"],
  assalto_casino: ["casino", "safe"], assalto_museu: ["museu", "collect"],
  guerra_territorio: ["armazem", "destroy"], emboscada_rival: ["armazem", "destroy"],
  ataque_territorio: ["armazem", "destroy"], roubo_carga: ["armazem", "carry"],
  sequestro_relampago: ["moradia", "docs"],
  // logística
  transporte: ["armazem", "carry"], contrabando: ["armazem", "carry"],
  entrega_expressa: ["armazem", "carry"], entrega_local: ["loja", "carry"],
  recolha_mercadoria: ["armazem", "carry"], transporte_armas: ["armazem", "carry"],
  rota_costeira: ["armazem", "carry"], contrabando_tabaco: ["armazem", "carry"],
  frota_fantasma: ["armazem", "carry"], rota_alfandega: ["armazem", "carry"],
  carga_diplomatica: ["armazem", "carry"], rede_distribuicao: ["armazem", "carry"],
  porto_franco: ["armazem", "carry"], rota_internacional: ["armazem", "carry"],
  // técnica
  hack: ["escritorio", "hack"], vigilancia_digital: ["escritorio", "hack"],
  ciberataque_bancario: ["banco", "hack"], phishing_bancario: ["escritorio", "hack"],
  clonagem_cartoes: ["loja", "hack"], hack_semaforos: ["escritorio", "hack"],
  fraude_criptomoedas: ["escritorio", "hack"], invasao_servidor: ["escritorio", "hack"],
  ciberespionagem: ["escritorio", "docs"], ataque_ddos: ["escritorio", "hack"],
  roubo_dados: ["escritorio", "hack"], sabotagem_industrial: ["armazem", "destroy"],
  guerra_cibernetica: ["escritorio", "hack"],
  // influência
  cobranca: ["loja", "negotiate"], lavagem: ["escritorio", "negotiate"],
  suborno_oficial: ["escritorio", "negotiate"], protecao_comercio: ["loja", "negotiate"],
  boato_rua: ["loja", "negotiate"], suborno_funcionario: ["escritorio", "negotiate"],
  chantagem_politico: ["moradia", "docs"], lavagem_casino: ["casino", "negotiate"],
  infiltracao_sindicato: ["escritorio", "docs"], acordo_autarca: ["escritorio", "negotiate"],
  campanha_difamacao: ["escritorio", "docs"], controlo_imprensa: ["escritorio", "hack"],
  golpe_estado_local: ["escritorio", "docs"],
  // especial
  infiltracao: ["moradia", "docs"], operacao_vip: ["moradia", "negotiate"],
  missao_especial: ["moradia", "docs"], roubo_obra_arte: ["museu", "collect"],
  operacao_encoberta: ["escritorio", "docs"], resgate_refem: ["moradia", "docs"],
  leilao_clandestino: ["casino", "negotiate"], venda_armamento: ["armazem", "negotiate"],
  fuga_prisao: ["escritorio", "destroy"], assassinato_contrato: ["moradia", "docs"],
  golpe_banco_central: ["banco", "safe"],
  trafico_influencia_internacional: ["escritorio", "negotiate"], operacao_fantasma: ["moradia", "docs"],
};
const CAT_BUILDING = {
  assalto: ["loja", "safe"], logistica: ["armazem", "carry"], tecnica: ["escritorio", "hack"],
  influencia: ["escritorio", "negotiate"], especial: ["moradia", "docs"],
};

export function buildingPlanFor(typeKey, category) {
  return TYPE_BUILDING[typeKey] || CAT_BUILDING[category] || ["loja", "collect"];
}

// ---------------------------------------------------------------------------
// Objetivos físicos
// ---------------------------------------------------------------------------
export const OBJECTIVES = {
  safe:      { label: "Abrir o cofre",        act: "A arrombar o cofre",      anchors: ["safe"], carry: "money" },
  collect:   { label: "Recolher o saque",     act: "A recolher valores",      anchors: ["display", "pedestal", "counter", "safe"], carry: "money" },
  hack:      { label: "Intrusão no sistema",  act: "A executar a intrusão",   anchors: ["server", "desk"], carry: "doc" },
  docs:      { label: "Encontrar documentos", act: "A vasculhar documentos",  anchors: ["cabinet", "desk", "safe"], carry: "doc" },
  destroy:   { label: "Destruir provas",      act: "A destruir provas",       anchors: ["cabinet", "server", "crate", "desk"], carry: null },
  carry:     { label: "Levar a mercadoria",   act: "A carregar mercadoria",   anchors: ["crate", "pallet", "shelf"], carry: "box" },
  negotiate: { label: "Fechar o acordo",      act: "A negociar",              anchors: ["desk", "counter", "table", "sofa"], carry: "doc" },
};

// Mobiliário que rende pontos de saque secundário
const LOOT_KINDS = new Set(["display", "pedestal", "shelf", "crate", "pallet", "slot", "safebox"]);

// ---------------------------------------------------------------------------
// Arquétipos — bandas + mobiliário por divisão
// ---------------------------------------------------------------------------
// furnish: lista de passos [fn, kind, opts] executados por furnishRoom.
const ARCHDEFS = {
  joalharia: {
    label: "Joalharia", size: [24, 30, 18, 23],
    front: { key: "montra", name: "Exposição", depth: [0.40, 0.50], furnish: [["grid", "display", { sx: 4, sy: 3, w: 2, h: 1 }], ["wall", "counter", { side: "top", frac: 0.6 }]] },
    corridorChance: 0.45,
    back: [
      { key: "cofre", name: "Casa-forte", furnish: [["block", "safe", { w: 2, h: 2 }], ["wall", "safebox", { side: "left", frac: 0.5 }]] },
      { key: "escritorio", name: "Escritório", furnish: [["block", "desk", { w: 2, h: 1 }], ["wall", "cabinet", { side: "right", frac: 0.4 }]] },
      { key: "arrecadacao", name: "Arrecadação", optional: 0.4, furnish: [["wall", "shelf", { side: "top", frac: 0.7 }], ["scatter", "crate", { n: 3 }]] },
    ],
  },
  banco: {
    label: "Banco", size: [30, 38, 22, 28],
    front: { key: "rececao", name: "Receção", depth: [0.36, 0.46], furnish: [["wall", "counter", { side: "top", frac: 0.75 }], ["block", "sofa", { w: 3, h: 1, anchor: "bottom" }], ["scatter", "plant", { n: 2 }]] },
    corridorChance: 0.85,
    back: [
      { key: "cofres", name: "Casa-forte", furnish: [["block", "safe", { w: 2, h: 2 }], ["wall", "safebox", { side: "left", frac: 0.8 }], ["wall", "safebox", { side: "right", frac: 0.8 }]] },
      { key: "gabinete", name: "Gabinetes", furnish: [["block", "desk", { w: 2, h: 1 }], ["wall", "cabinet", { side: "top", frac: 0.4 }]] },
      { key: "tecnica", name: "Sala técnica", furnish: [["rows", "server", { gap: 2, margin: 2 }]] },
      { key: "arquivo", name: "Arquivo", optional: 0.5, furnish: [["wall", "cabinet", { side: "top", frac: 0.8 }], ["wall", "cabinet", { side: "left", frac: 0.6 }]] },
    ],
  },
  armazem: {
    label: "Armazém", size: [34, 44, 24, 32], hall: true,
    hallName: "Nave principal",
    hallFurnish: [["rows", "shelf", { gap: 3, margin: 3 }], ["scatter", "pallet", { n: 4, w: 2, h: 2 }], ["scatter", "crate", { n: 5 }]],
    sideRooms: [
      { key: "escritorio", name: "Escritório", w: [6, 8], h: [5, 7], furnish: [["block", "desk", { w: 2, h: 1 }], ["wall", "cabinet", { side: "top", frac: 0.5 }]] },
      { key: "cais", name: "Cais de carga", w: [7, 9], h: [5, 6], optional: 0.5, furnish: [["scatter", "pallet", { n: 2, w: 2, h: 2 }]] },
    ],
  },
  moradia: {
    label: "Moradia", size: [26, 32, 20, 26],
    front: { key: "sala", name: "Sala", depth: [0.38, 0.48], furnish: [["block", "sofa", { w: 3, h: 1, anchor: "bottom" }], ["block", "table", { w: 2, h: 2, anchor: "center" }], ["scatter", "plant", { n: 1 }]] },
    sideFront: { key: "garagem", name: "Garagem", chance: 0.7, w: [7, 9], furnish: [["block", "car", { w: 3, h: 5, anchor: "center" }], ["scatter", "crate", { n: 2 }]] },
    corridorChance: 0.85,
    back: [
      { key: "cozinha", name: "Cozinha", furnish: [["wall", "kitchen", { side: "top", frac: 0.8 }], ["wall", "kitchen", { side: "left", frac: 0.5 }]] },
      { key: "quarto", name: "Quarto", furnish: [["block", "bed", { w: 2, h: 3 }], ["wall", "cabinet", { side: "right", frac: 0.35 }]] },
      { key: "escritorio", name: "Escritório", furnish: [["block", "desk", { w: 2, h: 1 }], ["block", "safe", { w: 1, h: 1, anchor: "corner" }], ["wall", "cabinet", { side: "left", frac: 0.4 }]] },
      { key: "quarto2", name: "Quarto", optional: 0.5, furnish: [["block", "bed", { w: 2, h: 3 }]] },
      { key: "wc", name: "WC", optional: 0.5, furnish: [["block", "wc", { w: 1, h: 1, anchor: "corner" }], ["wall", "sink", { side: "left", frac: 0.25 }]] },
    ],
  },
  loja: {
    label: "Loja", size: [22, 28, 16, 21],
    front: { key: "venda", name: "Área de venda", depth: [0.45, 0.55], furnish: [["rows", "shelf", { gap: 3, margin: 2 }], ["wall", "counter", { side: "top", frac: 0.5 }]] },
    corridorChance: 0.2,
    back: [
      { key: "armazem", name: "Armazém", furnish: [["wall", "shelf", { side: "top", frac: 0.7 }], ["scatter", "crate", { n: 3 }]] },
      { key: "escritorio", name: "Escritório", optional: 0.55, furnish: [["block", "desk", { w: 2, h: 1 }], ["block", "safe", { w: 1, h: 1, anchor: "corner" }]] },
    ],
  },
  escritorio: {
    label: "Escritórios", size: [28, 36, 21, 27],
    front: { key: "openspace", name: "Open space", depth: [0.40, 0.50], furnish: [["grid", "desk", { sx: 5, sy: 3, w: 2, h: 1 }], ["scatter", "plant", { n: 2 }]] },
    corridorChance: 0.8,
    back: [
      { key: "servidores", name: "Sala de servidores", furnish: [["rows", "server", { gap: 2, margin: 2 }]] },
      { key: "direcao", name: "Direção", furnish: [["block", "desk", { w: 2, h: 1 }], ["block", "safe", { w: 1, h: 1, anchor: "corner" }], ["wall", "cabinet", { side: "left", frac: 0.4 }]] },
      { key: "arquivo", name: "Arquivo", optional: 0.5, furnish: [["wall", "cabinet", { side: "top", frac: 0.8 }], ["wall", "cabinet", { side: "right", frac: 0.6 }]] },
      { key: "copa", name: "Copa", optional: 0.55, furnish: [["wall", "kitchen", { side: "top", frac: 0.5 }], ["block", "table", { w: 2, h: 2, anchor: "center" }]] },
    ],
  },
  casino: {
    label: "Casino", size: [32, 40, 24, 30],
    front: { key: "sala_jogo", name: "Sala de jogo", depth: [0.42, 0.52], furnish: [["rows", "slot", { gap: 3, margin: 3 }], ["grid", "table", { sx: 6, sy: 5, w: 2, h: 2 }]] },
    corridorChance: 0.7,
    back: [
      { key: "caixa", name: "Caixa-forte", furnish: [["block", "safe", { w: 2, h: 2 }], ["wall", "counter", { side: "bottom", frac: 0.5 }]] },
      { key: "seguranca", name: "Segurança", furnish: [["wall", "server", { side: "top", frac: 0.5 }], ["block", "desk", { w: 2, h: 1 }]] },
      { key: "escritorio", name: "Escritório", optional: 0.5, furnish: [["block", "desk", { w: 2, h: 1 }]] },
    ],
  },
  museu: {
    label: "Museu", size: [32, 40, 24, 30],
    front: { key: "galeria", name: "Galeria principal", depth: [0.42, 0.52], furnish: [["grid", "pedestal", { sx: 4, sy: 4, w: 1, h: 1 }], ["block", "sofa", { w: 3, h: 1, anchor: "bottom" }]] },
    corridorChance: 0.6,
    back: [
      { key: "galeria2", name: "Galeria restrita", furnish: [["grid", "pedestal", { sx: 5, sy: 4, w: 1, h: 1 }], ["grid", "display", { sx: 6, sy: 5, w: 2, h: 1 }]] },
      { key: "reservas", name: "Reservas", furnish: [["wall", "shelf", { side: "top", frac: 0.6 }], ["scatter", "crate", { n: 3 }]] },
      { key: "seguranca", name: "Segurança", optional: 0.6, furnish: [["wall", "server", { side: "top", frac: 0.4 }], ["block", "desk", { w: 2, h: 1 }]] },
    ],
  },
};

// Divisão preferida do objetivo por arquétipo+tipo
const OBJ_ROOM = {
  joalharia: { safe: "cofre", collect: "montra", default: "cofre" },
  banco: { safe: "cofres", hack: "tecnica", docs: "gabinete", default: "cofres" },
  armazem: { carry: "__hall__", destroy: "escritorio", negotiate: "escritorio", default: "__hall__" },
  moradia: { docs: "escritorio", safe: "escritorio", negotiate: "sala", default: "escritorio" },
  loja: { safe: "escritorio", collect: "venda", carry: "armazem", hack: "venda", negotiate: "venda", default: "armazem" },
  escritorio: { hack: "servidores", docs: "direcao", destroy: "arquivo", negotiate: "direcao", default: "servidores" },
  casino: { safe: "caixa", negotiate: "escritorio", default: "caixa" },
  museu: { collect: "galeria2", default: "galeria2" },
};

// ---------------------------------------------------------------------------
// Helpers de grelha
// ---------------------------------------------------------------------------
const mkGrid = (gw, gh) => new Uint8Array(gw * gh); // OUT por omissão

function rect(grid, gw, x0, y0, x1, y1, code) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y * gw + x] = code;
}

function canPlace(b, x, y, w, h) {
  const { grid, gw, gh } = b;
  if (x < 1 || y < 1 || x + w > gw - 1 || y + h > gh - 1) return false;
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (grid[yy * gw + xx] !== FLOOR) return false;
      // nunca junto a uma porta (mantém a passagem livre)
      if (grid[(yy - 1) * gw + xx] === DOOR || grid[(yy + 1) * gw + xx] === DOOR ||
          grid[yy * gw + xx - 1] === DOOR || grid[yy * gw + xx + 1] === DOOR) return false;
    }
  }
  return true;
}

function placeFurn(b, kind, x, y, w, h, roomId) {
  if (!canPlace(b, x, y, w, h)) return false;
  rect(b.grid, b.gw, x, y, x + w - 1, y + h - 1, BLOCK);
  b.furniture.push({ kind, x, y, w, h, roomId });
  return true;
}

// ---------------------------------------------------------------------------
// Furnishers
// ---------------------------------------------------------------------------
function furnishStep(b, room, rng, [fn, kind, opts = {}]) {
  const { x0, y0, x1, y1, id } = room;
  const rw = x1 - x0 + 1, rh = y1 - y0 + 1;
  if (fn === "wall") {
    // fila de 1 célula colada a uma parede, cobrindo `frac` do comprimento
    const side = opts.side || "top";
    const horiz = side === "top" || side === "bottom";
    const len = Math.max(2, Math.round((horiz ? rw : rh) * (opts.frac || 0.5)));
    if (horiz) {
      const y = side === "top" ? y0 : y1;
      const sx = x0 + Math.floor(rng() * Math.max(1, rw - len));
      for (let x = sx; x < sx + len && x <= x1; x++) placeFurn(b, kind, x, y, 1, 1, id);
    } else {
      const x = side === "left" ? x0 : x1;
      const sy = y0 + Math.floor(rng() * Math.max(1, rh - len));
      for (let y = sy; y < sy + len && y <= y1; y++) placeFurn(b, kind, x, y, 1, 1, id);
    }
  } else if (fn === "rows") {
    // filas com corredores (prateleiras/servidores/slots) + aberturas
    const gap = opts.gap || 2, margin = opts.margin || 2;
    const horiz = rw >= rh;
    if (horiz) {
      for (let y = y0 + margin; y <= y1 - margin; y += gap + 1) {
        const breakAt = x0 + margin + Math.floor(rng() * Math.max(1, rw - 2 * margin));
        for (let x = x0 + margin; x <= x1 - margin; x++) {
          if (Math.abs(x - breakAt) <= 0) continue; // abertura para atravessar
          placeFurn(b, kind, x, y, 1, 1, id);
        }
      }
    } else {
      for (let x = x0 + margin; x <= x1 - margin; x += gap + 1) {
        const breakAt = y0 + margin + Math.floor(rng() * Math.max(1, rh - 2 * margin));
        for (let y = y0 + margin; y <= y1 - margin; y++) {
          if (Math.abs(y - breakAt) <= 0) continue;
          placeFurn(b, kind, x, y, 1, 1, id);
        }
      }
    }
  } else if (fn === "grid") {
    const sx = opts.sx || 4, sy = opts.sy || 4, w = opts.w || 1, h = opts.h || 1;
    for (let y = y0 + 1; y + h - 1 <= y1 - 1; y += sy) {
      for (let x = x0 + 1; x + w - 1 <= x1 - 1; x += sx) {
        const jx = x + (rng() < 0.3 ? 1 : 0), jy = y + (rng() < 0.3 ? 1 : 0);
        placeFurn(b, kind, jx, jy, w, h, id);
      }
    }
  } else if (fn === "block") {
    const w = opts.w || 2, h = opts.h || 2;
    const anchor = opts.anchor || "back";
    let px, py;
    if (anchor === "center") { px = x0 + ((rw - w) >> 1); py = y0 + ((rh - h) >> 1); }
    else if (anchor === "bottom") { px = x0 + 1 + Math.floor(rng() * Math.max(1, rw - w - 1)); py = y1 - h + 1; }
    else if (anchor === "corner") { px = rng() < 0.5 ? x0 : x1 - w + 1; py = y0; }
    else { px = x0 + 1 + Math.floor(rng() * Math.max(1, rw - w - 1)); py = y0; } // back = parede de cima
    if (!placeFurn(b, kind, px, py, w, h, id)) {
      // fallback: tenta algumas posições aleatórias
      for (let t = 0; t < 8; t++) {
        const rx = x0 + Math.floor(rng() * Math.max(1, rw - w));
        const ry = y0 + Math.floor(rng() * Math.max(1, rh - h));
        if (placeFurn(b, kind, rx, ry, w, h, id)) break;
      }
    }
  } else if (fn === "scatter") {
    const n = opts.n || 2, w = opts.w || 1, h = opts.h || 1;
    for (let k = 0; k < n; k++) {
      for (let t = 0; t < 6; t++) {
        const rx = x0 + Math.floor(rng() * Math.max(1, rw - w));
        const ry = y0 + Math.floor(rng() * Math.max(1, rh - h));
        if (placeFurn(b, opts.kind || kind, rx, ry, w, h, id)) break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Validação de conectividade (flood fill a partir da entrada)
// ---------------------------------------------------------------------------
function floodFrom(b, sx, sy) {
  const { grid, gw, gh } = b;
  const seen = new Uint8Array(gw * gh);
  const stack = [sy * gw + sx];
  seen[sy * gw + sx] = 1;
  while (stack.length) {
    const cur = stack.pop();
    const cx = cur % gw, cy = (cur / gw) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const ni = ny * gw + nx;
      if (seen[ni]) continue;
      const c = grid[ni];
      if (c === FLOOR || c === DOOR) { seen[ni] = 1; stack.push(ni); }
    }
  }
  return seen;
}

function ensureConnectivity(b) {
  const inner = { x: b.entry.x, y: b.entry.y - 1 }; // célula interior junto à entrada
  for (let pass = 0; pass < 6; pass++) {
    const seen = floodFrom(b, inner.x, inner.y);
    const badRooms = new Set();
    for (const d of b.doors) {
      if (!seen[d.y * b.gw + d.x]) { badRooms.add(d.roomA); badRooms.add(d.roomB); }
    }
    if (b.objective && !seen[b.objective.y * b.gw + b.objective.x]) badRooms.add(b.objective.roomId);
    if (!badRooms.size) return;
    // remove mobiliário das divisões problemáticas (raro — margens conservadoras)
    b.furniture = b.furniture.filter((f) => {
      if (!badRooms.has(f.roomId)) return true;
      rect(b.grid, b.gw, f.x, f.y, f.x + f.w - 1, f.y + f.h - 1, FLOOR);
      return false;
    });
  }
}

// ---------------------------------------------------------------------------
// Célula transitável adjacente a um retângulo de mobiliário
// ---------------------------------------------------------------------------
function adjacentWalkable(b, f, rng) {  const opts = [];
  for (let x = f.x; x < f.x + f.w; x++) {
    if (b.grid[(f.y - 1) * b.gw + x] === FLOOR) opts.push({ x, y: f.y - 1, face: Math.PI / 2 });
    if (b.grid[(f.y + f.h) * b.gw + x] === FLOOR) opts.push({ x, y: f.y + f.h, face: -Math.PI / 2 });
  }
  for (let y = f.y; y < f.y + f.h; y++) {
    if (b.grid[y * b.gw + f.x - 1] === FLOOR) opts.push({ x: f.x - 1, y, face: 0 });
    if (b.grid[y * b.gw + f.x + f.w] === FLOOR) opts.push({ x: f.x + f.w, y, face: Math.PI });
  }
  if (!opts.length) return null;
  return opts[Math.floor(rng() * opts.length)];
}

// ---------------------------------------------------------------------------
// Detalhe estrutural — janelas, saída de emergência, portas reforçadas,
// câmaras de vigilância e painel de alarme (metadados; grelha só muda na
// porta de emergência). Chamado depois do objetivo estar definido.
// ---------------------------------------------------------------------------
const HIGH_SEC = new Set(["joalharia", "banco", "casino", "museu"]);
const VAULT_KEYS = new Set(["cofre", "cofres", "caixa"]);

// nearestWalkable local (evita ciclo de imports com pathfind.js)
function walkNear(b, x, y, maxR = 5) {
  x = Math.round(x); y = Math.round(y);
  const ok = (cx, cy) => {
    if (cx < 0 || cy < 0 || cx >= b.gw || cy >= b.gh) return false;
    const c = b.grid[cy * b.gw + cx];
    return c === FLOOR || c === DOOR;
  };
  if (ok(x, y)) return { x, y };
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (ok(x + dx, y + dy)) return { x: x + dx, y: y + dy };
      }
    }
  }
  return null;
}

function addStructuralDetail(b, rng, risk = 3) {
  const { grid, gw } = b;
  b.windows = [];
  b.cameras = [];
  b.alarm = null;
  b.highSec = HIGH_SEC.has(b.archKey) || risk >= 4;

  const doorNear = (x, y, r = 2) => b.doors.some((d) => d.y === y && Math.abs(d.x - x) <= r) ||
    b.doors.some((d) => d.x === x && Math.abs(d.y - y) <= r);

  // janelas na fachada (grupos regulares, longe de portas)
  for (let x = b.bx0 + 2; x <= b.bx1 - 2; x += 3 + Math.floor(rng() * 2)) {
    if (grid[b.by1 * gw + x] !== WALL || doorNear(x, b.by1)) continue;
    b.windows.push({ x, y: b.by1, horiz: true });
  }
  // traseiras (mais raras)
  for (let x = b.bx0 + 2; x <= b.bx1 - 2; x += 5 + Math.floor(rng() * 3)) {
    if (grid[b.by0 * gw + x] !== WALL || doorNear(x, b.by0)) continue;
    b.windows.push({ x, y: b.by0, horiz: true });
  }
  // laterais
  for (let y = b.by0 + 2; y <= b.by1 - 2; y += 4 + Math.floor(rng() * 2)) {
    if (grid[y * gw + b.bx0] === WALL && !doorNear(b.bx0, y)) b.windows.push({ x: b.bx0, y, horiz: false });
    if (grid[y * gw + b.bx1] === WALL && !doorNear(b.bx1, y)) b.windows.push({ x: b.bx1, y, horiz: false });
  }

  // saída de emergência: divisão encostada às traseiras que não seja casa-forte
  const backRooms = b.rooms.filter((r) => r.y0 === b.by0 + 1 && !VAULT_KEYS.has(r.key) && r.x1 - r.x0 >= 3);
  if (backRooms.length) {
    const r = backRooms[Math.floor(rng() * backRooms.length)];
    const ex = Math.round(r.x0 + 1 + rng() * Math.max(1, r.x1 - r.x0 - 2));
    if (grid[b.by0 * gw + ex] === WALL) {
      grid[b.by0 * gw + ex] = DOOR;
      b.doors.push({ x: ex, y: b.by0, roomA: r.id, roomB: -1, emergency: true });
      b.windows = b.windows.filter((wd) => !(wd.y === b.by0 && Math.abs(wd.x - ex) < 2));
    }
  }

  // porta reforçada da casa-forte
  for (const d of b.doors) {
    const ra = d.roomA >= 0 ? b.rooms[d.roomA] : null;
    const rb = d.roomB >= 0 ? b.rooms[d.roomB] : null;
    if ((ra && VAULT_KEYS.has(ra.key)) || (rb && VAULT_KEYS.has(rb.key))) d.reinforced = true;
  }

  // câmaras + painel de alarme (só alvos de alta segurança)
  if (!b.highSec) return;
  const front = b.rooms[b.roomMap[(b.entry.y - 1) * gw + b.entry.x]] || b.rooms[0];
  const objRoom = b.objective ? b.rooms[b.objective.roomId] : null;
  const camRooms = [front];
  if (objRoom && objRoom.id !== front.id) camRooms.push(objRoom);
  for (const r of camRooms) {
    const corners = [
      { x: r.x0 + 0.18, y: r.y0 + 0.18 }, { x: r.x1 + 0.82, y: r.y0 + 0.18 },
      { x: r.x0 + 0.18, y: r.y1 + 0.82 }, { x: r.x1 + 0.82, y: r.y1 + 0.82 },
    ];
    const pick = corners[Math.floor(rng() * corners.length)];
    b.cameras.push({
      x: pick.x, y: pick.y,
      dir: Math.atan2(r.cy + 0.5 - pick.y, r.cx + 0.5 - pick.x),
      roomId: r.id,
    });
  }
  // painel de alarme junto à entrada (na fachada, do lado interior)
  const ax = b.entry.x + 2 <= b.bx1 - 1 ? b.entry.x + 2 : b.entry.x - 2;
  b.alarm = { x: ax + 0.5, y: b.by1 - 0.12 };
}

// ---------------------------------------------------------------------------
// Ocupantes — pontos de spawn de NPCs sobre a grelha final
// ---------------------------------------------------------------------------
const CIV_COUNT = { casino: 2, museu: 2, banco: 2, loja: 1, joalharia: 1, moradia: 1 };

function computeNpcSpawns(b, rng) {
  b.npcSpawns = [];
  const front = b.rooms[b.roomMap[(b.entry.y - 1) * b.gw + b.entry.x]];
  if (!front) return;
  const taken = [];
  const farFromTaken = (c) => taken.every((t) => Math.hypot(t.x - c.x, t.y - c.y) >= 2);
  const push = (kind, c, face, patrol) => {
    if (!c || !farFromTaken(c)) return false;
    taken.push(c);
    b.npcSpawns.push({ kind, x: c.x, y: c.y, face, roomId: front.id, ...(patrol ? { patrol } : {}) });
    return true;
  };

  // funcionários atrás de balcões/secretárias da sala frontal
  const staffAnchors = b.furniture.filter((f) => (f.kind === "counter" || f.kind === "desk") && f.roomId === front.id);
  const nStaff = staffAnchors.length ? (rng() < 0.55 ? 2 : 1) : 1;
  for (let i = 0; i < nStaff; i++) {
    const f = staffAnchors.length ? staffAnchors[Math.floor(rng() * staffAnchors.length)] : null;
    const cell = f ? adjacentWalkable(b, f, rng) : null;
    const c = cell ? { x: cell.x, y: cell.y } : walkNear(b, front.cx + (rng() * 4 - 2), front.cy, 4);
    push("funcionario", c, cell?.face ?? Math.PI / 2);
  }

  // civis espalhados pela sala frontal
  const civN = CIV_COUNT[b.archKey] ?? (rng() < 0.4 ? 1 : 0);
  for (let i = 0; i < civN; i++) {
    for (let t = 0; t < 5; t++) {
      const x = front.x0 + 1 + rng() * Math.max(1, front.x1 - front.x0 - 2);
      const y = front.y0 + 1 + rng() * Math.max(1, front.y1 - front.y0 - 2);
      if (push("civil", walkNear(b, x, y, 3), rng() * Math.PI * 2 - Math.PI)) break;
    }
  }

  // segurança em ronda (alvos de alta segurança)
  if (b.highSec) {
    const corridor = b.rooms.find((r) => r.key === "corredor");
    const objRoom = b.objective ? b.rooms[b.objective.roomId] : null;
    const pA = walkNear(b, front.cx, front.cy, 5);
    const alt = corridor || (objRoom && objRoom.id !== front.id ? objRoom : null);
    const pB = alt ? walkNear(b, alt.cx, alt.cy, 5) : walkNear(b, front.x0 + 2, front.cy, 5);
    if (pA && pB) push("guarda", pA, Math.PI / 2, [pA, pB]);
  }
}

// ---------------------------------------------------------------------------
// Geração principal
// ---------------------------------------------------------------------------
export function generateBuilding(mission) {
  const typeKey = mission.opportunity?.type_key;
  const category = mission.opportunity?.category;
  const [archKey, objKind] = buildingPlanFor(typeKey, category);
  const arch = ARCHDEFS[archKey];
  const rng = mulberry32(hashStr(String(mission.id || "b") + ":interior"));

  // Escala com a duração da missão (janelas longas → alvos maiores)
  const W = (Date.parse(mission.finish_at) - Date.parse(mission.arrive_at)) / 1000 || 90;
  const scale = W < 70 ? 0.85 : W < 160 ? 1 : 1.12;
  const [w0, w1, h0, h1] = arch.size;
  const w = Math.round((w0 + rng() * (w1 - w0)) * scale);
  const h = Math.round((h0 + rng() * (h1 - h0)) * scale);

  const gw = w + MARGIN * 2, gh = h + MARGIN * 2;
  const bx0 = MARGIN, by0 = MARGIN, bx1 = MARGIN + w - 1, by1 = MARGIN + h - 1;

  const b = {
    gw, gh, w, h, bx0, by0, bx1, by1,
    grid: mkGrid(gw, gh),
    rooms: [], doors: [], furniture: [],
    entry: null, entryOut: null, objective: null, lootSpots: [],
    archKey, archLabel: arch.label,
    roomMap: new Int16Array(gw * gh).fill(-1),
  };

  // Casca: perímetro WALL, interior FLOOR
  rect(b.grid, gw, bx0, by0, bx1, by1, WALL);
  rect(b.grid, gw, bx0 + 1, by0 + 1, bx1 - 1, by1 - 1, FLOOR);

  const addRoom = (key, name, x0, y0, x1, y1) => {
    const id = b.rooms.length;
    b.rooms.push({ id, key, name, x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) b.roomMap[y * gw + x] = id;
    return id;
  };
  const addDoor = (x, y, roomA, roomB, wide = false) => {
    b.grid[y * gw + x] = DOOR;
    b.doors.push({ x, y, roomA, roomB });
    if (wide) {
      // segunda célula de porta (entradas duplas)
      const horiz = b.grid[y * gw + x - 1] === WALL || b.grid[y * gw + x + 1] === WALL;
      const x2 = horiz ? x + 1 : x, y2 = horiz ? y : y + 1;
      if (b.grid[y2 * gw + x2] === WALL) { b.grid[y2 * gw + x2] = DOOR; b.doors.push({ x: x2, y: y2, roomA, roomB }); }
    }
  };

  if (arch.hall) {
    // ----- Modo nave (armazém): salão + salas de canto -----
    const hallId = addRoom("__hall__", arch.hallName || "Nave", bx0 + 1, by0 + 1, bx1 - 1, by1 - 1);
    // salas de canto (escritório atrás-esquerda/direita; cais à frente)
    // NOTA: clones locais — nunca mutar os specs partilhados de ARCHDEFS.
    const sideRooms = (arch.sideRooms || []).map((s) => ({ ...s, _roomId: null }));
    let cornerLeft = rng() < 0.5;
    for (const sr of sideRooms) {
      if (sr.optional && rng() < sr.optional) continue;
      const sw = Math.round(sr.w[0] + rng() * (sr.w[1] - sr.w[0]));
      const sh = Math.round(sr.h[0] + rng() * (sr.h[1] - sr.h[0]));
      const atFront = sr.key === "cais";
      const x0r = cornerLeft ? bx0 + 1 : bx1 - sw;
      const y0r = atFront ? by1 - sh : by0 + 1;
      const x1r = x0r + sw - 1, y1r = y0r + sh - 1;
      // paredes internas da sala
      const wx = cornerLeft ? x1r + 1 : x0r - 1;
      rect(b.grid, gw, wx, y0r, wx, atFront ? by1 : y1r + 1, WALL);
      const wy = atFront ? y0r - 1 : y1r + 1;
      rect(b.grid, gw, cornerLeft ? bx0 : x0r - 1, wy, cornerLeft ? x1r + 1 : bx1, wy, WALL);
      const rid = addRoom(sr.key, sr.name, x0r, y0r, x1r, y1r);
      // porta para a nave (na parede vertical interna)
      const dy = y0r + 1 + Math.floor(rng() * Math.max(1, sh - 2));
      addDoor(wx, dy, rid, hallId);
      sr._roomId = rid;
      cornerLeft = !cornerLeft;
    }
    // entrada larga na fachada (evitar salas frontais)
    let ex = bx0 + 3 + Math.floor(rng() * Math.max(1, w - 8));
    const caisRoom = sideRooms.find((s) => s.key === "cais" && s._roomId != null);
    if (caisRoom) {
      const cr = b.rooms[caisRoom._roomId];
      if (ex >= cr.x0 - 2 && ex <= cr.x1 + 2) ex = cr.x0 > gw / 2 ? bx0 + 3 : bx1 - 5;
    }
    addDoor(ex, by1, hallId, -1, true);
    b.entry = { x: ex, y: by1 };
    // mobiliário da nave + salas
    const hall = b.rooms[hallId];
    for (const step of arch.hallFurnish || []) furnishStep(b, hall, rng, step);
    for (const sr of sideRooms) {
      if (sr._roomId == null) continue;
      for (const step of sr.furnish || []) furnishStep(b, b.rooms[sr._roomId], rng, step);
    }
  } else {
    // ----- Modo bandas: sala frontal → corredor opcional → divisões traseiras -----
    const [d0, d1] = arch.front.depth;
    let fd = Math.max(6, Math.round(h * (d0 + rng() * (d1 - d0))));
    const yFrontWall = by1 - 1 - fd; // linha de parede
    rect(b.grid, gw, bx0, yFrontWall, bx1, yFrontWall, WALL);

    // sala lateral frontal (garagem/gabinete)
    let sideId = null, xSideWall = null, sideLeft = false;
    if (arch.sideFront && rng() < arch.sideFront.chance) {
      const sw = Math.round(arch.sideFront.w[0] + rng() * (arch.sideFront.w[1] - arch.sideFront.w[0]));
      sideLeft = rng() < 0.5;
      xSideWall = sideLeft ? bx0 + sw + 1 : bx1 - sw - 1;
      rect(b.grid, gw, xSideWall, yFrontWall, xSideWall, by1, WALL);
      const sx0 = sideLeft ? bx0 + 1 : xSideWall + 1;
      const sx1 = sideLeft ? xSideWall - 1 : bx1 - 1;
      sideId = addRoom(arch.sideFront.key, arch.sideFront.name, sx0, yFrontWall + 1, sx1, by1 - 1);
    }
    const fx0 = sideId != null && sideLeft ? xSideWall + 1 : bx0 + 1;
    const fx1 = sideId != null && !sideLeft ? xSideWall - 1 : bx1 - 1;
    const frontId = addRoom(arch.front.key, arch.front.name, fx0, yFrontWall + 1, fx1, by1 - 1);
    if (sideId != null) {
      // porta sala lateral ↔ sala frontal
      const dy = yFrontWall + 2 + Math.floor(rng() * Math.max(1, fd - 3));
      addDoor(xSideWall, dy, sideId, frontId);
    }

    // corredor
    const backAvail = yFrontWall - by0 - 1;
    const useCorridor = backAvail >= 9 && rng() < (arch.corridorChance ?? 0.5);
    let yBackWall = yFrontWall; // parede que separa divisões traseiras da banda seguinte
    let corridorId = null;
    if (useCorridor) {
      const cw2 = 2 + (rng() < 0.3 ? 1 : 0);
      yBackWall = yFrontWall - cw2 - 1;
      rect(b.grid, gw, bx0, yBackWall, bx1, yBackWall, WALL);
      corridorId = addRoom("corredor", "Corredor", bx0 + 1, yBackWall + 1, bx1 - 1, yFrontWall - 1);
      // porta(s) sala frontal ↔ corredor
      const dx1 = fx0 + 2 + Math.floor(rng() * Math.max(1, fx1 - fx0 - 4));
      addDoor(dx1, yFrontWall, frontId, corridorId);
      if (w > 28 && rng() < 0.6) {
        const dx2 = fx0 + 2 + Math.floor(rng() * Math.max(1, fx1 - fx0 - 4));
        if (Math.abs(dx2 - dx1) > 4) addDoor(dx2, yFrontWall, frontId, corridorId);
      }
    }

    // divisões traseiras (clones locais — nunca mutar ARCHDEFS)
    const rooms = arch.back.filter((r) => !r.optional || rng() >= r.optional).map((r) => ({ ...r, _roomId: null }));
    // baralhar ordem (esquerda→direita)
    for (let i = rooms.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = rooms[i]; rooms[i] = rooms[j]; rooms[j] = t;
    }
    const innerW = w - 2;
    const K = Math.max(1, Math.min(rooms.length, Math.floor(innerW / 6)));
    const kept = rooms.slice(0, K);
    // larguras proporcionais aleatórias (mín. 5)
    const weights = kept.map(() => 0.7 + rng() * 0.6);
    const totalWgt = weights.reduce((a, v) => a + v, 0);
    let widths = weights.map((v) => Math.max(5, Math.floor((v / totalWgt) * innerW)));
    let excess = widths.reduce((a, v) => a + v, 0) - innerW;
    for (let i = 0; excess > 0 && i < widths.length; i++) {
      const take = Math.min(excess, widths[i] - 5);
      widths[i] -= take; excess -= take;
    }
    const backY1 = useCorridor ? yBackWall - 1 : yFrontWall - 1;
    let cx = bx0 + 1;
    kept.forEach((rspec, i) => {
      const rx1 = i === kept.length - 1 ? bx1 - 1 : cx + widths[i] - 1;
      if (i < kept.length - 1) rect(b.grid, gw, rx1 + 1, by0, rx1 + 1, useCorridor ? yBackWall : yFrontWall, WALL);
      const rid = addRoom(rspec.key, rspec.name, cx, by0 + 1, rx1, backY1);
      // porta para o corredor / sala frontal
      const doorWallY = useCorridor ? yBackWall : yFrontWall;
      const dx = cx + 1 + Math.floor(rng() * Math.max(1, rx1 - cx - 1));
      addDoor(dx, doorWallY, rid, useCorridor ? corridorId : frontId);
      rspec._roomId = rid;
      cx = rx1 + 2;
    });

    // entrada na fachada (dentro da sala frontal), dupla em edifícios grandes
    const ex = fx0 + 2 + Math.floor(rng() * Math.max(1, fx1 - fx0 - 3));
    addDoor(ex, by1, frontId, -1, w >= 30);
    b.entry = { x: ex, y: by1 };

    // mobiliário
    for (const step of arch.front.furnish || []) furnishStep(b, b.rooms[frontId], rng, step);
    if (sideId != null) for (const step of arch.sideFront.furnish || []) furnishStep(b, b.rooms[sideId], rng, step);
    kept.forEach((rspec) => {
      if (rspec._roomId == null) return;
      for (const step of rspec.furnish || []) furnishStep(b, b.rooms[rspec._roomId], rng, step);
    });
  }

  b.entryOut = { x: b.entry.x, y: b.entry.y + 1 };

  // ----- Objetivo físico -----
  const objDef = OBJECTIVES[objKind] || OBJECTIVES.collect;
  const roomKeyPref = (OBJ_ROOM[archKey] || {})[objKind] || (OBJ_ROOM[archKey] || {}).default;
  let objRoom = b.rooms.find((r) => r.key === roomKeyPref) ||
    b.rooms.filter((r) => r.key !== "corredor" && r.id !== 0).slice(-1)[0] || b.rooms[0];
  // âncora: mobiliário preferido na divisão; senão qualquer mobiliário lá; senão centro
  let anchor = null;
  for (const kind of objDef.anchors) {
    const cands = b.furniture.filter((f) => f.roomId === objRoom.id && f.kind === kind);
    if (cands.length) { anchor = cands[Math.floor(rng() * cands.length)]; break; }
  }
  if (!anchor) {
    const cands = b.furniture.filter((f) => f.roomId === objRoom.id);
    if (cands.length) anchor = cands[Math.floor(rng() * cands.length)];
  }
  let objCell = anchor ? adjacentWalkable(b, anchor, rng) : null;
  if (!objCell) objCell = { x: Math.round(objRoom.cx), y: Math.round(objRoom.cy), face: 0 };
  b.objective = {
    kind: objKind, label: objDef.label, act: objDef.act, carry: objDef.carry,
    x: objCell.x, y: objCell.y, face: objCell.face ?? 0,
    anchor: anchor ? { x: anchor.x + anchor.w / 2, y: anchor.y + anchor.h / 2, kind: anchor.kind } : { x: objRoom.cx, y: objRoom.cy, kind: null },
    roomId: objRoom.id, roomName: objRoom.name,
  };

  // ----- Pontos de saque secundário -----
  const lootFurn = b.furniture.filter((f) => LOOT_KINDS.has(f.kind));
  for (let i = lootFurn.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = lootFurn[i]; lootFurn[i] = lootFurn[j]; lootFurn[j] = t;
  }
  for (const f of lootFurn) {
    if (b.lootSpots.length >= 6) break;
    const cell = adjacentWalkable(b, f, rng);
    if (!cell) continue;
    // espaçados entre si
    if (b.lootSpots.some((s) => Math.hypot(s.x - cell.x, s.y - cell.y) < 4)) continue;
    b.lootSpots.push({ x: cell.x, y: cell.y, face: cell.face, kind: f.kind, roomId: f.roomId });
  }

  addStructuralDetail(b, rng, mission.opportunity?.risk ?? 3);
  ensureConnectivity(b);
  computeNpcSpawns(b, rng);
  return b;
}
