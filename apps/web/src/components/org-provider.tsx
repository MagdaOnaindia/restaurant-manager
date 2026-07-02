"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { OrganizationWithRole, RestaurantSummary } from "@rms/shared";
import { apiGet } from "@/lib/api";
import { useAuth } from "./auth-provider";

interface OrgContextValue {
  organizations: OrganizationWithRole[];
  loading: boolean;
  activeOrg: OrganizationWithRole | null;
  activeRestaurant: RestaurantSummary | null;
  setActiveOrgId: (id: string) => void;
  setActiveRestaurantId: (id: string) => void;
  reload: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue | null>(null);

const ORG_KEY = "rms.activeOrgId";
const RESTAURANT_KEY = "rms.activeRestaurantId";

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [activeRestaurantId, setActiveRestaurantIdState] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      const { organizations } = await apiGet<{ organizations: OrganizationWithRole[] }>("/orgs");
      setOrganizations(organizations);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setActiveOrgIdState(localStorage.getItem(ORG_KEY));
    setActiveRestaurantIdState(localStorage.getItem(RESTAURANT_KEY));
    void reload();
  }, [reload]);

  const activeOrg = useMemo(() => {
    if (organizations.length === 0) return null;
    return organizations.find((o) => o.id === activeOrgId) ?? organizations[0] ?? null;
  }, [organizations, activeOrgId]);

  const activeRestaurant = useMemo(() => {
    if (!activeOrg || activeOrg.restaurants.length === 0) return null;
    return (
      activeOrg.restaurants.find((r) => r.id === activeRestaurantId) ??
      activeOrg.restaurants[0] ??
      null
    );
  }, [activeOrg, activeRestaurantId]);

  const setActiveOrgId = useCallback((id: string) => {
    localStorage.setItem(ORG_KEY, id);
    setActiveOrgIdState(id);
    localStorage.removeItem(RESTAURANT_KEY);
    setActiveRestaurantIdState(null);
  }, []);

  const setActiveRestaurantId = useCallback((id: string) => {
    localStorage.setItem(RESTAURANT_KEY, id);
    setActiveRestaurantIdState(id);
  }, []);

  return (
    <OrgContext.Provider
      value={{
        organizations,
        loading,
        activeOrg,
        activeRestaurant,
        setActiveOrgId,
        setActiveRestaurantId,
        reload,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg debe usarse dentro de <OrgProvider>");
  return ctx;
}
