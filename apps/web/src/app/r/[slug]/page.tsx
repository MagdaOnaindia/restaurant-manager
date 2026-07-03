import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, Phone } from "lucide-react";
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
      restaurant.description ??
      `Carta y reservas de ${restaurant.name}. Reserva tu mesa online.`,
    openGraph: {
      title: restaurant.name,
      description: restaurant.description ?? undefined,
      type: "website",
    },
  };
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

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Portada */}
      <header className="bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950 px-4 py-16 text-center text-white">
        <p className="mb-3 text-sm uppercase tracking-[0.25em] text-brand-200">Restaurante</p>
        <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
          {restaurant.name}
        </h1>
        {restaurant.description && (
          <p className="mx-auto mt-3 max-w-xl text-brand-100">{restaurant.description}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm text-brand-100">
          {(restaurant.address || restaurant.city) && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {[restaurant.address, restaurant.city].filter(Boolean).join(", ")}
            </span>
          )}
          {restaurant.phone && (
            <a href={`tel:${restaurant.phone}`} className="flex items-center gap-1.5 hover:underline">
              <Phone className="h-4 w-4" />
              {restaurant.phone}
            </a>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[1fr_360px]">
        {/* Carta vigente */}
        <section>
          <h2 className="mb-4 font-serif text-3xl font-semibold tracking-tight">Nuestra carta</h2>
          {menus.length === 0 ? (
            <p className="rounded-xl border border-neutral-200 bg-white p-6 text-neutral-500">
              Ahora mismo no hay ninguna carta publicada. Vuelve a consultar más tarde.
            </p>
          ) : (
            <div className="space-y-8">
              {menus.map((menu) => (
                <article key={menu.id} className="rounded-xl border border-neutral-200 bg-white p-6">
                  <div className="mb-4 flex items-baseline justify-between gap-3">
                    <h3 className="font-serif text-2xl font-semibold">{menu.name}</h3>
                    {menu.type === "FIXED_PRICE" && menu.priceCents != null && (
                      <span className="whitespace-nowrap rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-800">
                        {formatCents(menu.priceCents, restaurant.currency)}
                      </span>
                    )}
                  </div>
                  {menu.description && (
                    <p className="mb-4 text-sm text-neutral-500">{menu.description}</p>
                  )}
                  {menu.categories.map((category) => (
                    <div key={category.id} className="mb-6 last:mb-0">
                      <h4 className="mb-2 border-b border-neutral-200 pb-1 font-semibold text-brand-800">
                        {category.name}
                        {category.choiceCount != null && (
                          <span className="ml-2 text-xs font-normal text-neutral-400">
                            (elige {category.choiceCount})
                          </span>
                        )}
                      </h4>
                      <ul className="space-y-3">
                        {category.items
                          .filter((i) => i.isAvailable)
                          .map((item) => (
                            <li key={item.id} className="flex gap-3">
                              {item.photoUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.photoUrl}
                                  alt={item.name}
                                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="font-medium">{item.name}</span>
                                  {menu.type === "A_LA_CARTE" && (
                                    <span className="whitespace-nowrap text-sm font-semibold text-neutral-700">
                                      {formatCents(item.priceCents, restaurant.currency)}
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-sm text-neutral-500">{item.description}</p>
                                )}
                                {(item.allergens.length > 0 || item.tags.length > 0) && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {item.tags.map((t) => (
                                      <span
                                        key={t}
                                        className="rounded bg-green-50 px-1.5 py-0.5 text-[11px] text-green-700"
                                      >
                                        {t}
                                      </span>
                                    ))}
                                    {item.allergens.map((a) => (
                                      <span
                                        key={a}
                                        className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800"
                                        title="Alérgeno"
                                      >
                                        {ALLERGEN_LABELS_ES[a as Allergen]}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Reservas */}
        <aside>
          <div className="lg:sticky lg:top-6">
            <ReservationWidget slug={restaurant.slug} restaurantName={restaurant.name} />
          </div>
        </aside>
      </div>

      <footer className="border-t border-neutral-200 bg-white py-6 text-center text-sm text-neutral-400">
        {restaurant.name} · Página creada con Restaurant Manager
      </footer>
    </main>
  );
}
