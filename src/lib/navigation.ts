import type { Role } from "@/generated/prisma/client";
import { type Action, can, type Resource } from "@/lib/permissions";

export type NavIcon = "home" | "users" | "user";

export type NavItem = { href: string; label: string; icon: NavIcon };

type NavEntry = NavItem & {
  /** Permission requise pour voir le lien (absente : visible par tout le personnel). */
  permission?: readonly [Action, Resource];
};

/**
 * Menu du back-office. Les liens affichés découlent de la matrice des permissions (§3) :
 * un rôle ne voit que ce qu'il a le droit de consulter. Masquer un lien n'est qu'un
 * confort : chaque page revérifie les droits côté serveur.
 */
const NAVIGATION: readonly NavEntry[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: "home" },
  {
    href: "/dashboard/equipe",
    label: "Équipe",
    icon: "users",
    permission: ["lire", "utilisateur"],
  },
  { href: "/dashboard/profil", label: "Mon profil", icon: "user" },
];

export function navigationFor(role: Role): NavItem[] {
  return NAVIGATION.filter(
    (entry) => !entry.permission || can(role, entry.permission[0], entry.permission[1]),
  ).map(({ href, label, icon }) => ({ href, label, icon }));
}
