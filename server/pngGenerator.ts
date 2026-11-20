import zlib from 'node:zlib';

// Compact 5x7 uppercase/ASCII pixel glyph map for crisp PNG POD rendering without native binaries
const FONT_5X7: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10011', '10101', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10000', '11110', '10001', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00100', '00100'],
  ',': ['00000', '00000', '00000', '00000', '00000', '00100', '01000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '_': ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '#': ['01010', '11111', '01010', '01010', '11111', '01010', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, combined, crcBuf]);
}

export interface PodRenderParams {
  orderId: string;
  awbNumber: string;
  courierPartner: string;
  customerName: string;
  deliveryAddress: string;
  gpsCoordinates: string;
  deliveredAt: string;
  signed: boolean;
}

/**
 * Generates an authentic binary PNG Proof-of-Delivery receipt image in pure Node.js.
 */
export function renderPodPng(params: PodRenderParams): Buffer {
  const width = 680;
  const height = 400;
  // RGBA buffer
  const pixels = Buffer.alloc(width * height * 4);

  const setPixel = (x: number, y: number, r: number, g: number, b: number) => {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= width || iy < 0 || iy >= height) return;
    const idx = (iy * width + ix) * 4;
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = 255;
  };

  const fillRect = (x: number, y: number, w: number, h: number, r: number, g: number, b: number) => {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        setPixel(xx, yy, r, g, b);
      }
    }
  };

  const drawText = (text: string, startX: number, startY: number, scale: number, r: number, g: number, b: number) => {
    const upper = text.toUpperCase();
    let cursorX = startX;
    for (const ch of upper) {
      const glyph = FONT_5X7[ch] ?? FONT_5X7[' '];
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row][col] === '1') {
            fillRect(cursorX + col * scale, startY + row * scale, scale, scale, r, g, b);
          }
        }
      }
      cursorX += 6 * scale;
    }
  };

  const drawLine = (x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number, thickness = 2) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      const y = y0 + ((y1 - y0) * i) / steps;
      fillRect(x, y, thickness, thickness, r, g, b);
    }
  };

  // Crisp light paper thermal receipt canvas for high legibility in dark console & PDF
  fillRect(0, 0, width, height, 248, 248, 246);
  // Outer border & header band
  fillRect(0, 0, width, 62, 18, 18, 20);
  fillRect(0, 62, width, 4, 255, 98, 0); // RayGuard ember accent strip

  drawText(`${params.courierPartner} ELECTRONIC PROOF OF DELIVERY`, 24, 22, 2, 255, 255, 255);

  // Subtle horizontal divider rules
  fillRect(24, 108, width - 48, 1, 212, 212, 216);
  fillRect(24, 244, width - 48, 1, 212, 212, 216);

  drawText(`ORDER REF: ${params.orderId}`, 24, 82, 2, 24, 24, 27);
  drawText(`AWB: ${params.awbNumber}`, 390, 82, 2, 255, 98, 0);

  drawText(`RECIPIENT: ${params.customerName}`, 24, 126, 2, 24, 24, 27);
  drawText(`ADDRESS: ${params.deliveryAddress.slice(0, 44)}`, 24, 156, 2, 63, 63, 70);
  drawText(`GPS FIX: ${params.gpsCoordinates}`, 24, 186, 2, 63, 63, 70);
  drawText(`DELIVERED AT: ${params.deliveredAt}`, 24, 216, 2, 63, 63, 70);

  // Signature box
  fillRect(24, 260, 380, 114, 255, 255, 255);
  drawLine(24, 260, 404, 260, 161, 161, 170, 1);
  drawLine(24, 374, 404, 374, 161, 161, 170, 1);
  drawLine(24, 260, 24, 374, 161, 161, 170, 1);
  drawLine(404, 260, 404, 374, 161, 161, 170, 1);
  drawText('RECIPIENT SIGNATURE', 36, 272, 1, 113, 113, 122);

  if (params.signed) {
    // Draw authentic calligraphic signature curve
    let prevX = 56;
    let prevY = 335;
    for (let t = 0; t <= 48; t++) {
      const nx = 56 + t * 5.8;
      const ny = 328 - Math.sin(t * 0.45) * 20 - Math.cos(t * 0.22) * 10 + (t > 32 ? (t - 32) * 0.5 : 0);
      drawLine(prevX, prevY, nx, ny, 15, 23, 42, 3);
      prevX = nx;
      prevY = ny;
    }
    // Stamp box on right
    fillRect(424, 260, 232, 114, 236, 253, 245);
    drawLine(424, 260, 656, 260, 16, 185, 129, 2);
    drawLine(424, 374, 656, 374, 16, 185, 129, 2);
    drawLine(424, 260, 424, 374, 16, 185, 129, 2);
    drawLine(656, 260, 656, 374, 16, 185, 129, 2);
    drawText('POD VERIFIED', 466, 292, 2, 6, 95, 70);
    drawText('OTP + SIGN OK', 460, 326, 2, 6, 95, 70);
  } else {
    drawText('NO RECIPIENT SIGNATURE', 64, 322, 2, 220, 38, 38);
    fillRect(424, 260, 232, 114, 254, 242, 242);
    drawLine(424, 260, 656, 260, 239, 68, 68, 2);
    drawLine(424, 374, 656, 374, 239, 68, 68, 2);
    drawLine(424, 260, 424, 374, 239, 68, 68, 2);
    drawLine(656, 260, 656, 374, 239, 68, 68, 2);
    drawText('DELIVERY UNVERIFIED', 434, 292, 2, 153, 27, 27);
    drawText('SIGNATURE MISSING', 442, 326, 2, 153, 27, 27);
  }

  // Encode raw PNG scanlines (filter type 0)
  const rawScanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    rawScanlines[rowStart] = 0;
    pixels.copy(rawScanlines, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(rawScanlines);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
