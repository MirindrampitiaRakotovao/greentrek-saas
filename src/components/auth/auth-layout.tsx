import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";

import { AuthShowcase, type ShowcaseSlide } from "./auth-showcase";

export type AuthBrand =
  { kind: "plateforme" } | { kind: "agence"; nom: string; logoUrl: string | null; href: string };

/**
 * Mise en page pleine page des écrans d'authentification (connexion, inscription, mot de
 * passe oublié), d'après la maquette fournie par l'étudiant : formulaire à gauche (logo,
 * onglets Connexion / Inscription, titre), grand panneau photo à droite. Sur mobile : un
 * bandeau photo puis le formulaire.
 */
export function AuthLayout({
  brand,
  tabs,
  title,
  subtitle,
  notice,
  children,
  footer,
  showcase,
}: {
  brand: AuthBrand;
  /** Onglets (absents sur les pages « mot de passe oublié »). */
  tabs?: {
    active: "connexion" | "inscription";
    connexion: string;
    inscription: { href: string; label: string };
  };
  title: string;
  subtitle?: string;
  /** Message affiché au-dessus du formulaire (ex. mot de passe modifié). */
  notice?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  showcase: {
    slides: readonly ShowcaseSlide[];
    card: { title: string; text: string };
    headline: string;
    cta: { label: string; href: string };
  };
}) {
  const banner = showcase.slides[0];
  const tab = (active: boolean) =>
    `grid h-12 place-items-center rounded-xl text-sm font-semibold transition-colors ${
      active
        ? "bg-gt-teal-900 text-white"
        : "border border-gt-teal-900 text-gt-teal-900 hover:bg-gt-teal-50"
    }`;

  return (
    <main
      id="contenu"
      tabIndex={-1}
      className="flex min-h-dvh flex-1 bg-white outline-none lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
    >
      <section className="flex w-full flex-col px-5 py-6 sm:px-10 lg:px-14 lg:py-10">
        {banner ? (
          <div className="relative mb-6 h-36 overflow-hidden rounded-3xl lg:hidden">
            <Image src={banner.src} alt="" fill sizes="100vw" className="object-cover" priority />
          </div>
        ) : null}
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <Link
            href={brand.kind === "plateforme" ? "/" : brand.href}
            className="mx-auto flex flex-col items-center text-center"
          >
            {brand.kind === "plateforme" ? (
              <>
                <Logo variant="complet" className="h-20 w-auto" alt="Green Trek" priority />
                <span className="mt-3 text-xs tracking-[0.25em] text-gt-teal-900/75 uppercase">
                  Explorer · Réserver · Partager
                </span>
              </>
            ) : (
              <>
                {brand.logoUrl ? (
                  // Logo de l'agence (fichier local ou adresse externe saisie dans ses paramètres).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logoUrl} alt="" className="h-16 w-auto object-contain" />
                ) : (
                  <span className="grid size-14 place-items-center rounded-2xl bg-gt-teal-700 text-white">
                    <Icon name="leaf" className="size-7" />
                  </span>
                )}
                <span className="mt-2 font-display text-3xl font-medium text-gt-teal-900">
                  {brand.nom}
                </span>
                <span className="mt-1 text-xs tracking-[0.25em] text-gt-teal-900/75 uppercase">
                  Espace voyageur
                </span>
              </>
            )}
          </Link>

          {tabs ? (
            <nav aria-label="Connexion ou inscription" className="mt-8 grid grid-cols-2 gap-3">
              <Link
                href={tabs.connexion}
                aria-current={tabs.active === "connexion" ? "page" : undefined}
                className={tab(tabs.active === "connexion")}
              >
                Connexion
              </Link>
              <Link
                href={tabs.inscription.href}
                aria-current={tabs.active === "inscription" ? "page" : undefined}
                className={tab(tabs.active === "inscription")}
              >
                {tabs.inscription.label}
              </Link>
            </nav>
          ) : null}

          <h1 className="mt-8 text-3xl font-semibold text-gt-teal-900 sm:text-4xl">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-gt-teal-900/75">{subtitle}</p> : null}
          {notice ? <div className="mt-5">{notice}</div> : null}
          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-6 text-sm text-gt-teal-900/80">{footer}</div> : null}
        </div>
      </section>

      <aside className="hidden bg-white p-4 lg:sticky lg:top-0 lg:block lg:h-dvh">
        <AuthShowcase {...showcase} />
      </aside>
    </main>
  );
}
