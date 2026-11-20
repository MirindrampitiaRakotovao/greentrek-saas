"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { PublicationCard } from "@/components/communaute/publication-card";
import { loadFeedPageAction } from "@/lib/actions/communaute";
import type { PublicationCard as Card } from "@/lib/services/communaute";
import type { FeedFilters } from "@/lib/validators/communaute";

/**
 * Fil à défilement infini : la page suivante se charge quand le bas du fil approche (et par
 * le bouton « Afficher plus », pour le clavier ou si le chargement automatique échoue).
 */
export function FeedList({
  initial,
  hasMore: initialHasMore,
  filters,
  basePath,
}: {
  initial: Card[];
  hasMore: boolean;
  filters: FeedFilters;
  basePath: string;
}) {
  const [items, setItems] = useState(initial);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const sentinel = useRef<HTMLDivElement>(null);

  function loadMore() {
    if (pending || !hasMore) return;
    setError(undefined);
    startTransition(async () => {
      const result = await loadFeedPageAction({ ...filters, page: page + 1 });
      if ("error" in result) return setError(result.error);
      setItems((current) => {
        const seen = new Set(current.map((p) => p.id));
        return [...current, ...result.items.filter((p) => !seen.has(p.id))];
      });
      setPage(page + 1);
      setHasMore(result.hasMore);
    });
  }

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  });

  return (
    <div className="space-y-5">
      {items.map((p) => (
        <PublicationCard
          key={p.id}
          p={p}
          basePath={basePath}
          onDeleted={() => setItems((current) => current.filter((x) => x.id !== p.id))}
        />
      ))}
      <div ref={sentinel} aria-live="polite" className="flex flex-col items-center gap-2 py-4">
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {hasMore ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={pending}
            className="rounded-full border border-gt-teal-700 px-4 py-2 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50"
          >
            {pending ? "Chargement…" : "Afficher plus"}
          </button>
        ) : items.length ? (
          <p className="text-sm text-gt-teal-900/60">Vous avez tout vu.</p>
        ) : null}
      </div>
    </div>
  );
}
