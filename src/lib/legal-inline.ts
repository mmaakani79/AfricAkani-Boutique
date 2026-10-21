// Turns one line of legal text into pieces to display: plain text, [text](url)
// links and e-mail addresses (shown as mailto links). Pure, so it is unit-tested.
// The text itself is never changed: joining the pieces' `text` gives back the
// line, with each [text](url) shown as "text".

export type InlinePiece =
  | { kind: "text"; text: string }
  | { kind: "link"; text: string; href: string; external: boolean };

// An address ends on a letter, so a sentence-ending dot ("…@africakani.com.") stays outside it.
const TOKEN = /\[([^\]]+)\]\(([^)\s]+)\)|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

export function tokenizeInline(line: string): InlinePiece[] {
  const pieces: InlinePiece[] = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN)) {
    const [raw, label, url, email] = match;
    const index = match.index ?? 0;
    if (index > last) pieces.push({ kind: "text", text: line.slice(last, index) });
    if (email) {
      pieces.push({ kind: "link", text: email, href: `mailto:${email}`, external: false });
    } else {
      pieces.push({ kind: "link", text: label, href: url, external: /^https?:\/\//i.test(url) });
    }
    last = index + raw.length;
  }
  if (last < line.length) pieces.push({ kind: "text", text: line.slice(last) });
  return pieces;
}
