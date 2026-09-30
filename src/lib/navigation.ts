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
    href: "/dashboard/circuits",
    label: "Circuits",
    icon: "mountain",
    permission: ["lire", "circuit"],
  },
  {
    href: "/dashboard/departs",
    label: "Départs",
    icon: "calendar",
    permission: ["lire", "sessionDepart"],
  },
  {
    href: "/dashboard/reservations",
    label: "Réservations",
    icon: "ticket",
    // Gestion des réservations : ADMIN_AGENCE et STAFF (le GUIDE voit ses participants
    // depuis « Départs »).
    permission: ["modifier", "reservation"],
  },
  {
    href: "/dashboard/paiements",
    label: "Paiements",
    icon: "wallet",
    permission: ["modifier", "paiement"],
  },
  {
    href: "/dashboard/clients",
    label: "Clients",
    icon: "user",
    permission: ["modifier", "reservation"],
  },
  {
    href: "/dashboard/etapes",
    label: "Carte du réseau",
    icon: "route",
    permission: ["lire", "etape"],
  },
  {
    href: "/dashboard/itineraires",
    label: "Calcul d'itinéraire",
    icon: "navigation",
    permission: ["lire", "troncon"],
  },
  {
    href: "/dashboard/performances",
    label: "Performances",
    icon: "gauge",
    permission: ["modifier", "circuit"],
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
    href: "/dashboard/abonnement",
    label: "Abonnement",
    icon: "coins",
    permission: ["modifier", "agence"],
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
