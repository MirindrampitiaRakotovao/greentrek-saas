import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Icon, type IconName } from "@/components/ui/icon";
import { PresenceAvatar, presenceText } from "@/components/ui/presence-avatar";
import type { VoyageurCard } from "@/lib/services/voyageurs";

/** Carte de profil de la communauté : photo, nom, agence et mes chiffres. */
export function ProfileCard({
  nom,
  photo,
  agence,
  stats,
  compact = false,
}: {
  nom: string;
  photo: string | null;
  agence: string;
  stats: { publications: number; jaimes: number; commentaires: number };
  compact?: boolean;
}) {
  const chiffres = [
    { n: stats.publications, label: "Publications" },
    { n: stats.jaimes, label: "J'aime reçus" },
    { n: stats.commentaires, label: "Commentaires" },
  ];
  return (
    <section
      aria-label="Mon profil dans la communauté"
      className={`rounded-3xl bg-white ring-1 ring-gt-mist/60 ${compact ? "flex items-center gap-4 p-4" : "p-5 text-center"}`}
    >
      <div className={compact ? "shrink-0" : "flex justify-center"}>
        <span className="inline-flex rounded-full p-0.5 ring-2 ring-gt-teal-600">
          <Avatar name={nom} src={photo} size={compact ? 52 : 76} />
        </span>
      </div>
      <div className={compact ? "min-w-0 flex-1" : "mt-3"}>
        <p className="font-display text-lg text-gt-teal-900">{nom}</p>
        <p className="text-xs text-gt-teal-900/70">Voyageur · {agence}</p>
        <dl
          className={`grid grid-cols-3 gap-1 ${compact ? "mt-2" : "mt-4 border-y border-gt-mist/70 py-3"}`}
        >
          {chiffres.map((c) => (
            <div key={c.label} className="flex flex-col-reverse">
              <dt className="text-[11px] text-gt-teal-900/70">{c.label}</dt>
              <dd className="font-display text-lg font-semibold text-gt-teal-900">{c.n}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** Menu de la communauté : fil, mes publications et liens utiles. */
export function CommunityNav({
  basePath,
  slug,
  moi,
}: {
  basePath: string;
  slug: string;
  moi: boolean;
}) {
  const items: { href: string; label: string; icon: IconName; active?: boolean }[] = [
    { href: basePath, label: "Fil de la communauté", icon: "home", active: !moi },
    { href: `${basePath}?moi=1`, label: "Mes publications", icon: "image", active: moi },
    { href: `/a/${slug}/mon-compte/voyageurs`, label: "Voyageurs", icon: "users" },
    { href: `/a/${slug}/mon-compte/messages`, label: "Messages", icon: "message" },
  ];
  return (
    <nav aria-label="Communauté" className="rounded-3xl bg-white p-2 ring-1 ring-gt-mist/60">
      <ul>
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              aria-current={it.active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium ${
                it.active
                  ? "bg-gt-teal-50 text-gt-teal-800"
                  : "text-gt-teal-900/80 hover:bg-gt-teal-50"
              }`}
            >
              <Icon name={it.icon} className="size-5" />
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Liste de voyageurs de l'agence (en ligne, ou à découvrir) avec « Écrire ». */
export function VoyageursList({
  titre,
  voyageurs,
  slug,
  vide,
}: {
  titre: string;
  voyageurs: VoyageurCard[];
  slug: string;
  vide: string;
}) {
  return (
    <section aria-label={titre} className="rounded-3xl bg-white p-4 ring-1 ring-gt-mist/60">
      <h2 className="mb-3 font-display text-base text-gt-teal-900">{titre}</h2>
      {voyageurs.length === 0 ? (
        <p className="text-sm text-gt-teal-900/70">{vide}</p>
      ) : (
        <ul className="space-y-3">
          {voyageurs.map((v) => (
            <li key={v.id} className="flex items-center gap-3">
              <PresenceAvatar name={v.nom} src={v.photo} presence={v.presence} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gt-teal-900">{v.nom}</p>
                <p className="truncate text-[11px] text-gt-teal-900/70">
                  {presenceText(v.presence) ?? "Même agence que vous"}
                </p>
              </div>
              <Link
                href={`/a/${slug}/mon-compte/voyageurs?q=${encodeURIComponent(v.nom.split(" ")[0] ?? "")}`}
                aria-label={`Écrire à ${v.nom}`}
                className="flex size-9 items-center justify-center rounded-full text-gt-teal-700 hover:bg-gt-teal-50"
              >
                <Icon name="message" className="size-5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={`/a/${slug}/mon-compte/voyageurs`}
        className="mt-3 block text-center text-xs font-semibold text-gt-teal-700 hover:underline"
      >
        Voir tous les voyageurs
      </Link>
    </section>
  );
}

/** Carte « Activité de la communauté » et liens de pied de colonne. */
export function ActivityCard({
  activite,
  auteurs,
  slug,
}: {
  activite: { publications: number; voyageurs: number; agences: number };
  auteurs: { nom: string; photo: string | null }[];
  slug: string;
}) {
  return (
    <>
      <section
        aria-label="Activité de la communauté"
        className="rounded-3xl bg-gt-teal-800 p-5 text-white"
      >
        <div className="flex -space-x-2" aria-hidden="true">
          {auteurs.slice(0, 6).map((a, i) => (
            <span key={`${a.nom}-${i}`} className="rounded-full ring-2 ring-gt-teal-800">
              <Avatar name={a.nom} src={a.photo} size={30} />
            </span>
          ))}
        </div>
        <p className="mt-3 font-display text-3xl">{activite.publications}</p>
        <p className="text-sm text-white/85">
          publications de {activite.voyageurs} voyageurs, avec {activite.agences} agence
          {activite.agences > 1 ? "s" : ""}
        </p>
      </section>
      <p className="px-2 text-xs leading-relaxed text-gt-teal-900/65">
        <Link href={`/a/${slug}/credits-photos`} className="hover:underline">
          Crédits photos
        </Link>{" "}
        ·{" "}
        <Link href={`/a/${slug}/mon-compte/profil#confidentialite`} className="hover:underline">
          Confidentialité
        </Link>{" "}
        · Contenus signalés examinés par l&apos;équipe Green Trek
      </p>
    </>
  );
}
