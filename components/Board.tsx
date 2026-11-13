"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GridLayout, { useContainerWidth, type EventCallback, type Layout, type LayoutItem } from "react-grid-layout";
import { countItems, saveBoardView } from "@/app/actions";
import { authClient } from "@/lib/auth-client";
import { BoardProvider } from "@/lib/board-context";
import { GRID_COLS, type BoardRole, type BoardState, type PlacedWidget } from "@/lib/board-types";
import { createPushCompactor, type MoveSession } from "@/lib/placement";
import { getWidget, listWidgets } from "@/lib/widgets";
import { DAYS, MONTHS } from "@/lib/demo-data";
import Icon, { type IconName } from "@/components/Icon";
import Modal, { ConfirmDialog, Switch } from "@/components/Modal";
import "@/components/widgets"; // enregistre les widgets par défaut

const COLS = GRID_COLS;
const ROWS = 5; // lignes visibles sans défilement sur l'écran mural
const GAP = 16;
const HEADER = 72;
const PHONE_QUERY = "(max-width: 760px)";

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

/** Vrai sur un écran étroit (téléphone) : on y affiche la vue empilée, sans mode édition. */
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

/** Le titre affiché : celui choisi par l'utilisateur, sinon celui du widget. */
function widgetTitle(widget: PlacedWidget): string {
  return widget.title?.trim() || getWidget(widget.type)?.title(widget.options) || "";
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
  const title = widgetTitle(widget);
  const bodyHeight = height - 38 - (widget.showTitle ? 26 : 0);
  return (
    <section className="widget" aria-label={title}>
      {widget.showTitle && <h2 className="widget-title">{title}</h2>}
      <div className="widget-body">
        <def.Component w={w} h={h} bodyHeight={bodyHeight} options={widget.options} dataId={widget.dataId} />
      </div>
    </section>
  );
}

