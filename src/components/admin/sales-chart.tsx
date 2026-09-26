"use client";

import { useMemo, useState, useTransition } from "react";
import { TrendingUp } from "lucide-react";
import type { SalesPeriod, SalesSeries } from "@/lib/orders-db";
import { ZONES, formatPrice } from "@/data/zones";
import type { ZoneId } from "@/lib/types";
import { getSalesOverTimeAction } from "@/app/admin/(protected)/sales-action";

const PERIOD_LABELS: Record<SalesPeriod, string> = {
  day: "Jour",
  week: "Semaine",
  month: "Mois",
};

const VIEWBOX_W = 340;
const VIEWBOX_H = 170;
const PAD_LEFT = 4;
const PAD_RIGHT = 4;
const PAD_TOP = 10;
const PAD_BOTTOM = 22;
const PLOT_W = VIEWBOX_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = VIEWBOX_H - PAD_TOP - PAD_BOTTOM;

/** Rounds a max value up to a "clean" step (1/2/5 × 10^n) for tidy y-axis ticks. */
function niceMax(value: number): number {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function compactAmount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(value));
}

function ZoneSalesChart({ series }: { series: SalesSeries }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const zone = ZONES[series.zoneId];
  const points = series.points;
  const total = points.reduce((sum, p) => sum + p.total, 0);
  const max = useMemo(() => niceMax(Math.max(...points.map((p) => p.total), 0)), [points]);

  const xFor = (i: number) =>
    points.length > 1 ? PAD_LEFT + (i / (points.length - 1)) * PLOT_W : PAD_LEFT + PLOT_W / 2;
  const yFor = (v: number) => PAD_TOP + PLOT_H - (v / max) * PLOT_H;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.total).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${xFor(points.length - 1).toFixed(1)} ${(PAD_TOP + PLOT_H).toFixed(1)} L ${xFor(0).toFixed(1)} ${(PAD_TOP + PLOT_H).toFixed(1)} Z`;

  const yTicks = [0, max / 2, max];
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const index = Math.round(ratio * (points.length - 1));
    setHoverIndex(index);
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-brand-green-dark">{zone.label}</h3>
        <span className="font-brand text-base font-bold text-brand-green-dark">
          {formatPrice(total, series.zoneId)}
        </span>
      </div>
      <p className="text-[11px] text-ink/40">Total vendu sur la période</p>

      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          className="h-[140px] w-full overflow-visible"
          role="img"
          aria-label={`Évolution des ventes — ${zone.label}`}
        >
          {yTicks.map((t, i) => (
            <line
              key={i}
              x1={PAD_LEFT}
              x2={VIEWBOX_W - PAD_RIGHT}
              y1={yFor(t)}
              y2={yFor(t)}
              stroke="var(--color-ink)"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
          ))}

          <path d={areaPath} fill="var(--color-green)" fillOpacity={0.1} stroke="none" />
          <path d={linePath} fill="none" stroke="var(--color-green)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {hovered && (
            <line
              x1={xFor(hoverIndex!)}
              x2={xFor(hoverIndex!)}
              y1={PAD_TOP}
              y2={PAD_TOP + PLOT_H}
              stroke="var(--color-ink)"
              strokeOpacity={0.2}
              strokeWidth={1}
            />
          )}

          <circle
            cx={xFor(points.length - 1)}
            cy={yFor(points[points.length - 1].total)}
            r={4}
            fill="var(--color-green)"
            stroke="white"
            strokeWidth={2}
          />
          {hovered && hoverIndex !== points.length - 1 && (
            <circle
              cx={xFor(hoverIndex!)}
              cy={yFor(hovered.total)}
              r={4}
              fill="var(--color-green)"
              stroke="white"
              strokeWidth={2}
            />
          )}

          {[0, points.length - 1].map((i) => (
            <text
              key={i}
              x={xFor(i)}
              y={VIEWBOX_H - 4}
              fontSize={9}
              fill="var(--color-ink)"
              fillOpacity={0.4}
              textAnchor={i === 0 ? "start" : "end"}
            >
              {points[i].label}
            </text>
          ))}

          <rect
            x={PAD_LEFT}
            y={PAD_TOP}
            width={PLOT_W}
            height={PLOT_H}
            fill="transparent"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          />
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-brand-green-dark px-2.5 py-1.5 text-xs font-semibold text-ivory shadow-lg"
            style={{
              left: `${(xFor(hoverIndex!) / VIEWBOX_W) * 100}%`,
            }}
          >
            <div className="font-bold">{formatPrice(hovered.total, series.zoneId)}</div>
            <div className="text-ivory/60">{hovered.label}</div>
          </div>
        )}
      </div>
      <p className="mt-1 text-right text-[10px] text-ink/30">
        Max affiché : {compactAmount(max)}
      </p>
    </div>
  );
}

export function SalesChartSection({ initialSeries }: { initialSeries: SalesSeries[] }) {
  const [period, setPeriod] = useState<SalesPeriod>("day");
  const [seriesByZone, setSeriesByZone] = useState(initialSeries);
  const [pending, startTransition] = useTransition();

  function handlePeriodChange(next: SalesPeriod) {
    setPeriod(next);
    startTransition(async () => {
      const result = await getSalesOverTimeAction(next);
      setSeriesByZone(result);
    });
  }

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-brand-gold">
          <TrendingUp className="h-4 w-4" /> Courbe des ventes
        </h2>
        <div className="flex gap-1 rounded-full bg-white p-1 shadow-sm">
          {(Object.keys(PERIOD_LABELS) as SalesPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePeriodChange(p)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                period === p
                  ? "bg-brand-green text-ivory"
                  : "text-brand-green-dark hover:bg-ivory"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`mt-4 grid gap-4 lg:grid-cols-3 ${pending ? "opacity-60 transition-opacity" : ""}`}
      >
        {(["bj", "ca", "us"] as ZoneId[]).map((zoneId) => {
          const series = seriesByZone.find((s) => s.zoneId === zoneId);
          return series ? <ZoneSalesChart key={zoneId} series={series} /> : null;
        })}
      </div>
    </section>
  );
}
