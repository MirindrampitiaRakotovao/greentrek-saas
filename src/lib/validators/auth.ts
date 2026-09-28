import { z } from "zod";

/**
 * Schémas Zod de l'authentification et de l'onboarding. Partagés entre le formulaire
 * (validation immédiate côté navigateur) et le serveur (validation qui fait foi).
 */

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Adresse e-mail invalide." }));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { error: "Mot de passe requis." }),
  /** Présent uniquement sur la page de connexion d'une agence (clients). */
  agenceSlug: z.string().trim().min(1).optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Slugs réservés : ils entreraient en conflit avec des routes ou prêteraient à confusion. */
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "dashboard",
  "connexion",
  "inscription-agence",
  "tarifs",
]);

export const passwordSchema = z
  .string()
  .min(8, { error: "Au moins 8 caractères." })
  .max(72, { error: "72 caractères au maximum." }) // limite de bcrypt
  .regex(/[a-z]/, { error: "Au moins une minuscule." })
  .regex(/[A-Z]/, { error: "Au moins une majuscule." })
  .regex(/[0-9]/, { error: "Au moins un chiffre." });

export const agencyRegistrationSchema = z
  .object({
    nomAgence: z.string().trim().min(2, { error: "Nom trop court." }).max(150),
    slug: z
      .string()
      .trim()
      .min(3, { error: "Au moins 3 caractères." })
      .max(100)
      .regex(SLUG_PATTERN, { error: "Minuscules, chiffres et tirets uniquement." })
      .refine((slug) => !RESERVED_SLUGS.has(slug), { error: "Cet identifiant est réservé." }),
    prenom: z.string().trim().min(1, { error: "Prénom requis." }).max(100),
    nom: z.string().trim().min(1, { error: "Nom requis." }).max(100),
    email,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });
export type AgencyRegistrationInput = z.infer<typeof agencyRegistrationSchema>;
