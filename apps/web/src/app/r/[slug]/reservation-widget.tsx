"use client";

import { useEffect, useState } from "react";
import type { AvailabilitySlot } from "@rms/shared";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { Alert, Button, Field, Input } from "@/components/ui";

function todayStr(): string {
  return new Date().toLocaleDateString("en-CA");
}

export function ReservationWidget({
  slug,
  restaurantName,
}: {
  slug: string;
  restaurantName: string;
}) {
  const [date, setDate] = useState(todayStr());
  const [partySize, setPartySize] = useState(2);
  const [slots, setSlots] = useState<AvailabilitySlot[] | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [form, setForm] = useState({ customerName: "", customerPhone: "", customerEmail: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSlots(null);
    setTime(null);
    apiGet<{ slots: AvailabilitySlot[] }>(
      `/public/restaurants/${slug}/availability?date=${date}&partySize=${partySize}`,
    )
      .then((r) => setSlots(r.slots))
      .catch(() => setSlots([]));
  }, [slug, date, partySize]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!time) return;
    setError(null);
    setSaving(true);
    try {
      await apiPost(`/public/restaurants/${slug}/reservations`, {
        date,
        time,
        partySize,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail || undefined,
        notes: form.notes || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo completar la reserva");
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-neutral-200/70 border-t-4 border-t-brand-600 bg-white p-6 text-center shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
        <div className="text-4xl">🎉</div>
        <h3 className="mt-2 font-serif text-xl font-semibold">¡Reserva confirmada!</h3>
        <p className="mt-1 text-sm text-neutral-600">
          Te esperamos en {restaurantName} el {date} a las {time} ({partySize} pers.).
          {form.customerEmail && " Te hemos enviado la confirmación por email."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200/70 border-t-4 border-t-brand-600 bg-white p-6 shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
      <h3 className="mb-1 font-serif text-2xl font-semibold tracking-tight">Reserva tu mesa</h3>
      <p className="mb-4 text-sm text-neutral-500">Confirmación al momento, sin llamadas.</p>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div className="flex gap-3">
          <div className="flex-1">
            <Field label="Día" htmlFor="wdate">
              <Input
                id="wdate"
                type="date"
                min={todayStr()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>
          <div className="w-28">
            <Field label="Personas" htmlFor="wsize">
              <Input
                id="wsize"
                type="number"
                min={1}
                max={20}
                value={partySize}
                onChange={(e) => setPartySize(Math.max(1, Number(e.target.value)))}
              />
            </Field>
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-neutral-700">Hora</span>
          {slots === null ? (
            <p className="text-sm text-neutral-400">Buscando huecos…</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No hay reservas online para este día. Prueba otra fecha
              {` o llámanos.`}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {slots.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  disabled={!s.available}
                  onClick={() => setTime(s.time)}
                  className={
                    time === s.time
                      ? "rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
                      : s.available
                        ? "rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:border-brand-400"
                        : "cursor-not-allowed rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-1.5 text-sm text-neutral-400 line-through"
                  }
                >
                  {s.time}
                </button>
              ))}
            </div>
          )}
        </div>

        {time && (
          <>
            <Field label="Tu nombre" htmlFor="wname">
              <Input
                id="wname"
                required
                minLength={2}
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              />
            </Field>
            <Field label="Teléfono" htmlFor="wphone">
              <Input
                id="wphone"
                required
                minLength={6}
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
              />
            </Field>
            <Field label="Email (para la confirmación)" htmlFor="wemail">
              <Input
                id="wemail"
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
              />
            </Field>
            <Field label="Notas (opcional)" htmlFor="wnotes">
              <Input
                id="wnotes"
                placeholder="Alergias, trona, terraza…"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <Button type="submit" loading={saving} className="w-full">
              Reservar a las {time}
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
