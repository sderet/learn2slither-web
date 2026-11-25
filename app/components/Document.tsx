import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n/core";
import { MESSAGES } from "../i18n/messages";
import "../globals.css";

export function documentMetadata(locale: Locale): Metadata {
  return {
    title: "Learn2Slither",
    description: MESSAGES[locale].meta.description,
  };
}

/**
 * The <html> shell shared by the English (/) and French (/fr) root layouts.
 * Each language has its own root layout so the static HTML carries the right `lang`.
 */
export default function Document({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <html lang={locale} className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
