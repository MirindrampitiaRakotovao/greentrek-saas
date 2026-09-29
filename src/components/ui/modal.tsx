"use client";

import { createContext, type ReactNode, useContext, useEffect, useId, useRef } from "react";

import { Icon, type IconName } from "@/components/ui/icon";

/**
 * Fenêtre modale (demande de l'étudiant, d'après une maquette) : carte blanche arrondie,
 * en-tête clair avec quadrillage léger, pictogramme, titre et sous-titre, bouton fermer.
 *
 * Élément natif `<dialog>` ouvert par `showModal()` : le navigateur rend le reste de la page
 * inerte (ni clic ni tabulation derrière), place le focus dans la modale, le rend à l'élément
 * d'origine à la fermeture, et ferme avec la touche Échap. Un clic sur le fond ferme aussi.
 * La modale peut être placée dans une cellule de tableau (bouton « Modifier » d'une ligne) :
 * alignement, taille et retours à la ligne du texte sont réinitialisés pour ne rien hériter.
 */
const ModalContext = createContext<{ close: () => void } | null>(null);

/** Pour un formulaire affiché dans une modale : la fermer après un enregistrement réussi. */
export function useModal() {
  return useContext(ModalContext);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  icon = "pencil",
  tone = "default",
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: IconName;
  tone?: "default" | "danger";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" } as const;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // Échap : le navigateur annule le dialogue ; on garde l'état React synchronisé.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // Clic sur le fond (hors de la carte) : fermeture.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={`gt-modal m-auto w-[calc(100%-2rem)] text-left text-base font-normal whitespace-normal normal-case ${widths[size]} max-h-[calc(100dvh-2rem)] overflow-hidden rounded-3xl bg-white p-0 text-gt-teal-900 shadow-2xl shadow-gt-teal-900/25 backdrop:bg-gt-teal-900/35 backdrop:backdrop-blur-[2px]`}
    >
      {open ? (
        <ModalContext.Provider value={{ close: onClose }}>
          <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
            <header
              className={`gt-modal-header relative shrink-0 px-6 pt-6 pb-5 ${
                tone === "danger" ? "bg-red-50" : "bg-gt-teal-50"
              }`}
            >
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 grid size-9 place-items-center rounded-full text-gt-teal-900/60 hover:bg-white hover:text-gt-teal-900"
              >
                <Icon name="close" className="size-5" />
                <span className="sr-only">Fermer</span>
              </button>
              <div className="flex items-start gap-4 pr-10">
                <span
                  className={`grid size-12 shrink-0 place-items-center rounded-2xl bg-white shadow-sm ring-1 ${
                    tone === "danger"
                      ? "text-red-700 ring-red-100"
                      : "text-gt-teal-700 ring-gt-mist/70"
                  }`}
                >
                  <Icon name={icon} className="size-6" />
                </span>
                <div className="min-w-0">
                  <h2 id={titleId} className="text-xl font-medium text-gt-teal-900">
                    {title}
                  </h2>
                  {description ? (
                    <p id={descriptionId} className="mt-1 text-sm text-gt-teal-900/65">
                      {description}
                    </p>
                  ) : null}
                </div>
              </div>
            </header>
            <div className="min-h-0 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
          </div>
        </ModalContext.Provider>
      ) : null}
    </dialog>
  );
}
