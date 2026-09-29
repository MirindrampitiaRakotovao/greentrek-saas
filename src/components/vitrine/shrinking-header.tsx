"use client";

import { type ReactNode, useEffect, useState } from "react";

/**
 * En-tête qui se réduit au défilement (§8.5) : au-delà de quelques pixels, l'attribut
 * `data-scrolled` passe à `true` et les enfants réduisent leurs marges et leur logo
 * (variantes Tailwind `group-data-[scrolled=true]/header:…`). Sans JavaScript, l'en-tête
 * reste simplement à sa taille normale.
 */
export function ShrinkingHeader({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled}
      className="group/header sticky top-0 z-[1100] border-b border-gt-mist/60 bg-white/95 backdrop-blur transition-shadow data-[scrolled=true]:shadow-md data-[scrolled=true]:shadow-gt-teal-900/5"
    >
      {children}
    </header>
  );
}
