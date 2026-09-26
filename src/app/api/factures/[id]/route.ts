import { NextRequest, NextResponse } from "next/server";
import { getOrderForTracking } from "@/lib/orders-db";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

export const dynamic = "force-dynamic";

/** Public invoice download: requires the order id AND a matching e-mail or
 *  phone, same verification as /suivi — never leaks whether an id exists. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const contact = request.nextUrl.searchParams.get("contact") ?? "";

  const order = await getOrderForTracking(id, contact);
  if (!order) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }

  const pdf = await generateInvoicePdf(order);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="facture-${order.id}.pdf"`,
    },
  });
}
