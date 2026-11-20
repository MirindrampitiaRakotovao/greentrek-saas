import { createHmac, timingSafeEqual } from "node:crypto";

import { reachableHost } from "@/lib/network";

/**
 * Lien signé vers la facture d'une réservation (ajout demandé par l'étudiant à l'étape E10).
 *
 * Le QR code de la facture contient une adresse publique : qui scanne le QR voit la facture,
 * sans se connecter. Pour que personne ne puisse fabriquer ou deviner l'adresse de la facture
 * d'un autre client, l'adresse porte une signature HMAC-SHA256 calculée avec le secret du
 * serveur (`AUTH_SECRET`) sur l'agence et la réservation. Sans le secret, impossible de
 * produire une signature valide ; la comparaison se fait en temps constant.
 */
const SIGNATURE_LENGTH = 22; // 22 caractères base64url ≈ 132 bits

export function signInvoice(secret: string, agenceId: string, reservationId: string): string {
  return createHmac("sha256", secret)
    .update(`facture:${agenceId}:${reservationId}`)
    .digest("base64url")
    .slice(0, SIGNATURE_LENGTH);
}

export function verifyInvoiceSignature(
  secret: string,
  agenceId: string,
  reservationId: string,
  signature: string | undefined,
): boolean {
  if (!signature || signature.length !== SIGNATURE_LENGTH) return false;
  const expected = Buffer.from(signInvoice(secret, agenceId, reservationId));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Secret du serveur (le même que celui des sessions ; jamais envoyé au navigateur). */
export function invoiceSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET manquant : impossible de signer les factures.");
  return secret;
}

export function invoicePath(agenceSlug: string, reservationId: string, signature: string) {
  return `/a/${agenceSlug}/facture/${reservationId}?s=${signature}`;
}

/**
 * Adresse de base du QR code, par ordre de priorité :
 * 1. `PUBLIC_BASE_URL` (.env) : adresse imposée, par exemple celle d'un tunnel Internet ;
 * 2. l'hôte de la requête, où « localhost » est remplacé par l'adresse de l'ordinateur sur
 *    le Wi-Fi (`lanIp`), pour qu'un téléphone du même réseau puisse ouvrir la facture.
 */
export function publicBaseUrl(
  host: string | null,
  proto: string | null,
  lanIp: string | null = null,
): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return `${proto ?? "http"}://${reachableHost(host ?? "localhost:3000", lanIp)}`;
}

/** Numéro de facture dérivé de la référence (démonstration : pas de numérotation fiscale). */
export function invoiceNumber(reference: string): string {
  return `F-${reference}`;
}
