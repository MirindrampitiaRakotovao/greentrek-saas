"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authorize, journal, parseInput, toActionResult } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { cancelDepart, createDepart, deleteDepart, updateDepart } from "@/lib/services/departs";
import { idSchema } from "@/lib/validators/backoffice";
import { departSchema, updateDepartSchema } from "@/lib/validators/departs";

/*
 * Actions serveur des départs (étape E7) : session + client confiné + permission
 * (`authorize`) → Zod → service. Les pages circuits affichent aussi les départs.
 */

const DEPARTS_PATH = "/dashboard/departs";

function revalidateDeparts() {
  revalidatePath(DEPARTS_PATH, "layout");
  revalidatePath("/dashboard/circuits", "layout");
}

export async function createDepartAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("creer", "sessionDepart");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(departSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await createDepart(auth.db, auth.user.agenceId, parsed.data);
  if (!result.ok) return toActionResult(result);
  revalidateDeparts();
  redirect(`${DEPARTS_PATH}/${result.data.id}`);
}

export async function updateDepartAction(id: string, input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "sessionDepart");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(updateDepartSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await updateDepart(auth.db, id, parsed.data);
  if (result.ok) revalidateDeparts();
  return toActionResult(result, "Départ enregistré.");
}

export async function cancelDepartAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "sessionDepart");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await cancelDepart(auth.db, parsed.data.id);
  if (!result.ok) return toActionResult(result);
  await journal(auth, "DEPART_ANNULE", "SessionDepart", parsed.data.id, {
    reservationsAnnulees: result.data.reservationsAnnulees,
  });
  revalidateDeparts();
  const n = result.data.reservationsAnnulees;
  return {
    success:
      n === 0
        ? "Départ annulé."
        : `Départ annulé, ainsi que ${n} réservation${n > 1 ? "s" : ""} active${n > 1 ? "s" : ""}.`,
  };
}

export async function deleteDepartAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("supprimer", "sessionDepart");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await deleteDepart(auth.db, parsed.data.id);
  if (!result.ok) return toActionResult(result);
  revalidateDeparts();
  redirect(DEPARTS_PATH);
}
