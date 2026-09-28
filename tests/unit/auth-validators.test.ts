import { describe, expect, it } from "vitest";

import { slugify } from "@/lib/slug";
import { agencyRegistrationSchema, loginSchema } from "@/lib/validators/auth";

describe("slugify", () => {
  it.each([
    ["Green Trek Mada", "green-trek-mada"],
    ["  Évasion & Forêt  ", "evasion-foret"],
    ["Agence n°1 !!", "agence-n-1"],
    ["---", ""],
  ])("« %s » → « %s »", (label, expected) => {
    expect(slugify(label)).toBe(expected);
  });

  it("limite la longueur à 100 caractères sans tiret final", () => {
    const slug = slugify(`${"a".repeat(99)} b`);
    expect(slug.length).toBeLessThanOrEqual(100);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("loginSchema", () => {
  it("normalise l'e-mail (espaces, majuscules)", () => {
    const parsed = loginSchema.parse({ email: "  Admin@Exemple.TEST ", password: "x" });
    expect(parsed.email).toBe("admin@exemple.test");
  });

  it("refuse un e-mail invalide ou un mot de passe vide", () => {
    expect(loginSchema.safeParse({ email: "pas-un-email", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.test", password: "" }).success).toBe(false);
  });
});

describe("agencyRegistrationSchema", () => {
  const valid = {
    nomAgence: "Agence Test",
    slug: "agence-test",
    prenom: "Jean",
    nom: "Test",
    email: "jean@agence.test",
    password: "Motdepasse1",
    confirmPassword: "Motdepasse1",
  };

  it("accepte une inscription valide", () => {
    expect(agencyRegistrationSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["court1A", "moins de 8 caractères"],
    ["motdepasse1", "sans majuscule"],
    ["MOTDEPASSE1", "sans minuscule"],
    ["Motdepasse", "sans chiffre"],
  ])("refuse le mot de passe « %s » (%s)", (password) => {
    const result = agencyRegistrationSchema.safeParse({
      ...valid,
      password,
      confirmPassword: password,
    });
    expect(result.success).toBe(false);
  });

  it("refuse une confirmation différente, sur le champ confirmPassword", () => {
    const result = agencyRegistrationSchema.safeParse({ ...valid, confirmPassword: "Autre1234" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it.each(["Agence Test", "agence_test", "-agence", "ab", "admin", "dashboard"])(
    "refuse le slug « %s »",
    (slug) => {
      expect(agencyRegistrationSchema.safeParse({ ...valid, slug }).success).toBe(false);
    },
  );
});
