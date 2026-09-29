import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/auth";
import type { Role } from "@/generated/prisma/client";
import { type AuthUser, loadActiveUser } from "@/lib/auth/authenticate";
import { getTenantDb, type TenantDb } from "@/lib/tenant";

/**
 * Couche d'accès côté serveur (« Data Access Layer » de la documentation Next.js) : c'est
 * ici, et non dans `proxy.ts`, que se font les vrais contrôles d'accès. À appeler au début
 * de chaque page, action serveur ou route protégée.
 */

/** Rôles du back-office d'agence. */
export const AGENCY_STAFF_ROLES = [
  "ADMIN_AGENCE",
  "STAFF",
  "GUIDE",
] as const satisfies readonly Role[];

/**
 * Utilisateur courant, relu en base une fois par requête (`cache` de React déduplique les
 * appels au sein d'un même rendu). `null` si pas de session, compte désactivé ou agence
 * suspendue (RG 19).
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await auth();
  if (!session?.user.id) return null;
  return loadActiveUser(session.user.id);
});

/** Page d'accueil de chaque rôle après connexion. */
export function homePathFor(user: AuthUser): string {
  if (user.role === "SUPER_ADMIN") return "/admin";
  if (user.role === "CLIENT") return `/a/${user.agenceSlug}/mon-compte`;
  return "/dashboard";
}

type RequireOptions = {
  roles: readonly Role[];
  /** Pour l'espace client : le client doit appartenir à l'agence de l'URL. */
  agenceSlug?: string;
};

/**
 * Exige un utilisateur connecté, actif, avec l'un des rôles donnés. Sinon :
 * - pas de session valide → page de connexion adaptée ;
 * - mauvais rôle ou mauvaise agence → page d'accueil de son propre rôle.
 */
export async function requireUser({ roles, agenceSlug }: RequireOptions): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(agenceSlug ? `/a/${agenceSlug}/connexion` : "/connexion");
  }
  if (!roles.includes(user.role) || (agenceSlug && user.agenceSlug !== agenceSlug)) {
    redirect(homePathFor(user));
  }
  return user;
}

/**
 * Exige un membre du personnel d'une agence et renvoie, avec lui, le client Prisma confiné
 * à SON agence (l'identifiant d'agence vient de la base, jamais du navigateur).
 */
export async function requireAgencyUser(
  roles: readonly Role[] = AGENCY_STAFF_ROLES,
): Promise<{ user: AuthUser & { agenceId: string }; db: TenantDb }> {
  const user = await requireUser({ roles });
  if (!user.agenceId) redirect(homePathFor(user));
  return { user: { ...user, agenceId: user.agenceId }, db: getTenantDb(user.agenceId) };
}

/**
 * Exige un CLIENT de l'agence du site (tunnel de réservation, pages de paiement). Sans session,
 * renvoie vers la connexion de l'agence avec l'adresse de retour (voir `safeReturnPath`).
 * Le client confiné est construit avec l'agence du COMPTE, jamais avec celle de l'URL.
 */
export async function requireClient(
  agenceSlug: string,
  retour: string,
): Promise<{ user: AuthUser & { agenceId: string }; db: TenantDb }> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/a/${agenceSlug}/connexion?retour=${encodeURIComponent(retour)}`);
  }
  if (user.role !== "CLIENT" || user.agenceSlug !== agenceSlug || !user.agenceId) {
    redirect(homePathFor(user));
  }
  return { user: { ...user, agenceId: user.agenceId }, db: getTenantDb(user.agenceId) };
}

/** Variante pour les actions serveur : `null` si l'appelant n'est pas un client connecté. */
export async function getClientContext(): Promise<{
  user: AuthUser & { agenceId: string; agenceSlug: string };
  db: TenantDb;
} | null> {
  const user = await getCurrentUser();
  if (user?.role !== "CLIENT" || !user.agenceId || !user.agenceSlug) return null;
  return {
    user: { ...user, agenceId: user.agenceId, agenceSlug: user.agenceSlug },
    db: getTenantDb(user.agenceId),
  };
}
