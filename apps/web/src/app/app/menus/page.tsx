"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, NotebookText, Plus, Trash2 } from "lucide-react";
import {
  DAY_LABELS_ES,
  formatCents,
  roleAtLeast,
  type MenuScheduleInfo,
  type MenuSummary,
} from "@rms/shared";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import { parseEurosToCents } from "@/lib/money";
import { useOrg } from "@/components/org-provider";
import { Alert, Button, Card, Field, Input, Spinner } from "@/components/ui";

function scheduleLabel(s: MenuScheduleInfo): string {
  const parts: string[] = [];
  if (s.dateFrom || s.dateTo) parts.push(`${s.dateFrom ?? "…"} → ${s.dateTo ?? "…"}`);
  if (s.daysOfWeek.length > 0) parts.push(s.daysOfWeek.map((d) => DAY_LABELS_ES[d]).join(", "));
  if (s.timeFrom || s.timeTo) parts.push(`${s.timeFrom ?? ""}–${s.timeTo ?? ""}`);
  return parts.join(" · ") || "Siempre";
}

const STATUS_BADGE: Record<string, { text: string; cls: string }> = {
  DRAFT: { text: "Borrador", cls: "bg-amber-100 text-amber-800" },
  PUBLISHED: { text: "Publicado", cls: "bg-green-100 text-green-800" },
  ARCHIVED: { text: "Archivado", cls: "bg-neutral-200 text-neutral-600" },
};

export default function MenusPage() {
  const { activeOrg, activeRestaurant } = useOrg();
  const [menus, setMenus] = useState<MenuSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", type: "A_LA_CARTE", price: "" });
  const [saving, setSaving] = useState(false);

  const restaurantId = activeRestaurant?.id;
  const canEdit = activeOrg ? roleAtLeast(activeOrg.role, "MANAGER") : false;

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const { menus } = await apiGet<{ menus: MenuSummary[] }>(`/restaurants/${restaurantId}/menus`);
    setMenus(menus);
  }, [restaurantId]);

  useEffect(() => {
    setMenus(null);
    void load();
  }, [load]);

  async function createMenu(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const priceCents = form.type === "FIXED_PRICE" ? parseEurosToCents(form.price) : undefined;
    if (form.type === "FIXED_PRICE" && priceCents === null) {
      setError("Escribe un precio válido para el menú (p. ej. 14,50)");
      return;
    }
    setSaving(true);
    try {
      await apiPost(`/restaurants/${restaurantId}/menus`, {
        name: form.name,
        type: form.type,
        priceCents: priceCents ?? undefined,
      });
      setForm({ name: "", type: "A_LA_CARTE", price: "" });
      setShowNew(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear");
    } finally {
      setSaving(false);
    }
  }

  async function duplicate(menuId: string) {
    await apiPost(`/restaurants/${restaurantId}/menus/${menuId}/duplicate`);
    await load();
  }

  async function setStatus(menuId: string, status: string) {
    await apiPatch(`/restaurants/${restaurantId}/menus/${menuId}`, { status });
    await load();
  }

  async function remove(menuId: string) {
    if (!confirm("¿Eliminar este menú definitivamente?")) return;
    await apiDelete(`/restaurants/${restaurantId}/menus/${menuId}`);
    await load();
  }

  if (!activeRestaurant) {
    return <Alert variant="info">Crea primero un restaurante para gestionar sus cartas.</Alert>;
  }
  if (!menus) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Cartas y menús · {activeRestaurant.name}</h1>
          <p className="text-sm text-neutral-500">
            Cartas por temporada, menús del día y su vigencia.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowNew((v) => !v)}>
            <Plus className="h-4 w-4" /> Nueva carta o menú
          </Button>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      {showNew && (
        <Card>
          <form onSubmit={createMenu} className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Field label="Nombre" htmlFor="mname">
                <Input
                  id="mname"
                  required
                  minLength={2}
                  placeholder="p. ej. Carta de verano / Menú del día"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
            </div>
            <div>
              <Field label="Tipo" htmlFor="mtype">
                <select
                  id="mtype"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="A_LA_CARTE">Carta (precio por plato)</option>
                  <option value="FIXED_PRICE">Menú de precio cerrado</option>
                </select>
              </Field>
            </div>
            {form.type === "FIXED_PRICE" && (
              <div className="w-36">
                <Field label="Precio (€)" htmlFor="mprice">
                  <Input
                    id="mprice"
                    required
                    placeholder="14,50"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </Field>
              </div>
            )}
            <Button type="submit" loading={saving}>
              Crear
            </Button>
          </form>
        </Card>
      )}

      {menus.length === 0 && (
        <Card className="text-center text-neutral-500">
          Aún no hay cartas. Crea la primera y añade categorías y platos.
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {menus.map((menu) => {
          const badge = STATUS_BADGE[menu.status]!;
          return (
            <Card key={menu.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/app/menus/${menu.id}`}
                  className="flex items-center gap-2 font-semibold hover:text-brand-700"
                >
                  <NotebookText className="h-5 w-5 text-brand-600" />
                  {menu.name}
                </Link>
                <div className="flex items-center gap-1.5">
                  {menu.activeNow && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">
                      Vigente ahora
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                    {badge.text}
                  </span>
                </div>
              </div>

              <div className="text-sm text-neutral-500">
                {menu.type === "FIXED_PRICE"
                  ? `Precio cerrado · ${menu.priceCents != null ? formatCents(menu.priceCents) : "—"}`
                  : "Carta"}
                {" · "}
                {menu.categoryCount} categorías · {menu.itemCount} platos
              </div>

              <div className="flex flex-wrap gap-1.5">
                {menu.schedules.length === 0 ? (
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                    Siempre vigente
                  </span>
                ) : (
                  menu.schedules.map((s) => (
                    <span key={s.id} className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                      {scheduleLabel(s)}
                    </span>
                  ))
                )}
              </div>

              {canEdit && (
                <div className="mt-auto flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
                  <Link href={`/app/menus/${menu.id}`}>
                    <Button variant="secondary">Editar</Button>
                  </Link>
                  {menu.status !== "PUBLISHED" ? (
                    <Button onClick={() => setStatus(menu.id, "PUBLISHED")}>Publicar</Button>
                  ) : (
                    <Button variant="secondary" onClick={() => setStatus(menu.id, "ARCHIVED")}>
                      Archivar
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => duplicate(menu.id)} title="Duplicar">
                    <Copy className="h-4 w-4" /> Duplicar
                  </Button>
                  <button
                    onClick={() => remove(menu.id)}
                    className="ml-auto rounded-lg p-2 text-neutral-300 transition hover:bg-red-50 hover:text-red-600"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
