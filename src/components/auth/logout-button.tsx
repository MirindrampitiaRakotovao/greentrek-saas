import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/actions/auth";

/** Déconnexion par formulaire (action serveur) : fonctionne même sans JavaScript. */
export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="secondary">
        Se déconnecter
      </Button>
    </form>
  );
}
