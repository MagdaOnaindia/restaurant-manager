"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, Settings2 } from "lucide-react";
import {
  DAY_LABELS_ES,
  RESERVATION_STATUSES,
  RESERVATION_STATUS_LABELS_ES,
  roleAtLeast,
  type AvailabilitySlot,
  type ReservationInfo,
  type ShiftInfo,
  type ZoneWithTables,
} from "@rms/shared";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, ApiError } from "@/lib/api";
import { useOrg } from "@/components/org-provider";
import { Alert, Button, Card, Field, Input, Spinner } from "@/components/ui";

function todayStr(): string {
  return new Date().toLocaleDateString("en-CA");
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  SEATED: "bg-green-100 text-green-800",
  COMPLETED: "bg-neutral-200 text-neutral-600",
  CANCELLED: "bg-red-100 text-red-700",
  NO_SHOW: "bg-red-100 text-red-700",
};

export default function ReservationsPage() {
  const { activeOrg, activeRestaurant } = useOrg();
  const restaurantId = activeRestaurant?.id;
  const canManage = activeOrg ? roleAtLeast(activeOrg.role, "MANAGER") : false;

  const [date, setDate] = useState(todayStr());
  const [reservations, setReservations] = useState<ReservationInfo[] | null>(null);
  const [zones, setZones] = useState<ZoneWithTables[]>([]);
  const [shifts, setShifts] = useState<ShiftInfo[]>([]);
  const [showShifts, setShowShifts] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const [r, z, s] = await Promise.all([
      apiGet<{ reservations: ReservationInfo[] }>(
        `/restaurants/${restaurantId}/reservations?date=${date}`,
      ),
      apiGet<{ zones: ZoneWithTables[] }>(`/restaurants/${restaurantId}/zones`),
      apiGet<{ shifts: ShiftInfo[] }>(`/restaurants/${restaurantId}/shifts`),
    ]);
    setReservations(r.reservations);
    setZones(z.zones);
    setShifts(s.shifts);
  }, [restaurantId, date]);

  useEffect(() => {
    setReservations(null);
    void load();
  }, [load]);

  const allTables = useMemo(
    () => zones.flatMap((z) => z.tables.map((t) => ({ ...t, zoneName: z.name }))),
    [zones],
  );

  async function patchReservation(id: string, data: Record<string, unknown>) {
    setError(null);
    try {
      await apiPatch(`/restaurants/${restaurantId}/reservations/${id}`, data);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar la reserva");
    }
  }

  if (!activeRestaurant) {
    return <Alert variant="info">Crea primero un restaurante para gestionar sus reservas.</Alert>;
  }

  const active = reservations?.filter((r) => r.status !== "CANCELLED" && r.status !== "NO_SHOW") ?? [];
  const totalCovers = active.reduce((acc, r) => acc + r.partySize, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Reservas · {activeRestaurant.name}</h1>
          <p className="text-sm text-neutral-500">
            {active.length} reservas · {totalCovers} comensales
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5">
            <CalendarDays className="h-4 w-4 text-neutral-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-sm outline-none"
            />
          </div>
          <Button onClick={() => setShowNew((v) => !v)}>
            <Plus className="h-4 w-4" /> Nueva reserva
          </Button>
          {canManage && (
            <Button variant="secondary" onClick={() => setShowShifts((v) => !v)}>
              <Settings2 className="h-4 w-4" /> Turnos
            </Button>
          )}
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {showShifts && canManage && restaurantId && (
        <ShiftsEditor restaurantId={restaurantId} shifts={shifts} onChange={load} />
      )}

      {showNew && restaurantId && (
        <NewReservationForm
          restaurantId={restaurantId}
          date={date}
          onCreated={async () => {
            setShowNew(false);
            await load();
          }}
        />
      )}

      {!reservations ? (
        <Spinner />
      ) : reservations.length === 0 ? (
        <Card className="text-center text-neutral-500">
          No hay reservas para este día.
          {shifts.length === 0 && canManage && " Configura primero los turnos reservables."}
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-neutral-100">
            {reservations.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="w-14 text-lg font-bold text-brand-700">{r.time}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {r.customerName}
                    <span className="ml-2 text-sm font-normal text-neutral-500">
                      {r.partySize} pers.
                      {r.shiftName && ` · ${r.shiftName}`}
                      {r.source === "PUBLIC" && " · web"}
                    </span>
                  </div>
                  <div className="truncate text-sm text-neutral-500">
                    {[r.customerPhone, r.customerEmail, r.notes].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <select
                  value={r.tableId ?? ""}
                  onChange={(e) => patchReservation(r.id, { tableId: e.target.value || null })}
                  className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">Sin mesa</option>
                  {allTables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.zoneName})
                    </option>
                  ))}
                </select>
                <select
                  value={r.status}
                  onChange={(e) => patchReservation(r.id, { status: e.target.value })}
                  className={`rounded-lg px-2 py-1.5 text-sm font-medium ${STATUS_COLORS[r.status]}`}
                >
                  {RESERVATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {RESERVATION_STATUS_LABELS_ES[s]}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function NewReservationForm({
  restaurantId,
  date,
  onCreated,
}: {
  restaurantId: string;
  date: string;
  onCreated: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    time: "",
    partySize: 2,
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    notes: "",
    force: false,
  });
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<{ slots: AvailabilitySlot[] }>(
      `/restaurants/${restaurantId}/availability?date=${date}&partySize=${form.partySize}`,
    )
      .then((r) => setSlots(r.slots))
      .catch(() => setSlots([]));
  }, [restaurantId, date, form.partySize]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiPost(`/restaurants/${restaurantId}/reservations`, {
        date,
        time: form.time,
        partySize: form.partySize,
        customerName: form.customerName,
        customerPhone: form.customerPhone || undefined,
        customerEmail: form.customerEmail || undefined,
        notes: form.notes || undefined,
        force: form.force,
      });
      await onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la reserva");
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">Nueva reserva · {date}</h2>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-28">
            <Field label="Personas" htmlFor="rsize">
              <Input
                id="rsize"
                type="number"
                min={1}
                max={50}
                value={form.partySize}
                onChange={(e) => setForm({ ...form, partySize: Number(e.target.value) })}
              />
            </Field>
          </div>
          <div className="w-32">
            <Field label="Hora" htmlFor="rtime">
              <Input
                id="rtime"
                type="time"
                required
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={form.force}
              onChange={(e) => setForm({ ...form, force: e.target.checked })}
              className="h-4 w-4 accent-brand-600"
            />
            Forzar (ignorar aforo y turnos)
          </label>
        </div>

        {slots.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {slots.map((s) => (
              <button
                key={s.time}
                type="button"
                disabled={!s.available && !form.force}
                onClick={() => setForm({ ...form, time: s.time })}
                className={
                  form.time === s.time
                    ? "rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
                    : s.available || form.force
                      ? "rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:border-brand-400"
                      : "rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-1.5 text-sm text-neutral-400 line-through"
                }
              >
                {s.time}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <div className="min-w-48 flex-1">
            <Field label="Nombre del cliente" htmlFor="rname">
              <Input
                id="rname"
                required
                minLength={2}
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              />
            </Field>
          </div>
          <div className="min-w-40">
            <Field label="Teléfono" htmlFor="rphone">
              <Input
                id="rphone"
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
              />
            </Field>
          </div>
          <div className="min-w-48">
            <Field label="Email (para confirmación)" htmlFor="remail">
              <Input
                id="remail"
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <Field label="Notas (alergias, trona, terraza…)" htmlFor="rnotes">
          <Input
            id="rnotes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <Button type="submit" loading={saving}>
          Crear reserva
        </Button>
      </form>
    </Card>
  );
}

function ShiftsEditor({
  restaurantId,
  shifts,
  onChange,
}: {
  restaurantId: string;
  shifts: ShiftInfo[];
  onChange: () => Promise<void>;
}) {
  const empty = {
    name: "",
    daysOfWeek: [] as number[],
    startTime: "13:00",
    endTime: "15:30",
    slotMinutes: 15 as 15 | 30 | 60,
    maxCoversPerSlot: 20,
    isActive: true,
  };
  const [draft, setDraft] = useState(empty);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(day: number) {
    setDraft((d) => ({
      ...d,
      daysOfWeek: d.daysOfWeek.includes(day)
        ? d.daysOfWeek.filter((x) => x !== day)
        : [...d.daysOfWeek, day].sort(),
    }));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiPost(`/restaurants/${restaurantId}/shifts`, draft);
      setDraft(empty);
      await onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el turno");
    }
  }

  async function toggleActive(shift: ShiftInfo) {
    await apiPut(`/restaurants/${restaurantId}/shifts/${shift.id}`, {
      ...shift,
      isActive: !shift.isActive,
    });
    await onChange();
  }

  async function remove(shiftId: string) {
    if (!confirm("¿Eliminar este turno?")) return;
    await apiDelete(`/restaurants/${restaurantId}/shifts/${shiftId}`);
    await onChange();
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">Turnos reservables</h2>
      <p className="mb-4 text-sm text-neutral-500">
        El aforo es por franja de entrada: cuántas personas pueden <em>llegar</em> en cada franja.
      </p>

      {shifts.length > 0 && (
        <ul className="mb-4 divide-y divide-neutral-100">
          {shifts.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="font-medium">{s.name}</span>
              <span className="text-sm text-neutral-500">
                {s.daysOfWeek.length === 0
                  ? "Todos los días"
                  : s.daysOfWeek.map((d) => DAY_LABELS_ES[d]).join(", ")}
                {` · ${s.startTime}–${s.endTime} · cada ${s.slotMinutes} min · máx. ${s.maxCoversPerSlot} pers./franja`}
              </span>
              <div className="ml-auto flex gap-2">
                <Button variant="secondary" onClick={() => toggleActive(s)}>
                  {s.isActive ? "Desactivar" : "Activar"}
                </Button>
                <Button variant="ghost" onClick={() => remove(s.id)}>
                  Eliminar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={create} className="space-y-3 rounded-lg bg-neutral-50 p-4">
        {error && <Alert>{error}</Alert>}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-40 flex-1">
            <Field label="Nombre" htmlFor="sname">
              <Input
                id="sname"
                required
                placeholder="Comida / Cena"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
          </div>
          <div>
            <Field label="De" htmlFor="sstart">
              <Input
                id="sstart"
                type="time"
                value={draft.startTime}
                onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
              />
            </Field>
          </div>
          <div>
            <Field label="A (última entrada)" htmlFor="send">
              <Input
                id="send"
                type="time"
                value={draft.endTime}
                onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
              />
            </Field>
          </div>
          <div className="w-32">
            <Field label="Franja" htmlFor="sslot">
              <select
                id="sslot"
                value={draft.slotMinutes}
                onChange={(e) => setDraft({ ...draft, slotMinutes: Number(e.target.value) as 15 | 30 | 60 })}
                className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-2 text-sm"
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={60}>60 min</option>
              </select>
            </Field>
          </div>
          <div className="w-36">
            <Field label="Máx. pers./franja" htmlFor="scovers">
              <Input
                id="scovers"
                type="number"
                min={1}
                max={500}
                value={draft.maxCoversPerSlot}
                onChange={(e) => setDraft({ ...draft, maxCoversPerSlot: Number(e.target.value) })}
              />
            </Field>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-sm text-neutral-600">Días:</span>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDay(d)}
              className={
                draft.daysOfWeek.includes(d)
                  ? "rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white"
                  : "rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-600"
              }
            >
              {DAY_LABELS_ES[d]}
            </button>
          ))}
          <span className="text-xs text-neutral-400">(ninguno = todos)</span>
        </div>
        <Button type="submit">
          <Plus className="h-4 w-4" /> Añadir turno
        </Button>
      </form>
    </Card>
  );
}
