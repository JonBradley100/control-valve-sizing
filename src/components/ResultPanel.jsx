function ResultPanel({ result }) {
  const requiredCv =
    result?.requiredCv !== null && result?.requiredCv !== undefined
      ? Number(result.requiredCv).toFixed(2)
      : "--";

  const noise =
    result?.noise !== null && result?.noise !== undefined
      ? Number(result.noise).toFixed(1)
      : "--";

  const strokePercent =
    result?.strokePercent !== null && result?.strokePercent !== undefined
      ? Number(result.strokePercent).toFixed(1)
      : "--";

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
            <div>C<sub>v</sub></div>
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