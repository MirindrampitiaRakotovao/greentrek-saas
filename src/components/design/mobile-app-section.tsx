import Image from "next/image";

import { SectionHeading } from "@/components/design/section-heading";
import { Icon, type IconName } from "@/components/ui/icon";
import { mobileAppUrl } from "@/lib/mobile-app";
import { qrSvg } from "@/lib/qr";

const ATOUTS: { icon: IconName; label: string }[] = [
  { icon: "mountain", label: "Les circuits de toutes les agences, avec leur carte" },
  { icon: "ticket", label: "Réservation et paiement en quelques gestes" },
  { icon: "calendar", label: "Vos réservations toujours à portée de main" },
];

/**
 * Encart « Téléchargez l'application » (site vitrine et accueil de la plateforme) : bouton et
 * QR code vers le fichier de l'application Android (`MOBILE_APP_URL`), capture d'écran réelle
 * de l'application. Rien n'est affiché tant que le lien n'est pas configuré.
 */
export async function MobileAppSection() {
  const url = mobileAppUrl();
  if (!url) return null;
  const qr = await qrSvg(url);
  return (
    <section
      id="application"
      aria-labelledby="titre-application"
      className="scroll-mt-20 overflow-hidden bg-gt-teal-900 text-white"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <SectionHeading
            id="titre-application"
            accent="l'application"
            title="Green Trek dans votre poche"
            tone="dark"
          >
            Trouvez votre prochaine randonnée, réservez et suivez vos voyages depuis votre
            téléphone.
          </SectionHeading>
          <ul className="mt-8 space-y-3">
            {ATOUTS.map((a) => (
              <li key={a.label} className="flex items-center gap-3 text-white/90">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-gt-sand-300 ring-1 ring-white/15">
                  <Icon name={a.icon} className="size-5" />
                </span>
                {a.label}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-gt-sand-300 px-6 py-3 font-semibold text-gt-teal-900 hover:bg-gt-sand-200"
            >
              <Icon name="download" className="size-5" />
              Télécharger pour Android
            </a>
            <div className="flex items-center gap-3">
              <div
                className="size-28 shrink-0 rounded-xl bg-white [&>svg]:size-full"
                role="img"
                aria-label="QR code du lien de téléchargement de l'application"
                // SVG généré sur le serveur par la bibliothèque `qrcode` (aucune donnée saisie).
                dangerouslySetInnerHTML={{ __html: qr }}
              />
              <p className="max-w-36 text-sm text-white/80">
                Scannez avec votre téléphone pour télécharger l&apos;application.
              </p>
            </div>
          </div>
          <p className="mt-6 text-xs text-white/75">
            Application Android (fichier APK) : autorisez l&apos;installation depuis cette source si
            votre téléphone le demande.
          </p>
        </div>
        <div className="relative mx-auto w-64 sm:w-72">
          <div className="rounded-[2.75rem] bg-black p-3 shadow-2xl ring-1 ring-white/20">
            <Image
              src="/app/accueil.png"
              alt="Écran d'accueil de l'application Green Trek"
              width={780}
              height={1688}
              className="h-auto w-full rounded-[2.1rem]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
