// Helpers shared by the PDF tests (not a test file itself): text extraction, pages, and a raster check
// of the signature. They call poppler's `pdftotext` / `pdftoppm`; when those are not installed the callers skip
// the checks that need them (the number of pages is read from the file and always checked).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

export function tmpFile(name: string, data: Buffer): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-"));
  const file = path.join(dir, name);
  fs.writeFileSync(file, data);
  return file;
}

export function pdfPages(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type \/Page\b(?!s)/g) ?? []).length;
}

/** Text as extracted by pdftotext (layout kept), or null when pdftotext is not installed. "\f" separates pages. */
export function pdfText(pdf: Buffer): string | null {
  const file = tmpFile("f.pdf", pdf);
  try {
    return execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" }).replace(/[  ]/g, " ");
  } catch {
    return null;
  }
}

/** Characters that must never appear in the text of a PDF: control characters (page separator "\f" excepted) and the stray "Ð". */
export const PDF_FORBIDDEN = new RegExp("[\\u0000-\\u0008\\u000b\\u000e-\\u001f\\u007f-\\u009f]|Ð");

export function forbiddenIn(text: string): string | null {
  const m = PDF_FORBIDDEN.exec(text);
  return m ? `U+${(m[0].codePointAt(0) as number).toString(16).padStart(4, "0")} près de « ${text.slice(Math.max(0, m.index - 20), m.index + 20).replace(/\s+/g, " ")} »` : null;
}

export interface PdfLine { page: number; text: string; xMin: number; xMax: number; yMin: number; yMax: number }

export function pdfLines(pdf: Buffer): PdfLine[] | null {
  const file = tmpFile("f.pdf", pdf);
  let xml: string;
  try {
    xml = execFileSync("pdftotext", ["-bbox-layout", file, "-"], { encoding: "utf8" });
  } catch {
    return null;
  }
  const out: PdfLine[] = [];
  let page = 0;
  for (const chunk of xml.split("<page ").slice(1)) {
    page += 1;
    for (const m of chunk.matchAll(/<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/line>/g)) {
      const text = [...m[5].matchAll(/<word[^>]*>([^<]*)<\/word>/g)].map((w) => w[1]).join(" ").replace(/&amp;/g, "&").replace(/&#39;/g, "'");
      out.push({ page, text: text.replace(/[  ]/g, " "), xMin: +m[1], xMax: +m[3], yMin: +m[2], yMax: +m[4] });
    }
  }
  return out;
}

// ---- A test signature: a PNG that draws the whole frame of a 600x200 canvas and both diagonals ----------
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
export function framedSignaturePng(w = 600, h = 200): string {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = y * (w * 4 + 1) + 1 + x * 4;
      const on = x < 4 || y < 4 || x >= w - 4 || y >= h - 4 || Math.abs(y - (x * h) / w) < 3 || Math.abs(y - (h - (x * h) / w)) < 3;
      raw[o] = 14; raw[o + 1] = 90; raw[o + 2] = 68; raw[o + 3] = on ? 255 : 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** Box (in points) of the green pixels between two heights of a page, or null when pdftoppm is missing. */
export function greenBox(pdf: Buffer, page: number, fromPt: number, toPt: number): { w: number; h: number; top: number; bottom: number } | null {
  const file = tmpFile("f.pdf", pdf);
  const base = file.replace(/\.pdf$/, "");
  const dpi = 60;
  try {
    execFileSync("pdftoppm", ["-f", String(page), "-l", String(page), "-r", String(dpi), "-singlefile", file, base]);
  } catch {
    return null;
  }
  const ppm = fs.readFileSync(`${base}.ppm`);
  let pos = 0;
  const tok: string[] = [];
  while (tok.length < 4 && pos < ppm.length) {
    while (pos < ppm.length && ppm[pos] <= 32) pos++;
    let t = "";
    while (pos < ppm.length && ppm[pos] > 32) t += String.fromCharCode(ppm[pos++]);
    tok.push(t);
  }
  pos++;
  const W = Number(tok[1]);
  const k = dpi / 72;
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
  for (let y = Math.floor(fromPt * k); y < Math.floor(toPt * k); y++) {
    for (let x = 0; x < W; x++) {
      const o = pos + (y * W + x) * 3;
      const r = ppm[o], g = ppm[o + 1], b = ppm[o + 2];
      if (g > r + 30 && g > b + 5 && r < 140) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { w: 0, h: 0, top: 0, bottom: 0 };
  return { w: (maxX - minX + 1) / k, h: (maxY - minY + 1) / k, top: minY / k, bottom: (maxY + 1) / k };
}
