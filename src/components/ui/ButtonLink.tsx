import Link from "next/link";
import type { ComponentProps } from "react";
import type { ButtonVariant } from "./Button";
import styles from "./Button.module.css";

export interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Exclude<ButtonVariant, "destructive">;
  size?: "md" | "sm";
}

/** Link de navegação com aparência de botão. Use Button para ações e ButtonLink para rotas. */
export function ButtonLink({ variant = "primary", size = "md", className, ...rest }: ButtonLinkProps) {
  const classes = [styles.button, styles[variant], size === "sm" ? styles.sm : "", className ?? ""].filter(Boolean).join(" ");
  return <Link className={classes} {...rest} />;
}
