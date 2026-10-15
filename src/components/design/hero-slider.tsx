"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";

export type HeroSlide = {
  image: string;
  alt: string;
  /** Crédit de la photo (licence libre), affiché en bas à droite. */
  credit: string | null;
  /** Mot manuscrit posé sur le titre (ex. « explorez »). */
  accent: string;
  title: string;
  text: string | null;
  cta: { label: string; href: string };
  /** Information courte en bas à droite (ex. durée et prix). */
  meta?: string;
};

/** Taille du grand titre selon sa longueur (une ou deux lignes, jamais de débordement). */
function titleSize(title: string): string {
  if (title.length <= 10) return "text-[clamp(3.5rem,12vw,10rem)]";
  if (title.length <= 20) return "text-[clamp(2.75rem,8vw,7rem)]";
  return "text-[clamp(2.25rem,6vw,5.5rem)]";
}

/**
 * Hero plein écran (d'après la maquette choisie par l'étudiant) : grande photo, mot
 * manuscrit sur un titre géant en dégradé, texte à gauche souligné d'une barre, bouton à
 * contour à droite, compteur « 01 / 04 » et flèches en bas. Diaporama automatique (8 s),
 * désactivé si l'utilisateur préfère moins d'animations ; le titre est le `h1` de la page.
 */
export function HeroSlider({ slides, label }: { slides: readonly HeroSlide[]; label: string }) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);

  useEffect(() => {
    if (count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), 8000);
    return () => window.clearInterval(timer);
  }, [count, index]);

  const slide = slides[index];
  if (!slide) return null;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section
      aria-roledescription="carrousel"
      aria-label={label}
      className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-gt-teal-900 text-white"
    >
      {slides.map((s, i) => (
        <Image
          key={s.image}
          src={s.image}
          alt={i === index ? s.alt : ""}
          fill
          priority={i === 0}
          sizes="100vw"
          className={`-z-10 object-cover transition-opacity duration-1000 motion-reduce:transition-none ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      {/* Voiles : lisibilité du texte blanc quelle que soit la photo. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black/35" />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-b from-black/55 via-transparent to-black/70"
      />

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pt-28 pb-8 text-center sm:px-6">
        <div key={index} className="gt-hero-in">
          <p
            aria-hidden="true"
            className="relative z-10 -mb-[0.18em] translate-x-[18%] -rotate-6 font-script text-[clamp(2.75rem,7vw,6rem)] leading-none text-gt-sand-300 drop-shadow-lg"
          >
            {slide.accent}
          </p>
          <h1
            className={`mx-auto max-w-5xl bg-linear-to-b from-white via-white/90 to-white/55 bg-clip-text font-display leading-[0.95] font-bold tracking-tight text-balance text-transparent ${titleSize(slide.title)}`}
          >
            <span className="sr-only">{slide.accent} : </span>
            {slide.title}
          </h1>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          {slide.text ? (
            <p className="max-w-sm border-l-2 border-white/80 pl-4 text-left text-sm leading-relaxed text-white/90 sm:text-base">
              {slide.text}
            </p>
          ) : (
            <span />
          )}
          <Link
            href={slide.cta.href}
            className="inline-flex items-center gap-2 self-start rounded-full border border-white/85 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-gt-teal-900 sm:self-auto"
          >
            <Icon name="play" className="size-3.5 text-gt-sand-300" />
            {slide.cta.label}
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <p className="font-display text-sm text-white/80" aria-live="polite">
              <span className="text-2xl font-bold text-white">{pad(index + 1)}</span> / {pad(count)}
              <span className="sr-only">, diapositive affichée</span>
            </p>
            {count > 1 ? (
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="grid size-10 place-items-center rounded-full border border-white/60 text-white hover:bg-white/15"
                >
                  <Icon name="arrowLeft" className="size-4" />
                  <span className="sr-only">Diapositive précédente</span>
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="grid size-10 place-items-center rounded-full border border-white/60 text-white hover:bg-white/15"
                >
                  <Icon name="arrowRight" className="size-4" />
                  <span className="sr-only">Diapositive suivante</span>
                </button>
              </span>
            ) : null}
          </div>
          <div className="max-w-md text-right">
            {slide.meta ? <p className="text-sm font-medium text-white">{slide.meta}</p> : null}
            {slide.credit ? <p className="mt-1 text-[11px] text-white/75">{slide.credit}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
