import { z } from "zod";
import type { OrgRole } from "./constants";
import { emailSchema, passwordSchema } from "./auth";

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del negocio").max(120),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = createOrganizationSchema;

export const createRestaurantSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del restaurante").max(120),
  description: z.string().trim().max(2000).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
});
export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;

export const updateRestaurantSchema = createRestaurantSchema.partial().extend({
  isPublic: z.boolean().optional(),
});
export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;

/** Roles que se pueden asignar por invitación (OWNER solo se crea con la organización). */
export const INVITABLE_ROLES = ["ADMIN", "MANAGER", "STAFF"] as const satisfies readonly OrgRole[];

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(INVITABLE_ROLES),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: z.enum(INVITABLE_ROLES),
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const acceptInvitationNewUserSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  password: passwordSchema,
});
export type AcceptInvitationNewUserInput = z.infer<typeof acceptInvitationNewUserSchema>;

// ── Tipos de respuesta de la API ────────────────────────────────────

export interface RestaurantSummary {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  isPublic: boolean;
}

export interface OrganizationWithRole {
  id: string;
  name: string;
  role: OrgRole;
  stripeChargesEnabled: boolean;
  restaurants: RestaurantSummary[];
}

export interface MemberInfo {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: OrgRole;
  createdAt: string;
}

export interface InvitationInfo {
  id: string;
  email: string;
  role: OrgRole;
  expiresAt: string;
  createdAt: string;
}

export interface PublicInvitationInfo {
  organizationName: string;
  email: string;
  role: OrgRole;
  userExists: boolean;
  invitedByName: string;
}

export interface RestaurantDetail {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  timezone: string;
  currency: string;
  isPublic: boolean;
}

/** Jerarquía de roles: nivel mayor = más permisos. */
export const ORG_ROLE_LEVEL: Record<OrgRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MANAGER: 2,
  STAFF: 1,
};

export function roleAtLeast(role: OrgRole, required: OrgRole): boolean {
  return ORG_ROLE_LEVEL[role] >= ORG_ROLE_LEVEL[required];
}
