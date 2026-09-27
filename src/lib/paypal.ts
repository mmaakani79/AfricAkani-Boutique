/** PayPal Orders v2 REST client — card/PayPal-balance payments for the CA
 *  and US zones only, alongside Stripe (Bénin keeps Mobile Money + WhatsApp).
 *  No SDK dependency: PayPal's REST API is small enough to call with fetch. */

export type PaypalKeyMode = "live" | "sandbox" | "non_configuree";

export function isPaypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

/** PayPal client ids/secrets carry no "live_"/"sandbox_" prefix (unlike
 *  Stripe's keys), so the environment is picked explicitly via
 *  PAYPAL_ENV — defaults to "live" since that's what this project runs. */
export function getPaypalMode(): PaypalKeyMode {
  if (!isPaypalConfigured()) return "non_configuree";
  return process.env.PAYPAL_ENV === "sandbox" ? "sandbox" : "live";
}

export function isPaypalWebhookConfigured(): boolean {
  return Boolean(process.env.PAYPAL_WEBHOOK_ID);
}

function getBaseUrl(): string {
  return getPaypalMode() === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set.");
  }

  const res = await fetch(`${getBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`PayPal OAuth failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export interface PaypalOrderResult {
  id: string;
  approveUrl: string;
}

/** Creates a PayPal order (intent=CAPTURE) for the given amount and returns
 *  the id plus the hosted "approve" URL to redirect the customer to. Address
 *  and item detail are collected on our own checkout form, so PayPal's own
 *  shipping step is switched off (`shipping_preference: NO_SHIPPING`). */
export async function createPaypalOrder(params: {
  orderId: string;
  currency: string;
  amount: number;
  returnUrl: string;
  cancelUrl: string;
}): Promise<PaypalOrderResult> {
  const accessToken = await getAccessToken();

  const res = await fetch(`${getBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": params.orderId,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: params.orderId,
          custom_id: params.orderId,
          amount: {
            currency_code: params.currency.toUpperCase(),
            value: params.amount.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: "AfricAkani",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`PayPal create order failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    id: string;
    links: { rel: string; href: string }[];
  };
  const approveUrl = data.links.find((l) => l.rel === "approve")?.href;
  if (!approveUrl) {
    throw new Error("PayPal create order response had no 'approve' link.");
  }

  return { id: data.id, approveUrl };
}

export interface PaypalCaptureResult {
  ok: boolean;
  captureId: string | null;
  status: string;
}

/** Captures a previously approved PayPal order. Safe to call more than once
 *  for the same order id — PayPal returns the already-captured result
 *  instead of erroring, so the caller doesn't need to track capture state. */
export async function capturePaypalOrder(paypalOrderId: string): Promise<PaypalCaptureResult> {
  const accessToken = await getAccessToken();

  const res = await fetch(
    `${getBaseUrl()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = (await res.json()) as {
    status?: string;
    purchase_units?: {
      payments?: { captures?: { id: string; status: string }[] };
    }[];
    details?: { issue?: string }[];
  };

  // A retried capture on an already-completed order comes back as a 422
  // with issue "ORDER_ALREADY_CAPTURED" — not a failure from the customer's
  // point of view, since the money already moved on the first call.
  const alreadyCaptured = data.details?.some((d) => d.issue === "ORDER_ALREADY_CAPTURED");
  if (!res.ok && !alreadyCaptured) {
    throw new Error(`PayPal capture failed: ${res.status} ${JSON.stringify(data)}`);
  }

  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    ok: alreadyCaptured || data.status === "COMPLETED" || capture?.status === "COMPLETED",
    captureId: capture?.id ?? null,
    status: data.status ?? (alreadyCaptured ? "ALREADY_CAPTURED" : "UNKNOWN"),
  };
}

/** Verifies a PayPal webhook's signature via PayPal's own verification
 *  endpoint (PayPal has no HMAC-over-raw-body scheme like Stripe — the
 *  headers must be sent back to PayPal to be checked). */
export async function verifyPaypalWebhookSignature(params: {
  headers: Headers;
  body: unknown;
}): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;

  const accessToken = await getAccessToken();
  const res = await fetch(`${getBaseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: params.headers.get("paypal-auth-algo"),
      cert_url: params.headers.get("paypal-cert-url"),
      transmission_id: params.headers.get("paypal-transmission-id"),
      transmission_sig: params.headers.get("paypal-transmission-sig"),
      transmission_time: params.headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: params.body,
    }),
  });

  if (!res.ok) return false;
  const data = (await res.json()) as { verification_status?: string };
  return data.verification_status === "SUCCESS";
}
