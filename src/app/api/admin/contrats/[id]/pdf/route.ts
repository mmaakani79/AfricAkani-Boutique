import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-api-auth";
import { getSignedContractById } from "@/lib/contracts-db";
import { generateContractPdf } from "@/lib/contract-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const contract = await getSignedContractById(id);
  if (!contract) {
    return NextResponse.json({ error: "Contrat introuvable." }, { status: 404 });
  }

  const pdf = await generateContractPdf(contract);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="contrat-${contract.id}.pdf"`,
    },
  });
}
