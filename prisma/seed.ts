/**
 * Seed de la base de développement (étape E1, complété à l'étape E12).
 *
 * Contenu (voir prisma/demo-data.ts pour les règles de génération) :
 * - 3 plans (Essai, Pro, Entreprise) : tarifs et limites inventés (cahier des charges §16.1) ;
 * - 3 agences : Green Trek Mada (réelle) et deux agences INVENTÉES, Tanety Trek (Antsirabe)
 *   et Ranohira Sentiers (Isalo), pour démontrer le multi-agences et l'isolation ;
 * - une équipe par agence (administrateur, personnel, guide avec compte, guide sans compte)
 *   et un compte client, plus le super admin : personnes INVENTÉES ;
 * - des clients inventés (adresses @example.com), 12 mois de départs, de réservations, de
 *   participants, de paiements et d'avis, des notifications ;
 * - les graphes : lieux réels d'OpenStreetMap, tronçons à distance estimée ;
 * - un historique d'abonnements par agence.
 *
 * Textes affichés sans mention « démo » ni « fictif » (décision de l'étudiant, étape E12) :
 * ce qui est inventé est documenté ici, dans prisma/demo-data.ts et dans docs/AVANCEMENT.md.
 * Le script vide d'abord la base : il est destiné au développement uniquement.
 */
import "dotenv/config";

import bcrypt from "bcryptjs";

