import { notFound } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth/session";
import { getShellNotifications } from "@/lib/dashboard/notifications";
import type { NavItem } from "@/lib/navigation";
import { countUnreadConversations } from "@/lib/services/messagerie";
import { getTenantDb } from "@/lib/tenant";

/**
 * Espace voyageur (§7.2), même coque que le back-office (choix de l'étudiant), au nom de
 * l'agence. Le client doit appartenir à l'agence de l'URL (sinon renvoi vers son espace).
 */
export default async function MonCompteLayout({
  children,
  params,
}: LayoutProps<"/a/[slug]/mon-compte">) {
  const { slug } = await params;
  const user = await requireUser({ roles: ["CLIENT"], agenceSlug: slug });
  if (!user.agenceId) notFound();
  const db = getTenantDb(user.agenceId);
  const [agence, notifications, messagesNonLus] = await Promise.all([
    db.agence.findUniqueOrThrow({
      where: { id: user.agenceId },
      select: { nom: true, email: true, telephone: true },
    }),
    getShellNotifications(db, user.id),
    countUnreadConversations(db, { id: user.id, role: user.role }),
  ]);

  const nav: NavItem[] = [
    { href: `/a/${slug}/mon-compte`, label: "Mon espace", icon: "home" },
    { href: `/a/${slug}/mon-compte/reservations`, label: "Mes réservations", icon: "ticket" },
    {
      href: `/a/${slug}/mon-compte/messages`,
      label: "Messages",
      icon: "message",
      badge: messagesNonLus,
    },
    { href: `/a/${slug}/circuits`, label: "Réserver un circuit", icon: "mountain" },
  ];
  const contact = [agence.telephone, agence.email].filter(Boolean).join(" · ");

  return (
    <AppShell
      brand={{ name: agence.nom, tagline: "Espace voyageur", href: `/a/${slug}/mon-compte` }}
      nav={nav}
      user={{ name: user.name, subtitle: "Voyageur" }}
      promo={{
        title: "Une question sur votre voyage ?",
        text: contact
          ? `Écrivez à ${agence.nom} dans la messagerie, ou contactez l'agence : ${contact}.`
          : `Écrivez à ${agence.nom} dans la messagerie : réponse de l'équipe ou de votre guide.`,
        cta: { label: "Écrire à l'agence", href: `/a/${slug}/mon-compte/messages` },
      }}
      notifications={notifications}
      footerNote="Paiement sécurisé · facture disponible pour chaque réservation"
    >
      {children}
    </AppShell>
  );
}
