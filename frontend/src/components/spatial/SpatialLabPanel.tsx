"use client";

import { useEffect, useRef } from "react";
import { focusableElements, nextDialogFocus } from "@/lib/spatialLab";
import SpatialLabView, { type LabModel } from "./SpatialLabView";

type Props = {
  open: boolean;
  model: LabModel;
  campusId: string | null;
  onCampus: (id: string) => void;
  loading: boolean;
  unavailable: boolean;
  onClose: () => void;
  onReturn: () => void;
  returnLabel: string;
  tileTemplate: string | null;
};

export default function SpatialLabPanel({
  open,
  model,
  campusId,
  onCampus,
  loading,
  unavailable,
  onClose,
  onReturn,
  returnLabel,
  tileTemplate,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = panelRef.current;
    node?.querySelector<HTMLElement>("button, [href], input, select, textarea")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const next = nextDialogFocus(focusableElements(node), document.activeElement, event.shiftKey);
      if (!next) return;
      event.preventDefault();
      next.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="spatial-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="spatial-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spatial-lab-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="spatial-panel-bar">
          <p id="spatial-lab-title" className="spatial-kicker">Spatial Lab</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
        <SpatialLabView
          model={model}
          campusId={campusId}
          onCampus={onCampus}
          loading={loading}
          unavailable={unavailable}
          onReturn={onReturn}
          returnLabel={returnLabel}
          tileTemplate={tileTemplate}
        />
      </div>
    </div>
  );
}
