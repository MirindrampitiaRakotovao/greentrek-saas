import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { ImageUploader } from "@/components/profile/image-uploader";
import { PasswordForm, ProfileForm } from "@/components/team/profile-forms";
import { requireClient } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mon profil" };

/** Profil du voyageur sur le site (après E12) : photo, coordonnées, mot de passe. */
export default async function MonProfilPage({ params }: PageProps<"/a/[slug]/mon-compte/profil">) {
  const { slug } = await params;
  const { user, db } = await requireClient(slug, `/a/${slug}/mon-compte/profil`);
  const profile = await db.utilisateur.findUniqueOrThrow({
    where: { id: user.id },
    select: { prenom: true, nom: true, telephone: true, email: true, photoUrl: true },
  });
  const nom = `${profile.prenom} ${profile.nom}`;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Mon profil" description={profile.email} />
      {[
        {
          id: "photo",
          titre: "Photo de profil",
          contenu: <ImageUploader kind="photo" name={nom} current={profile.photoUrl} />,
        },
        { id: "identite", titre: "Coordonnées", contenu: <ProfileForm profile={profile} /> },
        { id: "mot-de-passe", titre: "Mot de passe", contenu: <PasswordForm /> },
      ].map((section) => (
        <section
          key={section.id}
          aria-labelledby={section.id}
          className="rounded-2xl border border-gt-mist bg-white p-6"
        >
          <h2 id={section.id} className="mb-4 text-lg font-semibold text-gt-teal-900">
            {section.titre}
          </h2>
          {section.contenu}
        </section>
      ))}
    </div>
  );
}
