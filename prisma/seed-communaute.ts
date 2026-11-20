import type { PrismaClient } from "@/generated/prisma/client";
import { readPhotos } from "@/lib/services/communaute";

import { COMMUNAUTE_PHOTOS } from "./communaute-photos";
import { createRandom } from "./demo-data";

/**
 * Publications de départ de la communauté (étape 5e, demande de l'étudiant) : des voyageurs
 * du seed (personnes inventées) partagent les photos d'un de leurs séjours TERMINÉS, avec
 * « J'aime » et commentaires d'autres voyageurs de toutes les agences.
 *
 * - Photos : photos libres de Wikimedia Commons de la région du circuit, créditées
 *   (src/lib/photo-credits-communaute.ts) ; jamais présentées comme une photo d'un lieu
 *   précis du circuit : le crédit affiche le vrai lieu.
 * - Légendes : impressions générales cohérentes avec le circuit (paysages, rythme), sans
 *   prix, ni nom de village, ni fait inventé.
 * - Rejouable : les publications de départ précédentes (photos `/images/communaute/`) sont
 *   supprimées et recréées ; les publications des vrais utilisateurs ne sont pas touchées.
 */

const PAR_CIRCUIT = 6;
const DAY = 24 * 60 * 60 * 1000;

const LEGENDES: Record<string, readonly string[]> = {
  "sentier-mahambo-doany-ambodiforaha": [
    "Le sentier passe d'un village à l'autre et la mer n'est jamais loin. On a pris notre temps, le guide aussi.",
    "Première randonnée à Madagascar et quel début : villages, littoral, et des sourires à chaque pause.",
    "La lumière de fin de journée sur la côte. On marche, on s'arrête, on regarde. Recommencer demain ?",
    "On s'attendait à de jolis paysages, pas à autant de rencontres. Merci à notre guide pour les explications.",
    "Petit conseil : chapeau et beaucoup d'eau. Le reste, le sentier s'en occupe.",
    "Nature, littoral et calme absolu. Un de mes plus beaux souvenirs de voyage.",
  ],
  "randonnee-cotiere-pirogue": [
    "Une journée à pied le long de la côte, puis le retour en pirogue. Le silence sur l'eau, je ne l'oublierai pas.",
    "La pirogue, c'était le moment préféré des enfants. Et le mien aussi, je l'avoue.",
    "Marcher le matin, glisser sur l'eau l'après-midi : le bon rythme pour découvrir la côte Est.",
    "On a croisé des pêcheurs, des pirogues partout, et ce bleu… Les photos ne rendent pas tout.",
    "Retour en pirogue au coucher du soleil, avec un piroguier qui connaissait chaque recoin.",
    "Facile et dépaysant. Parfait pour une première journée sur la côte.",
  ],
  "immersion-village": [
    "Trois jours au rythme d'un village. On repart avec une autre idée du temps.",
    "Partager les repas, apprendre quelques mots, écouter : la meilleure façon de voyager.",
    "Les gestes du quotidien, les cultures autour du village, les soirées calmes. Merci pour l'accueil.",
    "Pas un spectacle, une vraie rencontre. C'est ce que je cherchais.",
    "On a beaucoup appris et beaucoup ri. Les enfants du village nous ont fait visiter.",
    "Je recommande à tous ceux qui veulent comprendre le pays, pas seulement le regarder.",
  ],
  "decouverte-mahambo": [
    "Une première approche accessible à tous : idéal avec les parents.",
    "Une journée tranquille, de belles surprises : une tortue au détour d'un jardin !",
    "Plage, verdure et pause à l'ombre. Une journée découverte qui donne envie d'en voir plus.",
    "Parfait pour commencer le séjour en douceur avant les plus longues randonnées.",
    "Nous avons tout aimé, surtout les petits détails que le guide nous montrait en chemin.",
    "Facile, varié, et le temps de profiter. Que demander de plus ?",
  ],
  "traversee-hautes-terres": [
    "Cinq jours entre rizières en terrasses et villages : les paysages changent à chaque col.",
    "Les rizières à perte de vue, le vert partout. Les jambes ont travaillé mais ça valait le coup.",
    "Marcher dans les Hautes Terres, c'est traverser la vie des villages. Inoubliable.",
    "Le matin, la brume sur les rizières ; le soir, un ciel immense. On en redemande.",
    "Une vraie traversée, bien rythmée. Mention spéciale à l'organisation des étapes.",
    "Des terrasses de riz dessinées à la main, et des gens qui travaillent la terre avec patience.",
  ],
  "lacs-et-volcans": [
    "Arriver au bord du cratère et découvrir ce lac… Le souffle coupé.",
    "Deux lacs volcaniques dans la même journée, deux ambiances. Tritriva m'a marqué.",
    "Les falaises qui plongent dans l'eau verte, c'est encore plus beau en vrai.",
    "Une boucle facile, des paysages volcaniques et un pique-nique au bord de l'eau.",
    "On a fait le tour du lac tranquillement, en s'arrêtant toutes les cinq minutes pour une photo.",
    "Le Vakinankaratra, je ne connaissais pas. Je reviendrai.",
  ],
  "forets-et-rizieres": [
    "Une journée facile au sud d'Antsirabe, entre champs et rizières. Parfait en famille.",
    "On a vu repiquer le riz, et compris combien de travail il y a derrière chaque assiette.",
    "Des cultures partout, des couleurs partout. Une balade simple qui fait du bien.",
    "Le guide nous a expliqué les saisons du riz. Passionnant.",
    "Accessible, varié, et une belle façon de découvrir la campagne des Hautes Terres.",
    "Petite randonnée, grands paysages.",
  ],
  "grande-traversee-isalo": [
    "Quatre jours de canyons, de plateaux de grès et de bivouacs sous les étoiles.",
    "L'Isalo, c'est un autre monde : des roches sculptées, des couleurs qui changent toute la journée.",
    "Les nuits en bivouac, le silence total et un ciel incroyable. À faire au moins une fois.",
    "Une vraie expédition, exigeante mais tellement belle. Bien préparer ses chaussures !",
    "On a marché sur les plateaux pendant des heures sans croiser personne. Magique.",
    "Des formes de grès partout, on joue à leur trouver un nom. La « Fenêtre » reste ma préférée.",
  ],
  "canyons-piscines-isalo": [
    "Deux jours entre canyons ombragés et bassins d'eau claire. La baignade après la marche…",
    "Les piscines naturelles, une récompense bien méritée après les canyons.",
    "On a croisé des lémuriens dans les arbres du canyon ! Les enfants s'en souviendront longtemps.",
    "De l'ombre, de l'eau fraîche, des pandanus : l'Isalo a aussi un côté oasis.",
    "Le canyon des Singes et le canyon des Rats dans la même journée. Superbe.",
    "Une randonnée variée, parfaite pour découvrir l'Isalo sans faire la grande traversée.",
  ],
  "cretes-ranohira-ilakaka": [
    "Deux jours sur les crêtes de l'Isalo, avec la vue jusqu'à l'horizon.",
    "Les crêtes au coucher du soleil, c'est la meilleure lumière de tout le voyage.",
    "Une marche en hauteur, du vent, de l'espace. J'ai adoré.",
    "Le panorama depuis le massif valait chaque montée.",
    "On voit les plateaux de grès s'étendre à perte de vue. Grandiose.",
    "Bien organisé, bien guidé, et des paysages que je n'oublierai pas.",
  ],
};

