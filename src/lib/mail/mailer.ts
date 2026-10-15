import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import nodemailer from "nodemailer";

import { LOGO_CID } from "./templates";

export { LOGO_CID };

/**
 * Envoi d'e-mails (après E12, hors cahier des charges §2 : choix de l'étudiant).
 *
 * - Envoi réel par le SMTP de Gmail depuis l'adresse de Green Trek (`SMTP_USER`), avec un
 *   MOT DE PASSE D'APPLICATION Google (`SMTP_PASSWORD`, dans `.env`, jamais dans le code).
 * - Secours : sans configuration, ou si l'envoi échoue (pas d'Internet le jour de la démo),
 *   l'e-mail est gardé en mémoire et visible par le super admin (« Boîte d'envoi ») ; aucune
 *   fonction ne bloque. Rien n'est écrit dans les journaux (le lien d'un e-mail est un secret).
 * - Sécurité : Nodemailer ne lit ni fichier ni URL (`disableFileAccess`, `disableUrlAccess`) ;
 *   le logo est lu par l'application et joint au message.
 */

export type Mail = { to: string; subject: string; text: string; html: string };

export type OutboxEntry = Mail & { id: number; at: Date; raison: string };

const MAX_OUTBOX = 30;
const KEY = Symbol.for("greentrek.mail.outbox");
type GlobalWithOutbox = typeof globalThis & { [KEY]?: OutboxEntry[] };

function store(): OutboxEntry[] {
  const g = globalThis as GlobalWithOutbox;
  g[KEY] ??= [];
  return g[KEY];
}

/** E-mails non envoyés (les plus récents d'abord), pour l'aperçu du super admin. */
export function outbox(): readonly OutboxEntry[] {
  return [...store()].reverse();
}

function keep(mail: Mail, raison: string): void {
  const list = store();
  list.push({ ...mail, id: (list.at(-1)?.id ?? 0) + 1, at: new Date(), raison });
  if (list.length > MAX_OUTBOX) list.splice(0, list.length - MAX_OUTBOX);
}

function smtpConfig() {
  const user = process.env.SMTP_USER?.trim();
  // Google affiche le mot de passe d'application par groupes de 4 : espaces retirés.
  const pass = process.env.SMTP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) return null;
  return {
    user,
    pass,
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
    from: process.env.MAIL_FROM?.trim() || `Green Trek <${user}>`,
  };
}

export function mailConfigured(): boolean {
  return smtpConfig() !== null;
}

/** Envoie l'e-mail ; renvoie « envoye », ou « apercu » s'il a été gardé dans la boîte d'envoi. */
export async function sendMail(mail: Mail): Promise<"envoye" | "apercu"> {
  const config = smtpConfig();
  if (!config) {
    keep(mail, "Envoi non configuré (SMTP_USER et SMTP_PASSWORD dans .env)");
    return "apercu";
  }
  try {
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
      disableFileAccess: true,
      disableUrlAccess: true,
      connectionTimeout: 10_000,
    });
    const logo = await readFile(join(process.cwd(), "public/logo/green-trek.png"));
    await transport.sendMail({
      from: config.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: [{ filename: "green-trek.png", content: logo, cid: LOGO_CID }],
    });
    return "envoye";
  } catch (error: unknown) {
    // Message d'erreur seul (sans le contenu de l'e-mail ni le lien).
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Envoi d'e-mail impossible (${message}) : e-mail gardé dans la boîte d'envoi.`);
    keep(mail, `Échec de l'envoi : ${message}`);
    return "apercu";
  }
}
