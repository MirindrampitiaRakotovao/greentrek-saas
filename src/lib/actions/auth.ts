"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import { registerAgency } from "@/lib/services/onboarding";
import { agencyRegistrationSchema, loginSchema } from "@/lib/validators/auth";

export type ActionResult = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

const GENERIC_LOGIN_ERROR = "E-mail ou mot de passe incorrect.";

/**
 * Connexion (personnel via /connexion, client via /a/[slug]/connexion).
 * Un seul message d'erreur, quelle que soit la cause (compte inconnu, mauvais mot de passe,
 * compte désactivé, agence suspendue), pour ne pas révéler quels comptes existent.
 */
export async function loginAction(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: GENERIC_LOGIN_ERROR };

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      agenceSlug: parsed.data.agenceSlug ?? "",
      // Page d'aiguillage : envoie chaque rôle vers son espace.
      redirectTo: "/espace",
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
    const fieldErrors: Partial<Record<string, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      fieldErrors[field] ??= issue.message;
    }
    return { error: "Certains champs sont invalides.", fieldErrors };
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
