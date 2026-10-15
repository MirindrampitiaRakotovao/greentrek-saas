"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

/**
 * En-tête qui se réduit au défilement (§8.5) : au-delà de quelques pixels, l'attribut
 * `data-scrolled` passe à `true` et les enfants réduisent leurs marges et leur logo
 * (variantes Tailwind `group-data-[scrolled=true]/header:…`).
 *
 * Sur les pages à grande photo d'en-tête (`overlayPaths`, expressions régulières), l'en-tête
 * est TRANSPARENT et posé sur la photo tant qu'on n'a pas défilé (`data-overlay="true"` :
 * textes et logo en blanc), puis redevient blanc dès qu'on défile.
 */
export function ShrinkingHeader({
  children,
  overlayPaths = [],
}: {
  children: ReactNode;
  overlayPaths?: readonly string[];
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const overlayPage = overlayPaths.some((pattern) => new RegExp(pattern).test(pathname));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const transparent = overlayPage && !scrolled;
  return (
    <header
      data-scrolled={scrolled}
      data-overlay={transparent}
      className={`group/header top-0 z-[1100] border-b transition-[background-color,box-shadow,border-color] duration-300 data-[scrolled=true]:shadow-md data-[scrolled=true]:shadow-gt-teal-900/5 ${
        overlayPage ? "fixed inset-x-0" : "sticky"
      } ${
        transparent
          ? "border-transparent bg-transparent"
          : "border-gt-mist/60 bg-white/95 backdrop-blur"
      }`}
    >
      {children}
    </header>
  );
}
