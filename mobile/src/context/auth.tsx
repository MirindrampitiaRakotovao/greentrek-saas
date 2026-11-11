import { createContext, type ReactNode, use, useEffect, useState } from "react";

import {
  ApiError,
  fetchProfile,
  login as apiLogin,
  type Profile,
  register as apiRegister,
  type Session,
  setAuthToken,
} from "@/lib/api";
import { readSession, writeSession } from "@/lib/session-store";

type AuthState = {
  /** Voyageur connecté, ou `null`. */
  user: Profile | null;
  login: (input: Parameters<typeof apiLogin>[0]) => Promise<void>;
  register: (input: Parameters<typeof apiRegister>[0]) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

/**
 * Session du voyageur.
 * - Au démarrage, la session enregistrée (jeton et profil) est relue AVANT d'afficher les
 *   écrans : aucune requête ne part sans le jeton, même si l'application s'ouvre directement
 *   sur une réservation.
 * - Le profil est ensuite revérifié par l'API (`/moi`) : jeton refusé (expiré, compte désactivé,
 *   agence suspendue) → session effacée ; hors connexion → session gardée.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const saved = await readSession();
      if (!active) return;
      if (saved) {
        setAuthToken(saved.token);
        setUser(saved.user);
      }
      setReady(true);
      if (!saved) return;
      try {
        const profile = await fetchProfile();
        if (!active) return;
        setUser(profile);
        await writeSession({ token: saved.token, user: profile });
      } catch (error: unknown) {
        if (active && error instanceof ApiError && error.status === 401) {
          setAuthToken(null);
          setUser(null);
          await writeSession(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function open(session: Session) {
    setAuthToken(session.token);
    await writeSession(session);
    setUser(session.user);
  }

  const value: AuthState = {
    user,
    login: async (input) => open(await apiLogin(input)),
    register: async (input) => open(await apiRegister(input)),
    logout: async () => {
      setAuthToken(null);
      await writeSession(null);
      setUser(null);
    },
  };
  // Rien n'est affiché tant que la session enregistrée n'a pas été relue (quelques millisecondes).
  return <AuthContext value={value}>{ready ? children : null}</AuthContext>;
}

export function useAuth(): AuthState {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth : AuthProvider manquant.");
  return ctx;
}
