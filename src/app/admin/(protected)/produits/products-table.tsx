"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import type { Category, Product } from "@/lib/types";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { PhotoPlaceholder } from "@/components/shop/photo-placeholder";
import { formatPrice } from "@/data/zones";
import { deleteProductAction, reorderProductsAction } from "../../actions";

const SCROLL_EDGE_PX = 40;
const SCROLL_STEP_PX = 14;

interface RowSlot {
  id: string;
  top: number; // document coordinates at the moment the drag started
  height: number;
}

interface DragState {
  id: string;
  from: number;
  over: number;
  dy: number;
  /** Height of the dragged row: how far the rows it passes are shifted. */
  shift: number;
}

function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function ProductsTable({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const [items, setItems] = useState(products);
  // Re-sync when the server sends a fresh list (after a delete or an edit),
  // otherwise a removed product would stay on screen and be re-sent on reorder.
  const [seenProducts, setSeenProducts] = useState(products);
  if (products !== seenProducts) {
    setSeenProducts(products);
    setItems(products);
  }

  const [drag, setDrag] = useState<DragState | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const slotsRef = useRef<RowSlot[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const startYRef = useRef(0);
  const startScrollRef = useRef(0);
  const lastYRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Pointer events (not native HTML5 drag-and-drop, which phones don't fire)
  // so the same handle works with a mouse and a finger. While dragging, no row
  // is moved in the page (a moved element would lose the pointer): rows are
  // only shifted visually, and the new order is applied once the pointer is
  // released.
  function updateDrag() {
    const current = dragRef.current;
    if (!current) return;
    const slots = slotsRef.current;
    const dy = lastYRef.current - startYRef.current + (window.scrollY - startScrollRef.current);
    const source = slots[current.from];
    const centerY = source.top + source.height / 2 + dy;
    let over = slots.findIndex((s) => centerY >= s.top && centerY < s.top + s.height);
    if (over === -1) over = centerY < slots[0].top ? 0 : slots.length - 1;
    const next = { ...current, dy, over };
    dragRef.current = next;
    setDrag(next);
  }

  // Keeps scrolling while the pointer rests near the top or bottom of the
  // screen, so a product can be carried across a list longer than the screen.
  function autoScrollLoop() {
    const y = lastYRef.current;
    // The site header is sticky and covers the top of the list, so the upper
    // scroll zone starts just below it rather than at the screen edge.
    const stickyBottom = document.querySelector("header.sticky")?.getBoundingClientRect().bottom ?? 0;
    if (y < stickyBottom + SCROLL_EDGE_PX) {
      window.scrollBy(0, -SCROLL_STEP_PX);
      updateDrag();
    } else if (y > window.innerHeight - SCROLL_EDGE_PX * 1.5) {
      window.scrollBy(0, SCROLL_STEP_PX);
      updateDrag();
    }
    rafRef.current = requestAnimationFrame(autoScrollLoop);
  }

  function stopAutoScroll() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  useEffect(() => stopAutoScroll, []);

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (pending || dragRef.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const scrollY = window.scrollY;
    slotsRef.current = items.map((p) => {
      const rect = rowRefs.current.get(p.id)!.getBoundingClientRect();
      return { id: p.id, top: rect.top + scrollY, height: rect.height };
    });
    const from = items.findIndex((p) => p.id === id);
    startYRef.current = e.clientY;
    lastYRef.current = e.clientY;
    startScrollRef.current = scrollY;
    const initial = { id, from, over: from, dy: 0, shift: slotsRef.current[from].height };
    dragRef.current = initial;
    setDrag(initial);
    setError(null);
    setSaved(false);
    stopAutoScroll();
    rafRef.current = requestAnimationFrame(autoScrollLoop);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragRef.current) return;
    lastYRef.current = e.clientY;
    updateDrag();
  }

  function endDrag(e: React.PointerEvent<HTMLButtonElement>, cancelled: boolean) {
    const finished = dragRef.current;
    if (!finished) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    stopAutoScroll();
    dragRef.current = null;
    setDrag(null);
    if (cancelled || finished.over === finished.from) return;

    const before = items;
    const after = moveItem(items, finished.from, finished.over);
    setItems(after);

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setItems(before);
      setError("Vous êtes hors ligne — l'ordre n'a pas été enregistré. L'ancien ordre est rétabli.");
      return;
    }
    const orderedIds = after.map((p) => p.id);
    startTransition(async () => {
      try {
        const result = await reorderProductsAction(orderedIds);
        if (result?.error) {
          setItems(before);
          setError(`${result.error} L'ancien ordre est rétabli.`);
          return;
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch {
        setItems(before);
        setError(
          "Connexion perdue ou session expirée — l'ordre n'a pas été enregistré. L'ancien ordre est rétabli."
        );
      }
    });
  }

  function rowStyle(index: number): React.CSSProperties | undefined {
    if (!drag) return undefined;
    if (index === drag.from) {
      return { transform: `translateY(${drag.dy}px)`, position: "relative", zIndex: 10 };
    }
    const shift = drag.shift;
    if (drag.from < drag.over && index > drag.from && index <= drag.over) {
      return { transform: `translateY(${-shift}px)` };
    }
    if (drag.from > drag.over && index < drag.from && index >= drag.over) {
      return { transform: `translateY(${shift}px)` };
    }
    return undefined;
  }

  return (
    <div>
      <div
        role="status"
        aria-live="polite"
        className="mb-2 flex min-h-[20px] items-center gap-2 text-xs font-semibold"
      >
        {pending && <span className="text-ink/50">Enregistrement de l&rsquo;ordre…</span>}
        {!pending && saved && <span className="text-brand-green-dark">Ordre enregistré ✓</span>}
        {!pending && error && <span className="text-red-600">{error}</span>}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className={`w-full text-left text-sm ${drag ? "select-none" : ""}`}>
          <thead>
            <tr className="border-b border-brand-green/10 text-xs font-bold uppercase tracking-wider text-ink/50">
              <th className="px-2 py-3" />
              <th className="px-4 py-3" />
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Prix (Bénin)</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Vedette</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((p, index) => {
              const category = categoryById.get(p.categoryId);
              const CategoryIcon = category ? CATEGORY_ICONS[category.id] : undefined;
              return (
                <tr
                  key={p.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(p.id, el);
                    else rowRefs.current.delete(p.id);
                  }}
                  style={rowStyle(index)}
                  className={`border-b border-brand-green/5 ${
                    drag?.id === p.id
                      ? "bg-ivory shadow-lg"
                      : drag
                        ? "transition-transform duration-150"
                        : ""
                  }`}
                >
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`Réorganiser ${p.name}`}
                      onPointerDown={(e) => handlePointerDown(e, p.id)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={(e) => endDrag(e, false)}
                      onPointerCancel={(e) => endDrag(e, true)}
                      className="flex h-11 w-11 touch-none cursor-grab items-center justify-center rounded-lg text-ink/40 hover:bg-ivory hover:text-ink/70 active:cursor-grabbing disabled:cursor-wait disabled:opacity-40"
                    >
                      <GripVertical className="h-5 w-5" />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- product images live on Vercel Blob, not a fixed host next/image can be pre-configured for
                      <img
                        src={p.image}
                        alt={p.name}
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <PhotoPlaceholder
                        seed={category?.photoSeed ?? "emerald"}
                        icon={CategoryIcon}
                        className="relative h-10 w-10 rounded-lg"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-brand-green-dark">
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-ink/60">
                    {category?.name ?? p.categoryId}
                  </td>
                  <td className="px-4 py-3 text-ink/60">
                    {p.prices.bj === null ? "Non vendu" : formatPrice(p.prices.bj, "bj")}
                  </td>
                  <td className="px-4 py-3 text-ink/60">
                    {p.stock === "en_stock" && "En stock"}
                    {p.stock === "stock_limite" && "Stock limité"}
                    {p.stock === "rupture" && "Rupture"}
                  </td>
                  <td className="px-4 py-3 text-ink/60">{p.featured ? "Oui" : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/produits/${p.id}`}
                        aria-label={`Modifier ${p.name}`}
                        className="rounded-full p-2 text-brand-green hover:bg-ivory"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <form action={deleteProductAction.bind(null, p.id)}>
                        <button
                          type="submit"
                          aria-label={`Supprimer ${p.name}`}
                          className="rounded-full p-2 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
