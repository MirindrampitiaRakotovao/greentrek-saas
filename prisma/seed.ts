/**
 * Seed minimal de la base de développement (étape E1).
 *
 * Contenu :
 * - 3 plans FICTIFS (Essai, Pro, Entreprise) : tarifs et limites inventés (cahier des charges §16) ;
 * - 3 agences : Green Trek Mada (réelle) et 2 agences FICTIVES, pour prouver l'isolation ;
 * - un utilisateur par rôle et par agence, plus le super admin (personnes FICTIVES) ;
 * - un abonnement par agence (simulé) ;
 * - les 4 partenaires réels de Green Trek Mada (noms seulement, détails à relever sur le terrain).
 *
 * - une activité de DÉMONSTRATION par agence (prisma/demo-data.ts, avancée de l'étape E12
 *   pour que les tableaux de bord soient lisibles) : 8 voyageurs fictifs, un second guide
 *   sans compte, circuits, départs, réservations, participants, paiements simulés et
 *   notifications. Circuits de Green Trek marqués « [DÉMO] », prix TODO(données terrain).
 *
 * - le graphe de démonstration (E4) : étapes (lieux OpenStreetMap réels pour Green Trek,
 *   lieux fictifs pour les agences de démo) et itinéraires des circuits ; tronçons (E5)
 *   entre plus proches voisins, distances et durées estimées.
 * Le script vide d'abord la base : il est destiné au développement uniquement.
 */
import "dotenv/config";

import bcrypt from "bcryptjs";

