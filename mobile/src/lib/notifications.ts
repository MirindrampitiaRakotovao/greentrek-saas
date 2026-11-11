import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";

/**
 * Notifications du téléphone (lot A4c), en deux niveaux :
 * 1. notification LOCALE : l'application ouverte interroge le site toutes les 20 secondes et
 *    affiche chaque nouveauté avec le son du téléphone (fonctionne dans Expo Go) ;
 * 2. notification PUSH : le site prévient le service d'Expo, qui fait sonner le téléphone même
 *    application fermée. Exige l'application installée (APK) et un projet EAS (`projectId`) :
 *    Expo Go ne reçoit plus les push sur Android depuis le SDK 53.
 */

/** Canal Android (même identifiant que le serveur) : importance maximale, son et bandeau. */
export const ANDROID_CHANNEL = "alertes";

export type NotificationTarget =
  | { type: "reservation"; reservationId: string }
  | { type: "message"; conversationId: string }
  | { type: "notifications" };

const supported = Platform.OS !== "web";

if (supported) {
  // Application au premier plan : la notification s'affiche et sonne quand même.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Canal Android, puis autorisation (demandée une fois). `false` : refusée ou indisponible. */
export async function enableNotifications(): Promise<boolean> {
  if (!supported) return false;
  try {
    if (Platform.OS === "android") {
      // Le canal doit exister AVANT la demande d'autorisation et du jeton (Android 13+).
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: "Réservations et messages",
        importance: AndroidImportance.MAX,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#0F6775",
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Jeton push Expo du téléphone, ou `null` quand le niveau 2 n'est pas disponible : aperçu
 * web, simulateur, Expo Go, ou projet EAS pas encore créé (avant la fabrication de l'APK).
 */
export async function pushToken(): Promise<string | null> {
  if (!supported || !Device.isDevice) return null;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  const projectId = extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
}

/** Affiche tout de suite une notification du téléphone, avec le son (niveau 1). */
export async function ring(title: string, body: string, target: NotificationTarget): Promise<void> {
  if (!supported) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: target, sound: "default" },
      trigger: Platform.OS === "android" ? { channelId: ANDROID_CHANNEL } : null,
    });
  } catch {
    // Autorisation retirée entre-temps : la nouveauté reste visible dans l'application.
  }
}

/* Jeton enregistré auprès du site : retiré à la déconnexion (`src/context/auth.tsx`). */
let registered: string | null = null;
export function setRegisteredPushToken(token: string | null) {
  registered = token;
}
export function registeredPushToken(): string | null {
  return registered;
}

/** Destination d'une notification touchée (données envoyées par le site ou par `ring`). */
export function targetOf(data: unknown): NotificationTarget | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.type === "reservation" && typeof d.reservationId === "string") {
    return { type: "reservation", reservationId: d.reservationId };
  }
  if (d.type === "message" && typeof d.conversationId === "string") {
    return { type: "message", conversationId: d.conversationId };
  }
  if (d.type === "notifications") return { type: "notifications" };
  return null;
}
