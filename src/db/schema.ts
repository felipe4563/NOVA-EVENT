import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { FORMAS_PAGO } from "../lib/saldos/recibo";

/**
 * Tipo de cuenta. Define a qué parte del sistema pertenece el usuario:
 * - staff: equipo de Nova Event (administradores y empleados)
 * - provider: proveedores (salón, música, catering...) — solo ven lo suyo
 * - client: clientes (novios) — acceso opcional a su propio evento
 */
export const accountKind = pgEnum("account_kind", ["staff", "provider", "client"]);

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  kind: accountKind("kind").notNull().default("staff"),
  /** Acceso total: ignora la tabla de permisos (rol administrador). */
  fullAccess: boolean("full_access").notNull().default(false),
  /** Los roles de sistema no se pueden borrar desde la interfaz. */
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Permisos asignados a cada rol. El catálogo vive en src/lib/permissions.ts. */
export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permission] })],
);

/** Rubros de proveedores (salón, música, catering...). Se administran desde Proveedores. */
export const supplierCategories = pgTable("supplier_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Nombre del negocio, por ejemplo "Salón Los Jardines". */
    name: text("name").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => supplierCategories.id),
    contactName: text("contact_name"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    website: text("website"),
    /** Capacidad (personas); null = sin dato. */
    capacity: integer("capacity"),
    /** Qué ofrece: capacidad, paquetes, estilos... */
    services: text("services"),
    /** Notas internas del equipo; el proveedor nunca las ve. */
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    /** Condiciones de pago: % de adelanto (0–100) y días del resto respecto al evento; null = estándar. */
    advancePct: integer("advance_pct"),
    balanceDays: integer("balance_days"),
    paymentTerms: text("payment_terms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("suppliers_category_idx").on(t.categoryId)],
);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  roleId: uuid("role_id")
    .notNull()
    .references(() => roles.id),
  active: boolean("active").notNull().default(true),
  /** Solo cuentas de proveedor: a qué proveedor pertenece (ve únicamente lo suyo). */
  supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 del token de la cookie; el token en claro nunca se guarda. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/**
 * Días u horarios en que un proveedor está ocupado. Sin horas = todo el día.
 * El detalle es privado del proveedor: el equipo solo ve "Ocupado",
 * salvo en los bloques que registró el propio equipo (byStaff).
 */
export const supplierBusy = pgTable(
  "supplier_busy",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    detail: text("detail"),
    byStaff: boolean("by_staff").notNull().default(false),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("supplier_busy_supplier_date_idx").on(t.supplierId, t.date), index("supplier_busy_date_idx").on(t.date)],
);

/** Tipo de archivo de la galería de un proveedor. */
export const mediaKind = pgEnum("media_kind", ["photo", "plan", "pano", "audio", "video"]);

/**
 * Galería de un proveedor: fotos, planos, fotos 360°, audios y videos (estos últimos, como enlace).
 * Los archivos viven en UPLOADS_DIR; aquí se guarda su ruta relativa.
 */
export const supplierMedia = pgTable(
  "supplier_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    kind: mediaKind("kind").notNull(),
    title: text("title"),
    /** Para agrupar: "Rústico", "Elegante", "Salón principal"... */
    album: text("album"),
    /** Archivo principal (versión optimizada). Null en videos. */
    fileKey: text("file_key"),
    /** Miniatura para la galería. */
    thumbKey: text("thumb_key"),
    mime: text("mime"),
    sizeBytes: integer("size_bytes"),
    width: integer("width"),
    height: integer("height"),
    /** Enlace del video (YouTube, Vimeo, TikTok, Instagram...). */
    url: text("url"),
    /** Foto que se muestra en la tarjeta del proveedor. */
    isCover: boolean("is_cover").notNull().default(false),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("supplier_media_supplier_idx").on(t.supplierId, t.kind)],
);

/**
 * Datos de la empresa (una sola fila, id = 1): nombre, contacto y redes que se muestran
 * en las propuestas, el enlace público y los PDF. Los logos son archivos en UPLOADS_DIR/empresa.
 */
