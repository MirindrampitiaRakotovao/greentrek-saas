import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { ImageUploader } from "@/components/profile/image-uploader";
import { PasswordForm, ProfileForm } from "@/components/team/profile-forms";
import { requireAgencyUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/roles";

export const metadata: Metadata = { title: "Mon profil — Green Trek" };

/** Profil de l'utilisateur connecté (tous les rôles du back-office). */
export default async function ProfilPage() {
  const { user, db } = await requireAgencyUser();
  const profile = await db.utilisateur.findUniqueOrThrow({
    where: { id: user.id },
    select: { prenom: true, nom: true, telephone: true, email: true, photoUrl: true },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Mon profil" description={`${profile.email} · ${ROLE_LABELS[user.role]}`} />
      <section aria-labelledby="photo" className="rounded-2xl border border-gt-mist bg-white p-6">
        <h2 id="photo" className="mb-4 text-lg font-semibold text-gt-teal-900">
          Photo de profil
        </h2>
        <ImageUploader
          kind="photo"
          name={`${profile.prenom} ${profile.nom}`}
          current={profile.photoUrl}
        />
      </section>
      <section
        aria-labelledby="identite"
        className="rounded-2xl border border-gt-mist bg-white p-6"
      >
        <h2 id="identite" className="mb-4 text-lg font-semibold text-gt-teal-900">
          Identité
        </h2>
        <ProfileForm profile={profile} />
      </section>
      <section
        aria-labelledby="mot-de-passe"
        className="rounded-2xl border border-gt-mist bg-white p-6"
      >
        <h2 id="mot-de-passe" className="mb-4 text-lg font-semibold text-gt-teal-900">
          Mot de passe
        </h2>
        <PasswordForm />
      </section>
    </div>
  );
}
