import { useTranslations } from "next-intl";
import Link from "next/link";

export default function LandingPage() {
  const t = useTranslations("landing");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="rounded-full bg-brand-100 px-4 py-1 text-sm font-medium text-brand-800">
        {t("title")}
      </span>
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
        {t("tagline")}
      </h1>
      <p className="max-w-xl text-lg text-neutral-600">{t("description")}</p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-lg border border-neutral-300 bg-white px-5 py-2.5 font-medium text-neutral-800 transition hover:bg-neutral-100"
        >
          {t("login")}
        </Link>
        <Link
          href="/register"
          className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition hover:bg-brand-700"
        >
          {t("register")}
        </Link>
      </div>
    </main>
  );
}
