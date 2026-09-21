"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UploadCloud, CheckCircle2, AlertTriangle } from "lucide-react";

interface RowResult {
  row: number;
  sku: string;
  name: string;
  categoryName: string;
  action: "create" | "update" | "error";
  reason?: string;
}

interface ImportReport {
  created: number;
  updated: number;
  errors: { row: number; reason: string }[];
  rows: RowResult[];
}

const ACTION_LABELS: Record<RowResult["action"], string> = {
  create: "Création",
  update: "Mise à jour",
  error: "Erreur",
};

export default function ImportProductsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportReport | null>(null);
  const [finalReport, setFinalReport] = useState<ImportReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runImport(mode: "preview" | "commit") {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur lors du traitement du fichier.");
        return;
      }
      if (mode === "preview") setPreview(data as ImportReport);
      else setFinalReport(data as ImportReport);
    } catch {
      setError("Erreur réseau lors de l'envoi du fichier.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Link
        href="/admin/produits"
        className="flex items-center gap-1.5 text-xs font-semibold text-brand-green-dark hover:text-brand-green"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Retour aux produits
      </Link>

      <h1 className="mt-3 font-brand text-2xl font-bold text-brand-green-dark">
        Importer un fichier Excel
      </h1>
      <p className="mt-2 text-sm text-ink/60">
        Téléchargez d&rsquo;abord{" "}
        <a href="/api/admin/products/template" className="font-semibold text-brand-green underline">
          le modèle
        </a>{" "}
        si besoin, remplissez-le, puis déposez-le ci-dessous pour un aperçu
        avant validation.
      </p>

      {!finalReport && (
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-brand-green/20 px-6 py-10 text-center hover:border-brand-green/40">
            <UploadCloud className="h-8 w-8 text-brand-green/50" />
            <span className="text-sm font-semibold text-brand-green-dark">
              {file ? file.name : "Choisir un fichier .xlsx"}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setError(null);
              }}
            />
          </label>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={!file || loading}
              onClick={() => runImport("preview")}
              className="rounded-full bg-brand-green px-5 py-2.5 text-sm font-bold text-ivory hover:bg-brand-green-dark disabled:opacity-50"
            >
              {loading ? "Analyse…" : "Aperçu avant validation"}
            </button>
          </div>
        </div>
      )}

      {preview && !finalReport && (
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">
            Aperçu — {preview.rows.length} ligne{preview.rows.length > 1 ? "s" : ""}
          </h2>
          <p className="mt-1 text-xs text-ink/50">
            {preview.rows.filter((r) => r.action === "create").length} création(s) ·{" "}
            {preview.rows.filter((r) => r.action === "update").length} mise(s) à jour ·{" "}
            {preview.errors.length} erreur(s)
          </p>

          <div className="mt-4 max-h-96 overflow-auto rounded-xl border border-brand-green/10">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-ivory">
                <tr className="text-[10px] font-bold uppercase text-ink/50">
                  <th className="px-3 py-2">Ligne</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Nom</th>
                  <th className="px-3 py-2">Catégorie</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr
                    key={r.row}
                    className={
                      r.action === "error"
                        ? "bg-red-50 text-red-700"
                        : "border-t border-brand-green/5"
                    }
                  >
                    <td className="px-3 py-2">{r.row}</td>
                    <td className="px-3 py-2">{r.sku || "—"}</td>
                    <td className="px-3 py-2 font-semibold">{r.name || "—"}</td>
                    <td className="px-3 py-2">{r.categoryName || "—"}</td>
                    <td className="px-3 py-2">
                      {r.action === "error" ? r.reason : ACTION_LABELS[r.action]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="rounded-full border border-brand-green/20 px-5 py-2.5 text-sm font-bold text-brand-green-dark hover:bg-ivory"
            >
              Choisir un autre fichier
            </button>
            <button
              type="button"
              disabled={loading || preview.rows.every((r) => r.action === "error")}
              onClick={() => runImport("commit")}
              className="rounded-full bg-brand-gold px-6 py-2.5 text-sm font-bold text-brand-green-dark hover:bg-brand-gold-light disabled:opacity-50"
            >
              {loading
                ? "Import…"
                : `Confirmer l'import (${preview.rows.filter((r) => r.action !== "error").length} ligne${preview.rows.filter((r) => r.action !== "error").length > 1 ? "s" : ""})`}
            </button>
          </div>
        </div>
      )}

      {finalReport && (
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-brand-green-dark">
            <CheckCircle2 className="h-6 w-6 text-brand-green" />
            <h2 className="font-brand text-lg font-bold">Import terminé</h2>
          </div>
          <ul className="mt-4 space-y-1 text-sm text-ink/70">
            <li>{finalReport.created} produit(s) créé(s)</li>
            <li>{finalReport.updated} produit(s) mis à jour</li>
            <li>{finalReport.errors.length} ligne(s) en erreur</li>
          </ul>

          {finalReport.errors.length > 0 && (
            <div className="mt-4 rounded-xl bg-red-50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold text-red-700">
                <AlertTriangle className="h-3.5 w-3.5" /> Lignes ignorées
              </p>
              <ul className="mt-2 space-y-1 text-xs text-red-700">
                {finalReport.errors.map((e) => (
                  <li key={e.row}>
                    Ligne {e.row} : {e.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <Link
              href="/admin/produits"
              className="rounded-full bg-brand-green px-5 py-2.5 text-sm font-bold text-ivory hover:bg-brand-green-dark"
            >
              Voir les produits
            </Link>
            <button
              type="button"
              onClick={() => {
                setFinalReport(null);
                setPreview(null);
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="rounded-full border border-brand-green/20 px-5 py-2.5 text-sm font-bold text-brand-green-dark hover:bg-ivory"
            >
              Importer un autre fichier
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
