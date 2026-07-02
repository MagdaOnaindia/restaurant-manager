"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import {
  ALLERGEN_LABELS_ES,
  DAY_LABELS_ES,
  formatCents,
  type Allergen,
  type MenuDetail,
  type MenuScheduleInfo,
} from "@rms/shared";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, ApiError } from "@/lib/api";
import { useOrg } from "@/components/org-provider";
import { Alert, Button, Card, Field, Input, Spinner } from "@/components/ui";
import { ItemForm, type ItemFormValues } from "./item-form";

type ScheduleDraft = Omit<MenuScheduleInfo, "id"> & { id?: string };

export default function MenuEditorPage({ params }: { params: Promise<{ menuId: string }> }) {
  const { menuId } = use(params);
  const { activeRestaurant } = useOrg();
  const restaurantId = activeRestaurant?.id;

  const [menu, setMenu] = useState<MenuDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [addingItemTo, setAddingItemTo] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ScheduleDraft[]>([]);
  const [schedulesDirty, setSchedulesDirty] = useState(false);
  const [savingSchedules, setSavingSchedules] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const { menu } = await apiGet<{ menu: MenuDetail }>(
        `/restaurants/${restaurantId}/menus/${menuId}`,
      );
      setMenu(menu);
      setSchedules(menu.schedules);
      setSchedulesDirty(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el menú");
    }
  }, [restaurantId, menuId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Alert>{error}</Alert>;
  if (!menu || !restaurantId) return <Spinner />;

  async function patchMenu(data: Record<string, unknown>) {
    await apiPatch(`/restaurants/${restaurantId}/menus/${menuId}`, data);
    await load();
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    await apiPost(`/restaurants/${restaurantId}/menus/${menuId}/categories`, { name: newCategory });
    setNewCategory("");
    await load();
  }

  async function moveCategory(index: number, dir: -1 | 1) {
    const target = menu!.categories[index];
    const other = menu!.categories[index + dir];
    if (!target || !other) return;
    await Promise.all([
      apiPatch(`/restaurants/${restaurantId}/categories/${target.id}`, { sortOrder: other.sortOrder }),
      apiPatch(`/restaurants/${restaurantId}/categories/${other.id}`, { sortOrder: target.sortOrder }),
    ]);
    await load();
  }

  async function removeCategory(categoryId: string) {
    if (!confirm("¿Eliminar la categoría y todos sus platos?")) return;
    await apiDelete(`/restaurants/${restaurantId}/categories/${categoryId}`);
    await load();
  }

  async function createItem(categoryId: string, values: ItemFormValues) {
    await apiPost(`/restaurants/${restaurantId}/categories/${categoryId}/items`, values);
    setAddingItemTo(null);
    await load();
  }

  async function updateItem(itemId: string, values: ItemFormValues) {
    await apiPatch(`/restaurants/${restaurantId}/items/${itemId}`, values);
    setEditingItem(null);
    await load();
  }

  async function toggleAvailability(itemId: string, isAvailable: boolean) {
    await apiPatch(`/restaurants/${restaurantId}/items/${itemId}`, { isAvailable });
    await load();
  }

  async function removeItem(itemId: string) {
    if (!confirm("¿Eliminar este plato?")) return;
    await apiDelete(`/restaurants/${restaurantId}/items/${itemId}`);
    await load();
  }

  function updateSchedule(index: number, patch: Partial<ScheduleDraft>) {
    setSchedules((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    setSchedulesDirty(true);
  }

  function toggleDay(index: number, day: number) {
    setSchedules((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const days = s.daysOfWeek.includes(day)
          ? s.daysOfWeek.filter((d) => d !== day)
          : [...s.daysOfWeek, day].sort();
        return { ...s, daysOfWeek: days };
      }),
    );
    setSchedulesDirty(true);
  }

  async function saveSchedules() {
    setSavingSchedules(true);
    setError(null);
    try {
      await apiPut(`/restaurants/${restaurantId}/menus/${menuId}/schedules`, {
        schedules: schedules.map(({ dateFrom, dateTo, daysOfWeek, timeFrom, timeTo }) => ({
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          daysOfWeek,
          timeFrom: timeFrom || null,
          timeTo: timeTo || null,
        })),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron guardar las vigencias");
    } finally {
      setSavingSchedules(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/app/menus" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{menu.name}</h1>
            <p className="text-sm text-neutral-500">
              {menu.type === "FIXED_PRICE"
                ? `Menú de precio cerrado · ${menu.priceCents != null ? formatCents(menu.priceCents) : "—"}`
                : "Carta"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {menu.status !== "PUBLISHED" ? (
            <Button onClick={() => patchMenu({ status: "PUBLISHED" })}>Publicar</Button>
          ) : (
            <Button variant="secondary" onClick={() => patchMenu({ status: "DRAFT" })}>
              Pasar a borrador
            </Button>
          )}
        </div>
      </div>

      {/* Vigencias */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarClock className="h-5 w-5 text-brand-600" /> Vigencia
          </h2>
          <Button
            variant="secondary"
            onClick={() =>
              (setSchedules([
                ...schedules,
                { dateFrom: null, dateTo: null, daysOfWeek: [], timeFrom: null, timeTo: null },
              ]),
              setSchedulesDirty(true))
            }
          >
            <Plus className="h-4 w-4" /> Añadir regla
          </Button>
        </div>

        {schedules.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Sin reglas: el menú está <strong>siempre vigente</strong> mientras esté publicado.
          </p>
        ) : (
          <div className="space-y-3">
            {schedules.map((s, i) => (
              <div key={i} className="flex flex-wrap items-end gap-3 rounded-lg bg-neutral-50 p-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Desde</label>
                  <Input
                    type="date"
                    value={s.dateFrom ?? ""}
                    onChange={(e) => updateSchedule(i, { dateFrom: e.target.value || null })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Hasta</label>
                  <Input
                    type="date"
                    value={s.dateTo ?? ""}
                    onChange={(e) => updateSchedule(i, { dateTo: e.target.value || null })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Días</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(i, d)}
                        className={
                          s.daysOfWeek.includes(d)
                            ? "rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white"
                            : "rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-600"
                        }
                      >
                        {DAY_LABELS_ES[d]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">De</label>
                  <Input
                    type="time"
                    value={s.timeFrom ?? ""}
                    onChange={(e) => updateSchedule(i, { timeFrom: e.target.value || null })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">A</label>
                  <Input
                    type="time"
                    value={s.timeTo ?? ""}
                    onChange={(e) => updateSchedule(i, { timeTo: e.target.value || null })}
                  />
                </div>
                <button
                  onClick={() => (setSchedules(schedules.filter((_, j) => j !== i)), setSchedulesDirty(true))}
                  className="mb-1 rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        {schedulesDirty && (
          <div className="mt-3">
            <Button onClick={saveSchedules} loading={savingSchedules}>
              Guardar vigencias
            </Button>
          </div>
        )}
      </Card>

      {/* Categorías y platos */}
      <Card>
        <form onSubmit={addCategory} className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Field
              label={
                menu.type === "FIXED_PRICE"
                  ? "Nueva sección (Primero, Segundo, Postre…)"
                  : "Nueva categoría (Entrantes, Postres…)"
              }
              htmlFor="ncat"
            >
              <Input
                id="ncat"
                required
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
            </Field>
          </div>
          <Button type="submit">
            <Plus className="h-4 w-4" /> Añadir
          </Button>
        </form>
      </Card>

      {menu.categories.map((category, ci) => (
        <Card key={category.id}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">{category.name}</h3>
            <div className="flex items-center gap-1">
              <button
                disabled={ci === 0}
                onClick={() => moveCategory(ci, -1)}
                className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                disabled={ci === menu.categories.length - 1}
                onClick={() => moveCategory(ci, 1)}
                className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                onClick={() => removeCategory(category.id)}
                className="rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <ul className="divide-y divide-neutral-100">
            {category.items.map((item) => (
              <li key={item.id} className="py-3">
                {editingItem === item.id ? (
                  <ItemForm
                    restaurantId={restaurantId}
                    initial={item}
                    submitLabel="Guardar cambios"
                    onCancel={() => setEditingItem(null)}
                    onSubmit={(values) => updateItem(item.id, values)}
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    {item.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.photoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={item.isAvailable ? "font-medium" : "font-medium text-neutral-400 line-through"}>
                          {item.name}
                        </span>
                        <span className="text-sm text-neutral-500">{formatCents(item.priceCents)}</span>
                      </div>
                      {(item.allergens.length > 0 || item.tags.length > 0) && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {item.allergens.map((a) => (
                            <span key={a} className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800">
                              {ALLERGEN_LABELS_ES[a as Allergen]}
                            </span>
                          ))}
                          {item.tags.map((t) => (
                            <span key={t} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-neutral-500">
                      <input
                        type="checkbox"
                        checked={item.isAvailable}
                        onChange={(e) => toggleAvailability(item.id, e.target.checked)}
                        className="h-4 w-4 accent-brand-600"
                      />
                      Disponible
                    </label>
                    <button
                      onClick={() => setEditingItem(item.id)}
                      className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {addingItemTo === category.id ? (
            <div className="mt-3">
              <ItemForm
                restaurantId={restaurantId}
                submitLabel="Añadir plato"
                onCancel={() => setAddingItemTo(null)}
                onSubmit={(values) => createItem(category.id, values)}
              />
            </div>
          ) : (
            <Button variant="ghost" className="mt-2" onClick={() => setAddingItemTo(category.id)}>
              <Plus className="h-4 w-4" /> Añadir plato
            </Button>
          )}
        </Card>
      ))}
    </div>
  );
}
