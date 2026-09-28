import type { IconName } from "@/components/ui/icon";
import type { Role } from "@/generated/prisma/client";
import { type Action, can, type Resource } from "@/lib/permissions";

export type NavItem = { href: string; label: string; icon: IconName };

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
  {
    href: "/dashboard/guides",
    label: "Guides",
    icon: "compass",
    permission: ["lire", "guide"],
  },
  {
    href: "/dashboard/partenaires",
    label: "Partenaires",
    icon: "handshake",
    permission: ["lire", "partenaire"],
  },
  {
    href: "/dashboard/parametres",
    label: "Paramètres",
    icon: "settings",
    permission: ["modifier", "agence"],
  },
  { href: "/dashboard/profil", label: "Mon profil", icon: "user" },
];

export function navigationFor(role: Role): NavItem[] {
  return NAVIGATION.filter(
    (entry) => !entry.permission || can(role, entry.permission[0], entry.permission[1]),
  ).map(({ href, label, icon }) => ({ href, label, icon }));
}
