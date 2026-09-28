import bcrypt from "bcryptjs";

import type { Agence, PrismaClient, Role, Utilisateur } from "@/generated/prisma/client";
import { getAdminDb } from "@/lib/admin-db";
import type { LoginInput } from "@/lib/validators/auth";

/** Utilisateur authentifié, tel qu'il est stocké dans le jeton de session. */
export type AuthUser = {
  id: string;
  role: Role;
  agenceId: string | null;
  agenceSlug: string | null;
  name: string;
  email: string;
};

type UtilisateurAvecAgence = Utilisateur & { agence: Agence | null };

/** RG 19 : un compte désactivé ou une agence suspendue n'a plus accès. */
function hasAccess(utilisateur: UtilisateurAvecAgence): boolean {
  if (!utilisateur.actif) return false;
  return utilisateur.role === "SUPER_ADMIN" || utilisateur.agence?.statut === "ACTIVE";
}

function toAuthUser(utilisateur: UtilisateurAvecAgence): AuthUser {
  return {
    id: utilisateur.id,
    role: utilisateur.role,
    agenceId: utilisateur.agenceId,
    agenceSlug: utilisateur.agence?.slug ?? null,
    name: `${utilisateur.prenom} ${utilisateur.nom}`,
    email: utilisateur.email,
  };
}

/**
 * Empreinte bcrypt factice : quand l'e-mail n'existe pas, on compare quand même le mot de
 * passe à cette empreinte. La réponse prend alors le même temps que pour un compte existant,
 * ce qui empêche de deviner les adresses inscrites en mesurant le temps de réponse.
 */
const DUMMY_HASH = bcrypt.hashSync("mot-de-passe-factice-pour-temps-constant", 10);

/**
 * Vérifie des identifiants et renvoie l'utilisateur, ou `null` (message d'erreur unique,
 * quelle que soit la cause).
 *
 * Deux portes d'entrée (décision validée à l'étape E1) :
 * - sans `agenceSlug` (`/connexion`) : personnel des agences et super admin ; jamais un client ;
 * - avec `agenceSlug` (`/a/[slug]/connexion`) : uniquement les clients de cette agence.
 *
 * Utilise le client non confiné (`getAdminDb`) : l'agence n'est pas encore connue à ce stade.
 */
export async function authenticate(
  input: LoginInput,
  client: PrismaClient = getAdminDb(),
): Promise<AuthUser | null> {
  const utilisateur = input.agenceSlug
    ? await client.utilisateur.findFirst({
        where: { email: input.email, role: "CLIENT", agence: { slug: input.agenceSlug } },
        include: { agence: true },
      })
    : await client.utilisateur.findFirst({
        where: { email: input.email, role: { not: "CLIENT" } },
        include: { agence: true },
      });

  const passwordOk = await bcrypt.compare(
    input.password,
    utilisateur?.motDePasseHash ?? DUMMY_HASH,
  );
  if (!utilisateur || !passwordOk) return null;

  if (!hasAccess(utilisateur)) return null;

  await client.utilisateur.update({
    where: { id: utilisateur.id },
    data: { dernierLoginAt: new Date() },
  });

  return toAuthUser(utilisateur);
}

/**
 * L'e-mail est-il déjà utilisé par un membre du personnel ou un super admin, dans n'importe
 * quelle agence ? `/connexion` identifie le personnel par l'e-mail seul : il doit donc être
 * unique sur toute la plateforme (MySQL n'a pas d'index unique partiel, contrôle applicatif).
 */
export async function isStaffEmailTaken(
  email: string,
  client: PrismaClient = getAdminDb(),
): Promise<boolean> {
  const count = await client.utilisateur.count({
    where: { email: email.trim().toLowerCase(), role: { not: "CLIENT" } },
  });
  return count > 0;
}

/**
 * Relit l'utilisateur en base pour une requête protégée. Le jeton de session ne se met pas
 * à jour tout seul : sans cette relecture, un compte désactivé ou une agence suspendue
 * garderait l'accès jusqu'à l'expiration du jeton (RG 19).
 */
export async function loadActiveUser(
  userId: string,
  client: PrismaClient = getAdminDb(),
): Promise<AuthUser | null> {
  const utilisateur = await client.utilisateur.findUnique({
    where: { id: userId },
    include: { agence: true },
  });
  if (!utilisateur || !hasAccess(utilisateur)) return null;
  return toAuthUser(utilisateur);
}
