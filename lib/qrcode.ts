export function generateQRCodeSVG(data: string, moduleSize: number = 4): string {
  const textToBytes = (text: string): number[] => {
    const bytes: number[] = [];
    for (let i = 0; i < text.length; i++) bytes.push(text.charCodeAt(i));
    return bytes;
  };

  const GF_EXP: number[] = new Array(512);
  const GF_LOG: number[] = new Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 256) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];

  const gfMul = (a: number, b: number): number => {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  };

  const rsEncode = (data: number[], nsym: number): number[] => {
    const gen: number[] = new Array(nsym + 1).fill(0);
    gen[0] = 1;
    for (let i = 0; i < nsym; i++) {
      for (let j = nsym; j > 0; j--) {
        gen[j] = gen[j] ? GF_EXP[GF_LOG[gen[j]] + i] ^ gen[j - 1] : gen[j - 1];
      }
      gen[0] = GF_EXP[GF_LOG[gen[0]] + i];
    }
    const remainder = new Array(nsym).fill(0);
    for (const byte of data) {
      const coef = byte ^ remainder[0];
      remainder.shift();
      remainder.push(0);
      if (coef !== 0) {
        for (let j = 0; j < nsym; j++) remainder[j] ^= gfMul(gen[nsym - 1 - j], coef);
      }
    }
    return remainder;
  };

  const dataBytes = textToBytes(data);
  const len = dataBytes.length;
  const versionCapacity = [0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271];
  let version = 1;
  for (let v = 1; v <= 10; v++) {
    if (len <= versionCapacity[v]) { version = v; break; }
  }
  if (len > versionCapacity[10]) version = 10;
  const size = 17 + version * 4;

  const ecCounts = [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18];
  const ecCount = ecCounts[version];
  const totalCW = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
  const dataCW = totalCW[version] - ecCount * (version <= 2 ? 1 : version <= 6 ? version <= 4 ? 1 : 2 : 2);

  const bits: number[] = [];
  bits.push(0, 1, 0, 0);
  const ccBits = version <= 9 ? 8 : 16;
  for (let i = ccBits - 1; i >= 0; i--) bits.push((len >> i) & 1);
  for (const b of dataBytes) {
    for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  }
  for (let i = 0; i < 4 && bits.length < dataCW * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const padBytes = [0xEC, 0x11];
  let padIdx = 0;
  while (bits.length < dataCW * 8) {
    for (let i = 7; i >= 0; i--) bits.push((padBytes[padIdx] >> i) & 1);
    padIdx = (padIdx + 1) % 2;
  }

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] || 0);
    codewords.push(byte);
  }

  const ecWords = rsEncode(codewords.slice(0, dataCW), ecCount);
  const finalData = [...codewords.slice(0, dataCW), ...ecWords];

  const matrix: (number | null)[][] = Array.from({ length: size }, () => new Array(size).fill(null));

  const placeFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const mr = row + r, mc = col + c;
        if (mr < 0 || mr >= size || mc < 0 || mc >= size) continue;
        if (r === -1 || r === 7 || c === -1 || c === 7) matrix[mr][mc] = 0;
        else if (r === 0 || r === 6 || c === 0 || c === 6) matrix[mr][mc] = 1;
        else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) matrix[mr][mc] = 1;
        else matrix[mr][mc] = 0;
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0 ? 1 : 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0 ? 1 : 0;
  }
  matrix[size - 8][8] = 1;

  if (version >= 2) {
    const alignPos = [0, 0, 18, 22, 26, 30, 34, 22, 24, 26, 28];
    const pos = alignPos[version];
    if (pos > 0) {
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const mr = pos + r, mc = pos + c;
          if (matrix[mr][mc] !== null) continue;
          if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) matrix[mr][mc] = 1;
          else matrix[mr][mc] = 0;
        }
      }
    }
  }

  const reserved: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  for (let i = 0; i < 9; i++) {
    if (i < size) { reserved[8][i] = true; reserved[i][8] = true; }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }

  const allBits: number[] = [];
  for (const cw of finalData) {
    for (let i = 7; i >= 0; i--) allBits.push((cw >> i) & 1);
  }

  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5;
    const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);
    for (const row of rows) {
      for (const c of [col, col - 1]) {
        if (c < 0 || c >= size) continue;
        if (matrix[row][c] !== null || reserved[row][c]) continue;
        matrix[row][c] = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
      }
    }
    upward = !upward;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] !== null && !reserved[r][c]) {
        const isFinder = (r < 9 && c < 9) || (r < 9 && c >= size - 8) || (r >= size - 8 && c < 9);
        const isTiming = r === 6 || c === 6;
        const isAlign = version >= 2 && (() => {
          const alignPos = [0, 0, 18, 22, 26, 30, 34, 22, 24, 26, 28];
          const p = alignPos[version];
          return p > 0 && Math.abs(r - p) <= 2 && Math.abs(c - p) <= 2;
        })();
        if (!isFinder && !isTiming && !isAlign) {
          if ((r + c) % 2 === 0) matrix[r][c] = matrix[r][c]! ^ 1;
        }
      }
    }
  }

  const formatBits = '111011111000100';
  for (let i = 0; i < 15; i++) {
    const bit = parseInt(formatBits[i]);
    if (i < 6) matrix[8][i] = bit;
    else if (i < 8) matrix[8][i + 1] = bit;
    else matrix[size - 15 + i][8] = bit;
    if (i < 8) matrix[size - 1 - i][8] = bit;
    else matrix[8][size - 15 + i] = bit;
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === null) matrix[r][c] = 0;
    }
  }

  const quiet = 2;
  const totalSize = (size + quiet * 2) * moduleSize;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}">`;
  svg += `<rect width="${totalSize}" height="${totalSize}" fill="white"/>`;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === 1) {
        svg += `<rect x="${(c + quiet) * moduleSize}" y="${(r + quiet) * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
      }
    }
  }
  svg += '</svg>';
  return svg;
}
