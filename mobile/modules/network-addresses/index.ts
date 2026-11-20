import { requireOptionalNativeModule } from "expo";

type NetworkAddressesNative = {
  getIPv4Addresses(): { interface: string; address: string }[];
};

/**
 * Module natif local (Android, APK) ; absent dans Expo Go, sur iPhone et dans le navigateur :
 * la liste est alors vide et la recherche utilise l'adresse Wi-Fi d'`expo-network`.
 */
const native = requireOptionalNativeModule<NetworkAddressesNative>("NetworkAddresses");

export function deviceIPv4Addresses(): string[] {
  try {
    return (native?.getIPv4Addresses() ?? []).map((a) => a.address);
  } catch {
    return [];
  }
}
