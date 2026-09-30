import { AppShell, type ShellProps } from "@/components/shell/app-shell";
import { requireAgencyUser } from "@/lib/auth/session";
import { getShellNotifications } from "@/lib/dashboard/notifications";
import { daysUntil } from "@/lib/dates";
import { navigationFor } from "@/lib/navigation";
import { can } from "@/lib/permissions";
import { countUnreadConversations } from "@/lib/services/messagerie";
import { ROLE_LABELS } from "@/lib/roles";

/**
 * Layout du back-office d'agence (§8.6), sur le modèle de tableau de bord validé.
 * Le layout vérifie la session pour afficher le menu, mais chaque page refait sa propre
 * vérification : lors d'une navigation, Next.js ne réexécute pas toujours le layout.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { user, db } = await requireAgencyUser();
  const [agence, abonnement, notifications, messagesNonLus] = await Promise.all([
    db.agence.findUniqueOrThrow({ where: { id: user.agenceId }, select: { nom: true } }),
    db.abonnement.findFirst({
      orderBy: { dateDebut: "desc" },
      select: { statut: true, dateFin: true, plan: { select: { nom: true } } },
    }),
    getShellNotifications(db, user.id),
    can(user.role, "lire", "message")
      ? countUnreadConversations(db, { id: user.id, role: user.role })
      : Promise.resolve(0),
  ]);
  const nav = navigationFor(user.role).map((item) =>
    item.href === "/dashboard/messages" ? { ...item, badge: messagesNonLus } : item,
  );

  let promo: ShellProps["promo"];
  if (user.role === "ADMIN_AGENCE") {
    const joursRestants = abonnement?.dateFin ? daysUntil(abonnement.dateFin) : null;
    promo = {
      title: abonnement ? `Plan ${abonnement.plan.nom}` : "Votre agence",
      text:
        abonnement?.statut === "ESSAI" && joursRestants !== null
          ? `Période d'essai : ${joursRestants} jour(s) restant(s). Complétez la présentation de votre agence.`
          : "Personnalisez la présentation et les coordonnées affichées sur votre site vitrine.",
      cta: { label: "Paramètres", href: "/dashboard/parametres" },
    };
  } else {
    promo = {
      title: "Votre profil",
      text: "Gardez vos coordonnées à jour et remplacez votre mot de passe initial.",
      cta: { label: "Mon profil", href: "/dashboard/profil" },
    };
  }

  return (
    <AppShell
      brand={{ name: "Green Trek", tagline: agence.nom, href: "/dashboard" }}
      nav={nav}
      user={{ name: user.name, subtitle: ROLE_LABELS[user.role] }}
      promo={promo}
      notifications={notifications}
      footerNote="Green Trek · plateforme des agences de randonnée"
    >
      {children}
    </AppShell>
  );
}
