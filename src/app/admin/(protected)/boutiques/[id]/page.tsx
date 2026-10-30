import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getClientShop, getClientShopEvents } from "@/lib/client-shops-db";
import { getServiceAccountFull } from "@/lib/service-accounts-db";
import { ACCOUNT_STATUS_LABELS, todayInBenin } from "@/lib/service-account-math";
import { SHOP_STATUS_LABELS } from "@/lib/shop-status";
import { dateTimeFr } from "@/lib/service-format";
import { DeleteForm, ShopKeyBox, StatusButton, SuspendForm } from "@/components/admin/shop-controls";
import {
  markShopDeletedAction,
  markShopLateAction,
  reactivateShopAction,
  revealShopKeyAction,
  suspendShopAction,
} from "../actions";
import { SHOP_STATUS_STYLE } from "@/components/admin/shop-status-style";

export const metadata: Metadata = {
  title: "Boutique cliente — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shop = await getClientShop(id);
  if (!shop) notFound();
  const [events, dossier] = await Promise.all([
    getClientShopEvents(id),
    shop.accountId ? getServiceAccountFull(shop.accountId) : Promise.resolve(null),
  ]);
  const today = todayInBenin();
  const canDelete = shop.status === "suspendu" && !!shop.deleteAfter && today >= shop.deleteAfter;

  return (
    <div data-testid="shop-detail" data-shop={shop.id}>
      <Link href="/admin/boutiques" className="text-xs font-semibold text-brand-green-dark hover:underline">
        ← Boutiques clientes
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-brand text-2xl font-bold text-brand-green-dark [overflow-wrap:anywhere]">{shop.name}</h1>
          <p className="text-xs text-ink/50 [overflow-wrap:anywhere]">
            {shop.id}
            {shop.domain ? ` · ${shop.domain}` : ""} · ajoutée le {dateTimeFr(shop.createdAt)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${SHOP_STATUS_STYLE[shop.status]}`} data-testid="detail-shop-status">
          {SHOP_STATUS_LABELS[shop.status]}
        </span>
      </div>

      {dossier && (
        <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-ink/80" data-testid="linked-account">
          Dossier de paiement :{" "}
          <Link href={`/admin/services/${dossier.account.id}`} className="font-bold text-brand-green-dark hover:underline">
            {dossier.account.merchantName}
          </Link>{" "}
          — {ACCOUNT_STATUS_LABELS[dossier.state.status]}.
          {dossier.state.status === "en_retard" && (
            <span className="mt-1 block text-xs font-semibold text-amber-800">
              Le paiement est en retard. La boutique n&rsquo;est jamais suspendue automatiquement : c&rsquo;est à vous de décider.
            </span>
          )}
        </p>
      )}

      <section className="mt-6 rounded-2xl bg-white p-5" data-testid="shop-state-section">
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">État de la boutique</h2>
        {shop.status === "actif" && (
          <div className="mt-3 space-y-4">
            <p className="text-sm text-ink/80">La boutique est ouverte au public.</p>
            <StatusButton action={markShopLateAction.bind(null, shop.id, true)} label="Marquer « en retard » (reste ouverte)" testId="mark-late" tone="plain" />
            <SuspendForm action={suspendShopAction.bind(null, shop.id)} />
          </div>
        )}
        {shop.status === "en_retard" && (
          <div className="mt-3 space-y-4">
            <p className="text-sm text-ink/80">Marquée « en retard » : la boutique reste ouverte au public.</p>
            <StatusButton action={markShopLateAction.bind(null, shop.id, false)} label="Revenir à « actif »" testId="mark-active" tone="plain" />
            <SuspendForm action={suspendShopAction.bind(null, shop.id)} />
          </div>
        )}
        {shop.status === "suspendu" && (
          <div className="mt-3 space-y-4">
            <p className="text-sm font-semibold text-red-700" data-testid="suspended-note">
              Suspendue depuis le {shop.suspendedAt ? dateTimeFr(shop.suspendedAt) : "—"}. Motif : {shop.statusReason}
            </p>
            <p className="text-xs text-ink/60" data-testid="retention-note">
              Données conservées jusqu&rsquo;au {shop.deleteAfter} (6 mois). Avant cette date, la boutique ne peut pas être
              marquée « supprimée ».
            </p>
            <StatusButton action={reactivateShopAction.bind(null, shop.id)} label="Réactiver la boutique" testId="reactivate" />
            {canDelete && <DeleteForm action={markShopDeletedAction.bind(null, shop.id)} />}
          </div>
        )}
        {shop.status === "supprime" && (
          <p className="mt-3 text-sm text-ink/80" data-testid="deleted-note">
            Boutique marquée « supprimée » ({shop.statusReason || "sans motif"}). Plus aucun changement n&rsquo;est possible.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-2xl bg-white p-5" data-testid="shop-check-section">
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">Vérification par la boutique cliente</h2>
        <p className="mb-3 mt-2 text-xs text-ink/60">
          La boutique cliente interroge cette adresse. Si AfricAkani ne répond pas, elle reste ouverte. La réponse est signée :
          personne ne peut fermer une boutique en falsifiant une réponse.
        </p>
        <ShopKeyBox reveal={revealShopKeyAction.bind(null, shop.id)} />
      </section>

      <section className="mt-6 rounded-2xl bg-white p-5" data-testid="shop-journal-section">
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-gold">Journal</h2>
        <ul className="mt-3 space-y-2 text-xs text-ink/70" data-testid="shop-journal">
          {events.map((e) => (
            <li key={e.id}>
              <span className="font-semibold text-ink/50">{dateTimeFr(e.createdAt)}</span> —{" "}
              <span className="font-semibold">
                {e.fromStatus ? `${SHOP_STATUS_LABELS[e.fromStatus]} → ` : ""}
                {e.toStatus ? SHOP_STATUS_LABELS[e.toStatus] : ""}
              </span>
              {e.reason ? ` : ${e.reason}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
