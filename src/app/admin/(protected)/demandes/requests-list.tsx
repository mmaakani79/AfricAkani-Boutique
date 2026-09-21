"use client";

import { useState, useTransition } from "react";
import {
  Mail,
  MailCheck,
  MailWarning,
  Phone,
  Trash2,
  Check,
  Undo2,
  Send,
} from "lucide-react";
import type { ProductRequest } from "@/lib/product-requests-db";
import {
  deleteRequestAction,
  deleteRequestsAction,
  resendNotificationAction,
  toggleHandledAction,
  type ResendResult,
} from "./actions";

export function RequestsList({ requests }: { requests: ProductRequest[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, startBulkDelete] = useTransition();

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === requests.length
        ? new Set()
        : new Set(requests.map((r) => r.id))
    );
  }

  return (
    <div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-ink/60">
          <input
            type="checkbox"
            checked={requests.length > 0 && selected.size === requests.length}
            onChange={toggleSelectAll}
            className="h-3.5 w-3.5"
          />
          Tout sélectionner
        </label>
        {selected.size > 0 && (
          <button
            type="button"
            disabled={bulkDeleting}
            onClick={() => {
              if (
                window.confirm(
                  `Supprimer définitivement ${selected.size} demande${
                    selected.size > 1 ? "s" : ""
                  } ? Cette action est irréversible.`
                )
              ) {
                startBulkDelete(async () => {
                  await deleteRequestsAction(Array.from(selected));
                  setSelected(new Set());
                });
              }
            }}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />{" "}
            {bulkDeleting
              ? "Suppression…"
              : `Supprimer la sélection (${selected.size})`}
          </button>
        )}
      </div>

      <ul className="mt-3 space-y-3">
        {requests.map((r) => (
          <RequestRow
            key={r.id}
            request={r}
            selected={selected.has(r.id)}
            onToggleSelect={() => toggleSelect(r.id)}
          />
        ))}
      </ul>
    </div>
  );
}

function RequestRow({
  request,
  selected,
  onToggleSelect,
}: {
  request: ProductRequest;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const [togglePending, startToggle] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [resendPending, startResend] = useTransition();
  const [resendResult, setResendResult] = useState<ResendResult | null>(null);

  return (
    <li className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-1 h-3.5 w-3.5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-brand-green" />
              <span className="font-semibold text-brand-green-dark">
                {request.productName}
              </span>
              {request.handled && (
                <span className="rounded-full bg-brand-green px-2.5 py-0.5 text-[11px] font-bold text-white">
                  Traitée
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {request.emailSent ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-brand-green">
                  <MailCheck className="h-3.5 w-3.5" /> Email envoyé
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                  <MailWarning className="h-3.5 w-3.5" /> Email non envoyé
                </span>
              )}
              <span className="text-xs text-ink/50">
                {new Date(request.createdAt).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          {request.description && (
            <p className="mt-2 text-sm text-ink/70">{request.description}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <a
              href={`https://wa.me/${request.phone.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 font-semibold text-brand-green hover:underline"
            >
              <Phone className="h-3.5 w-3.5" /> {request.phone}
            </a>
            {request.email && (
              <a
                href={`mailto:${request.email}`}
                className="flex items-center gap-1.5 font-semibold text-brand-green hover:underline"
              >
                <Mail className="h-3.5 w-3.5" /> {request.email}
              </a>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={togglePending}
              onClick={() =>
                startToggle(() =>
                  toggleHandledAction(request.id, !request.handled)
                )
              }
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-brand-green/20 px-3.5 py-1.5 text-xs font-bold text-brand-green-dark hover:bg-ivory disabled:opacity-60"
            >
              {request.handled ? (
                <Undo2 className="h-3.5 w-3.5" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {request.handled ? "Marquer non traitée" : "Marquer comme traitée"}
            </button>
            <button
              type="button"
              disabled={resendPending}
              onClick={() => {
                setResendResult(null);
                startResend(async () => {
                  setResendResult(await resendNotificationAction(request.id));
                });
              }}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-brand-green/20 px-3.5 py-1.5 text-xs font-bold text-brand-green-dark hover:bg-ivory disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />{" "}
              {resendPending ? "Envoi…" : "Renvoyer la notification"}
            </button>
            <button
              type="button"
              disabled={deletePending}
              onClick={() => {
                if (
                  window.confirm(
                    `Supprimer définitivement la demande « ${request.productName} » ? Cette action est irréversible.`
                  )
                ) {
                  startDelete(() => deleteRequestAction(request.id));
                }
              }}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-red-200 px-3.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" /> Supprimer
            </button>
            {resendResult && (
              <span
                className={`text-xs font-semibold ${resendResult.ok ? "text-brand-green-dark" : "text-red-600"}`}
              >
                {resendResult.ok ? "✓ " : "✗ "}
                {resendResult.detail}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
