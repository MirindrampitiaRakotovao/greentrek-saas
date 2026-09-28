import { AppShell } from "@/components/shell/app-shell";
import { getAdminDb } from "@/lib/admin-db";
import { requireUser } from "@/lib/auth/session";
import { getShellNotifications } from "@/lib/dashboard/notifications";
import type { NavItem } from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/roles";

/** Console du super administrateur (§7.4) : même coque que le back-office. */
const ADMIN_NAV: readonly NavItem[] = [{ href: "/admin", label: "Vue plateforme", icon: "home" }];

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
        title: "Démonstration",
        text: "Les agences Démo Alpha et Démo Beta, ainsi que toutes les réservations, sont fictives. Plans et abonnements simulés.",
      }}
      notifications={notifications}
      footerNote="Gestion des plans et suspension des agences : étape E11."
    >
      {children}
    </AppShell>
  );
}
