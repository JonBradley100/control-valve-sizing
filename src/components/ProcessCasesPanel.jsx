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
            <div>Case Name</div>
            <div>Flow Rate</div>
            <div>Q/m</div>
            <div>Specific Gravity</div>
            <div>Temperature</div>
            <div>Pressure</div>
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
              <select value="gpm" disabled>
                <option value="gpm">gpm</option>
              </select>
            </div>

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
              <input
                type="number"
                value={inputs.pressure}
                onChange={(event) =>
                  onInputChange("pressure", event.target.value)
                }
                placeholder="100"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ProcessCasesPanel;