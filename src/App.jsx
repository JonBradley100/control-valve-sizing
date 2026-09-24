import { useEffect, useMemo, useState } from "react";
import { loadTrimDatabase } from "./data/loadTrimDatabase";
import { loadFluidDatabase } from "./data/loadFluidDatabase";
import "./App.css";
import { calculateLiquidCv } from "./calculations/iec60534/liquidSizing";
import InputPanel from "./components/InputPanel";
import ResultPanel from "./components/ResultPanel";

function App() {
  const [fluidType, setFluidType] = useState("liquid");

  const [inputs, setInputs] = useState({
    tagNumber: "LV-1001",
    fluidName: "",
    flowRateGpm: 100,
    specificGravity: 1,
    pressureDropPsi: 10,
  });

  const [selectedValve, setSelectedValve] = useState({
    directionality: "CB",
    size: "02",
    pressureClass: "015",
    stages: "1",
    trimType: "S",
    style: "L",
  });

  const [pipework, setPipework] = useState({
    inletPipeSize: "2",
    inletPipeSchedule: "40",
    outletPipeSize: "2",
    outletPipeSchedule: "40",
  });

  const pipeSizeOptions = [
    "2",
    "3",
    "4",
    "6",
    "8",
    "10",
    "12",
    "14",
    "16",
    "18",
    "20",
    "22",
    "24",
    "26",
    "28",
    "30",
    "32",
    "34",
    "36",
    "38",
    "40",
    "42",
    "44",
    "46",
    "48",
  ];

  const scheduleOptions = [
    "5",
    "10",
    "20",
    "40",
    "80",
    "160",
    "STD",
    "XS",
    "XXS",
    "5S",
    "10S",
    "20S",
    "40S",
  ];

  const [trimDatabase, setTrimDatabase] = useState([]);
  const [trimDatabaseError, setTrimDatabaseError] = useState(null);

  const [fluidDatabase, setFluidDatabase] = useState([]);
  const [fluidDatabaseError, setFluidDatabaseError] = useState(null);
  const [selectedFluidName, setSelectedFluidName] = useState("");

  useEffect(() => {
    loadTrimDatabase()
      .then((rows) => {
        console.log("Loaded trim database:", rows);
        console.log("First trim row:", rows[0]);
        setTrimDatabase(rows);
      })
      .catch((error) => {
        console.error(error);
        setTrimDatabaseError(error.message);
      });
  }, []);

  useEffect(() => {
    loadFluidDatabase()
      .then((rows) => {
        console.log("Loaded fluid database:", rows);
        console.log("First fluid row:", rows[0]);
        setFluidDatabase(rows);
      })
      .catch((error) => {
        console.error(error);
        setFluidDatabaseError(error.message);
      });
  }, []);

  useEffect(() => {
    if (selectedFluidName || fluidDatabase.length === 0) {
      return;
    }

    setSelectedFluidName(fluidDatabase[0].fluidName);
  }, [fluidDatabase, selectedFluidName]);

  const selectedFluid = useMemo(() => {
    return (
      fluidDatabase.find((fluid) => fluid.fluidName === selectedFluidName) ||
      null
    );
  }, [fluidDatabase, selectedFluidName]);

  useEffect(() => {
    if (!selectedFluid) {
      return;
    }

    setInputs((current) => ({
      ...current,
      fluidName: selectedFluid.fluidName,
    }));
  }, [selectedFluid]);

  const selectedValveCode = useMemo(() => {
    const stageCode = `${selectedValve.stages}001`;

    return [
      selectedValve.directionality,
      selectedValve.size,
      selectedValve.pressureClass,
      stageCode,
      selectedValve.trimType,
      selectedValve.style,
    ].join("-");
  }, [selectedValve]);

  const selectedTrim = useMemo(() => {
    return (
      trimDatabase.find(
        (trim) => String(trim.code).trim() === selectedValveCode
      ) || null
    );
  }, [trimDatabase, selectedValveCode]);

  const selectedTrimDesignCv = selectedTrim?.designCvNumeric ?? null;

  const result = useMemo(() => {
    if (fluidType === "liquid") {
      return calculateLiquidCv(inputs);
    }

    return {
      requiredCv: null,
      status: "Gas sizing module not yet implemented",
      warnings: ["Gas sizing will be added in the next calculation module."],
    };
  }, [fluidType, inputs]);

  function updateInput(field, value) {
    setInputs((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateSelectedValve(field, value) {
    setSelectedValve((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updatePipework(field, value) {
    setPipework((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const appModeClass = fluidType === "liquid" ? "mode-liquid" : "mode-gas";

  return (
    <main className={`app-shell ${appModeClass}`}>
      <section className="hero">
        <div>
          <div className="title-row">
            <p className="eyebrow">
              <b>IEC60534 Control Valve Sizing</b>
            </p>
            <span className="version-label">Version 0.1.2</span>
          </div>

          <div className="fluid-controls">
            <div className="fluid-toggle-row">
              <div className="fluid-toggle" aria-label="Fluid sizing type">
                <button
                  type="button"
                  className={fluidType === "liquid" ? "active" : ""}
                  onClick={() => setFluidType("liquid")}
                >
                  Liquid
                </button>

                <button
                  type="button"
                  className={fluidType === "gas" ? "active" : ""}
                  onClick={() => setFluidType("gas")}
                >
                  Gas
                </button>
              </div>
            </div>

            <div className="pipework-main-row">
              <div className="fluid-selector-row">
                <label className="fluid-select-label" htmlFor="fluid-select">
                  Fluid :
                </label>

                <select
                  id="fluid-select"
                  className="fluid-select"
                  value={selectedFluidName}
                  onChange={(event) => setSelectedFluidName(event.target.value)}
                >
                  {fluidDatabase.length === 0 ? (
                    <option value="">No fluids loaded</option>
                  ) : (
                    fluidDatabase.map((fluid) => (
                      <option key={fluid.id} value={fluid.fluidName}>
                        {fluid.fluidName}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="fluid-selector-row">
                <label className="fluid-select-label" htmlFor="inlet-pipe-select">
                  Inlet Pipe :
                </label>

                <select
                  id="inlet-pipe-select"
                  className="fluid-select pipe-select"
                  value={pipework.inletPipeSize}
                  onChange={(event) =>
                    updatePipework("inletPipeSize", event.target.value)
                  }
                >
                  {pipeSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}&quot;
                    </option>
                  ))}
                </select>
              </div>

              <div className="fluid-selector-row">
                <label className="fluid-select-label" htmlFor="outlet-pipe-select">
                  Outlet Pipe :
                </label>

                <select
                  id="outlet-pipe-select"
                  className="fluid-select pipe-select"
                  value={pipework.outletPipeSize}
                  onChange={(event) =>
                    updatePipework("outletPipeSize", event.target.value)
                  }
                >
                  {pipeSizeOptions.map((size) => (
                    <option key={size} value={size}>
                      {size}&quot;
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pipework-schedule-row">
              <div className="fluid-selector-row">
                <label className="fluid-select-label" htmlFor="inlet-schedule-select">
                  Inlet Schedule :
                </label>

                <select
                  id="inlet-schedule-select"
                  className="fluid-select pipe-select"
                  value={pipework.inletPipeSchedule}
                  onChange={(event) =>
                    updatePipework("inletPipeSchedule", event.target.value)
                  }
                >
                  {scheduleOptions.map((schedule) => (
                    <option key={schedule} value={schedule}>
                      {schedule}
                    </option>
                  ))}
                </select>
              </div>

              <div className="fluid-selector-row">
                <label className="fluid-select-label" htmlFor="outlet-schedule-select">
                  Outlet Schedule :
                </label>

                <select
                  id="outlet-schedule-select"
                  className="fluid-select pipe-select"
                  value={pipework.outletPipeSchedule}
                  onChange={(event) =>
                    updatePipework("outletPipeSchedule", event.target.value)
                  }
                >
                  {scheduleOptions.map((schedule) => (
                    <option key={schedule} value={schedule}>
                      {schedule}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {trimDatabaseError && (
            <div className="database-error">
              Trim database error: {trimDatabaseError}
            </div>
          )}

          {fluidDatabaseError && (
            <div className="database-error">
              Fluid database error: {fluidDatabaseError}
            </div>
          )}
        </div>
      </section>

      <section className="content-grid">
        <InputPanel inputs={inputs} onInputChange={updateInput} />

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Selected Valve</p>
              <h2>Trim selection</h2>
            </div>
          </div>

          <div className="input-grid">
            <label>
              Directionality
              <select
                value={selectedValve.directionality}
                onChange={(event) =>
                  updateSelectedValve("directionality", event.target.value)
                }
              >
                <option value="CB">CB - Bi-directional</option>
                <option value="CU">CU - Uni-directional</option>
              </select>
            </label>

            <label>
              Nominal valve size, inches
              <select
                value={selectedValve.size}
                onChange={(event) =>
                  updateSelectedValve("size", event.target.value)
                }
              >
                <option value="01">1 inch</option>
                <option value="015">1.5 inch</option>
                <option value="02">2 inch</option>
                <option value="03">3 inch</option>
                <option value="04">4 inch</option>
                <option value="06">6 inch</option>
                <option value="08">8 inch</option>
                <option value="10">10 inch</option>
                <option value="12">12 inch</option>
              </select>
            </label>

            <label>
              Pressure class
              <select
                value={selectedValve.pressureClass}
                onChange={(event) =>
                  updateSelectedValve("pressureClass", event.target.value)
                }
              >
                <option value="015">150#</option>
                <option value="030">300#</option>
                <option value="060">600#</option>
                <option value="090">900#</option>
                <option value="150">1500#</option>
                <option value="250">2500#</option>
              </select>
            </label>

            <label>
              Number of stages
              <select
                value={selectedValve.stages}
                onChange={(event) =>
                  updateSelectedValve("stages", event.target.value)
                }
              >
                <option value="1">1 stage</option>
                <option value="2">2 stages</option>
                <option value="3">3 stages</option>
                <option value="4">4 stages</option>
              </select>
            </label>

            <label>
              Trim construction
              <select
                value={selectedValve.trimType}
                onChange={(event) =>
                  updateSelectedValve("trimType", event.target.value)
                }
              >
                <option value="S">S - Slotted</option>
                <option value="H">H - Holes</option>
              </select>
            </label>

            <label>
              Flow characteristic
              <select
                value={selectedValve.style}
                onChange={(event) =>
                  updateSelectedValve("style", event.target.value)
                }
              >
                <option value="L">L - Linear</option>
                <option value="E">E - Equal percentage</option>
                <option value="Q">Q - Equal-linear</option>
              </select>
            </label>
          </div>

          <div className="result-card">
            <span className="result-label">Selected trim code</span>
            <strong>{selectedValveCode}</strong>
          </div>

          <div className="result-card">
            <span className="result-label">Selected trim design Cv</span>

            {selectedTrim ? (
              <strong>{selectedTrimDesignCv}</strong>
            ) : (
              <strong>Not found in database</strong>
            )}
          </div>
        </section>

        <ResultPanel inputs={inputs} result={result} />
      </section>
    </main>
  );
}

export default App;