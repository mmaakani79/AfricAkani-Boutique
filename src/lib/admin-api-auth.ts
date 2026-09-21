import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "./admin-auth";

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_SESSION_COOKIE)?.value);
}
