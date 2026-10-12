// Envoi de commande sans doublon, et délai maximum d'attente. Lancer avec `npm test`.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSameOrderRequest,
  summaryFromStoredOrder,
  type OrderRequestLike,
  type StoredOrderLike,
} from "@/lib/order-replay";
import { TimeoutError, withTimeout } from "@/lib/with-timeout";

const stored: StoredOrderLike = {
  zoneId: "bj",
  customerName: "Awa Koné",
  customerEmail: "awa@example.com",
  customerPhone: "97000000",
  paymentMethod: null,
  mobileMoneyTransactionId: null,
  subtotal: 7800,
  shippingFee: 1500,
  freeShippingReached: false,
  items: [
    { productId: "p02", productName: "Beurre de karité", quantity: 2, unitPrice: 3000, lineTotal: 6000 },
    { productId: "p08", productName: "Bissap", quantity: 1, unitPrice: 1800, lineTotal: 1800 },
  ],
};

const request: OrderRequestLike = {
  zoneId: "bj",
  customer: { name: "Awa Koné", email: "awa@example.com", phone: "97000000" },
  wantsMobileMoney: false,
  mobileMoneyTransactionId: null,
  lines: [
    { productId: "p08", quantity: 1 },
    { productId: "p02", quantity: 2 },
  ],
};

describe("une même demande rejouée retrouve sa commande", () => {
  it("même client, même panier (ordre des lignes sans importance) : c'est la même demande", () => {
    assert.equal(isSameOrderRequest(stored, request), true);
  });

  it("un prix qui a changé entre-temps ne l'empêche pas : les prix ne sont pas comparés", () => {
    const cheaper = { ...stored, items: stored.items.map((i) => ({ ...i, unitPrice: 1, lineTotal: i.quantity })) };
    assert.equal(isSameOrderRequest(cheaper, request), true);
  });

  it("deux lignes du même produit valent une ligne de la somme", () => {
    const split = { ...request, lines: [{ productId: "p02", quantity: 1 }, { productId: "p02", quantity: 1 }, { productId: "p08", quantity: 1 }] };
    assert.equal(isSameOrderRequest(stored, split), true);
  });

  it("Mobile Money : même identifiant de transaction", () => {
    const mmStored = { ...stored, paymentMethod: "mobile_money", mobileMoneyTransactionId: "TX123" };
    const mmRequest = { ...request, wantsMobileMoney: true, mobileMoneyTransactionId: " TX123 " };
    assert.equal(isSameOrderRequest(mmStored, mmRequest), true);
    assert.equal(isSameOrderRequest(mmStored, { ...mmRequest, mobileMoneyTransactionId: "TX999" }), false);
  });
});

describe("un numéro de commande déjà pris par une autre demande est refusé", () => {
  it("autre client", () => {
    assert.equal(isSameOrderRequest(stored, { ...request, customer: { ...request.customer, email: "autre@example.com" } }), false);
    assert.equal(isSameOrderRequest(stored, { ...request, customer: { ...request.customer, phone: "99999999" } }), false);
    assert.equal(isSameOrderRequest(stored, { ...request, customer: { ...request.customer, name: "Autre" } }), false);
  });

  it("autre panier : produit, quantité, produit en plus ou en moins", () => {
    assert.equal(isSameOrderRequest(stored, { ...request, lines: [{ productId: "p02", quantity: 3 }, { productId: "p08", quantity: 1 }] }), false);
    assert.equal(isSameOrderRequest(stored, { ...request, lines: [{ productId: "p02", quantity: 2 }] }), false);
    assert.equal(isSameOrderRequest(stored, { ...request, lines: [...request.lines, { productId: "p99", quantity: 1 }] }), false);
  });

  it("autre zone, ou autre moyen de paiement (commande Stripe rejouée comme WhatsApp)", () => {
    assert.equal(isSameOrderRequest(stored, { ...request, zoneId: "ca" }), false);
    assert.equal(isSameOrderRequest({ ...stored, paymentMethod: "stripe" }, request), false);
    assert.equal(isSameOrderRequest(stored, { ...request, wantsMobileMoney: true, mobileMoneyTransactionId: "T" }), false);
  });
});

describe("la réponse rejouée reprend ce qui a été enregistré", () => {
  it("montants, lignes, sans référence interne", () => {
    const summary = summaryFromStoredOrder({
      ...stored,
      items: stored.items.map((i) => ({ ...i, productSku: "AK-SECRET" })) as StoredOrderLike["items"],
    });
    assert.equal(summary.subtotal, 7800);
    assert.equal(summary.shippingFee, 1500);
    assert.equal(summary.total, 9300);
    assert.equal(summary.items.length, 2);
    assert.ok(!JSON.stringify(summary).includes("AK-SECRET"));
  });
});

describe("délai maximum d'attente", () => {
  it("rend le résultat s'il arrive à temps", async () => {
    assert.equal(await withTimeout(Promise.resolve(42), 200), 42);
  });

  it("échoue avec TimeoutError si le serveur ne répond pas à temps", async () => {
    const never = new Promise<number>(() => {});
    await assert.rejects(withTimeout(never, 30), (e: unknown) => e instanceof TimeoutError);
  });

  it("transmet l'erreur réseau telle quelle", async () => {
    await assert.rejects(withTimeout(Promise.reject(new TypeError("Failed to fetch")), 200), /Failed to fetch/);
  });

  it("une réponse tardive après le délai est sans effet (pas de rejet non géré)", async () => {
    const late = new Promise<number>((resolve) => setTimeout(() => resolve(1), 60));
    await assert.rejects(withTimeout(late, 20), (e: unknown) => e instanceof TimeoutError);
    await new Promise((r) => setTimeout(r, 100));
  });
});
