"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Armchair } from "lucide-react";
import { formatCents, type FloorZone } from "@rms/shared";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useOrg } from "@/components/org-provider";
import { Alert, Card, Spinner } from "@/components/ui";

export default function PosFloorPage() {
  const { activeRestaurant } = useOrg();
  const router = useRouter();
  const restaurantId = activeRestaurant?.id;
  const [zones, setZones] = useState<FloorZone[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const { zones } = await apiGet<{ zones: FloorZone[] }>(`/restaurants/${restaurantId}/floor`);
    setZones(zones);
  }, [restaurantId]);

  useEffect(() => {
    setZones(null);
    void load();
    const interval = setInterval(load, 15_000);
    return () => clearInterval(interval);
  }, [load]);

  async function tapTable(tableId: string, checkId: string | undefined) {
    setError(null);
    if (checkId) {
      router.push(`/app/pos/${checkId}`);
      return;
    }
    try {
      const { check } = await apiPost<{ check: { id: string } }>(
        `/restaurants/${restaurantId}/checks`,
        { tableId },
      );
      router.push(`/app/pos/${check.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo abrir la cuenta");
      await load();
    }
  }

  if (!activeRestaurant) {
    return <Alert variant="info">Crea primero un restaurante con mesas.</Alert>;
  }
  if (!zones) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Comandero · {activeRestaurant.name}</h1>
        <p className="text-sm text-neutral-500">
          Toca una mesa libre para abrir cuenta, o una ocupada para verla.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      {zones.length === 0 && (
        <Card className="text-center text-neutral-500">
          No hay mesas configuradas. Créalas en la sección “Mesas”.
        </Card>
      )}

      {zones.map((zone) => (
        <div key={zone.id}>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {zone.name}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {zone.tables.map((table) => {
              const check = table.check;
              const paidBadge =
                check && check.paidCents > 0
                  ? ` · pagado ${formatCents(check.paidCents)}`
                  : "";
              return (
                <button
                  key={table.id}
                  onClick={() => tapTable(table.id, check?.id)}
                  className={
                    check
                      ? check.status === "PAID"
                        ? "rounded-xl border-2 border-green-500 bg-green-50 p-4 text-left transition hover:shadow"
                        : check.status === "PARTIALLY_PAID"
                          ? "rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-left transition hover:shadow"
                          : "rounded-xl border-2 border-brand-400 bg-brand-50 p-4 text-left transition hover:shadow"
                      : "rounded-xl border-2 border-dashed border-neutral-300 bg-white p-4 text-left transition hover:border-brand-300 hover:shadow"
                  }
                >
                  <div className="flex items-center justify-between">
                    <Armchair className={check ? "h-5 w-5 text-brand-700" : "h-5 w-5 text-neutral-300"} />
                    <span className="text-xs text-neutral-400">{table.capacity}p</span>
                  </div>
                  <div className="mt-2 font-bold">{table.name}</div>
                  <div className="text-sm text-neutral-600">
                    {check ? `${formatCents(check.totalCents)}${paidBadge}` : "Libre"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
