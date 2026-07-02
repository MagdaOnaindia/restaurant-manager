"use client";

import { useState } from "react";
import { Plus, Store } from "lucide-react";
import { roleAtLeast } from "@rms/shared";
import { apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useOrg } from "@/components/org-provider";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

export default function DashboardPage() {
  const { user } = useAuth();
  const { activeOrg, reload, setActiveRestaurantId } = useOrg();
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canManage = activeOrg ? roleAtLeast(activeOrg.role, "ADMIN") : false;

  async function createRestaurant(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiPost(`/orgs/${activeOrg!.id}/restaurants`, {
        name,
        city: city || undefined,
      });
      setName("");
      setCity("");
      setShowNew(false);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el restaurante");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hola, {user?.name} 👋</h1>
          <p className="text-sm text-neutral-500">{activeOrg?.name}</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowNew((v) => !v)}>
            <Plus className="h-4 w-4" /> Nuevo restaurante
          </Button>
        )}
      </div>

      {showNew && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Añadir restaurante</h2>
          <form onSubmit={createRestaurant} className="flex flex-wrap items-end gap-4">
            {error && <Alert>{error}</Alert>}
            <div className="min-w-56 flex-1">
              <Field label="Nombre" htmlFor="newName">
                <Input
                  id="newName"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            </div>
            <div className="min-w-40">
              <Field label="Ciudad" htmlFor="newCity">
                <Input id="newCity" value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
            </div>
            <Button type="submit" loading={saving}>
              Crear
            </Button>
          </form>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeOrg?.restaurants.map((r) => (
          <button
            key={r.id}
            onClick={() => setActiveRestaurantId(r.id)}
            className="text-left"
          >
            <Card className="h-full transition hover:border-brand-300 hover:shadow">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100">
                  <Store className="h-5 w-5 text-brand-700" />
                </div>
                <span
                  className={
                    r.isPublic
                      ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                      : "rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600"
                  }
                >
                  {r.isPublic ? "Página pública activa" : "Página no publicada"}
                </span>
              </div>
              <h3 className="mt-3 font-semibold">{r.name}</h3>
              <p className="text-sm text-neutral-500">{r.city ?? "—"}</p>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
