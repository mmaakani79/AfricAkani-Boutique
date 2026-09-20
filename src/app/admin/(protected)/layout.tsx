import Link from "next/link";
import Image from "next/image";
import { LayoutDashboard, Package, Mail, LogOut } from "lucide-react";
import { logoutAction } from "../actions";

export default function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ivory">
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
            <span className="font-brand text-lg font-bold text-brand-green-dark">
              Admin AfricAkani
            </span>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-full border border-brand-green/20 px-3 py-1.5 text-xs font-semibold text-brand-green-dark hover:bg-ivory"
            >
              <LogOut className="h-3.5 w-3.5" /> Déconnexion
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4 pb-2 text-sm font-semibold">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-brand-green-dark hover:bg-ivory"
          >
            <LayoutDashboard className="h-4 w-4" /> Tableau de bord
          </Link>
          <Link
            href="/admin/produits"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-brand-green-dark hover:bg-ivory"
          >
            <Package className="h-4 w-4" /> Produits
          </Link>
          <Link
            href="/admin/demandes"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-brand-green-dark hover:bg-ivory"
          >
            <Mail className="h-4 w-4" /> Demandes produits
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
