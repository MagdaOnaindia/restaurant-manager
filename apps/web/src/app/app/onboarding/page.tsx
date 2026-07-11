"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OrganizationWithRole, RestaurantDetail } from "@rms/shared";
import { apiPost, ApiError } from "@/lib/api";
import { useOrg } from "@/components/org-provider";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

export default function OnboardingPage() {
  const router = useRouter();
  const { reload, setActiveOrgId, organizations } = useOrg();
  const existingOrg = organizations[0] ?? null;

  const [step, setStep] = useState<1 | 2>(existingOrg ? 2 : 1);
  const [orgName, setOrgName] = useState("");
  const [orgId, setOrgId] = useState<string | null>(existingOrg?.id ?? null);
  const [restaurant, setRestaurant] = useState({ name: "", city: "", address: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { organization } = await apiPost<{ organization: OrganizationWithRole }>("/orgs", {
        name: orgName,
      });
      setOrgId(organization.id);
      setActiveOrgId(organization.id);
      setStep(2);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la organización");
    } finally {
      setLoading(false);
    }
  }

  async function createRestaurant(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiPost<{ restaurant: RestaurantDetail }>(`/orgs/${orgId}/restaurants`, {
        name: restaurant.name,
        city: restaurant.city || undefined,
        address: restaurant.address || undefined,
        phone: restaurant.phone || undefined,
      });
      await reload();
      router.replace("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el restaurante");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {step === 1 ? "Crea tu negocio" : "Tu primer restaurante"}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">Paso {step} de 2</p>
      </div>

      <Card>
        {error && (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        )}
        {step === 1 ? (
          <form onSubmit={createOrg} className="space-y-4">
            <Field label="Nombre del negocio o cadena" htmlFor="orgName">
              <Input
                id="orgName"
                placeholder="p. ej. Grupo La Taberna"
                required
                minLength={2}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </Field>
            <p className="text-sm text-neutral-500">
              Si tienes varios restaurantes, aquí va el nombre del grupo. Podrás añadir todos los
              locales después.
            </p>
            <Button type="submit" loading={loading} className="w-full">
              Continuar
            </Button>
          </form>
        ) : (
          <form onSubmit={createRestaurant} className="space-y-4">
            <Field label="Nombre del restaurante" htmlFor="rname">
              <Input
                id="rname"
                placeholder="p. ej. La Taberna del Puerto"
                required
                minLength={2}
                value={restaurant.name}
                onChange={(e) => setRestaurant({ ...restaurant, name: e.target.value })}
              />
            </Field>
            <Field label="Ciudad (opcional)" htmlFor="rcity">
              <Input
                id="rcity"
                value={restaurant.city}
                onChange={(e) => setRestaurant({ ...restaurant, city: e.target.value })}
              />
            </Field>
            <Field label="Dirección (opcional)" htmlFor="raddress">
              <Input
                id="raddress"
                value={restaurant.address}
                onChange={(e) => setRestaurant({ ...restaurant, address: e.target.value })}
              />
            </Field>
            <Field label="Teléfono (opcional)" htmlFor="rphone">
              <Input
                id="rphone"
                value={restaurant.phone}
                onChange={(e) => setRestaurant({ ...restaurant, phone: e.target.value })}
              />
            </Field>
            <Button type="submit" loading={loading} className="w-full">
              Crear restaurante
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
