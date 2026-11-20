import { z } from "zod";

import { optionalPhone } from "@/lib/validators/common";
import { reservationSchema } from "@/lib/validators/reservations";

/*
 * Clients ajoutés par l'agence (après E12, demande de l'étudiant) : l'agence crée le compte
 * d'un voyageur, qui reçoit un e-mail pour choisir son mot de passe, puis peut réserver pour lui.
 */

const nom = z.string().trim().min(1, { error: "Champ requis." }).max(100);

export const createClientSchema = z.object({
  prenom: nom,
  nom,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Adresse e-mail invalide." })),
  telephone: optionalPhone,
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

/**
 * Modification d'un client par l'agence (décision E bis) : identité, contact et état du
 * compte (un compte désactivé ne peut plus se connecter, ni sur le site ni dans l'application).
 */
export const updateClientSchema = createClientSchema.extend({
  id: z.string().min(1),
  actif: z.boolean(),
});
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const deleteClientSchema = z.object({ id: z.string().min(1) });

/** Réservation faite par l'agence pour un de ses clients (mêmes règles que le site). */
export const agencyReservationSchema = reservationSchema.extend({
  clientId: z.string().min(1),
});
export type AgencyReservationInput = z.infer<typeof agencyReservationSchema>;

export const ORIGINES = ["INSCRIPTION", "AGENCE"] as const;
export type Origine = (typeof ORIGINES)[number];

export const ORIGINE_LABELS: Record<Origine, string> = {
  INSCRIPTION: "Inscrit en ligne",
  AGENCE: "Ajouté par l'agence",
};
