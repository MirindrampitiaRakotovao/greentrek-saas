import Link from "next/link";
import type { ReactNode } from "react";

/** Mise en page commune des écrans d'authentification (connexion, inscription). */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-gt-cream px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg shadow-gt-teal-900/10 sm:p-8">
        <Link href="/" className="font-display text-2xl text-gt-teal-700">
          Green Trek
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-gt-teal-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-gt-teal-900/70">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
        {footer ? <div className="mt-6 text-sm text-gt-teal-900/80">{footer}</div> : null}
      </div>
    </main>
  );
}
