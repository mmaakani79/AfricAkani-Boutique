import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-api-auth";
import { buildTemplateWorkbook } from "@/lib/product-import";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const workbook = await buildTemplateWorkbook();
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modele-produits-africakani.xlsx"',
    },
  });
}
