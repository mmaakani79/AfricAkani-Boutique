import { NextRequest, NextResponse } from "next/server";
import { getServiceAccountByToken } from "@/lib/service-accounts-db";
import { generateServiceInvoicePdf, serviceInvoiceFilename } from "@/lib/service-invoice-pdf";

export const dynamic = "force-dynamic";

const NOT_FOUND = () =>
  new NextResponse("Introuvable.", {
    status: 404,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });

/** The client's own invoice (PDF), reached only through their secret link. Read-only: it changes nothing. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const full = await getServiceAccountByToken(token);
  if (!full) return NOT_FOUND();

  const pdf = await generateServiceInvoicePdf(full);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${serviceInvoiceFilename(full.account.id)}"`,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
