import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/vitrine/site-footer";
import { SiteHeader } from "@/components/vitrine/site-header";
import { getVitrineAgency } from "@/lib/public-agency";
import { getTenantDb } from "@/lib/tenant";

/**
 * Site vitrine public d'une agence (§7.1). Groupe de routes `(vitrine)` : l'en-tête et le
 * pied de page publics ne s'appliquent pas à la connexion ni à l'espace client, qui ont leur
 * propre présentation. Agence inconnue ou suspendue (RG 19) : page 404.
 */
export default async function VitrineLayout({ children, params }: LayoutProps<"/a/[slug]">) {
  const agence = await getVitrineAgency((await params).slug);
  if (!agence) notFound();
  const circuits = await getTenantDb(agence.id).circuit.findMany({
    where: { statut: "PUBLIE" },
    orderBy: { titre: "asc" },
    select: { titre: true, slug: true },
  });

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader agence={agence} />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <SiteFooter agence={agence} circuits={circuits} />
    </div>
  );
}
