import { useEffect, useMemo, useState } from "react";
import { loadTrimDatabase } from "./data/loadTrimDatabase";
import { loadFluidDatabase } from "./data/loadFluidDatabase";
import "./App.css";
import { calculateLiquidCv } from "./calculations/iec60534/liquidSizing";
import ResultPanel from "./components/ResultPanel";
import TrimSelectionPanel from "./components/TrimSelectionPanel";
import ProcessCasesPanel from "./components/ProcessCasesPanel";

function App() {
  
  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  1.        FLUID TYPE STATE
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  const [fluidType, setFluidType] = useState("liquid");

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  2.        MAIN INPUT STATE
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  const [inputs, setInputs] = useState({
    projectName: "",
    projectNumber: "",
    itemNumber: "",
    tagNumber: "LV-1001",
    fluidName: "",
    caseName: "Case 1",
    flowRateGpm: 100,
    specificGravity: 1,
    pressureDropPsi: 10,
  });

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  3.        SELECTED VALVE STATE
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  const [selectedValve, setSelectedValve] = useState({
    directionality: "",
    size: "",
    pressureClass: "",
    stages: "",
    trimType: "",
    style: "",
  });

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  4.        PIPEWORK STATE
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  const [pipework, setPipework] = useState({
    inletPipeSize: "2",
    inletPipeSchedule: "40",
    outletPipeSize: "2",
    outletPipeSchedule: "40",
  });

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  5.        PIPEWORK OPTIONS
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  const pipeSizeOptions = [
    "2", "3", "4", "6", "8", "10",
    "12", "14", "16", "18", "20", "22",
    "24", "26", "28", "30", "32", "34",
    "36", "38", "40", "42", "44", "46", "48",
  ];

  const scheduleOptions = [
    "5", "10", "20", "40", "80", "160",
    "STD", "XS", "XXS", "5S", "10S", "20S", "40S",
  ];
  
  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  6.        DATABASE STATE
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  const [trimDatabase, setTrimDatabase] = useState([]);
  const [trimDatabaseError, setTrimDatabaseError] = useState(null);

  const [fluidDatabase, setFluidDatabase] = useState([]);
  const [fluidDatabaseError, setFluidDatabaseError] = useState(null);
  const [selectedFluidName, setSelectedFluidName] = useState("");

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  7.        LOAD TRIM DATABASE
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

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

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  8.        LOAD FLUID DATABASE
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

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

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  9.        SET DEFAULT FLUID
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  useEffect(() => {
    if (selectedFluidName || fluidDatabase.length === 0) {
      return;
    }

    setSelectedFluidName(fluidDatabase[0].fluidName);
  }, [fluidDatabase, selectedFluidName]);

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  10.        SELECTED FLUID LOOKUP
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  const selectedFluid = useMemo(() => {
    return (
      fluidDatabase.find((fluid) => fluid.fluidName === selectedFluidName) ||
      null
    );
  }, [fluidDatabase, selectedFluidName]);

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  11.        SYNC SELECTED FLUID TO INPUTS
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/
  
  useEffect(() => {
    if (!selectedFluid) {
      return;
    }

    setInputs((current) => ({
      ...current,
      fluidName: selectedFluid.fluidName,
    }));
  }, [selectedFluid]);

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  12.        SELECTED VALVE CODE
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

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

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  13.        SELECTED TRIM LOOKUP
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  const selectedTrim = useMemo(() => {
    return (
      trimDatabase.find(
        (trim) => String(trim.code).trim() === selectedValveCode
      ) || null
    );
  }, [trimDatabase, selectedValveCode]);

  const selectedTrimDesignCv = selectedTrim?.designCvNumeric ?? null;

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  14.        CALCULATION RESULT
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

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

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  15.        UPDATE FUNCTIONS
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

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

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  16.        APP MODE CLASS
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  const appModeClass = fluidType === "liquid" ? "mode-liquid" : "mode-gas";

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  17.        COMPONENT RENDER
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

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

            <div className="project-details-row">
              <div className="project-detail-field project-name-field">
                <label htmlFor="project-name">Project Name:</label>
                <input
                  id="project-name"
                  type="text"
                  value={inputs.projectName}
                  onChange={(event) =>
                    updateInput("projectName", event.target.value)
                  }
                />
              </div>

              <div className="project-detail-field project-number-field">
                <label htmlFor="project-number">Project No.:</label>
                <input
                  id="project-number"
                  type="text"
                  value={inputs.projectNumber}
                  onChange={(event) =>
                    updateInput("projectNumber", event.target.value)
                  }
                />
              </div>

              <div className="project-detail-field item-number-field">
                <label htmlFor="item-number">Item No.:</label>
                <input
                  id="item-number"
                  type="text"
                  value={inputs.itemNumber}
                  onChange={(event) =>
                    updateInput("itemNumber", event.target.value)
                  }
                />
              </div>

              <div className="project-detail-field tag-number-field">
                <label htmlFor="tag-number">Tag No.:</label>
                <input
                  id="tag-number"
                  type="text"
                  value={inputs.tagNumber}
                  onChange={(event) =>
                    updateInput("tagNumber", event.target.value)
                  }
                />
              </div>
            </div>
          </div>
            
            {/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
            17c.        LIQUID / GAS TOGGLE ROW
            XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/}

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

            {/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
            17d.        PIPEWORK MAIN ROW
            XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/}
       
            <div className="pipework-main-row">
              
              {/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
              17e.        FLUID SELECTOR COLUMN
              XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/}

              <div className="pipework-column fluid-column">
                <div className="fluid-selector-row">
                  <label className="fluid-select-label" htmlFor="fluid-select">
                    Fluid :
                  </label>

                  <select
                    id="fluid-select"
                    className="fluid-select main-fluid-select"
                    value={selectedFluidName}
                    onChange={(event) =>
                      setSelectedFluidName(event.target.value)
                    }
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
              </div>

              
              {/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
              17f.        INLET PIPEWORK COLUMN
              XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/}
              

              <div className="pipework-column">
                <div className="fluid-selector-row">
                  <label
                    className="fluid-select-label"
                    htmlFor="inlet-pipe-select"
                  >
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
                  <label
                    className="fluid-select-label"
                    htmlFor="inlet-schedule-select"
                  >
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
              </div>

              {/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
              17g.        OUTLET PIPEWORK COLUMN
              XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/}

              <div className="pipework-column">
                <div className="fluid-selector-row">
                  <label
                    className="fluid-select-label"
                    htmlFor="outlet-pipe-select"
                  >
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

                <div className="fluid-selector-row">
                  <label
                    className="fluid-select-label"
                    htmlFor="outlet-schedule-select"
                  >
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

           

          {/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
          17i.        DATABASE ERROR MESSAGES
          XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/}
          
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

      {/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      17j.        MAIN CONTENT GRID
      XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/}  

      <section className="content-grid">
        
        <TrimSelectionPanel
          selectedValve={selectedValve}
          selectedValveCode={selectedValveCode}
          selectedTrim={selectedTrim}
          selectedTrimDesignCv={selectedTrimDesignCv}
          onSelectedValveChange={updateSelectedValve}
        />       

        <ProcessCasesPanel
          inputs={inputs}
          onInputChange={updateInput}
        />

        <ResultPanel inputs={inputs} result={result} />
      
      </section>

    </main>
  );
}

export default App;