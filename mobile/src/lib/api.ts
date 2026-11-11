import { apiBaseUrl } from "./config";
import { absoluteUrl } from "./format";

/*
 * Client de l'API mobile du site (`/api/mobile/v1`). Types alignés sur les réponses du serveur
 * (src/lib/services/catalogue.ts et src/lib/mobile/ du site).
 */

export type Agence = {
  slug: string;
  nom: string;
  ville: string | null;
  logoUrl: string | null;
  devise: string;
};

export type Depart = {
  id: string;
  dateDebut: string;
  dateFin: string;
  prix: number;
  placesLibres: number;
};

export type Note = { moyenne: number; nombre: number };

export type CircuitResume = {
  agence: Agence;
  slug: string;
  titre: string;
  resume: string | null;
  difficulte: "FACILE" | "MOYENNE" | "DIFFICILE";
  dureeJours: number;
  distanceKm: number | null;
  image: string | null;
  credit: string | null;
  prixMin: number;
  note: Note | null;
  prochainDepart: Depart | null;
};

export type CircuitDetail = Omit<CircuitResume, "prochainDepart"> & {
  description: string | null;
  capaciteMax: number;
  etapes: {
    ordre: number;
    jour: number | null;
    nom: string;
    type: string;
    description: string | null;
    latitude: number;
    longitude: number;
  }[];
  /** Tracé réel (points [latitude, longitude]) calculé par A*, ou null. */
  trace: [number, number][] | null;
  partenaires: { prestation: string; partenaire: string; type: string; inclusDansPrix: boolean }[];
  departs: Depart[];
  avis: { note: number; commentaire: string | null; auteur: string; date: string }[];
};

export type CatalogueQuery = {
  q?: string;
  difficulte?: CircuitResume["difficulte"];
  date?: string;
  voyageurs?: number;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Erreurs par champ (« email », « participants.1.prenom »…). */
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** Jeton du voyageur connecté, fourni par le contexte de session (`src/context/auth.tsx`). */
let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Requête JSON ; `json` envoie un corps (POST par défaut). Erreur : `ApiError`. */
async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}/api/mobile/v1${path}`, {
      ...rest,
      ...(json !== undefined ? { method: rest.method ?? "POST", body: JSON.stringify(json) } : {}),
      headers: {
        Accept: "application/json",
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...rest.headers,
      },
    });
  } catch {
    throw new ApiError(
      `Impossible de joindre Green Trek (${apiBaseUrl()}). Vérifiez que le site est démarré, que le téléphone est sur le même Wi-Fi, et l’adresse du serveur (onglet Compte).`,
      0,
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const data = (body && typeof body === "object" ? body : {}) as {
      error?: unknown;
      fieldErrors?: unknown;
    };
    throw new ApiError(
      typeof data.error === "string" ? data.error : `Erreur ${response.status}`,
      response.status,
      data.fieldErrors && typeof data.fieldErrors === "object"
        ? (data.fieldErrors as Record<string, string>)
        : {},
    );
  }
  return body as T;
}

/* ─── Catalogue (public) ──────────────────────────────────────────────────────── */

export function fetchCatalogue(query: CatalogueQuery = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return request<{ agences: Agence[]; circuits: CircuitResume[] }>(
    `/circuits${qs ? `?${qs}` : ""}`,
  );
}

export function fetchCircuit(agence: string, slug: string) {
  return request<CircuitDetail>(
    `/agences/${encodeURIComponent(agence)}/circuits/${encodeURIComponent(slug)}`,
  );
}

/** Adresse complète d'une image du site. */
export function imageUrl(path: string | null): string | null {
  return absoluteUrl(apiBaseUrl(), path);
}

/* ─── Compte du voyageur (lot A3) ─────────────────────────────────────────────── */

export type Profile = {
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  agenceSlug: string;
  agenceNom: string;
};

export type Session = { token: string; user: Profile };

export function login(input: { email: string; password: string; agenceSlug: string }) {
  return request<Session>("/connexion", { json: input });
}

export function register(input: {
  agenceSlug: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  password: string;
  confirmPassword: string;
}) {
  return request<Session>("/inscription", { json: input });
}

export function fetchProfile() {
  return request<Profile>("/moi");
}

/* ─── Réservations du voyageur (lot A3) ───────────────────────────────────────── */

export type StatutReservation = "EN_ATTENTE" | "CONFIRMEE" | "ANNULEE" | "TERMINEE";
export type MethodePaiement = "CARTE_SIMULEE" | "MOBILE_MONEY" | "VIREMENT" | "ESPECES";

export type Reservation = {
  id: string;
  reference: string;
  statut: StatutReservation;
  statutLabel: string;
  nombrePersonnes: number;
  montantTotal: number;
  paye: number;
  reste: number;
  peutPayer: boolean;
  peutAnnuler: boolean;
  remarques: string | null;
  createdAt: string;
  agence: { slug: string; nom: string; devise: string };
  circuit: { titre: string; slug: string; image: string | null };
  depart: { dateDebut: string; dateFin: string };
  participants: { prenom: string; nom: string; age: number | null; nationalite: string | null }[];
  paiements: {
    id: string;
    montant: number;
    methode: MethodePaiement;
    methodeLabel: string;
    statut: string;
    statutLabel: string;
    reference: string | null;
    payeLe: string | null;
  }[];
};

export type ParticipantInput = {
  prenom: string;
  nom: string;
  age: string;
  nationalite: string;
  contactUrgence: string;
};

export function fetchReservations() {
  return request<{ reservations: Reservation[] }>("/reservations");
}

export function fetchReservation(id: string) {
  return request<Reservation>(`/reservations/${encodeURIComponent(id)}`);
}

export function createReservation(input: {
  sessionId: string;
  participants: ParticipantInput[];
  remarques: string;
}) {
  return request<{ id: string; reference: string }>("/reservations", { json: input });
}

export function payReservation(id: string, input: { methode: MethodePaiement; numero: string }) {
  return request<{ statut: string; confirmee: boolean }>(
    `/reservations/${encodeURIComponent(id)}/paiement`,
    { json: input },
  );
}

export function cancelReservation(id: string) {
  return request<{ message: string }>(`/reservations/${encodeURIComponent(id)}/annulation`, {
    json: {},
  });
}
