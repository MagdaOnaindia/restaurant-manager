"use client";

import { useState } from "react";
import type { AuthUser } from "@rms/shared";
import { apiPatch, apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

export default function AccountPage() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingName, setSavingName] = useState(false);

  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [passMsg, setPassMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPass, setSavingPass] = useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameMsg(null);
    setSavingName(true);
    try {
      const { user: updated } = await apiPatch<{ user: AuthUser }>("/auth/me", { name });
      setUser(updated);
      setNameMsg({ ok: true, text: "Nombre actualizado" });
    } catch (err) {
      setNameMsg({
        ok: false,
        text: err instanceof ApiError ? err.message : "No se pudo guardar",
      });
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPassMsg(null);
    if (passwords.newPassword !== passwords.confirm) {
      setPassMsg({ ok: false, text: "Las contraseñas nuevas no coinciden" });
      return;
    }
    setSavingPass(true);
    try {
      await apiPost("/auth/change-password", {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: "", newPassword: "", confirm: "" });
      setPassMsg({ ok: true, text: "Contraseña actualizada" });
    } catch (err) {
      setPassMsg({
        ok: false,
        text: err instanceof ApiError ? err.message : "No se pudo cambiar la contraseña",
      });
    } finally {
      setSavingPass(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Mi cuenta</h1>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Perfil</h2>
        <form onSubmit={saveName} className="space-y-4">
          {nameMsg && <Alert variant={nameMsg.ok ? "success" : "error"}>{nameMsg.text}</Alert>}
          <Field label="Email">
            <Input value={user?.email ?? ""} disabled />
          </Field>
          <Field label="Nombre" htmlFor="name">
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="submit" loading={savingName}>
            Guardar
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Cambiar contraseña</h2>
        <form onSubmit={savePassword} className="space-y-4">
          {passMsg && <Alert variant={passMsg.ok ? "success" : "error"}>{passMsg.text}</Alert>}
          <Field label="Contraseña actual" htmlFor="current">
            <Input
              id="current"
              type="password"
              autoComplete="current-password"
              required
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
            />
          </Field>
          <Field label="Contraseña nueva" htmlFor="new">
            <Input
              id="new"
              type="password"
              autoComplete="new-password"
              required
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
            />
          </Field>
          <Field label="Repite la contraseña nueva" htmlFor="confirm">
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
            />
          </Field>
          <Button type="submit" loading={savingPass}>
            Cambiar contraseña
          </Button>
        </form>
      </Card>
    </div>
  );
}
