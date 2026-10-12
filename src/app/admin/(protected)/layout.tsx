import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Package,
  Mail,
  LogOut,
  ClipboardList,
  Settings,
  KeyRound,
  Star,
  FileSignature,
  Tags,
  PackageOpen,
} from "lucide-react";
import { logoutAction } from "../actions";
import { getShopStatus } from "@/lib/site-settings-db";
import { PreviewBanner } from "@/components/admin/preview-banner";

// Reads the live shop status from the database on every request — without
// this the layout could be prerendered at build time with a stale value.
export const dynamic = "force-dynamic";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shopClosed = await getShopStatus()
    .then((s) => s.closed)
    .catch(() => null);

  return (
    <div className="min-h-screen bg-ivory">
      <PreviewBanner />
      <header className="border-b border-brand-green/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Image
              src="/logo/medallion.png"
              alt="AfricAkani"
              width={36}
              height={36}
              className="h-9 w-9 rounded-full"
            />
            <span className="hidden whitespace-nowrap font-brand text-lg font-bold text-brand-green-dark sm:inline">
              Admin AfricAkani
            </span>
          </div>
          <div className="flex items-center gap-2">
            {shopClosed !== null && (
              <Link
                href="/admin"
                data-testid="shop-status-chip"
                className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${
                  shopClosed
                    ? "bg-red-600 text-white"
                    : "bg-brand-green/10 text-brand-green-dark"
                }`}
              >
                {shopClosed ? "Boutique fermée" : "Boutique ouverte"}
              </Link>
            )}
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-full border border-brand-green/20 px-3 py-1.5 text-xs font-semibold text-brand-green-dark hover:bg-ivory"
              >
                <LogOut className="h-3.5 w-3.5" /> Déconnexion
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4 pb-2 text-sm font-semibold">
          <Link
            href="/admin"
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-brand-green-dark hover:bg-ivory"
          >
            <LayoutDashboard className="h-4 w-4" /> Tableau de bord
          </Link>
          <Link
            href="/admin/produits"
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-brand-green-dark hover:bg-ivory"
          >
            <Package className="h-4 w-4" /> Produits
          </Link>
          <Link
            href="/admin/categories"
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-brand-green-dark hover:bg-ivory"
          >
            <Tags className="h-4 w-4" /> Catégories
          </Link>
          <Link
            href="/admin/emballages"
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-brand-green-dark hover:bg-ivory"
          >
            <PackageOpen className="h-4 w-4" /> Emballages
          </Link>
          <Link
            href="/admin/commandes"
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-brand-green-dark hover:bg-ivory"
          >
            <ClipboardList className="h-4 w-4" /> Commandes
          </Link>
          <Link
            href="/admin/demandes"
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-brand-green-dark hover:bg-ivory"
          >
            <Mail className="h-4 w-4" /> Demandes produits
          </Link>
          <Link
            href="/admin/avis"
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-brand-green-dark hover:bg-ivory"
          >
            <Star className="h-4 w-4" /> Avis
          </Link>
          <Link
            href="/admin/contrats"
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-brand-green-dark hover:bg-ivory"
          >
            <FileSignature className="h-4 w-4" /> Contrats signés
          </Link>
          <Link
            href="/admin/reglages"
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-brand-green-dark hover:bg-ivory"
          >
            <Settings className="h-4 w-4" /> Réglages
          </Link>
          <Link
            href="/admin/mot-de-passe"
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-brand-green-dark hover:bg-ivory"
          >
            <KeyRound className="h-4 w-4" /> Mot de passe
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
