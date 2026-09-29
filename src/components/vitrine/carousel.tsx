"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";

/**
 * Carrousel de cartes (§8.4, sections 4 et 8) : défilement horizontal natif avec
 * accrochage (glisser au doigt sur mobile, molette ou clavier), et flèches pour la souris.
 * Les flèches se désactivent aux extrémités ; le défilement est instantané si l'utilisateur
 * a demandé moins d'animations (`prefers-reduced-motion`). Les éléments restent une liste :
 * sans JavaScript, la liste défile quand même.
 */
export function Carousel({ label, children }: { label: string; children: ReactNode }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const update = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    setAtStart(list.scrollLeft <= 4);
    setAtEnd(list.scrollLeft + list.clientWidth >= list.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    update();
    list.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      list.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  function scroll(direction: 1 | -1) {
    const list = listRef.current;
    if (!list) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollBy({
      left: direction * list.clientWidth * 0.9,
      behavior: reduce ? "auto" : "smooth",
    });
  }

  const arrow =
    "grid size-11 place-items-center rounded-full bg-gt-teal-700 text-white shadow-lg transition hover:bg-gt-teal-800 disabled:pointer-events-none disabled:opacity-0";

  return (
    <div role="region" aria-roledescription="carrousel" aria-label={label} className="relative">
      <ul
        ref={listRef}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-6 overflow-x-auto scroll-smooth px-4 pt-2 pb-6 motion-reduce:scroll-auto sm:-mx-6 sm:scroll-px-6 sm:px-6 [&::-webkit-scrollbar]:hidden [&>li]:shrink-0 [&>li]:basis-[82%] [&>li]:snap-start sm:[&>li]:basis-[calc(50%-12px)] lg:[&>li]:basis-[calc((100%-48px)/3)]"
      >
        {children}
      </ul>
      <div className="pointer-events-none absolute inset-y-0 -left-2 hidden items-center sm:flex lg:-left-5">
        <button
          type="button"
          onClick={() => scroll(-1)}
          disabled={atStart}
          aria-label="Précédent"
          className={`pointer-events-auto ${arrow}`}
        >
          <Icon name="arrowRight" className="size-5 rotate-180" />
        </button>
      </div>
      <div className="pointer-events-none absolute inset-y-0 -right-2 hidden items-center sm:flex lg:-right-5">
        <button
          type="button"
          onClick={() => scroll(1)}
          disabled={atEnd}
          aria-label="Suivant"
          className={`pointer-events-auto ${arrow}`}
        >
          <Icon name="arrowRight" className="size-5" />
        </button>
      </div>
    </div>
  );
}
