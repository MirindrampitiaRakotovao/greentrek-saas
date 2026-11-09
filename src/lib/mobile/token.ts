import { createHash } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";

/**
 * Jeton de l'application mobile (après E12, hors cahier des charges §2) : l'application ne
 * peut pas utiliser le cookie de session du site, elle envoie un jeton dans l'en-tête
 * `Authorization: Bearer …`.
 *
 * - JWT signé HS256 (bibliothèque `jose`), valable 30 jours ;
 * - clé DÉRIVÉE d'`AUTH_SECRET` avec un contexte propre (« greentrek-mobile ») : un jeton
 *   mobile ne peut pas servir ailleurs, et inversement ;
 * - émetteur et audience vérifiés ;
 * - le jeton ne contient que l'identifiant : chaque requête relit l'utilisateur en base
 *   (compte désactivé ou agence suspendue : accès coupé aussitôt, RG 19).
 */

export const MOBILE_TOKEN_DAYS = 30;
const ISSUER = "greentrek";
const AUDIENCE = "greentrek-mobile";

function key(secret: string): Uint8Array {
  if (!secret) throw new Error("AUTH_SECRET manquant : impossible de signer un jeton mobile.");
  return new Uint8Array(createHash("sha256").update(`greentrek-mobile:${secret}`).digest());
}

export function mobileSecret(): string {
  return process.env.AUTH_SECRET ?? "";
}

export async function signMobileToken(
  userId: string,
  secret: string = mobileSecret(),
  now: Date = new Date(),
): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(iat + MOBILE_TOKEN_DAYS * 24 * 3600)
    .sign(key(secret));
}

/** Identifiant de l'utilisateur, ou `null` si le jeton est invalide, falsifié ou expiré. */
export async function verifyMobileToken(
  token: string,
  secret: string = mobileSecret(),
  now: Date = new Date(),
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
      currentDate: now,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Jeton lu dans l'en-tête `Authorization: Bearer …`. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}
