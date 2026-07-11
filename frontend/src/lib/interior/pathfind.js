// ============================================================================
// pathfind.js — A* em grelha + suavização por linha de vista (interiores)
// ============================================================================
//
// Usado pela simulação interior das missões: os operacionais NUNCA atravessam
// paredes — apenas células FLOOR/DOOR são transitáveis. Os caminhos são
// calculados UMA vez na construção da simulação (não por frame) e depois
// percorridos por interpolação temporal O(1).
//
// Grelha: Uint8Array w*h com códigos de buildingGen (OUT/FLOOR/WALL/DOOR/BLOCK).

import { FLOOR, DOOR } from "./buildingGen";

const walkable = (grid, w, h, x, y) => {
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  const c = grid[y * w + x];
  return c === FLOOR || c === DOOR;
};

// Célula transitável mais próxima de (x,y) — anéis crescentes.
export function nearestWalkable(grid, w, h, x, y, maxR = 6) {
  x = Math.round(x); y = Math.round(y);
  if (walkable(grid, w, h, x, y)) return { x, y };
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (walkable(grid, w, h, x + dx, y + dy)) return { x: x + dx, y: y + dy };
      }
    }
  }
  return null;
}

// Linha de vista transitável (supercover Bresenham) — para suavizar caminhos.
function los(grid, w, h, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let x = x0, y = y0;
  const sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1;
  let err = dx - dy;
  // Percorre todas as células tocadas pela linha (incluindo diagonais "apertadas").
  for (;;) {
    if (!walkable(grid, w, h, x, y)) return false;
    if (x === x1 && y === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy && e2 < dx) {
      // passo diagonal — exigir que ambos os ortogonais estejam livres (sem cortar cantos)
      if (!walkable(grid, w, h, x + sx, y) || !walkable(grid, w, h, x, y + sy)) return false;
    }
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

// A* 4-conectado. Devolve waypoints [{x,y}] em coordenadas de célula (centros
// +0.5 aplicados pelo chamador) já suavizados por string-pulling, ou null.
export function findPath(grid, w, h, sx, sy, tx, ty) {
  sx = Math.round(sx); sy = Math.round(sy); tx = Math.round(tx); ty = Math.round(ty);
  if (!walkable(grid, w, h, sx, sy)) {
    const n = nearestWalkable(grid, w, h, sx, sy);
    if (!n) return null;
    sx = n.x; sy = n.y;
  }
  if (!walkable(grid, w, h, tx, ty)) {
    const n = nearestWalkable(grid, w, h, tx, ty);
    if (!n) return null;
    tx = n.x; ty = n.y;
  }
  if (sx === tx && sy === ty) return [{ x: sx, y: sy }];

  const size = w * h;
  const gScore = new Float32Array(size).fill(Infinity);
  const from = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);
  const start = sy * w + sx, goal = ty * w + tx;
  gScore[start] = 0;

  // Min-heap simples (array binário) — grelhas pequenas (<3k células), chega bem.
  const heap = [[Math.abs(tx - sx) + Math.abs(ty - sy), start]];
  const push = (f, i) => {
    heap.push([f, i]);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heap[p][0] <= heap[c][0]) break;
      const t = heap[p]; heap[p] = heap[c]; heap[c] = t; c = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = 2 * c + 1, r = l + 1;
        let m = c;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === c) break;
        const t = heap[m]; heap[m] = heap[c]; heap[c] = t; c = m;
      }
    }
    return top;
  };

  const DIRS = [1, -1, w, -w];
  let found = false;
  let guard = 0;
  while (heap.length && guard++ < size * 4) {
    const [, cur] = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) { found = true; break; }
    const cx = cur % w, cy = (cur / w) | 0;
    for (let d = 0; d < 4; d++) {
      const nb = cur + DIRS[d];
      const nx = nb % w, ny = (nb / w) | 0;
      // impedir wrap horizontal
      if (d < 2 && ny !== cy) continue;
      if (nb < 0 || nb >= size || closed[nb]) continue;
      const c = grid[nb];
      if (c !== FLOOR && c !== DOOR) continue;
      // portas custam ligeiramente mais (canalizam mas não "magnetizam")
      const g = gScore[cur] + (c === DOOR ? 1.05 : 1);
      if (g < gScore[nb]) {
        gScore[nb] = g;
        from[nb] = cur;
        push(g + Math.abs(tx - nx) + Math.abs(ty - ny), nb);
      }
    }
  }
  if (!found) return null;

  // Reconstruir
  const cells = [];
  for (let i = goal; i !== -1; i = from[i]) cells.push({ x: i % w, y: (i / w) | 0 });
  cells.reverse();

  // Suavização: string pulling com LOS (mantém sempre as células de porta como
  // âncoras — visual de "passar pela porta" e garantia de não cortar cantos).
  const pts = [cells[0]];
  let anchor = 0;
  for (let i = 2; i < cells.length; i++) {
    const isDoor = grid[cells[i - 1].y * w + cells[i - 1].x] === DOOR;
    if (isDoor || !los(grid, w, h, cells[anchor].x, cells[anchor].y, cells[i].x, cells[i].y)) {
      pts.push(cells[i - 1]);
      anchor = i - 1;
    }
  }
  pts.push(cells[cells.length - 1]);
  return pts;
}

// Comprimento (em células) de um caminho de waypoints + acumulados — para
// interpolação temporal por distância.
export function pathMetrics(pts) {
  const cum = [0];
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    cum.push(L);
  }
  return { length: L, cum };
}

// Posição + rumo ao longo do caminho na fração f (0..1 por distância).
export function pointAlong(pts, metrics, f) {
  const { length, cum } = metrics;
  if (!pts.length) return null;
  if (pts.length === 1 || length <= 0) return { x: pts[0].x, y: pts[0].y, heading: 0 };
  const d = Math.max(0, Math.min(1, f)) * length;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const t = (d - cum[i - 1]) / seg;
  const a = pts[i - 1], b = pts[i];
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    heading: Math.atan2(b.y - a.y, b.x - a.x),
  };
}
