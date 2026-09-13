import { useMemo, useState } from "react";
import "./App.css";

function calculateLiquidKv({ flowRateM3h, specificGravity, pressureDropBar }) {
  const q = Number(flowRateM3h);
  const sg = Number(specificGravity);
  const dp = Number(pressureDropBar);

  if (!q || !sg || !dp || q <= 0 || sg <= 0 || dp <= 0) {
    return null;
  }

  const kv = q * Math.sqrt(sg / dp);

  return {
    kv,
    roundedKv: Number(kv.toFixed(2)),
  };
}

function App() {
  const [inputs, setInputs] = useState({
    tagNumber: "LV-1001",
    fluidName: "Water",
    flowRateM3h: 10,
    specificGravity: 1,
    pressureDropBar: 1,
  });

  const result = useMemo(() => calculateLiquidKv(inputs), [inputs]);

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
          <h1>Liquid sizing prototype</h1>
          <p className="hero-text">
            First working version for calculating a basic liquid valve flow
            coefficient using metric units.
          </p>
        </div>

        <div className="status-card">
          <span className="status-dot" />
          <div>
            <strong>Version 0.1.0</strong>
            <p>Prototype calculation only</p>
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
            Flow rate, Q
            <div className="input-with-unit">
              <input
                type="number"
                value={inputs.flowRateM3h}
                onChange={(event) =>
                  updateInput("flowRateM3h", event.target.value)
                }
              />
              <span>m³/h</span>
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
                value={inputs.pressureDropBar}
                onChange={(event) =>
                  updateInput("pressureDropBar", event.target.value)
                }
              />
              <span>bar</span>
            </div>
          </label>
        </div>

        <div className="panel result-panel">
          <h2>Result</h2>

          {result ? (
            <>
              <div className="result-value">
                <span>Required Kv</span>
                <strong>{result.roundedKv}</strong>
              </div>

              <div className="formula-box">
                <h3>Calculation used</h3>
                <p>Kv = Q × √(SG / ΔP)</p>
                <p>
                  Kv = {inputs.flowRateM3h} × √({inputs.specificGravity} /{" "}
                  {inputs.pressureDropBar})
                </p>
              </div>

              <div className="note-box">
                <strong>Important:</strong>
                <p>
                  This is a simplified first-pass liquid sizing calculation. It
                  does not yet include cavitation, flashing, viscosity
                  correction, fittings, choked flow, valve style limits, or
                  manufacturer-specific data.
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