"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { roleAtLeast } from "@rms/shared";
import { useAuth } from "@/components/auth-provider";
import { OrgProvider, useOrg } from "@/components/org-provider";
import { Logo } from "@/components/logo";
import {
  IconAccount,
  IconHistory,
  IconHome,
  IconLogout,
  IconMenus,
  IconPayments,
  IconPos,
  IconReservations,
  IconStorefront,
  IconTables,
  IconTeam,
} from "@/components/icons";
import { Spinner } from "@/components/ui";

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[0.92rem] font-medium transition",
        active ? "bg-brand-50 text-brand-900" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800",
      )}
    >
      <span
        className={clsx(
          "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand-600 transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <Icon className={clsx("h-[1.15rem] w-[1.15rem]", active ? "text-brand-700" : "text-neutral-400 group-hover:text-neutral-600")} />
      {label}
    </Link>
  );
}

function Sidebar() {
  const { user, logout } = useAuth();
  const { organizations, activeOrg, activeRestaurant, setActiveOrgId, setActiveRestaurantId } =
    useOrg();
  const router = useRouter();
  const pathname = usePathname();

  const role = activeOrg?.role ?? "STAFF";
  const isActive = (href: string) =>
    pathname === href || (href !== "/app" && pathname.startsWith(href));

  const groups: Array<{ label: string; items: Array<{ href: string; label: string; icon: typeof IconHome; show?: boolean }> }> = [
    {
      label: "Operativa",
      items: [
        { href: "/app", label: "Inicio", icon: IconHome },
        { href: "/app/pos", label: "Comandero", icon: IconPos },
        { href: "/app/reservations", label: "Reservas", icon: IconReservations },
      ],
    },
    {
      label: "Carta y sala",
      items: [
        { href: "/app/menus", label: "Cartas", icon: IconMenus },
        { href: "/app/tables", label: "Mesas", icon: IconTables },
        { href: "/app/settings", label: "Mi página", icon: IconStorefront, show: roleAtLeast(role, "MANAGER") },
      ],
    },
    {
      label: "Negocio",
      items: [
        { href: "/app/history", label: "Historial", icon: IconHistory, show: roleAtLeast(role, "MANAGER") },
        { href: "/app/payments", label: "Cobros", icon: IconPayments, show: roleAtLeast(role, "ADMIN") },
        { href: "/app/team", label: "Equipo", icon: IconTeam, show: roleAtLeast(role, "ADMIN") },
      ],
    },
  ];

  return (
    <aside className="flex w-[16.5rem] flex-col border-r border-neutral-200/70 bg-white print:hidden">
      <div className="flex h-16 items-center px-5">
        <Link href="/app" aria-label="Inicio">
          <Logo markClassName="h-7 w-7" className="[&_span]:text-base" />
        </Link>
      </div>

      {activeOrg && (
        <div className="mx-4 mb-2 space-y-1.5 rounded-2xl bg-cream p-3">
          {organizations.length > 1 ? (
            <select
              value={activeOrg.id}
              onChange={(e) => setActiveOrgId(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm font-medium"
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="px-1 text-[0.8rem] font-semibold uppercase tracking-wide text-neutral-400">
              {activeOrg.name}
            </div>
          )}

          {activeOrg.restaurants.length > 1 ? (
            <select
              value={activeRestaurant?.id ?? ""}
              onChange={(e) => setActiveRestaurantId(e.target.value)}
              className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm"
            >
              {activeOrg.restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          ) : (
            activeRestaurant && (
              <div className="truncate px-1 text-[0.95rem] font-semibold text-neutral-900">
                {activeRestaurant.name}
              </div>
            )
          )}
        </div>
      )}

      <nav className="flex-1 space-y-5 overflow-y-auto px-4 py-3">
        {groups.map((group) => {
          const items = group.items.filter((i) => i.show !== false);
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <div className="mb-1 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-neutral-400">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavItem key={item.href} {...item} active={isActive(item.href)} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-neutral-200/70 p-4">
        <NavItem href="/app/account" label="Mi cuenta" icon={IconAccount} active={isActive("/app/account")} />
        <div className="mt-2 flex items-center justify-between gap-2 px-3">
          <div className="min-w-0 text-sm">
            <div className="truncate font-medium text-neutral-800">{user?.name}</div>
            <div className="truncate text-xs text-neutral-400">{user?.email}</div>
          </div>
          <button
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
          >
            <IconLogout className="h-[1.15rem] w-[1.15rem]" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { organizations, loading } = useOrg();
  const router = useRouter();
  const pathname = usePathname();
  const isOnboarding = pathname.startsWith("/app/onboarding");

  useEffect(() => {
    if (!loading && organizations.length === 0 && !isOnboarding) {
      router.replace("/app/onboarding");
    }
  }, [loading, organizations.length, isOnboarding, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isOnboarding || organizations.length === 0) {
    return <main className="min-h-screen bg-cream">{children}</main>;
  }

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-8 py-7">{children}</main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <OrgProvider>
      <AppShell>{children}</AppShell>
    </OrgProvider>
  );
}
