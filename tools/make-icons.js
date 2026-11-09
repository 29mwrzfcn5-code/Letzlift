#!/usr/bin/env node
/*
 * Génère les icônes de l'app (PNG) : Roudi, le lion rouge, sur fond crème (--bg) avec un disque bleu ciel.
 * Aucune dépendance : rastérisation par suréchantillonnage + encodeur PNG (zlib de Node).
 * Sortie déterministe : tests/pwa.test.js vérifie que les fichiers committés sont à jour.
 *
 * Fond plein cadre et mascotte dans la zone centrale (≈ 62 % de la largeur) : l'icône reste correcte
 * une fois masquée en cercle ou en carré arrondi (Android « maskable », iOS). Le dessin reprend celui du
 * symbole #roudi de index.html (unités du viewBox -75 -75 150 150).
 *
 * Usage : node tools/make-icons.js
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const BG = [0xFF, 0xF4, 0xE0];     // --bg
const SIZES = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 };
const SS = 4, SHARE = 0.62;

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const circle = (cx, cy, r, color, alpha) => ({ color: hex(color), alpha: alpha || 1, hit: (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r });
const ellipse = (cx, cy, rx, ry, color) => ({ color: hex(color), alpha: 1, hit: (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 });
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function stroke(points, width, color) {
  return { color: hex(color), alpha: 1, hit: (x, y) => { for (let i = 0; i < points.length - 1; i++) if (distSeg(x, y, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]) <= width / 2) return true; return false; } };
}
function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) if ((pts[i][1] > y) !== (pts[j][1] > y) && x < (pts[j][0] - pts[i][0]) * (y - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0]) inside = !inside;
  return inside;
}
function polygon(pts, fill, edge, edgeWidth) {
  const closed = pts.concat([pts[0]]);
  return [
    { color: hex(edge), alpha: 1, hit: (x, y) => { for (let i = 0; i < closed.length - 1; i++) if (distSeg(x, y, closed[i][0], closed[i][1], closed[i + 1][0], closed[i + 1][1]) <= edgeWidth / 2) return true; return false; } },
    { color: hex(fill), alpha: 1, hit: (x, y) => inPoly(x, y, pts) && !closed.some((_, i) => i < closed.length - 1 && distSeg(x, y, closed[i][0], closed[i][1], closed[i + 1][0], closed[i + 1][1]) <= edgeWidth / 2) },
  ];
}
const quad = (p0, p1, p2, n = 24) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [(1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]]; });

// Roudi, dans l'ordre de peinture (mêmes formes que le symbole #roudi de index.html).
const RED = '#D9342B';
const ROUDI = [
  circle(0, 0, 52, RED),
  ...[[46, 0], [37.2, 27], [14.2, 43.7], [-14.2, 43.7], [-37.2, 27], [-46, 0], [-37.2, -27], [-14.2, -43.7], [14.2, -43.7], [37.2, -27]].map(([x, y]) => circle(x, y, 15, RED)),
  circle(0, 0, 37, '#FFE0B8'),
  ellipse(-13, -6, 5, 6.5, '#2B1B17'), ellipse(13, -6, 5, 6.5, '#2B1B17'),
  circle(-11.5, -8.5, 2, '#FFFFFF'), circle(14.5, -8.5, 2, '#FFFFFF'),
  circle(-24, 9, 6, '#FFB4A2', 0.85), circle(24, 9, 6, '#FFB4A2', 0.85),
  ellipse(0, 6, 7, 5, '#8B2E1C'),
  stroke([[0, 11], [0, 16]], 2.6, '#8B2E1C'), stroke(quad([-10, 15], [0, 26], [10, 15]), 2.6, '#8B2E1C'),
  ...polygon([[-17, -50], [-20, -66], [-9, -58], [0, -70], [9, -58], [20, -66], [17, -50]], '#F2B33D', '#C98A12', 2),
  circle(0, -58, 2.6, RED),
];

function render(n) {
  const u = (n * SHARE) / 150, cx = n / 2, cy = n * 0.54;
  const sky = [0xBF, 0xE3, 0xF5], skyR = n * 0.43;
  const rows = [];
  for (let py = 0; py < n; py++) {
    const row = Buffer.alloc(1 + n * 3); // octet de filtre 0 + RGB
    for (let px = 0; px < n; px++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const x = px + (sx + 0.5) / SS, y = py + (sy + 0.5) / SS;
        let color = (x - n / 2) ** 2 + (y - n / 2) ** 2 <= skyR * skyR ? sky : BG;
        const ux = (x - cx) / u, uy = (y - cy) / u;
        if (Math.abs(ux) <= 75 && Math.abs(uy) <= 75) {
          for (const shape of ROUDI) if (shape.hit(ux, uy)) color = shape.alpha === 1 ? shape.color : color.map((c, k) => c + (shape.color[k] - c) * shape.alpha);
        }
        acc[0] += color[0]; acc[1] += color[1]; acc[2] += color[2];
      }
      for (let c = 0; c < 3; c++) row[1 + px * 3 + c] = Math.round(acc[c] / (SS * SS));
    }
    rows.push(row);
  }
  return Buffer.concat(rows);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xFFFFFFFF; for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(n) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 bits, RGB
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(render(n), { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

module.exports = { png, SIZES };

if (require.main === module) {
  fs.mkdirSync(path.join(ROOT, 'icons'), { recursive: true });
  for (const [file, n] of Object.entries(SIZES)) {
    fs.writeFileSync(path.join(ROOT, 'icons', file), png(n));
    console.log(`icons/${file} (${n}×${n})`);
  }
}
