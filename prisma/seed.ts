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
 * Le graphe (étapes, tronçons) et les circuits sont ajoutés aux étapes E4 et E5.
 * Le script vide d'abord la base : il est destiné au développement uniquement.
 */
import "dotenv/config";

import bcrypt from "bcryptjs";

import type { Role } from "@/generated/prisma/client";
import { db } from "@/lib/db";

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

      if (role === "GUIDE") {
        await db.guide.create({
          data: {
            agenceId: agence.id,
            utilisateurId: utilisateur.id,
            nom: "Démo",
            prenom: "Guide",
            langues: ["fr", "mg"],
          },
        });
      }
    }

    // Abonnements simulés : Green Trek Mada en Pro actif, les agences fictives en essai.
    const estGreenTrek = agence.slug === "green-trek-mada";
    await db.abonnement.create({
      data: {
        agenceId: agence.id,
        planId: estGreenTrek ? pro.id : essai.id,
        dateDebut: aujourdhui,
        dateFin: estGreenTrek ? null : dans30Jours,
        statut: estGreenTrek ? "ACTIF" : "ESSAI",
      },
    });

    if (estGreenTrek) {
      // Partenaires réels cités dans la présentation de l'agence.
      // TODO(données terrain) : description, téléphone, e-mail, adresse, coordonnées GPS, tarifs.
      await db.partenaire.createMany({
        data: [
          { agenceId: agence.id, nom: "Vanilla Café", type: "RESTAURATION" },
          { agenceId: agence.id, nom: "La Pirogue Hôtel", type: "HEBERGEMENT" },
          { agenceId: agence.id, nom: "Surf Dah Mahambo", type: "ACTIVITE" },
          { agenceId: agence.id, nom: "Piroguiers Mahambo", type: "TRANSPORT" },
        ],
      });
    }
  }

  const [agences, utilisateurs, partenaires] = await Promise.all([
    db.agence.count(),
    db.utilisateur.count(),
    db.partenaire.count(),
  ]);
  console.log(
    `Seed terminé : ${agences} agences, ${utilisateurs} utilisateurs, ${partenaires} partenaires.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
