function ResultPanel({ result }) {
  const firstCaseResult = result?.processCaseResults?.[0];

  const requiredCv =
    firstCaseResult?.requiredCv !== null &&
    firstCaseResult?.requiredCv !== undefined
      ? Number(firstCaseResult.requiredCv).toFixed(2)
      : "--";

  const noise = "--";
  const strokePercent = "--";

  return (
    <section className="panel results-panel">
      <div className="panel-header">
        <div>
          <h2>Results</h2>
        </div>
      </div>

      <div className="results-table-wrapper">
        <div className="results-table">
          <div className="results-header results-row">
            <div>
              C<sub>v</sub>
            </div>
            <div>Noise, dBA</div>
            <div>Stroke%</div>
          </div>

          <div className="results-row">
            <div className="result-cell">
              <span>{requiredCv}</span>
            </div>

            <div className="result-cell">
              <span>{noise}</span>
            </div>

            <div className="result-cell">
              <span>{strokePercent}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ResultPanel;