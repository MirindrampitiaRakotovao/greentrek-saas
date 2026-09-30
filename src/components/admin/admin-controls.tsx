"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { useConfirm, useNotify } from "@/components/ui/dialogs";
import { FormAlert } from "@/components/ui/form-alert";
import { useCloseOnSuccess } from "@/components/ui/form-modal";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { TextField } from "@/components/ui/text-field";
import {
  assignPlanAction,
  createPlanAction,
  setAgenceStatutAction,
  setPlanActifAction,
  updatePlanAction,
} from "@/lib/actions/plateforme";
import type { ActionResult } from "@/lib/actions/types";
import { applyFieldErrors } from "@/lib/forms";
import {
  assignPlanSchema,
  DUREE_LABELS,
  DUREES_ABONNEMENT,
  planSchema,
} from "@/lib/validators/plateforme";

/* Composants client de la console super admin (§7.4, étape E11). */

/** Exécute une action après confirmation et affiche le résultat en notification. */
function useConfirmedAction() {
  const confirm = useConfirm();
  const notify = useNotify();
  const [pending, startTransition] = useTransition();
  async function run(options: Parameters<typeof confirm>[0], action: () => Promise<ActionResult>) {
    if (!(await confirm(options))) return;
    startTransition(async () => {
      const result = await action();
      notify(result.error ?? result.success ?? "", result.error ? "error" : "success");
    });
  }
  return { run, pending };
}

/** Suspension ou réactivation d'une agence (RG 19), après confirmation. */
export function AgenceStatutButton({
  id,
  nom,
  statut,
}: {
  id: string;
  nom: string;
  statut: "ACTIVE" | "SUSPENDUE";
}) {
  const { run, pending } = useConfirmedAction();
  const suspendre = statut === "ACTIVE";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        run(
          suspendre
            ? {
                title: `Suspendre ${nom} ?`,
                message:
                  "Son équipe et ses clients perdent l'accès immédiatement et son site vitrine n'est plus visible. Aucune donnée n'est supprimée : vous pourrez la réactiver.",
                confirmLabel: "Suspendre l'agence",
                cancelLabel: "Retour",
                tone: "danger",
              }
            : {
                title: `Réactiver ${nom} ?`,
                message: "Son équipe, ses clients et son site vitrine retrouvent l'accès.",
                confirmLabel: "Réactiver",
                cancelLabel: "Retour",
              },
          () => setAgenceStatutAction({ id, statut: suspendre ? "SUSPENDUE" : "ACTIVE" }),
        )
      }
      className={`rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-60 ${
        suspendre
          ? "border border-red-700 text-red-700 hover:bg-red-50"
          : "bg-gt-teal-700 text-white hover:bg-gt-teal-800"
      }`}
    >
      {pending ? "…" : suspendre ? "Suspendre l'agence" : "Réactiver l'agence"}
    </button>
  );
}

/** Activation ou désactivation d'un plan (décision E : jamais de suppression). */
export function PlanActifButton({ id, nom, actif }: { id: string; nom: string; actif: boolean }) {
  const { run, pending } = useConfirmedAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        run(
          {
            title: actif ? `Désactiver le plan ${nom} ?` : `Réactiver le plan ${nom} ?`,
            message: actif
              ? "Il ne sera plus proposé sur la page Tarifs ni attribuable. Les abonnements en cours ne changent pas."
              : "Il sera de nouveau proposé sur la page Tarifs et attribuable.",
            confirmLabel: actif ? "Désactiver" : "Réactiver",
            cancelLabel: "Retour",
            tone: actif ? "danger" : "default",
          },
          () => setPlanActifAction({ id, actif: !actif }),
        )
      }
      className="rounded-full px-3 py-1.5 text-sm font-medium text-gt-teal-700 hover:bg-gt-teal-50 disabled:opacity-60"
    >
      {actif ? "Désactiver" : "Réactiver"}
    </button>
  );
}

