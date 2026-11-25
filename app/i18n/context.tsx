"use client";

import { createContext, use, type ReactNode } from "react";
import { errorText, type Locale } from "@/lib/i18n/core";
import { MESSAGES, type Messages } from "./messages";

const LocaleContext = createContext<Locale>("en");

/** Each page (/ and /fr) wraps the app in this with its own language. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export type Texts = Messages & { error: (err: unknown) => string };

// Built once per language, so the object is stable across renders.
const TEXTS = Object.fromEntries(
  Object.entries(MESSAGES).map(([locale, messages]) => [
    locale,
    { ...messages, error: (err: unknown) => errorText(err, locale as Locale) },
  ]),
) as Record<Locale, Texts>;

/** The current page's texts, plus a helper that translates thrown errors. */
export function useMessages(): Texts {
  return TEXTS[use(LocaleContext)];
}
