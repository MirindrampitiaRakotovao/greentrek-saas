import { API_BASE_URL } from "./config";
import { absoluteUrl } from "./format";

/*
 * Client de l'API mobile du site (`/api/mobile/v1`). Types alignés sur les réponses du serveur
 * (src/lib/services/catalogue.ts du site).
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
  }[];
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
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/mobile/v1${path}`, {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(
      `Impossible de joindre Green Trek (${API_BASE_URL}). Vérifiez que le site est démarré et que le téléphone est sur le même Wi-Fi.`,
      0,
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : `Erreur ${response.status}`;
    throw new ApiError(message, response.status);
  }
  return body as T;
}

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
  return absoluteUrl(API_BASE_URL, path);
}
