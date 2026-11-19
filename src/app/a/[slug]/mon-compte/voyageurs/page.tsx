import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { EmptyState } from "@/components/dashboard/widgets";
import { FormModal } from "@/components/ui/form-modal";
import { PresenceAvatar, presenceText } from "@/components/ui/presence-avatar";
import { Avatar } from "@/components/ui/avatar";
import { BlockButton } from "@/components/voyageurs/block-button";
import { WriteForm } from "@/components/voyageurs/write-form";
import { requireClient } from "@/lib/auth/session";
import { parsePage } from "@/lib/pagination";
import { listBlocked, listVoyageurs } from "@/lib/services/voyageurs";

export const metadata: Metadata = { title: "Voyageurs" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Voyageurs de l'agence (étape 5c) : ceux qui acceptent les messages, avec leur présence ;
 * écrire, bloquer. Prénom, initiale et photo seulement.
 */
export default async function VoyageursPage({
  params,
  searchParams,
}: PageProps<"/a/[slug]/mon-compte/voyageurs">) {
  const { slug } = await params;
  const { user, db } = await requireClient(slug, `/a/${slug}/mon-compte/voyageurs`);
  const query = await searchParams;
  const q = first(query.q)?.trim().slice(0, 100) || undefined;
  const [list, bloques] = await Promise.all([
    listVoyageurs(db, user.id, q, parsePage(query.page)),
    listBlocked(db, user.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voyageurs"
        description="Échangez avec les autres voyageurs de l'agence : conseils, souvenirs, randonnées à plusieurs."
      />
      <form method="get" className="flex max-w-md gap-2">
        <label htmlFor="recherche-voyageur" className="sr-only">
          Rechercher un voyageur
        </label>
        <input
          id="recherche-voyageur"
          name="q"
          type="search"
          defaultValue={q ?? ""}
          placeholder="Prénom ou nom"
          className="min-w-0 flex-1 rounded-full border border-gt-mist bg-white px-4 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-full border border-gt-teal-700 px-4 py-2 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50"
        >
          Rechercher
        </button>
      </form>
      {list.total === 0 ? (
        <EmptyState>Aucun voyageur ne correspond.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.items.map((v) => (
            <li
              key={v.id}
              className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-gt-mist/70"
            >
              <PresenceAvatar name={v.nom} src={v.photo} presence={v.presence} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-gt-teal-900">{v.nom}</p>
                <p className="text-xs text-gt-teal-900/75">{presenceText(v.presence) ?? " "}</p>
              </div>
              <FormModal
                triggerLabel="Écrire"
                triggerIcon="message"
                variant="secondary"
                title={`Écrire à ${v.nom}`}
                icon="message"
              >
                <WriteForm destinataireId={v.id} />
              </FormModal>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        basePath={`/a/${slug}/mon-compte/voyageurs`}
        page={list.page}
        pageCount={list.pageCount}
        params={{ q }}
      />
      {bloques.length > 0 ? (
        <section aria-labelledby="bloques" className="space-y-3">
          <h2 id="bloques" className="text-lg font-semibold text-gt-teal-900">
            Voyageurs bloqués
          </h2>
          <ul className="space-y-2">
            {bloques.map((b) => (
              <li key={b.id} className="flex items-center gap-3">
                <Avatar name={b.nom} src={b.photo} size={32} />
                <span className="flex-1 text-sm text-gt-teal-900">{b.nom}</span>
                <BlockButton id={b.id} nom={b.nom} bloque />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-sm text-gt-teal-900/75">
        Vos réglages (apparaître ici, montrer quand vous êtes en ligne) sont dans{" "}
        <Link href={`/a/${slug}/mon-compte/profil`} className="font-medium underline">
          Mon profil
        </Link>
        .
      </p>
    </div>
  );
}