export const companySettings = pgTable("company_settings", {
  id: integer("id").primaryKey().default(1),
  name: text("name").notNull(),
  tagline: text("tagline"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  website: text("website"),
  instagram: text("instagram"),
  facebook: text("facebook"),
  tiktok: text("tiktok"),
  /** Política de cancelación y devoluciones; se muestra en recibos y «Mis pagos». */
  cancellationPolicy: text("cancellation_policy"),
  /** Se suben logos propios (si no, se usan los de public/brand). */
  hasLogoLight: boolean("has_logo_light").notNull().default(false),
  hasLogoDark: boolean("has_logo_dark").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Registro de quién hizo qué (inicios de sesión, cambios, etc.). */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_action_created_idx").on(t.action, t.createdAt)],
);

/** Tipos de evento de las cotizaciones (boda, quinceaños...). */
export const eventTypes = pgTable("event_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

/** Color de marca con que se presenta un paquete de Nova Event. */
export const novaTheme = pgEnum("nova_theme", ["vino", "oro", "agua"]);

/** Paquetes de servicio de Nova Event (Esencia, Inspiración, Prestigio). */
export const novaPackages = pgTable("nova_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  priceCents: integer("price_cents").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  /** Lista "Incluye" del paquete. */
  includes: jsonb("includes").$type<string[]>().notNull().default([]),
  /** Paquete del que hereda ("además de todo lo de..."). */
  basePackageId: uuid("base_package_id").references((): AnyPgColumn => novaPackages.id, { onDelete: "set null" }),
  theme: novaTheme("theme").notNull().default("vino"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

/** Cómo se cobra un paquete o una línea: monto fijo o por persona. */
export const pricingMode = pgEnum("pricing_mode", ["fixed", "per_person"]);

/** Paquetes que ofrece cada proveedor. */
export const supplierPackages = pgTable(
  "supplier_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    pricing: pricingMode("pricing").notNull().default("fixed"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("supplier_packages_supplier_idx").on(t.supplierId)],
);

export const quoteStatus = pgEnum("quote_status", ["draft", "sent", "accepted", "rejected", "cancelled"]);

/** Cotizaciones a clientes. El código es COT-AAAA-NNNN (correlativo por año). */
export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    year: integer("year").notNull(),
    seq: integer("seq").notNull(),
    clientName: text("client_name").notNull(),
    clientPhone: text("client_phone"),
    clientEmail: text("client_email"),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "restrict" }),
    eventDate: date("event_date", { mode: "string" }).notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    guests: integer("guests"),
    /** Presupuesto del cliente en centavos; null = sin dato. */
    budgetCents: integer("budget_cents"),
    includeNovaInBudget: boolean("include_nova_in_budget").notNull().default(false),
    showBudgetToClient: boolean("show_budget_to_client").notNull().default(false),
    validUntil: date("valid_until", { mode: "string" }),
    /** Notas internas; nunca se muestran al cliente. */
    notes: text("notes"),
    status: quoteStatus("status").notNull().default("draft"),
    /** Si la pareja ve «Mis pagos» en el enlace público. */
    showPayments: boolean("show_payments").notNull().default(true),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    /** Versión aceptada (sin FK para evitar el ciclo con quote_versions). */
    acceptedVersionId: uuid("accepted_version_id"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    /** Token del enlace público; nunca se usa el id interno. */
    shareToken: text("share_token").unique(),
    shareEnabled: boolean("share_enabled").notNull().default(false),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique("quotes_year_seq_unique").on(t.year, t.seq), index("quotes_status_idx").on(t.status)],
);

/** Opciones (A, B, C...) de una cotización. */
export const quoteVersions = pgTable(
  "quote_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    showInProposal: boolean("show_in_proposal").notNull().default(true),
    novaPackageId: uuid("nova_package_id").references(() => novaPackages.id, { onDelete: "set null" }),
    novaPriceCents: integer("nova_price_cents"),
    /** Copia del paquete Nova al aceptar: { nombre, precio, frase, incluye[] }. */
    frozen: jsonb("frozen").$type<{ nombre: string; precio: number; frase: string | null; incluye: string[] }>(),
  },
  (t) => [index("quote_versions_quote_idx").on(t.quoteId)],
);

export const payer = pgEnum("payer", ["nova", "client"]);
export const confirmationStatus = pgEnum("confirmation", ["pending", "confirmed", "unavailable"]);

/** Líneas de una versión: un proveedor o paquete de proveedor, o una línea manual. */
export const quoteItems = pgTable(
  "quote_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => quoteVersions.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => supplierCategories.id, { onDelete: "set null" }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    supplierPackageId: uuid("supplier_package_id").references(() => supplierPackages.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    pricing: pricingMode("pricing").notNull().default("fixed"),
    unitCents: integer("unit_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    manualPrice: boolean("manual_price").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Copia de la línea al aceptar la cotización (congelarLinea): { proveedor, paquete, etiqueta, total }. */
    frozen: jsonb("frozen").$type<{ proveedor: string | null; paquete: string | null; etiqueta: string; total: number }>(),
    confirmation: confirmationStatus("confirmation"),
    /** Quién paga esta línea: Nova Event (la cobra a la pareja) o la pareja directo al proveedor. */
    payer: payer("payer").notNull().default("nova"),
    /** Monto a pagar al proveedor en centavos; null = el total congelado de la línea. */
    payableCents: integer("payable_cents"),
    /** Día ocupado creado al confirmar al proveedor. */
    busyId: uuid("busy_id").references(() => supplierBusy.id, { onDelete: "set null" }),
  },
  (t) => [index("quote_items_version_idx").on(t.versionId)],
);

export const movementKind = pgEnum("movement_kind", ["cobro", "devolucion", "pago_proveedor", "devolucion_proveedor"]);
export const paymentMethod = pgEnum("payment_method", FORMAS_PAGO);

/** Cuotas del plan de pago: itemId null = plan de la pareja; si no, plan de pago al proveedor de esa línea. */
export const paymentInstallments = pgTable(
  "payment_installments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").references(() => quoteItems.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amountCents: integer("amount_cents").notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("payment_installments_quote_item_idx").on(t.quoteId, t.itemId)],
);

