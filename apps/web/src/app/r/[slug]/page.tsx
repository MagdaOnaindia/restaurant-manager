import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ALLERGEN_LABELS_ES,
  formatCents,
  type Allergen,
  type MenuDetail,
} from "@rms/shared";
import { ReservationWidget } from "./reservation-widget";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface PublicData {
  restaurant: {
    name: string;
    slug: string;
    description: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    currency: string;
  };
  menus: MenuDetail[];
}

async function getData(slug: string): Promise<PublicData | null> {
  const res = await fetch(`${API_URL}/public/restaurants/${slug}/menus`, {
    // La carta vigente puede cambiar con la hora: no cachear en exceso
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return (await res.json()) as PublicData;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) return { title: "Restaurante no encontrado" };
  const { restaurant } = data;
  return {
    title: `${restaurant.name}${restaurant.city ? ` · ${restaurant.city}` : ""}`,
    description:
      restaurant.description ?? `Carta y reservas de ${restaurant.name}. Reserva tu mesa online.`,
    openGraph: {
      title: restaurant.name,
      description: restaurant.description ?? undefined,
      type: "website",
    },
  };
}

/** Ornamento tipográfico: plato del logomark en línea, para separar secciones. */
function PlateOrnament({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35" />
      <path d="M24 24 L35 24 A11 11 0 0 1 24 35 Z" fill="currentColor" transform="translate(1 1)" />
      <path d="M24 24 L24 35 A11 11 0 0 1 13 24 Z" fill="currentColor" transform="translate(-1 1)" />
      <path d="M24 24 L13 24 A11 11 0 0 1 24 13 Z" fill="currentColor" transform="translate(-1 -1)" />
      <path d="M24 24 L24 13 A11 11 0 0 1 35 24 Z" fill="currentColor" opacity="0.45" transform="translate(2.5 -2.5)" />
    </svg>
  );
}

function Rule() {
  return (
    <div className="flex items-center gap-3 text-brand-600" aria-hidden>
      <span className="h-px flex-1 bg-neutral-300/80" />
      <PlateOrnament className="h-5 w-5" />
      <span className="h-px flex-1 bg-neutral-300/80" />
    </div>
  );
}

export default async function PublicRestaurantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) notFound();
  const { restaurant, menus } = data;

  const infoLine = [
    [restaurant.address, restaurant.city].filter(Boolean).join(", "),
    restaurant.phone,
  ].filter(Boolean);

  return (
    <main className="min-h-screen bg-cream text-neutral-900">
      {/* Cabecera editorial */}
      <header className="mx-auto max-w-3xl px-4 pb-10 pt-16 text-center">
        <PlateOrnament className="mx-auto h-10 w-10 text-brand-600" />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.35em] text-brand-700">
          Restaurante
        </p>
        <h1 className="mt-3 font-serif text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
          {restaurant.name}
        </h1>
        {restaurant.description && (
          <p className="mx-auto mt-5 max-w-xl leading-relaxed text-neutral-600">
            {restaurant.description}
          </p>
        )}
        {infoLine.length > 0 && (
          <p className="mt-6 text-sm text-neutral-500">
            {infoLine.map((part, i) => (
              <span key={i}>
                {i > 0 && <span className="mx-3 text-brand-400">·</span>}
                {part === restaurant.phone ? (
                  <a href={`tel:${restaurant.phone}`} className="underline-offset-4 hover:underline">
                    {part}
                  </a>
                ) : (
                  part
                )}
              </span>
            ))}
          </p>
        )}
        <div className="mx-auto mt-10 max-w-md">
          <Rule />
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-12 px-4 pb-16 lg:grid-cols-[1fr_340px]">
        {/* La carta, como una carta impresa */}
        <section aria-label="Carta">
          {menus.length === 0 ? (
            <p className="rounded-2xl border border-neutral-200/70 bg-white p-8 text-center text-neutral-500">
              Ahora mismo no hay ninguna carta publicada. Vuelve a consultar más tarde.
            </p>
          ) : (
            <div className="space-y-14">
              {menus.map((menu) => (
                <article key={menu.id}>
                  <div className="mb-2 text-center">
                    <h2 className="font-serif text-3xl font-semibold tracking-tight">{menu.name}</h2>
                    {menu.type === "FIXED_PRICE" && menu.priceCents != null && (
                      <p className="mt-1 text-sm font-medium text-brand-700">
                        {formatCents(menu.priceCents, restaurant.currency)} · bebida no incluida
                      </p>
                    )}
                    {menu.description && (
                      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
                        {menu.description}
                      </p>
                    )}
                  </div>

                  {menu.categories.map((category) => (
                    <div key={category.id} className="mt-8">
                      <h3 className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
                        {category.name}
                        {category.choiceCount != null && (
                          <span className="ml-2 normal-case tracking-normal text-neutral-400">
                            (elige {category.choiceCount})
                          </span>
                        )}
                      </h3>
                      <ul className="mt-4 space-y-4">
                        {category.items
                          .filter((i) => i.isAvailable)
                          .map((item) => (
                            <li key={item.id}>
                              <div className="flex items-baseline gap-2">
                                <span className="font-serif text-lg font-medium">{item.name}</span>
                                {menu.type === "A_LA_CARTE" && (
                                  <>
                                    <span
                                      className="mx-1 flex-1 border-b border-dotted border-neutral-300"
                                      aria-hidden
                                    />
                                    <span className="whitespace-nowrap font-medium tabular-nums">
                                      {formatCents(item.priceCents, restaurant.currency)}
                                    </span>
                                  </>
                                )}
                              </div>
                              {(item.description || item.tags.length > 0 || item.allergens.length > 0) && (
                                <p className="mt-0.5 max-w-xl text-sm leading-relaxed text-neutral-500">
                                  {item.description}
                                  {item.tags.length > 0 && (
                                    <span className="ml-1 italic text-brand-700/80">
                                      {item.description ? "· " : ""}
                                      {item.tags.join(", ")}
                                    </span>
                                  )}
                                  {item.allergens.length > 0 && (
                                    <span className="ml-1 text-xs text-neutral-400">
                                      (
                                      {item.allergens
                                        .map((a) => ALLERGEN_LABELS_ES[a as Allergen].toLowerCase())
                                        .join(", ")}
                                      )
                                    </span>
                                  )}
                                </p>
                              )}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </article>
              ))}
              <div className="mx-auto max-w-md pt-2">
                <Rule />
              </div>
              <p className="text-center text-xs text-neutral-400">
                Disponemos de información detallada de alérgenos. Pregunta a nuestro equipo.
              </p>
            </div>
          )}
        </section>

        {/* Reservas */}
        <aside>
          <div className="lg:sticky lg:top-8">
            <ReservationWidget slug={restaurant.slug} restaurantName={restaurant.name} />
          </div>
        </aside>
      </div>

      <footer className="border-t border-neutral-200/70 py-8 text-center text-xs text-neutral-400">
        {restaurant.name} · Página creada con Restaurant Manager
      </footer>
    </main>
  );
}
