"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser } from "lucide-react";

export interface SignaturePadHandle {
  getDataUrl: () => string | null;
  clear: () => void;
}

/** Height of the drawing area, in CSS pixels, on phones and computers alike. */
export const SIGNATURE_PAD_HEIGHT = 200;
/** The drawing is kept at 2x the CSS size (3x on very sharp screens) for a crisp export… */
const MAX_PIXEL_RATIO = 3;
/** …but never wider than this many pixels, so the saved PNG stays light. */
const MAX_EXPORT_WIDTH = 1400;
const STROKE_WIDTH_CSS = 2.5;

/**
 * A drawable signature box (mouse + touch/pen). The drawing surface has exactly the proportions of the
 * box on screen, so what is drawn is what is exported: the whole box, never cropped, never stretched.
 * It exposes `getDataUrl()` / `clear()` via ref.
 */
export const SignaturePad = forwardRef<SignaturePadHandle>(function SignaturePad(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const pixelRatioRef = useRef(2);
  const [isEmpty, setIsEmpty] = useState(true);

  function getContext(): CanvasRenderingContext2D | null {
    const canvas = canvasRef.current;
    return canvas ? canvas.getContext("2d") : null;
  }

  // Gives the drawing surface the size of the box on screen (and keeps it that way when the width changes,
  // for instance when a phone is turned): what was already drawn is carried over, scaled evenly.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function fit() {
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const dpr = Math.min(MAX_PIXEL_RATIO, Math.max(2, Math.ceil(window.devicePixelRatio || 1)));
      const ratio = Math.min(dpr, MAX_EXPORT_WIDTH / rect.width);
      const width = Math.round(rect.width * ratio);
      const height = Math.round(rect.height * ratio);
      pixelRatioRef.current = ratio;
      if (el.width === width && el.height === height) return;
      let previous: HTMLCanvasElement | null = null;
      if (hasDrawnRef.current && el.width > 0 && el.height > 0) {
        previous = document.createElement("canvas");
        previous.width = el.width;
        previous.height = el.height;
        previous.getContext("2d")?.drawImage(el, 0, 0);
      }
      el.width = width;
      el.height = height;
      if (previous) {
        const scale = Math.min(width / previous.width, height / previous.height);
        const w = previous.width * scale;
        const h = previous.height * scale;
        el.getContext("2d")?.drawImage(previous, (width - w) / 2, (height - h) / 2, w, h);
      }
    }
    fit();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    observer?.observe(canvas);
    window.addEventListener("resize", fit);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = pointFromEvent(e);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = getContext();
    const last = lastPointRef.current;
    if (!ctx || !last) return;
    const point = pointFromEvent(e);
    ctx.strokeStyle = "#0e5a44";
    ctx.lineWidth = STROKE_WIDTH_CSS * pixelRatioRef.current;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    if (!hasDrawnRef.current) {
      hasDrawnRef.current = true;
      setIsEmpty(false);
    }
  }

  function handlePointerUp() {
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = getContext();
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
    setIsEmpty(true);
  }

  useImperativeHandle(ref, () => ({
    clear,
    getDataUrl: () => (hasDrawnRef.current ? canvasRef.current?.toDataURL("image/png") ?? null : null),
  }));

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-brand-green/20 bg-ivory">
        <canvas
          ref={canvasRef}
          data-testid="signature-canvas"
          width={1200}
          height={400}
          style={{ height: SIGNATURE_PAD_HEIGHT }}
          className="block w-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        {isEmpty && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-ink/30">
            Signez ici avec la souris ou le doigt
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-brand-green-dark hover:underline"
      >
        <Eraser className="h-3.5 w-3.5" /> Effacer la signature
      </button>
    </div>
  );
});
