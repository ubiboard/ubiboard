"use client";

import { useState } from "react";
import Link from "next/link";
import { listWidgets } from "@/lib/widgets";
import Icon from "@/components/Icon";
import "@/components/widgets";

type Plugin = {
  id: string;
  name: string;
  description: string;
  access: string;
  sizes: string;
  kind: "default" | "community" | "soon";
};

// Exemples de plugins communautaires : la boutique n'est pas encore branchée.
const COMMUNITY: Plugin[] = [
  { id: "collecte", name: "Jours de collecte", description: "Rappelle quel bac sortir, selon le calendrier de votre commune.", access: "réseau (site de la collectivité)", sizes: "2×1 à 4×3", kind: "community" },
  { id: "transports", name: "Transports en commun", description: "Prochains passages à l’arrêt le plus proche de la maison.", access: "réseau (données de votre réseau de transport)", sizes: "2×2 à 4×4", kind: "community" },
  { id: "anniversaires", name: "Anniversaires", description: "Les prochains anniversaires de la famille et des amis.", access: "contacts du foyer (lecture)", sizes: "2×1 à 4×3", kind: "community" },
  { id: "photos", name: "Cadre photo", description: "Un diaporama de vos photos, sobre et peu lumineux sur OLED.", access: "photos du foyer (lecture)", sizes: "2×2 à 8×5", kind: "community" },
  { id: "conso", name: "Consommation électrique", description: "Votre consommation du jour, d’après votre compteur.", access: "réseau (fournisseur de données du compteur)", sizes: "2×2 à 4×3", kind: "community" },
  { id: "domotique", name: "Domotique", description: "Lumières, volets et capteurs de la maison, via Home Assistant.", access: "Home Assistant (lecture, commandes)", sizes: "2×1 à 8×5", kind: "soon" },
];

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "default", label: "Par défaut" },
  { key: "community", label: "Communautaires" },
  { key: "installed", label: "Installés" },
];

const MANIFEST = `{
  "id": "collecte-dechets",
  "name": "Jours de collecte",
  "version": "1.0.0",
  "entry": "widget.html",
  "sizes": {
    "min": [2, 1],
    "default": [2, 2],
    "max": [4, 3]
  },
  "permissions": [
    "network:collecte.example.org",
    "household:read"
  ],
  "settings": [
    { "key": "adresse", "type": "text", "label": "Adresse" },
    { "key": "rappel", "type": "choice", "label": "Rappel",
      "choices": ["Veille", "Matin même"] }
  ]
}`;

const TAG: Record<Plugin["kind"], string> = {
  default: "Par défaut",
  community: "Communautaire",
  soon: "Bientôt",
};

export default function Boutique() {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const plugins: Plugin[] = [
    ...listWidgets().map((def) => ({
      id: def.type,
      name: def.name,
      description: def.description,
      access: def.access,
      sizes: `${def.sizes.min.join("×")} à ${def.sizes.max.join("×")}`,
      kind: "default" as const,
    })),
    ...COMMUNITY,
  ];

  const shown = plugins.filter((p) => {
    if (filter === "default" || filter === "installed") {
      if (p.kind !== "default") return false;
    } else if (filter === "community" && p.kind !== "community") return false;
    const q = query.trim().toLowerCase();
    return !q || (p.name + " " + p.description).toLowerCase().includes(q);
  });

  return (
    <main className="store">
      <Link href="/" className="store-back">
        <Icon name="back" size={16} /> Retour à l’écran d’accueil
      </Link>
      <div className="store-head">
        <div>
          <h1 className="store-title">Boutique de plugins</h1>
          <p className="store-lead">
            Chaque widget de votre écran d’accueil vient d’un plugin. Installez-en, retirez-en, ou écrivez le vôtre.
          </p>
        </div>
        <input
          className="input store-search"
          aria-label="Rechercher un plugin"
          placeholder="Rechercher un plugin"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="chips">
        {FILTERS.map((f) => (
          <button key={f.key} className={"chip" + (filter === f.key ? " on" : "")} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="store-grid">
        {shown.map((p) => (
          <article key={p.id} className="store-card">
            <div className="store-card-top">
              <span className={"tag" + (p.kind === "default" ? "" : " neutral")}>{TAG[p.kind]}</span>
              <span className="dim small">{p.sizes}</span>
            </div>
            <h2 className="card-heading">{p.name}</h2>
            <p className="muted small">{p.description}</p>
            <p className="dim small">Accès : {p.access}</p>
            <div className="store-card-foot">
              {p.kind === "default" && (
                <span className="installed"><Icon name="check" size={18} /> Installé</span>
              )}
              {p.kind === "community" && (
                <button className="btn btn-primary center" disabled title="L'installation de plugins arrive plus tard">
                  Installer
                </button>
              )}
              {p.kind === "soon" && <span className="dim">Prévu, pas encore disponible</span>}
            </div>
          </article>
        ))}
        {shown.length === 0 && <p className="dim">Aucun plugin ne correspond.</p>}
      </div>

      <section className="store-write">
        <div>
          <h2 className="store-title small-title">Écrire un plugin</h2>
          <p className="store-lead">Un plugin, c’est une page web et un manifeste. L’écran d’accueil s’occupe du reste.</p>
          <h3>Isolé du reste du hub</h3>
          <p className="muted small">Le widget s’affiche dans un cadre isolé et ne voit que ce que le manifeste déclare.</p>
          <h3>Permissions validées à l’installation</h3>
          <p className="muted small">Calendrier du foyer, réseau, domotique : la famille voit ce qu’un plugin demande avant de l’installer.</p>
          <h3>Tailles et réglages déclaratifs</h3>
          <p className="muted small">Le sélecteur de taille et le panneau de réglages du widget sont générés depuis le manifeste.</p>
        </div>
        <div>
          <div className="dim small" style={{ marginBottom: 8 }}>manifest.json, format proposé</div>
          <pre className="manifest">{MANIFEST}</pre>
        </div>
      </section>
    </main>
  );
}
