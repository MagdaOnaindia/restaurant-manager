"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Globe } from "lucide-react";
import type { RestaurantDetail } from "@rms/shared";
import { apiGet, apiPatch, ApiError } from "@/lib/api";
import { useOrg } from "@/components/org-provider";
import { Alert, Button, Card, Field, Input, Spinner } from "@/components/ui";

export default function RestaurantSettingsPage() {
  const { activeRestaurant, reload } = useOrg();
  const restaurantId = activeRestaurant?.id;

  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null);
  const [form, setForm] = useState({ name: "", description: "", address: "", city: "", phone: "" });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const { restaurant } = await apiGet<{ restaurant: RestaurantDetail }>(
      `/restaurants/${restaurantId}`,
    );
    setRestaurant(restaurant);
    setForm({
      name: restaurant.name,
      description: restaurant.description ?? "",
      address: restaurant.address ?? "",
      city: restaurant.city ?? "",
      phone: restaurant.phone ?? "",
    });
  }, [restaurantId]);

  useEffect(() => {
    setRestaurant(null);
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      await apiPatch(`/restaurants/${restaurantId}`, {
        name: form.name,
        description: form.description || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        phone: form.phone || undefined,
      });
      await Promise.all([load(), reload()]);
      setMessage({ ok: true, text: "Datos guardados" });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : "No se pudo guardar" });
    } finally {
      setSaving(false);
    }
  }

  async function togglePublic() {
    if (!restaurant) return;
    setMessage(null);
    try {
      await apiPatch(`/restaurants/${restaurantId}`, { isPublic: !restaurant.isPublic });
      await Promise.all([load(), reload()]);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : "No se pudo cambiar" });
    }
  }

  if (!activeRestaurant) {
    return <Alert variant="info">Crea primero un restaurante.</Alert>;
  }
  if (!restaurant) return <Spinner />;

  const publicUrl = `/r/${restaurant.slug}`;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Mi página · {restaurant.name}</h1>
      {message && <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert>}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Globe className={restaurant.isPublic ? "h-8 w-8 text-green-600" : "h-8 w-8 text-neutral-300"} />
            <div>
              <div className="font-semibold">
                {restaurant.isPublic ? "Página pública activa" : "Página no publicada"}
              </div>
              <div className="text-sm text-neutral-500">
                {restaurant.isPublic
                  ? "Tus clientes pueden ver la carta vigente y reservar."
                  : "Actívala para que tus clientes vean tu carta y reserven online."}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {restaurant.isPublic && (
              <Link href={publicUrl} target="_blank">
                <Button variant="secondary">
                  <ExternalLink className="h-4 w-4" /> Ver página
                </Button>
              </Link>
            )}
            <Button onClick={togglePublic} variant={restaurant.isPublic ? "secondary" : "primary"}>
              {restaurant.isPublic ? "Despublicar" : "Publicar página"}
            </Button>
          </div>
        </div>
        {restaurant.isPublic && (
          <p className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            URL pública: <code className="text-brand-700">{publicUrl}</code>
          </p>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Datos del restaurante</h2>
        <form onSubmit={save} className="space-y-4">
          <Field label="Nombre" htmlFor="sname">
            <Input
              id="sname"
              required
              minLength={2}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Descripción (aparece en tu página)" htmlFor="sdesc">
            <textarea
              id="sdesc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </Field>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-56 flex-1">
              <Field label="Dirección" htmlFor="saddr">
                <Input
                  id="saddr"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </Field>
            </div>
            <div className="min-w-36">
              <Field label="Ciudad" htmlFor="scity">
                <Input
                  id="scity"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </Field>
            </div>
            <div className="min-w-36">
              <Field label="Teléfono" htmlFor="sphone">
                <Input
                  id="sphone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
            </div>
          </div>
          <Button type="submit" loading={saving}>
            Guardar
          </Button>
        </form>
      </Card>
    </div>
  );
}
