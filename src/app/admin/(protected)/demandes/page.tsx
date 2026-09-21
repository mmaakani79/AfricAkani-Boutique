import type { Metadata } from "next";
import { getAllProductRequests } from "@/lib/product-requests-db";
import { RequestsList } from "./requests-list";

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
        <RequestsList requests={requests} />
      )}
    </div>
  );
}
