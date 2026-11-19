import type { PrismaClient } from "@/generated/prisma/client";
import { getAdminDb } from "@/lib/admin-db";
import { type AuthUser, authenticate, loadActiveUser } from "@/lib/auth/authenticate";
import { bearerToken, signMobileToken, verifyMobileToken } from "@/lib/mobile/token";
import { getTenantDb, type TenantDb } from "@/lib/tenant";

/**
 * Sessions de l'application mobile, réservée aux VOYAGEURS (décision de l'étudiant) : comme sur
 * le site d'une agence, un voyageur se connecte avec son compte de CETTE agence (la même
 * adresse peut exister dans plusieurs agences). Le personnel utilise le site.
 */

export type MobileClient = AuthUser & { agenceId: string; agenceSlug: string };

function asClient(user: AuthUser | null): MobileClient | null {
  if (user?.role !== "CLIENT" || !user.agenceId || !user.agenceSlug) return null;
  return { ...user, agenceId: user.agenceId, agenceSlug: user.agenceSlug };
}

/** Connexion : jeton et voyageur, ou `null` (message unique, quelle que soit la cause). */
export async function mobileLogin(
  input: { email: string; password: string; agenceSlug: string },
  client: PrismaClient = getAdminDb(),
  now: Date = new Date(),
): Promise<{ token: string; user: MobileClient } | null> {
  const user = asClient(await authenticate(input, client));
  if (!user) return null;
  return { token: await signMobileToken(user.id, undefined, now), user };
}

/**
 * Voyageur de la requête (jeton vérifié, puis compte relu en base) et client confiné à SON
 * agence, ou `null` (réponse 401).
 */
export async function mobileClientFromRequest(
  request: Request,
  client: PrismaClient = getAdminDb(),
  now: Date = new Date(),
): Promise<{ user: MobileClient; db: TenantDb } | null> {
  const token = bearerToken(request);
  const userId = token ? await verifyMobileToken(token, undefined, now) : null;
  const user = userId ? asClient(await loadActiveUser(userId, client)) : null;
  return user ? { user, db: getTenantDb(user.agenceId, client) } : null;
}

/** Profil du voyageur pour l'application (onglet Compte, voyageur principal d'une réservation). */
export async function mobileProfile(userId: string, client: PrismaClient = getAdminDb()) {
  const u = await client.utilisateur.findUniqueOrThrow({
    where: { id: userId },
    select: {
      prenom: true,
      nom: true,
      email: true,
      telephone: true,
      photoUrl: true,
      agence: { select: { slug: true, nom: true, logoUrl: true } },
    },
  });
  return {
    prenom: u.prenom,
    nom: u.nom,
    email: u.email,
    telephone: u.telephone,
    agenceSlug: u.agence?.slug ?? "",
    agenceNom: u.agence?.nom ?? "",
    /** Photo de profil et logo de l'agence (chemins du site), ou null. */
    photoUrl: u.photoUrl,
    agenceLogoUrl: u.agence?.logoUrl ?? null,
  };
}

export type MobileProfile = Awaited<ReturnType<typeof mobileProfile>>;
