import { z } from "zod";

import { passwordSchema } from "@/lib/validators/auth";

/** Rôles qu'un administrateur d'agence peut attribuer (jamais CLIENT ni SUPER_ADMIN). */
export const TEAM_ROLES = ["ADMIN_AGENCE", "STAFF", "GUIDE"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  ADMIN_AGENCE: "Administrateur",
  STAFF: "Personnel",
  GUIDE: "Guide",
};

const nom = z.string().trim().min(1, { error: "Champ requis." }).max(100);

/** Téléphone facultatif : chaîne vide ramenée à `null`. */
export const optionalPhone = z
  .string()
  .trim()
  .max(30, { error: "30 caractères au maximum." })
  .regex(/^[+0-9 ().-]*$/, { error: "Chiffres, espaces et + ( ) . - uniquement." })
  .transform((value) => (value === "" ? null : value));

const role = z.enum(TEAM_ROLES, { error: "Rôle invalide." });

export const createMemberSchema = z.object({
  prenom: nom,
  nom,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Adresse e-mail invalide." })),
  telephone: optionalPhone,
  role,
  /** Mot de passe initial, communiqué au membre qui le change ensuite dans « Mon profil ». */
  password: passwordSchema,
});
export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const updateMemberSchema = z.object({
  id: z.string().min(1),
  prenom: nom,
  nom,
  telephone: optionalPhone,
  role,
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const setMemberActiveSchema = z.object({
  id: z.string().min(1),
  actif: z.boolean(),
});

export const updateProfileSchema = z.object({
  prenom: nom,
  nom,
  telephone: optionalPhone,
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "Mot de passe actuel requis." }),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    error: "Le nouveau mot de passe doit être différent de l'actuel.",
    path: ["newPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
