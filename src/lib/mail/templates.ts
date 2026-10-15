/** Identifiant du logo joint, cité dans le HTML (`<img src="cid:…">`). */
export const LOGO_CID = "logo@greentrek";

/** Échappement HTML des valeurs insérées dans un e-mail (prénom, nom de l'agence). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * E-mail « mot de passe oublié », aux couleurs de Green Trek (HTML simple en tableaux et
 * styles en ligne, comme l'exigent les messageries), avec une version texte.
 */
export function passwordResetMail(input: {
  prenom: string;
  lien: string;
  /** « Green Trek » (personnel) ou nom de l'agence (voyageur). */
  espace: string;
  validiteMinutes: number;
}) {
  const subject = `Réinitialisation de votre mot de passe · ${input.espace}`;
  const text = [
    `Bonjour ${input.prenom},`,
    "",
    `Vous avez demandé à réinitialiser le mot de passe de votre compte ${input.espace}.`,
    `Ouvrez ce lien pour choisir un nouveau mot de passe (valable ${input.validiteMinutes} minutes, une seule fois) :`,
    input.lien,
    "",
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.",
    "",
    "Green Trek",
  ].join("\n");
  const prenom = escapeHtml(input.prenom);
  const espace = escapeHtml(input.espace);
  const lien = escapeHtml(input.lien);
  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;padding:0;background:#eef3f3;font-family:Arial,Helvetica,sans-serif;color:#0f414d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f3;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="padding:28px 32px 8px;text-align:center"><img src="cid:${LOGO_CID}" alt="Green Trek" width="120" style="width:120px;height:auto"></td></tr>
<tr><td style="padding:8px 32px 0">
<h1 style="font-size:20px;margin:16px 0 8px">Réinitialisation du mot de passe</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 12px">Bonjour ${prenom},</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 20px">Vous avez demandé à réinitialiser le mot de passe de votre compte <strong>${espace}</strong>. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.</p>
<p style="text-align:center;margin:0 0 20px"><a href="${lien}" style="display:inline-block;background:#0f6775;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:999px">Choisir un nouveau mot de passe</a></p>
<p style="font-size:13px;line-height:1.6;color:#4d6f78;margin:0 0 8px">Ce lien est valable ${input.validiteMinutes} minutes et ne peut servir qu'une fois. Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :</p>
<p style="font-size:12px;word-break:break-all;color:#0f6775;margin:0 0 20px">${lien}</p>
<p style="font-size:13px;line-height:1.6;color:#4d6f78;margin:0 0 28px">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.</p>
</td></tr>
<tr><td style="background:#025e69;color:#ffffff;font-size:12px;padding:14px 32px;text-align:center">Green Trek · plateforme des agences de randonnée</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}
