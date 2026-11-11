import { z } from "zod";

import { isExpoPushToken } from "@/lib/push/expo";
import { loginSchema } from "@/lib/validators/auth";
import { vitrineSearchSchema } from "@/lib/validators/vitrine";

/* API de l'application mobile (après E12) : entrées validées à la frontière, comme ailleurs. */

/** Recherche du catalogue : filtres du site vitrine, plus un texte libre. */
export const catalogueQuerySchema = vitrineSearchSchema.extend({
  q: z.string().trim().max(100).optional().catch(undefined),
});
export type CatalogueQuery = z.infer<typeof catalogueQuerySchema>;

/** Connexion d'un voyageur : l'agence est obligatoire (compte propre à chaque agence). */
export const mobileLoginSchema = loginSchema
  .pick({ email: true, password: true })
  .extend({ agenceSlug: z.string().trim().min(1, { error: "Choisissez l'agence." }) });

/** Téléphone à prévenir par notification push (jeton du service Expo). */
export const deviceSchema = z.object({
  token: z
    .string()
    .trim()
    .max(255)
    .refine(isExpoPushToken, { error: "Jeton de notification invalide." }),
  plateforme: z.enum(["android", "ios"]),
});
export type DeviceInput = z.infer<typeof deviceSchema>;

export const deviceRemovalSchema = deviceSchema.pick({ token: true });

/** Nouveautés depuis le dernier passage (date renvoyée par le serveur au passage précédent). */
export const activityQuerySchema = z.object({
  depuis: z.iso.datetime({ offset: true }).optional().catch(undefined),
});

/** Notifications marquées comme lues : toutes, ou celles données. */
export const readNotificationsSchema = z.object({
  ids: z.array(z.string().min(1)).max(100).optional(),
});
