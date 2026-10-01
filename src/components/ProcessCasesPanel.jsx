function ProcessCasesPanel({ inputs, onInputChange }) {
  return (
    <section className="panel process-cases-panel">
      <div className="panel-header">
        <div>
          <h2>Process Cases</h2>
        </div>
      </div>

      <div className="process-cases-table-wrapper">
        <div className="process-cases-table">
          <div className="process-cases-header process-cases-row">
            <div>Case</div><div></div><div>Q/m</div><div></div>
            <div></div>
            <div className="density-toggle-cell">
              <span
                className={
                  inputs.densityMode === "sg"
                    ? "density-toggle-label active"
                    : "density-toggle-label"
                }
              >
                S.G.
              </span>

              <button
                type="button"
                className={
                  inputs.densityMode === "rho"
                    ? "density-toggle-switch active"
                    : "density-toggle-switch"
                }
                onClick={() =>
                  onInputChange(
                    "densityMode",
                    inputs.densityMode === "sg" ? "rho" : "sg"
                  )
                }
                aria-label="Toggle between specific gravity and density"
              >
                <span className="density-toggle-thumb" />
              </button>

              <span
                className={
                  inputs.densityMode === "rho"
                    ? "density-toggle-label active"
                    : "density-toggle-label"
                }
              >
                ρ
              </span>
            </div>
            <div></div><div>T</div><div></div>
            <div></div><div>P<sub>In</sub></div><div>P<sub>Out</sub></div><div></div>
          </div>

          <div className="process-cases-row">
            <div className="process-case-cell">
              <input
                type="text"
                value={inputs.caseName}
                onChange={(event) =>
                  onInputChange("caseName", event.target.value)
                }
                placeholder="Case 1"
              />
            </div>

            <div></div>

            <div className="process-case-cell">
              <input
                type="number"
                value={inputs.flowRateGpm}
                onChange={(event) =>
                  onInputChange("flowRateGpm", event.target.value)
                }
                placeholder="100"
              />
            </div>

            <div className="process-case-cell">
              <select value="m3/h">
                <option value="m3/h">m³/h</option>,
                <option value="m3/s">m³/s</option>,
                <option value="lph">lph</option>,
                <option value="lps">l/s</option>,
                <option value="gpm">gpm</option>,
                <option value="bpd">bpd</option>,
                <option value="kgh">kg/h</option>,
                <option value="teh">te/h</option>,
                <option value="lbh">lb/h</option>,
                <option value="kgs">kg/s</option>
              </select>
            </div>

            <div></div>

            {inputs.densityMode === "sg" ? (
              <div className="process-case-cell">
                <input
                  type="number"
                  value={inputs.specificGravity}
                  onChange={(event) =>
                    onInputChange("specificGravity", event.target.value)
                  }
                  placeholder="1.0"
                />
              </div>
            ) : (
              <>
                <div className="process-case-cell">
                  <input
                    type="number"
                    value={inputs.density}
                    onChange={(event) =>
                      onInputChange("density", event.target.value)
                    }
                    placeholder="1000"
                  />
                </div>

                <div className="process-case-cell">
                  <select
                    value={inputs.densityUnit}
                    onChange={(event) =>
                      onInputChange("densityUnit", event.target.value)
                    }
                  >
                    <option value="kg/m³">kg/m³</option>
                    <option value="lb/ft³">lb/ft³</option>
                  </select>
                </div>
              </>
            )}

            <div></div>

            <div className="process-case-cell">
              <input
                type="number"
                value={inputs.temperature}
                onChange={(event) =>
                  onInputChange("temperature", event.target.value)
                }
                placeholder="60"
              />
            </div>

            <div className="process-case-cell">
              <select value="°C">
                <option value="oC">°C</option>,
                <option value="oF">°F</option>,
                <option value="K">K</option>
              </select>
            </div>

            <div></div>

            <div className="process-case-cell">
              <input
                type="number"
                value={inputs.pressure}
                onChange={(event) =>
                  onInputChange("pressure", event.target.value)
                }
                placeholder="100"
              />
            </div>

            <div className="process-case-cell">
              <input
                type="number"
                value={inputs.pressure}
                onChange={(event) =>
                  onInputChange("pressure", event.target.value)
                }
                placeholder="100"
              />
            </div>

            <div className="process-case-cell">
              <select value="barg">
                <option value="barg">barg</option>,
                <option value="bara">bara</option>,
                <option value="psig">psig</option>,
                <option value="psia">psia</option>,
                <option value="kPag">kPag</option>,
                <option value="kPaa">kPaa</option>,
                <option value="kgcm2g">kgcm²g</option>,
                <option value="kgcm2a">kgcm²a</option>,
                <option value="MPag">MPag</option>,
                <option value="MPaa">MPaa</option>
              </select>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}

export default ProcessCasesPanel;