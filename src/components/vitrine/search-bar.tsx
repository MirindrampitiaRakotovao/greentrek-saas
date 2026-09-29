import { Icon } from "@/components/ui/icon";
import { DIFFICULTE_LABELS, DIFFICULTES } from "@/lib/validators/circuits";
import { MAX_VOYAGEURS, type VitrineSearch } from "@/lib/validators/vitrine";

/**
 * Barre de recherche flottante (§8.4, section 3) : date de départ, nombre de voyageurs,
 * difficulté. Formulaire GET vers la page des circuits : fonctionne sans JavaScript, et la
 * recherche se partage par son adresse. Les libellés restent visibles (accessibilité).
 */
export function SearchBar({
  agenceSlug,
  search = {},
  today,
  className = "",
}: {
  agenceSlug: string;
  search?: VitrineSearch;
  /** « AAAA-MM-JJ » du jour (Madagascar), borne minimale de la date. */
  today: string;
  className?: string;
}) {
  const field =
    "mt-1 block w-full rounded-xl border border-gt-mist bg-white px-3 py-2.5 text-sm text-gt-teal-900 outline-none focus:border-gt-teal-600 focus:ring-2 focus:ring-gt-teal-500/30";
  const label = "flex items-center gap-1.5 text-xs font-semibold text-gt-teal-900/75";
  return (
    <form
      method="get"
      action={`/a/${agenceSlug}/circuits`}
      role="search"
      aria-label="Rechercher un circuit"
      className={`grid gap-3 rounded-3xl bg-white p-4 shadow-xl shadow-gt-teal-900/10 sm:grid-cols-2 sm:p-5 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end ${className}`}
    >
      <div>
        <label htmlFor="recherche-date" className={label}>
          <Icon name="calendar" className="size-4 text-gt-teal-700" />
          Partir à partir du
        </label>
        <input
          id="recherche-date"
          type="date"
          name="date"
          min={today}
          defaultValue={search.date ?? ""}
          className={field}
        />
      </div>
      <div>
        <label htmlFor="recherche-voyageurs" className={label}>
          <Icon name="users" className="size-4 text-gt-teal-700" />
          Voyageurs
        </label>
        <input
          id="recherche-voyageurs"
          type="number"
          name="voyageurs"
          min={1}
          max={MAX_VOYAGEURS}
          inputMode="numeric"
          placeholder="Nombre"
          defaultValue={search.voyageurs ?? ""}
          className={field}
        />
      </div>
      <div>
        <label htmlFor="recherche-difficulte" className={label}>
          <Icon name="mountain" className="size-4 text-gt-teal-700" />
          Difficulté
        </label>
        <select
          id="recherche-difficulte"
          name="difficulte"
          defaultValue={search.difficulte ?? ""}
          className={field}
        >
          <option value="">Toutes</option>
          {DIFFICULTES.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTE_LABELS[d]}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="flex items-center justify-center gap-2 rounded-full bg-gt-teal-700 px-6 py-3 text-sm font-semibold text-white hover:bg-gt-teal-800 sm:col-span-2 lg:col-span-1"
      >
        <Icon name="search" className="size-4" />
        Rechercher
      </button>
    </form>
  );
}