const COMMENTAIRES = [
  "Magnifique !",
  "Ça donne envie de partir.",
  "Merci pour le partage, on y va au printemps.",
  "Quelle lumière sur ces photos.",
  "Superbe souvenir, merci.",
  "Je l'ai fait l'an dernier : toujours aussi beau.",
  "On vient de réserver grâce à vous !",
  "Les couleurs sont incroyables.",
  "Bravo pour les photos.",
  "Notre guide était génial aussi.",
  "Combien de temps de marche par jour ?",
  "C'est accessible avec des enfants ?",
  "Ça me rappelle de bons moments.",
  "Trop beau, j'en rêve.",
  "Merci pour les conseils !",
  "Vous êtes partis à quelle saison ?",
  "Le prochain sur ma liste.",
  "Splendide, vraiment.",
];

type Sejour = { id: string; clientId: string; dateFin: Date; circuitSlug: string };

/** Supprime les publications de départ précédentes (photos livrées avec le projet). */
async function clearSeededPosts(db: PrismaClient): Promise<number> {
  const all = await db.publication.findMany({ select: { id: true, photos: true } });
  const ids = all
    .filter((p) => readPhotos(p.photos).some((src) => src.startsWith("/images/communaute/")))
    .map((p) => p.id);
  if (!ids.length) return 0;
  const commentaires = await db.commentaire.findMany({
    where: { publicationId: { in: ids } },
    select: { id: true },
  });
  await db.$transaction([
    db.signalementCommunaute.deleteMany({
      where: {
        OR: [
          { cible: "PUBLICATION", cibleId: { in: ids } },
          { cible: "COMMENTAIRE", cibleId: { in: commentaires.map((c) => c.id) } },
        ],
      },
    }),
    db.publication.deleteMany({ where: { id: { in: ids } } }),
  ]);
  return ids.length;
}

