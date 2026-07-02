"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Trash2 } from "lucide-react";
import {
  INVITABLE_ROLES,
  ORG_ROLE_LABELS_ES,
  type InvitationInfo,
  type MemberInfo,
  type OrgRole,
} from "@rms/shared";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useOrg } from "@/components/org-provider";
import { Alert, Button, Card, Field, Input, Spinner } from "@/components/ui";

export default function TeamPage() {
  const { user } = useAuth();
  const { activeOrg } = useOrg();
  const [members, setMembers] = useState<MemberInfo[] | null>(null);
  const [invitations, setInvitations] = useState<InvitationInfo[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("STAFF");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  const orgId = activeOrg?.id;

  const load = useCallback(async () => {
    if (!orgId) return;
    const [m, i] = await Promise.all([
      apiGet<{ members: MemberInfo[] }>(`/orgs/${orgId}/members`),
      apiGet<{ invitations: InvitationInfo[] }>(`/orgs/${orgId}/invitations`),
    ]);
    setMembers(m.members);
    setInvitations(i.invitations);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSending(true);
    try {
      await apiPost(`/orgs/${orgId}/invitations`, { email: inviteEmail, role: inviteRole });
      setInviteEmail("");
      setMessage({ ok: true, text: "Invitación enviada por email" });
      await load();
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof ApiError ? err.message : "No se pudo enviar la invitación",
      });
    } finally {
      setSending(false);
    }
  }

  async function changeRole(membershipId: string, role: string) {
    setMessage(null);
    try {
      await apiPatch(`/orgs/${orgId}/members/${membershipId}`, { role });
      await load();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : "No se pudo cambiar" });
    }
  }

  async function removeMember(membershipId: string) {
    if (!confirm("¿Quitar a esta persona del equipo?")) return;
    try {
      await apiDelete(`/orgs/${orgId}/members/${membershipId}`);
      await load();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : "No se pudo quitar" });
    }
  }

  async function revokeInvitation(id: string) {
    await apiDelete(`/orgs/${orgId}/invitations/${id}`);
    await load();
  }

  if (!members) return <Spinner />;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Equipo</h1>
      {message && <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert>}

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Invitar a una persona</h2>
        <form onSubmit={invite} className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <Field label="Email" htmlFor="invEmail">
              <Input
                id="invEmail"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </Field>
          </div>
          <div>
            <Field label="Rol" htmlFor="invRole">
              <select
                id="invRole"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
              >
                {INVITABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ORG_ROLE_LABELS_ES[r]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button type="submit" loading={sending}>
            <Mail className="h-4 w-4" /> Invitar
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Miembros ({members.length})</h2>
        <ul className="divide-y divide-neutral-100">
          {members.map((m) => (
            <li key={m.membershipId} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="font-medium">
                  {m.name}
                  {m.userId === user?.id && <span className="ml-2 text-xs text-neutral-400">(tú)</span>}
                </div>
                <div className="truncate text-sm text-neutral-500">{m.email}</div>
              </div>
              <div className="flex items-center gap-2">
                {m.role === "OWNER" || m.userId === user?.id ? (
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm">
                    {ORG_ROLE_LABELS_ES[m.role]}
                  </span>
                ) : (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m.membershipId, e.target.value)}
                      className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm"
                    >
                      {INVITABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ORG_ROLE_LABELS_ES[r]}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeMember(m.membershipId)}
                      className="rounded-lg p-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                      title="Quitar del equipo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Invitaciones pendientes</h2>
          <ul className="divide-y divide-neutral-100">
            {invitations.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <div className="font-medium">{i.email}</div>
                  <div className="text-sm text-neutral-500">
                    {ORG_ROLE_LABELS_ES[i.role]} · caduca{" "}
                    {new Date(i.expiresAt).toLocaleDateString("es-ES")}
                  </div>
                </div>
                <Button variant="secondary" onClick={() => revokeInvitation(i.id)}>
                  Revocar
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
