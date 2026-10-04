function ResultPanel({ result }) {
  const processCaseResults = result?.processCaseResults || [];

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

          {processCaseResults.length > 0 ? (
            processCaseResults.map((caseResult) => {
              const requiredCv =
                caseResult?.requiredCv !== null &&
                caseResult?.requiredCv !== undefined
                  ? Number(caseResult.requiredCv).toFixed(2)
                  : "--";

              const noise = "--";
              const strokePercent = "--";

              return (
                <div className="results-row" key={caseResult.id}>
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
              );
            })
          ) : (
            <div className="results-row">
              <div className="result-cell">
                <span>--</span>
              </div>

              <div className="result-cell">
                <span>--</span>
              </div>

              <div className="result-cell">
                <span>--</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default ResultPanel;