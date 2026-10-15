"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import { zodFieldErrors } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { safeReturnPath } from "@/lib/auth/return-path";
import { registerClient } from "@/lib/services/clients";
import { registerAgency } from "@/lib/services/onboarding";
import {
  agencyRegistrationSchema,
  clientRegistrationSchema,
  loginSchema,
} from "@/lib/validators/auth";

const GENERIC_LOGIN_ERROR = "E-mail ou mot de passe incorrect.";

/**
 * Connexion (personnel via /connexion, client via /a/[slug]/connexion).
 * Un seul message d'erreur, quelle que soit la cause (compte inconnu, mauvais mot de passe,
 * compte désactivé, agence suspendue), pour ne pas révéler quels comptes existent.
 */
export async function loginAction(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: GENERIC_LOGIN_ERROR };

  // Client venu du tunnel de réservation : retour au départ choisi (chemin vérifié).
  const retour = parsed.data.agenceSlug
    ? safeReturnPath(parsed.data.retour, parsed.data.agenceSlug)
    : null;
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      agenceSlug: parsed.data.agenceSlug ?? "",
      remember: parsed.data.remember ? "true" : "false",
      // Sinon, page d'aiguillage : envoie chaque rôle vers son espace.
      redirectTo: retour ?? "/espace",
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) return { error: GENERIC_LOGIN_ERROR };
    throw error; // la redirection de Next.js est une exception à laisser passer
  }
  return {};
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

/**
 * Inscription d'une agence : validation Zod côté serveur (qui fait foi), création
 * transactionnelle, puis connexion automatique du nouvel administrateur.
 */
export async function registerAgencyAction(input: unknown): Promise<ActionResult> {
  const parsed = agencyRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Certains champs sont invalides.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
    };
  }

  const result = await registerAgency(parsed.data);
  if (!result.ok) {
    return result.field === "form"
      ? { error: result.message }
      : { error: result.message, fieldErrors: { [result.field]: result.message } };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      agenceSlug: "",
      redirectTo: "/dashboard",
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return { error: "Agence créée, mais la connexion automatique a échoué : connectez-vous." };
    }
    throw error;
  }
  return {};
}

/**
 * Inscription d'un voyageur sur le site d'une agence, puis connexion automatique et retour
 * au tunnel de réservation s'il en vient (sinon vers son espace).
 */
export async function registerClientAction(input: unknown): Promise<ActionResult> {
  const parsed = clientRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Certains champs sont invalides.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
    };
  }
  const result = await registerClient(parsed.data);
  if (!result.ok) {
    return result.field === "form"
      ? { error: result.message }
      : { error: result.message, fieldErrors: { [result.field]: result.message } };
  }
  const { agenceSlug } = parsed.data;
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      agenceSlug,
      redirectTo: safeReturnPath(parsed.data.retour, agenceSlug) ?? `/a/${agenceSlug}/mon-compte`,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return { error: "Compte créé, mais la connexion automatique a échoué : connectez-vous." };
    }
    throw error;
  }
  return {};
}
