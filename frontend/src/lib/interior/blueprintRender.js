// ============================================================================
// blueprintRender.js — Render estático de alta qualidade da planta interior
// ============================================================================
//
// A planta (rua, chão com materiais por divisão, paredes com relevo, portas
// com batente + arco de abertura, mobiliário com glifos vetoriais detalhados,
// cotas e rosa-dos-ventos) é desenhada UMA única vez num canvas offscreen de
// alta resolução quando a câmara abre. Por frame, o OperationView faz apenas
// um drawImage — todo o detalhe visual custa zero em runtime.
//
// Coordenadas: 1 unidade = 1 célula (ctx.scale(spx, spx) aplicado à entrada).

import { hashStr, mulberry32 } from "../simCore";
import { WALL } from "./buildingGen";

// ---------------------------------------------------------------------------
// Paleta
// ---------------------------------------------------------------------------
const PAL = {
  street: "#07090d",
  asphalt: "#0a0d13",
  sidewalk: "#0d1118",
  curb: "#1d2836",
  lane: "rgba(148,163,184,0.10)",
  floorBase: "#0f151d",
  gridLine: "rgba(148,163,184,0.045)",
  wallShade: "#0a0e14",
  wallLight: "#4e627c",
  wallBase: "#2d3a4b",
  jamb: "#43566f",
  doorLeaf: "rgba(148,163,184,0.85)",
  doorArc: "rgba(125,211,252,0.22)",
  entryMat: "rgba(244,63,94,0.55)",
  dim: "rgba(103,232,249,0.35)",
  dimText: "rgba(103,232,249,0.6)",
};

// Materiais de chão por divisão (fallback: betão)
const MAT_WOOD = new Set(["sala", "quarto", "quarto2", "escritorio", "direcao", "gabinete"]);
const MAT_TILE = new Set(["cozinha", "rececao", "montra", "venda", "caixa", "galeria", "galeria2", "sala_jogo"]);
const MAT_CARPET = new Set(["openspace", "seguranca", "arquivo"]);

// Poças de luz ambiente por divisão
const GLOW_RED = new Set(["cofre", "cofres", "caixa"]);
const GLOW_COOL = new Set(["tecnica", "servidores", "seguranca"]);
const GLOW_WARM = new Set(["sala", "montra", "venda", "sala_jogo", "rececao", "galeria", "galeria2", "cozinha", "quarto", "quarto2", "openspace"]);

const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ---------------------------------------------------------------------------
// Glifos de mobiliário — vetores top-down com sombra própria
// ---------------------------------------------------------------------------
function withShadow(ctx, spx, fn) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = spx * 0.12;
  ctx.shadowOffsetX = spx * 0.045;
  ctx.shadowOffsetY = spx * 0.065;
  fn();
  ctx.restore();
}

