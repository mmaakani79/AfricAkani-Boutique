import { NextRequest, NextResponse } from "next/server";
import {
  cancelExpiredOrders,
  getOrdersDueForReminder,
  markReminderColumnSent,
  recordReminder,
} from "@/lib/orders-db";
import {
  sendCustomerOrderCancelled,
  sendCustomerPaymentReminder,
} from "@/lib/email";
import { getPaymentTimeoutHours } from "@/lib/order-config";

export const dynamic = "force-dynamic";

/**
 * Scheduled by vercel.json (see repo root). Vercel automatically sends
 * `Authorization: Bearer ${CRON_SECRET}` when invoking a configured cron —
 * see the "CRON_SECRET" note in the project README / final report for
 * setup instructions.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500 }
    );
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const timeoutHours = getPaymentTimeoutHours();

  const due24h = await getOrdersDueForReminder(24, "reminder_24h_sent_at");
  let remind24 = 0;
  for (const order of due24h) {
    try {
      await sendCustomerPaymentReminder(order, 1);
    } catch {
      // Still mark as attempted so we don't retry-storm a broken address;
      // the order stays visible in /admin/commandes either way.
    }
    await markReminderColumnSent(order.id, "reminder_24h_sent_at");
    await recordReminder(order.id, "email", "reminder_24h");
    remind24++;
  }

  const due48h = await getOrdersDueForReminder(48, "reminder_48h_sent_at");
  let remind48 = 0;
  for (const order of due48h) {
    try {
      await sendCustomerPaymentReminder(order, 2);
    } catch {
      /* see note above */
    }
    await markReminderColumnSent(order.id, "reminder_48h_sent_at");
    await recordReminder(order.id, "email", "reminder_48h");
    remind48++;
  }

  const cancelled = await cancelExpiredOrders(timeoutHours);
  for (const order of cancelled) {
    try {
      await sendCustomerOrderCancelled(order);
    } catch {
      /* order is already cancelled either way */
    }
    await recordReminder(order.id, "email", "cancellation");
  }

  return NextResponse.json({
    remind24Sent: remind24,
    remind48Sent: remind48,
    cancelled: cancelled.length,
    timeoutHours,
  });
}
