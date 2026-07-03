"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import {
  CHECK_STATUS_LABELS_ES,
  formatCents,
  type CheckHistoryEntry,
} from "@rms/shared";
import { apiGet } from "@/lib/api";
import { useOrg } from "@/components/org-provider";
import { Alert, Button, Card, Spinner } from "@/components/ui";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA");
}

export default function HistoryPage() {
  const { activeRestaurant } = useOrg();
  const restaurantId = activeRestaurant?.id;
  const [from, setFrom] = useState(daysAgo(7));
  const [to, setTo] = useState(daysAgo(0));
  const [entries, setEntries] = useState<CheckHistoryEntry[] | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const { checks } = await apiGet<{ checks: CheckHistoryEntry[] }>(
      `/restaurants/${restaurantId}/checks-history?from=${from}&to=${to}`,
    );
    setEntries(checks);
  }, [restaurantId, from, to]);

  useEffect(() => {
    setEntries(null);
    void load();
  }, [load]);

  function exportCsv() {
    if (!entries) return;
    const header = "fecha;mesa;estado;total_eur;pagado_eur;propinas_eur;num_pagos";
    const rows = entries.map((e) =>
      [
        new Date(e.createdAt).toLocaleString("es-ES"),
        e.tableName,
        CHECK_STATUS_LABELS_ES[e.status],
        (e.totalCents / 100).toFixed(2).replace(".", ","),
        (e.paidCents / 100).toFixed(2).replace(".", ","),
        (e.tipCents / 100).toFixed(2).replace(".", ","),
        e.paymentCount,
      ].join(";"),
    );
    const blob = new Blob(["﻿" + [header, ...rows].join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cuentas_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!activeRestaurant) {
    return <Alert variant="info">Crea primero un restaurante.</Alert>;
  }

  const totals = (entries ?? []).reduce(
    (acc, e) => ({
      paid: acc.paid + e.paidCents,
      tips: acc.tips + e.tipCents,
    }),
    { paid: 0, tips: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Historial de cuentas · {activeRestaurant.name}</h1>
          {entries && (
            <p className="text-sm text-neutral-500">
              {entries.length} cuentas · cobrado {formatCents(totals.paid)} · propinas{" "}
              {formatCents(totals.tips)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-neutral-500">Desde</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-neutral-500">Hasta</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </label>
          <Button variant="secondary" onClick={exportCsv} disabled={!entries?.length}>
            <Download className="h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      {!entries ? (
        <Spinner />
      ) : entries.length === 0 ? (
        <Card className="text-center text-neutral-500">Sin cuentas en este periodo.</Card>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-400">
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Mesa</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3 text-right">Total</th>
                <th className="py-2 pr-3 text-right">Pagado</th>
                <th className="py-2 pr-3 text-right">Propinas</th>
                <th className="py-2 text-right">Pagos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="py-2.5 pr-3 text-neutral-600">
                    {new Date(e.createdAt).toLocaleString("es-ES", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2.5 pr-3 font-medium">{e.tableName}</td>
                  <td className="py-2.5 pr-3">{CHECK_STATUS_LABELS_ES[e.status]}</td>
                  <td className="py-2.5 pr-3 text-right">{formatCents(e.totalCents)}</td>
                  <td className="py-2.5 pr-3 text-right text-green-700">
                    {formatCents(e.paidCents)}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-neutral-600">
                    {e.tipCents > 0 ? formatCents(e.tipCents) : "—"}
                  </td>
                  <td className="py-2.5 text-right">{e.paymentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
