import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";

import { agencyRegistrationSchema, loginSchema } from "@/lib/validators/auth";
import { agencySettingsSchema, guideSchema, partenaireSchema } from "@/lib/validators/backoffice";
import {
  changePasswordSchema,
  createMemberSchema,
  updateMemberSchema,
  updateProfileSchema,
} from "@/lib/validators/team";
import { departSchema, updateDepartSchema } from "@/lib/validators/departs";

/**
 * Non-régression : chaque formulaire est validé dans le navigateur PUIS sur le serveur, et le
 * serveur reçoit les valeurs déjà transformées (ex. "" → null). Valider une deuxième fois la
 * sortie d'une première validation doit donc réussir et ne rien changer (idempotence).
 * Ce défaut a existé à l'étape E3a (téléphone vide refusé par le serveur).
 */
const cases: [string, ZodType, Record<string, unknown>][] = [
  ["connexion", loginSchema, { email: " A@B.test ", password: "x" }],
  [
    "inscription d'agence",
    agencyRegistrationSchema,
    {
      nomAgence: "Agence",
      slug: "agence",
      prenom: "A",
      nom: "B",
      email: "a@b.test",
      password: "Motdepasse1",
      confirmPassword: "Motdepasse1",
    },
  ],
  [
    "création d'un membre (téléphone vide)",
    createMemberSchema,
    {
      prenom: "A",
      nom: "B",
      email: "a@b.test",
      telephone: "",
      role: "STAFF",
      password: "Motdepasse1",
    },
  ],
  [
    "modification d'un membre (téléphone vide)",
    updateMemberSchema,
    { id: "x", prenom: "A", nom: "B", telephone: "", role: "GUIDE" },
  ],
  ["profil (téléphone vide)", updateProfileSchema, { prenom: "A", nom: "B", telephone: "" }],
  [
    "mot de passe",
    changePasswordSchema,
    { currentPassword: "Ancien123", newPassword: "Nouveau123", confirmPassword: "Nouveau123" },
  ],
  [
    "paramètres de l'agence (champs vides)",
    agencySettingsSchema,
    {
      nom: "Agence",
      description: "",
      email: "",
      telephone: "",
      adresse: "",
      ville: "",
      pays: "",
      devise: "MGA",
      logoUrl: "",
    },
  ],
  [
    "partenaire (nombres saisis en texte)",
    partenaireSchema,
    {
      nom: "P",
      type: "HEBERGEMENT",
      description: "",
      telephone: "",
      email: "",
      adresse: "",
      latitude: "-17,5",
      longitude: "49.4",
      tarifIndicatif: "25000",
      actif: true,
    },
  ],
  [
    "guide (aucune langue cochée, expérience vide)",
    guideSchema,
    {
      prenom: "A",
      nom: "B",
      telephone: "",
      bio: "",
      langues: false,
      experienceAnnees: "",
      actif: true,
      utilisateurId: "",
    },
  ],
  [
    "départ (prix, guide et notes vides)",
    departSchema,
    {
      circuitId: "c1",
      dateDebut: "2026-10-10",
      dateFin: "2026-10-12",
      placesTotal: "8",
      prixParPersonne: "",
      guideId: "",
      notes: "",
    },
  ],
  [
    "modification d'un départ",
    updateDepartSchema,
    {
      dateDebut: "2026-10-10",
      dateFin: "2026-10-10",
      placesTotal: 8,
      prixParPersonne: "120000",
      guideId: "g1",
      notes: "Départ matinal",
    },
  ],
];

describe("schémas de formulaire : validation idempotente (navigateur puis serveur)", () => {
  it.each(cases)("%s", (_name, schema, raw) => {
    const first = schema.safeParse(raw);
    expect(first.success, JSON.stringify(first.error?.issues)).toBe(true);
    const second = schema.safeParse(first.data);
    expect(second.success, JSON.stringify(second.error?.issues)).toBe(true);
    expect(second.data).toEqual(first.data);
  });
});

describe("départs : dates (RG 10)", () => {
  const base = cases.find(([name]) => name.startsWith("départ"))![2];
  it("refuse une date de fin antérieure au début, et une date inexistante", () => {
    expect(departSchema.safeParse({ ...base, dateFin: "2026-10-09" }).success).toBe(false);
    expect(departSchema.safeParse({ ...base, dateDebut: "2026-02-30" }).success).toBe(false);
    expect(departSchema.safeParse({ ...base, dateDebut: "" }).success).toBe(false);
  });
});

describe("transformations attendues", () => {
  it("convertit les nombres saisis (virgule décimale acceptée)", () => {
    const data = partenaireSchema.parse(cases[7]![2]);
    expect(data).toMatchObject({ latitude: -17.5, longitude: 49.4, tarifIndicatif: 25000 });
  });

  it("exige latitude ET longitude, ou aucune", () => {
    const result = partenaireSchema.safeParse({ ...cases[7]![2], longitude: "" });
    expect(result.success).toBe(false);
  });

  it("refuse une latitude hors limites et un tarif négatif", () => {
    expect(partenaireSchema.safeParse({ ...cases[7]![2], latitude: "95" }).success).toBe(false);
    expect(partenaireSchema.safeParse({ ...cases[7]![2], tarifIndicatif: "-1" }).success).toBe(
      false,
    );
  });

  it("ramène les champs vides à null", () => {
    expect(agencySettingsSchema.parse(cases[6]![2])).toMatchObject({
      description: null,
      email: null,
      logoUrl: null,
    });
  });

  it("refuse une adresse de logo qui n'est pas http(s)", () => {
    const result = agencySettingsSchema.safeParse({
      ...cases[6]![2],
      logoUrl: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
  });

  it("guide : langues cochées conservées, langue inconnue refusée", () => {
    expect(guideSchema.parse({ ...cases[8]![2], langues: ["fr", "mg"] }).langues).toEqual([
      "fr",
      "mg",
    ]);
    expect(guideSchema.safeParse({ ...cases[8]![2], langues: ["xx"] }).success).toBe(false);
  });
});
