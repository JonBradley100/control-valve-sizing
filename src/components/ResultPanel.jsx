import { formatNumber } from "../utils/formatNumber";

function ResultPanel({ inputs, result }) {
  return (
    <div className="panel result-panel">
      <h2>Result</h2>

      {result ? (
        <>
          <div className="result-value">
            <span>Required Cv</span>
            <strong>{formatNumber(result.requiredCv, 2)}</strong>
          </div>

          <div className="formula-box">
            <h3>Calculation used</h3>
            <p>Cv = Q × √(SG / ΔP)</p>
            <p>
              Cv = {inputs.flowRateGpm} × √({inputs.specificGravity} /{" "}
              {inputs.pressureDropPsi})
            </p>
          </div>

          <div className="note-box">
            <strong>{result.calculationBasis}</strong>
            <p>{result.flowRegime}</p>

            {result.warnings.length > 0 && (
              <ul>
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div className="empty-result">
          Enter positive values for flow rate, specific gravity and pressure
          drop.
        </div>
      )}
    </div>
  );
}

export default ResultPanel;