import type { Metadata } from "next";
import { Dancing_Script, Poppins } from "next/font/google";
import localFont from "next/font/local";

import { DialogsProvider } from "@/components/ui/dialogs";

import "./globals.css";

// `next/font` télécharge les polices au build et les sert depuis l'application :
// aucune requête vers Google au runtime, donc utilisable hors ligne pendant la démo.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Nohemi (titres) : police absente de Google Fonts, fichiers locaux dans `src/fonts/`
// (licence : `src/fonts/Nohemi-LICENCE.txt`). Choix de l'étudiant à la place de la police
// manuscrite indicative du §8.3. Poppins reste la police du texte et de l'interface.
// Police script réservée au grand titre du hero du site vitrine (demande de l'étudiant).
const dancingScript = Dancing_Script({
  variable: "--font-dancing",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const nohemi = localFont({
  variable: "--font-nohemi",
  src: [
    { path: "../fonts/Nohemi-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/Nohemi-Medium.ttf", weight: "500", style: "normal" },
    { path: "../fonts/Nohemi-Bold.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Green Trek — Plateforme de circuits de randonnée",
  description:
    "Plateforme SaaS de gestion et de réservation de circuits de randonnée pour agences de voyage.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning : certaines extensions du navigateur ajoutent des attributs
    // à <html> avant React (avertissement sans conséquence). Ne s'applique qu'à cette balise.
    <html
      lang="fr"
      className={`${poppins.variable} ${nohemi.variable} ${dancingScript.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col font-sans">
        {/* Modales de confirmation et notifications, disponibles dans toute l'application. */}
        <DialogsProvider>{children}</DialogsProvider>
      </body>
    </html>
  );
}
