import "server-only";

import { cookies } from "next/headers";

import { EXPERT_COOKIE, parseExpertCookie } from "@/lib/expert-mode";

/** Mode expert activé dans ce navigateur ? */
export async function isExpertMode(): Promise<boolean> {
  return parseExpertCookie((await cookies()).get(EXPERT_COOKIE)?.value);
}
