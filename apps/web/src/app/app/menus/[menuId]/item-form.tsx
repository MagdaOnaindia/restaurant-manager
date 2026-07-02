"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { ALLERGENS, ALLERGEN_LABELS_ES, type MenuItemInfo } from "@rms/shared";
import { ApiError } from "@/lib/api";
import { centsToEurosInput, parseEurosToCents } from "@/lib/money";
import { Alert, Button, Field, Input } from "@/components/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface ItemFormValues {
  name: string;
  description?: string;
  priceCents: number;
  allergens: string[];
  tags: string[];
  isAvailable: boolean;
  photoUrl?: string | null;
}

export function ItemForm({
  restaurantId,
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  restaurantId: string;
  initial?: MenuItemInfo;
  onSubmit: (values: ItemFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial ? centsToEurosInput(initial.priceCents) : "");
  const [allergens, setAllergens] = useState<string[]>(initial?.allergens ?? []);
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [isAvailable, setIsAvailable] = useState(initial?.isAvailable ?? true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(initial?.photoUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function toggleAllergen(a: string) {
    setAllergens((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch(`${API_URL}/restaurants/${restaurantId}/uploads`, {
        method: "POST",
        credentials: "include",
        body: data,
      });
      if (!res.ok) throw new Error("upload");
      const { url } = (await res.json()) as { url: string };
      setPhotoUrl(url);
    } catch {
      setError("No se pudo subir la foto");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const priceCents = parseEurosToCents(price || "0");
    if (priceCents === null) {
      setError("Precio no válido (p. ej. 12,50)");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        name,
        description: description.trim() || undefined,
        priceCents,
        allergens,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10),
        isAvailable,
        photoUrl,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el plato");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg bg-neutral-50 p-4">
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap gap-3">
        <div className="min-w-52 flex-1">
          <Field label="Nombre del plato" htmlFor="iname">
            <Input id="iname" required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <div className="w-32">
          <Field label="Precio (€)" htmlFor="iprice">
            <Input id="iprice" placeholder="0,00" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        </div>
      </div>
      <Field label="Descripción (opcional)" htmlFor="idesc">
        <Input id="idesc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div>
        <span className="mb-1 block text-sm font-medium text-neutral-700">Alérgenos (UE)</span>
        <div className="flex flex-wrap gap-1.5">
          {ALLERGENS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => toggleAllergen(a)}
              className={
                allergens.includes(a)
                  ? "rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-600 hover:border-brand-400"
              }
            >
              {ALLERGEN_LABELS_ES[a]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1">
          <Field label="Etiquetas (separadas por comas)" htmlFor="itags">
            <Input
              id="itags"
              placeholder="vegano, picante, de temporada"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(e) => setIsAvailable(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          Disponible
        </label>
      </div>

      <div className="flex items-center gap-3">
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadPhoto(f);
          }}
        />
        <Button type="button" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
          <ImagePlus className="h-4 w-4" /> {photoUrl ? "Cambiar foto" : "Subir foto"}
        </Button>
        {photoUrl && (
          <Button type="button" variant="ghost" onClick={() => setPhotoUrl(null)}>
            Quitar foto
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
