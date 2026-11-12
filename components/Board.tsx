"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GridLayout, { noCompactor, useContainerWidth, type Compactor, type EventCallback, type Layout, type LayoutItem } from "react-grid-layout";
import { getWidget, listWidgets, type WidgetOptions } from "@/lib/widgets";
import { DAYS, MONTHS } from "@/lib/demo-data";
import Icon, { type IconName } from "@/components/Icon";
import Modal, { Switch } from "@/components/Modal";
import "@/components/widgets"; // enregistre les widgets par défaut

const STORAGE_KEY = "ubiboard-board-v2";
const COLS = 8;
const ROWS = 5; // lignes visibles sans défilement sur l'écran mural
const GAP = 16;
const HEADER = 72;
// Placement libre : pas de tassement automatique, et un widget qu'on déplace ou
// redimensionne ne bouscule jamais les autres (il s'arrête au bord du voisin).
const FREE_PLACEMENT: Compactor = { ...noCompactor, preventCollision: true };

const PHONE_QUERY = "(max-width: 760px)";

type PlacedWidget = {
  id: string; // identifiant de l'instance (on peut avoir deux horloges)
  type: string;
  showTitle: boolean;
  options: WidgetOptions;
};

type Cell = { i: string; x: number; y: number; w: number; h: number };

type BoardState = {
  widgets: PlacedWidget[];
  layout: Cell[];
  screen: { dim: boolean; drift: boolean };
};

// Disposition de départ, avant toute sauvegarde.
const DEFAULT_STATE: BoardState = {
  widgets: [
    { id: "w1", type: "clock", showTitle: false, options: { secs: "off" } },
    { id: "w2", type: "weather", showTitle: true, options: { unit: "C" } },
    { id: "w3", type: "calendar", showTitle: true, options: { who: "Tous" } },
    { id: "w4", type: "chores", showTitle: true, options: { who: "Tous" } },
    { id: "w5", type: "school", showTitle: true, options: { kid: "Léo", span: "2j" } },
    { id: "w6", type: "shopping", showTitle: true, options: { done: "show" } },
  ],
  layout: [
    { i: "w1", x: 0, y: 0, w: 2, h: 1 },
    { i: "w2", x: 0, y: 1, w: 2, h: 1 },
    { i: "w3", x: 2, y: 0, w: 6, h: 2 },
    { i: "w4", x: 0, y: 2, w: 2, h: 3 },
    { i: "w5", x: 2, y: 2, w: 4, h: 3 },
    { i: "w6", x: 6, y: 2, w: 2, h: 3 },
  ],
  screen: { dim: false, drift: true },
};

