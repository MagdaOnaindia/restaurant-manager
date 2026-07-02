/**
 * Roles dentro de una organización, de mayor a menor privilegio.
 * OWNER   — todo, incluido borrar la organización y configurar cobros (Stripe).
 * ADMIN   — todo menos borrar la organización.
 * MANAGER — operativa: cartas, reservas, mesas, cuentas.
 * STAFF   — comandero, cobros y consulta de reservas.
 */
export const ORG_ROLES = ["OWNER", "ADMIN", "MANAGER", "STAFF"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** Los 14 alérgenos de declaración obligatoria en la UE (Reglamento 1169/2011 / RD 126/2015). */
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

/** Etiquetas en español para mostrar en las UIs. */
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
