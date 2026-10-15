import { describe, expect, it } from "vitest";

import { escapeHtml, passwordResetMail } from "@/lib/mail/templates";

describe("e-mail de réinitialisation", () => {
  const mail = passwordResetMail({
    prenom: "<script>alert(1)</script>",
    lien: "http://192.168.0.10:3000/reinitialiser-mot-de-passe?jeton=abc",
    espace: "Green Trek",
    validiteMinutes: 60,
  });

  it("contient le lien et la durée de validité, en HTML et en texte", () => {
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain("http://192.168.0.10:3000/reinitialiser-mot-de-passe?jeton=abc");
      expect(body).toContain("60 minutes");
    }
    expect(mail.subject).toBe("Réinitialisation de votre mot de passe · Green Trek");
  });

  it("échappe les valeurs insérées dans le HTML", () => {
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(escapeHtml(`"a" & 'b'`)).toBe("&quot;a&quot; &amp; &#39;b&#39;");
  });
});
