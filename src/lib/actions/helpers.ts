import "server-only";

import type { ZodType } from "zod";

import type { ActionResult } from "@/lib/actions/types";
import { requireAgencyUser } from "@/lib/auth/session";
import { type Action, assertCan, ForbiddenError, type Resource } from "@/lib/permissions";
import type { ServiceResult } from "@/lib/services/result";

/** Première erreur de chaque champ, à partir d'une validation Zod échouée. */
export function zodFieldErrors(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Partial<Record<string, string>> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "form");
    fieldErrors[field] ??= issue.message;
  }
  return fieldErrors;
}

/** Valide l'entrée d'une action avec Zod ; renvoie les erreurs par champ en cas d'échec. */
export function parseInput<T>(
  schema: ZodType<T>,
  input: unknown,
): { ok: true; data: T } | { ok: false; result: ActionResult } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    result: {
      error: "Certains champs sont invalides.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
    },
  };
}

/** Convertit le résultat d'un service en réponse de formulaire. */
export function toActionResult(result: ServiceResult<unknown>, success?: string): ActionResult {
  if (result.ok) return success ? { success } : {};
  return result.field
    ? { error: result.error, fieldErrors: { [result.field]: result.error } }
    : { error: result.error };
}

/** Transforme un refus de permission en message ; relance toute autre erreur. */
export function forbiddenToResult(error: unknown): ActionResult {
  if (error instanceof ForbiddenError) {
    return { error: "Vous n'avez pas les droits nécessaires pour cette action." };
  }
  throw error;
}

/**
 * Contrôle commun des actions du back-office : session relue en base + client confiné à
 * l'agence (`requireAgencyUser`), puis permission du rôle (matrice §3).
 */
export async function authorize(action: Action, resource: Resource) {
  const { user, db } = await requireAgencyUser();
  try {
    assertCan(user.role, action, resource);
    return { ok: true as const, user, db };
  } catch (error: unknown) {
    return { ok: false as const, result: forbiddenToResult(error) };
  }
}
