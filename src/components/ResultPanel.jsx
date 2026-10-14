import { useEffect, useId, useRef, useState } from "react";

function ResultPanel({ result = null }) {
  const processCaseResults = result?.processCaseResults || [];

  const [activeCaseIndex, setActiveCaseIndex] = useState(null);
  const dialogRef = useRef(null);
  const dialogTitleId = useId();

  const activeCase =
    activeCaseIndex !== null
      ? processCaseResults[activeCaseIndex] ?? null
      : null;

  const activeDetails = activeCase?.technicalDetails ?? {};

  // Native dialog provides keyboard focus management and Escape-to-close.
  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (activeCase && !dialog.open) {
      dialog.showModal();
    } else if (!activeCase && dialog.open) {
      dialog.close();
    }
  }, [activeCase]);

  function closeInformation() {
    dialogRef.current?.close();
    setActiveCaseIndex(null);
  }

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

  // Explicitly add an information column to the existing three columns.
  const rowStyle = {
    display: "grid",
    gridTemplateColumns: "2.25rem repeat(3, minmax(0, 1fr))",
    alignItems: "center",
  };

  return (
    <section className="panel results-panel">
      <style>{`
        .results-panel .case-info-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 23px;
          height: 23px;
          padding: 0;
          border: 1px solid #2563eb;
          border-radius: 50%;
          background: #2563eb;
          color: #ffffff;
          font-family: Georgia, serif;
          font-size: 15px;
          font-style: italic;
          font-weight: 700;
          line-height: 1;
          cursor: pointer;
        }

        .results-panel .case-info-button:hover {
          background: #1d4ed8;
          border-color: #1d4ed8;
        }

        .results-panel .case-info-button:focus-visible,
        .case-info-dialog .case-info-close:focus-visible {
          outline: 3px solid #60a5fa;
          outline-offset: 3px;
        }

        .results-panel .case-info-button-cell {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .case-info-dialog {
          box-sizing: border-box;
          width: calc(100% - 2rem);
          max-width: 360px;
          max-height: calc(100dvh - 2rem);
          margin: auto;
          padding: 0;
          overflow: auto;
          border: 1px solid #93c5fd;
          border-radius: 12px;
          background: #eff6ff;
          color: #172554;
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.25);
          font-family: inherit;
        }

        .case-info-dialog::backdrop {
          background: rgba(15, 23, 42, 0.35);
        }

        .case-info-dialog .case-info-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 18px;
          border-bottom: 1px solid #bfdbfe;
          background: #dbeafe;
        }

        .case-info-dialog .case-info-title {
          margin: 0;
          color: #1e40af;
          font-size: 17px;
          font-weight: 700;
        }

        .case-info-dialog .case-info-close {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          padding: 0;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: #1e40af;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
        }

        .case-info-dialog .case-info-close:hover {
          background: #bfdbfe;
        }

        .case-info-dialog .case-info-body {
          padding: 6px 18px 18px;
        }

        .case-info-dialog .case-info-values {
          margin: 0;
        }

        .case-info-dialog .case-info-detail-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 0;
          border-bottom: 1px solid #dbeafe;
        }

        .case-info-dialog .case-info-detail-row dt {
          font-weight: 500;
        }

        .case-info-dialog .case-info-detail-row dd {
          margin: 0;
          color: #1e3a8a;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          overflow-wrap: anywhere;
        }

        .case-info-dialog .case-info-note {
          margin: 14px 0 0;
          color: #475569;
          font-size: 12px;
          line-height: 1.5;
        }
      `}</style>

      <div className="panel-header">
        <div>
          <h2>Results</h2>
        </div>
      </div>

      <div className="results-table-wrapper">
        <div className="results-table">
          <div className="results-header results-row" style={rowStyle}>
            <div aria-hidden="true" />

            <div>
              C<sub>v</sub>
            </div>

            <div>Noise, dBA</div>
            <div>Stroke%</div>
          </div>

          {processCaseResults.length > 0 ? (
            processCaseResults.map((caseResult, index) => {
              const details = caseResult?.technicalDetails ?? {};

              return (
                <div
                  className="results-row"
                  style={rowStyle}
                  key={caseResult.id ?? index}
                >
                  <div className="case-info-button-cell">
                    <button
                      type="button"
                      className="case-info-button"
                      aria-label={`Show technical information for Case ${
                        index + 1
                      }`}
                      aria-haspopup="dialog"
                      title={`Case ${index + 1} information`}
                      onClick={() => setActiveCaseIndex(index)}
                    >
                      <span aria-hidden="true">i</span>
                    </button>
                  </div>

                  <div className="result-cell">
                    <span>{formatValue(caseResult?.requiredCv, 2)}</span>
                  </div>

                  <div className="result-cell">
                    <span>—</span>
                  </div>

                  <div className="result-cell">
                    <span>{formatValue(details.strokePercent, 1)}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="results-row" style={rowStyle}>
              <div aria-hidden="true" />

              <div className="result-cell">
                <span>—</span>
              </div>

              <div className="result-cell">
                <span>—</span>
              </div>

              <div className="result-cell">
                <span>—</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <dialog
        ref={dialogRef}
        className="case-info-dialog"
        aria-labelledby={dialogTitleId}
        onClose={() => setActiveCaseIndex(null)}
        onClick={(event) => {
          // Clicking the shaded background closes the window.
          if (event.target === event.currentTarget) {
            closeInformation();
          }
        }}
      >
        <div className="case-info-content">
          <div className="case-info-header">
            <h3 id={dialogTitleId} className="case-info-title">
              {activeCaseIndex !== null
                ? `Case ${activeCaseIndex + 1}`
                : "Case"}
            </h3>

            <button
              type="button"
              className="case-info-close"
              aria-label="Close technical information"
              onClick={closeInformation}
              autoFocus
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div className="case-info-body">
            <dl className="case-info-values">
              <div className="case-info-detail-row">
                <dt>Valve stroke (%)</dt>
                <dd>{formatValue(activeDetails.strokePercent, 1)}</dd>
              </div>

              <div className="case-info-detail-row">
                <dt>
                  F<sub>L</sub>
                </dt>
                <dd>{formatValue(activeDetails.FL)}</dd>
              </div>

              <div className="case-info-detail-row">
                <dt>
                  F<sub>d</sub>
                </dt>
                <dd>{formatValue(activeDetails.Fd)}</dd>
              </div>

              <div className="case-info-detail-row">
                <dt>
                  x<sub>T</sub>
                </dt>
                <dd>{formatValue(activeDetails.xT)}</dd>
              </div>
            </dl>

            <p className="case-info-note">
              A dash means the value has not yet been calculated or is
              not applicable.
            </p>
          </div>
        </div>
      </dialog>
    </section>
  );
}

export default ResultPanel;