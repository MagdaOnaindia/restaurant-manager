import Link from "next/link";
import {
  Armchair,
  CalendarDays,
  ChefHat,
  CreditCard,
  Globe,
  NotebookText,
  QrCode,
  Split,
  Users,
  Wallet,
} from "lucide-react";
import { Logo, Logomark } from "@/components/logo";
import { HeroIllustration } from "@/components/hero-illustration";

const FEATURES = [
  {
    icon: QrCode,
    title: "Cobro dividido por QR",
    text: "Tus clientes escanean el QR de la mesa y cada uno paga lo suyo desde su móvil: por platos, a partes iguales o el importe que elijan.",
  },
  {
    icon: NotebookText,
    title: "Cartas por temporada",
    text: "Carta de verano, menú del día de lunes a viernes, degustaciones… con vigencias automáticas, fotos y alérgenos UE.",
  },
  {
    icon: CalendarDays,
    title: "Reservas online",
    text: "Turnos con aforo por franja, confirmaciones por email y un widget de reservas en tu página pública.",
  },
  {
    icon: ChefHat,
    title: "Comandero táctil",
    text: "Plano de sala por zonas, cuentas por mesa y pagos visibles en tiempo real. Pensado para usarse con una mano.",
  },
  {
    icon: Users,
    title: "Tu equipo, con roles",
    text: "Invita a tu personal por email con permisos por rol: propietario, administración, encargados y sala.",
  },
  {
    icon: Globe,
    title: "Tu página pública",
    text: "Cada restaurante tiene su página con la carta vigente y reservas. Cadenas con varios locales, sin coste extra.",
  },
];

const STEPS = [
  {
    icon: QrCode,
    title: "Escanean el QR",
    text: "Cada mesa tiene su código impreso. Sin apps que instalar y sin registros.",
  },
  {
    icon: Split,
    title: "Dividen la cuenta",
    text: "Todo, a partes iguales, solo sus platos o un importe libre. Nadie paga lo mismo dos veces.",
  },
  {
    icon: Wallet,
    title: "Pagan y listo",
    text: "Tarjeta, Apple Pay, Google Pay o Bizum. El dinero va directo a tu cuenta y tú lo ves al instante.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Navegación */}
      <header className="sticky top-0 z-40 border-b border-neutral-200/60 bg-cream/85 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" aria-label="Inicio">
            <Logo />
          </Link>
          <div className="hidden items-center gap-6 text-sm text-neutral-600 sm:flex">
            <a href="#funcionalidades" className="transition hover:text-neutral-900">
              Funcionalidades
            </a>
            <a href="#como-funciona" className="transition hover:text-neutral-900">
              Cómo funciona
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              Crear cuenta
            </Link>
          </div>
        </nav>
      </header>

      {/* Portada */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800">
            <QrCode className="h-4 w-4" /> La cuenta, dividida en segundos
          </p>
          <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-5xl lg:text-[3.4rem]">
            Tu restaurante, organizado.
            <br />
            <span className="text-brand-600">La cuenta, sin líos.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-neutral-600">
            La plataforma para restaurantes y cadenas: mesas, cartas, reservas y equipo en un solo
            sitio — y el cobro dividido por QR que ahorra a tu sala ir cobrando uno a uno.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/register"
              className="rounded-xl bg-brand-600 px-6 py-3.5 font-semibold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700"
            >
              Empieza gratis
            </Link>
            <a
              href="#como-funciona"
              className="rounded-xl border border-neutral-300 bg-white px-6 py-3.5 font-semibold text-neutral-800 transition hover:border-brand-300 hover:bg-brand-50"
            >
              Ver cómo funciona
            </a>
          </div>
          <p className="mt-4 text-sm text-neutral-500">
            Sin tarjeta para empezar · Configuración en minutos · En español
          </p>
        </div>
        <HeroIllustration className="mx-auto w-full max-w-lg" />
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="border-y border-neutral-200/70 bg-white py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-neutral-900">
            Todo lo que tu sala necesita
          </h2>
          <p className="mt-2 max-w-2xl text-neutral-600">
            De la carta a la reserva y del comandero al cobro: un único sistema para el día a día.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <article
                key={title}
                className="rounded-2xl border border-neutral-200 bg-cream/60 p-6 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="font-semibold text-neutral-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona el cobro */}
      <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-neutral-900">
          Así paga un grupo en tu restaurante
        </h2>
        <p className="mt-2 max-w-2xl text-neutral-600">
          Menos de un minuto por comensal. Tu equipo solo ve cómo la mesa se pone en verde.
        </p>
        <ol className="mt-10 grid gap-5 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="relative rounded-2xl border border-neutral-200 bg-white p-6">
              <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-bold text-white">
                {i + 1}
              </span>
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="font-semibold text-neutral-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-5 text-sm text-brand-900">
          <CreditCard className="h-5 w-5 shrink-0 text-brand-700" aria-hidden />
          <p>
            Pagos con <strong>Stripe</strong>: tarjeta, Apple Pay, Google Pay y <strong>Bizum</strong>.
            El dinero llega directo a la cuenta de tu negocio, con propinas incluidas.
          </p>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-gradient-to-br from-brand-700 to-brand-900 py-16 text-center text-white">
        <div className="mx-auto max-w-2xl px-4">
          <Logomark className="mx-auto h-12 w-12" />
          <h2 className="mt-5 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            Abre tu cuenta y monta tu primer restaurante hoy
          </h2>
          <p className="mt-3 text-brand-100">
            Registro con email, tu organización, tus mesas con QR y tu carta publicada en una tarde.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-block rounded-xl bg-white px-8 py-3.5 font-semibold text-brand-800 shadow-lg transition hover:bg-brand-50"
          >
            Crear cuenta gratis
          </Link>
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-neutral-500">
          <Logo markClassName="h-6 w-6" />
          <p>Hecho para la hostelería · {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
