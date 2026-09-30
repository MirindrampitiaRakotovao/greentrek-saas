"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { logoutAction } from "@/lib/actions/auth";
import { markNotificationsReadAction } from "@/lib/actions/avis";
import type { NavItem } from "@/lib/navigation";

/**
 * Coque commune des espaces connectés (back-office d'agence, console super admin, espace
 * client), d'après la maquette de tableau de bord validée par l'étudiant, aux couleurs
 * Green Trek (§8.2) :
 * - barre latérale : marque, navigation avec l'élément actif en « pilule », encart en bas ;
 * - barre supérieure : titre de la section, recherche de page, notifications, utilisateur ;
 * - pied de page.
 * Sur mobile (§8.5), la barre latérale devient un panneau ouvert par le bouton « Menu ».
 *
 * Toutes les données affichées viennent du serveur (props sérialisables) : ce composant ne
 * fait que la présentation et les interactions.
 */

export type ShellNotification = {
  id: string;
  titre: string;
  message: string;
  lienUrl: string | null;
  at: string; // ISO 8601
  lue: boolean;
};

export type ShellProps = {
  brand: { name: string; tagline: string; href: string };
  nav: readonly NavItem[];
  user: { name: string; subtitle: string };
  promo?: { title: string; text: string; cta?: { label: string; href: string } };
  notifications?: { unread: number; items: readonly ShellNotification[] };
  footerNote: string;
  children: ReactNode;
};

/** Lien actif : correspondance exacte pour la racine, par préfixe sinon (la plus longue gagne). */
function activeHref(pathname: string, nav: readonly NavItem[]): string | undefined {
  return nav
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const notificationDate = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Indian/Antananarivo",
});