import type { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { PHOTO_CREDITS } from "@/lib/photo-credits";
import { referencePrefix } from "@/lib/reference";

import {
  type DemoCircuit,
  type DemoGraph,
  type DemoPerson,
  exampleEmail,
  generateAgencyDemo,
  generateConversations,
  generateClients,
  generateDemoEdges,
  GREEN_TREK_CIRCUITS,
  GREEN_TREK_GRAPH,
  ITINERAIRE_NOTES,
  RANOHIRA_CIRCUITS,
  RANOHIRA_GRAPH,
  TANETY_CIRCUITS,
  TANETY_GRAPH,
  TRONCON_COMMENTAIRE,
} from "./demo-data";

/** Mot de passe commun à tous les comptes de démonstration (documenté dans docs/AVANCEMENT.md). */
const DEMO_PASSWORD = "Demo2026!";
const DAY = 86_400_000;

async function clearDatabase(): Promise<void> {
  // Ordre inverse des dépendances (les enfants avant les parents).
  await db.$transaction([
    db.lectureConversation.deleteMany(),
    db.message.deleteMany(),
    db.conversation.deleteMany(),
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
  // Plans et tarifs inventés (hypothèse §16.1 du cahier des charges).
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
  const entreprise = await db.plan.create({
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
  return { essai, pro, entreprise };
}

/* ─── Agences ────────────────────────────────────────────────────────────────── */

type Person = { prenom: string; nom: string };

type AgenceSeed = {
  nom: string;
  slug: string;
  description: string;
  ville: string;
  pays: string;
  circuits: DemoCircuit[];
  graph: DemoGraph;
  seed: number;
  /** Nombre de clients (en plus du compte client de démonstration). */
  clients: number;
  /** Équipe (personnes INVENTÉES). */
  equipe: { admin: Person; staff: Person; guide: Person; guideSansCompte: Person; client: Person };
  /** Abonnements, du plus ancien au plus récent (jours depuis aujourd'hui, durée en jours). */
  abonnements: {
    plan: "essai" | "pro" | "entreprise";
    debut: number;
    duree: number | null;
    statut: "ACTIF" | "ESSAI" | "ANNULE";
  }[];
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
    circuits: GREEN_TREK_CIRCUITS,
    graph: GREEN_TREK_GRAPH,
    seed: 1,
    clients: 45,
    equipe: {
      admin: { prenom: "Hanta", nom: "Razafimahefa" },
      staff: { prenom: "Mamy", nom: "Andrianarisoa" },
      guide: { prenom: "Tahina", nom: "Rasolofo" },
      guideSansCompte: { prenom: "Faly", nom: "Randriambelo" },
      client: { prenom: "Nirina", nom: "Randriamanana" },
    },
    abonnements: [
      { plan: "essai", debut: -400, duree: 30, statut: "ANNULE" },
      { plan: "pro", debut: -370, duree: null, statut: "ACTIF" },
    ],
  },
  {
    nom: "Tanety Trek",
    slug: "tanety-trek",
    description:
      "Randonnées sur les Hautes Terres autour d'Antsirabe : lacs volcaniques, rizières en terrasses et villages.",
    ville: "Antsirabe",
    pays: "Madagascar",
    circuits: TANETY_CIRCUITS,
    graph: TANETY_GRAPH,
    seed: 2,
    clients: 25,
    equipe: {
      admin: { prenom: "Andry", nom: "Rakotoarivelo" },
      staff: { prenom: "Lalaina", nom: "Ranaivoson" },
      guide: { prenom: "Njaka", nom: "Ratsimbazafy" },
      guideSansCompte: { prenom: "Holy", nom: "Raharison" },
      client: { prenom: "Camille", nom: "Lefebvre" },
    },
    abonnements: [
      { plan: "essai", debut: -395, duree: 30, statut: "ANNULE" },
      // Abonnement annuel qui arrive à échéance dans un mois (renouvellement à venir).
      { plan: "pro", debut: -365, duree: 395, statut: "ACTIF" },
    ],
  },
  {
    nom: "Ranohira Sentiers",
    slug: "ranohira-sentiers",
    description:
      "Trekking dans le massif de l'Isalo au départ de Ranohira : canyons, piscines naturelles et bivouacs.",
    ville: "Ranohira",
    pays: "Madagascar",
    circuits: RANOHIRA_CIRCUITS,
    graph: RANOHIRA_GRAPH,
    seed: 3,
    clients: 25,
    equipe: {
      admin: { prenom: "Tsiry", nom: "Rabearisoa" },
      staff: { prenom: "Onja", nom: "Rasamoelina" },
      guide: { prenom: "Fidy", nom: "Rakotonirina" },
      guideSansCompte: { prenom: "Toky", nom: "Rajaonarison" },
      client: { prenom: "Lukas", nom: "Schneider" },
    },
    abonnements: [
      { plan: "essai", debut: -390, duree: 30, statut: "ANNULE" },
      { plan: "entreprise", debut: -360, duree: null, statut: "ACTIF" },
    ],
  },
];

/** Prestations des partenaires réels de Green Trek dans ses circuits. Prix : TODO(données terrain). */
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

/** Minuit UTC du jour, décalé : colonnes SQL DATE. */
function day(now: Date, offset: number): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + offset * DAY,
  );
}

async function seedAgence(
  spec: AgenceSeed,
  plans: Record<"essai" | "pro" | "entreprise", { id: string }>,
  motDePasseHash: string,
  now: Date,
) {
  const agence = await db.agence.create({
    data: {
      nom: spec.nom,
      slug: spec.slug,
      description: spec.description,
      ville: spec.ville,
      pays: spec.pays,
      createdAt: new Date(now.getTime() + (spec.abonnements[0]?.debut ?? 0) * DAY),
    },
  });
  const agenceId = agence.id;

  // Équipe : comptes de connexion documentés (domaine réservé `.test`, RFC 2606).
  const compte = (prefixe: string, person: Person, role: Role) =>
    db.utilisateur.create({
      data: {
        agenceId,
        ...person,
        email: `${prefixe}@${spec.slug}.test`,
        motDePasseHash,
        role,
        dernierLoginAt: new Date(now.getTime() - 3 * 3_600_000),
      },
    });
  const admin = await compte("admin", spec.equipe.admin, "ADMIN_AGENCE");
  const staff = await compte("staff", spec.equipe.staff, "STAFF");
  const guideCompte = await compte("guide", spec.equipe.guide, "GUIDE");
  const clientCompte = await compte("client", spec.equipe.client, "CLIENT");
  const guide = await db.guide.create({
    data: {
      agenceId,
      utilisateurId: guideCompte.id,
      ...spec.equipe.guide,
      langues: ["fr", "mg", "en"],
      experienceAnnees: 7,
      bio: "Guide de randonnée depuis plusieurs années, né dans la région.",
    },
  });
  await db.guide.create({
    data: {
      agenceId,
      ...spec.equipe.guideSansCompte,
      langues: ["mg", "fr"],
      experienceAnnees: 3,
    },
  });

  // Abonnements (historique) : dates en jours depuis aujourd'hui.
  for (const a of spec.abonnements) {
    const annule = a.statut === "ANNULE";
    await db.abonnement.create({
      data: {
        agenceId,
        planId: plans[a.plan].id,
        statut: a.statut,
        dateDebut: day(now, a.debut),
        dateFin: a.duree === null ? null : day(now, a.debut + a.duree - 1),
        renouvellementAuto: !annule && a.plan === "pro",
      },
    });
  }

  if (spec.slug === "green-trek-mada") {
    // Partenaires réels cités dans la présentation de l'agence.
    // TODO(données terrain) : description, téléphone, e-mail, adresse, coordonnées GPS, tarifs.
    // Photos fournies par l'étudiant (TODO(photos Green Trek) : source et licence).
    await db.partenaire.createMany({
      data: [
        {
          agenceId,
          nom: "Vanilla Café",
          type: "RESTAURATION",
          imageUrl: "/images/partenaires/vanilla-cafe.jpg",
        },
        {
          agenceId,
          nom: "La Pirogue Hôtel",
          type: "HEBERGEMENT",
          imageUrl: "/images/partenaires/la-pirogue-hotel.jpg",
        },
        {
          agenceId,
          nom: "Surf Dah Mahambo",
          type: "ACTIVITE",
          imageUrl: "/images/partenaires/surf-dah-mahambo.jpg",
        },
        {
          agenceId,
          nom: "Piroguiers Mahambo",
          type: "TRANSPORT",
          imageUrl: "/images/partenaires/piroguiers-mahambo.jpg",
        },
      ],
    });
  }

  // Clients : le compte client (index 0) puis des voyageurs inventés (@example.com).
  const nomsEquipe = new Set(Object.values(spec.equipe).map((p) => `${p.prenom} ${p.nom}`));
  const people: DemoPerson[] = [
    {
      ...spec.equipe.client,
      nationalite: spec.slug === "green-trek-mada" ? "Malagasy" : "Française",
    },
    // Aucun voyageur ne porte le nom d'un membre de l'équipe ou du compte client.
    ...generateClients(spec.clients, spec.seed).filter(
      (p) => !nomsEquipe.has(`${p.prenom} ${p.nom}`),
    ),
  ];
  const clientIds = [clientCompte.id];
  for (const person of people.slice(1)) {
    const client = await db.utilisateur.create({
      data: {
        agenceId,
        prenom: person.prenom,
        nom: person.nom,
        email: exampleEmail(person),
        motDePasseHash,
        role: "CLIENT",
      },
    });
    clientIds.push(client.id);
  }

  // Graphe : étapes (lieux OpenStreetMap) et tronçons à distance estimée.
  const etapeIds: string[] = [];
  for (const etape of spec.graph.etapes) {
    etapeIds.push((await db.etape.create({ data: { ...etape, agenceId } })).id);
  }
  await db.troncon.createMany({
    data: generateDemoEdges(spec.graph).map((edge) => ({
      agenceId,
      etapeDepartId: etapeIds[edge.from]!,
      etapeArriveeId: etapeIds[edge.to]!,
      distanceKm: edge.distanceKm,
      dureeMinutes: edge.dureeMinutes,
      difficulte: 2,
      bidirectionnel: true,
      distanceEstimee: true,
      commentaire: TRONCON_COMMENTAIRE,
    })),
  });

  const data = generateAgencyDemo(
    {
      prefix: referencePrefix(spec.slug),
      circuits: spec.circuits,
      clients: people,
      seed: spec.seed,
    },
    now,
  );

  const circuitIds: string[] = [];
  for (const [index, circuit] of data.circuits.entries()) {
    // Photo libre de droits (Wikimedia Commons), crédits dans src/lib/photo-credits.ts.
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
    await db.circuitEtape.createMany({
      data: (spec.graph.itineraires[index] ?? []).map((etapeIndex, position) => ({
        circuitId: created.id,
        etapeId: etapeIds[etapeIndex]!,
        ordre: position + 1,
        jour: circuit.dureeJours > 1 ? Math.min(circuit.dureeJours, position + 1) : 1,
        notes: ITINERAIRE_NOTES,
      })),
    });
  }

  if (spec.slug === "green-trek-mada") {
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
        guideId: session.withGuide ? guide.id : null,
        dateDebut: session.dateDebut,
        dateFin: session.dateFin,
        placesTotal: session.placesTotal,
        prixParPersonne: session.prixParPersonne,
        statut: session.statut,
      },
    });
    sessionIds.push(created.id);
  }

  const reservationIds: string[] = [];
  const avisIds = new Map<number, string>();
  for (const [index, reservation] of data.reservations.entries()) {
    const created = await db.reservation.create({
      data: {
        agenceId,
        reference: reservation.reference,
        clientId: clientIds[reservation.clientIndex]!,
        sessionId: sessionIds[reservation.sessionIndex]!,
        nombrePersonnes: reservation.nombrePersonnes,
        montantTotal: reservation.montantTotal,
        statut: reservation.statut,
        remarques: reservation.remarques,
        createdAt: reservation.createdAt,
        confirmeeAt: reservation.confirmeeAt,
        annuleeAt: reservation.annuleeAt,
      },
    });
    reservationIds.push(created.id);
    await db.participant.createMany({
      data: reservation.participants.map((p) => ({ ...p, reservationId: created.id })),
    });
    if (reservation.paiements.length > 0) {
      await db.paiement.createMany({
        data: reservation.paiements.map((p) => ({ ...p, reservationId: created.id })),
      });
    }
    if (reservation.avis) {
      const avis = await db.avis.create({
        data: {
          agenceId,
          circuitId: circuitIds[data.sessions[reservation.sessionIndex]!.circuitIndex]!,
          reservationId: created.id,
          clientId: clientIds[reservation.clientIndex]!,
          ...reservation.avis,
        },
      });
      avisIds.set(index, avis.id);
    }
  }

  // Messagerie : quelques échanges sur des réservations récentes ou à venir.
  const auteurs = { AGENCE: staff.id, GUIDE: guideCompte.id } as const;
  for (const conversation of generateConversations(data, now)) {
    const r = data.reservations[conversation.reservationIndex]!;
    const clientId = clientIds[r.clientIndex]!;
    const titre = data.circuits[data.sessions[r.sessionIndex]!.circuitIndex]!.titre;
    const messages = conversation.messages.map((m) => ({
      ...m,
      auteurId: m.auteur === "CLIENT" ? clientId : auteurs[m.auteur],
    }));
    const created = await db.conversation.create({
      data: {
        agenceId,
        clientId,
        reservationId: reservationIds[conversation.reservationIndex]!,
        sujet: `${titre} · ${r.reference}`,
        createdAt: messages[0]!.createdAt,
        dernierMessageAt: messages.at(-1)!.createdAt,
      },
    });
    await db.message.createMany({
      data: messages.map((m) => ({
        conversationId: created.id,
        auteurId: m.auteurId,
        contenu: m.contenu,
        createdAt: m.createdAt,
      })),
    });
    // Chaque auteur a lu la conversation jusqu'à son dernier message.
    const lectures = new Map(messages.map((m) => [m.auteurId, m.createdAt]));
    await db.lectureConversation.createMany({
      data: [...lectures].map(([utilisateurId, luJusqua]) => ({
        conversationId: created.id,
        utilisateurId,
        luJusqua,
      })),
    });
  }

  // Journal d'activité des 90 derniers jours, déduit des données ci-dessus (mêmes codes
  // d'action que l'application) : paiements reçus à l'agence et validés, avis modérés.
  const depuis = now.getTime() - 90 * 24 * 3_600_000;
  const journal = data.reservations.flatMap((r, index) => [
    ...r.paiements
      .filter(
        (p) =>
          p.statut === "VALIDE" &&
          (p.methode === "ESPECES" || p.methode === "VIREMENT") &&
          p.payeLe !== null &&
          p.payeLe.getTime() > depuis,
      )
      .map((p) => ({
        utilisateurId: staff.id,
        action: "PAIEMENT_VALIDE",
        entite: "Reservation",
        entiteId: reservationIds[index]!,
        details: { reference: r.reference, montant: p.montant },
        createdAt: p.payeLe!,
      })),
    ...(r.avis && r.avis.statut === "PUBLIE" && r.avis.createdAt.getTime() > depuis
      ? [
          {
            utilisateurId: admin.id,
            action: "AVIS_MODERE",
            entite: "Avis",
            entiteId: avisIds.get(index)!,
            details: { statut: "PUBLIE" },
            createdAt: new Date(
              Math.min(now.getTime(), r.avis.createdAt.getTime() + 20 * 3_600_000),
            ),
          },
        ]
      : []),
  ]);
  if (journal.length > 0) {
    await db.journalActivite.createMany({
      data: journal.map((entry) => ({ ...entry, agenceId })),
    });
  }

  // Notifications internes de l'équipe : dernières réservations et paiements à valider.
  const titreCircuit = (sessionIndex: number) =>
    data.circuits[data.sessions[sessionIndex]!.circuitIndex]!.titre;
  const events = data.reservations
    .map((r, index) => ({ r, id: reservationIds[index]! }))
    .sort((a, b) => b.r.createdAt.getTime() - a.r.createdAt.getTime());
  const notifications = [
    ...events
      .filter(({ r }) => r.statut !== "ANNULEE")
      .slice(0, 6)
      .map(({ r, id }) => ({
        type: "RESERVATION",
        titre: `Nouvelle réservation ${r.reference}`,
        message: `${r.nombrePersonnes} personne(s) · ${titreCircuit(r.sessionIndex)}`,
        lienUrl: `/dashboard/reservations/${id}`,
        createdAt: r.createdAt,
      })),
    ...events
      .filter(({ r }) => r.paiements.some((p) => p.statut === "EN_ATTENTE"))
      .slice(0, 3)
      .map(({ r, id }) => ({
        type: "PAIEMENT",
        titre: `Paiement à valider · ${r.reference}`,
        message: `Virement ou espèces annoncés pour ${titreCircuit(r.sessionIndex)}.`,
        lienUrl: `/dashboard/reservations/${id}`,
        createdAt: new Date(r.createdAt.getTime() + 3_600_000),
      })),
  ];
  for (const utilisateurId of [admin.id, staff.id]) {
    await db.notification.createMany({
      data: notifications.map((n, index) => ({
        ...n,
        agenceId,
        utilisateurId,
        lue: index >= 4,
      })),
    });
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Le seed vide la base : il ne doit pas être lancé en production.");
  }

  await clearDatabase();
  const motDePasseHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const plans = await seedPlans();

  await db.utilisateur.create({
    data: {
      agenceId: null,
      prenom: "Fanomezantsoa",
      nom: "Rakotoarisoa",
      email: "superadmin@greentrek-saas.test",
      motDePasseHash,
      role: "SUPER_ADMIN",
    },
  });

  const now = new Date();
  for (const agence of AGENCES) await seedAgence(agence, plans, motDePasseHash, now);

  const [agences, utilisateurs, circuits, departs, reservations, paiements, avis, messages] =
    await Promise.all([
      db.agence.count(),
      db.utilisateur.count(),
      db.circuit.count(),
      db.sessionDepart.count(),
      db.reservation.count(),
      db.paiement.count(),
      db.avis.count(),
      db.message.count(),
    ]);
  console.log(
    `Seed terminé : ${agences} agences, ${utilisateurs} utilisateurs, ${circuits} circuits, ` +
      `${departs} départs, ${reservations} réservations, ${paiements} paiements, ${avis} avis, ${messages} messages.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
