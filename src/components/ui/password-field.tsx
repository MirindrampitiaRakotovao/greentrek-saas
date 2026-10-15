"use client";

import { type ComponentProps, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { TextField } from "@/components/ui/text-field";

type PasswordFieldProps = Omit<ComponentProps<typeof TextField>, "type" | "trailing">;

/**
 * Champ mot de passe avec un bouton « œil » pour afficher ou masquer la saisie. Bouton
 * accessible : utilisable au clavier, état annoncé (`aria-pressed`) et libellé explicite.
 */
export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={props.id ?? props.name}
          title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="grid size-10 place-items-center rounded-full text-gt-teal-900/75 hover:bg-gt-teal-50 hover:text-gt-teal-900"
        >
          <Icon name={visible ? "eyeOff" : "eye"} className="size-5" />
          <span className="sr-only">Afficher le mot de passe</span>
        </button>
      }
    />
  );
}
