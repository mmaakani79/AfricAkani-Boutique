// Text that goes into a PDF made with PDFKit's standard fonts (Helvetica…). Those fonts use the WinAnsi
// (Windows-1252) alphabet and know nothing about line-break characters: a "\r" (the first half of a Windows
// "\r\n") is printed as a stray "Ð" at the end of every line, a narrow no-break space (U+202F) as a "/".
// Everything that is written into a PDF goes through `pdfSafeText` first. Only what is drawn changes: the
// stored text, its signature and its date are never touched.
//
// The escapes below are written as "\uXXXX" on purpose: never paste the raw characters (a raw U+2028 inside a
// regular expression is a syntax error).

/** Characters (besides U+0020–007E and U+00A0–00FF) that Windows-1252 has. */
const WIN_ANSI_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d,
  0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

const isWinAnsi = (cp: number): boolean =>
  (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || WIN_ANSI_EXTRA.has(cp);

/** Look-alikes the alphabet lacks, written with plain characters. */
const LOOKALIKES: Record<string, string> = {
  "−": "-", // minus sign
  "‐": "-",
  "‑": "-",
  "‒": "-",
  "―": "—",
  "→": "->",
  "←": "<-",
  "≥": ">=",
  "≤": "<=",
  "≠": "!=",
  "­": "", // soft hyphen: invisible
};

const LINE_BREAKS = new RegExp("\\r\\n|[\\r\\u0085\\u2028\\u2029\\u000b\\u000c]", "g");
const NO_BREAK_SPACES = new RegExp("[\\u202f\\u2007]", "g");
const OTHER_SPACES = new RegExp("[\\u1680\\u2000-\\u2006\\u2008-\\u200a\\u205f\\u3000]", "g");
const INVISIBLE = new RegExp("[\\u00ad\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u2064\\ufeff]", "g");
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");
const NBSP = " ";

export function pdfSafeText(input: string): string {
  let text = String(input ?? "");
  // Line breaks, whatever their origin: Windows "\r\n", old Mac "\r", Unicode line / paragraph separators.
  text = text.replace(LINE_BREAKS, "\n");
  // Spaces: the narrow / figure no-break spaces keep their "no break" (as U+00A0, which the alphabet has);
  // the other exotic spaces become a plain space.
  text = text.replace(NO_BREAK_SPACES, NBSP).replace(OTHER_SPACES, " ");
  // Tabs, then invisible characters (zero-width, direction marks, byte-order mark).
  text = text.replace(/\t/g, "    ").replace(INVISIBLE, "");

  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    if (ch === "\n" || isWinAnsi(cp)) {
      out += ch;
      continue;
    }
    if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f)) continue; // control characters: dropped
    if (ch in LOOKALIKES) {
      out += LOOKALIKES[ch];
      continue;
    }
    // Accented letters outside the alphabet (ā, ő…): the base letter; anything else: "?".
    const base = ch.normalize("NFKD").replace(COMBINING_MARKS, "");
    out += base && [...base].every((c) => isWinAnsi(c.codePointAt(0) as number)) ? base : "?";
  }
  return out;
}

/** One line of text: the line breaks become spaces (for table cells that keep a fixed height). */
export function pdfOneLine(input: string): string {
  return pdfSafeText(input).replace(/\s*\n\s*/g, " ").trim();
}
