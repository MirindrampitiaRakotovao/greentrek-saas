import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<"button"> & { variant?: "primary" | "secondary" };

/** Bouton arrondi. Le primaire utilise teal-700 (contraste ≈ 6,5:1 avec le blanc, §8.2). */
export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const styles =
    variant === "primary"
      ? "bg-gt-teal-700 text-white hover:bg-gt-teal-800"
      : "border border-gt-teal-700 text-gt-teal-700 hover:bg-gt-cream";
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-gt-teal-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
      {...props}
    />
  );
}
