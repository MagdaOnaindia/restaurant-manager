"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";
import {
  CHECK_STATUS_LABELS_ES,
  formatCents,
  roleAtLeast,
  type CheckDetail,
  type MenuDetail,
} from "@rms/shared";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import { useOrg } from "@/components/org-provider";
import { Alert, Button, Card, Field, Input, Spinner } from "@/components/ui";
import { parseEurosToCents } from "@/lib/money";

export default function CheckEditorPage({ params }: { params: Promise<{ checkId: string }> }) {
  const { checkId } = use(params);
  const { activeOrg, activeRestaurant } = useOrg();
  const router = useRouter();
  const restaurantId = activeRestaurant?.id;
  const canCancel = activeOrg ? roleAtLeast(activeOrg.role, "MANAGER") : false;

  const [check, setCheck] = useState<CheckDetail | null>(null);
  const [menus, setMenus] = useState<MenuDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [freeLine, setFreeLine] = useState<{ name: string; price: string } | null>(null);
  const [cash, setCash] = useState<{ amount: string } | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const [c, m] = await Promise.all([
        apiGet<{ check: CheckDetail }>(`/restaurants/${restaurantId}/checks/${checkId}`),
        apiGet<{ menus: MenuDetail[] }>(`/restaurants/${restaurantId}/menus/active`),
      ]);
      setCheck(c.check);
      setMenus(m.menus);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la cuenta");
    }
  }, [restaurantId, checkId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Pagos en tiempo real: cualquier cambio (QR de comensales, efectivo…) refresca
  const publicToken = check?.publicToken;
  useEffect(() => {
    if (!publicToken) return;
    const es = new EventSource(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/pay/checks/${publicToken}/events`,
    );
    es.addEventListener("update", () => void load());
    return () => es.close();
  }, [publicToken, load]);

  if (error && !check) return <Alert>{error}</Alert>;
  if (!check || !menus) return <Spinner />;

  const editable = check.status === "OPEN" || check.status === "PARTIALLY_PAID";

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo completar la acción");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Carta para añadir */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/app/pos" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight">{check.tableName}</h1>
            <p className="text-sm text-neutral-500">{CHECK_STATUS_LABELS_ES[check.status]}</p>
          </div>
        </div>

        {error && <Alert>{error}</Alert>}

        {editable && menus.length === 0 && (
          <Card className="text-sm text-neutral-500">
            No hay ningún menú publicado y vigente ahora mismo. Publica una carta o añade líneas
            libres desde el panel de la derecha.
          </Card>
        )}

        {editable &&
          menus.map((menu) => (
            <Card key={menu.id}>
              <h2 className="mb-3 font-semibold text-brand-800">{menu.name}</h2>
              {menu.categories.map((cat) => (
                <div key={cat.id} className="mb-4 last:mb-0">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    {cat.name}
                  </h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {cat.items
                      .filter((i) => i.isAvailable)
                      .map((item) => (
                        <button
                          key={item.id}
                          onClick={() =>
                            act(() =>
                              apiPost(`/restaurants/${restaurantId}/checks/${checkId}/lines`, {
                                menuItemId: item.id,
                                quantity: 1,
                              }),
                            )
                          }
                          className="rounded-lg border border-neutral-200 bg-white p-2.5 text-left text-sm transition hover:border-brand-400 hover:shadow-sm"
                        >
                          <div className="font-medium leading-tight">{item.name}</div>
                          <div className="text-xs text-neutral-500">
                            {menu.type === "FIXED_PRICE" && item.priceCents === 0
                              ? "incluido"
                              : formatCents(item.priceCents)}
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </Card>
          ))}
      </div>

      {/* Cuenta */}
      <div className="space-y-4">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Cuenta</h2>
          {check.lines.length === 0 ? (
            <p className="text-sm text-neutral-400">Sin consumiciones todavía.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {check.lines.map((line) => (
                <li key={line.id} className="flex items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{line.name}</div>
                    <div className="text-xs text-neutral-500">
                      {formatCents(line.unitPriceCents)} × {line.quantity}
                      {line.paidUnits > 0 && (
                        <span className="ml-1 text-green-600">({line.paidUnits} pagadas)</span>
                      )}
                    </div>
                  </div>
                  {editable && (
                    <div className="flex items-center gap-1">
                      <button
                        disabled={line.quantity <= Math.max(1, line.paidUnits)}
                        onClick={() =>
                          act(() =>
                            apiPatch(
                              `/restaurants/${restaurantId}/checks/${checkId}/lines/${line.id}`,
                              { quantity: line.quantity - 1 },
                            ),
                          )
                        }
                        className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          act(() =>
                            apiPatch(
                              `/restaurants/${restaurantId}/checks/${checkId}/lines/${line.id}`,
                              { quantity: line.quantity + 1 },
                            ),
                          )
                        }
                        className="rounded p-1 text-neutral-400 hover:bg-neutral-100"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        disabled={line.paidUnits > 0}
                        onClick={() =>
                          act(() =>
                            apiDelete(
                              `/restaurants/${restaurantId}/checks/${checkId}/lines/${line.id}`,
                            ),
                          )
                        }
                        className="rounded p-1 text-neutral-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <div className="w-16 text-right text-sm font-semibold">
                    {formatCents(line.unitPriceCents * line.quantity)}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {check.payments.length > 0 && (
            <div className="mt-3 border-t border-neutral-200 pt-2">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Pagos recibidos
              </div>
              {check.payments.map((p) => (
                <div key={p.id} className="flex justify-between py-0.5 text-sm">
                  <span className="text-neutral-600">
                    {p.method === "CASH" ? "💶" : "💳"} {p.payerName || "Comensal"}
                    {p.tipCents > 0 && (
                      <span className="ml-1 text-xs text-emerald-600">
                        (+{formatCents(p.tipCents)} propina)
                      </span>
                    )}
                  </span>
                  <span className="font-medium text-green-700">{formatCents(p.amountCents)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 space-y-1 border-t border-neutral-200 pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Total</span>
              <span className="font-bold">{formatCents(check.totalCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Pagado</span>
              <span className="text-green-700">{formatCents(check.paidCents)}</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="font-medium">Pendiente</span>
              <span className="font-bold text-brand-700">{formatCents(check.remainingCents)}</span>
            </div>
          </div>
        </Card>

        {(check.status === "OPEN" || check.status === "PARTIALLY_PAID") &&
          check.remainingCents > 0 && (
            <Card>
              {cash ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const cents = parseEurosToCents(cash.amount);
                    if (cents === null || cents < 1) {
                      setError("Importe no válido");
                      return;
                    }
                    void act(async () => {
                      await apiPost(
                        `/restaurants/${restaurantId}/checks/${checkId}/cash-payment`,
                        { amountCents: cents },
                      );
                      setCash(null);
                    });
                  }}
                  className="space-y-3"
                >
                  <Field label={`Efectivo recibido (pendiente ${formatCents(check.remainingCents)})`} htmlFor="cashAmount">
                    <Input
                      id="cashAmount"
                      required
                      autoFocus
                      placeholder="0,00"
                      value={cash.amount}
                      onChange={(e) => setCash({ amount: e.target.value })}
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button type="submit">Registrar cobro</Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setCash({ amount: (check.remainingCents / 100).toFixed(2).replace(".", ",") })
                      }
                    >
                      Todo ({formatCents(check.remainingCents)})
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setCash(null)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <Button variant="secondary" className="w-full" onClick={() => setCash({ amount: "" })}>
                  💶 Cobrar en efectivo
                </Button>
              )}
            </Card>
          )}

        {editable && (
          <Card>
            {freeLine ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const cents = parseEurosToCents(freeLine.price);
                  if (cents === null) {
                    setError("Precio no válido");
                    return;
                  }
                  void act(async () => {
                    await apiPost(`/restaurants/${restaurantId}/checks/${checkId}/lines`, {
                      name: freeLine.name,
                      unitPriceCents: cents,
                      quantity: 1,
                    });
                    setFreeLine(null);
                  });
                }}
                className="space-y-3"
              >
                <Field label="Concepto" htmlFor="flname">
                  <Input
                    id="flname"
                    required
                    autoFocus
                    value={freeLine.name}
                    onChange={(e) => setFreeLine({ ...freeLine, name: e.target.value })}
                  />
                </Field>
                <Field label="Precio (€)" htmlFor="flprice">
                  <Input
                    id="flprice"
                    required
                    placeholder="0,00"
                    value={freeLine.price}
                    onChange={(e) => setFreeLine({ ...freeLine, price: e.target.value })}
                  />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit">Añadir</Button>
                  <Button type="button" variant="ghost" onClick={() => setFreeLine(null)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setFreeLine({ name: "", price: "" })}
              >
                <Plus className="h-4 w-4" /> Línea libre (fuera de carta)
              </Button>
            )}
          </Card>
        )}

        {check.status !== "CLOSED" && check.status !== "CANCELLED" && (
          <Card className="space-y-2">
            <Button
              className="w-full"
              variant={check.remainingCents === 0 ? "primary" : "secondary"}
              onClick={() =>
                act(async () => {
                  if (
                    check.remainingCents > 0 &&
                    !confirm(
                      `Quedan ${formatCents(check.remainingCents)} sin pagar. ¿Cerrar igualmente?`,
                    )
                  ) {
                    return;
                  }
                  await apiPost(`/restaurants/${restaurantId}/checks/${checkId}/close`);
                  router.push("/app/pos");
                })
              }
            >
              Cerrar cuenta
            </Button>
            {canCancel && check.paidCents === 0 && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() =>
                  act(async () => {
                    if (!confirm("¿Cancelar la cuenta? Se descartan las consumiciones.")) return;
                    await apiPost(`/restaurants/${restaurantId}/checks/${checkId}/cancel`);
                    router.push("/app/pos");
                  })
                }
              >
                Cancelar cuenta
              </Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
