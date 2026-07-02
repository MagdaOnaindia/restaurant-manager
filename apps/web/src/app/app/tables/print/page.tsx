"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import type { ZoneWithTables } from "@rms/shared";
import { apiGet } from "@/lib/api";
import { useOrg } from "@/components/org-provider";
import { Button, Spinner } from "@/components/ui";

const PAY_URL = process.env.NEXT_PUBLIC_PAY_URL ?? "http://localhost:3001";

interface QrCard {
  zoneName: string;
  tableName: string;
  dataUrl: string;
}

export default function PrintQrPage() {
  const { activeRestaurant } = useOrg();
  const [cards, setCards] = useState<QrCard[] | null>(null);

  useEffect(() => {
    if (!activeRestaurant) return;
    (async () => {
      const { zones } = await apiGet<{ zones: ZoneWithTables[] }>(
        `/restaurants/${activeRestaurant.id}/zones`,
      );
      const all: QrCard[] = [];
      for (const zone of zones) {
        for (const table of zone.tables) {
          const dataUrl = await QRCode.toDataURL(`${PAY_URL}/t/${table.qrCode}`, {
            width: 480,
            margin: 1,
            errorCorrectionLevel: "M",
          });
          all.push({ zoneName: zone.name, tableName: table.name, dataUrl });
        }
      }
      setCards(all);
    })();
  }, [activeRestaurant]);

  if (!cards) return <Spinner />;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-bold">Códigos QR · {activeRestaurant?.name}</h1>
          <p className="text-sm text-neutral-500">
            Imprime esta hoja, recorta cada tarjeta y colócala en su mesa.
          </p>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Imprimir
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map((card, i) => (
          <div
            key={i}
            className="flex flex-col items-center rounded-xl border-2 border-dashed border-neutral-300 p-4 text-center"
            style={{ breakInside: "avoid" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.dataUrl} alt={`QR ${card.tableName}`} className="w-full max-w-44" />
            <div className="mt-2 text-lg font-bold">{card.tableName}</div>
            <div className="text-sm text-neutral-500">{card.zoneName}</div>
            <div className="mt-1 text-xs text-neutral-400">Escanea para ver la cuenta y pagar</div>
          </div>
        ))}
      </div>
    </div>
  );
}
