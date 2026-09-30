import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { getCurrentUser } from "@/lib/auth/session";
import { ShrinkingHeader } from "@/components/vitrine/shrinking-header";
import type { VitrineAgency } from "@/lib/public-agency";

/**
 * En-tête du site vitrine (§8.4, section 1) : logo et nom de l'agence, liens, accès au
 * compte ; il se réduit au défilement (§8.5). Sur mobile, le menu est un `<details>` natif :
 * il fonctionne sans JavaScript et au clavier.
 */
export async function SiteHeader({ agence }: { agence: VitrineAgency }) {
  const user = await getCurrentUser();
  const base = `/a/${agence.slug}`;
  const isClient = user?.role === "CLIENT" && user.agenceSlug === agence.slug;
  const links = [
    { href: `${base}/circuits`, label: "Circuits" },
    { href: `${base}#experiences`, label: "Expériences" },
    { href: `${base}#departs`, label: "Départs" },
    { href: `${base}#partenaires`, label: "Partenaires" },
    { href: `${base}#avis`, label: "Avis" },
    { href: `${base}#contact`, label: "Contact" },
  ];
  const account = isClient
    ? { href: `${base}/mon-compte`, label: "Mon compte" }
    : { href: `${base}/connexion`, label: "Connexion" };

  return (
    <ShrinkingHeader>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 transition-[padding] group-data-[scrolled=true]/header:py-2 sm:px-6 sm:py-4">
        <Link href={base} className="flex min-w-0 items-center gap-2.5">
          {agence.logoUrl ? (
            // Logo saisi par l'agence (adresse externe).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={agence.logoUrl}
              alt=""
              className="size-10 rounded-xl object-cover transition-[width,height] group-data-[scrolled=true]/header:size-8"
            />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gt-teal-700 text-white transition-[width,height] group-data-[scrolled=true]/header:size-8">
              <Icon name="leaf" className="size-5" />
            </span>
          )}
          <span className="truncate font-display text-lg font-medium text-gt-teal-900">
            {agence.nom}
          </span>
        </Link>

        <nav aria-label="Navigation principale" className="hidden items-center gap-6 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gt-teal-900/80 hover:text-gt-teal-700"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={account.href}
            className="rounded-full bg-gt-teal-700 px-5 py-2 text-sm font-medium text-white hover:bg-gt-teal-800"
          >
            {account.label}
          </Link>
        </nav>

        <details className="group relative lg:hidden">
          <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-full border border-gt-mist text-gt-teal-900 [&::-webkit-details-marker]:hidden">
            <span className="sr-only">Menu</span>
            <Icon name="menu" className="size-5 group-open:hidden" />
            <Icon name="close" className="hidden size-5 group-open:block" />
          </summary>
          <nav
            aria-label="Navigation principale"
            className="absolute right-0 mt-2 w-60 rounded-2xl border border-gt-mist/70 bg-white p-2 shadow-xl shadow-gt-teal-900/10"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-xl px-3 py-2.5 text-sm font-medium text-gt-teal-900 hover:bg-gt-teal-50"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={account.href}
              className="mt-1 block rounded-xl bg-gt-teal-700 px-3 py-2.5 text-center text-sm font-medium text-white"
            >
              {account.label}
            </Link>
          </nav>
        </details>
      </div>
    </ShrinkingHeader>
  );
}
