import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/dashboard/widgets";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { LOGO_CID, mailConfigured, outbox } from "@/lib/mail/mailer";

export const metadata: Metadata = { title: "Boîte d'envoi — Console plateforme" };
export const dynamic = "force-dynamic";

/**
 * E-mails NON envoyés (après E12) : sans configuration Gmail, ou si l'envoi a échoué (pas
 * d'Internet), l'e-mail est gardé ici pour que la fonction reste démontrable. Réservé au
 * super admin : ces e-mails contiennent des liens de réinitialisation. Liste en mémoire,
 * vidée au redémarrage du serveur.
 */
export default async function OutboxPage() {
  await requireUser({ roles: ["SUPER_ADMIN"] });
  const mails = outbox();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Boîte d'envoi"
        description={
          mailConfigured()
            ? "L'envoi par Gmail est configuré : seuls les e-mails dont l'envoi a échoué apparaissent ici."
            : "L'envoi par Gmail n'est pas configuré (SMTP_USER et SMTP_PASSWORD dans .env) : les e-mails de la plateforme sont gardés ici."
        }
      />
      {mails.length === 0 ? (
        <EmptyState>Aucun e-mail en attente.</EmptyState>
      ) : (
        <ul className="space-y-6">
          {mails.map((m) => (
            <li
              key={m.id}
              className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-gt-mist/60"
            >
              <div className="space-y-0.5 border-b border-gt-mist/70 px-5 py-3 text-sm">
                <p className="font-semibold text-gt-teal-900">{m.subject}</p>
                <p className="text-gt-teal-900/75">
                  À : {m.to} · {formatDateTime(m.at)}
                </p>
                <p className="text-xs text-gt-teal-900/75">{m.raison}</p>
              </div>
              {/* Aperçu isolé (aucun script) ; le logo joint est remplacé par le fichier public. */}
              <iframe
                title={`Aperçu : ${m.subject}`}
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                srcDoc={m.html
                  .replaceAll(`cid:${LOGO_CID}`, "/logo/green-trek.png")
                  .replace(
                    '<html lang="fr">',
                    '<html lang="fr"><head><base target="_blank"></head>',
                  )}
                className="h-[560px] w-full bg-gt-canvas"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