import type { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { PHOTO_CREDITS } from "@/lib/photo-credits";

import {
  DEMO_ALPHA_CIRCUITS,
  DEMO_ALPHA_GRAPH,
  DEMO_BETA_CIRCUITS,
  DEMO_BETA_GRAPH,
  type DemoCircuit,
  type DemoGraph,
  generateAgencyDemo,
  generateDemoEdges,
  GREEN_TREK_CIRCUITS,
  GREEN_TREK_GRAPH,
  ITINERAIRE_DEMO,
  TRONCON_DEMO,
} from "./demo-data";

/** Mot de passe commun à tous les comptes de démonstration (documenté dans docs/AVANCEMENT.md). */
const DEMO_PASSWORD = "Demo2026!";

async function clearDatabase(): Promise<void> {
  // Ordre inverse des dépendances (les enfants avant les parents).
  await db.$transaction([
    db.journalActivite.deleteMany(),
    db.notification.deleteMany(),
    db.avis.deleteMany(),
    db.paiement.deleteMany(),
    db.participant.deleteMany(),
    db.reservation.deleteMany(),
    db.sessionDepart.deleteMany(),
    db.itineraireCalcule.deleteMany(),
    db.circuitPartenaire.deleteMany(),
    db.circuitEtape.deleteMany(),
    db.troncon.deleteMany(),
    db.etape.deleteMany(),
    db.circuit.deleteMany(),
    db.partenaire.deleteMany(),
    db.guide.deleteMany(),
    db.abonnement.deleteMany(),
    db.utilisateur.deleteMany(),
    db.agence.deleteMany(),
    db.plan.deleteMany(),
  ]);
}

async function seedPlans() {
  // Plans et tarifs FICTIFS (hypothèse §16.1 du cahier des charges).
  const essai = await db.plan.create({
    data: {
      code: "ESSAI",
      nom: "Essai",
      prixMensuel: 0,
      maxCircuits: 3,
      maxUtilisateurs: 3,
      maxSessionsActives: 5,
      fonctionnalites: ["Site vitrine", "Réservation en ligne", "Calcul d'itinéraire"],
    },
  });
  const pro = await db.plan.create({
    data: {
      code: "PRO",
      nom: "Pro",
      prixMensuel: 150_000,
      maxCircuits: 20,
      maxUtilisateurs: 10,
      maxSessionsActives: 50,
      fonctionnalites: [
        "Site vitrine",
        "Réservation en ligne",
        "Calcul d'itinéraire",
        "Tableau de bord",
        "Guides et partenaires",
        "Historique des itinéraires",
      ],
    },
  });
  await db.plan.create({
    data: {
      code: "ENTREPRISE",
      nom: "Entreprise",
      prixMensuel: 400_000,
      maxCircuits: 100,
      maxUtilisateurs: 50,
      maxSessionsActives: 500,
      fonctionnalites: [
        "Site vitrine",
        "Réservation en ligne",
        "Calcul d'itinéraire",
        "Tableau de bord",
        "Guides et partenaires",
        "Historique des itinéraires",
        "Analyse des performances",
        "Support prioritaire",
      ],
    },
  });
  return { essai, pro };
}

type AgenceSeed = {
  nom: string;
  slug: string;
  description: string;
  ville: string | null;
  pays: string | null;
};

const AGENCES: readonly AgenceSeed[] = [
  {
    nom: "Green Trek Mada",
    slug: "green-trek-mada",
    description:
      "Agence d'écotourisme basée à Mahambo (district de Fénérive-Est, côte Est de Madagascar).",
    ville: "Mahambo",
    pays: "Madagascar",
    // TODO(données terrain) : e-mail, téléphone et adresse officiels de l'agence.
  },
  {
    nom: "Agence Démo Alpha (fictive)",
    slug: "demo-alpha",
    description: "Agence FICTIVE créée pour démontrer l'isolation des données entre agences.",
    ville: null,
    pays: null,
  },
  {
    nom: "Agence Démo Beta (fictive)",
    slug: "demo-beta",
    description: "Agence FICTIVE créée pour démontrer l'isolation des données entre agences.",
    ville: null,
    pays: null,
  },
];

/** Paramètres de la démonstration de chaque agence (préfixe des références, circuits, graine). */
const DEMO_BY_SLUG: Record<
  string,
  { prefix: string; circuits: DemoCircuit[]; graph: DemoGraph; seed: number }
> = {
  "green-trek-mada": {
    prefix: "GT",
    circuits: GREEN_TREK_CIRCUITS,
    graph: GREEN_TREK_GRAPH,
    seed: 1,
  },
  "demo-alpha": { prefix: "ALP", circuits: DEMO_ALPHA_CIRCUITS, graph: DEMO_ALPHA_GRAPH, seed: 2 },
  "demo-beta": { prefix: "BET", circuits: DEMO_BETA_CIRCUITS, graph: DEMO_BETA_GRAPH, seed: 3 },
};

/**
 * Prestations des partenaires réels de Green Trek dans les circuits de démonstration
 * (index du circuit, nom du partenaire). Prix : TODO(données terrain).
 */
const GREEN_TREK_PRESTATIONS: readonly {
  circuit: number;
  partenaire: string;
  prestation: string;
  inclusDansPrix: boolean;
}[] = [
  {
    circuit: 1,
    partenaire: "Piroguiers Mahambo",
    prestation: "Retour en pirogue",
    inclusDansPrix: true,
  },
  {
    circuit: 1,
    partenaire: "Surf Dah Mahambo",
    prestation: "Initiation au surf",
    inclusDansPrix: false,
  },
  {
    circuit: 2,
    partenaire: "La Pirogue Hôtel",
    prestation: "Hébergement (nuitées)",
    inclusDansPrix: true,
  },
  { circuit: 3, partenaire: "Vanilla Café", prestation: "Déjeuner", inclusDansPrix: true },
];

const VOYAGEURS = 8;

type AgencyRefs = {
  agenceId: string;
  slug: string;
  adminId: string;
  clientId: string;
  guideId: string;
  motDePasseHash: string;
};

/** Activité de démonstration d'une agence (données entièrement fictives). */
async function seedDemoActivity(refs: AgencyRefs, now: Date): Promise<void> {
  const demo = DEMO_BY_SLUG[refs.slug];
  if (!demo) return;
  const { agenceId } = refs;

  // Voyageurs fictifs (domaine réservé `.test`) ; l'index 0 est le client de démonstration.
  const clientIds = [refs.clientId];
  for (let n = 1; n <= VOYAGEURS; n += 1) {
    const numero = String(n).padStart(2, "0");
    const voyageur = await db.utilisateur.create({
      data: {
        agenceId,
        nom: "Démo",
        prenom: `Voyageur ${numero}`,
        email: `voyageur${numero}@${refs.slug}.test`,
        motDePasseHash: refs.motDePasseHash,
        role: "CLIENT",
      },
    });
    clientIds.push(voyageur.id);
  }

  // Second guide, sans compte de connexion (§5.2 : un guide peut ne pas avoir de compte).
  await db.guide.create({
    data: {
      agenceId,
      nom: "Démo",
      prenom: "Guide sans compte",
      langues: ["fr", "en"],
      experienceAnnees: 3,
    },
  });

  const data = generateAgencyDemo(
    {
      prefix: demo.prefix,
      circuits: demo.circuits,
      clientCount: clientIds.length,
      seed: demo.seed,
    },
    now,
  );

  // Graphe : étapes de l'agence (réelles pour Green Trek, fictives pour les agences de démo).
  const etapeIds: string[] = [];
  for (const etape of demo.graph.etapes) {
    const created = await db.etape.create({ data: { ...etape, agenceId } });
    etapeIds.push(created.id);
  }

  // Tronçons de démonstration : distances et durées ESTIMÉES (distanceEstimee = true, §11).
  await db.troncon.createMany({
    data: generateDemoEdges(demo.graph).map((edge) => ({
      agenceId,
      etapeDepartId: etapeIds[edge.from]!,
      etapeArriveeId: etapeIds[edge.to]!,
      distanceKm: edge.distanceKm,
      dureeMinutes: edge.dureeMinutes,
      difficulte: 2,
      bidirectionnel: true,
      distanceEstimee: true,
      commentaire: TRONCON_DEMO,
    })),
  });

  const circuitIds: string[] = [];
  for (const [index, circuit] of data.circuits.entries()) {
    // Photo libre de droits (Wikimedia Commons) livrée dans public/images/circuits/, avec
    // crédits dans src/lib/photo-credits.ts ; aucune si le circuit n'en a pas.
    const photo = `/images/circuits/${circuit.slug}.jpg`;
    const created = await db.circuit.create({
      data: {
        ...circuit,
        agenceId,
        statut: "PUBLIE",
        imagePrincipaleUrl: PHOTO_CREDITS[photo] ? photo : null,
      },
    });
    circuitIds.push(created.id);
    // Étapes ordonnées du circuit (RG 4 : au moins deux, rangs 1..n).
    await db.circuitEtape.createMany({
      data: (demo.graph.itineraires[index] ?? []).map((etapeIndex, position) => ({
        circuitId: created.id,
        etapeId: etapeIds[etapeIndex]!,
        ordre: position + 1,
        jour: circuit.dureeJours > 1 ? Math.min(circuit.dureeJours, position + 1) : 1,
        notes: ITINERAIRE_DEMO,
      })),
    });
  }

  if (refs.slug === "green-trek-mada") {
    const partenaires = await db.partenaire.findMany({ where: { agenceId } });
    for (const p of GREEN_TREK_PRESTATIONS) {
      const partenaire = partenaires.find((x) => x.nom === p.partenaire);
      if (!partenaire) continue;
      await db.circuitPartenaire.create({
        data: {
          circuitId: circuitIds[p.circuit]!,
          partenaireId: partenaire.id,
          prestation: p.prestation,
          inclusDansPrix: p.inclusDansPrix,
        },
      });
    }
  }

  const sessionIds: string[] = [];
  for (const session of data.sessions) {
    const created = await db.sessionDepart.create({
      data: {
        agenceId,
        circuitId: circuitIds[session.circuitIndex]!,
        guideId: session.withGuide ? refs.guideId : null,
        dateDebut: session.dateDebut,
        dateFin: session.dateFin,
        placesTotal: session.placesTotal,
        prixParPersonne: session.prixParPersonne,
        statut: session.statut,
      },
    });
    sessionIds.push(created.id);
  }

  for (const reservation of data.reservations) {
    const created = await db.reservation.create({
      data: {
        agenceId,
        reference: reservation.reference,
        clientId: clientIds[reservation.clientIndex]!,
        sessionId: sessionIds[reservation.sessionIndex]!,
        nombrePersonnes: reservation.nombrePersonnes,
        montantTotal: reservation.montantTotal,
        statut: reservation.statut,
        createdAt: reservation.createdAt,
        confirmeeAt: reservation.confirmeeAt,
        annuleeAt: reservation.annuleeAt,
      },
    });
    await db.participant.createMany({
      data: reservation.participants.map((p) => ({ ...p, reservationId: created.id })),
    });
    if (reservation.paiements.length > 0) {
      await db.paiement.createMany({
        data: reservation.paiements.map((p) => ({ ...p, reservationId: created.id })),
      });
    }
  }

  // Notifications in-app de l'administrateur : les 5 dernières réservations (P2, simulées).
  const recentes = [...data.reservations]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);
  await db.notification.createMany({
    data: recentes.map((r, index) => ({
      agenceId,
      utilisateurId: refs.adminId,
      type: "RESERVATION",
      titre: `Nouvelle réservation ${r.reference}`,
      message: `${r.nombrePersonnes} personne(s) — ${data.circuits[data.sessions[r.sessionIndex]!.circuitIndex]!.titre}`,
      lue: index >= 3,
      createdAt: r.createdAt,
    })),
  });
}

