import Link from "next/link";
import { LOCALES, type Locale } from "@/lib/i18n/core";
import { LocaleProvider } from "../i18n/context";
import { MESSAGES } from "../i18n/messages";
import Lab from "./Lab";

export default function Home({ locale }: { locale: Locale }) {
  const t = MESSAGES[locale];
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-5 sm:px-6">
      <header className="flex items-start justify-between gap-4 border-b border-rule pb-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Learn2Slither</h1>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed">{t.page.intro}</p>
        </div>
        {/* en · fr: the current language in bold, the other one a link */}
        <nav className="shrink-0 text-sm text-muted">
          {LOCALES.map((code, i) => (
            <span key={code}>
              {i > 0 && " · "}
              {code === locale ? (
                <strong className="font-medium text-ink">{code}</strong>
              ) : (
                <Link
                  href={t.page.otherLanguage.href}
                  hrefLang={code}
                  lang={code}
                  title={t.page.otherLanguage.title}
                  className="underline decoration-rule underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:text-ink"
                >
                  {code}
                </Link>
              )}
            </span>
          ))}
        </nav>
      </header>
      <LocaleProvider locale={locale}>
        <Lab />
      </LocaleProvider>
    </main>
  );
}
