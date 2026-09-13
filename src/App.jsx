import { useMemo, useState } from "react";
import "./App.css";

function calculateLiquidCv({ flowRateGpm, specificGravity, pressureDropPsi }) {
  const q = Number(flowRateGpm);
  const sg = Number(specificGravity);
  const dp = Number(pressureDropPsi);

  if (!q || !sg || !dp || q <= 0 || sg <= 0 || dp <= 0) {
    return null;
  }

  // Preliminary incompressible liquid relationship.
  // Full IEC 60534 implementation will add correction factors and limit checks.
  const cv = q * Math.sqrt(sg / dp);

  return {
    cv,
    roundedCv: Number(cv.toFixed(2)),
  };
}

function App() {
  const [inputs, setInputs] = useState({
    tagNumber: "LV-1001",
    fluidName: "Water",
    flowRateGpm: 100,
    specificGravity: 1,
    pressureDropPsi: 10,
  });

  const result = useMemo(() => calculateLiquidCv(inputs), [inputs]);

  function updateInput(field, value) {
    setInputs((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Control Valve Sizing Tool</p>
          <h1>Liquid Cv sizing prototype</h1>
          <p className="hero-text">
            First working version for calculating a preliminary liquid valve flow
            coefficient using Cv-based units. The calculation engine will be
            developed in accordance with IEC 60534.
          </p>
        </div>

        <div className="status-card">
          <span className="status-dot" />
          <div>
            <strong>Version 0.1.1</strong>
            <p>IEC 60534 basis selected</p>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <div className="panel">
          <h2>Input data</h2>

          <label>
            Tag number
            <input
              type="text"
              value={inputs.tagNumber}
              onChange={(event) => updateInput("tagNumber", event.target.value)}
            />
          </label>

          <label>
            Fluid name
            <input
              type="text"
              value={inputs.fluidName}
              onChange={(event) => updateInput("fluidName", event.target.value)}
            />
          </label>

          <label>
            Liquid flow rate, Q
            <div className="input-with-unit">
              <input
                type="number"
                value={inputs.flowRateGpm}
                onChange={(event) =>
                  updateInput("flowRateGpm", event.target.value)
                }
              />
              <span>gpm</span>
            </div>
          </label>

          <label>
            Specific gravity, SG
            <input
              type="number"
              step="0.01"
              value={inputs.specificGravity}
              onChange={(event) =>
                updateInput("specificGravity", event.target.value)
              }
            />
          </label>

          <label>
            Pressure drop, ΔP
            <div className="input-with-unit">
              <input
                type="number"
                step="0.01"
                value={inputs.pressureDropPsi}
                onChange={(event) =>
                  updateInput("pressureDropPsi", event.target.value)
                }
              />
              <span>psi</span>
            </div>
          </label>
        </div>

        <div className="panel result-panel">
          <h2>Result</h2>

          {result ? (
            <>
              <div className="result-value">
                <span>Required Cv</span>
                <strong>{result.roundedCv}</strong>
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
                <strong>IEC 60534 development note:</strong>
                <p>
                  This screen currently uses a simplified preliminary
                  incompressible liquid Cv relationship. The full calculation
                  engine will be developed around IEC 60534 methodology,
                  including pressure recovery, choked flow, cavitation,
                  flashing, Reynolds correction, attached fittings, and
                  valve-specific coefficients.
                </p>
              </div>
            </>
          ) : (
            <div className="empty-result">
              Enter positive values for flow rate, specific gravity and pressure
              drop.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default App;