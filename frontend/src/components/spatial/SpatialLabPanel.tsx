"use client";

import { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (!open) return;
    const node = panelRef.current;
    node?.querySelector<HTMLElement>("button, [href], input")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
