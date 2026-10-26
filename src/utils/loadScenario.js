function isObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function validateScenario(scenario) {
  if (!isObject(scenario)) {
    throw new Error("The selected file does not contain a valid scenario.");
  }

  if (scenario.fileType !== "iec60534-sizing-scenario") {
    throw new Error("Please select a Valve sizing scenario JSON file.");
  }

  if (scenario.schemaVersion !== 1) {
    throw new Error("This scenario file version is not supported.");
  }

  if (!["liquid", "gas"].includes(scenario.fluidType)) {
    throw new Error("The scenario contains an invalid fluid type.");
  }

  if (typeof scenario.selectedFluidName !== "string") {
    throw new Error("The scenario is missing its fluid selection.");
  }

  if (
    !isObject(scenario.inputs) ||
    !Array.isArray(scenario.inputs.processCases)
  ) {
    throw new Error("The scenario is missing its process inputs.");
  }

  const requiredInputFields = [
    "projectName",
    "projectNumber",
    "itemNumber",
    "tagNumber",
    "fluidName",
    "densityMode",
    "densityUnit",
  ];

  for (const field of requiredInputFields) {
    if (typeof scenario.inputs[field] !== "string") {
      throw new Error(`The scenario contains an invalid "${field}" value.`);
    }
  }

  const requiredCaseFields = [
    "id",
    "caseName",
    "flowRate",
    "flowUnit",
    "specificGravity",
    "density",
    "temperature",
    "temperatureUnit",
    "pressureIn",
    "pressureOut",
    "pressureUnit",
    "vapourPressure",
    "vapourPressureUnit",
  ];

  const caseIds = new Set();

  for (const processCase of scenario.inputs.processCases) {
    if (!isObject(processCase)) {
      throw new Error("The scenario contains an invalid process case.");
    }

    for (const field of requiredCaseFields) {
      const value = processCase[field];

      if (
        typeof value !== "string" &&
        !(typeof value === "number" && Number.isFinite(value))
      ) {
        throw new Error(
          `A process case contains an invalid "${field}" value.`
        );
      }
    }

    if (
      !Number.isInteger(processCase.id) ||
      processCase.id < 1 ||
      caseIds.has(processCase.id)
    ) {
      throw new Error("Process case IDs must be unique positive integers.");
    }

    caseIds.add(processCase.id);
  }

  const requiredValveFields = [
    "directionality",
    "size",
    "pressureClass",
    "stages",
    "trimType",
    "style",
  ];

  if (!isObject(scenario.selectedValve)) {
    throw new Error("The scenario is missing its valve selections.");
  }

  for (const field of requiredValveFields) {
    if (typeof scenario.selectedValve[field] !== "string") {
      throw new Error(`The valve selection "${field}" is invalid.`);
    }
  }

  const requiredPipeworkFields = [
    "inletPipeSize",
    "inletPipeSchedule",
    "outletPipeSize",
    "outletPipeSchedule",
  ];

  if (!isObject(scenario.pipework)) {
    throw new Error("The scenario is missing its pipework selections.");
  }

  for (const field of requiredPipeworkFields) {
    if (typeof scenario.pipework[field] !== "string") {
      throw new Error(`The pipework selection "${field}" is invalid.`);
    }
  }
}

export async function loadScenario() {
  if (typeof window.showOpenFilePicker !== "function") {
    throw new Error(
      "The file picker is unavailable. Open the app in Chrome using localhost or HTTPS."
    );
  }

  try {
    const [fileHandle] = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: "Valve sizing scenario",
          accept: {
            "application/json": [".json"],
          },
        },
      ],
    });

    const file = await fileHandle.getFile();

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("The scenario file is too large. Maximum size is 5 MB.");
    }

    const text = await file.text();

    let scenario;

    try {
      scenario = JSON.parse(text);
    } catch {
      throw new Error("The selected file does not contain valid JSON.");
    }

    validateScenario(scenario);

    return {
      scenario,
      fileName: file.name,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      return null;
    }

    throw error;
  }
}