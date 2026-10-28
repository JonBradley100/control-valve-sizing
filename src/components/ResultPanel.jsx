import { useState } from "react";
import InformationPanel from "./InformationPanel";
import "./ResultPanel.css";

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

function formatNoise(value) {
  return Number.isFinite(value)
    ? value.toFixed(1)
    : "Unavailable";
}

function ResultPanel({ result = null, ratedCv = null }) {
  const processCaseResults = result?.processCaseResults || [];

  const [activeCaseIndex, setActiveCaseIndex] = useState(null);

  const activeCase =
    activeCaseIndex !== null
      ? processCaseResults[activeCaseIndex] ?? null
      : null;

  function closeInformation() {
    setActiveCaseIndex(null);
  }

  return (
    <section className="panel results-panel">
      <div className="panel-header">
        <div>
          <h2>Results</h2>
        </div>
      </div>

      <div className="results-table-wrapper">
        <div className="results-table">
          <div className="results-header results-row results-info-grid">
            <div aria-hidden="true" />

            <div>
              C<sub>v</sub>
            </div>

            <div>Noise, dB(A)</div>
            <div>Stroke%</div>
          </div>

          {processCaseResults.length > 0 ? (
            processCaseResults.map((caseResult, index) => {
              const details = caseResult?.technicalDetails ?? {};

              return (
                <div
                  className="results-row results-info-grid"
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
                    <span>
                      {formatValue(caseResult?.requiredCv, 2)}
                    </span>
                  </div>

                  <div className="result-cell">
                    <span>
                      {formatNoise(
                        caseResult?.acoustics?.results?.noiseDBA
                      )}
                    </span>
                  </div>

                  <div className="result-cell">
                    <span>
                      {formatValue(details.strokePercent, 1)}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="results-row results-info-grid">
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

      <InformationPanel
        caseResult={activeCase}
        caseIndex={activeCaseIndex}
        ratedCv={ratedCv}
        onClose={closeInformation}
      />
    </section>
  );
}

export default ResultPanel;