import {
  calculateLiquidTrimParameters,
  calculateLiquidFLP,
} from "./liquidCvParameters";

// Preserve compatibility with any existing imports
// of these functions from liquidSizing.js.
export {
  calculateLiquidTrimParameters,
  calculateLiquidFLP,
};

/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  LIQUID SIZING

  Provisional equation:
  Cv = 1.156 * m / sqrt(1000 * density * dP)

  m       = mass flow in kg/h
  density = fluid density in kg/m³
  dP      = pressure difference in bar

  Cv-based parameters are calculated in:
  liquidCvParameters.js

  FL, FLP, FP, Fd, xT and xTP are calculated
  for information only. They are not yet
  applied as sizing corrections.
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

const KG_PER_LB = 0.45359237;
const M3_PER_US_GALLON = 0.003785411784;
const KG_M3_PER_LB_FT3 = 16.01846337396014;
const PSI_PER_BAR = 14.503773773;

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
  MAIN LIQUID SIZING FUNCTION

  Optional second argument:
  {
    ratedCv: selected valve's design Cv,
    flCoefficients: matching CSV coefficient row,
    lookupCode: optional parameter lookup code,
    selectedValve: existing valve selection,
    pipework: existing pipework selections
  }

  Required diameter selections:
  selectedValve.size
  pipework.inletPipeSize
  pipework.outletPipeSize

  All three size selections are in inches.

  The existing flCoefficients argument name is
  retained so existing callers remain compatible.
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

export function calculateLiquidSizing(
  inputs,
  {
    ratedCv = null,
    flCoefficients = null,
    lookupCode = null,
    selectedValve = null,
    pipework = null,
  } = {}
) {
  const processCaseResults = inputs.processCases.map((processCase) => {
    const flowRate = readNumber(processCase.flowRate);
    const pressureIn = readNumber(processCase.pressureIn);
    const pressureOut = readNumber(processCase.pressureOut);

    const pressureDrop =
      pressureIn !== null && pressureOut !== null
        ? pressureIn - pressureOut
        : null;

    const densityKgM3 = getDensityKgM3(processCase, inputs);

    const specificGravity =
      densityKgM3 !== null ? densityKgM3 / 1000 : null;

    const pressureDropBar = convertPressureDropToBar(
      pressureDrop,
      processCase.pressureUnit
    );

    const pressureDropPsi =
      pressureDropBar !== null
        ? pressureDropBar * PSI_PER_BAR
        : null;

    const massFlowKgH = convertFlowToMassKgH(
      flowRate,
      processCase.flowUnit,
      densityKgM3
    );

    // Retain the existing volumetric-flow result field.
    const flowRateGpm =
      massFlowKgH !== null &&
      densityKgM3 !== null &&
      densityKgM3 > 0
        ? massFlowKgH / densityKgM3 / (M3_PER_US_GALLON * 60)
        : null;

    const liquidCvResult = calculateLiquidCv({
      massFlowKgH,
      densityKgM3,
      pressureDropBar,
    });

    const trimResult = calculateLiquidTrimParameters({
      provisionalCv: liquidCvResult?.provisionalCv ?? null,
      ratedCv,
      flCoefficients,
    });

    const flpResult = calculateLiquidFLP({
      FL: trimResult.FL,
      xT: trimResult.xT, // NEW: provide xT for the xTP calculation.
      r: trimResult.cvRatio,
      ratedCv,
      selectedValve,
      pipework,
    });

    const inputWarnings = [];

    if (flowRate === null || flowRate <= 0) {
      inputWarnings.push("Enter a positive flow rate.");
    } else if (massFlowKgH === null && densityKgM3 > 0) {
      inputWarnings.push(
        `Unsupported flow unit: ${processCase.flowUnit}.`
      );
    }

    if (densityKgM3 === null || densityKgM3 <= 0) {
      inputWarnings.push(
        "Enter a positive density or specific gravity using a supported unit."
      );
    }

    if (pressureIn === null || pressureOut === null) {
      inputWarnings.push("Enter valid inlet and outlet pressures.");
    } else if (pressureDropBar === null) {
      inputWarnings.push(
        `Unsupported pressure unit: ${processCase.pressureUnit}.`
      );
    } else if (pressureDropBar <= 0) {
      inputWarnings.push(
        "Inlet pressure must be greater than outlet pressure."
      );
    }

    if (!liquidCvResult && inputWarnings.length === 0) {
      inputWarnings.push(
        "The supplied values did not produce a finite positive Cv."
      );
    }

    return {
      id: processCase.id,
      caseName: processCase.caseName,

      // Existing result fields.
      flowRateGpm,
      pressureDrop,
      pressureDropPsi,
      specificGravity,

      // Normalized inputs and provisional result.
      massFlowKgH,
      densityKgM3,
      pressureDropBar,
      provisionalCv: liquidCvResult?.provisionalCv ?? null,

      requiredCv: liquidCvResult?.requiredCv ?? null,
      calculationBasis: liquidCvResult?.calculationBasis ?? null,
      flowRegime: liquidCvResult?.flowRegime ?? null,

      // Zeta values remain internal.
      // Stroke is separate and is not calculated here.
      technicalDetails: {
        lookupCode,
        ratedCv: trimResult.ratedCv,
        cvRatio: trimResult.cvRatio,
        cvRatioPercent: trimResult.cvRatioPercent,
        FL: trimResult.FL,
        FLP: flpResult.FLP,
        FP: flpResult.FP,
        Fd: trimResult.Fd,
        xT: trimResult.xT,
        xTP: flpResult.xTP, // NEW: expose xTP to the information panel.
      },

      warnings: [
        ...inputWarnings,
        ...(liquidCvResult?.warnings ?? []),
        ...(liquidCvResult ? trimResult.warnings : []),
        ...(liquidCvResult ? flpResult.warnings : []),
      ],

      // Missing trim or diameter data does not prevent
      // provisional Cv calculation.
      canCalculate: Boolean(liquidCvResult),
    };
  });

  return {
    processCaseResults,
  };
}

