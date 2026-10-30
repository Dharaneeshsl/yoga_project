import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

// CRC32 table for PNG chunk checksums
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);
  const crcData = Buffer.concat([typeBuf, data]);
  chunk.writeUInt32BE(crc32(crcData), 8 + len);
  return chunk;
}

function generatePng(size) {
  const width = size;
  const height = size;
  const scanlineLength = 1 + width * 4; // 1 filter byte + RGBA
  const rawData = Buffer.alloc(height * scanlineLength);

  const radius = size * 0.22;
  const centerX = size / 2;
  const centerY = size / 2;

  // Render rounded emerald card with stylized yoga icon in RGBA
  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      // Distance to nearest rounded rect boundary
      const dx = Math.max(0, Math.abs(x - centerX) - (centerX - radius));
      const dy = Math.max(0, Math.abs(y - centerY) - (centerY - radius));
      const distToCorner = Math.sqrt(dx * dx + dy * dy);

      if (distToCorner > radius) {
        // Transparent outside rounded corner
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
        continue;
      }

      // Emerald background gradient (#10b981 to #047857)
      const gradT = (x + y) / (width + height);
      let r = Math.round(16 + gradT * (4 - 16));
      let g = Math.round(185 + gradT * (120 - 185));
      let b = Math.round(129 + gradT * (87 - 129));
      let a = 255;

      // Draw stylized yoga silhouette:
      // Head circle
      const headDist = Math.hypot(x - centerX, y - (centerY - size * 0.20));
      const headR = size * 0.08;

      // Spine line
      const spineXDist = Math.abs(x - centerX);
      const isSpine = spineXDist < size * 0.025 && y >= centerY - size * 0.12 && y <= centerY + size * 0.16;

      // Standing leg
      const isStandingLeg = spineXDist < size * 0.025 && y >= centerY + size * 0.16 && y <= centerY + size * 0.38;

      // Overhead arms (inverted V-shape)
      const armYTarget = (centerY - size * 0.26) + Math.abs(x - centerX) * 0.9;
      const armDist = Math.abs(y - armYTarget);
      const isArm = armDist < size * 0.025 && Math.abs(x - centerX) < size * 0.22 && y >= centerY - size * 0.28;

      // Bent knee leg (triangle branch to right)
      const kneeXTarget = centerX + (y - (centerY + size * 0.16)) * 0.9;
      const isKneeOut = Math.abs(x - kneeXTarget) < size * 0.025 && y >= centerY + size * 0.16 && y <= centerY + size * 0.26 && x >= centerX;
      const footXTarget = (centerX + size * 0.09) - (y - (centerY + size * 0.26)) * 1.5;
      const isFootIn = Math.abs(x - footXTarget) < size * 0.025 && y >= centerY + size * 0.26 && y <= centerY + size * 0.32 && x >= centerX;

      if (headDist <= headR || isSpine || isStandingLeg || isArm || isKneeOut || isFootIn) {
        // Crisp white silhouette (#ffffff)
        r = 255;
        g = 255;
        b = 255;
      }

      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA color
  ihdr[10] = 0; // Deflate compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Non-interlaced
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const icon192 = generatePng(192);
const icon512 = generatePng(512);

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);

console.log('Generated icon-192.png (' + icon192.length + ' bytes) and icon-512.png (' + icon512.length + ' bytes)');
