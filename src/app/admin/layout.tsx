import { AppShell } from "@/components/shell/app-shell";
import { getAdminDb } from "@/lib/admin-db";
import { requireUser } from "@/lib/auth/session";
import { getShellNotifications } from "@/lib/dashboard/notifications";
import type { NavItem } from "@/lib/navigation";
import { countOpenReports } from "@/lib/services/communaute";
import { ROLE_LABELS } from "@/lib/roles";

/** Console du super administrateur (§7.4) : même coque que le back-office. */
const ADMIN_NAV: readonly NavItem[] = [
  { href: "/admin", label: "Vue plateforme", icon: "home" },
  { href: "/admin/agences", label: "Agences", icon: "building" },
  { href: "/admin/plans", label: "Plans et tarifs", icon: "coins" },
  // Communauté des voyageurs, commune aux agences (étape 5d) : signalements à traiter.
  { href: "/admin/communaute", label: "Communauté", icon: "image" },
  { href: "/admin/journal", label: "Journal d'activité", icon: "layers" },
  { href: "/admin/e-mails", label: "Boîte d'envoi", icon: "message" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireUser({ roles: ["SUPER_ADMIN"] });
  // Accès non confiné, autorisé uniquement après la vérification du rôle ci-dessus.
  const [notifications, signalements] = await Promise.all([
    getShellNotifications(getAdminDb(), user.id),
    countOpenReports(),
  ]);
  const nav = ADMIN_NAV.map((item) =>
    item.href === "/admin/communaute"
      ? { ...item, badge: signalements, badgeLabel: { one: "à traiter", many: "à traiter" } }
      : item,
  );

  return (
    <AppShell
      brand={{ name: "Green Trek", tagline: "Console plateforme", href: "/admin" }}
      nav={nav}
      user={{ name: user.name, subtitle: ROLE_LABELS[user.role], photoUrl: user.photoUrl }}
      promo={{
        title: "Console plateforme",
        text: "Supervisez les agences, leurs abonnements et les plans proposés sur la page Tarifs.",
      }}
      notifications={notifications}
      footerNote="Green Trek · console d'administration"
    >
      {children}
    </AppShell>
  );
}
