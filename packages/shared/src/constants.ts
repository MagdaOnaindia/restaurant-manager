/**
 * Roles within an organization, from most to least privileged.
 * OWNER   — everything, including deleting the organization and configuring payments (Stripe).
 * ADMIN   — everything except deleting the organization.
 * MANAGER — operations: menus, reservations, tables, bills.
 * STAFF   — waiter view, payments and reservation lookup.
 */
export const ORG_ROLES = ["OWNER", "ADMIN", "MANAGER", "STAFF"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** The 14 allergens whose declaration is mandatory in the EU (Regulation 1169/2011 / Spanish RD 126/2015). */
export const ALLERGENS = [
  "GLUTEN",
  "CRUSTACEANS",
  "EGGS",
  "FISH",
  "PEANUTS",
  "SOY",
  "DAIRY",
  "NUTS",
  "CELERY",
  "MUSTARD",
  "SESAME",
  "SULPHITES",
  "LUPIN",
  "MOLLUSCS",
] as const;
export type Allergen = (typeof ALLERGENS)[number];

/** Spanish labels shown in the UIs. */
export const ALLERGEN_LABELS_ES: Record<Allergen, string> = {
  GLUTEN: "Gluten",
  CRUSTACEANS: "Crustáceos",
  EGGS: "Huevos",
  FISH: "Pescado",
  PEANUTS: "Cacahuetes",
  SOY: "Soja",
  DAIRY: "Lácteos",
  NUTS: "Frutos de cáscara",
  CELERY: "Apio",
  MUSTARD: "Mostaza",
  SESAME: "Sésamo",
  SULPHITES: "Sulfitos",
  LUPIN: "Altramuces",
  MOLLUSCS: "Moluscos",
};

export const ORG_ROLE_LABELS_ES: Record<OrgRole, string> = {
  OWNER: "Propietario/a",
  ADMIN: "Administrador/a",
  MANAGER: "Encargado/a",
  STAFF: "Personal",
};
