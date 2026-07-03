"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatCents,
  shareAmount,
  type CreatedIntentView,
  type PayCheckView,
  type SplitMode,
} from "@rms/shared";
import { API_URL, apiGet, apiPost, getSessionId, ApiError } from "@/lib/api";
import { StripePaymentForm } from "./stripe-form";

type Step =
  | { name: "summary" }
  | { name: "mode" }
  | { name: "items" }
  | { name: "shares" }
  | { name: "amount" }
  | { name: "confirm"; mode: SplitMode; baseCents: number }
  | { name: "paying"; intent: CreatedIntentView }
  | { name: "done"; paidCents: number };

const TIP_OPTIONS = [0, 5, 10, 15];

export default function DinerCheckPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [view, setView] = useState<PayCheckView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ name: "summary" });
  const [sessionId, setSessionId] = useState("");

  // Selecciones
  const [itemUnits, setItemUnits] = useState<Record<string, number>>({});
  const [shares, setShares] = useState({ total: 2, pay: 1 });
  const [amountInput, setAmountInput] = useState("");
  const [tipPct, setTipPct] = useState(0);
  const [payerName, setPayerName] = useState("");
  const [receiptEmail, setReceiptEmail] = useState("");
  const [working, setWorking] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  const reload = useCallback(async () => {
    if (!sessionId) return;
    try {
      const v = await apiGet<PayCheckView>(`/pay/checks/${token}?sessionId=${sessionId}`);
      setView(v);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la cuenta");
    }
  }, [token, sessionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Tiempo real: cualquier cambio en la cuenta refresca la vista
  useEffect(() => {
    if (!sessionId) return;
    const es = new EventSource(`${API_URL}/pay/checks/${token}/events`);
    es.addEventListener("update", () => void reload());
    esRef.current = es;
    return () => es.close();
  }, [token, sessionId, reload]);

  const payable = view && (view.status === "OPEN" || view.status === "PARTIALLY_PAID");

  const itemsSelectedCents = useMemo(() => {
    if (!view) return 0;
    return view.lines.reduce(
      (acc, l) => acc + (itemUnits[l.id] ?? 0) * l.unitPriceCents,
      0,
    );
  }, [view, itemUnits]);

  if (error && !view) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <p className="text-neutral-600">{error}</p>
      </main>
    );
  }
  if (!view) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-4xl">🧾</div>
      </main>
    );
  }

  const tipCents = (base: number) => Math.round((base * tipPct) / 100);

  async function startIntent(mode: SplitMode, baseCents: number) {
    setWorking(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        sessionId,
        mode,
        tipCents: tipCents(baseCents),
        payerName: payerName || undefined,
        receiptEmail: receiptEmail || undefined,
      };
      if (mode === "SHARES") body.shares = shares;
      if (mode === "AMOUNT") body.amountCents = baseCents;
      const intent = await apiPost<CreatedIntentView>(`/pay/checks/${token}/intents`, body);
      setStep({ name: "paying", intent });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar el pago");
      await reload();
      setStep({ name: "mode" });
    } finally {
      setWorking(false);
    }
  }

  async function claimAndContinue() {
    setWorking(true);
    setError(null);
    try {
      const lines = Object.entries(itemUnits)
        .filter(([, units]) => units > 0)
        .map(([lineId, units]) => ({ lineId, units }));
      const { amountCents } = await apiPost<{ amountCents: number }>(
        `/pay/checks/${token}/claims`,
        { sessionId, lines },
      );
      setStep({ name: "confirm", mode: "ITEMS", baseCents: amountCents });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo reservar tu selección");
      await reload();
    } finally {
      setWorking(false);
    }
  }

  async function demoConfirm(intent: CreatedIntentView) {
    setWorking(true);
    try {
      await apiPost(`/pay/checks/${token}/intents/${intent.paymentId}/dev-confirm`);
      setStep({ name: "done", paidCents: intent.amountCents + intent.tipCents });
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo confirmar");
    } finally {
      setWorking(false);
    }
  }

  const remaining = view.remainingCents;

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-24 pt-6">
      {/* Cabecera */}
      <header className="mb-4 text-center">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">{view.restaurantName}</h1>
        <p className="text-sm text-neutral-500">{view.tableName}</p>
      </header>

      {/* Estado global */}
      <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-neutral-500">Total de la mesa</span>
          <span className="text-lg font-bold">{formatCents(view.totalCents, view.currency)}</span>
        </div>
        {view.paidCents > 0 && (
          <div className="flex items-baseline justify-between text-emerald-700">
            <span className="text-sm">Ya pagado</span>
            <span className="font-semibold">{formatCents(view.paidCents, view.currency)}</span>
          </div>
        )}
        <div className="mt-1 flex items-baseline justify-between border-t border-dashed border-neutral-200 pt-2">
          <span className="text-sm font-medium">Queda por pagar</span>
          <span className="text-xl font-bold text-brand-700">
            {formatCents(remaining, view.currency)}
          </span>
        </div>
      </div>

      {/* Cuenta */}
      <section className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          La cuenta
        </h2>
        <ul className="divide-y divide-neutral-100">
          {view.lines.map((line) => (
            <li key={line.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span className={line.paidUnits >= line.quantity ? "text-neutral-400 line-through" : ""}>
                  {line.quantity} × {line.name}
                </span>
                {line.paidUnits > 0 && line.paidUnits < line.quantity && (
                  <span className="ml-1.5 text-xs text-emerald-600">
                    ({line.paidUnits} pagadas)
                  </span>
                )}
              </div>
              <span className="font-medium">
                {formatCents(line.unitPriceCents * line.quantity, view.currency)}
              </span>
            </li>
          ))}
        </ul>
        {view.payments.length > 0 && (
          <div className="mt-3 border-t border-neutral-100 pt-2 text-xs text-neutral-500">
            {view.payments.map((p) => (
              <div key={p.id} className="flex justify-between py-0.5">
                <span>✅ {p.payerName || "Alguien"} pagó</span>
                <span>{formatCents(p.amountCents, view.currency)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* Pasos */}
      {view.status === "PAID" || view.status === "CLOSED" ? (
        <div className="rounded-2xl bg-emerald-50 p-6 text-center">
          <div className="text-4xl">🎉</div>
          <h2 className="mt-2 text-lg font-bold text-emerald-800">Cuenta pagada</h2>
          <p className="text-sm text-emerald-700">¡Gracias por la visita!</p>
        </div>
      ) : !payable ? (
        <p className="text-center text-sm text-neutral-500">La cuenta no admite pagos.</p>
      ) : step.name === "summary" || step.name === "mode" ? (
        <section className="space-y-2">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            ¿Cuánto quieres pagar?
          </h2>
          <button
            onClick={() => setStep({ name: "confirm", mode: "REMAINING", baseCents: remaining })}
            className="w-full rounded-xl border-2 border-neutral-200 bg-white p-4 text-left transition hover:border-brand-400"
          >
            <div className="font-semibold">Todo lo que queda</div>
            <div className="text-sm text-neutral-500">{formatCents(remaining, view.currency)}</div>
          </button>
          <button
            onClick={() => setStep({ name: "shares" })}
            className="w-full rounded-xl border-2 border-neutral-200 bg-white p-4 text-left transition hover:border-brand-400"
          >
            <div className="font-semibold">A partes iguales</div>
            <div className="text-sm text-neutral-500">Divide lo pendiente entre los que sois</div>
          </button>
          <button
            onClick={() => {
              setItemUnits({});
              setStep({ name: "items" });
            }}
            className="w-full rounded-xl border-2 border-neutral-200 bg-white p-4 text-left transition hover:border-brand-400"
          >
            <div className="font-semibold">Solo mis platos</div>
            <div className="text-sm text-neutral-500">Elige lo que has tomado tú</div>
          </button>
          <button
            onClick={() => setStep({ name: "amount" })}
            className="w-full rounded-xl border-2 border-neutral-200 bg-white p-4 text-left transition hover:border-brand-400"
          >
            <div className="font-semibold">Otro importe</div>
            <div className="text-sm text-neutral-500">Tú decides cuánto</div>
          </button>
        </section>
      ) : step.name === "items" ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Marca tus consumiciones
          </h2>
          <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white px-4">
            {view.lines.map((line) => {
              const max = line.availableUnits + line.myClaimedUnits;
              const mine = itemUnits[line.id] ?? 0;
              if (max === 0 && mine === 0) return null;
              return (
                <li key={line.id} className="flex items-center justify-between gap-2 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{line.name}</div>
                    <div className="text-xs text-neutral-500">
                      {formatCents(line.unitPriceCents, view.currency)} · quedan {max}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={mine <= 0}
                      onClick={() => setItemUnits({ ...itemUnits, [line.id]: mine - 1 })}
                      className="h-9 w-9 rounded-full border border-neutral-300 text-lg font-bold disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-5 text-center font-semibold">{mine}</span>
                    <button
                      disabled={mine >= max}
                      onClick={() => setItemUnits({ ...itemUnits, [line.id]: mine + 1 })}
                      className="h-9 w-9 rounded-full border border-neutral-300 text-lg font-bold disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <button
            disabled={itemsSelectedCents === 0 || working}
            onClick={claimAndContinue}
            className="w-full rounded-xl bg-brand-600 py-3.5 font-semibold text-white disabled:opacity-50"
          >
            Continuar · {formatCents(itemsSelectedCents, view.currency)}
          </button>
          <button onClick={() => setStep({ name: "mode" })} className="w-full py-1 text-sm text-neutral-500">
            Volver
          </button>
        </section>
      ) : step.name === "shares" ? (
        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">¿Cuántos sois?</span>
            <Stepper
              value={shares.total}
              min={2}
              max={20}
              onChange={(total) => setShares({ total, pay: Math.min(shares.pay, total) })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">¿Cuántas partes pagas?</span>
            <Stepper
              value={shares.pay}
              min={1}
              max={shares.total}
              onChange={(pay) => setShares({ ...shares, pay })}
            />
          </div>
          <button
            onClick={() =>
              setStep({
                name: "confirm",
                mode: "SHARES",
                baseCents: shareAmount(remaining, shares.total, shares.pay),
              })
            }
            className="w-full rounded-xl bg-brand-600 py-3.5 font-semibold text-white"
          >
            Continuar · {formatCents(shareAmount(remaining, shares.total, shares.pay), view.currency)}
          </button>
          <button onClick={() => setStep({ name: "mode" })} className="w-full py-1 text-sm text-neutral-500">
            Volver
          </button>
        </section>
      ) : step.name === "amount" ? (
        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Importe (€)</span>
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-lg"
            />
          </label>
          <p className="text-xs text-neutral-500">
            Máximo {formatCents(remaining, view.currency)} · mínimo 0,50 €
          </p>
          <button
            onClick={() => {
              const normalized = amountInput.trim().replace(",", ".");
              const cents = Math.round(parseFloat(normalized) * 100);
              if (!Number.isFinite(cents) || cents < 50 || cents > remaining) {
                setError("Importe no válido");
                return;
              }
              setError(null);
              setStep({ name: "confirm", mode: "AMOUNT", baseCents: cents });
            }}
            className="w-full rounded-xl bg-brand-600 py-3.5 font-semibold text-white"
          >
            Continuar
          </button>
          <button onClick={() => setStep({ name: "mode" })} className="w-full py-1 text-sm text-neutral-500">
            Volver
          </button>
        </section>
      ) : step.name === "confirm" ? (
        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="text-center">
            <div className="text-sm text-neutral-500">Tu parte</div>
            <div className="text-3xl font-bold">{formatCents(step.baseCents, view.currency)}</div>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium">¿Dejas propina?</span>
            <div className="grid grid-cols-4 gap-2">
              {TIP_OPTIONS.map((pct) => (
                <button
                  key={pct}
                  onClick={() => setTipPct(pct)}
                  className={
                    tipPct === pct
                      ? "rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white"
                      : "rounded-xl border border-neutral-300 py-2 text-sm"
                  }
                >
                  {pct === 0 ? "No" : `${pct}%`}
                </button>
              ))}
            </div>
            {tipPct > 0 && (
              <p className="mt-1 text-xs text-neutral-500">
                Propina: {formatCents(tipCents(step.baseCents), view.currency)} (íntegra para el
                restaurante)
              </p>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">Tu nombre (opcional)</span>
            <input
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              placeholder="Para que tus amigos vean que has pagado"
              className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Email para el recibo (opcional)</span>
            <input
              type="email"
              value={receiptEmail}
              onChange={(e) => setReceiptEmail(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm"
            />
          </label>

          <button
            disabled={working}
            onClick={() => void startIntent(step.mode, step.baseCents)}
            className="w-full rounded-xl bg-emerald-600 py-3.5 text-base font-semibold text-white disabled:opacity-60"
          >
            {working
              ? "Preparando…"
              : `Pagar ${formatCents(step.baseCents + tipCents(step.baseCents), view.currency)}`}
          </button>
          <button onClick={() => setStep({ name: "mode" })} className="w-full py-1 text-sm text-neutral-500">
            Volver
          </button>
        </section>
      ) : step.name === "paying" ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 text-center">
            <div className="text-sm text-neutral-500">Total a pagar</div>
            <div className="text-2xl font-bold">
              {formatCents(step.intent.amountCents + step.intent.tipCents, view.currency)}
            </div>
          </div>
          {step.intent.demoMode || !view.stripePublishableKey ? (
            <div className="space-y-3">
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                Modo demostración: la pasarela de pago aún no está conectada. Este botón simula un
                pago con éxito.
              </p>
              <button
                disabled={working}
                onClick={() => void demoConfirm(step.intent)}
                className="w-full rounded-xl bg-emerald-600 py-3.5 font-semibold text-white disabled:opacity-60"
              >
                Confirmar pago (demo)
              </button>
              <button onClick={() => setStep({ name: "mode" })} className="w-full py-1 text-sm text-neutral-500">
                Volver
              </button>
            </div>
          ) : (
            <StripePaymentForm
              publishableKey={view.stripePublishableKey}
              clientSecret={step.intent.clientSecret}
              returnUrl={`${window.location.origin}/c/${token}/resultado`}
              onCancel={() => setStep({ name: "mode" })}
            />
          )}
        </section>
      ) : step.name === "done" ? (
        <section className="rounded-2xl bg-emerald-50 p-6 text-center">
          <div className="text-4xl">✅</div>
          <h2 className="mt-2 text-lg font-bold text-emerald-800">
            Has pagado {formatCents(step.paidCents, view.currency)}
          </h2>
          <p className="text-sm text-emerald-700">
            {view.remainingCents > 0
              ? `Quedan ${formatCents(view.remainingCents, view.currency)} en la mesa.`
              : "La cuenta está completa. ¡Hasta pronto!"}
          </p>
        </section>
      ) : null}

      <footer className="mt-10 flex items-center justify-center gap-1.5 text-xs text-neutral-400">
        <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
          <rect x="1" y="1" width="46" height="46" rx="12" fill="#c25620" />
          <path d="M23 25 L36 25 A13 13 0 0 1 23 38 Z" fill="#fff7ed" transform="translate(1.2 1.2)" />
          <path d="M23 25 L23 38 A13 13 0 0 1 10 25 Z" fill="#fff7ed" transform="translate(-1.2 1.2)" />
          <path d="M23 25 L10 25 A13 13 0 0 1 23 12 Z" fill="#fff7ed" transform="translate(-1.2 -1.2)" />
          <path d="M23 25 L23 12 A13 13 0 0 1 36 25 Z" fill="#ffd9a8" transform="translate(3.6 -3.6)" />
        </svg>
        Pago seguro con Restaurant Manager
      </footer>
    </main>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="h-9 w-9 rounded-full border border-neutral-300 text-lg font-bold disabled:opacity-30"
      >
        −
      </button>
      <span className="w-6 text-center text-lg font-semibold">{value}</span>
      <button
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="h-9 w-9 rounded-full border border-neutral-300 text-lg font-bold disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
