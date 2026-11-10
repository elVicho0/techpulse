import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "subtle" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    loading = false,
    leadingIcon,
    trailingIcon,
    className,
    children,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? "button"}
      className={cn("btn", `btn--${variant}`, `btn--${size}`, loading && "is-loading", className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <LoaderCircle size={15} className="spin" aria-hidden />
      ) : leadingIcon ? (
        <span className="btn__icon" aria-hidden>
          {leadingIcon}
        </span>
      ) : null}
      <span className="btn__label">{children}</span>
      {trailingIcon ? (
        <span className="btn__icon btn__icon--trailing" aria-hidden>
          {trailingIcon}
        </span>
      ) : null}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "ghost" | "accent";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", tone = "default", className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? "button"}
      className={cn("icon-button", `icon-button--${tone}`, `icon-button--${size}`, className)}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
});

export function Badge({
  children,
  tone = "slate",
  variant = "soft",
  className,
  title,
}: {
  children: ReactNode;
  tone?: "blue" | "violet" | "cyan" | "teal" | "amber" | "indigo" | "rose" | "slate" | "green";
  variant?: "soft" | "outline" | "solid";
  className?: string;
  title?: string;
}) {
  return (
    <span className={cn("badge", `badge--${tone}`, `badge--${variant}`, className)} title={title}>
      {children}
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("tag", className)}>{children}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
