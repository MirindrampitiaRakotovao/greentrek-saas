import NextAuth from "next-auth";
import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";

import { authConfig } from "@/auth.config";
import { isLocalHost, isPublicTunnelPath } from "@/lib/network";

/**
 * Proxy Next.js 16 (ex-« middleware »), deux rôles :
 *
 * 1. Tunnel de démonstration (`npm run tunnel`, QR code des factures) : une requête venue
 *    d'Internet (hôte non local, par exemple https://….trycloudflare.com) ne reçoit QUE les
 *    factures signées et leurs fichiers ; tout le reste (connexion, back-office, console,
 *    API…) répond « introuvable ». Le site n'est donc jamais exposé en entier.
 * 2. Vérification OPTIMISTE de la session sur les espaces connectés : il lit le cookie (sans
 *    base de données) et renvoie vers la connexion les visiteurs sans session. Ce n'est PAS
 *    la barrière de sécurité : chaque page et chaque action revérifie l'utilisateur en base
 *    via `requireUser` (src/lib/auth/session.ts). Défense en profondeur.
 */
const { auth } = NextAuth(authConfig);

const authProxy = auth((request) => {
  if (request.auth) return;

  const { pathname } = request.nextUrl;
  const clientArea = /^\/a\/([^/]+)\/mon-compte/.exec(pathname);
  const loginPath = clientArea ? `/a/${clientArea[1]}/connexion` : "/connexion";
  return NextResponse.redirect(new URL(loginPath, request.nextUrl));
});

/** Espaces connectés : session vérifiée par le proxy (comme avant le tunnel). */
const PROTECTED = /^\/(dashboard|admin)(\/|$)|^\/a\/[^/]+\/mon-compte(\/|$)/;

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const { pathname } = request.nextUrl;
  if (!isLocalHost(host) && !isPublicTunnelPath(pathname)) {
    return new NextResponse("Page introuvable.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (PROTECTED.test(pathname)) return authProxy(request, event as never);
  return NextResponse.next();
}

export const config = {
  // Toutes les pages (règle du tunnel), sauf les fichiers statiques de Next.js.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
