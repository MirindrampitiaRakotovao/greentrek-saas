import type { Metadata } from "next";
import Link from "next/link";

import { FeedList } from "@/components/communaute/feed-list";
import { PublicationForm } from "@/components/communaute/publication-form";
import {
  ActivityCard,
  CommunityNav,
  ProfileCard,
  VoyageursList,
} from "@/components/communaute/sidebar";
import { EmptyState } from "@/components/dashboard/widgets";
import { FormModal } from "@/components/ui/form-modal";
import { Icon } from "@/components/ui/icon";
import { requireClient } from "@/lib/auth/session";
import { formatDateRange } from "@/lib/format";
import {
  communityActivity,
  listDestinations,
  listFeed,
  listSejoursPartageables,
  myCommunityStats,
} from "@/lib/services/communaute";
import { listVoyageurs, nomPublic } from "@/lib/services/voyageurs";
import { feedFiltersSchema, type FeedFilters } from "@/lib/validators/communaute";

export const metadata: Metadata = { title: "Communauté" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Adresse du fil avec des filtres modifiés (les autres sont conservés). */
function feedHref(basePath: string, filters: FeedFilters, change: Partial<FeedFilters>) {
  const next = { ...filters, ...change };
  const params = new URLSearchParams();
  if (next.tri !== "recentes") params.set("tri", next.tri);
  if (next.q) params.set("q", next.q);
  if (next.circuit) params.set("circuit", next.circuit);
  if (next.moi) params.set("moi", "1");
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/**
 * Communauté (étapes 5d et 5e) : fil de photos de séjour commun à toutes les agences, en trois
 * colonnes (profil et voyageurs en ligne ; destinations, onglets et fil infini ; voyageurs à
 * découvrir et activité), une seule colonne sur téléphone.
 */
export default async function CommunautePage({
  params,
  searchParams,
}: PageProps<"/a/[slug]/mon-compte/communaute">) {
  const { slug } = await params;
  const { user, db } = await requireClient(slug, `/a/${slug}/mon-compte/communaute`);
  const basePath = `/a/${slug}/mon-compte/communaute`;
  const query = await searchParams;
  const filters = feedFiltersSchema.parse({
    tri: first(query.tri),
    q: first(query.q),
    circuit: first(query.circuit),
    moi: first(query.moi),
  });

  const [feed, sejours, destinations, stats, activite, voyageurs, profil] = await Promise.all([
    listFeed(user.id, 1, undefined, filters),
    listSejoursPartageables(user.id),
    listDestinations(),
    myCommunityStats(user.id),
    communityActivity(),
    listVoyageurs(db, user.id, undefined, 1),
    db.utilisateur.findUniqueOrThrow({
      where: { id: user.id },
      select: { prenom: true, nom: true, photoUrl: true, agence: { select: { nom: true } } },
    }),
  ]);
  const enLigne = voyageurs.items.filter((v) => v.presence.enLigne).slice(0, 6);
  const aDecouvrir = voyageurs.items.filter((v) => !v.presence.enLigne).slice(0, 5);
  const destination = destinations.find((d) => d.id === filters.circuit);
  const profileProps = {
    nom: nomPublic(profil),
    photo: profil.photoUrl,
    agence: profil.agence?.nom ?? "",
    stats,
  };

  const partager = sejours.length ? (
    <FormModal
      triggerLabel="Partager mes photos"
      triggerIcon="image"
      title="Partager les photos d'un séjour"
      icon="image"
    >
      <PublicationForm
        sejours={sejours.map((s) => ({
          id: s.id,
          label: `${s.circuit} · ${formatDateRange(s.dateDebut, s.dateFin)}`,
        }))}
      />
    </FormModal>
  ) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] xl:grid-cols-[230px_minmax(0,1fr)_260px]">
      {/* ── Colonne de gauche : profil, menu, voyageurs en ligne ── */}
      <aside className="hidden space-y-5 xl:block">
        <ProfileCard {...profileProps} />
        <CommunityNav basePath={basePath} slug={slug} moi={!!filters.moi} />
        <VoyageursList
          titre="Voyageurs en ligne"
          voyageurs={enLigne}
          slug={slug}
          vide="Personne n'est en ligne pour l'instant."
        />
      </aside>

      {/* ── Centre : recherche, destinations, onglets, fil ── */}
      <div className="min-w-0 space-y-5">
        <h1 className="sr-only">Communauté</h1>
        <div className="xl:hidden">
          <ProfileCard {...profileProps} compact />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <form
            method="get"
            action={basePath}
            role="search"
            className="relative min-w-0 basis-full sm:flex-1 sm:basis-auto"
          >
            <label htmlFor="recherche-communaute" className="sr-only">
              Rechercher dans la communauté
            </label>
            <Icon
              name="search"
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-gt-teal-900/50"
            />
            <input
              id="recherche-communaute"
              name="q"
              type="search"
              defaultValue={filters.q ?? ""}
              placeholder="Rechercher un circuit, une agence, un mot…"
              className="w-full rounded-full border border-gt-mist bg-white py-2.5 pr-4 pl-10 text-sm"
            />
            {filters.tri !== "recentes" ? (
              <input type="hidden" name="tri" value={filters.tri} />
            ) : null}
          </form>
          {partager}
        </div>

        {destinations.length ? (
          <section aria-labelledby="titre-destinations">
            <div className="mb-2 flex items-center justify-between">
              <h2 id="titre-destinations" className="font-display text-xl text-gt-teal-900">
                Destinations
              </h2>
              {filters.circuit ? (
                <Link
                  href={feedHref(basePath, filters, { circuit: undefined })}
                  className="text-xs font-semibold text-gt-teal-700 hover:underline"
                >
                  Toutes les destinations
                </Link>
              ) : null}
            </div>
            <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
              {destinations.map((d) => {
                const active = d.id === filters.circuit;
                return (
                  <li key={d.id} className="w-20 shrink-0">
                    <Link
                      href={feedHref(basePath, filters, { circuit: active ? undefined : d.id })}
                      aria-current={active ? "true" : undefined}
                      title={`${d.titre} (${d.agence})`}
                      className="group flex flex-col items-center gap-1.5 text-center"
                    >
                      <span
                        className={`rounded-full p-[3px] ${
                          active
                            ? "bg-gt-teal-800"
                            : "bg-gradient-to-tr from-gt-teal-700 via-gt-teal-500 to-gt-sand-300"
                        }`}
                      >
                        <span className="block rounded-full bg-white p-[2px]">
                          {/* eslint-disable-next-line @next/next/no-img-element -- images réduites */}
                          <img
                            src={d.photo ?? "/logo/green-trek-symbole.png"}
                            alt=""
                            className="size-16 rounded-full object-cover transition-transform group-hover:scale-105"
                          />
                        </span>
                      </span>
                      <span
                        className={`line-clamp-2 text-[11px] leading-tight ${
                          active ? "font-semibold text-gt-teal-800" : "text-gt-teal-900"
                        }`}
                      >
                        {d.titre}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-gt-teal-900">
            {filters.moi
              ? "Mes publications"
              : destination
                ? destination.titre
                : filters.q
                  ? `Résultats pour « ${filters.q} »`
                  : "Publications"}
          </h2>
          <nav
            aria-label="Trier les publications"
            className="flex rounded-full bg-white p-1 ring-1 ring-gt-mist/70"
          >
            {(
              [
                ["populaires", "Populaires"],
                ["recentes", "Récentes"],
              ] as const
            ).map(([tri, label]) => (
              <Link
                key={tri}
                href={feedHref(basePath, filters, { tri })}
                aria-current={filters.tri === tri ? "page" : undefined}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                  filters.tri === tri
                    ? "bg-gt-teal-700 text-white"
                    : "text-gt-teal-900 hover:bg-gt-teal-50"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {sejours.length === 0 && !filters.moi ? (
          <p className="rounded-2xl bg-gt-teal-50 p-4 text-sm text-gt-teal-900">
            Vous pourrez partager vos photos ici une fois votre premier séjour terminé.
          </p>
        ) : null}

        {feed.total === 0 ? (
          <EmptyState>
            {filters.moi
              ? "Vous n'avez encore rien publié."
              : filters.q || filters.circuit
                ? "Aucune publication ne correspond."
                : "Aucune publication pour l'instant."}
          </EmptyState>
        ) : (
          <FeedList
            key={JSON.stringify(filters)}
            initial={feed.items}
            hasMore={feed.pageCount > 1}
            filters={filters}
            basePath={basePath}
          />
        )}
      </div>

      {/* ── Colonne de droite : voyageurs à découvrir, activité ── */}
      <aside className="hidden space-y-5 lg:block">
        <div className="xl:hidden">
          <VoyageursList
            titre="Voyageurs en ligne"
            voyageurs={enLigne}
            slug={slug}
            vide="Personne n'est en ligne pour l'instant."
          />
        </div>
        <VoyageursList
          titre="Voyageurs à découvrir"
          voyageurs={aDecouvrir}
          slug={slug}
          vide="Aucun autre voyageur pour l'instant."
        />
        <ActivityCard
          activite={activite}
          auteurs={feed.items.map((p) => ({ nom: p.auteur.nom, photo: p.auteur.photo }))}
          slug={slug}
        />
      </aside>
    </div>
  );
}
