import { NextRequest, NextResponse } from "next/server";
import { getServiceAccountByToken } from "@/lib/service-accounts-db";
import { getSignedContractById } from "@/lib/contracts-db";
import { generateContractPdf } from "@/lib/contract-pdf";
import { contractPdfFilename } from "@/lib/contract-email-content";

export const dynamic = "force-dynamic";

const NOT_FOUND = () =>
  new NextResponse("Introuvable.", {
    status: 404,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });

/** The client's own signed contract, read-only (PDF), reached only through their secret link. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const full = await getServiceAccountByToken(token);
  if (!full?.account.contractId) return NOT_FOUND();
  const contract = await getSignedContractById(full.account.contractId);
  if (!contract) return NOT_FOUND();

  const pdf = await generateContractPdf(contract);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${contractPdfFilename(contract)}"`,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