function shuffle<T>(items: readonly T[], next: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export async function seedCommunaute(db: PrismaClient, now: Date = new Date()) {
  const rng = createRandom(2026_11_20);
  const supprimees = await clearSeededPosts(db);

  // Séjours terminés des voyageurs (hors comptes de connexion de démonstration en `.test`,
  // pour que leur fil « Mes publications » reste le leur).
  const reservations = await db.reservation.findMany({
    where: {
      statut: "TERMINEE",
      client: { role: "CLIENT", actif: true, email: { not: { endsWith: ".test" } } },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      clientId: true,
      session: { select: { dateFin: true, circuit: { select: { slug: true } } } },
    },
  });
  const sejours: Sejour[] = reservations.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    dateFin: r.session.dateFin,
    circuitSlug: r.session.circuit.slug,
  }));
  const voyageurs = (
    await db.utilisateur.findMany({
      where: { role: "CLIENT", actif: true },
      orderBy: { id: "asc" },
      select: { id: true },
    })
  ).map((u) => u.id);

  let publications = 0;
  let jaimes = 0;
  let commentaires = 0;
  for (const [slug, legendes] of Object.entries(LEGENDES)) {
    const candidats = shuffle(
      sejours.filter((s) => s.circuitSlug === slug),
      rng.next,
    );
    const pool = COMMUNAUTE_PHOTOS.filter((p) => p.circuits.includes(slug)).map((p) => p.photo);
    if (!candidats.length || !pool.length) continue;

    for (let k = 0; k < PAR_CIRCUIT; k++) {
      const sejour = candidats[k % candidats.length]!;
      // Nombre de photos : souvent 1 à 3, parfois davantage (mosaïque « +N »).
      const tirage = rng.next();
      const voulu =
        tirage < 0.2
          ? 1
          : tirage < 0.45
            ? 2
            : tirage < 0.7
              ? 3
              : tirage < 0.85
                ? rng.int(4, 5)
                : rng.int(6, 8);
      const photos = shuffle(pool, rng.next).slice(0, Math.min(voulu, pool.length));
      // Publiée après le séjour, jamais dans le futur.
      const debut = Math.min(sejour.dateFin.getTime() + DAY, now.getTime() - 2 * 60 * 60 * 1000);
      const createdAt = new Date(debut + rng.next() * Math.max(0, now.getTime() - debut - DAY));
      const post = await db.publication.create({
        data: {
          auteurId: sejour.clientId,
          reservationId: sejour.id,
          legende: rng.next() < 0.1 ? null : legendes[k % legendes.length]!,
          photos,
          createdAt,
        },
        select: { id: true },
      });
      publications++;

      const autres = shuffle(
        voyageurs.filter((v) => v !== sejour.clientId),
        rng.next,
      );
      const after = () =>
        new Date(
          createdAt.getTime() +
            rng.next() * Math.max(DAY, now.getTime() - createdAt.getTime()) * 0.9,
        );
      const likers = autres.slice(0, rng.int(0, 28));
      if (likers.length) {
        await db.jaime.createMany({
          data: likers.map((utilisateurId) => ({
            publicationId: post.id,
            utilisateurId,
            createdAt: new Date(Math.min(after().getTime(), now.getTime())),
          })),
        });
        jaimes += likers.length;
      }
      const nb = rng.next() < 0.3 ? 0 : rng.int(1, 4);
      const dates = Array.from({ length: nb }, () =>
        Math.min(after().getTime(), now.getTime()),
      ).sort((a, b) => a - b);
      for (const [i, t] of dates.entries()) {
        await db.commentaire.create({
          data: {
            publicationId: post.id,
            auteurId: autres[(likers.length + i) % autres.length]!,
            contenu: rng.pick(COMMENTAIRES),
            createdAt: new Date(t),
          },
        });
        commentaires++;
      }
    }
  }
  return { supprimees, publications, jaimes, commentaires };
}
