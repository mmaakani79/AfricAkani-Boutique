import { getDeploymentEnv } from "@/lib/deployment-env";

/** Yellow band shown only on Vercel Preview deployments, so the test copy can
 *  never be mistaken for the real shop. Renders nothing in production/local. */
export function PreviewBanner() {
  if (getDeploymentEnv() !== "preview") return null;
  return (
    <div
      role="status"
      data-testid="preview-banner"
      className="bg-amber-300 px-4 py-2 text-center text-xs font-bold uppercase tracking-wide text-amber-950 sm:text-sm"
    >
      Prévisualisation — base de test, pas la production
    </div>
  );
}