export function AppShell({
  brand,
  nav,
  user,
  promo,
  notifications,
  footerNote,
  children,
}: ShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = activeHref(pathname, nav);
  const title = nav.find((item) => item.href === current)?.label ?? brand.name;
  // La zone défilante n'est pas la fenêtre : Next.js ne la remet pas en haut lors d'un
  // changement de page, on le fait ici.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    // Sur ordinateur, la page entière ne défile pas : barre latérale et en-tête restent fixes,
    // seul le contenu du milieu défile (demande de l'étudiant).
    <div className="min-h-screen bg-gt-canvas lg:flex lg:h-dvh lg:overflow-hidden">
      {/* Fond assombri derrière le menu mobile */}
      {menuOpen ? (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-gt-teal-900/40 lg:hidden"
        />
      ) : null}

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-gt-canvas px-4 py-5 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-2">
          <Link href={brand.href} className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-gt-teal-900 text-gt-sand-300">
              <Icon name="leaf" className="size-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-base font-bold tracking-wide text-gt-teal-900 uppercase">
                {brand.name}
              </span>
              <span className="block text-xs text-gt-teal-900/75">{brand.tagline}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Fermer le menu"
            className="rounded-lg p-1.5 text-gt-teal-900 lg:hidden"
          >
            <Icon name="close" />
          </button>
        </div>

        <nav aria-label="Navigation principale" className="mt-8 flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {nav.map((item) => {
              const active = item.href === current;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-gt-teal-200 font-semibold text-gt-teal-900"
                        : "text-gt-teal-900/75 hover:bg-white hover:text-gt-teal-900"
                    }`}
                  >
                    <Icon name={item.icon} className="size-[18px]" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {promo ? (
          <div className="relative mt-4 overflow-hidden rounded-2xl bg-gt-teal-900 p-4 text-white">
            {/* Motif décoratif, comme l'encart « Get Pro » de la maquette */}
            <span
              aria-hidden="true"
              className="absolute -top-6 -right-6 size-20 rounded-full bg-gt-teal-card"
            />
            <span
              aria-hidden="true"
              className="absolute top-6 -right-10 size-16 rounded-full bg-gt-teal-700/70"
            />
            <span className="relative grid size-9 place-items-center rounded-lg bg-white/10">
              <Icon name="sparkles" className="size-5 text-gt-sand-300" />
            </span>
            <p className="relative mt-3 text-sm font-semibold">{promo.title}</p>
            <p className="relative mt-1 text-xs leading-relaxed text-white/80">{promo.text}</p>
            {promo.cta ? (
              <Link
                href={promo.cta.href}
                onClick={() => setMenuOpen(false)}
                className="relative mt-3 inline-flex rounded-lg bg-gt-sand-300 px-4 py-2 text-sm font-semibold text-gt-teal-900 hover:bg-gt-sand-200"
              >
                {promo.cta.label}
              </Link>
            ) : null}
          </div>
        ) : null}

        <form action={logoutAction} className="mt-3 px-2">
          <button
            type="submit"
            className="flex items-center gap-2 text-sm font-medium text-gt-teal-900/75 hover:text-gt-teal-900"
          >
            <Icon name="logout" className="size-4" />
            Se déconnecter
          </button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:h-dvh lg:py-3 lg:pr-3">
        <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-gt-teal-50 lg:min-h-0 lg:overflow-hidden lg:rounded-[28px]">
          <header className="flex flex-wrap items-center gap-3 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-expanded={menuOpen}
              aria-controls="app-sidebar"
              className="grid size-10 place-items-center rounded-full border border-gt-mist bg-white text-gt-teal-900 lg:hidden"
            >
              <Icon name="menu" />
              <span className="sr-only">Menu</span>
            </button>
            <h1 className="mr-auto text-xl font-semibold text-gt-teal-900 sm:text-2xl">{title}</h1>
            <PageSearch nav={nav} />
            {notifications ? <Notifications {...notifications} /> : null}
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-gt-teal-900">{user.name}</p>
                <p className="text-xs text-gt-teal-900/75">{user.subtitle}</p>
              </div>
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-full bg-gt-teal-700 text-sm font-semibold text-white ring-2 ring-white"
              >
                {initials(user.name)}
              </span>
            </div>
          </header>

          {/* Zone défilante : contenu de la page et pied de page. */}
          <div
            ref={scrollRef}
            className="flex min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain"
          >
            <main
              id="contenu"
              tabIndex={-1}
              className="min-w-0 flex-1 px-4 py-5 outline-none sm:px-6 lg:px-8"
            >
              {children}
            </main>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-gt-mist/70 px-4 py-4 text-xs text-gt-teal-900/75 sm:px-6 lg:px-8">
              <p>
                © {new Date().getFullYear()} Green Trek · Projet de fin d&apos;études, ENI
                Fianarantsoa
              </p>
              <p>{footerNote}</p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Recherche de page : filtre les entrées du menu ; Entrée ouvre le premier résultat. */
function PageSearch({ nav }: { nav: readonly NavItem[] }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("fr");
    if (!normalized) return [];
    return nav.filter((item) => item.label.toLocaleLowerCase("fr").includes(normalized));
  }, [nav, query]);

  return (
    <div className="relative order-last w-full sm:order-none sm:w-64">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Rechercher une page
      </label>
      <input
        id={`${listId}-input`}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && results[0]) {
            router.push(results[0].href);
            setQuery("");
          }
          if (event.key === "Escape") setQuery("");
        }}
        placeholder="Rechercher une page…"
        autoComplete="off"
        aria-controls={listId}
        className="w-full rounded-full border border-gt-mist bg-white py-2.5 pr-10 pl-4 text-sm text-gt-teal-900 outline-none placeholder:text-gt-teal-900/45 focus:border-gt-teal-600 focus:ring-2 focus:ring-gt-teal-500/25"
      />
      <Icon
        name="search"
        className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-gt-teal-900/75"
      />
      {query.trim() ? (
        <ul
          id={listId}
          className="absolute top-full right-0 left-0 z-20 mt-2 overflow-hidden rounded-2xl border border-gt-mist bg-white py-1 shadow-lg shadow-gt-teal-900/10"
        >
          {results.length === 0 ? (
            <li className="px-4 py-2 text-sm text-gt-teal-900/75">Aucune page trouvée.</li>
          ) : (
            results.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setQuery("")}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gt-teal-900 hover:bg-gt-teal-50"
                >
                  <Icon name={item.icon} className="size-4" />
                  {item.label}
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Cloche des notifications in-app (table Notification), avec le nombre de non lues. Un clic
 * sur une notification la marque comme lue et ouvre la page concernée.
 */
function Notifications({ unread, items }: { unread: number; items: readonly ShellNotification[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function openItem(item: ShellNotification) {
    setOpen(false);
    if (!item.lue) await markNotificationsReadAction({ ids: [item.id] });
    if (item.lienUrl) router.push(item.lienUrl);
    else router.refresh();
  }

  async function markAll() {
    await markNotificationsReadAction({});
    router.refresh();
  }
  const panelId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="relative grid size-10 place-items-center rounded-full border border-gt-mist bg-white text-gt-teal-900 hover:bg-gt-teal-100"
      >
        <Icon name="bell" className="size-[18px]" />
        <span className="sr-only">
          Notifications{unread > 0 ? ` (${unread} non lue${unread > 1 ? "s" : ""})` : ""}
        </span>
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white"
          >
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id={panelId}
          className="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-gt-mist bg-white p-2 shadow-lg shadow-gt-teal-900/10"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <p className="text-sm font-semibold text-gt-teal-900">Notifications</p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAll}
                className="text-xs font-medium text-gt-teal-700 underline-offset-2 hover:underline"
              >
                Tout marquer comme lu
              </button>
            ) : null}
          </div>
          {items.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-gt-teal-900/75">Aucune notification.</p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className={`block w-full rounded-xl px-3 py-2 text-left hover:bg-gt-teal-50 ${item.lue ? "" : "bg-gt-teal-50/60"}`}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-gt-teal-900">
                      {item.lue ? null : (
                        <span className="size-2 shrink-0 rounded-full bg-gt-chart-1">
                          <span className="sr-only">Non lue :</span>
                        </span>
                      )}
                      {item.titre}
                    </span>
                    <span className="block text-xs text-gt-teal-900/75">{item.message}</span>
                    <span className="mt-0.5 block text-[11px] text-gt-teal-900/75">
                      {notificationDate.format(new Date(item.at))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
