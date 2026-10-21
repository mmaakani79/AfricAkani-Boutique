import { Container } from "@/components/layout/container";
import type { LegalPage } from "@/lib/legal-content";
import { tokenizeInline } from "@/lib/legal-inline";

// One legal page: the validated text, shown as it is (see lib/legal-content.ts),
// in a readable column that works down to 320 px. Server component: static page,
// no client code.

function Inline({ text }: { text: string }) {
  return (
    <>
      {tokenizeInline(text).map((piece, i) =>
        piece.kind === "text" ? (
          <span key={i}>{piece.text}</span>
        ) : (
          <a
            key={i}
            href={piece.href}
            {...(piece.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="font-semibold text-brand-green-dark underline decoration-brand-gold underline-offset-2 hover:text-brand-green"
          >
            {piece.text}
          </a>
        ),
      )}
    </>
  );
}

export function LegalDocument({ page }: { page: LegalPage }) {
  return (
    <Container className="py-10">
      <article
        data-testid="legal-document"
        className="mx-auto max-w-3xl rounded-2xl bg-white p-5 sm:p-8"
      >
        <h1 className="font-brand text-3xl font-bold text-brand-green-dark [overflow-wrap:anywhere]">
          {page.title}
        </h1>
        {page.blocks.map((block, i) => {
          if (block.type === "h2") {
            return (
              <h2
                key={i}
                className="mt-8 font-brand text-xl font-bold text-brand-green-dark [overflow-wrap:anywhere]"
              >
                {block.text}
              </h2>
            );
          }
          if (block.type === "ul") {
            return (
              <ul
                key={i}
                className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink/80 marker:text-brand-gold sm:text-base"
              >
                {block.items.map((item, j) => (
                  <li key={j} className="[overflow-wrap:anywhere]">
                    <Inline text={item} />
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p
              key={i}
              className="mt-4 text-sm leading-relaxed text-ink/80 [overflow-wrap:anywhere] sm:text-base"
            >
              <Inline text={block.text} />
            </p>
          );
        })}
      </article>
    </Container>
  );
}
