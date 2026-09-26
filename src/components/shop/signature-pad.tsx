"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Eraser } from "lucide-react";

export interface SignaturePadHandle {
  getDataUrl: () => string | null;
  clear: () => void;
}

/** A drawable signature box (mouse + touch/pen) — draws at 2x the CSS size
 *  for a crisp export, and exposes `getDataUrl()`/`clear()` via ref. */
export const SignaturePad = forwardRef<SignaturePadHandle>(function SignaturePad(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  function getContext(): CanvasRenderingContext2D | null {
    const canvas = canvasRef.current;
    return canvas ? canvas.getContext("2d") : null;
  }

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
    ctx.lineWidth = 3;
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
          width={600}
          height={200}
          className="h-[100px] w-full touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {isEmpty && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-ink/30">
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
