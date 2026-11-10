import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { Check, Search, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  ariaLabel,
  className,
}: {
  options: Array<{ value: T; label: string; icon?: LucideIcon; title?: string }>;
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={cn("segmented", `segmented--${size}`, className)} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={cn("segmented__item", active && "is-active")}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            title={option.title}
          >
            {Icon ? <Icon size={13} aria-hidden /> : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn("toggle-row", disabled && "is-disabled")}>
      <div className="toggle-row__copy">
        <label htmlFor={id}>{label}</label>
        {description ? <p>{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === "string" ? label : undefined}
        className={cn("toggle", checked && "is-on")}
        onClick={() => onChange(!checked)}
        disabled={disabled}
      >
        <span className="toggle__thumb" aria-hidden />
      </button>
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = "Buscar…",
  ariaLabel = "Buscar",
  className,
  autoFocus,
  onKeyDown,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: InputHTMLAttributes<HTMLInputElement>["onKeyDown"];
}) {
  return (
    <div className={cn("search-field", className)}>
      <Search size={15} className="search-field__icon" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        spellCheck={false}
      />
      {value ? (
        <button
          type="button"
          className="search-field__clear"
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
        >
          <X size={13} />
        </button>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  children,
  className,
  ariaLabel,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <label className={cn("select-field", className)}>
      {label ? <span className="select-field__label">{label}</span> : null}
      <span className="select-field__control">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={ariaLabel ?? label}
          {...props}
        >
          {children}
        </select>
      </span>
    </label>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
  count,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      className={cn("filter-chip", active && "is-active")}
      aria-pressed={active}
      onClick={onClick}
    >
      {Icon ? <Icon size={13} aria-hidden /> : null}
      <span>{children}</span>
      {count !== undefined ? <span className="filter-chip__count tabular">{count}</span> : null}
      {active ? <Check size={12} className="filter-chip__check" aria-hidden /> : null}
    </button>
  );
}

export function NumberField({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  disabled,
}: {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="number-field">
      <div className="number-field__copy">
        <label htmlFor={id}>{label}</label>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="number-field__control">
        <input
          id={id}
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix ? <span>{suffix}</span> : null}
      </div>
    </div>
  );
}
