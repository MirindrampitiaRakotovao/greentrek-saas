import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import type { AuthUser } from "@/lib/auth/authenticate";
import { ROLE_LABELS } from "@/lib/roles";

/**
 * Espace provisoire (étape E2) : prouve la connexion, le rôle et l'agence de l'utilisateur.
 * Encore utilisé par l'espace client (remplacé en E9) et la console super admin (E11).
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
