import React, { useEffect, useMemo, useRef, useState } from "react";

import { loadTrimDatabase } from "./data/loadTrimDatabase";
import { loadFluidDatabase } from "./data/loadFluidDatabase";
import { loadCvParameterDatabase } from "./data/loadCvParameterDatabase";

import ResultPanel from "./components/ResultPanel";
import TrimSelectionPanel from "./components/TrimSelectionPanel";
import ProcessCasesPanel from "./components/ProcessCasesPanel";
import LiquidPlot from "./components/LiquidPlot";

import { calculateLiquidSizing } from "./calculations/iec60534/liquidSizing";
import { calculateCaseVapourPressure } from "./calculations/fluidProperties";

import {
  loadPipeThicknessTable,
  calculateDownstreamPipeThickness,
} from "./calculations/downstreamPipeThickness";

import { readNumber } from "./utils/readNumber";
import { convertAbsolutePressure } from "./utils/unitConversions";
import { getCvParameterCode } from "./utils/valveCodes";
import { loadScenario } from "./utils/loadScenario";

import "./App.css";

export default function App() {
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

  const restoredFluidRef = useRef(null);
  const fileOperationRef = useRef(false);

  const [fileBusy, setFileBusy] = useState(false);
  const [fileStatus, setFileStatus] = useState(null);
  const [fluidType, setFluidType] = useState("liquid");

  const [inputs, setInputs] = useState({
    projectName: "",
    projectNumber: "",
    itemNumber: "",
    tagNumber: "LV-1001",
    fluidName: "",
    densityMode: "rho",
    densityUnit: "kg/m³",
    processCases: [createDefaultProcessCase(1)],
  });

  /*
    Label positions use chart coordinates:
      x: total stroke percentage
      y: Cv

    Keys are process case IDs converted to strings.
    Only manually positioned labels need stored coordinates.
  */
  const [liquidPlotLabelPositions, setLiquidPlotLabelPositions] =
    useState({});

  const [selectedValve, setSelectedValve] = useState({
    directionality: "",
    size: "",
    pressureClass: "",
    stages: "",
    trimType: "",
    style: "",
  });

  const [pipework, setPipework] = useState({
    inletPipeSize: "2",
    inletPipeSchedule: "40",
    outletPipeSize: "2",
    outletPipeSchedule: "40",
  });

  const pipeSizeOptions = [
    "2", "3", "4", "6", "8", "10", "12", "14",
    "16", "18", "20", "22", "24", "26", "28",
    "30", "32", "34", "36", "38", "40", "42",
    "44", "46", "48",
  ];

  const scheduleOptions = [
    "10", "20", "40", "80", "160",
    "STD", "XS", "XXS", "5S", "10S", "40S", "80S",
  ];

  const [trimDatabase, setTrimDatabase] = useState([]);
  const [trimDatabaseError, setTrimDatabaseError] = useState(null);

  const [fluidDatabase, setFluidDatabase] = useState([]);
  const [fluidDatabaseError, setFluidDatabaseError] = useState(null);
  const [fluidDatabaseLoaded, setFluidDatabaseLoaded] = useState(false);
  const [selectedFluidName, setSelectedFluidName] = useState("");

  const [cvParameterDatabase, setCvParameterDatabase] = useState([]);
  const [cvParameterDatabaseError, setCvParameterDatabaseError] =
    useState(null);
  const [cvParameterDatabaseLoaded, setCvParameterDatabaseLoaded] =
    useState(false);

  const [pipeThicknessTable, setPipeThicknessTable] = useState(null);
  const [pipeThicknessDatabaseError, setPipeThicknessDatabaseError] =
    useState(null);

  const [pipeIDCsvText, setPipeIDCsvText] = useState(null);
  const [pipeIDDatabaseError, setPipeIDDatabaseError] = useState(null);

  const filteredFluidDatabase = useMemo(
    () => fluidDatabase.filter((fluid) => fluid.phase === fluidType),
    [fluidDatabase, fluidType]
  );

  useEffect(() => {
    let cancelled = false;

    loadTrimDatabase()
      .then((rows) => {
        if (cancelled) return;

        console.log("Loaded trim database:", rows);
        console.log("First trim row:", rows[0]);

        setTrimDatabase(rows);
        setTrimDatabaseError(null);
      })
      .catch((error) => {
        if (cancelled) return;

        console.error(error);
        setTrimDatabaseError(
          error instanceof Error ? error.message : String(error)
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadFluidDatabase()
      .then((rows) => {
        if (cancelled) return;

        console.log("Loaded fluid database:", rows);
        console.log("First fluid row:", rows[0]);

        setFluidDatabase(rows);
        setFluidDatabaseError(null);
        setFluidDatabaseLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;

        console.error(error);
        setFluidDatabaseError(
          error instanceof Error ? error.message : String(error)
        );
        setFluidDatabaseLoaded(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadParameters() {
      try {
        const rows = await loadCvParameterDatabase({
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        setCvParameterDatabase(rows);
        setCvParameterDatabaseError(null);
        setCvParameterDatabaseLoaded(true);
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error(error);
        setCvParameterDatabase([]);
        setCvParameterDatabaseError(
          error instanceof Error ? error.message : String(error)
        );
        setCvParameterDatabaseLoaded(false);
      }
    }

    loadParameters();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadPipeThicknessTable()
      .then((table) => {
        if (cancelled) return;

        setPipeThicknessTable(table);
        setPipeThicknessDatabaseError(null);
      })
      .catch((error) => {
        if (cancelled) return;

        console.error("Unable to load pipe thickness database:", error);
        setPipeThicknessTable(null);
        setPipeThicknessDatabaseError(
          error instanceof Error ? error.message : String(error)
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const downstreamPipeThickness = useMemo(() => {
    if (pipeThicknessDatabaseError) {
      return {
        tMm: null,
        thicknessInch: null,
        warnings: [
          `Downstream pipe thickness unavailable: ${pipeThicknessDatabaseError}`,
        ],
      };
    }

    if (!pipeThicknessTable) {
      return {
        tMm: null,
        thicknessInch: null,
        warnings: [
          "Downstream pipe thickness unavailable while the pipe thickness database is loading.",
        ],
      };
    }

    return calculateDownstreamPipeThickness({
      table: pipeThicknessTable,
      downstreamSizeInch: pipework.outletPipeSize,
      downstreamSchedule: pipework.outletPipeSchedule,
    });
  }, [
    pipeThicknessTable,
    pipeThicknessDatabaseError,
    pipework.outletPipeSize,
    pipework.outletPipeSchedule,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPipeIDDatabase() {
      try {
        const response = await fetch("/data/pipeID.csv", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Unable to load /data/pipeID.csv: HTTP ${response.status}.`
          );
        }

        const text = await response.text();

        if (controller.signal.aborted) return;

        if (text.trim() === "") {
          throw new Error("The pipeID.csv file is empty.");
        }

        if (/^\s*</.test(text.replace(/^\uFEFF/, ""))) {
          throw new Error(
            "The request for /data/pipeID.csv returned HTML. Check that pipeID.csv exists in public/data."
          );
        }

        setPipeIDCsvText(text);
        setPipeIDDatabaseError(null);
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error("Unable to load pipe ID database:", error);
        setPipeIDCsvText(null);
        setPipeIDDatabaseError(
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    loadPipeIDDatabase();

    return () => controller.abort();
  }, []);

  const downstreamNominalDiameterMm = useMemo(() => {
    const sizeInch = readNumber(pipework.outletPipeSize);

    if (sizeInch === null || sizeInch <= 0) return null;

    const diameterMm = sizeInch * 25.4;

    return Number.isFinite(diameterMm) && diameterMm > 0
      ? diameterMm
      : null;
  }, [pipework.outletPipeSize]);

  useEffect(() => {
    if (selectedFluidName || filteredFluidDatabase.length === 0) {
      return;
    }

    const defaultFluid =
      filteredFluidDatabase.find(
        (fluid) =>
          String(fluid.fluidName).trim().toUpperCase() === "WATER"
      ) ?? filteredFluidDatabase[0];

    setSelectedFluidName(defaultFluid.fluidName);
  }, [filteredFluidDatabase, selectedFluidName]);

  const selectedFluid = useMemo(
    () =>
      filteredFluidDatabase.find(
        (fluid) => fluid.fluidName === selectedFluidName
      ) || null,
    [filteredFluidDatabase, selectedFluidName]
  );

  useEffect(() => {
    const restoredFluid = restoredFluidRef.current;

    if (
      restoredFluid &&
      restoredFluid.fluid === selectedFluid &&
      restoredFluid.fluidType === fluidType
    ) {
      return;
    }

    restoredFluidRef.current = null;

    const selectedDensity = selectedFluid
      ? readNumber(selectedFluid.rho)
      : null;

    setInputs((current) => ({
      ...current,
      fluidName: selectedFluid?.fluidName ?? "",
      processCases: current.processCases.map((processCase) => {
        const updatedCase = {
          ...processCase,
          vapourPressureUnit:
            processCase.vapourPressureUnit ?? "bara",
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

  /*
    All trim data comes from the same code-matched row.
    The loader must preserve the stage-count and dP columns.
  */
  const selectedTrim = useMemo(
    () =>
      trimDatabase.find(
        (trim) => String(trim.code).trim() === selectedValveCode
      ) || null,
    [trimDatabase, selectedValveCode]
  );

  const selectedTrimDesignCv = selectedTrim?.designCvNumeric ?? null;
  const selectedTrimAreaM2 = selectedTrim?.areaNumeric ?? null;
  const selectedTrimNumberOfHoles = selectedTrim?.n0Numeric ?? null;

  const rawSelectedTrimAh = selectedTrim?.Ah;

  const selectedTrimAh =
    rawSelectedTrimAh === null ||
    rawSelectedTrimAh === undefined ||
    String(rawSelectedTrimAh).trim() === ""
      ? null
      : Number.isFinite(Number(rawSelectedTrimAh))
        ? Number(rawSelectedTrimAh)
        : null;

  const selectedParameterCode = useMemo(
    () => getCvParameterCode(selectedValveCode),
    [selectedValveCode]
  );

  const selectedParameterRow = useMemo(() => {
    if (!selectedParameterCode) return null;

    return (
      cvParameterDatabase.find(
        (row) => row.code === selectedParameterCode
      ) || null
    );
  }, [cvParameterDatabase, selectedParameterCode]);

  const parameterLookupError =
    fluidType === "liquid" &&
    selectedTrim &&
    cvParameterDatabaseLoaded &&
    !selectedParameterRow
      ? `No CvBasedParameters row matches "${selectedParameterCode}" for valve "${selectedValveCode}".`
      : null;

  const trimAhLookupError =
    fluidType === "liquid" &&
    selectedTrim &&
    selectedTrimAh === null
      ? `The loaded trim row for "${selectedValveCode}" does not contain a valid numeric Ah. Check the Ah CSV cell and that loadTrimDatabase preserves the Ah column.`
      : null;

  const trimAreaLookupError =
    fluidType === "liquid" &&
    selectedTrim &&
    (
      !Number.isFinite(selectedTrimAreaM2) ||
      selectedTrimAreaM2 <= 0
    )
      ? `The loaded trim row for "${selectedValveCode}" requires a positive numeric A in m² to calculate d0. Check the A CSV cell.`
      : null;

  const trimHoleCountLookupError =
    fluidType === "liquid" &&
    selectedTrim &&
    (
      !Number.isFinite(selectedTrimNumberOfHoles) ||
      selectedTrimNumberOfHoles <= 0
    )
      ? `The loaded trim row for "${selectedValveCode}" requires a positive numeric n0 to calculate d0. Check the n0 CSV cell.`
      : null;

  const trimStageLookupError = useMemo(() => {
    if (fluidType !== "liquid" || !selectedTrim) return null;

    const rawStages = selectedTrim.Stages ?? selectedTrim.stages;

    const stages =
      rawStages === null ||
      rawStages === undefined ||
      String(rawStages).trim() === ""
        ? null
        : Number(rawStages);

    if (
      !Number.isInteger(stages) ||
      stages < 1 ||
      stages > 4
    ) {
      return `The loaded trim row for "${selectedValveCode}" requires Stages (or stages) as an integer from 1 to 4. Check that loadTrimDatabase preserves the Stages column.`;
    }

    if (stages === 1) return null;

    const column = `s${stages}_dP`;
    const rawFraction = selectedTrim[column];

    const fraction =
      rawFraction === null ||
      rawFraction === undefined ||
      String(rawFraction).trim() === ""
        ? null
        : Number(rawFraction);

    if (
      !Number.isFinite(fraction) ||
      fraction <= 0 ||
      fraction >= 1
    ) {
      return `The loaded trim row for "${selectedValveCode}" requires ${column} as a pressure-drop fraction greater than 0 and less than 1. Check the CSV cell and that loadTrimDatabase preserves this column.`;
    }

    return null;
  }, [fluidType, selectedTrim, selectedValveCode]);

  const result = useMemo(() => {
    if (fluidType === "liquid") {
      const sizingResult = calculateLiquidSizing(inputs, {
        ratedCv: selectedTrimDesignCv,
        Ah: selectedTrimAh,
        trimAreaM2: selectedTrimAreaM2,
        numberOfHoles: selectedTrimNumberOfHoles,
        trimStageData: selectedTrim,
        flCoefficients: selectedParameterRow,
        lookupCode: selectedParameterCode || null,
        selectedValve,
        pipework,
        selectedFluid,
        downstreamDiameterMm: downstreamNominalDiameterMm,
        downstreamWallThicknessMm: downstreamPipeThickness.tMm,
        pipeIDCsvText,
      });

      const pipeIDWarnings = pipeIDDatabaseError
        ? [`Downstream pipe ID unavailable: ${pipeIDDatabaseError}`]
        : pipeIDCsvText === null
          ? [
              "Downstream pipe ID unavailable while the pipe ID database is loading.",
            ]
          : [];

      return {
        ...sizingResult,
        processCaseResults: (
          sizingResult.processCaseResults ?? []
        ).map((processCaseResult) => ({
          ...processCaseResult,
          technicalDetails: {
            ...processCaseResult.technicalDetails,
            t: downstreamPipeThickness.tMm,
          },
        })),
        warnings: [
          ...new Set([
            ...(sizingResult.warnings ?? []),
            ...downstreamPipeThickness.warnings,
            ...pipeIDWarnings,
          ]),
        ],
      };
    }

    return {
      processCaseResults: [],
      status: "Gas sizing module not yet implemented",
      warnings: ["Gas sizing will be added in the next calculation module."],
    };
  }, [
    fluidType,
    inputs,
    selectedTrim,
    selectedTrimDesignCv,
    selectedTrimAh,
    selectedTrimAreaM2,
    selectedTrimNumberOfHoles,
    selectedParameterRow,
    selectedParameterCode,
    selectedValve,
    pipework,
    selectedFluid,
    downstreamNominalDiameterMm,
    downstreamPipeThickness,
    pipeIDCsvText,
    pipeIDDatabaseError,
  ]);

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
        if (processCase.id !== caseId) return processCase;

        const updatedCase = {
          ...processCase,
          [field]: value,
        };

        if (field === "temperature" || field === "temperatureUnit") {
          updatedCase.vapourPressure =
            fluidType === "liquid"
              ? calculateCaseVapourPressure(updatedCase, selectedFluid)
              : "";
        }

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

  function deleteProcessCase(caseId) {
    setInputs((previousInputs) => ({
      ...previousInputs,
      processCases: previousInputs.processCases.filter(
        (processCase) => processCase.id !== caseId
      ),
    }));

    setLiquidPlotLabelPositions((previousPositions) => {
      const nextPositions = { ...previousPositions };
      delete nextPositions[String(caseId)];
      return nextPositions;
    });
  }

  function updateLiquidPlotLabelPositions(nextPositions) {
    const validCaseIds = new Set(
      inputs.processCases.map((processCase) => String(processCase.id))
    );

    const validatedPositions = {};

    for (const [caseId, position] of Object.entries(nextPositions ?? {})) {
      if (
        validCaseIds.has(caseId) &&
        position !== null &&
        typeof position === "object" &&
        Number.isFinite(position.x) &&
        position.x >= 0 &&
        position.x <= 100 &&
        Number.isFinite(position.y) &&
        position.y >= 0
      ) {
        validatedPositions[caseId] = {
          x: position.x,
          y: position.y,
        };
      }
    }

    setLiquidPlotLabelPositions(validatedPositions);
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

  function updateFluidType(nextFluidType) {
    restoredFluidRef.current = null;
    setFluidType(nextFluidType);
    setSelectedFluidName("");
  }

  function updateSelectedFluidName(nextFluidName) {
    restoredFluidRef.current = null;
    setSelectedFluidName(nextFluidName);
  }

  const appModeClass =
    fluidType === "liquid" ? "mode-liquid" : "mode-gas";

  function addProcessCase() {
    setInputs((currentInputs) => {
      const lastCase =
        currentInputs.processCases[currentInputs.processCases.length - 1];

      const nextId =
        currentInputs.processCases.length > 0
          ? Math.max(
              ...currentInputs.processCases.map(
                (processCase) => processCase.id
              )
            ) + 1
          : 1;

      const newProcessCase = {
        ...createDefaultProcessCase(nextId),
        ...lastCase,
        id: nextId,
        caseName: `Case ${nextId}`,
        vapourPressureUnit: lastCase?.vapourPressureUnit ?? "bara",
      };

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

  async function saveScenario() {
    if (fileOperationRef.current) return;

    fileOperationRef.current = true;
    setFileBusy(true);
    setFileStatus(null);

    const filenameBase = [inputs.projectNumber, inputs.tagNumber]
      .filter(Boolean)
      .join("_");

    const safeFilename = (filenameBase || "valve-sizing-scenario")
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    const suggestedName = `${safeFilename}.json`;

    try {
      let fileHandle = null;

      if (typeof window.showSaveFilePicker === "function") {
        fileHandle = await window.showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: "Valve sizing scenario",
              accept: {
                "application/json": [".json"],
              },
            },
          ],
        });
      }

      /*
        Only save positions belonging to current cases.
        Automatically placed labels do not require saved entries.
      */
      const positionsToSave = {};

      for (const processCase of inputs.processCases) {
        const caseId = String(processCase.id);
        const position = liquidPlotLabelPositions[caseId];

        if (
          position &&
          Number.isFinite(position.x) &&
          position.x >= 0 &&
          position.x <= 100 &&
          Number.isFinite(position.y) &&
          position.y >= 0
        ) {
          positionsToSave[caseId] = {
            x: position.x,
            y: position.y,
          };
        }
      }

      const scenario = {
        fileType: "iec60534-sizing-scenario",
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        fluidType,
        selectedFluidName,
        inputs,
        selectedValve,
        pipework,
        liquidPlotLabelPositions: positionsToSave,
      };

      const json = JSON.stringify(scenario, null, 2);

      if (fileHandle) {
        const writable = await fileHandle.createWritable();
        await writable.write(json);
        await writable.close();

        setFileStatus({
          type: "success",
          message: `Saved "${fileHandle.name}".`,
        });

        return;
      }

      const blob = new Blob([json], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);

      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = suggestedName;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      setFileStatus({
        type: "success",
        message: `Download requested for "${suggestedName}".`,
      });
    } catch (error) {
      if (error?.name === "AbortError") return;

      console.error("Unable to save scenario:", error);

      setFileStatus({
        type: "error",
        message: `Unable to save scenario: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    } finally {
      fileOperationRef.current = false;
      setFileBusy(false);
    }
  }

  async function handleLoadScenario() {
    if (fileOperationRef.current) return;

    if (!fluidDatabaseLoaded || fluidDatabaseError) {
      setFileStatus({
        type: "error",
        message:
          "The fluid database must finish loading successfully before you can load a scenario.",
      });

      return;
    }

    fileOperationRef.current = true;
    setFileBusy(true);
    setFileStatus(null);

    try {
      const loadedFile = await loadScenario();
      if (!loadedFile) return;

      const { scenario, fileName } = loadedFile;

      const restoredFluid = fluidDatabase.find(
        (fluid) =>
          fluid.phase === scenario.fluidType &&
          fluid.fluidName === scenario.selectedFluidName
      );

      if (!restoredFluid) {
        throw new Error(
          `The saved fluid "${scenario.selectedFluidName}" is not available in the current ${scenario.fluidType} fluid database.`
        );
      }

      if (
        !pipeSizeOptions.includes(scenario.pipework.inletPipeSize) ||
        !pipeSizeOptions.includes(scenario.pipework.outletPipeSize)
      ) {
        throw new Error(
          "The saved scenario contains an unsupported pipe size."
        );
      }

      if (
        !scheduleOptions.includes(scenario.pipework.inletPipeSchedule) ||
        !scheduleOptions.includes(scenario.pipework.outletPipeSchedule)
      ) {
        throw new Error(
          "The saved scenario contains an unsupported pipe schedule."
        );
      }

      /*
        The loader has validated these coordinates.
        Older files omit this field and receive automatic placement.
      */
      const restoredLabelPositions = {};

      for (const [caseId, position] of Object.entries(
        scenario.liquidPlotLabelPositions ?? {}
      )) {
        restoredLabelPositions[caseId] = {
          x: position.x,
          y: position.y,
        };
      }

      restoredFluidRef.current = {
        fluid: restoredFluid,
        fluidType: scenario.fluidType,
      };

      setFluidType(scenario.fluidType);
      setSelectedFluidName(scenario.selectedFluidName);

      setInputs({
        ...scenario.inputs,
        fluidName: scenario.selectedFluidName,
        processCases: scenario.inputs.processCases.map(
          (processCase) => ({ ...processCase })
        ),
      });

      setSelectedValve({ ...scenario.selectedValve });
      setPipework({ ...scenario.pipework });
      setLiquidPlotLabelPositions(restoredLabelPositions);

      setFileStatus({
        type: "success",
        message: `Loaded "${fileName}".`,
      });
    } catch (error) {
      console.error("Unable to load scenario:", error);

      setFileStatus({
        type: "error",
        message: `Unable to load scenario: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    } finally {
      fileOperationRef.current = false;
      setFileBusy(false);
    }
  }

  return (
    <main className={`app-shell ${appModeClass}`}>
      <section className="hero">
        <div>
          <div className="title-row">
            <div className="title-heading">
              <p className="eyebrow">
                <b>IEC60534 Control Valve Sizing</b>
              </p>
              <span className="version-label">Version 0.1.2</span>
            </div>

            <div className="header-actions">
              <button
                type="button"
                className="header-action-button"
                onClick={saveScenario}
                disabled={fileBusy}
              >
                Save
              </button>

              <button
                type="button"
                className="header-action-button"
                onClick={handleLoadScenario}
                disabled={
                  fileBusy ||
                  !fluidDatabaseLoaded ||
                  Boolean(fluidDatabaseError)
                }
                title={
                  !fluidDatabaseLoaded
                    ? "The fluid database must load before opening a scenario."
                    : "Open a saved scenario. This replaces the current inputs."
                }
              >
                Load
              </button>
            </div>
          </div>

          {fileStatus && (
            <div
              role={fileStatus.type === "error" ? "alert" : "status"}
              className={
                fileStatus.type === "error"
                  ? "database-error"
                  : "scenario-file-status"
              }
              style={
                fileStatus.type === "success"
                  ? {
                      margin: "0.75rem 0",
                      color: "#166534",
                      overflowWrap: "anywhere",
                    }
                  : undefined
              }
            >
              {fileStatus.message}
            </div>
          )}

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

          <div className="fluid-toggle-row">
            <div className="fluid-toggle" aria-label="Fluid sizing type">
              <button
                type="button"
                className={fluidType === "liquid" ? "active" : ""}
                onClick={() => updateFluidType("liquid")}
              >
                Liquid
              </button>

              <button
                type="button"
                className={fluidType === "gas" ? "active" : ""}
                onClick={() => updateFluidType("gas")}
              >
                Gas
              </button>
            </div>
          </div>

          <div className="pipework-main-row">
            <div className="pipework-column fluid-column">
              <div className="fluid-selector-row">
                <label
                  className="fluid-select-label"
                  htmlFor="fluid-select"
                >
                  Fluid :
                </label>

                <select
                  id="fluid-select"
                  className="fluid-select main-fluid-select"
                  value={selectedFluidName}
                  onChange={(event) =>
                    updateSelectedFluidName(event.target.value)
                  }
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

          {cvParameterDatabaseError && (
            <div className="database-error">
              Cv parameter database error: {cvParameterDatabaseError}
            </div>
          )}

          {pipeThicknessDatabaseError && (
            <div className="database-error">
              Pipe thickness database error: {pipeThicknessDatabaseError}
            </div>
          )}

          {pipeIDDatabaseError && (
            <div className="database-error">
              Pipe ID database error: {pipeIDDatabaseError}
            </div>
          )}

          {parameterLookupError && (
            <div className="database-error">{parameterLookupError}</div>
          )}

          {trimAhLookupError && (
            <div className="database-error">{trimAhLookupError}</div>
          )}

          {trimAreaLookupError && (
            <div className="database-error">{trimAreaLookupError}</div>
          )}

          {trimHoleCountLookupError && (
            <div className="database-error">{trimHoleCountLookupError}</div>
          )}

          {trimStageLookupError && (
            <div className="database-error">{trimStageLookupError}</div>
          )}
        </div>
      </section>

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
            <ResultPanel
              inputs={inputs}
              result={result}
              ratedCv={selectedTrimDesignCv}
            />
          </div>

          {fluidType === "liquid" && (
            <LiquidPlot
              trim={selectedTrim}
              ratedCv={selectedTrimDesignCv}
              processCaseResults={result.processCaseResults ?? []}
              labelPositions={liquidPlotLabelPositions}
              onLabelPositionsChange={updateLiquidPlotLabelPositions}
            />
          )}
        </div>
      </section>
    </main>
  );
}