import { AppShell } from "@/components/shell/app-shell";
import { getAdminDb } from "@/lib/admin-db";
import { requireUser } from "@/lib/auth/session";
import { getShellNotifications } from "@/lib/dashboard/notifications";
import type { NavItem } from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/roles";

/** Console du super administrateur (§7.4) : même coque que le back-office. */
const ADMIN_NAV: readonly NavItem[] = [
  { href: "/admin", label: "Vue plateforme", icon: "home" },
  { href: "/admin/agences", label: "Agences", icon: "building" },
  { href: "/admin/plans", label: "Plans et tarifs", icon: "coins" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireUser({ roles: ["SUPER_ADMIN"] });
  // Accès non confiné, autorisé uniquement après la vérification du rôle ci-dessus.
  const notifications = await getShellNotifications(getAdminDb(), user.id);

  return (
    <AppShell
      brand={{ name: "Green Trek", tagline: "Console plateforme", href: "/admin" }}
      nav={ADMIN_NAV}
      user={{ name: user.name, subtitle: ROLE_LABELS[user.role] }}
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
