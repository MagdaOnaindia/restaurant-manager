"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Armchair, Plus, Printer, Trash2 } from "lucide-react";
import { roleAtLeast, type ZoneWithTables } from "@rms/shared";
import { apiDelete, apiGet, apiPost, ApiError } from "@/lib/api";
import { useOrg } from "@/components/org-provider";
import { Alert, Button, Card, Input, Spinner } from "@/components/ui";

export default function TablesPage() {
  const { activeOrg, activeRestaurant } = useOrg();
  const [zones, setZones] = useState<ZoneWithTables[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newZoneName, setNewZoneName] = useState("");
  const [newTable, setNewTable] = useState<{ zoneId: string; name: string; capacity: number } | null>(
    null,
  );

  const restaurantId = activeRestaurant?.id;
  const canEdit = activeOrg ? roleAtLeast(activeOrg.role, "MANAGER") : false;

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const { zones } = await apiGet<{ zones: ZoneWithTables[] }>(`/restaurants/${restaurantId}/zones`);
    setZones(zones);
  }, [restaurantId]);

  useEffect(() => {
    setZones(null);
    void load();
  }, [load]);

  async function createZone(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiPost(`/restaurants/${restaurantId}/zones`, { name: newZoneName });
      setNewZoneName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la zona");
    }
  }

  async function createTable(e: React.FormEvent) {
    e.preventDefault();
    if (!newTable) return;
    setError(null);
    try {
      await apiPost(`/restaurants/${restaurantId}/zones/${newTable.zoneId}/tables`, {
        name: newTable.name,
        capacity: newTable.capacity,
      });
      setNewTable(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la mesa");
    }
  }

  async function removeTable(tableId: string) {
    if (!confirm("¿Eliminar esta mesa? El QR impreso dejará de funcionar.")) return;
    await apiDelete(`/restaurants/${restaurantId}/tables/${tableId}`);
    await load();
  }

  async function removeZone(zoneId: string) {
    if (!confirm("¿Eliminar la zona y todas sus mesas?")) return;
    await apiDelete(`/restaurants/${restaurantId}/zones/${zoneId}`);
    await load();
  }

  if (!activeRestaurant) {
    return <Alert variant="info">Crea primero un restaurante para gestionar sus mesas.</Alert>;
  }
  if (!zones) return <Spinner />;

  const totalTables = zones.reduce((acc, z) => acc + z.tables.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Mesas · {activeRestaurant.name}</h1>
          <p className="text-sm text-neutral-500">
            {zones.length} zonas · {totalTables} mesas
          </p>
        </div>
        {totalTables > 0 && (
          <Link href="/app/tables/print" target="_blank">
            <Button variant="secondary">
              <Printer className="h-4 w-4" /> Imprimir códigos QR
            </Button>
          </Link>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      {canEdit && (
        <Card>
          <form onSubmit={createZone} className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Nueva zona (comedor, terraza, barra…)
              </label>
              <Input
                required
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="p. ej. Terraza"
              />
            </div>
            <Button type="submit">
              <Plus className="h-4 w-4" /> Añadir zona
            </Button>
          </form>
        </Card>
      )}

      {zones.length === 0 && (
        <Card className="text-center text-neutral-500">
          Todavía no hay zonas. Crea la primera (p. ej. “Comedor”) y añade sus mesas.
        </Card>
      )}

      {zones.map((zone) => (
        <Card key={zone.id}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{zone.name}</h2>
            {canEdit && (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setNewTable({ zoneId: zone.id, name: "", capacity: 2 })}
                >
                  <Plus className="h-4 w-4" /> Mesa
                </Button>
                <button
                  onClick={() => removeZone(zone.id)}
                  className="rounded-lg p-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                  title="Eliminar zona"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {newTable?.zoneId === zone.id && (
            <form
              onSubmit={createTable}
              className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-neutral-50 p-3"
            >
              <div className="min-w-40 flex-1">
                <label className="mb-1 block text-sm font-medium text-neutral-700">
                  Nombre / número
                </label>
                <Input
                  required
                  autoFocus
                  value={newTable.name}
                  onChange={(e) => setNewTable({ ...newTable, name: e.target.value })}
                  placeholder="p. ej. Mesa 4"
                />
              </div>
              <div className="w-32">
                <label className="mb-1 block text-sm font-medium text-neutral-700">Plazas</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={newTable.capacity}
                  onChange={(e) => setNewTable({ ...newTable, capacity: Number(e.target.value) })}
                />
              </div>
              <Button type="submit">Crear</Button>
              <Button type="button" variant="ghost" onClick={() => setNewTable(null)}>
                Cancelar
              </Button>
            </form>
          )}

          {zone.tables.length === 0 ? (
            <p className="text-sm text-neutral-400">Sin mesas en esta zona.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {zone.tables.map((table) => (
                <div
                  key={table.id}
                  className="flex items-center justify-between rounded-lg border border-neutral-200 p-3"
                >
                  <div className="flex items-center gap-3">
                    <Armchair className="h-5 w-5 text-brand-600" />
                    <div>
                      <div className="font-medium">{table.name}</div>
                      <div className="text-xs text-neutral-500">
                        {table.capacity} plazas · {table.qrCode}
                      </div>
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => removeTable(table.id)}
                      className="rounded-lg p-1.5 text-neutral-300 transition hover:bg-red-50 hover:text-red-600"
                      title="Eliminar mesa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
