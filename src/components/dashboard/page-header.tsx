import type { ReactNode } from "react";

/** Titre de page du back-office, avec une zone d'actions à droite. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-gt-teal-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-gt-teal-900/70">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}
