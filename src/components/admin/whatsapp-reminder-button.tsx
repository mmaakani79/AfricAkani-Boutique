"use client";

import { MessageCircle } from "lucide-react";
import { logWhatsappReminderAction } from "@/app/admin/(protected)/commandes/actions";

export function WhatsappReminderButton({
  orderId,
  href,
  className,
  label = "Relancer par WhatsApp",
}: {
  orderId: string;
  href: string;
  className?: string;
  label?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        // Fire-and-forget: keep a trace of the relaunch without blocking
        // the WhatsApp tab from opening.
        logWhatsappReminderAction(orderId).catch(() => {});
      }}
      className={className}
    >
      <MessageCircle className="h-3.5 w-3.5" /> {label}
    </a>
  );
}