function loadState(): BoardState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as BoardState;
    // On écarte les widgets dont le type n'existe plus ou qui n'ont pas de place.
    const widgets = parsed.widgets.filter(
      (w) => getWidget(w.type) && parsed.layout.some((l) => l.i === w.id)
    );
    return {
      widgets,
      layout: parsed.layout.filter((l) => widgets.some((w) => w.id === l.i)),
      screen: { ...DEFAULT_STATE.screen, ...parsed.screen },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function useRowHeight(): number {
  const [rowHeight, setRowHeight] = useState(146);
  useEffect(() => {
    const compute = () =>
      setRowHeight(Math.max(110, Math.floor((window.innerHeight - HEADER - GAP - (ROWS - 1) * GAP) / ROWS)));
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return rowHeight;
}

/** Vrai sur un écran étroit (téléphone) : on y affiche la vue empilée, en lecture seule. */
function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isPhone;
}

/** Le cadre commun à tous les widgets : titre + contenu fourni par le plugin. */
function WidgetFrame({
  widget,
  w,
  h,
  height,
}: {
  widget: PlacedWidget;
  w: number;
  h: number;
  /** Hauteur totale en pixels du cadre. */
  height: number;
}) {
  const def = getWidget(widget.type);
  if (!def) return null;
  const title = def.title(widget.options);
  const bodyHeight = height - 38 - (widget.showTitle ? 26 : 0);
  return (
    <section className="widget" aria-label={title}>
      {widget.showTitle && <h2 className="widget-title">{title}</h2>}
      <div className="widget-body">
        <def.Component w={w} h={h} bodyHeight={bodyHeight} options={widget.options} />
      </div>
    </section>
  );
}

export default function Board() {
  // "saved" = dernier état enregistré. "draft" = brouillon du mode édition,
  // jamais écrit tant que l'utilisateur n'a pas cliqué « Enregistrer ».
  const [saved, setSaved] = useState<BoardState>(DEFAULT_STATE);
  const [draft, setDraft] = useState<BoardState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [screenOpen, setScreenOpen] = useState(false);
  // Widget en cours de déplacement ou de redimensionnement, avec sa taille en direct.
  const [active, setActive] = useState<{ id: string; w: number; h: number } | null>(null);

  const { width, containerRef, mounted } = useContainerWidth();
  const rowHeight = useRowHeight();
  const phone = useIsPhone();

  useEffect(() => {
    const state = loadState();
    setSaved(state);
    setDraft(state);
    setLoaded(true);
  }, []);

  const ready = loaded && mounted;
  const isPhone = ready && phone;
  const state = editing ? draft : saved;

  const closePanels = () => {
    setConfigId(null);
    setDrawerOpen(false);
    setScreenOpen(false);
  };

  const startEdit = () => {
    setDraft(saved); // on repart toujours d'une copie de l'état enregistré
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(saved); // on jette le brouillon
    setEditing(false);
    closePanels();
  };

  const saveEdit = () => {
    setSaved(draft);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* stockage indisponible : la disposition reste en mémoire */
    }
    setEditing(false);
    closePanels();
  };

  const onLayoutChange = useCallback(
    (next: Layout) => {
      if (!editing) return; // aucune modification possible hors mode édition
      setDraft((prev) => ({
        ...prev,
        layout: next.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })),
      }));
    },
    [editing]
  );

  const trackActive: EventCallback = useCallback((_layout, _old, item) => {
    if (item) setActive({ id: item.i, w: item.w, h: item.h });
  }, []);
  const clearActive = useCallback(() => setActive(null), []);

  const patchWidget = (id: string, patch: Partial<PlacedWidget>) =>
    setDraft((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));

  const removeWidget = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      widgets: prev.widgets.filter((w) => w.id !== id),
      layout: prev.layout.filter((l) => l.i !== id),
    }));
    setConfigId((current) => (current === id ? null : current));
  };

  const addWidget = (type: string) => {
    const def = getWidget(type);
    if (!def) return;
    const id = `w${Date.now()}`;
    const [w, h] = def.sizes.default;
    setDraft((prev) => ({
      ...prev,
      widgets: [...prev.widgets, { id, type, showTitle: def.defaultShowTitle, options: { ...def.defaultOptions } }],
      // Placement libre : le nouveau widget arrive sous les autres.
      layout: [...prev.layout, { i: id, x: 0, y: Math.max(0, ...prev.layout.map((l) => l.y + l.h)), w, h }],
    }));
    setDrawerOpen(false);
  };

  const setScreen = (patch: Partial<BoardState["screen"]>) =>
    setDraft((prev) => ({ ...prev, screen: { ...prev.screen, ...patch } }));

  // Les contraintes de taille viennent de la définition du widget.
  const gridLayout: LayoutItem[] = useMemo(
    () =>
      state.layout.map((cell) => {
        const def = getWidget(state.widgets.find((w) => w.id === cell.i)?.type ?? "");
        if (!def) return cell;
        return {
          ...cell,
          minW: def.sizes.min[0],
          minH: def.sizes.min[1],
          maxW: def.sizes.max[0],
          maxH: def.sizes.max[1],
        };
      }),
    [state.layout, state.widgets]
  );

  // Nombre de lignes du quadrillage affiché pendant un déplacement.
  const guideRows = Math.max(ROWS, ...state.layout.map((l) => l.y + l.h)) + 1;

  const configWidget = editing ? draft.widgets.find((w) => w.id === configId) : undefined;
  const configDef = configWidget ? getWidget(configWidget.type) : undefined;

  return (
    <div className={"board" + (isPhone ? " phone" : "")}>
      {!isPhone && (
        <header className="topbar">
          <div className="topbar-left">
            <Icon name="home" size={26} color="var(--accent)" />
            <h1 className="brand">Maison</h1>
            {editing && <span className="tag">Mode édition</span>}
          </div>
          <div className="topbar-right">
            {editing ? (
              <>
                <button className="btn" onClick={() => { closePanels(); setDrawerOpen(true); }}>
                  <Icon name="plus" /> Ajouter un widget
                </button>
                <button className="btn" onClick={() => { closePanels(); setScreenOpen(true); }}>
                  <Icon name="sliders" /> Écran
                </button>
                <button className="btn" onClick={cancelEdit}>Annuler</button>
                <button className="btn btn-primary" onClick={saveEdit}>Enregistrer</button>
              </>
            ) : (
              <button className="btn-icon subtle" aria-label="Personnaliser l'écran d'accueil" onClick={startEdit}>
                <Icon name="pencil" />
              </button>
            )}
          </div>
        </header>
      )}

      <div
        ref={containerRef}
        className={
          "board-area" +
          (state.screen.dim ? " dimmed" : "") +
          (state.screen.drift && !editing && !isPhone ? " drift" : "")
        }
      >
        {ready && isPhone && <PhoneView state={saved} />}

        {ready && !isPhone && state.widgets.length === 0 && (
          <div className="empty">
            Aucun widget. {editing ? "Utilisez « Ajouter un widget »." : "Passez en mode édition pour en ajouter."}
          </div>
        )}

        {ready && !isPhone && editing && active && (
          <div
            className="grid-guide"
            aria-hidden="true"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, gridAutoRows: rowHeight, gap: GAP }}
          >
            {Array.from({ length: COLS * guideRows }, (_, k) => (
              <div key={k} className="grid-guide-cell" />
            ))}
          </div>
        )}

        {ready && !isPhone && (
          <GridLayout
            width={width}
            layout={gridLayout}
            gridConfig={{ cols: COLS, rowHeight, margin: [GAP, GAP], containerPadding: [0, 0] }}
            dragConfig={{ enabled: editing, handle: ".drag-handle" }}
            resizeConfig={{
              enabled: editing,
              handles: ["se"],
              handleComponent: (_axis, ref) => (
                <span ref={ref} className="btn-icon edit-btn resize-handle" title="Redimensionner">
                  <Icon name="resize" size={18} />
                </span>
              ),
            }}
            compactor={FREE_PLACEMENT}
            onLayoutChange={onLayoutChange}
            onDragStart={trackActive}
            onDragStop={clearActive}
            onResizeStart={trackActive}
            onResize={trackActive}
            onResizeStop={clearActive}
          >
            {state.widgets.map((widget) => {
              const cell = state.layout.find((l) => l.i === widget.id);
              const def = getWidget(widget.type);
              if (!cell || !def) return null;
              const size = active?.id === widget.id ? active : cell;
              return (
                <div key={widget.id} className={"cell" + (editing ? " editing" : "")}>
                  <WidgetFrame
                    widget={widget}
                    w={size.w}
                    h={size.h}
                    height={size.h * rowHeight + (size.h - 1) * GAP}
                  />
                  {editing && (
                    <>
                      {/* Voile : bloque le contenu et sert de poignée de déplacement. */}
                      <div className="cell-veil drag-handle" />
                      <div className="cell-controls">
                        <span className="btn-icon edit-btn drag-handle" role="img" aria-label="Déplacer (glisser)" title="Déplacer">
                          <Icon name="move" size={18} />
                        </span>
                        <button className="btn-icon edit-btn" aria-label={`Configurer ${def.name}`} title="Configurer" onClick={() => { closePanels(); setConfigId(widget.id); }}>
                          <Icon name="gear" size={18} />
                        </button>
                        <button className="btn-icon edit-btn" aria-label={`Supprimer ${def.name}`} title="Supprimer" onClick={() => removeWidget(widget.id)}>
                          <Icon name="trash" size={18} />
                        </button>
                      </div>
                      <div className="cell-size">{size.w} × {size.h}</div>
                    </>
                  )}
                </div>
              );
            })}
          </GridLayout>
        )}
      </div>

      {configWidget && configDef && (
        <Modal
          title={configDef.name}
          subtitle={configDef.source === "default" ? "Plugin par défaut" : "Plugin communautaire"}
          onClose={() => setConfigId(null)}
        >
          {configDef.options.map((opt) => (
            <div key={opt.key}>
              <div className="field-label">{opt.label}</div>
              <div className="chips">
                {opt.choices.map((choice) => {
                  const on = configWidget.options[opt.key] === choice.value;
                  return (
                    <button
                      key={choice.value}
                      className={"chip" + (on ? " on" : "")}
                      aria-pressed={on}
                      onClick={() =>
                        patchWidget(configWidget.id, { options: { ...configWidget.options, [opt.key]: choice.value } })
                      }
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="setting">
            <span>Afficher le titre</span>
            <Switch
              label="Afficher le titre"
              checked={configWidget.showTitle}
              onChange={(showTitle) => patchWidget(configWidget.id, { showTitle })}
            />
          </div>
          <button className="btn center" onClick={() => removeWidget(configWidget.id)}>
            <Icon name="trash" size={18} /> Supprimer ce widget
          </button>
        </Modal>
      )}

      {editing && screenOpen && (
        <Modal title="Écran" onClose={() => setScreenOpen(false)}>
          <div className="info-box">
            <span className="strong">Noir pur sur tout l’écran</span>
            <span className="muted small">
              Le fond est #000 : sur un écran OLED, un pixel noir est éteint et ne consomme rien. Les widgets
              n’allument que leurs contenus.
            </span>
          </div>
          <div className="setting">
            <div className="setting-text">
              <span>Atténuer la nuit</span>
              <span className="muted small">
                Réduit la luminosité de l’interface. L’interrupteur en donne un aperçu immédiat ; la plage
                horaire viendra plus tard.
              </span>
            </div>
            <Switch label="Atténuer la nuit" checked={draft.screen.dim} onChange={(dim) => setScreen({ dim })} />
          </div>
          <div className="setting">
            <div className="setting-text">
              <span>Anti-rémanence</span>
              <span className="muted small">
                Décale très légèrement toute l’interface de façon régulière, pour éviter que les éléments fixes
                marquent la dalle.
              </span>
            </div>
            <Switch label="Anti-rémanence" checked={draft.screen.drift} onChange={(drift) => setScreen({ drift })} />
          </div>
        </Modal>
      )}

      {editing && drawerOpen && (
        <div className="drawer">
          <div className="drawer-head">
            <h2 className="drawer-title">Ajouter un widget</h2>
            <div className="topbar-right">
              <Link className="btn" href="/boutique" target="_blank">Parcourir la boutique de plugins</Link>
              <button className="btn-icon" aria-label="Fermer" onClick={() => setDrawerOpen(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>
          <div className="drawer-cards">
            {listWidgets().map((def) => (
              <div key={def.type} className="drawer-card">
                <span className="eyebrow">
                  {def.source === "default" ? "Plugin par défaut" : "Communautaire"} · {def.sizes.default[0]} × {def.sizes.default[1]}
                </span>
                <span className="card-heading">{def.name}</span>
                <span className="muted small">{def.description}</span>
                <button className="btn btn-primary center" style={{ marginTop: "auto" }} onClick={() => addWidget(def.type)}>
                  Ajouter
                </button>
              </div>
            ))}
            <div className="drawer-card soon">
              <span className="eyebrow">Bientôt</span>
              <span className="card-heading muted">Domotique</span>
              <span className="dim small">Lumières, volets et capteurs de la maison, via un plugin dédié.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Vue téléphone : lecture seule, widgets empilés + onglets ---------- */

const TABS: { key: string; label: string; icon: IconName; type?: string }[] = [
  { key: "home", label: "Accueil", icon: "home" },
  { key: "calendar", label: "Agenda", icon: "calendar", type: "calendar" },
  { key: "shopping", label: "Courses", icon: "cart", type: "shopping" },
  { key: "chores", label: "Corvées", icon: "repeat", type: "chores" },
];

function PhoneView({ state }: { state: BoardState }) {
  const [tab, setTab] = useState("home");
  const now = new Date();
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];

  // Même contenu que l'écran mural, lu de haut en bas puis de gauche à droite.
  const ordered = [...state.widgets].sort((a, b) => {
    const ca = state.layout.find((l) => l.i === a.id);
    const cb = state.layout.find((l) => l.i === b.id);
    return (ca?.y ?? 0) - (cb?.y ?? 0) || (ca?.x ?? 0) - (cb?.x ?? 0);
  });

  let content;
  if (active.type) {
    const def = getWidget(active.type);
    const placed =
      state.widgets.find((w) => w.type === active.type) ??
      (def && { id: active.type, type: active.type, showTitle: true, options: { ...def.defaultOptions } });
    content = placed && (
      <div className="phone-full">
        <WidgetFrame widget={{ ...placed, showTitle: true }} w={2} h={5} height={46 * 12 + 64} />
      </div>
    );
  } else {
    content = (
      <div className="phone-grid">
        {ordered.map((widget) => {
          const cell = state.layout.find((l) => l.i === widget.id);
          const small = !!cell && cell.h === 1 && cell.w <= 2;
          return (
            <div key={widget.id} className={small ? "phone-half" : "phone-wide"}>
              <WidgetFrame
                widget={{ ...widget, showTitle: widget.type !== "clock" }}
                w={2}
                h={small ? 2 : 3}
                height={small ? 150 : 46 * 5 + 64}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <header className="phone-head">
        <div className="muted small">
          {DAYS[now.getDay()]} {now.getDate()} {MONTHS[now.getMonth()]}
        </div>
        <h1 className="phone-title">Maison</h1>
      </header>
      {content}
      <nav className="phone-tabs" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={"phone-tab" + (t.key === tab ? " on" : "")}
            aria-current={t.key === tab ? "page" : undefined}
            onClick={() => setTab(t.key)}
          >
            <Icon name={t.icon} size={22} />
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
