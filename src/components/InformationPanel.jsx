import { useEffect, useId, useRef, useState } from "react";
import "./InformationPanel.css";

function formatValue(value, decimalPlaces = 3) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return "—";
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(decimalPlaces)
    : "—";
}

function calculateCvPercent(requiredCv, ratedCv) {
  if (
    requiredCv === null ||
    requiredCv === undefined ||
    String(requiredCv).trim() === "" ||
    ratedCv === null ||
    ratedCv === undefined ||
    String(ratedCv).trim() === ""
  ) {
    return null;
  }

  const required = Number(requiredCv);
  const rated = Number(ratedCv);

  if (
    !Number.isFinite(required) ||
    !Number.isFinite(rated) ||
    required < 0 ||
    rated <= 0
  ) {
    return null;
  }

  const percentage = (required / rated) * 100;

  return Number.isFinite(percentage) ? percentage : null;
}

function InformationPanel({
  caseResult = null,
  caseIndex = null,
  ratedCv = null,
  onClose = () => {},
}) {
  const dialogRef = useRef(null);
  const dragRef = useRef(null);
  const dialogTitleId = useId();

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const details = caseResult?.technicalDetails ?? {};

  const cvPercent = calculateCvPercent(
    caseResult?.requiredCv,
    ratedCv
  );

  // Native dialog provides focus management and Escape-to-close.
  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (caseResult && !dialog.open) {
      // Start each newly opened panel in the centre.
      setPosition({ x: 0, y: 0 });
      dialog.showModal();
    } else if (!caseResult && dialog.open) {
      dialog.close();
    }
  }, [caseResult]);

  function closeInformation() {
    const dialog = dialogRef.current;

    if (dialog?.open) {
      // The dialog's onClose event notifies the parent.
      dialog.close();
    } else {
      onClose();
    }
  }

  function startDragging(event) {
    // Only drag with the primary pointer button.
    // Keep the close button independent of dragging.
    if (
      event.button !== 0 ||
      !event.isPrimary ||
      event.target.closest("button") ||
      !dialogRef.current
    ) {
      return;
    }

    const rect = dialogRef.current.getBoundingClientRect();

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialX: position.x,
      initialY: position.y,
      rect,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();

    setIsDragging(true);
  }

  function movePanel(event) {
    const drag = dragRef.current;

    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    const requestedX = event.clientX - drag.startX;
    const requestedY = event.clientY - drag.startY;

    // Keep the panel inside the viewport.
    const movementX = Math.max(
      -drag.rect.left,
      Math.min(
        requestedX,
        window.innerWidth - drag.rect.right
      )
    );

    const movementY = Math.max(
      -drag.rect.top,
      Math.min(
        requestedY,
        window.innerHeight - drag.rect.bottom
      )
    );

    setPosition({
      x: drag.initialX + movementX,
      y: drag.initialY + movementY,
    });
  }

  function stopDragging(event) {
    if (
      !dragRef.current ||
      event.pointerId !== dragRef.current.pointerId
    ) {
      return;
    }

    dragRef.current = null;
    setIsDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="information-panel"
      aria-labelledby={dialogTitleId}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
      onClose={() => {
        dragRef.current = null;
        setIsDragging(false);
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeInformation();
        }
      }}
    >
      <div className="information-panel__content">
        <div
          className="information-panel__header"
          style={{
            cursor: isDragging ? "grabbing" : "grab",
            touchAction: "none",
            userSelect: "none",
          }}
          onPointerDown={startDragging}
          onPointerMove={movePanel}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onLostPointerCapture={stopDragging}
        >
          <h3
            id={dialogTitleId}
            className="information-panel__title"
          >
            {caseIndex !== null
              ? `Case ${caseIndex + 1}`
              : "Case"}
          </h3>

          <button
            type="button"
            className="information-panel__close"
            aria-label="Close technical information"
            onClick={closeInformation}
            autoFocus
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="information-panel__body">
          <dl className="information-panel__values">
            <div className="information-panel__detail-row">
              <dt>
                C<sub>v</sub>%
              </dt>
              <dd>{formatValue(cvPercent, 1)}</dd>
            </div>

            <div className="information-panel__detail-row">
              <dt>
                F<sub>L</sub>
              </dt>
              <dd>{formatValue(details.FL)}</dd>
            </div>

            <div className="information-panel__detail-row">
              <dt>
                F<sub>LP</sub>
              </dt>
              <dd>{formatValue(details.FLP)}</dd>
            </div>

            <div className="information-panel__detail-row">
              <dt>
                F<sub>d</sub>
              </dt>
              <dd>{formatValue(details.Fd)}</dd>
            </div>

            <div className="information-panel__detail-row">
              <dt>
                x<sub>T</sub>
              </dt>
              <dd>{formatValue(details.xT)}</dd>
            </div>
          </dl>

          <p className="information-panel__note">
            Cv% is required Cv divided by selected valve design Cv,
            multiplied by 100. It is not valve stroke.
          </p>

          <p className="information-panel__note">
            A dash means the value has not yet been calculated or is
            not applicable.
          </p>
        </div>
      </div>
    </dialog>
  );
}

export default InformationPanel;