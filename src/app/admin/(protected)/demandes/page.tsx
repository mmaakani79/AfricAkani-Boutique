import type { Metadata } from "next";
import { Mail, MailCheck, MailWarning, Phone } from "lucide-react";
import { getAllProductRequests } from "@/lib/product-requests-db";

export const metadata: Metadata = {
  title: "Demandes produits — Admin AfricAkani",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProductRequestsPage() {
  const requests = await getAllProductRequests();

  return (
    <div>
      <h1 className="font-brand text-2xl font-bold text-brand-green-dark">
        Demandes produits ({requests.length})
      </h1>
      <p className="mt-1 text-sm text-ink/60">
        Envoyées via « Vous ne trouvez pas un produit ? » dans le pied de
        page du site.
      </p>

      {requests.length === 0 ? (
        <p className="mt-8 rounded-2xl bg-white p-6 text-center text-sm text-ink/50">
          Aucune demande pour le moment.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {requests.map((r) => (
            <li key={r.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-brand-green" />
                  <span className="font-semibold text-brand-green-dark">
                    {r.productName}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {r.emailSent ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-brand-green">
                      <MailCheck className="h-3.5 w-3.5" /> Email envoyé
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                      <MailWarning className="h-3.5 w-3.5" /> Email non envoyé
                    </span>
                  )}
                  <span className="text-xs text-ink/50">
                    {new Date(r.createdAt).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              {r.description && (
                <p className="mt-2 text-sm text-ink/70">{r.description}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <a
                  href={`https://wa.me/${r.phone.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 font-semibold text-brand-green hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" /> {r.phone}
                </a>
                {r.email && (
                  <a
                    href={`mailto:${r.email}`}
                    className="flex items-center gap-1.5 font-semibold text-brand-green hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5" /> {r.email}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
