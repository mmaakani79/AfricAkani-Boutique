import ExcelJS from "exceljs";
import { CATEGORIES } from "@/data/categories";
import {
  createProduct,
  getProductById,
  getProductByNameCI,
  getProductBySku,
  slugify,
  updateProduct,
} from "./products-db";
import type { HalalStatus, StockStatus } from "./types";

export const IMPORT_COLUMNS = [
  "sku",
  "nom",
  "categorie",
  "description",
  "prix_fcfa",
  "prix_cad",
  "prix_usd",
  "stock",
  "halal",
  "image",
  "fournisseur",
] as const;

export interface ParsedRow {
  row: number;
  sku: string;
  name: string;
  categorie: string;
  description: string;
  priceBj: number | null;
  priceCa: number | null;
  priceUs: number | null;
  stock: StockStatus;
  halal: HalalStatus;
  image: string;
  supplier: string;
}

export interface RowResult {
  row: number;
  sku: string;
  name: string;
  categoryName: string;
  action: "create" | "update" | "error";
  reason?: string;
}

export interface ImportReport {
  created: number;
  updated: number;
  errors: { row: number; reason: string }[];
  rows: RowResult[];
}

const MAX_IMPORT_ROWS = 2000;

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in (value as { text?: string })) {
    return String((value as { text?: string }).text ?? "").trim();
  }
  if (typeof value === "object" && "result" in (value as { result?: unknown })) {
    return String((value as { result?: unknown }).result ?? "").trim();
  }
  return String(value).trim();
}

function cellNumberOrNull(value: ExcelJS.CellValue): number | null {
  const text = cellText(value);
  if (text === "") return null;
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizeHalal(text: string): HalalStatus {
  const t = text.toLowerCase().trim();
  if (["oui", "vérifié", "verifie", "verifié", "halal vérifié", "yes"].includes(t)) {
    return "oui";
  }
  if (["a_verifier", "à vérifier", "a verifier"].includes(t)) return "a_verifier";
  return "n/a";
}

function normalizeStock(text: string): StockStatus {
  const t = text.toLowerCase().trim();
  if (["stock_limite", "stock limité", "stock limite"].includes(t)) return "stock_limite";
  if (["rupture", "rupture de stock"].includes(t)) return "rupture";
  return "en_stock";
}

function findCategoryId(text: string): string | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const match = CATEGORIES.find(
    (c) =>
      c.name.toLowerCase() === t ||
      c.id.toLowerCase() === t ||
      c.slug.toLowerCase() === t
  );
  return match?.id ?? null;
}

export type ParseResult =
  | { ok: true; rows: ParsedRow[] }
  | { ok: false; error: string };

export async function parseWorkbook(buffer: Buffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { ok: false, error: "Fichier .xlsx illisible ou corrompu." };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return { ok: false, error: "Le fichier ne contient aucune feuille." };

  const headerRow = sheet.getRow(1);
  const headerMap = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    const key = cellText(cell.value).toLowerCase().trim();
    if (key) headerMap.set(key, colNumber);
  });

  const missing = IMPORT_COLUMNS.filter((c) => !headerMap.has(c));
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Colonnes manquantes dans l'en-tête : ${missing.join(", ")}.`,
    };
  }

  if (sheet.rowCount - 1 > MAX_IMPORT_ROWS) {
    return { ok: false, error: `Trop de lignes (max ${MAX_IMPORT_ROWS}).` };
  }

  const rows: ParsedRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const get = (col: string) => cellText(row.getCell(headerMap.get(col)!).value);
    const name = get("nom");
    if (!name && row.cellCount === 0) continue; // fully blank row

    rows.push({
      row: r,
      sku: get("sku"),
      name,
      categorie: get("categorie"),
      description: get("description"),
      priceBj: cellNumberOrNull(row.getCell(headerMap.get("prix_fcfa")!).value),
      priceCa: cellNumberOrNull(row.getCell(headerMap.get("prix_cad")!).value),
      priceUs: cellNumberOrNull(row.getCell(headerMap.get("prix_usd")!).value),
      stock: normalizeStock(get("stock")),
      halal: normalizeHalal(get("halal")),
      image: get("image"),
      supplier: get("fournisseur"),
    });
  }

  return { ok: true, rows };
}

/**
 * Validates and (if `commit`) writes rows. Matching: by SKU when given,
 * else by product name (case-insensitive) — this is how the 33 seed
 * products, which ship with no SKU, get matched on first import instead
 * of being duplicated.
 */