export default function Board({
  boardId,
  boardName,
  role,
  initialState,
}: {
  boardId: string;
  boardName: string;
  role: BoardRole;
  initialState: BoardState;
}) {
  const router = useRouter();
  const isAdmin = role === "admin";

  // "saved" = dernier état enregistré en base. "draft" = brouillon du mode édition,
  // jamais envoyé tant que l'utilisateur n'a pas cliqué « Enregistrer ».
  const [saved, setSaved] = useState<BoardState>(initialState);
  const [draft, setDraft] = useState<BoardState>(initialState);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [screenOpen, setScreenOpen] = useState(false);
  // Suppression en attente de confirmation (le widget a des données).
  const [toRemove, setToRemove] = useState<{ widget: PlacedWidget; count: number } | null>(null);
  // Widget en cours de déplacement ou de redimensionnement, avec sa taille en direct.
  const [active, setActive] = useState<{ id: string; w: number; h: number } | null>(null);

  const { width, containerRef, mounted } = useContainerWidth();
  const rowHeight = useRowHeight();
  const phone = useIsPhone();

  const isPhone = mounted && phone;
  const state = editing ? draft : saved;
  const boardInfo = useMemo(() => ({ boardId, role }), [boardId, role]);

  const closePanels = () => {
    setConfigId(null);
    setDrawerOpen(false);
    setScreenOpen(false);
  };

  const startEdit = () => {
    setDraft(saved); // on repart toujours d'une copie de l'état enregistré
    setSaveError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(saved); // on jette le brouillon
    setEditing(false);
    closePanels();
  };

  const saveEdit = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveBoardView(boardId, draft);
      setSaved(draft);
      setEditing(false);
      closePanels();
    } catch {
      // On reste en mode édition : le brouillon n'est pas perdu.
      setSaveError("Enregistrement impossible. Vérifiez la connexion et réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
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

  // Geste en cours : sert au calcul des collisions (voir lib/placement.ts).
  const moveSession = useRef<MoveSession | null>(null);
  const compactor = useMemo(() => createPushCompactor(moveSession), []);

  const startMove: EventCallback = useCallback((layout, _old, item) => {
    if (!item) return;
    moveSession.current = {
      id: item.i,
      origin: layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })),
    };
    setActive({ id: item.i, w: item.w, h: item.h });
  }, []);
  const trackActive: EventCallback = useCallback((_layout, _old, item) => {
    if (item) setActive({ id: item.i, w: item.w, h: item.h });
  }, []);
  const endMove = useCallback(() => {
    moveSession.current = null;
    setActive(null);
  }, []);

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
    setToRemove(null);
  };

  /** Supprimer un widget supprime ses données : on demande confirmation s'il en a. */
  const askRemoveWidget = async (target: PlacedWidget) => {
    const isSaved = saved.widgets.some((w) => w.id === target.id);
    if (!getWidget(target.type)?.storesData || !isSaved) return removeWidget(target.id);
    let count = 1; // dans le doute (serveur injoignable), on demande confirmation
    try {
      count = await countItems(boardId, target.dataId);
    } catch {
      /* on garde la confirmation */
    }
    if (count === 0) removeWidget(target.id);
    else setToRemove({ widget: target, count });
  };

  const addWidget = (type: string) => {
    const def = getWidget(type);
    if (!def) return;
    const id = crypto.randomUUID();
    const [w, h] = def.sizes.default;
    setDraft((prev) => ({
      ...prev,
      widgets: [
        ...prev.widgets,
        // Un nouveau widget arrive avec sa propre liste de données, vide.
        { id, type, showTitle: def.defaultShowTitle, title: null, options: { ...def.defaultOptions }, dataId: crypto.randomUUID() },
      ],
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
    <BoardProvider value={boardInfo}>
      <div className={"board" + (isPhone ? " phone" : "")}>
        {!isPhone && (
          <header className="topbar">
            <div className="topbar-left">
              <Icon name="home" size={26} color="var(--accent)" />
              <h1 className="brand">{boardName}</h1>
              {editing && <span className="tag">Mode édition</span>}
              {saveError && <span className="save-error" role="alert">{saveError}</span>}
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
                  <button className="btn" onClick={cancelEdit} disabled={saving}>Annuler</button>
                  <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                    {saving ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </>
              ) : (
                <>
                  {isAdmin && (
                    <button className="btn-icon subtle" aria-label="Personnaliser l'écran d'accueil" title="Personnaliser" onClick={startEdit}>
                      <Icon name="pencil" />
                    </button>
                  )}
                  <button className="btn-icon subtle" aria-label="Se déconnecter" title="Se déconnecter" onClick={signOut}>
                    <Icon name="logout" />
                  </button>
                </>
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
          {mounted && isPhone && <PhoneView state={saved} boardName={boardName} onSignOut={signOut} />}

          {mounted && !isPhone && state.widgets.length === 0 && (
            <div className="empty">
              Aucun widget.{" "}
              {editing
                ? "Utilisez « Ajouter un widget »."
                : isAdmin
                  ? "Passez en mode édition pour en ajouter."
                  : "Un administrateur du board peut en ajouter."}
            </div>
          )}

          {mounted && !isPhone && editing && active && (
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

          {mounted && !isPhone && (
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
              compactor={compactor}
              onLayoutChange={onLayoutChange}
              onDragStart={startMove}
              onDragStop={endMove}
              onResizeStart={startMove}
              onResize={trackActive}
              onResizeStop={endMove}
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
                          <button className="btn-icon edit-btn" aria-label={`Supprimer ${def.name}`} title="Supprimer" onClick={() => askRemoveWidget(widget)}>
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
            <div>
              <label className="field-label" htmlFor="widget-title">Titre</label>
              <input
                id="widget-title"
                className="input block"
                maxLength={80}
                placeholder={configDef.title(configWidget.options)}
                value={configWidget.title ?? ""}
                onChange={(e) => patchWidget(configWidget.id, { title: e.target.value || null })}
              />
            </div>
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
            <button className="btn center" onClick={() => askRemoveWidget(configWidget)}>
              <Icon name="trash" size={18} /> Supprimer ce widget
            </button>
          </Modal>
        )}

        {toRemove && (
          <ConfirmDialog
            title={`Supprimer « ${widgetTitle(toRemove.widget)} » ?`}
            message={
              toRemove.count > 1
                ? `Ce widget contient ${toRemove.count} éléments. Ils seront définitivement supprimés quand vous enregistrerez.`
                : "Ce widget contient des données. Elles seront définitivement supprimées quand vous enregistrerez."
            }
            confirmLabel="Supprimer"
            onCancel={() => setToRemove(null)}
            onConfirm={() => removeWidget(toRemove.widget.id)}
          />
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
    </BoardProvider>
  );
}

/* ---------- Vue téléphone : widgets empilés + onglets, sans mode édition ---------- */

const TABS: { key: string; label: string; icon: IconName; type?: string }[] = [
  { key: "home", label: "Accueil", icon: "home" },
  { key: "calendar", label: "Agenda", icon: "calendar", type: "calendar" },
  { key: "shopping", label: "Courses", icon: "cart", type: "shopping" },
  { key: "chores", label: "Corvées", icon: "repeat", type: "chores" },
];

function PhoneView({
  state,
  boardName,
  onSignOut,
}: {
  state: BoardState;
  boardName: string;
  onSignOut: () => void;
}) {
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
    // L'onglet affiche en grand le premier widget de ce type présent sur le board.
    const placed = ordered.find((w) => w.type === active.type);
    content = (
      <div className="phone-full">
        {placed ? (
          <WidgetFrame widget={{ ...placed, showTitle: true }} w={2} h={5} height={46 * 12 + 64} />
        ) : (
          <div className="empty static">Ce board n’a pas de widget « {active.label} ».</div>
        )}
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
        <div>
          <div className="muted small">
            {DAYS[now.getDay()]} {now.getDate()} {MONTHS[now.getMonth()]}
          </div>
          <h1 className="phone-title">{boardName}</h1>
        </div>
        <button className="btn-icon subtle" aria-label="Se déconnecter" onClick={onSignOut}>
          <Icon name="logout" />
        </button>
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
