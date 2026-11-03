import { NextResponse } from "next/server";
import { getClientShopByPublicKey } from "@/lib/client-shops-db";
import { deriveShopKey, signShopStatus, toApiStatus } from "@/lib/shop-status";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

/**
 * The status of one client shop, read by that shop. Read-only, signed with a key only AfricAkani and
 * that shop know: a forged answer cannot close a shop, and an unknown address answers 404 for everyone.
 * Nothing but the status is revealed (no name, no reason).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const shop = await getClientShopByPublicKey(key);
  if (!shop) return NextResponse.json({ error: "not_found" }, { status: 404, headers: HEADERS });

  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    // Cannot sign: the shop treats this like an unreachable AfricAkani, and stays open.
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: HEADERS });
  }
  const answer = signShopStatus(
    deriveShopKey(secret, shop.publicKey),
    shop.publicKey,
    toApiStatus(shop.status),
    Math.floor(Date.now() / 1000)
  );
  return NextResponse.json(answer, { headers: HEADERS });
}