/**
 * Cobros, pagos y devoluciones. Nada se borra: se anula con motivo.
 * El monto es siempre positivo; el signo lo da `kind`. Solo los cobros tienen recibo (REC-AAAA-NNNN).
 */
export const paymentMovements = pgTable(
  "payment_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quoteId: uuid("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "restrict" }),
    /** Null en cobros y devoluciones a la pareja. */
    itemId: uuid("item_id").references(() => quoteItems.id, { onDelete: "restrict" }),
    kind: movementKind("kind").notNull(),
    amountCents: integer("amount_cents").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    method: paymentMethod("method").notNull(),
    reference: text("reference"),
    fileKey: text("file_key"),
    mime: text("mime"),
    receiptYear: integer("receipt_year"),
    receiptSeq: integer("receipt_seq"),
    receiptCode: text("receipt_code").unique(),
    handledById: uuid("handled_by_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedById: uuid("voided_by_id").references(() => users.id, { onDelete: "set null" }),
    voidReason: text("void_reason"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("payment_movements_receipt_unique").on(t.receiptYear, t.receiptSeq),
    index("payment_movements_quote_idx").on(t.quoteId),
    index("payment_movements_item_idx").on(t.itemId),
  ],
);

/** Ajustes al total de una cotización aceptada (negativo = descuento). Se anulan, no se borran. */
export const quoteAdjustments = pgTable("quote_adjustments", {
  id: uuid("id").primaryKey().defaultRandom(),
  quoteId: uuid("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "restrict" }),
  concept: text("concept").notNull(),
  amountCents: integer("amount_cents").notNull(),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  voidedById: uuid("voided_by_id").references(() => users.id, { onDelete: "set null" }),
  voidReason: text("void_reason"),
  createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Role = typeof roles.$inferSelect;
export type User = typeof users.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type SupplierMedia = typeof supplierMedia.$inferSelect;
export type EventType = typeof eventTypes.$inferSelect;
export type NovaPackage = typeof novaPackages.$inferSelect;
export type SupplierPackage = typeof supplierPackages.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type QuoteVersion = typeof quoteVersions.$inferSelect;
export type QuoteItem = typeof quoteItems.$inferSelect;
