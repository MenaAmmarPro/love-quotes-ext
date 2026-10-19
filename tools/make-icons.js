"use strict";

/*
 * tools/make-icons.js — generate the extension icons (no image tools needed).
 *
 * Run once from the repo root:  node tools/make-icons.js
 * Writes icons/icon-16.png, icon-32.png, icon-48.png, icon-128.png (a pink
 * heart on a soft rounded tile) and icons/icon.svg.
 */

const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const ty = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([ty, data])), 0);
  return Buffer.concat([len, ty, data, crc]);
}

function png(size, fn) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y += 1) {
    raw[o++] = 0;
    for (let x = 0; x < size; x += 1) {
      const p = fn(x, y, size);
      raw[o++] = p[0];
      raw[o++] = p[1];
      raw[o++] = p[2];
      raw[o++] = p[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// Heart implicit curve (x^2 + y^2 - 1)^3 - x^2 * y^3 <= 0.
function heart(x, y, size) {
  const nx = ((x + 0.5) / size) * 2 - 1;
  const ny = 1 - ((y + 0.5) / size) * 2;
  const X = nx * 1.3;
  const Y = ny * 1.3 + 0.1;
  return Math.pow(X * X + Y * Y - 1, 3) - X * X * Math.pow(Y, 3) <= 0;
}

fs.mkdirSync("icons", { recursive: true });
for (const s of [16, 32, 48, 128]) {
  fs.writeFileSync(
    path.join("icons", `icon-${s}.png`),
    png(s, (x, y, z) => (heart(x, y, z) ? [233, 30, 99, 255] : [255, 255, 255, 0]))
  );
}

fs.writeFileSync(
  path.join("icons", "icon.svg"),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
  '<path fill="#e91e63" d="M12 21s-7.5-4.6-10-9.2C.4 8.6 2.2 5 5.7 5c2 0 3.4 1 ' +
  '4.3 2.3L12 9.5l2-2.2C14.9 6 16.3 5 18.3 5 21.8 5 23.6 8.6 22 11.8 19.5 16.4 12 21 12 21z"/></svg>'
);
console.log("icons written");
