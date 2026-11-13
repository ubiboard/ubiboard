import "server-only";
import { PERSON_COLORS } from "@/lib/board-types";
import { normalizeCalendarUrl } from "@/lib/calendar-server";
import { encryptSecret, isEncrypted } from "@/lib/crypto";

type Content = Record<string, unknown>;

/**
 * Règles côté serveur pour les données d'un type de widget. Sans règle, une
 * liste est lisible et modifiable par tous les membres du board.
 */
export type ListPolicy = {
  /** Seuls les administrateurs du board écrivent ; les membres lisent. */
  adminWrite?: boolean;
  /** Champs jamais renvoyés au navigateur ; remplacés par « has<Champ> : true ». */
  secretFields?: string[];
  /** Valide et transforme le contenu avant de l'enregistrer (`previous` = contenu actuel, en modification). */
  prepare?: (content: Content, previous: Content | null) => Content;
};

/** Chiffre le lien fourni, ou conserve celui qui est déjà enregistré. */
function sealedLink(content: Content, previous: Content | null): string {
  const link = typeof content.url === "string" ? content.url.trim() : "";
  const url = link ? encryptSecret(normalizeCalendarUrl(link)) : previous?.url;
  if (!isEncrypted(url)) throw new Error("Indiquez le lien iCal.");
  return url;
}

const POLICIES: Record<string, ListPolicy> = {
  chores: { adminWrite: true },
  school: {
    adminWrite: true,
    secretFields: ["url"],
    // La liste mêle des créneaux saisis à la main et, au plus, un lien iCal (kind: "ical").
    prepare(content, previous) {
      if (content.kind === "ical" || previous?.kind === "ical") {
        return { kind: "ical", url: sealedLink(content, previous) };
      }
      const { url: _url, kind: _kind, ...slot } = content;
      return slot;
    },
  },
  calendar: {
    adminWrite: true,
    secretFields: ["url"],
    // Un agenda : nom, couleur, et lien iCal chiffré avant d'être stocké.
    prepare(content, previous) {
      const name = typeof content.name === "string" ? content.name.trim().slice(0, 60) : "";
      if (!name) throw new Error("Donnez un nom à l'agenda.");
      const color = typeof content.color === "string" && PERSON_COLORS.includes(content.color) ? content.color : PERSON_COLORS[0];
      // Lien non fourni en modification : on garde celui qui est enregistré.
      return { name, color, url: sealedLink(content, previous) };
    },
  },
};

export function policyFor(types: string[]): ListPolicy {
  return types.map((t) => POLICIES[t]).find(Boolean) ?? {};
}

/** Retire les champs secrets avant d'envoyer un contenu au navigateur. */
export function redact(policy: ListPolicy, content: Content): Content {
  if (!policy.secretFields?.length) return content;
  const out: Content = { ...content };
  for (const field of policy.secretFields) {
    if (field in out) {
      delete out[field];
      out["has" + field.charAt(0).toUpperCase() + field.slice(1)] = true;
    }
  }
  return out;
}
