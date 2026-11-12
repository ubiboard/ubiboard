"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/Icon";

/**
 * Modale centrée. Rendue dans <body> : les widgets vivent dans des éléments
 * transformés (grille, anti-rémanence), où `position: fixed` ne couvrirait
 * pas l'écran.
 */
export default function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2 className="modal-title">{title}</h2>
            {subtitle && <div className="muted small">{subtitle}</div>}
          </div>
          <button className="btn-icon" aria-label="Fermer" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/** Demande de confirmation avant une action irréversible. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      {message && <div className="muted">{message}</div>}
      <div className="modal-actions">
        <button className="btn" onClick={onCancel}>Annuler</button>
        <button className="btn btn-primary" autoFocus onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={"switch" + (checked ? " on" : "")}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" />
    </button>
  );
}