const ROLES_AGENCE: readonly { role: Role; prefixe: string; prenom: string }[] = [
  { role: "ADMIN_AGENCE", prefixe: "admin", prenom: "Admin" },
  { role: "STAFF", prefixe: "staff", prenom: "Staff" },
  { role: "GUIDE", prefixe: "guide", prenom: "Guide" },
  { role: "CLIENT", prefixe: "client", prenom: "Client" },
];

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Le seed vide la base : il ne doit pas être lancé en production.");
  }

  await clearDatabase();
  const motDePasseHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const { essai, pro } = await seedPlans();

  await db.utilisateur.create({
    data: {
      agenceId: null,
      nom: "Démo",
      prenom: "Super Admin",
      email: "superadmin@greentrek-saas.test",
      motDePasseHash,
      role: "SUPER_ADMIN",
    },
  });

  const aujourdhui = new Date();
  const dans30Jours = new Date(aujourdhui.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (const agenceSeed of AGENCES) {
    const agence = await db.agence.create({ data: agenceSeed });
    const ids: Partial<Record<"adminId" | "clientId" | "guideId", string>> = {};

    for (const { role, prefixe, prenom } of ROLES_AGENCE) {
      // Domaine réservé `.test` (RFC 2606) : ces adresses ne peuvent appartenir à personne.
      const utilisateur = await db.utilisateur.create({
        data: {
          agenceId: agence.id,
          nom: "Démo",
          prenom,
          email: `${prefixe}@${agence.slug}.test`,
          motDePasseHash,
          role,
        },
      });

      if (role === "ADMIN_AGENCE") ids.adminId = utilisateur.id;
      if (role === "CLIENT") ids.clientId = utilisateur.id;
      if (role === "GUIDE") {
        const fiche = await db.guide.create({
          data: {
            agenceId: agence.id,
            utilisateurId: utilisateur.id,
            nom: "Démo",
            prenom: "Guide",
            langues: ["fr", "mg"],
            experienceAnnees: 6,
          },
        });
        ids.guideId = fiche.id;
      }
    }

    // Abonnements simulés : Green Trek Mada en Pro actif, les agences fictives en essai.
    const estGreenTrek = agence.slug === "green-trek-mada";
    await db.abonnement.create({
      data: {
        agenceId: agence.id,
        planId: estGreenTrek ? pro.id : essai.id,
        // Green Trek : abonnée depuis 10 mois (cohérent avec l'historique de démonstration).
        dateDebut: estGreenTrek ? new Date(aujourdhui.getTime() - 300 * 86_400_000) : aujourdhui,
        dateFin: estGreenTrek ? null : dans30Jours,
        statut: estGreenTrek ? "ACTIF" : "ESSAI",
      },
    });

    if (estGreenTrek) {
      // Partenaires réels cités dans la présentation de l'agence.
      // TODO(données terrain) : description, téléphone, e-mail, adresse, coordonnées GPS, tarifs.
      await db.partenaire.createMany({
        data: [
          // Photos fournies par l'étudiant (TODO(photos Green Trek) : source et licence).
          {
            agenceId: agence.id,
            nom: "Vanilla Café",
            type: "RESTAURATION",
            imageUrl: "/images/partenaires/vanilla-cafe.jpg",
          },
          {
            agenceId: agence.id,
            nom: "La Pirogue Hôtel",
            type: "HEBERGEMENT",
            imageUrl: "/images/partenaires/la-pirogue-hotel.jpg",
          },
          {
            agenceId: agence.id,
            nom: "Surf Dah Mahambo",
            type: "ACTIVITE",
            imageUrl: "/images/partenaires/surf-dah-mahambo.jpg",
          },
          {
            agenceId: agence.id,
            nom: "Piroguiers Mahambo",
            type: "TRANSPORT",
            imageUrl: "/images/partenaires/piroguiers-mahambo.jpg",
          },
        ],
      });
    }

    if (!ids.adminId || !ids.clientId || !ids.guideId)
      throw new Error("Comptes de démo manquants.");
    await seedDemoActivity(
      {
        agenceId: agence.id,
        slug: agence.slug,
        adminId: ids.adminId,
        clientId: ids.clientId,
        guideId: ids.guideId,
        motDePasseHash,
      },
      aujourdhui,
    );
  }

  const [agences, utilisateurs, partenaires, etapes, troncons, circuits, departs, reservations] =
    await Promise.all([
      db.agence.count(),
      db.utilisateur.count(),
      db.partenaire.count(),
      db.etape.count(),
      db.troncon.count(),
      db.circuit.count(),
      db.sessionDepart.count(),
      db.reservation.count(),
    ]);
  console.log(
    `Seed terminé : ${agences} agences, ${utilisateurs} utilisateurs, ${partenaires} partenaires, ` +
      `${etapes} étapes, ${troncons} tronçons, ${circuits} circuits, ${departs} départs, ${reservations} réservations ` +
      "(démonstration fictive).",
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
