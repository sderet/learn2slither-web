"use client";

import { useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

// Plain bordered buttons: no fill and no hover effect, only a tint while pressed.
const VARIANTS: Record<Variant, string> = {
  primary:
    "border-zinc-900 text-zinc-900 active:bg-zinc-200 dark:border-zinc-100 dark:text-zinc-100 dark:active:bg-zinc-800",
  secondary:
    "border-zinc-300 text-zinc-800 active:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-200 dark:active:bg-zinc-800",
  ghost:
    "border-zinc-300 text-zinc-600 active:bg-zinc-200 dark:border-zinc-700 dark:text-zinc-400 dark:active:bg-zinc-800",
  danger:
    "border-rose-600 text-rose-700 active:bg-rose-100 dark:border-rose-400 dark:text-rose-300 dark:active:bg-rose-950",
};

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded border bg-transparent px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400 disabled:active:bg-transparent dark:disabled:border-zinc-800 dark:disabled:text-zinc-600 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

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
    <section
      className={`rounded-md bg-zinc-100 p-4 dark:bg-zinc-900 ${className}`}
    >
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && (
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {title}
            </h2>
          )}
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
    <details open={defaultOpen} className="group rounded-md bg-zinc-100 dark:bg-zinc-900">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-semibold text-zinc-800 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 dark:text-zinc-200 [&::-webkit-details-marker]:hidden">
        {title}
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="size-4 text-zinc-500 transition-transform group-open:rotate-180 dark:text-zinc-400"
        >
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
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
        <span className="text-zinc-700 dark:text-zinc-300">{label}</span>
        <span className="font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
          {value.toFixed(2)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-zinc-700 dark:accent-zinc-300"
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
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="font-mono text-lg tabular-nums text-zinc-900 dark:text-zinc-100">{value}</div>
    </div>
  );
}

export const selectClass =
  "rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export const inputClass =
  "w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 tabular-nums dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
