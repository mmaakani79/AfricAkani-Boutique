import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "./admin-auth";

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_SESSION_COOKIE)?.value);
}

/** Guard for admin server actions. Server actions can be invoked from any URL,
 *  so the /admin path guard in the proxy alone doesn't protect them — every
 *  admin action calls this first, before any try/catch (redirect() throws). */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminAuthed())) redirect("/admin/login");
}
