import { Truck } from "lucide-react";
import { Container } from "./container";

export function ShippingBanner() {
  return (
    <div className="bg-brand-green-dark text-white">
      <Container className="flex items-center justify-center gap-2 py-2 text-center text-xs font-semibold sm:text-sm">
        <Truck className="h-4 w-4 shrink-0 text-[#FFD700]" aria-hidden />
        <span>
          Livraison offerte partout dans le monde dès 50 CAD / 55 USD /
          25&nbsp;000 FCFA d&rsquo;achat !
        </span>
      </Container>
    </div>
  );
}
