import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Comptes : tables attendues par Better Auth (ne pas renommer).       */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Identifiant de connexion court (plugin « username » de Better Auth).
  username: text("username").unique(),
  displayUsername: text("display_username"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"), // haché
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Boards                                                              */
/* ------------------------------------------------------------------ */

export type BoardRole = "admin" | "member";

/** Un board = une source de données, partagée par toutes ses vues. */
export const board = pgTable("board", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  // Lien public : l'URL (le jeton) ne change pas quand on le désactive.
  publicToken: text("public_token").notNull().unique(),
  publicEnabled: boolean("public_enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Qui a accès au board, et avec quel rôle. Le créateur y figure comme administrateur. */
export const boardMember = pgTable(
  "board_member",
  {
    boardId: uuid("board_id")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<BoardRole>().notNull(),
    // Couleur de la personne sur ce board ; vide = couleur attribuée d'office.
    color: text("color"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.boardId, t.userId] }), index("board_member_user_idx").on(t.userId)]
);

export type ViewSettings = { dim: boolean; drift: boolean };

/**
 * Une disposition de widgets. `userId` vide = la vue du board (une seule) ;
 * renseigné = la vue personnelle de cet utilisateur (au plus une par board).
 */
export const view = pgTable(
  "view",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    settings: jsonb("settings").$type<ViewSettings>().notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("view_board_user_unique").on(t.boardId, t.userId).nullsNotDistinct()]
);

/** Un widget placé sur une vue : position, taille et réglages propres à cette vue. */
export const widget = pgTable(
  "widget",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    viewId: uuid("view_id")
      .notNull()
      .references(() => view.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    w: integer("w").notNull(),
    h: integer("h").notNull(),
    showTitle: boolean("show_title").notNull().default(true),
    title: text("title"), // titre personnalisé ; vide = titre par défaut du widget
    options: jsonb("options").$type<Record<string, string>>().notNull(),
    // Identifiant de la liste de données du widget. Une vue personnelle qui copie
    // ce widget garde le même identifiant : les données restent communes.
    dataId: uuid("data_id").notNull(),
  },
  (t) => [index("widget_view_idx").on(t.viewId)]
);

/**
 * Données des widgets, stockées de façon générique : une ligne par élément
 * (un article de courses, une note…), dont la forme est déclarée par le widget.
 */
export const dataItem = pgTable(
  "data_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => board.id, { onDelete: "cascade" }),
    dataId: uuid("data_id").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    position: doublePrecision("position").notNull().default(0),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("data_item_list_idx").on(t.boardId, t.dataId)]
);
