import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import type { AuthUser } from "@/lib/auth/authenticate";

const ROLE_LABELS: Record<AuthUser["role"], string> = {
  SUPER_ADMIN: "Super administrateur",
  ADMIN_AGENCE: "Administrateur d'agence",
  STAFF: "Personnel",
  GUIDE: "Guide",
  CLIENT: "Client",
};

/**
 * Espace provisoire (étape E2) : prouve la connexion, le rôle et l'agence de l'utilisateur.
 * Remplacé par le vrai layout du back-office à l'étape E3.
 */
export function PlaceholderSpace({
  title,
  user,
  agenceNom,
  children,
}: {
  title: string;
  user: AuthUser;
  agenceNom?: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gt-teal-900">{title}</h1>
        <LogoutButton />
      </div>
      <dl className="mt-6 grid gap-3 rounded-2xl border border-gt-mist bg-white p-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-gt-teal-900/70">Utilisateur</dt>
          <dd className="font-medium">{user.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-gt-teal-900/70">E-mail</dt>
          <dd className="font-medium">{user.email}</dd>
        </div>
        <div>
          <dt className="text-sm text-gt-teal-900/70">Rôle</dt>
          <dd className="font-medium">{ROLE_LABELS[user.role]}</dd>
        </div>
        <div>
          <dt className="text-sm text-gt-teal-900/70">Agence</dt>
          <dd className="font-medium">{agenceNom ?? "Toutes (plateforme)"}</dd>
        </div>
      </dl>
      {children}
    </main>
  );
}
