package expo.modules.networkaddresses

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.Inet4Address
import java.net.NetworkInterface

/**
 * Adresses IPv4 du téléphone sur TOUTES ses interfaces actives : Wi-Fi (client) et point
 * d'accès quand le téléphone partage sa connexion (interfaces « ap0 », « swlan0 »,
 * « wlan1 »…), que les API Android ordinaires ne donnent pas. Sert à retrouver le site
 * Green Trek sur le même réseau (voir src/lib/discovery.ts). Aucune permission requise.
 */
class NetworkAddressesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NetworkAddresses")

    Function("getIPv4Addresses") {
      val result = mutableListOf<Map<String, String>>()
      try {
        val interfaces = NetworkInterface.getNetworkInterfaces()
        if (interfaces != null) {
          for (ni in interfaces) {
            if (!ni.isUp || ni.isLoopback) continue
            for (address in ni.inetAddresses) {
              val host = address.hostAddress
              if (address is Inet4Address && !address.isLoopbackAddress && host != null) {
                result.add(mapOf("interface" to ni.name, "address" to host))
              }
            }
          }
        }
      } catch (_: Exception) {
        // Interfaces illisibles : la recherche se contentera de l'adresse Wi-Fi.
      }
      result
    }
  }
}
