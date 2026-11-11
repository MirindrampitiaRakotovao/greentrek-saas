import { createAudioPlayer } from "expo-audio";

/**
 * Son bref « message envoyé » (créé pour la plateforme, même fichier que le site :
 * `public/sons/envoi.wav`). Joué une fois le message enregistré par le serveur. Respecte le
 * mode silencieux du téléphone (réglage par défaut d'expo-audio).
 */
let player: ReturnType<typeof createAudioPlayer> | null = null;

export function playSentSound(): void {
  try {
    player ??= createAudioPlayer(require("../../assets/sounds/envoi.wav"));
    void player.seekTo(0).then(() => player?.play());
  } catch {
    // Audio indisponible : l'envoi reste confirmé par le statut affiché.
  }
}
