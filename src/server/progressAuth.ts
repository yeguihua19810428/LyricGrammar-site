import { auth, authConfigured } from "@/lib/auth/server";
import { gateIdentityEnabled } from "@/lib/auth/gate-identity.server";
import { DEV_USER_ID } from "@/lib/auth/verify.server";

const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());

export async function userIdFromApiRequest(request: Request): Promise<string | null> {
  if (!authConfigured && !gateIdentityEnabled()) {
    if (databaseConfigured) return null;
    return DEV_USER_ID;
  }
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}