export async function processRows(
  rows: ParsedRow[],
  commit: boolean
): Promise<ImportReport> {
  const report: ImportReport = { created: 0, updated: 0, errors: [], rows: [] };

  for (const row of rows) {
    if (!row.name) {
      report.errors.push({ row: row.row, reason: "Le nom est obligatoire." });
      report.rows.push({
        row: row.row,
        sku: row.sku,
        name: row.name,
        categoryName: row.categorie,
        action: "error",
        reason: "Le nom est obligatoire.",
      });
      continue;
    }

    const categoryId = findCategoryId(row.categorie);
    if (!categoryId) {
      const reason = `Catégorie introuvable : « ${row.categorie || "(vide)"} ».`;
      report.errors.push({ row: row.row, reason });
      report.rows.push({
        row: row.row,
        sku: row.sku,
        name: row.name,
        categoryName: row.categorie,
        action: "error",
        reason,
      });
      continue;
    }

    const existing = row.sku
      ? await getProductBySku(row.sku)
      : await getProductByNameCI(row.name);

    const prices = { bj: row.priceBj, ca: row.priceCa, us: row.priceUs };

    if (existing) {
      report.rows.push({
        row: row.row,
        sku: row.sku || existing.sku || "",
        name: row.name,
        categoryName: row.categorie,
        action: "update",
      });
      if (commit) {
        const fresh = await getProductById(existing.id);
        await updateProduct(existing.id, {
          slug: fresh?.slug ?? slugify(row.name),
          name: row.name,
          categoryId,
          halal: row.halal,
          unit: fresh?.unit ?? "pièce",
          packaging: fresh?.packaging ?? "carton_boite",
          description: row.description,
          prices,
          stock: row.stock,
          featured: fresh?.featured ?? false,
          sku: row.sku || undefined,
          supplier: row.supplier || null,
          // Blank cell = leave the existing image untouched (a bulk import
          // shouldn't wipe an image uploaded manually in the admin); a
          // non-blank cell sets/replaces it.
          image: row.image || undefined,
        });
        report.updated++;
      }
    } else {
      report.rows.push({
        row: row.row,
        sku: row.sku || `AK-${slugify(row.name).toUpperCase()}`,
        name: row.name,
        categoryName: row.categorie,
        action: "create",
      });
      if (commit) {
        await createProduct({
          slug: slugify(row.name),
          name: row.name,
          categoryId,
          halal: row.halal,
          unit: "pièce",
          packaging: "carton_boite",
          description: row.description,
          prices,
          stock: row.stock,
          featured: false,
          sku: row.sku || undefined,
          supplier: row.supplier || null,
          image: row.image || undefined,
        });
        report.created++;
      }
    }
  }

  return report;
}

export async function buildTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Produits");
  sheet.columns = IMPORT_COLUMNS.map((key) => ({ header: key, key, width: 18 }));
  sheet.getRow(1).font = { bold: true };
  sheet.addRow({
    sku: "",
    nom: "Beurre de karité pur (non raffiné)",
    categorie: "Huiles & Cosmétiques naturels",
    description: "Beurre de karité 100% naturel, non raffiné.",
    prix_fcfa: 3000,
    prix_cad: 12.5,
    prix_usd: "",
    stock: "en_stock",
    halal: "n/a",
    image: "",
    fournisseur: "",
  });

  const help = workbook.addWorksheet("Aide");
  help.columns = [{ width: 90 }];
  help.addRows([
    ["Comment remplir ce fichier"],
    [""],
    ["- nom : obligatoire."],
    [
      "- sku : identifie le produit. S'il existe déjà, la ligne met à jour ce produit au lieu d'en créer un doublon. Si vide, le nom est utilisé pour retrouver le produit.",
    ],
    ["- categorie : doit correspondre exactement au nom d'une catégorie existante."],
    [
      `- Catégories disponibles : ${CATEGORIES.map((c) => c.name).join(", ")}`,
    ],
    [
      "- prix_fcfa / prix_cad / prix_usd : laissez la cellule vide si le produit n'est pas vendu dans cette zone. Aucune conversion automatique n'est faite entre devises.",
    ],
    ["- stock : en_stock, stock_limite ou rupture (en_stock par défaut)."],
    ["- halal : oui, a_verifier ou n/a (n/a par défaut)."],
    [
      "- image : URL de l'image (facultatif). Affichée sur le site et modifiable ensuite dans l'admin. Cellule vide = l'image déjà en place n'est pas touchée.",
    ],
    ["- fournisseur : facultatif, visible uniquement dans l'admin."],
    [""],
    ["Le SKU reste toujours visible uniquement dans l'espace admin."],
  ]);
  help.getRow(1).font = { bold: true, size: 13 };

  return workbook;
}