/** Attribution d'un plan à une agence : l'abonnement en cours est clôturé. */
export function AssignPlanForm({
  agenceId,
  plans,
}: {
  agenceId: string;
  plans: readonly { id: string; nom: string; prix: string }[];
}) {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const closeOnSuccess = useCloseOnSuccess();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(assignPlanSchema),
    defaultValues: {
      agenceId,
      planId: plans[0]?.id ?? "",
      duree: "12" as const,
      statut: "ACTIF" as const,
    },
  });
  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = await assignPlanAction(values);
      if (closeOnSuccess(result)) return;
      setServerError(result.error);
      applyFieldErrors(result.fieldErrors, setError, ["planId", "duree", "statut"] as const);
    });
  });
  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={serverError} />
      <SelectField
        label="Plan"
        options={plans.map((p) => ({ value: p.id, label: `${p.nom} · ${p.prix}` }))}
        error={errors.planId?.message}
        {...register("planId")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Durée"
          options={DUREES_ABONNEMENT.map((d) => ({ value: d, label: DUREE_LABELS[d] }))}
          error={errors.duree?.message}
          {...register("duree")}
        />
        <SelectField
          label="Statut"
          options={[
            { value: "ACTIF", label: "Actif (payé, simulation)" },
            { value: "ESSAI", label: "Essai" },
          ]}
          error={errors.statut?.message}
          {...register("statut")}
        />
      </div>
      <p className="text-xs text-gt-teal-900/60">
        L&apos;abonnement en cours est clôturé aujourd&apos;hui ; le nouveau commence
        aujourd&apos;hui. Abonnements simulés : aucune facturation réelle.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Attribution…" : "Attribuer le plan"}
      </Button>
    </form>
  );
}

type PlanValues = {
  id: string;
  code: string;
  nom: string;
  prixMensuel: number;
  maxCircuits: number;
  maxUtilisateurs: number;
  maxSessionsActives: number;
  fonctionnalites: string[];
};

/** Création (sans `plan`) ou modification d'un plan fictif. */
export function PlanForm({ plan, devise }: { plan?: PlanValues; devise: string }) {
  const [serverError, setServerError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const closeOnSuccess = useCloseOnSuccess();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(planSchema),
    defaultValues: {
      code: plan?.code ?? "",
      nom: plan?.nom ?? "",
      prixMensuel: plan?.prixMensuel.toString() ?? "0",
      maxCircuits: plan?.maxCircuits.toString() ?? "10",
      maxUtilisateurs: plan?.maxUtilisateurs.toString() ?? "5",
      maxSessionsActives: plan?.maxSessionsActives.toString() ?? "20",
      fonctionnalites: plan?.fonctionnalites.join("\n") ?? "",
    },
  });
  const onSubmit = handleSubmit((values) => {
    setServerError(undefined);
    startTransition(async () => {
      const result = plan
        ? await updatePlanAction(plan.id, values)
        : await createPlanAction(values);
      if (closeOnSuccess(result)) return;
      setServerError(result.error);
      applyFieldErrors(result.fieldErrors, setError, [
        "code",
        "nom",
        "prixMensuel",
        "maxCircuits",
        "maxUtilisateurs",
        "maxSessionsActives",
        "fonctionnalites",
      ] as const);
    });
  });
  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={serverError} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Code"
          hint="Identifiant technique, ex. PRO."
          error={errors.code?.message}
          {...register("code")}
        />
        <TextField label="Nom affiché" error={errors.nom?.message} {...register("nom")} />
        <TextField
          label={`Prix mensuel (${devise}, fictif)`}
          inputMode="numeric"
          error={errors.prixMensuel?.message}
          {...register("prixMensuel")}
        />
        <TextField
          label="Circuits (maximum)"
          inputMode="numeric"
          error={errors.maxCircuits?.message}
          {...register("maxCircuits")}
        />
        <TextField
          label="Comptes du personnel (maximum)"
          inputMode="numeric"
          error={errors.maxUtilisateurs?.message}
          {...register("maxUtilisateurs")}
        />
        <TextField
          label="Départs actifs (maximum)"
          inputMode="numeric"
          error={errors.maxSessionsActives?.message}
          {...register("maxSessionsActives")}
        />
      </div>
      <TextareaField
        label="Fonctionnalités mises en avant (une par ligne)"
        rows={5}
        error={errors.fonctionnalites?.message}
        {...register("fonctionnalites")}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : plan ? "Enregistrer" : "Créer le plan"}
      </Button>
    </form>
  );
}
