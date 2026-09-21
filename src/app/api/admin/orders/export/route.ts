import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { isAdminAuthed } from "@/lib/admin-api-auth";
import { getAllOrders, type OrderStatus, type PaymentStatus } from "@/lib/orders-db";
import { ZONES } from "@/data/zones";
import type { ZoneId } from "@/lib/types";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/order-labels";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orders = await getAllOrders({
    status: (searchParams.get("status") || undefined) as OrderStatus | undefined,
    paymentStatus: (searchParams.get("paymentStatus") || undefined) as
      | PaymentStatus
      | undefined,
    zoneId: (searchParams.get("zone") || undefined) as ZoneId | undefined,
    dateFrom: searchParams.get("from") || undefined,
    dateTo: searchParams.get("to") || undefined,
    search: searchParams.get("q") || undefined,
    includeTest: true,
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Commandes");
  sheet.columns = [
    { header: "Numéro", key: "id", width: 16 },
    { header: "Date", key: "date", width: 18 },
    { header: "Zone", key: "zone", width: 14 },
    { header: "Client", key: "client", width: 24 },
    { header: "Téléphone", key: "phone", width: 16 },
    { header: "Total", key: "total", width: 14 },
    { header: "Paiement", key: "payment", width: 14 },
    { header: "Statut", key: "status", width: 16 },
    { header: "Test", key: "test", width: 8 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const order of orders) {
    sheet.addRow({
      id: order.id,
      date: new Date(order.createdAt).toLocaleString("fr-FR"),
      zone: ZONES[order.zoneId].shortLabel,
      client: order.customerName,
      phone: order.customerPhone,
      total: order.subtotal,
      payment: PAYMENT_STATUS_LABELS[order.paymentStatus],
      status: ORDER_STATUS_LABELS[order.status],
      test: order.isTest ? "oui" : "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="commandes-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx"`,
    },
  });
}
