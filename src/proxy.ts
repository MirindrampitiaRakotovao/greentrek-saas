import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";

/**
 * Proxy Next.js 16 (ex-« middleware ») : vérification OPTIMISTE uniquement.
 * Il lit le cookie de session (sans base de données) et renvoie vers la page de connexion
 * les visiteurs sans session. Ce n'est PAS la barrière de sécurité : chaque page et chaque
 * action revérifie l'utilisateur en base via `requireUser` (src/lib/auth/session.ts).
 * Défense en profondeur : si le proxy était contourné, l'accès resterait refusé.
 */
const { auth } = NextAuth(authConfig);

export default auth((request) => {
  if (request.auth) return;

  const { pathname } = request.nextUrl;
  const clientArea = /^\/a\/([^/]+)\/mon-compte/.exec(pathname);
  const loginPath = clientArea ? `/a/${clientArea[1]}/connexion` : "/connexion";
  return NextResponse.redirect(new URL(loginPath, request.nextUrl));
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/a/:slug/mon-compte/:path*"],
};
