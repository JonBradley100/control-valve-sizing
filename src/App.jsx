import { useEffect, useMemo, useState } from "react";
import { loadTrimDatabase } from "./data/loadTrimDatabase";
import { loadFluidDatabase } from "./data/loadFluidDatabase";
import "./App.css";
import ResultPanel from "./components/ResultPanel";
import TrimSelectionPanel from "./components/TrimSelectionPanel";
import ProcessCasesPanel from "./components/ProcessCasesPanel";
import { calculateLiquidSizing } from "./calculations/iec60534/liquidSizing";

/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  HELPER: READ A VALID NUMBER
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

function readNumber(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  HELPER: CONVERT TEMPERATURE TO KELVIN

  Supports both:
  °C / °F
  oC / oF
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

function temperatureToKelvin(value, unit) {
  const temperature = readNumber(value);

  if (temperature === null) {
    return null;
  }

  let temperatureK;

  switch (unit) {
    case "°C":
    case "oC":
      temperatureK = temperature + 273.15;
      break;

    case "°F":
    case "oF":
      temperatureK = (temperature - 32) * (5 / 9) + 273.15;
      break;

    case "K":
      temperatureK = temperature;
      break;

    default:
      return null;
  }

  if (!Number.isFinite(temperatureK) || temperatureK <= 0) {
    return null;
  }

  return temperatureK;
}

/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  HELPER: ABSOLUTE PRESSURE CONVERSION

  Values are pascals per unit.
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

const ABSOLUTE_PRESSURE_FACTORS = {
  bara: 100000,
  psia: 6894.757293168,
  kPaa: 1000,
  kgcm2a: 98066.5,
  MPaa: 1000000,
};

function convertAbsolutePressure(value, fromUnit, toUnit) {
  const pressure = readNumber(value);

  const fromFactor = ABSOLUTE_PRESSURE_FACTORS[fromUnit];
  const toFactor = ABSOLUTE_PRESSURE_FACTORS[toUnit];

  if (
    pressure === null ||
    pressure < 0 ||
    !fromFactor ||
    !toFactor
  ) {
    return "";
  }

  const convertedPressure = (pressure * fromFactor) / toFactor;

  if (!Number.isFinite(convertedPressure)) {
    return "";
  }

  return convertedPressure.toFixed(4);
}

/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  HELPER: CALCULATE VAPOUR PRESSURE

  Uses the user-specified formula:
  EXP(A - B / (temperatureK + C)) / 760

  The result is treated as bara.
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

function calculateCaseVapourPressure(processCase, fluid) {
  if (!fluid) {
    return "";
  }

  const coefficientA = readNumber(fluid.pV_A);
  const coefficientB = readNumber(fluid.pV_B);
  const coefficientC = readNumber(fluid.pV_C);

  const temperatureK = temperatureToKelvin(
    processCase.temperature,
    processCase.temperatureUnit
  );

  if (
    coefficientA === null ||
    coefficientB === null ||
    coefficientC === null ||
    temperatureK === null
  ) {
    return "";
  }

  const denominator = temperatureK + coefficientC;

  if (!Number.isFinite(denominator) || denominator === 0) {
    return "";
  }

  const vapourPressureBara =
    Math.exp(coefficientA - coefficientB / denominator) / 760;

  if (
    !Number.isFinite(vapourPressureBara) ||
    vapourPressureBara < 0
  ) {
    return "";
  }

  return convertAbsolutePressure(
    vapourPressureBara,
    "bara",
    processCase.vapourPressureUnit ?? "bara"
  );
}

/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  HELPER: CREATE A DEFAULT PROCESS CASE
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

function createDefaultProcessCase(id = 1) {
  return {
    id,
    caseName: `Case ${id}`,
    flowRate: 100,
    flowUnit: "m3/h",
    specificGravity: 1,
    density: 1000,
    temperature: 60,
    temperatureUnit: "oC",
    pressureIn: 100,
    pressureOut: 90,
    pressureUnit: "barg",
    vapourPressure: "",
    vapourPressureUnit: "bara",
  };
}

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

    densityMode: "sg",
    densityUnit: "kg/m³",

    processCases: [createDefaultProcessCase(1)],
  });

  const deleteProcessCase = (caseId) => {
    setInputs((previousInputs) => ({
      ...previousInputs,
      processCases: previousInputs.processCases.filter(
        (processCase) => processCase.id !== caseId
      ),
    }));
  };

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

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  6.        DATABASE STATE
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  const [trimDatabase, setTrimDatabase] = useState([]);
  const [trimDatabaseError, setTrimDatabaseError] = useState(null);

  const [fluidDatabase, setFluidDatabase] = useState([]);
  const [fluidDatabaseError, setFluidDatabaseError] = useState(null);
  const [selectedFluidName, setSelectedFluidName] = useState("");

  const filteredFluidDatabase = useMemo(
    () => fluidDatabase.filter((fluid) => fluid.phase === fluidType),
    [fluidDatabase, fluidType]
  );

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
    if (selectedFluidName || filteredFluidDatabase.length === 0) {
      return;
    }

    setSelectedFluidName(filteredFluidDatabase[0].fluidName);
  }, [filteredFluidDatabase, selectedFluidName]);

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  10.        SELECTED FLUID LOOKUP
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  const selectedFluid = useMemo(() => {
    return (
      filteredFluidDatabase.find(
        (fluid) => fluid.fluidName === selectedFluidName
      ) || null
    );
  }, [filteredFluidDatabase, selectedFluidName]);

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  11.        SYNC SELECTED FLUID TO INPUTS

  Updates:
  - Fluid name
  - Density
  - Specific gravity
  - Vapour pressure for each process case
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  useEffect(() => {
    const selectedDensity = selectedFluid
      ? readNumber(selectedFluid.rho)
      : null;

    setInputs((current) => ({
      ...current,
      fluidName: selectedFluid?.fluidName ?? "",

      processCases: current.processCases.map((processCase) => {
        const updatedCase = {
          ...processCase,
          vapourPressureUnit: processCase.vapourPressureUnit ?? "bara",
        };

        if (selectedDensity !== null) {
          updatedCase.density = selectedDensity;
          updatedCase.specificGravity = selectedDensity / 1000;
        }

        updatedCase.vapourPressure =
          fluidType === "liquid"
            ? calculateCaseVapourPressure(updatedCase, selectedFluid)
            : "";

        return updatedCase;
      }),
    }));
  }, [selectedFluid, fluidType]);

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
      return calculateLiquidSizing(inputs);
    }

    return {
      processCaseResults: [],
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

  function updateProcessCase(caseId, field, value) {
    setInputs((current) => ({
      ...current,

      processCases: current.processCases.map((processCase) => {
        if (processCase.id !== caseId) {
          return processCase;
        }

        const updatedCase = {
          ...processCase,
          [field]: value,
        };

        // Recalculate when temperature or temperature unit changes.
        if (field === "temperature" || field === "temperatureUnit") {
          updatedCase.vapourPressure =
            fluidType === "liquid"
              ? calculateCaseVapourPressure(updatedCase, selectedFluid)
              : "";
        }

        // Convert the existing value when the pressure unit changes.
        // This preserves any manually entered vapour pressure.
        if (field === "vapourPressureUnit") {
          updatedCase.vapourPressure = convertAbsolutePressure(
            processCase.vapourPressure,
            processCase.vapourPressureUnit ?? "bara",
            value
          );
        }

        return updatedCase;
      }),
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
  17.        ADD PROCESS CASE
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  function addProcessCase() {
    setInputs((currentInputs) => {
      const lastCase =
        currentInputs.processCases[currentInputs.processCases.length - 1];

      const nextId =
        currentInputs.processCases.length > 0
          ? Math.max(
              ...currentInputs.processCases.map((processCase) => processCase.id)
            ) + 1
          : 1;

      const newProcessCase = {
        ...createDefaultProcessCase(nextId),
        ...lastCase,
        id: nextId,
        caseName: `Case ${nextId}`,
        vapourPressureUnit: lastCase?.vapourPressureUnit ?? "bara",
      };

      // Apply the selected fluid's density if all previous cases
      // have been deleted and this is a fresh default case.
      if (!lastCase && selectedFluid) {
        const selectedDensity = readNumber(selectedFluid.rho);

        if (selectedDensity !== null) {
          newProcessCase.density = selectedDensity;
          newProcessCase.specificGravity = selectedDensity / 1000;
        }
      }

      newProcessCase.vapourPressure =
        fluidType === "liquid"
          ? calculateCaseVapourPressure(newProcessCase, selectedFluid)
          : "";

      return {
        ...currentInputs,
        processCases: [...currentInputs.processCases, newProcessCase],
      };
    });
  }

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  18.        COMPONENT RENDER
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
          18a.        LIQUID / GAS TOGGLE ROW
          XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/}

          <div className="fluid-toggle-row">
            <div className="fluid-toggle" aria-label="Fluid sizing type">
              <button
                type="button"
                className={fluidType === "liquid" ? "active" : ""}
                onClick={() => {
                  setFluidType("liquid");
                  setSelectedFluidName("");
                }}
              >
                Liquid
              </button>

              <button
                type="button"
                className={fluidType === "gas" ? "active" : ""}
                onClick={() => {
                  setFluidType("gas");
                  setSelectedFluidName("");
                }}
              >
                Gas
              </button>
            </div>
          </div>

          {/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
          18b.        PIPEWORK MAIN ROW
          XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/}

          <div className="pipework-main-row">
            {/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
            18c.        FLUID SELECTOR COLUMN
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
                  onChange={(event) => {
                    setSelectedFluidName(event.target.value);
                  }}
                >
                  {filteredFluidDatabase.length === 0 ? (
                    <option value="">No fluids loaded</option>
                  ) : (
                    filteredFluidDatabase.map((fluid) => (
                      <option key={fluid.id} value={fluid.fluidName}>
                        {fluid.fluidName}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
            18d.        INLET PIPEWORK COLUMN
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
            18e.        OUTLET PIPEWORK COLUMN
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
          18f.        DATABASE ERROR MESSAGES
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
      18g.        MAIN CONTENT GRID
      XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/}

      <section className="content-grid">
        <TrimSelectionPanel
          selectedValve={selectedValve}
          selectedValveCode={selectedValveCode}
          selectedTrim={selectedTrim}
          selectedTrimDesignCv={selectedTrimDesignCv}
          onSelectedValveChange={updateSelectedValve}
        />

        <div className="sizing-workspace">
          <div className="sizing-input-area">
            <ProcessCasesPanel
              inputs={inputs}
              onInputChange={updateInput}
              onProcessCaseChange={updateProcessCase}
              onAddProcessCase={addProcessCase}
              onDeleteProcessCase={deleteProcessCase}
            />
          </div>

          <div className="sizing-results-area">
            <ResultPanel inputs={inputs} result={result} />
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;