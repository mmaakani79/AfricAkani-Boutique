import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-api-auth";
import { parseWorkbook, processRows } from "@/lib/product-import";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const formData = await request.formData();
  const mode = String(formData.get("mode") ?? "preview");
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".xlsx") || (file.type && file.type !== XLSX_MIME)) {
    return NextResponse.json(
      { error: "Seuls les fichiers .xlsx sont acceptés." },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Fichier trop volumineux (5 Mo maximum)." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseWorkbook(buffer);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const report = await processRows(parsed.rows, mode === "commit");
  return NextResponse.json(report);
}