/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  PROVISIONAL LIQUID Cv CALCULATION

  No iteration or correction pass here yet.
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

export function calculateLiquidCv({
  massFlowKgH,
  densityKgM3,
  pressureDropBar,
}) {
  const m = readNumber(massFlowKgH);
  const density = readNumber(densityKgM3);
  const dp = readNumber(pressureDropBar);

  if (
    m === null ||
    density === null ||
    dp === null ||
    m <= 0 ||
    density <= 0 ||
    dp <= 0
  ) {
    return null;
  }

  const denominator = Math.sqrt(1000 * density * dp);

  if (!Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }

  const provisionalCv = (1.156 * m) / denominator;

  if (!Number.isFinite(provisionalCv) || provisionalCv <= 0) {
    return null;
  }

  return {
    provisionalCv,

    // Use the provisional value until correction equations
    // have been implemented.
    requiredCv: provisionalCv,

    calculationBasis:
      "Provisional liquid Cv: 1.156 × m / √(1000 × density × dP)",

    flowRegime:
      "Preliminary liquid calculation — choking not evaluated",

    warnings: [
      "Provisional Cv only: the correction pass is not yet implemented.",
      "Cavitation, flashing, viscosity, fittings, and choked-flow checks are not yet implemented.",
    ],
  };
}

/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  HELPER: CONVERT FLOW TO kg/h

  gpm is treated as US gallons per minute.
  Volumetric flows use the process-case density.
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

function convertFlowToMassKgH(flowRate, flowUnit, densityKgM3) {
  if (flowRate === null || !Number.isFinite(flowRate)) {
    return null;
  }

  // Mass-flow inputs do not require density for conversion.
  switch (flowUnit) {
    case "kg/h":
      return flowRate;

    case "kg/s":
      return flowRate * 3600;

    case "t/h":
      return flowRate * 1000;

    case "lb/h":
      return flowRate * KG_PER_LB;

    default:
      break;
  }

  if (
    densityKgM3 === null ||
    !Number.isFinite(densityKgM3) ||
    densityKgM3 <= 0
  ) {
    return null;
  }

  switch (flowUnit) {
    case "m3/h":
    case "m³/h":
      return flowRate * densityKgM3;

    case "gpm":
      return flowRate * M3_PER_US_GALLON * 60 * densityKgM3;

    case "L/h":
    case "l/h":
      return (flowRate / 1000) * densityKgM3;

    case "L/min":
    case "l/min":
      return ((flowRate * 60) / 1000) * densityKgM3;

    default:
      return null;
  }
}

/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  HELPER: CONVERT PRESSURE DIFFERENCE TO bar

  Inlet and outlet pressures must use the same
  unit and reference basis.
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

function convertPressureDropToBar(pressureDrop, pressureUnit) {
  if (pressureDrop === null || !Number.isFinite(pressureDrop)) {
    return null;
  }

  switch (pressureUnit) {
    case "bar":
    case "barg":
    case "bara":
      return pressureDrop;

    case "psi":
    case "psig":
    case "psia":
      return pressureDrop / PSI_PER_BAR;

    case "kPa":
    case "kPag":
    case "kPaa":
      return pressureDrop / 100;

    case "MPa":
    case "MPag":
    case "MPaa":
      return pressureDrop * 10;

    case "Pa":
      return pressureDrop / 100000;

    case "kg/cm2":
    case "kg/cm²":
    case "kgcm2g":
    case "kgcm2a":
      return pressureDrop * 0.980665;

    default:
      return null;
  }
}

/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  HELPER: GET DENSITY IN kg/m³

  Retains the application's existing convention:
  density = specific gravity * 1000.
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

function getDensityKgM3(processCase, inputs) {
  if (inputs.densityMode === "sg") {
    const specificGravity = readNumber(processCase.specificGravity);

    if (specificGravity === null || specificGravity <= 0) {
      return null;
    }

    return specificGravity * 1000;
  }

  const density = readNumber(processCase.density);

  if (density === null || density <= 0) {
    return null;
  }

  switch (inputs.densityUnit) {
    case "kg/m³":
    case "kg/m3":
      return density;

    case "lb/ft³":
    case "lb/ft3":
      return density * KG_M3_PER_LB_FT3;

    default:
      return null;
  }
}