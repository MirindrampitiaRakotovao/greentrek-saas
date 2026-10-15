"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/icon";

export type ShowcaseSlide = { src: string; alt: string; credit: string | null };

/**
 * Grand panneau photo des pages de connexion et d'inscription (d'après la maquette fournie
 * par l'étudiant) : coins « découpés » en haut à gauche et en bas à droite, carte de texte,
 * accroche, flèches pour changer de photo, crédit de la photo affichée (licences libres).
 * Défilement automatique toutes les 7 s, désactivé si l'utilisateur préfère moins d'animations.
 */
export function AuthShowcase({
  slides,
  card,
  headline,
  cta,
}: {
  slides: readonly ShowcaseSlide[];
  card: { title: string; text: string };
  headline: string;
  cta: { label: string; href: string };
}) {
  const [index, setIndex] = useState(0);
  const count = slides.length;
  const go = (delta: number) => setIndex((i) => (i + delta + count) % count);

  useEffect(() => {
    if (count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), 7000);
    return () => window.clearInterval(timer);
  }, [count]);

  const current = slides[index];
  // Coin concave : quart de cercle transparent, le reste de la couleur de la page.
  const concave = (at: string) => ({
    background: `radial-gradient(circle at ${at}, transparent 31.5px, #ffffff 32px)`,
  });

  return (
    // Coins haut-gauche et bas-droit non arrondis : ils sont recouverts par les découpes
    // (sinon le bord arrondi resterait visible en fin liseré).
    <div className="relative h-full overflow-hidden rounded-tr-[2.5rem] rounded-bl-[2.5rem] bg-gt-teal-900">
      {slides.map((s, i) => (
        <Image
          key={s.src}
          src={s.src}
          alt={i === index ? s.alt : ""}
          fill
          priority={i === 0}
          sizes="50vw"
          className={`object-cover transition-opacity duration-700 motion-reduce:transition-none ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      {/* Voile pour la lisibilité du texte blanc en bas. */}
      <div className="absolute inset-0 bg-linear-to-t from-gt-teal-900/70 via-transparent to-transparent" />

      {/* Coin découpé en haut à gauche. */}
      <span
        aria-hidden="true"
        className="absolute top-0 left-0 h-[72px] w-[34%] rounded-br-[32px] bg-white"
      />
      <span
        aria-hidden="true"
        className="absolute top-0 left-[34%] size-8"
        style={concave("100% 100%")}
      />
      <span
        aria-hidden="true"
        className="absolute top-[72px] left-0 size-8"
        style={concave("100% 100%")}
      />
      {/* Coin découpé en bas à droite. */}
      <span
        aria-hidden="true"
        className="absolute right-0 bottom-0 h-16 w-[30%] rounded-tl-[32px] bg-white"
      />
      <span
        aria-hidden="true"
        className="absolute right-[30%] bottom-0 size-8"
        style={concave("0 0")}
      />
      <span
        aria-hidden="true"
        className="absolute right-0 bottom-16 size-8"
        style={concave("0 0")}
      />

      {/* Carte de texte en haut à droite. */}
      <div className="absolute top-8 right-8 max-w-[19rem] rounded-2xl bg-white/95 p-5 shadow-lg backdrop-blur">
        <p className="font-display text-xl leading-snug font-medium text-gt-teal-900">
          {card.title}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-gt-teal-900/75">{card.text}</p>
        <Link
          href={cta.href}
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gt-teal-700 hover:underline"
        >
          {cta.label}
          <Icon name="arrowRight" className="size-4" />
        </Link>
      </div>

      {/* Accroche en bas, au-dessus du coin découpé. */}
      <div className="absolute right-10 bottom-24 left-10 text-right">
        <p className="ml-auto max-w-md font-display text-4xl leading-tight font-medium text-white drop-shadow xl:text-5xl">
          {headline}
        </p>
      </div>

      {/* Flèches et crédit de la photo, en bas à gauche. */}
      <div className="absolute bottom-6 left-8 flex max-w-[60%] items-center gap-3">
        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="grid size-11 shrink-0 place-items-center rounded-full border border-white/80 bg-white/10 text-white backdrop-blur hover:bg-white/25"
            >
              <Icon name="arrowLeft" className="size-5" />
              <span className="sr-only">Photo précédente</span>
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="grid size-11 shrink-0 place-items-center rounded-full border border-white/80 bg-white/10 text-white backdrop-blur hover:bg-white/25"
            >
              <Icon name="arrowRight" className="size-5" />
              <span className="sr-only">Photo suivante</span>
            </button>
          </>
        ) : null}
        {current?.credit ? (
          <p className="text-[11px] leading-snug text-white/85" aria-live="polite">
            {current.credit}
          </p>
        ) : null}
      </div>
    </div>
  );
}
