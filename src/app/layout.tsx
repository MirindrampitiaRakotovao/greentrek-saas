import type { Metadata } from "next";
import { Kaushan_Script, Poppins } from "next/font/google";

import "./globals.css";

// `next/font` télécharge les polices au build et les sert depuis l'application :
// aucune requête vers Google au runtime, donc utilisable hors ligne pendant la démo.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const kaushan = Kaushan_Script({
  variable: "--font-kaushan",
  subsets: ["latin"],
  weight: "400",
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
      className={`${poppins.variable} ${kaushan.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
