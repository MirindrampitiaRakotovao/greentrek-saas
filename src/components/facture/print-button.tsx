"use client";

import { Icon } from "@/components/ui/icon";

/** Impression de la facture (ou « Enregistrer en PDF » dans la boîte de dialogue du navigateur). */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-full bg-gt-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gt-teal-800"
    >
      <Icon name="download" className="size-4" />
      Imprimer / Enregistrer en PDF
    </button>
  );
}
