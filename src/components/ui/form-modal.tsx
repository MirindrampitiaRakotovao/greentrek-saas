"use client";

import { type ReactNode, useState } from "react";

import { useNotify } from "@/components/ui/dialogs";
import { Icon, type IconName } from "@/components/ui/icon";
import { Modal, useModal } from "@/components/ui/modal";
import type { ActionResult } from "@/lib/actions/types";

const TRIGGERS = {
  primary:
    "flex items-center gap-2 rounded-full bg-gt-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-gt-teal-800",
  secondary:
    "flex items-center gap-2 rounded-full border border-gt-teal-700 px-4 py-2 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50",
  ghost:
    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50",
} as const;

/**
 * Bouton qui ouvre un formulaire dans une modale (demande de l'étudiant). Le formulaire est
 * monté à l'ouverture et démonté à la fermeture : il repart vide à chaque ouverture.
 */
export function FormModal({
  triggerLabel,
  triggerIcon = "plus",
  variant = "primary",
  title,
  description,
  icon,
  size = "md",
  children,
}: {
  triggerLabel: string;
  triggerIcon?: IconName;
  variant?: keyof typeof TRIGGERS;
  title: string;
  description?: string;
  icon?: IconName;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={TRIGGERS[variant]}>
        <Icon name={triggerIcon} className="size-4" />
        {triggerLabel}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        icon={icon ?? triggerIcon}
        size={size}
      >
        {children}
      </Modal>
    </>
  );
}

/**
 * Pour un formulaire : après un enregistrement réussi, s'il est affiché dans une modale, la
 * fermer et afficher le message de succès en notification. Renvoie vrai dans ce cas (le
 * formulaire n'a alors pas à afficher le message lui-même).
 */
export function useCloseOnSuccess() {
  const modal = useModal();
  const notify = useNotify();
  return (result: ActionResult): boolean => {
    if (!modal || result.error || result.fieldErrors) return false;
    modal.close();
    if (result.success) notify(result.success);
    return true;
  };
}
