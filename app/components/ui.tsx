"use client";

import { useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

// Plain bordered buttons: no fill and no hover effect, only a tint while pressed.
const VARIANTS: Record<Variant, string> = {
  primary: "border-ink text-ink active:bg-paper-3",
  secondary: "border-rule text-ink active:bg-paper-3",
  ghost: "border-rule text-muted active:bg-paper-3",
  danger: "border-accent text-accent active:bg-accent-soft",
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-sm border bg-transparent px-3 py-1.5 text-sm ${FOCUS} disabled:cursor-not-allowed disabled:border-rule disabled:text-muted disabled:opacity-60 disabled:active:bg-transparent ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

/** Headings of panels: small caps, like section labels in a notebook. */
const HEADING = "text-sm font-semibold tracking-wide text-ink [font-variant-caps:all-small-caps]";

export function Panel({
  title,
  children,
  actions,
  className = "",
}: {
  title?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-sm bg-paper-2 p-4 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className={HEADING}>{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** A Panel whose body can be folded away by clicking its title. Starts closed. */
export function FoldablePanel({
  title,
  children,
  defaultOpen = false,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group rounded-sm bg-paper-2">
      <summary
        className={`flex cursor-pointer list-none items-center justify-between gap-2 p-4 select-none ${HEADING} ${FOCUS} [&::-webkit-details-marker]:hidden`}
      >
        {title}
        <span
          aria-hidden="true"
          className="text-base leading-none text-muted [font-variant-caps:normal]"
        >
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:inline">-</span>
        </span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="text-sm tabular-nums text-muted">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--ink)]"
      />
    </label>
  );
}

/** A button that opens a file picker and hands back the chosen file's text. */
export function FileButton({
  accept,
  onText,
  children,
  variant = "secondary",
  disabled,
}: {
  accept: string;
  onText: (text: string, name: string) => void;
  children: ReactNode;
  variant?: Variant;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant={variant} disabled={disabled} onClick={() => input.current?.click()}>
        {children}
      </Button>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onText(await file.text(), file.name);
        }}
      />
    </>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg tabular-nums">{value}</div>
    </div>
  );
}

/** A figure caption under a board, in italics: "fig. 1  untrained snake ... size 3". */
export function Caption({ label, children, aside }: { label: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <p className="mt-2 flex items-baseline justify-between gap-3 text-[13px] italic text-muted">
      <span>
        <span className="not-italic text-ink">{label}</span>&ensp;{children}
      </span>
      {aside && <span className="shrink-0 tabular-nums">{aside}</span>}
    </p>
  );
}

/** A short status or error line. */
export function Notice({ kind, children }: { kind: "info" | "error"; children: ReactNode }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-sm px-3 py-2 text-sm ${
        kind === "error" ? "bg-accent-soft text-accent" : "bg-paper-2"
      }`}
    >
      {children}
    </p>
  );
}

export const selectClass =
  "rounded-sm border border-rule bg-paper px-2 py-1.5 text-sm text-ink";

export const inputClass =
  "w-full rounded-sm border border-rule bg-paper px-2 py-1.5 text-sm text-ink tabular-nums";
