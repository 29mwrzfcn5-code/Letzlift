#!/usr/bin/env node
/*
 * Génère les icônes de l'app (PNG) aux couleurs du CSS : fond #1F5C56 (--accent), motif clair
 * #EDE8DC (--bg). Le motif est celui de la marque dans la barre du haut (pont et trois créneaux).
 * Aucune dépendance : rastérisation par suréchantillonnage + encodeur PNG (zlib de Node).
 * Sortie déterministe : tests/pwa.test.js vérifie que les fichiers committés sont à jour.
 *
 * Fond plein cadre et motif dans la zone centrale (≈ 56 % de la largeur) : l'icône reste
 * correcte une fois masquée en cercle ou en carré arrondi (Android « maskable », iOS).
 *
 * Usage : node tools/make-icons.js
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const BG = [0x1F, 0x5C, 0x56];     // --accent
const FG = [0xED, 0xE8, 0xDC];     // --bg
const SIZES = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 };
const MARK = [[0, 8, 24, 8], [1, 2, 4, 6], [10, 2, 4, 6], [19, 2, 4, 6]]; // x, y, w, h dans un viewBox 24 × 16
const MARK_W = 24, MARK_H = 16, MARK_SHARE = 0.56, SS = 4;

function render(n) {
  const s = (n * MARK_SHARE) / MARK_W;
  const ox = (n - MARK_W * s) / 2, oy = (n - MARK_H * s) / 2;
  const rects = MARK.map(([x, y, w, h]) => [ox + x * s, oy + y * s, ox + (x + w) * s, oy + (y + h) * s]);
  const rows = [];
  for (let py = 0; py < n; py++) {
    const row = Buffer.alloc(1 + n * 3); // octet de filtre 0 + RGB
    for (let px = 0; px < n; px++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const x = px + (sx + 0.5) / SS, y = py + (sy + 0.5) / SS;
        if (rects.some(r => x >= r[0] && x < r[2] && y >= r[1] && y < r[3])) hit++;
      }
      const a = hit / (SS * SS);
      for (let c = 0; c < 3; c++) row[1 + px * 3 + c] = Math.round(BG[c] + (FG[c] - BG[c]) * a);
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