function drawFurn(ctx, f, spx, rng) {
  const x = f.x + 0.08, y = f.y + 0.08, w = f.w - 0.16, h = f.h - 0.16;
  const cx = x + w / 2, cy = y + h / 2;
  const horiz = w >= h;
  const lw = (v) => { ctx.lineWidth = v; };

  switch (f.kind) {
    case "counter": {
      withShadow(ctx, spx, () => { ctx.fillStyle = "#1b2634"; rr(ctx, x, y, w, h, 0.07); ctx.fill(); });
      ctx.strokeStyle = "#3d5068"; lw(0.045); rr(ctx, x, y, w, h, 0.07); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.08)"; lw(0.035);
      ctx.beginPath();
      if (horiz) { ctx.moveTo(x + 0.08, y + h * 0.72); ctx.lineTo(x + w - 0.08, y + h * 0.72); }
      else { ctx.moveTo(x + w * 0.72, y + 0.08); ctx.lineTo(x + w * 0.72, y + h - 0.08); }
      ctx.stroke();
      break;
    }
    case "display": {
      withShadow(ctx, spx, () => { ctx.fillStyle = "#10202b"; rr(ctx, x, y, w, h, 0.05); ctx.fill(); });
      ctx.strokeStyle = "rgba(103,232,249,0.85)"; lw(0.05); rr(ctx, x, y, w, h, 0.05); ctx.stroke();
      ctx.fillStyle = "rgba(103,232,249,0.10)";
      rr(ctx, x + 0.14, y + 0.14, w - 0.28, h - 0.28, 0.03); ctx.fill();
      // brilho do vidro
      const gx = x + 0.2 + rng() * Math.max(0.05, w - 0.4), gy = y + 0.2 + rng() * Math.max(0.05, h - 0.4);
      ctx.strokeStyle = "rgba(224,242,254,0.55)"; lw(0.035);
      ctx.beginPath();
      ctx.moveTo(gx - 0.09, gy); ctx.lineTo(gx + 0.09, gy);
      ctx.moveTo(gx, gy - 0.09); ctx.lineTo(gx, gy + 0.09);
      ctx.stroke();
      break;
    }
    case "shelf": {
      withShadow(ctx, spx, () => { ctx.fillStyle = "#182231"; ctx.fillRect(x, y, w, h); });
      ctx.strokeStyle = "#33445d"; lw(0.04); ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = "rgba(148,163,184,0.22)"; lw(0.03);
      ctx.beginPath();
      if (horiz) {
        ctx.moveTo(x + 0.05, cy); ctx.lineTo(x + w - 0.05, cy);
        for (let t = x + 0.45; t < x + w - 0.2; t += 0.5) { ctx.moveTo(t, y + 0.08); ctx.lineTo(t, y + h - 0.08); }
      } else {
        ctx.moveTo(cx, y + 0.05); ctx.lineTo(cx, y + h - 0.05);
        for (let t = y + 0.45; t < y + h - 0.2; t += 0.5) { ctx.moveTo(x + 0.08, t); ctx.lineTo(x + w - 0.08, t); }
      }
      ctx.stroke();
      break;
    }
    case "safe": {
      withShadow(ctx, spx, () => { ctx.fillStyle = "#241318"; rr(ctx, x, y, w, h, 0.09); ctx.fill(); });
      ctx.strokeStyle = "#f43f5e"; lw(0.06); rr(ctx, x, y, w, h, 0.09); ctx.stroke();
      ctx.strokeStyle = "rgba(244,63,94,0.45)"; lw(0.03);
      rr(ctx, x + 0.16, y + 0.16, w - 0.32, h - 0.32, 0.05); ctx.stroke();
      ctx.strokeStyle = "#fda4af"; lw(0.045);
      ctx.beginPath(); ctx.arc(cx, cy, Math.min(0.17, w * 0.2), 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.min(0.17, w * 0.2) * 0.9, cy - 0.05); ctx.stroke();
      break;
    }
    case "safebox": {
      withShadow(ctx, spx, () => { ctx.fillStyle = "#1a1424"; ctx.fillRect(x, y, w, h); });
      ctx.strokeStyle = "#a78bfa"; lw(0.045); ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = "rgba(167,139,250,0.35)"; lw(0.025);
      ctx.beginPath();
      for (let t = 0.42; t < Math.max(w, h) - 0.2; t += 0.42) {
        if (horiz && t < w) { ctx.moveTo(x + t, y + 0.05); ctx.lineTo(x + t, y + h - 0.05); }
        if (!horiz && t < h) { ctx.moveTo(x + 0.05, y + t); ctx.lineTo(x + w - 0.05, y + t); }
      }
      ctx.stroke();
      break;
    }
    case "desk": {
      // cadeira (por baixo da secretária — lado da sala)
      ctx.fillStyle = "#131a26"; ctx.strokeStyle = "#33415a"; lw(0.035);
      ctx.beginPath(); ctx.arc(cx, y + h + 0.26, 0.21, 0, TAU); ctx.fill(); ctx.stroke();
      withShadow(ctx, spx, () => { ctx.fillStyle = "#1c2735"; rr(ctx, x, y, w, h, 0.08); ctx.fill(); });
      ctx.strokeStyle = "#40536f"; lw(0.04); rr(ctx, x, y, w, h, 0.08); ctx.stroke();
      // monitor
      ctx.fillStyle = "rgba(103,232,249,0.4)";
      ctx.fillRect(cx - 0.24, y + 0.1, 0.48, 0.13);
      break;
    }
    case "cabinet": {
      withShadow(ctx, spx, () => { ctx.fillStyle = "#182130"; ctx.fillRect(x, y, w, h); });
      ctx.strokeStyle = "#3a4c66"; lw(0.04); ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = "rgba(148,163,184,0.25)"; lw(0.025);
      ctx.beginPath();
      if (horiz) for (let t = x + 0.55; t < x + w - 0.2; t += 0.55) { ctx.moveTo(t, y + 0.06); ctx.lineTo(t, y + h - 0.06); }
      else for (let t = y + 0.55; t < y + h - 0.2; t += 0.55) { ctx.moveTo(x + 0.06, t); ctx.lineTo(x + w - 0.06, t); }
      ctx.stroke();
      break;
    }
    case "table": {
      const round = Math.abs(w - h) < 0.3;
      // cadeiras à volta
      ctx.fillStyle = "#141b28"; ctx.strokeStyle = "#33415a"; lw(0.03);
      const seats = round
        ? [[cx, y - 0.24], [cx, y + h + 0.24], [x - 0.24, cy], [x + w + 0.24, cy]]
        : [[x + w * 0.28, y - 0.24], [x + w * 0.72, y - 0.24], [x + w * 0.28, y + h + 0.24], [x + w * 0.72, y + h + 0.24]];
      for (const [sx2, sy2] of seats) { ctx.beginPath(); ctx.arc(sx2, sy2, 0.18, 0, TAU); ctx.fill(); ctx.stroke(); }
      withShadow(ctx, spx, () => {
        ctx.fillStyle = "#1d2836";
        if (round) { ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) / 2, 0, TAU); ctx.fill(); }
        else { rr(ctx, x, y, w, h, 0.12); ctx.fill(); }
      });
      ctx.strokeStyle = "#41546e"; lw(0.04);
      if (round) { ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) / 2, 0, TAU); ctx.stroke(); }
      else { rr(ctx, x, y, w, h, 0.12); ctx.stroke(); }
      break;
    }
    case "sofa": {
      withShadow(ctx, spx, () => { ctx.fillStyle = "#232c3c"; rr(ctx, x, y, w, h, 0.22); ctx.fill(); });
      ctx.strokeStyle = "#4a5a74"; lw(0.04); rr(ctx, x, y, w, h, 0.22); ctx.stroke();
      // encosto + costuras dos assentos
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      if (horiz) rr(ctx, x + 0.06, y + 0.06, w - 0.12, h * 0.32, 0.14);
      else rr(ctx, x + 0.06, y + 0.06, w * 0.32, h - 0.12, 0.14);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.10)"; lw(0.03);
      ctx.beginPath();
      const nSeat = Math.max(2, Math.round(horiz ? w : h));
      for (let s = 1; s < nSeat; s++) {
        if (horiz) { const t = x + (w * s) / nSeat; ctx.moveTo(t, y + h * 0.4); ctx.lineTo(t, y + h - 0.08); }
        else { const t = y + (h * s) / nSeat; ctx.moveTo(x + w * 0.4, t); ctx.lineTo(x + w - 0.08, t); }
      }
      ctx.stroke();
      break;
    }
    case "bed": {
      withShadow(ctx, spx, () => { ctx.fillStyle = "#202a3a"; rr(ctx, x, y, w, h, 0.1); ctx.fill(); });
      ctx.strokeStyle = "#43536d"; lw(0.04); rr(ctx, x, y, w, h, 0.1); ctx.stroke();
      // almofada (topo) + linha do lençol
      ctx.fillStyle = "#31405a";
      rr(ctx, x + 0.12, y + 0.12, w - 0.24, Math.min(0.5, h * 0.24), 0.08); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.12)"; lw(0.03);
      ctx.beginPath(); ctx.moveTo(x + 0.06, y + h * 0.42); ctx.lineTo(x + w - 0.06, y + h * 0.42); ctx.stroke();
      break;
    }
    case "kitchen": {
      withShadow(ctx, spx, () => { ctx.fillStyle = "#1b2533"; ctx.fillRect(x, y, w, h); });
      ctx.strokeStyle = "#3c4e69"; lw(0.04); ctx.strokeRect(x, y, w, h);
      const variant = ((f.x + f.y) % 3);
      if (variant === 0) { // lava-loiça
        ctx.strokeStyle = "rgba(125,211,252,0.6)"; lw(0.035);
        ctx.beginPath(); ctx.arc(cx, cy, 0.17, 0, TAU); ctx.stroke();
        ctx.fillStyle = "rgba(125,211,252,0.4)";
        ctx.beginPath(); ctx.arc(cx, cy - 0.24, 0.035, 0, TAU); ctx.fill();
      } else if (variant === 1) { // fogão
        ctx.strokeStyle = "rgba(245,158,11,0.55)"; lw(0.03);
        for (const [ox2, oy2] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) {
          ctx.beginPath(); ctx.arc(cx + ox2, cy + oy2, 0.09, 0, TAU); ctx.stroke();
        }
      } else { // bancada
        ctx.strokeStyle = "rgba(255,255,255,0.08)"; lw(0.03);
        ctx.beginPath(); ctx.moveTo(x + 0.08, cy); ctx.lineTo(x + w - 0.08, cy); ctx.stroke();
      }
      break;
    }
    case "crate": {
      withShadow(ctx, spx, () => { ctx.fillStyle = "#241d12"; ctx.fillRect(x, y, w, h); });
      ctx.strokeStyle = "#8a6d3b"; lw(0.045); ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = "rgba(138,109,59,0.5)"; lw(0.03);
      ctx.beginPath();
      ctx.moveTo(x + 0.06, y + 0.06); ctx.lineTo(x + w - 0.06, y + h - 0.06);
      ctx.moveTo(x + w - 0.06, y + 0.06); ctx.lineTo(x + 0.06, y + h - 0.06);
      ctx.stroke();
      break;
    }
    case "pallet": {
      withShadow(ctx, spx, () => { ctx.fillStyle = "#1f1910"; ctx.fillRect(x, y, w, h); });
      ctx.strokeStyle = "#6b5426"; lw(0.04); ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = "rgba(107,84,38,0.6)"; lw(0.05);
      ctx.beginPath();
      for (let s = 1; s <= 3; s++) {
        if (horiz) { const t = y + (h * s) / 4; ctx.moveTo(x + 0.05, t); ctx.lineTo(x + w - 0.05, t); }
        else { const t = x + (w * s) / 4; ctx.moveTo(t, y + 0.05); ctx.lineTo(t, y + h - 0.05); }
      }
      ctx.stroke();
      break;
    }
    case "server": {
      withShadow(ctx, spx, () => { ctx.fillStyle = "#0d1b24"; ctx.fillRect(x, y, w, h); });
      ctx.strokeStyle = "rgba(34,211,238,0.9)"; lw(0.05); ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = "rgba(34,211,238,0.25)"; lw(0.025);
      ctx.beginPath();
      for (let t = 0.24; t < (horiz ? w : h) - 0.1; t += 0.24) {
        if (horiz) { ctx.moveTo(x + t, y + 0.07); ctx.lineTo(x + t, y + h - 0.07); }
        else { ctx.moveTo(x + 0.07, y + t); ctx.lineTo(x + w - 0.07, y + t); }
      }
      ctx.stroke();
      ctx.fillStyle = rng() < 0.5 ? "#34d399" : "#f43f5e";
      ctx.beginPath(); ctx.arc(x + w - 0.13, y + 0.13, 0.045, 0, TAU); ctx.fill();
      break;
    }
    case "plant": {
      ctx.fillStyle = "#20160d"; ctx.strokeStyle = "#7c5c36"; lw(0.035);
      ctx.beginPath(); ctx.arc(cx, cy, 0.2, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(52,211,153,0.6)"; lw(0.04);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + rng() * 0.4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cx + Math.cos(a) * 0.22, cy + Math.sin(a) * 0.22, cx + Math.cos(a) * 0.34, cy + Math.sin(a) * 0.34);
        ctx.stroke();
      }
      break;
    }
    case "car": {
      withShadow(ctx, spx, () => { ctx.fillStyle = "#1a2432"; rr(ctx, x, y, w, h, 0.28); ctx.fill(); });
      ctx.strokeStyle = "#4b5b73"; lw(0.045); rr(ctx, x, y, w, h, 0.28); ctx.stroke();
      // para-brisas + tejadilho (vertical na garagem)
      ctx.fillStyle = "rgba(125,211,252,0.14)";
      rr(ctx, x + 0.12, y + h * 0.18, w - 0.24, h * 0.16, 0.08); ctx.fill();
      rr(ctx, x + 0.12, y + h * 0.66, w - 0.24, h * 0.14, 0.08); ctx.fill();
      ctx.fillStyle = "rgba(251,191,36,0.5)";
      ctx.beginPath(); ctx.arc(x + 0.16, y + 0.12, 0.05, 0, TAU); ctx.arc(x + w - 0.16, y + 0.12, 0.05, 0, TAU); ctx.fill();
      break;
    }
    case "slot": {
      withShadow(ctx, spx, () => { ctx.fillStyle = "#201430"; ctx.fillRect(x, y, w, h); });
      ctx.strokeStyle = "#c084fc"; lw(0.045); ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "rgba(192,132,252,0.3)";
      ctx.fillRect(x + 0.08, y + 0.08, w - 0.16, Math.min(0.22, h * 0.3));
      ctx.fillStyle = "rgba(232,213,255,0.6)";
      ctx.beginPath(); ctx.arc(cx - 0.1, y + h - 0.16, 0.035, 0, TAU); ctx.arc(cx + 0.1, y + h - 0.16, 0.035, 0, TAU); ctx.fill();
      break;
    }
    case "pedestal": {
      // halo
      const g = ctx.createRadialGradient(cx, cy, 0.05, cx, cy, 0.75);
      g.addColorStop(0, "rgba(251,191,36,0.14)"); g.addColorStop(1, "rgba(251,191,36,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, 0.75, 0, TAU); ctx.fill();
      withShadow(ctx, spx, () => {
        ctx.fillStyle = "#221d10";
        ctx.beginPath(); ctx.arc(cx, cy, 0.3, 0, TAU); ctx.fill();
      });
      ctx.strokeStyle = "#fbbf24"; lw(0.05);
      ctx.beginPath(); ctx.arc(cx, cy, 0.3, 0, TAU); ctx.stroke();
      ctx.fillStyle = "rgba(251,191,36,0.55)";
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-0.09, -0.09, 0.18, 0.18);
      ctx.restore();
      break;
    }
    default: {
      withShadow(ctx, spx, () => { ctx.fillStyle = "#161f2b"; ctx.fillRect(x, y, w, h); });
      ctx.strokeStyle = "#2e3c50"; lw(0.04); ctx.strokeRect(x, y, w, h);
    }
  }
}

