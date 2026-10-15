import { useEffect, useId, useRef } from "react";
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
  const dialogTitleId = useId();

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

  return (
    <dialog
      ref={dialogRef}
      className="information-panel"
      aria-labelledby={dialogTitleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeInformation();
        }
      }}
    >
      <div className="information-panel__content">
        <div className="information-panel__header">
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