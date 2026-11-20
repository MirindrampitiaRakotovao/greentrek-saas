"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { authorize, journal, parseInput, toActionResult } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { mailConfigured, sendMail } from "@/lib/mail/mailer";
import { clientInvitationMail } from "@/lib/mail/templates";
import { requestBaseUrl } from "@/lib/public-url";
import { createClientByAgency, deleteClient, updateClient } from "@/lib/services/clients";
import { INVITATION_VALIDITY_DAYS } from "@/lib/services/mot-de-passe";
import { createReservation } from "@/lib/services/reservations";
import { deleteImage } from "@/lib/uploads";
import {
  agencyReservationSchema,
  createClientSchema,
  deleteClientSchema,
  updateClientSchema,
} from "@/lib/validators/clients";

/*
 * Clients ajoutés par l'agence (après E12). Droit requis : « créer une réservation »
 * (administrateur et personnel), le personnel gérant les clients selon le §3.
 */

const CLIENTS_PATH = "/dashboard/clients";

/** Ajoute un client et lui envoie l'e-mail d'invitation (choix de son mot de passe). */
export async function createClientAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("creer", "reservation");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(createClientSchema, input);
  if (!parsed.ok) return parsed.result;

  const result = await createClientByAgency(auth.db, auth.user.agenceId, parsed.data);
  if (!result.ok) return toActionResult(result);

  const agence = await auth.db.agence.findFirstOrThrow({ select: { nom: true, slug: true } });
  const lien = `${await requestBaseUrl()}/a/${agence.slug}/reinitialiser-mot-de-passe?jeton=${result.data.jeton}&bienvenue=1`;
  const mail = clientInvitationMail({
    prenom: parsed.data.prenom,
    agence: agence.nom,
    lien,
    validiteJours: INVITATION_VALIDITY_DAYS,
  });
  // Envoi après la réponse ; le lien n'est jamais journalisé.
  after(async () => {
    await sendMail({ to: parsed.data.email, ...mail });
  });
  await journal(auth, "CLIENT_AJOUTE", "Utilisateur", result.data.id);
  revalidatePath(CLIENTS_PATH);
  // Message fidèle : sans envoi configuré, l'invitation attend dans la boîte d'envoi.
  return {
    success: mailConfigured()
      ? "Client ajouté : un e-mail l'invite à choisir son mot de passe."
      : "Client ajouté. L'envoi d'e-mails n'est pas configuré : l'invitation est dans la boîte d'envoi de la console (super admin).",
  };
}

/** Réservation faite par l'agence pour un de ses clients, puis ouverture de sa fiche. */
export async function createReservationForClientAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("creer", "reservation");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(agencyReservationSchema, input);
  if (!parsed.ok) return parsed.result;

  const agence = await auth.db.agence.findFirstOrThrow({ select: { slug: true } });
  const result = await createReservation(auth.db, {
    ...parsed.data,
    agenceId: auth.user.agenceId,
    agenceSlug: agence.slug,
    parAgence: true,
  });
  if (!result.ok) return toActionResult(result);
  await journal(auth, "RESERVATION_CREEE_AGENCE", "Reservation", result.data.id, {
    reference: result.data.reference,
  });
  revalidatePath(`${CLIENTS_PATH}/${parsed.data.clientId}`);
  redirect(`/dashboard/reservations/${result.data.id}`);
}

/**
 * Modification d'un client (décision E bis) : administrateur et personnel, comme les
 * réservations (§3 : le personnel crée, lit et modifie).
 */
export async function updateClientAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "reservation");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(updateClientSchema, input);
  if (!parsed.ok) return parsed.result;

  const result = await updateClient(auth.db, parsed.data);
  if (!result.ok) return toActionResult(result);
  await journal(auth, "CLIENT_MODIFIE", "Utilisateur", parsed.data.id, {
    actif: parsed.data.actif,
  });
  revalidatePath(CLIENTS_PATH);
  revalidatePath(`${CLIENTS_PATH}/${parsed.data.id}`);
  return { success: "Client modifié." };
}

/**
 * Suppression d'un client (décision E bis) : administrateur de l'agence seulement (« S » de
 * la matrice §3), et seulement s'il n'a aucune réservation ; sinon, désactivation proposée.
 */
export async function deleteClientAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("supprimer", "utilisateur");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(deleteClientSchema, input);
  if (!parsed.ok) return parsed.result;

  const result = await deleteClient(auth.db, parsed.data.id);
  if (!result.ok) return toActionResult(result);
  await deleteImage(result.data.photoUrl);
  await journal(auth, "CLIENT_SUPPRIME", "Utilisateur", parsed.data.id);
  revalidatePath(CLIENTS_PATH);
  redirect(CLIENTS_PATH);
}
