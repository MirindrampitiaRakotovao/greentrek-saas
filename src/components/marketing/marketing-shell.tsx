import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { ShrinkingHeader } from "@/components/vitrine/shrinking-header";

/**
 * En-tête et pied de page du site de la plateforme (landing SaaS et tarifs, §7.5), avec la
 * même identité visuelle que les sites vitrines des agences (§8).
 */
export function MarketingShell({ children }: { children: ReactNode }) {
  const links = [
    { href: "/#fonctionnalites", label: "Fonctionnalités" },
    { href: "/#agences", label: "Agences" },
    { href: "/tarifs", label: "Tarifs" },
  ];
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <ShrinkingHeader>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 transition-[padding] group-data-[scrolled=true]/header:py-2 sm:px-6 sm:py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-xl bg-gt-teal-900 text-gt-sand-300">
              <Icon name="leaf" className="size-5" />
            </span>
            <span className="font-display text-lg font-medium text-gt-teal-900">Green Trek</span>
          </Link>
          <nav aria-label="Navigation principale" className="flex items-center gap-2 sm:gap-6">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hidden text-sm font-medium text-gt-teal-900/80 hover:text-gt-teal-700 md:inline"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/connexion"
              className="rounded-full px-3 py-2 text-sm font-medium text-gt-teal-800 hover:bg-gt-teal-50"
            >
              Connexion
            </Link>
            <Link
              href="/inscription-agence"
              className="rounded-full bg-gt-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-gt-teal-800"
            >
              Inscrire mon agence
            </Link>
          </nav>
        </div>
      </ShrinkingHeader>
      <main className="flex-1 overflow-x-clip">{children}</main>
      <footer className="bg-gt-teal-800 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
          <div className="sm:col-span-2">
            <p className="font-display text-2xl font-medium text-gt-cream">Green Trek</p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">
              Plateforme SaaS de gestion et de réservation de circuits de randonnée pour les agences
              de voyage, avec calcul d&apos;itinéraires optimisés.
            </p>
          </div>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/tarifs" className="text-white/85 hover:underline">
                Tarifs
              </Link>
            </li>
            <li>
              <Link href="/inscription-agence" className="text-white/85 hover:underline">
                Inscrire mon agence
              </Link>
            </li>
            <li>
              <Link href="/connexion" className="text-white/85 hover:underline">
                Espace agence
              </Link>
            </li>
          </ul>
        </div>
        <div className="bg-gt-sand-300 px-4 py-3 text-center text-xs text-gt-teal-900">
          © Green Trek · Plateforme de gestion et de réservation pour les agences de randonnée.
        </div>
      </footer>
    </div>
  );
}
