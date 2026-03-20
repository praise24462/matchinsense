import React from "react";
import styles from "./Button.module.scss";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

export default function Button({
  children, variant = "primary", size = "md",
  loading = false, icon, iconRight, fullWidth = false,
  className = "", disabled, ...props
}: ButtonProps) {
  return (
    <button
      className={[
        styles.btn, styles[variant], styles[size],
        fullWidth ? styles.fullWidth : "",
        loading ? styles.isLoading : "",
        className,
      ].filter(Boolean).join(" ")}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : icon ? (
        <span className={styles.iconLeft} aria-hidden="true">{icon}</span>
      ) : null}
      <span>{children}</span>
      {iconRight && !loading && (
        <span className={styles.iconRight} aria-hidden="true">{iconRight}</span>
      )}
    </button>
  );
}