export default function ProcessCasesPanel({
  inputs = { densityMode: "sg", densityUnit: "kg/m³", processCases: [] },
  onInputChange = () => {},
  onProcessCaseChange = () => {},
  onAddProcessCase = () => {},
  onDeleteProcessCase = () => {},
}) {
  return (
    <section className="panel process-cases-panel">
      <div className="panel-header">
        <div>
          <h2>Process Cases</h2>
        </div>

        <button
          type="button"
          className="add-case-button"
          onClick={onAddProcessCase}
        >
          + Add Case
        </button>
      </div>

      <div className="process-cases-table-wrapper">
        <div className="process-cases-table">
          <div
            className={`process-cases-header process-cases-row ${
              inputs.densityMode === "rho" ? "density-mode" : "sg-mode"
            }`}
          >
            <div>Case</div>
            <div></div>
            <div>Q/m</div>
            <div></div>
            <div></div>

            <div className="density-toggle-cell">
              <button
                type="button"
                className={`density-toggle-pill ${
                  inputs.densityMode === "rho" ? "rho-active" : "sg-active"
                }`}
                onClick={() =>
                  onInputChange(
                    "densityMode",
                    inputs.densityMode === "sg" ? "rho" : "sg"
                  )
                }
                aria-label="Toggle between specific gravity and density"
              >
                <span className="density-toggle-slider" />
                <span className="density-toggle-option">S.G.</span>
                <span className="density-toggle-option">ρ</span>
              </button>
            </div>

            {inputs.densityMode === "rho" && <div></div>}

            <div></div>
            <div>T</div>
            <div></div>
            <div></div>

            <div>
              P<sub>In</sub>
            </div>

            <div>
              P<sub>Out</sub>
            </div>

            {/* Inlet/outlet pressure units */}
            <div></div>

            {/* Gap before vapour pressure */}
            <div></div>

            <div title="Vapour pressure">
              p<sub>V</sub>
            </div>

            {/* Vapour-pressure units */}
            <div></div>

            {/* Delete button */}
            <div></div>
          </div>

          {inputs.processCases.map((processCase) => (
            <div
              key={processCase.id}
              className={`process-cases-row ${
                inputs.densityMode === "rho" ? "density-mode" : "sg-mode"
              }`}
            >
              <div className="process-case-cell">
                <input
                  type="text"
                  value={processCase.caseName}
                  onChange={(event) =>
                    onProcessCaseChange(
                      processCase.id,
                      "caseName",
                      event.target.value
                    )
                  }
                  placeholder={`Case ${processCase.id}`}
                />
              </div>

              <div></div>

              <div className="process-case-cell">
                <input
                  type="number"
                  value={processCase.flowRate}
                  onChange={(event) =>
                    onProcessCaseChange(
                      processCase.id,
                      "flowRate",
                      event.target.value
                    )
                  }
                  placeholder="100"
                />
              </div>

              <div className="process-case-cell">
                <select
                  value={processCase.flowUnit}
                  onChange={(event) =>
                    onProcessCaseChange(
                      processCase.id,
                      "flowUnit",
                      event.target.value
                    )
                  }
                >
                  <option value="m3/h">m³/h</option>
                  <option value="m3/s">m³/s</option>
                  <option value="lph">lph</option>
                  <option value="lps">l/s</option>
                  <option value="gpm">gpm</option>
                  <option value="bpd">bpd</option>
                  <option value="kgh">kg/h</option>
                  <option value="teh">te/h</option>
                  <option value="lbh">lb/h</option>
                  <option value="kgs">kg/s</option>
                </select>
              </div>

              <div></div>

              {inputs.densityMode === "sg" ? (
                <div className="process-case-cell">
                  <input
                    type="number"
                    value={processCase.specificGravity}
                    onChange={(event) =>
                      onProcessCaseChange(
                        processCase.id,
                        "specificGravity",
                        event.target.value
                      )
                    }
                    placeholder="1.0"
                  />
                </div>
              ) : (
                <>
                  <div className="process-case-cell">
                    <input
                      type="number"
                      value={processCase.density}
                      onChange={(event) =>
                        onProcessCaseChange(
                          processCase.id,
                          "density",
                          event.target.value
                        )
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
                  value={processCase.temperature}
                  onChange={(event) =>
                    onProcessCaseChange(
                      processCase.id,
                      "temperature",
                      event.target.value
                    )
                  }
                  placeholder="60"
                />
              </div>

              <div className="process-case-cell">
                <select
                  value={processCase.temperatureUnit}
                  onChange={(event) =>
                    onProcessCaseChange(
                      processCase.id,
                      "temperatureUnit",
                      event.target.value
                    )
                  }
                >
                  <option value="oC">°C</option>
                  <option value="oF">°F</option>
                  <option value="K">K</option>
                </select>
              </div>

              <div></div>

              <div className="process-case-cell">
                <input
                  type="number"
                  value={processCase.pressureIn}
                  onChange={(event) =>
                    onProcessCaseChange(
                      processCase.id,
                      "pressureIn",
                      event.target.value
                    )
                  }
                  placeholder="20"
                />
              </div>

              <div className="process-case-cell">
                <input
                  type="number"
                  value={processCase.pressureOut}
                  onChange={(event) =>
                    onProcessCaseChange(
                      processCase.id,
                      "pressureOut",
                      event.target.value
                    )
                  }
                  placeholder="15"
                />
              </div>

              <div className="process-case-cell">
                <select
                  value={processCase.pressureUnit}
                  onChange={(event) =>
                    onProcessCaseChange(
                      processCase.id,
                      "pressureUnit",
                      event.target.value
                    )
                  }
                  aria-label={`Inlet and outlet pressure units for ${processCase.caseName}`}
                >
                  <option value="barg">barg</option>
                  <option value="bara">bara</option>
                  <option value="psig">psig</option>
                  <option value="psia">psia</option>
                  <option value="kPag">kPag</option>
                  <option value="kPaa">kPaa</option>
                  <option value="kgcm2g">kgcm²g</option>
                  <option value="kgcm2a">kgcm²a</option>
                  <option value="MPag">MPag</option>
                  <option value="MPaa">MPaa</option>
                </select>
              </div>

              {/* Gap before vapour pressure */}
              <div></div>

              <div className="process-case-cell">
                <input
                  type="number"
                  step="any"
                  value={processCase.vapourPressure ?? ""}
                  onChange={(event) =>
                    onProcessCaseChange(
                      processCase.id,
                      "vapourPressure",
                      event.target.value
                    )
                  }
                  aria-label={`Vapour pressure for ${processCase.caseName}`}
                  title="Vapour pressure"
                />
              </div>

              <div className="process-case-cell">
                <select
                  value={processCase.vapourPressureUnit ?? "bara"}
                  onChange={(event) =>
                    onProcessCaseChange(
                      processCase.id,
                      "vapourPressureUnit",
                      event.target.value
                    )
                  }
                  aria-label={`Vapour-pressure units for ${processCase.caseName}`}
                >
                  <option value="bara">bara</option>
                  <option value="psia">psia</option>
                  <option value="kPaa">kPaa</option>
                  <option value="kgcm2a">kgcm²a</option>
                  <option value="MPaa">MPaa</option>
                </select>
              </div>

              <div className="process-case-cell delete-case-cell">
                <button
                  type="button"
                  className="delete-case-button"
                  onClick={() => onDeleteProcessCase(processCase.id)}
                  aria-label={`Delete ${processCase.caseName}`}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}