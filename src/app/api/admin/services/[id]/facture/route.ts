import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-api-auth";
import { getServiceAccountFull } from "@/lib/service-accounts-db";
import { generateServiceInvoicePdf, serviceInvoiceFilename } from "@/lib/service-invoice-pdf";

export const dynamic = "force-dynamic";

/** The invoice of a service file, for the signed-in admin only (the proxy lets /api/admin through, so the check is here). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const full = await getServiceAccountFull(id);
  if (!full) {
    return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });
  }

  const pdf = await generateServiceInvoicePdf(full);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${serviceInvoiceFilename(full.account.id)}"`,
      "Cache-Control": "no-store",
    },
  });
}
