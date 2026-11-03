"use client";

import { useState, useTransition } from "react";
import { Copy, Eye, Power } from "lucide-react";
import { useKeptFormAction } from "@/components/use-kept-form-action";
import { safely } from "@/components/admin/safe-action";
import type { ShopActionState, ShopKeyState } from "@/app/admin/(protected)/boutiques/actions";

const INPUT =
  "w-full rounded-lg border border-brand-green/20 bg-ivory px-3 py-2 text-sm outline-none focus:border-brand-green";
const LABEL = "mb-1 block text-[11px] font-semibold text-ink/60";
const PRIMARY =
  "flex min-h-10 items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-xs font-bold text-ivory hover:bg-brand-green-dark disabled:opacity-60";

type Action = (previous: ShopActionState, formData: FormData) => Promise<ShopActionState>;

function Result({ state }: { state: ShopActionState }) {
  if (state.error) return <p role="alert" className="text-xs font-semibold text-red-600">{state.error}</p>;
  if (state.ok && state.message) return <p role="status" className="text-xs font-semibold text-brand-green-dark">✓ {state.message}</p>;
  return null;
}

export function CreateShopForm({ action, accounts }: { action: Action; accounts: { id: string; label: string }[] }) {
  const { state, formAction, pending, onReset } = useKeptFormAction<ShopActionState>(action, {});
  return (
    <form action={formAction} onReset={onReset} className="grid gap-3 sm:grid-cols-2" data-testid="create-shop-form">
      <label className="block">
        <span className={LABEL}>Nom de la boutique cliente</span>
        <input name="name" type="text" required maxLength={120} className={INPUT} />
      </label>
      <label className="block">
        <span className={LABEL}>Nom de domaine (facultatif)</span>
        <input name="domain" type="text" maxLength={120} placeholder="boutique-djougou.com" className={INPUT} />
      </label>
      <label className="block sm:col-span-2">
        <span className={LABEL}>Dossier de paiement lié (facultatif)</span>
        <select name="accountId" defaultValue="" className={INPUT}>
          <option value="">— Aucun —</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className={LABEL}>Note interne</span>
        <input name="note" type="text" maxLength={500} className={INPUT} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={PRIMARY}>{pending ? "Ajout…" : "Ajouter la boutique"}</button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function SuspendForm({ action }: { action: Action }) {
  const { state, formAction, pending, onReset } = useKeptFormAction<ShopActionState>(action, {});
  return (
    <form action={formAction} onReset={onReset} className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4" data-testid="suspend-form">
      <p className="text-sm font-bold text-red-800">Suspendre la boutique</p>
      <p className="text-xs text-red-900/80">
        La boutique affichera aussitôt (dans les minutes qui suivent) une page neutre « temporairement indisponible ». Le
        motif est gardé dans le journal ; le client ne le voit pas. Les données sont conservées 6 mois.
      </p>
      <label className="block">
        <span className={LABEL}>Motif (obligatoire)</span>
        <input name="reason" type="text" required maxLength={300} className={INPUT} />
      </label>
      <label className="flex items-center gap-2 text-xs text-ink/80">
        <input type="checkbox" name="confirm" value="yes" className="h-4 w-4" data-testid="suspend-confirm" />
        Je confirme la suspension de cette boutique
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="flex min-h-10 items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60">
          <Power className="h-3.5 w-3.5" /> {pending ? "Suspension…" : "Suspendre la boutique"}
        </button>
        <Result state={state} />
      </div>
    </form>
  );
}

/** A one-click status button (reactivate, mark late, back to active). */
export function StatusButton({
  action,
  label,
  testId,
  tone = "primary",
}: {
  action: () => Promise<ShopActionState>;
  label: string;
  testId: string;
  tone?: "primary" | "plain";
}) {
  const [state, setState] = useState<ShopActionState>({});
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={pending}
        data-testid={testId}
        onClick={() => startTransition(async () => setState(await safely(action)))}
        className={
          tone === "primary"
            ? PRIMARY
            : "min-h-10 rounded-full border border-brand-green/30 bg-white px-4 py-2 text-xs font-bold text-brand-green-dark hover:bg-ivory disabled:opacity-60"
        }
      >
        {pending ? "…" : label}
      </button>
      <Result state={state} />
    </div>
  );
}

export function DeleteForm({ action }: { action: Action }) {
  const { state, formAction, pending, onReset } = useKeptFormAction<ShopActionState>(action, {});
  return (
    <form action={formAction} onReset={onReset} className="space-y-3 rounded-xl border border-ink/20 bg-ivory p-4" data-testid="delete-form">
      <p className="text-sm font-bold text-ink">Marquer la boutique comme supprimée</p>
      <label className="block">
        <span className={LABEL}>Motif</span>
        <input name="reason" type="text" required maxLength={300} className={INPUT} />
      </label>
      <label className="flex items-center gap-2 text-xs text-ink/80">
        <input type="checkbox" name="confirm" value="yes" className="h-4 w-4" />
        Je confirme : ce choix est définitif
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={PRIMARY}>{pending ? "…" : "Marquer comme supprimée"}</button>
        <Result state={state} />
      </div>
    </form>
  );
}

/** The address and the signing key of one shop: the key appears only after a click, for the admin. */
export function ShopKeyBox({ reveal }: { reveal: () => Promise<ShopKeyState> }) {
  const [state, setState] = useState<ShopKeyState>({});
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2" data-testid="shop-key-box">
      {!state.key ? (
        <button
          type="button"
          disabled={pending}
          data-testid="reveal-key"
          onClick={() => startTransition(async () => setState(await safely(reveal)))}
          className="flex min-h-10 items-center gap-1.5 rounded-full border border-brand-green/30 bg-white px-4 py-2 text-xs font-bold text-brand-green-dark hover:bg-ivory disabled:opacity-60"
        >
          <Eye className="h-3.5 w-3.5" /> {pending ? "…" : "Afficher l'adresse et la clé de vérification"}
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-brand-gold/40 bg-brand-gold/10 p-3">
          <p className="text-xs text-ink/70">À mettre dans la configuration de la boutique cliente (jamais dans un message ni une capture).</p>
          <label className="block">
            <span className={LABEL}>Adresse du statut</span>
            <input readOnly value={state.address} data-testid="shop-address" className="w-full rounded-lg border border-brand-green/20 bg-white px-3 py-2 font-mono text-xs" />
          </label>
          <label className="block">
            <span className={LABEL}>Clé de vérification (secrète)</span>
            <input readOnly value={state.key} data-testid="shop-key" onFocus={(e) => e.currentTarget.select()} className="w-full rounded-lg border border-brand-green/20 bg-white px-3 py-2 font-mono text-xs" />
          </label>
          <button
            type="button"
            className={PRIMARY}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(state.key ?? "");
                setCopied(true);
              } catch {
                /* the field can be selected by hand */
              }
            }}
          >
            <Copy className="h-3.5 w-3.5" /> {copied ? "Copiée ✓" : "Copier la clé"}
          </button>
        </div>
      )}
      {state.error && <p role="alert" className="text-xs font-semibold text-red-600">{state.error}</p>}
    </div>
  );
}
