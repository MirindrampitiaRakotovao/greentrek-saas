import Link from "next/link";

import { FormModal } from "@/components/ui/form-modal";
import { Icon } from "@/components/ui/icon";

import { StartConversationForm } from "./start-conversation-form";

/**
 * Accès à la conversation d'une réservation : ouverture du fil s'il existe, sinon premier
 * message dans une modale (au plus une conversation par réservation).
 */
export function ReservationMessageButton({
  reservationId,
  conversationId,
  threadBase,
  label,
  title,
  description,
  placeholder,
  openLabel = "Voir la conversation",
}: {
  reservationId: string;
  conversationId: string | null;
  /** Adresse de la messagerie de l'espace (`…/messages`). */
  threadBase: string;
  label: string;
  title: string;
  description?: string;
  placeholder?: string;
  openLabel?: string;
}) {
  if (conversationId) {
    return (
      <Link
        href={`${threadBase}/${conversationId}`}
        className="inline-flex items-center gap-2 rounded-full border border-gt-teal-700 px-4 py-2 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50"
      >
        <Icon name="message" className="size-4" />
        {openLabel}
      </Link>
    );
  }
  return (
    <FormModal
      triggerLabel={label}
      triggerIcon="message"
      variant="secondary"
      title={title}
      description={description}
    >
      <StartConversationForm reservationId={reservationId} placeholder={placeholder} />
    </FormModal>
  );
}