// ---------------------------------------------------------------------------
// Materiais de chão
// ---------------------------------------------------------------------------
function paintRoomMaterial(ctx, r) {
  const x = r.x0, y = r.y0, w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (MAT_WOOD.has(r.key)) {
    ctx.fillStyle = "#151019";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(196,154,108,0.06)";
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    for (let t = y + 0.5; t < y + h; t += 0.5) { ctx.moveTo(x, t); ctx.lineTo(x + w, t); }
    // juntas desfasadas
    for (let row = 0; row < h * 2; row++) {
      const ty = y + row * 0.5;
      for (let t = x + ((row % 2) ? 1.1 : 0.4); t < x + w; t += 2.2) {
        ctx.moveTo(t, ty); ctx.lineTo(t, Math.min(ty + 0.5, y + h));
      }
    }
    ctx.stroke();
  } else if (MAT_TILE.has(r.key)) {
    ctx.fillStyle = "#0e141d";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(148,163,184,0.06)";
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    for (let t = x + 1; t < x + w; t += 1) { ctx.moveTo(t, y); ctx.lineTo(t, y + h); }
    for (let t = y + 1; t < y + h; t += 1) { ctx.moveTo(x, t); ctx.lineTo(x + w, t); }
    ctx.stroke();
  } else if (MAT_CARPET.has(r.key)) {
    ctx.fillStyle = "#111624";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(148,163,184,0.035)";
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    for (let t = -h; t < w; t += 0.55) {
      ctx.moveTo(x + t, y); ctx.lineTo(x + t + h, y + h);
    }
    ctx.stroke();
  } else {
    // betão — base + manchas ténues
    ctx.fillStyle = r.key === "corredor" ? "#10161e" : "#11161d";
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

function paintRoomGlow(ctx, r) {
  const cx = r.cx + 0.5, cy = r.cy + 0.5;
  const rad = Math.max(r.x1 - r.x0, r.y1 - r.y0) * 0.75 + 1;
  let col = null;
  if (GLOW_RED.has(r.key)) col = "rgba(244,63,94,0.075)";
  else if (GLOW_COOL.has(r.key)) col = "rgba(34,211,238,0.055)";
  else if (GLOW_WARM.has(r.key)) col = "rgba(245,158,11,0.05)";
  else if (r.key !== "corredor") col = "rgba(226,232,240,0.02)";
  if (!col) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x0, r.y0, r.x1 - r.x0 + 1, r.y1 - r.y0 + 1); ctx.clip();
  const g = ctx.createRadialGradient(cx, cy, 0.3, cx, cy, rad);
  g.addColorStop(0, col);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(r.x0, r.y0, r.x1 - r.x0 + 1, r.y1 - r.y0 + 1);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Paredes — path fundido por sequências horizontais
// ---------------------------------------------------------------------------
function wallPath(b) {
  const { grid, gw, gh } = b;
  const p = new Path2D();
  for (let y = 0; y < gh; y++) {
    let run = -1;
    for (let x = 0; x <= gw; x++) {
      const isW = x < gw && grid[y * gw + x] === WALL;
      if (isW && run < 0) run = x;
      if (!isW && run >= 0) { p.rect(run, y, x - run, 1); run = -1; }
    }
  }
  return p;
}

// ---------------------------------------------------------------------------
// Portas — batentes + folha + arco de abertura
// ---------------------------------------------------------------------------
function drawDoor(ctx, b, d) {
  const { grid, gw } = b;
  const horizWall = grid[d.y * gw + d.x - 1] === WALL || grid[d.y * gw + d.x + 1] === WALL;
  const isEntry = d.roomA === -1 || d.roomB === -1;
  const { x, y } = d;

  // abrir o vão (cobre o bisel das paredes vizinhas)
  ctx.fillStyle = PAL.floorBase;
  if (horizWall) ctx.fillRect(x + 0.02, y - 0.12, 0.96, 1.24);
  else ctx.fillRect(x - 0.12, y + 0.02, 1.24, 0.96);

  // batentes
  ctx.fillStyle = PAL.jamb;
  if (horizWall) {
    ctx.fillRect(x - 0.06, y + 0.3, 0.14, 0.4);
    ctx.fillRect(x + 0.92, y + 0.3, 0.14, 0.4);
  } else {
    ctx.fillRect(x + 0.3, y - 0.06, 0.4, 0.14);
    ctx.fillRect(x + 0.3, y + 0.92, 0.4, 0.14);
  }

  if (isEntry) {
    // tapete de entrada + faixa vermelha (sem folha — entrada dupla)
    ctx.fillStyle = PAL.entryMat;
    if (horizWall) ctx.fillRect(x + 0.1, y + 0.42, 0.8, 0.16);
    else ctx.fillRect(x + 0.42, y + 0.1, 0.16, 0.8);
    return;
  }

  // folha + arco (estilo planta de arquitetura)
  const leafA = -Math.PI / 2 + 0.35; // ângulo da folha entreaberta
  ctx.strokeStyle = PAL.doorArc;
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  if (horizWall) {
    // passagem vertical — dobradiça à esquerda, abre para baixo
    ctx.arc(x + 0.08, y + 0.5, 0.84, 0, Math.PI / 2);
    ctx.stroke();
    ctx.strokeStyle = PAL.doorLeaf;
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.moveTo(x + 0.08, y + 0.5);
    ctx.lineTo(x + 0.08 + Math.cos(-leafA) * 0.84, y + 0.5 + Math.sin(-leafA) * 0.84);
    ctx.stroke();
  } else {
    // passagem horizontal — dobradiça em cima, abre para a direita
    ctx.arc(x + 0.5, y + 0.08, 0.84, 0, Math.PI / 2);
    ctx.stroke();
    ctx.strokeStyle = PAL.doorLeaf;
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, y + 0.08);
    ctx.lineTo(x + 0.5 + Math.cos(Math.PI / 2 - 0.35) * 0.84, y + 0.08 + Math.sin(Math.PI / 2 - 0.35) * 0.84);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Rua + envolvente
// ---------------------------------------------------------------------------
function paintStreet(ctx, b, rng) {
  const { gw, gh, by1 } = b;
  // base (passeios/vielas em redor)
  ctx.fillStyle = PAL.street;
  ctx.fillRect(0, 0, gw, gh);
  // salpicos ténues no pavimento
  ctx.fillStyle = "rgba(148,163,184,0.035)";
  for (let k = 0; k < gw * gh * 0.06; k++) {
    ctx.fillRect(rng() * gw, rng() * gh, 0.06, 0.06);
  }
  // passeio em frente à fachada
  ctx.fillStyle = PAL.sidewalk;
  ctx.fillRect(0, by1 + 1, gw, 1.6);
  ctx.strokeStyle = "rgba(148,163,184,0.07)";
  ctx.lineWidth = 0.03;
  ctx.beginPath();
  for (let t = 0.8; t < gw; t += 2) { ctx.moveTo(t, by1 + 1); ctx.lineTo(t, by1 + 2.6); }
  ctx.stroke();
  // lancil
  ctx.strokeStyle = PAL.curb;
  ctx.lineWidth = 0.09;
  ctx.beginPath(); ctx.moveTo(0, by1 + 2.62); ctx.lineTo(gw, by1 + 2.62); ctx.stroke();
  // asfalto + eixo da via
  ctx.fillStyle = PAL.asphalt;
  ctx.fillRect(0, by1 + 2.66, gw, gh - by1 - 2.66);
  const laneY = by1 + 2.66 + (gh - by1 - 2.66) / 2;
  ctx.strokeStyle = PAL.lane;
  ctx.lineWidth = 0.1;
  ctx.setLineDash([1, 1.2]);
  ctx.beginPath(); ctx.moveTo(0.4, laneY); ctx.lineTo(gw - 0.4, laneY); ctx.stroke();
  ctx.setLineDash([]);
}

// ---------------------------------------------------------------------------
// Cotas + rosa-dos-ventos
// ---------------------------------------------------------------------------
function paintAnnotations(ctx, b, spx) {
  const { bx0, by0, bx1, w, h, gw } = b;
  const fs = 0.44;
  ctx.strokeStyle = PAL.dim;
  ctx.fillStyle = PAL.dimText;
  ctx.lineWidth = 0.03;
  ctx.font = `600 ${fs}px ui-monospace, monospace`;
  ctx.textAlign = "center";
  // cota horizontal (topo)
  const dy = by0 - 0.9;
  ctx.beginPath();
  ctx.moveTo(bx0, dy); ctx.lineTo(bx1 + 1, dy);
  ctx.moveTo(bx0, dy - 0.18); ctx.lineTo(bx0, dy + 0.18);
  ctx.moveTo(bx1 + 1, dy - 0.18); ctx.lineTo(bx1 + 1, dy + 0.18);
  ctx.stroke();
  ctx.fillText(`${(w * 0.55).toFixed(1).replace(".", ",")} m`, bx0 + (w + 1) / 2, dy - 0.25);
  // cota vertical (esquerda)
  const dx = bx0 - 0.9;
  ctx.beginPath();
  ctx.moveTo(dx, by0); ctx.lineTo(dx, b.by1 + 1);
  ctx.moveTo(dx - 0.18, by0); ctx.lineTo(dx + 0.18, by0);
  ctx.moveTo(dx - 0.18, b.by1 + 1); ctx.lineTo(dx + 0.18, b.by1 + 1);
  ctx.stroke();
  ctx.save();
  ctx.translate(dx - 0.25, by0 + (h + 1) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${(h * 0.55).toFixed(1).replace(".", ",")} m`, 0, 0);
  ctx.restore();
  // rosa-dos-ventos (canto superior direito da margem)
  const nx = gw - 1.9, ny = 1.9;
  ctx.strokeStyle = "rgba(103,232,249,0.4)";
  ctx.lineWidth = 0.045;
  ctx.beginPath(); ctx.arc(nx, ny, 0.62, 0, TAU); ctx.stroke();
  ctx.fillStyle = "rgba(244,63,94,0.75)";
  ctx.beginPath();
  ctx.moveTo(nx, ny - 0.5); ctx.lineTo(nx + 0.14, ny + 0.1); ctx.lineTo(nx - 0.14, ny + 0.1);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(226,232,240,0.7)";
  ctx.font = `700 ${0.38}px ui-monospace, monospace`;
  ctx.fillText("N", nx, ny + 0.52);
}

// ---------------------------------------------------------------------------
// Camada estática — canvas offscreen (uma renderização por edifício)
// ---------------------------------------------------------------------------
export function renderStaticLayer(b) {
  const spx = Math.max(28, Math.min(64, Math.floor(3200 / b.gw)));
  const canvas = document.createElement("canvas");
  canvas.width = b.gw * spx;
  canvas.height = b.gh * spx;
  const ctx = canvas.getContext("2d");
  ctx.scale(spx, spx);
  const rng = mulberry32(hashStr(`${b.archKey}:${b.w}x${b.h}`));

  // 1) rua e envolvente
  paintStreet(ctx, b, rng);

  // 2) sombra projetada do edifício
  ctx.save();
  ctx.filter = `blur(${Math.round(spx * 0.3)}px)`;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(b.bx0 + 0.25, b.by0 + 0.4, b.w + 0.15, b.h + 0.15);
  ctx.restore();

  // 3) chão base + materiais por divisão + poças de luz
  ctx.fillStyle = PAL.floorBase;
  ctx.fillRect(b.bx0, b.by0, b.w, b.h);
  for (const r of b.rooms) paintRoomMaterial(ctx, r);
  for (const r of b.rooms) paintRoomGlow(ctx, r);

  // 4) grelha técnica ténue
  ctx.strokeStyle = PAL.gridLine;
  ctx.lineWidth = 0.018;
  ctx.beginPath();
  for (let x = b.bx0; x <= b.bx1 + 1; x++) { ctx.moveTo(x, b.by0); ctx.lineTo(x, b.by1 + 1); }
  for (let y = b.by0; y <= b.by1 + 1; y++) { ctx.moveTo(b.bx0, y); ctx.lineTo(b.bx1 + 1, y); }
  ctx.stroke();

  // 5) mobiliário (com sombras próprias)
  for (const f of b.furniture) drawFurn(ctx, f, 1, rng);

  // 6) paredes com relevo 2.5D (sombra ↘, luz ↖, corpo)
  const wp = wallPath(b);
  ctx.save();
  ctx.translate(0.07, 0.09);
  ctx.fillStyle = PAL.wallShade;
  ctx.fill(wp);
  ctx.restore();
  ctx.save();
  ctx.translate(-0.045, -0.055);
  ctx.fillStyle = PAL.wallLight;
  ctx.fill(wp);
  ctx.restore();
  ctx.fillStyle = PAL.wallBase;
  ctx.fill(wp);

  // 7) portas (vãos, batentes, folhas, arcos)
  for (const d of b.doors) drawDoor(ctx, b, d);

  // 8) cotas + rosa-dos-ventos
  paintAnnotations(ctx, b, spx);

  return { canvas, spx };
}

// ---------------------------------------------------------------------------
// Veículo de fuga estacionado (dinâmico — quatro-piscas e motorista)
// ---------------------------------------------------------------------------
// Desenhado por frame em coordenadas de célula (transform do mundo aplicado
// pelo chamador). Custo ~20 ops de canvas.
export function drawGetawayVehicle(ctx, x, y, tSec, opts = {}) {
  const W = 2.6, H = 1.25;
  const blink = (tSec % 1.1) < 0.55;
  ctx.save();
  ctx.translate(x, y);
  // sombra
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath(); ctx.ellipse(W / 2 + 0.06, H / 2 + 0.1, W * 0.54, H * 0.5, 0, 0, TAU); ctx.fill();
  // carroçaria
  ctx.fillStyle = "#151d29";
  rr(ctx, 0, 0, W, H, 0.32); ctx.fill();
  ctx.strokeStyle = "#54677f";
  ctx.lineWidth = 0.05;
  rr(ctx, 0, 0, W, H, 0.32); ctx.stroke();
  // para-brisas (frente à esquerda) + vidro traseiro
  ctx.fillStyle = "rgba(125,211,252,0.16)";
  rr(ctx, W * 0.16, 0.12, W * 0.14, H - 0.24, 0.07); ctx.fill();
  rr(ctx, W * 0.78, 0.14, W * 0.1, H - 0.28, 0.06); ctx.fill();
  // tejadilho
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 0.035;
  rr(ctx, W * 0.34, 0.1, W * 0.4, H - 0.2, 0.08); ctx.stroke();
  // quatro-piscas
  if (opts.hazard && blink) {
    ctx.fillStyle = "#f59e0b";
    for (const [hx, hy] of [[0.09, 0.09], [0.09, H - 0.09], [W - 0.09, 0.09], [W - 0.09, H - 0.09]]) {
      ctx.beginPath(); ctx.arc(hx, hy, 0.075, 0, TAU); ctx.fill();
    }
  }
  // motorista ao volante
  if (opts.driver) {
    ctx.fillStyle = "#0b0f14";
    ctx.beginPath(); ctx.arc(W * 0.38, H * 0.34, 0.14, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#a1a1aa";
    ctx.lineWidth = 0.04;
    ctx.beginPath(); ctx.arc(W * 0.38, H * 0.34, 0.14, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}
