import { Sidebar } from "@/components/dashboard/sidebar";
import { requireAgencyUser } from "@/lib/auth/session";
import { navigationFor } from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/roles";

/**
 * Layout du back-office d'agence (§8.6) : barre latérale + contenu.
 * Le layout vérifie la session pour afficher le menu, mais chaque page refait sa propre
 * vérification : lors d'une navigation, Next.js ne réexécute pas toujours le layout.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { user, db } = await requireAgencyUser();
  const agence = await db.agence.findUniqueOrThrow({
    where: { id: user.agenceId },
    select: { nom: true },
  });

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-gt-cream/40 lg:flex-row">
      <Sidebar
        items={navigationFor(user.role)}
        agenceNom={agence.nom}
        userName={user.name}
        roleLabel={ROLE_LABELS[user.role]}
      />
      <main className="w-full min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
