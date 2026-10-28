import {
  calculateLiquidTrimParameters,
  calculateLiquidFLP,
} from "./liquidCvParameters";

import calculateRefinedCv from "./calculateRefinedCv";
import { calculateLiquidAcoustics } from "./liquidAcoustics";

export {
  calculateLiquidTrimParameters,
  calculateLiquidFLP,
};

const KG_PER_LB = 0.45359237;
const M3_PER_US_GALLON = 0.003785411784;
const KG_M3_PER_LB_FT3 = 16.01846337396014;
const PSI_PER_BAR = 14.503773773;

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

function convertVapourPressureToBarAbsolute(value, unit = "bara") {
  const pressure = readNumber(value);

  if (pressure === null || pressure < 0) {
    return null;
  }

  let pressureBarAbsolute;

  switch (unit) {
    case "bara":
      pressureBarAbsolute = pressure;
      break;
    case "psia":
      pressureBarAbsolute = pressure / PSI_PER_BAR;
      break;
    case "kPaa":
      pressureBarAbsolute = pressure / 100;
      break;
    case "MPaa":
      pressureBarAbsolute = pressure * 10;
      break;
    case "Paa":
      pressureBarAbsolute = pressure / 100000;
      break;
    case "kgcm2a":
      pressureBarAbsolute = pressure * 0.980665;
      break;
    default:
      return null;
  }

  return Number.isFinite(pressureBarAbsolute)
    ? pressureBarAbsolute
    : null;
}

/*
  Convert a process pressure to bar absolute.
  Generic units such as "bar" remain unsupported here
  because they do not identify gauge versus absolute.
*/

function convertInletPressureToBarAbsolute(
  value,
  unit,
  atmosphericPressureBar
) {
  const pressure = readNumber(value);

  if (pressure === null) {
    return null;
  }

  let pressureBar;
  let isGauge = false;

  switch (unit) {
    case "bara":
      pressureBar = pressure;
      break;
    case "barg":
      pressureBar = pressure;
      isGauge = true;
      break;
    case "psia":
      pressureBar = pressure / PSI_PER_BAR;
      break;
    case "psig":
      pressureBar = pressure / PSI_PER_BAR;
      isGauge = true;
      break;
    case "kPaa":
      pressureBar = pressure / 100;
      break;
    case "kPag":
      pressureBar = pressure / 100;
      isGauge = true;
      break;
    case "MPaa":
      pressureBar = pressure * 10;
      break;
    case "MPag":
      pressureBar = pressure * 10;
      isGauge = true;
      break;
    case "Paa":
      pressureBar = pressure / 100000;
      break;
    case "Pag":
      pressureBar = pressure / 100000;
      isGauge = true;
      break;
    case "kgcm2a":
      pressureBar = pressure * 0.980665;
      break;
    case "kgcm2g":
      pressureBar = pressure * 0.980665;
      isGauge = true;
      break;
    default:
      return null;
  }

  if (isGauge) {
    const atmosphere = readNumber(atmosphericPressureBar);

    if (atmosphere === null || atmosphere <= 0) {
      return null;
    }

    pressureBar += atmosphere;
  }

  return Number.isFinite(pressureBar) && pressureBar > 0
    ? pressureBar
    : null;
}

function calculateLiquidFF(
  vapourPressureBarAbsolute,
  criticalPressureBarAbsolute
) {
  const pV = readNumber(vapourPressureBarAbsolute);
  const pC = readNumber(criticalPressureBarAbsolute);

  if (
    pV === null ||
    pC === null ||
    pV < 0 ||
    pC <= 0 ||
    pV > pC
  ) {
    return null;
  }

  const FF = 0.96 - 0.28 * Math.sqrt(pV / pC);
  return Number.isFinite(FF) ? FF : null;
}

/*
  Input pressures: bar absolute.
  Output pressure difference: bar.
*/

function calculateLiquidChokingPressureDrop({
  FLP,
  FP,
  FF,
  pInAbsolute,
  pV,
}) {
  const recoveryFactor = readNumber(FLP);
  const pipingFactor = readNumber(FP);
  const criticalPressureFactor = readNumber(FF);
  const inletPressure = readNumber(pInAbsolute);
  const vapourPressure = readNumber(pV);

  if (
    recoveryFactor === null ||
    recoveryFactor <= 0 ||
    pipingFactor === null ||
    pipingFactor <= 0 ||
    criticalPressureFactor === null ||
    criticalPressureFactor <= 0 ||
    inletPressure === null ||
    inletPressure <= 0 ||
    vapourPressure === null ||
    vapourPressure < 0
  ) {
    return null;
  }

  const pressureTerm =
    inletPressure - criticalPressureFactor * vapourPressure;

  if (!Number.isFinite(pressureTerm) || pressureTerm <= 0) {
    return null;
  }

  const dpCHOKED =
    Math.pow(recoveryFactor / pipingFactor, 2) * pressureTerm;

  return Number.isFinite(dpCHOKED) && dpCHOKED > 0
    ? dpCHOKED
    : null;
}

function calculateLiquidSizingPressureDrop({
  pressureDropBar,
  dpCHOKED,
}) {
  const actualPressureDrop = readNumber(pressureDropBar);
  const chokingPressureDrop = readNumber(dpCHOKED);

  if (
    actualPressureDrop === null ||
    actualPressureDrop <= 0 ||
    chokingPressureDrop === null ||
    chokingPressureDrop <= 0
  ) {
    return null;
  }

  return Math.min(actualPressureDrop, chokingPressureDrop);
}

function calculateRefinedCvRatio(refinedCv, ratedCv) {
  const caseCv = readNumber(refinedCv);
  const maximumCv = readNumber(ratedCv);

  if (
    caseCv === null ||
    caseCv < 0 ||
    maximumCv === null ||
    maximumCv <= 0
  ) {
    return null;
  }

  const ratio = caseCv / maximumCv;
  return Number.isFinite(ratio) ? ratio : null;
}

/*
  Read stage information from the SAME selected trim row.

  Accepted stage-count property names:
  - Stages: original CSV column.
  - stages: lowercase loader mapping.

  Pressure fractions retain the original CSV names:
  s1_dP, s2_dP, s3_dP, s4_dP.

  No stage count is inferred from the valve code.
  No equal-drop fallback or fraction normalisation is used.
*/

function readAcousticStageConfiguration(trimStageData) {
  const warnings = [];

  const stages = readNumber(
    trimStageData?.Stages ?? trimStageData?.stages
  );

  if (
    !Number.isInteger(stages) ||
    stages < 1 ||
    stages > 4
  ) {
    warnings.push(
      "Acoustic stage configuration unavailable: the selected trim row must contain Stages (or stages) as an integer from 1 to 4. Check that loadTrimDatabase preserves this column."
    );

    return {
      stages: null,
      isMultiStage: null,
      finalStageFractionColumn: null,
      finalStagePressureDropFraction: null,
      valid: false,
      warnings,
    };
  }

  if (stages === 1) {
    return {
      stages,
      isMultiStage: false,
      finalStageFractionColumn: "s1_dP",
      finalStagePressureDropFraction: 1,
      valid: true,
      warnings,
    };
  }

  const finalStageFractionColumn = `s${stages}_dP`;
  const finalStagePressureDropFraction = readNumber(
    trimStageData?.[finalStageFractionColumn]
  );

  if (
    finalStagePressureDropFraction === null ||
    finalStagePressureDropFraction <= 0 ||
    finalStagePressureDropFraction >= 1
  ) {
    warnings.push(
      `Multi-stage acoustics unavailable: ${finalStageFractionColumn} must be a numeric pressure-drop fraction greater than 0 and less than 1 in the selected trim row. No equal-stage fallback has been assigned.`
    );

    return {
      stages,
      isMultiStage: true,
      finalStageFractionColumn,
      finalStagePressureDropFraction,
      valid: false,
      warnings,
    };
  }

  return {
    stages,
    isMultiStage: true,
    finalStageFractionColumn,
    finalStagePressureDropFraction,
    valid: true,
    warnings,
  };
}

/*
  Establish the pressure pair used by acoustics.

  Single stage:
    Preserve the overall valve pressure pair.

  Multiple stages:
    finalStageDP = finalStageFraction * valveDP
    finalStageP1Absolute = valveP2Absolute + finalStageDP
    finalStageP2Absolute = valveP2Absolute
*/

function calculateAcousticPressureBasis({
  stageConfiguration,
  pInAbsolute,
  pOutAbsolute,
  pressureDropBar,
}) {
  const warnings = [];

  const unavailable = {
    p1BarAbsolute: null,
    p2BarAbsolute: null,
    pressureDropBar: null,
    warnings,
  };

  if (!stageConfiguration.valid) {
    return unavailable;
  }

  if (!stageConfiguration.isMultiStage) {
    return {
      p1BarAbsolute: pInAbsolute,
      p2BarAbsolute: pOutAbsolute,
      pressureDropBar,
      warnings,
    };
  }

  if (
    !Number.isFinite(pInAbsolute) ||
    pInAbsolute <= 0 ||
    !Number.isFinite(pOutAbsolute) ||
    pOutAbsolute <= 0 ||
    !Number.isFinite(pressureDropBar) ||
    pressureDropBar <= 0 ||
    pInAbsolute <= pOutAbsolute
  ) {
    warnings.push(
      "Multi-stage acoustic pressures unavailable: valid positive absolute valve pressures and a positive valve pressure drop are required."
    );

    return unavailable;
  }

  const finalStagePressureDropBar =
    stageConfiguration.finalStagePressureDropFraction *
    pressureDropBar;

  const finalStageInletAbsolute =
    pOutAbsolute + finalStagePressureDropBar;

  if (
    !Number.isFinite(finalStagePressureDropBar) ||
    finalStagePressureDropBar <= 0 ||
    !Number.isFinite(finalStageInletAbsolute) ||
    finalStageInletAbsolute <= pOutAbsolute
  ) {
    warnings.push(
      "The selected final-stage fraction did not produce a finite positive final-stage pressure drop and inlet absolute pressure."
    );

    return unavailable;
  }

  return {
    p1BarAbsolute: finalStageInletAbsolute,
    p2BarAbsolute: pOutAbsolute,
    pressureDropBar: finalStagePressureDropBar,
    warnings,
  };
}

export function calculateLiquidSizing(
  inputs,
  {
    ratedCv = null,
    Ah = null,
    trimAreaM2 = null,
    numberOfHoles = null,

    // Entire selected trim row, including stage CSV columns.
    trimStageData = null,

    flCoefficients = null,
    lookupCode = null,
    selectedValve = null,
    pipework = null,
    selectedFluid = null,
    atmosphericPressureBar = 1.01325,
    downstreamDiameterMm = null,
    downstreamWallThicknessMm = null,
    pipeIDCsvText = null,
  } = {}
) {
  const pC = readNumber(selectedFluid?.criticalPressure);

  const acousticAh = readNumber(Ah);
  const acousticTrimAreaM2 = readNumber(trimAreaM2);
  const acousticNumberOfHoles = readNumber(numberOfHoles);

  const acousticDownstreamDiameterMm =
    readNumber(downstreamDiameterMm);

  const acousticDownstreamWallThicknessMm =
    readNumber(downstreamWallThicknessMm);

  const downstreamPipeSizeInch =
    readNumber(pipework?.outletPipeSize);

  const downstreamPipeSchedule =
    pipework?.outletPipeSchedule ?? null;

  const stageConfiguration =
    readAcousticStageConfiguration(trimStageData);

  const processCaseResults = inputs.processCases.map((processCase) => {
    const flowRate = readNumber(processCase.flowRate);
    const pressureIn = readNumber(processCase.pressureIn);
    const pressureOut = readNumber(processCase.pressureOut);

    const vapourPressureUnit =
      processCase.vapourPressureUnit ?? "bara";

    const pV = convertVapourPressureToBarAbsolute(
      processCase.vapourPressure,
      vapourPressureUnit
    );

    const FF = calculateLiquidFF(pV, pC);

    const pInAbsolute = convertInletPressureToBarAbsolute(
      pressureIn,
      processCase.pressureUnit,
      atmosphericPressureBar
    );

    const pOutAbsolute = convertInletPressureToBarAbsolute(
      pressureOut,
      processCase.pressureUnit,
      atmosphericPressureBar
    );

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
      xT: trimResult.xT,
      r: trimResult.cvRatio,
      ratedCv,
      selectedValve,
      pipework,
    });

    /*
      OVERALL VALVE SIZING

      These values continue to use overall valve pressures.
      Multi-stage acoustic pressure treatment does not alter Cv.
    */

    const dpCHOKED = calculateLiquidChokingPressureDrop({
      FLP: flpResult.FLP,
      FP: flpResult.FP,
      FF,
      pInAbsolute,
      pV,
    });

    const dpSIZING = calculateLiquidSizingPressureDrop({
      pressureDropBar,
      dpCHOKED,
    });

    const inputWarnings = [];
    const ffWarnings = [];
    const chokingWarnings = [];

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

    if (pV === null) {
      ffWarnings.push(
        "FF unavailable: enter a non-negative vapour pressure using a supported absolute-pressure unit."
      );
    }

    if (pC === null || pC <= 0) {
      ffWarnings.push(
        "FF unavailable: the selected fluid requires a positive critical pressure in bar absolute."
      );
    }

    if (
      pV !== null &&
      pC !== null &&
      pC > 0 &&
      pV > pC
    ) {
      ffWarnings.push(
        "FF unavailable: vapour pressure exceeds the selected fluid's critical pressure. Check the value, units, and fluid."
      );
    }

    if (pInAbsolute === null) {
      chokingWarnings.push(
        "Choking pressure drop unavailable: enter a valid inlet pressure using an explicit absolute or gauge unit. Gauge conversion also requires a positive atmospheric pressure."
      );
    }

    const FLP = readNumber(flpResult.FLP);
    const FP = readNumber(flpResult.FP);

    if (
      FLP === null ||
      FLP <= 0 ||
      FP === null ||
      FP <= 0
    ) {
      chokingWarnings.push(
        "Choking pressure drop unavailable: valid positive FLP and FP values are required."
      );
    }

    if (FF === null) {
      chokingWarnings.push(
        "Choking pressure drop unavailable: FF is unavailable."
      );
    }

    if (
      pInAbsolute !== null &&
      FF !== null &&
      pV !== null &&
      pInAbsolute - FF * pV <= 0
    ) {
      chokingWarnings.push(
        "Choking pressure drop unavailable: inlet absolute pressure minus FF times vapour pressure must be positive."
      );
    }

    const refinedCv = calculateRefinedCv({
      volumetricFlowM3H:
        Number.isFinite(massFlowKgH) &&
        Number.isFinite(densityKgM3) &&
        densityKgM3 > 0
          ? massFlowKgH / densityKgM3
          : null,
      densityKgM3,
      FP: flpResult.FP,
      dpSIZING,
    });

    const refinedCvRatio = calculateRefinedCvRatio(
      refinedCv,
      ratedCv
    );

    const calculatedRefinedCvPercent =
      refinedCvRatio === null ? null : refinedCvRatio * 100;

    const refinedCvPercent =
      Number.isFinite(calculatedRefinedCvPercent)
        ? calculatedRefinedCvPercent
        : null;

    /*
      ACOUSTIC PRESSURE BASIS

      For multi-stage trims:
        Use only the stored final-stage pressure-drop fraction
        to establish the final-stage pressure pair.

      Existing trim coefficients and geometry are retained.
      This is an explicit modelling assumption.
    */

    const acousticPressureBasis = calculateAcousticPressureBasis({
      stageConfiguration,
      pInAbsolute,
      pOutAbsolute,
      pressureDropBar,
    });

    const acousticDpCHOKED =
      !stageConfiguration.valid
        ? null
        : stageConfiguration.isMultiStage
          ? calculateLiquidChokingPressureDrop({
              FLP: flpResult.FLP,
              FP: flpResult.FP,
              FF,
              pInAbsolute: acousticPressureBasis.p1BarAbsolute,
              pV,
            })
          : dpCHOKED;

    const stageWarnings = [
      ...stageConfiguration.warnings,
      ...acousticPressureBasis.warnings,
    ];

    if (
      stageConfiguration.valid &&
      stageConfiguration.isMultiStage
    ) {
      stageWarnings.push(
        "Multi-stage acoustic estimate uses the final-stage pressure pair and retains the existing whole-trim Cv, FL, Fd, FLP, FP, Ah, and geometry. These coefficients have not been established as independent final-stage coefficients. Upstream-stage acoustic contributions are not included."
      );

      if (acousticDpCHOKED === null) {
        stageWarnings.push(
          "Final-stage acoustic choking pressure drop unavailable: valid final-stage inlet absolute pressure, FLP, FP, FF, and vapour pressure are required."
        );
      }
    }

    const acousticCalculation = calculateLiquidAcoustics({
      p1BarAbsolute: acousticPressureBasis.p1BarAbsolute,
      p2BarAbsolute: acousticPressureBasis.p2BarAbsolute,
      pvBarAbsolute: pV,
      Cv: refinedCv,
      Fd: trimResult.Fd,
      FL: trimResult.FL,
      Ah: acousticAh,

      // Separate from the overall valve sizing dpCHOKED.
      dpChokedBar: acousticDpCHOKED,

      densityKgM3,
      massFlowKgH,
      downstreamDiameterMm: acousticDownstreamDiameterMm,
      downstreamWallThicknessMm:
        acousticDownstreamWallThicknessMm,
      pipeIDCsvText,
      downstreamPipeSizeInch,
      downstreamPipeSchedule,
      trimAreaM2: acousticTrimAreaM2,
      numberOfHoles: acousticNumberOfHoles,
      cvPercent: refinedCvPercent,
    });

    const acousticDiagnostics = {
      stages: stageConfiguration.stages,
      isMultiStage: stageConfiguration.isMultiStage,
      pressureBasis: !stageConfiguration.valid
        ? "unavailable"
        : stageConfiguration.isMultiStage
          ? "final-stage"
          : "whole-valve",
      finalStageFractionColumn:
        stageConfiguration.finalStageFractionColumn,
      finalStagePressureDropFraction:
        stageConfiguration.finalStagePressureDropFraction,
      acousticP1BarAbsolute:
        acousticPressureBasis.p1BarAbsolute,
      acousticP2BarAbsolute:
        acousticPressureBasis.p2BarAbsolute,
      acousticPressureDropBar:
        acousticPressureBasis.pressureDropBar,
      acousticDpCHOKED,
    };

    const acoustics = {
      ...acousticCalculation,
      intermediate: {
        ...acousticCalculation.intermediate,
        ...acousticDiagnostics,
      },
      warnings: [
        ...stageWarnings,
        ...(acousticCalculation.warnings ?? []),
      ],
    };

    return {
      id: processCase.id,
      caseName: processCase.caseName,
      flowRateGpm,
      pressureDrop,
      pressureDropPsi,
      specificGravity,
      massFlowKgH,
      densityKgM3,
      pressureDropBar,
      provisionalCv: liquidCvResult?.provisionalCv ?? null,
      requiredCv: refinedCv ?? liquidCvResult?.requiredCv ?? null,
      calculationBasis: liquidCvResult?.calculationBasis ?? null,
      flowRegime: liquidCvResult?.flowRegime ?? null,
      acoustics,

      technicalDetails: {
        lookupCode,
        ratedCv: trimResult.ratedCv,
        cvRatio: refinedCvRatio,
        cvRatioPercent: refinedCvPercent,
        FL: trimResult.FL,
        FLP: flpResult.FLP,
        FP: flpResult.FP,
        Fd: trimResult.Fd,
        FF,
        xT: trimResult.xT,
        xTP: flpResult.xTP,

        // Overall valve sizing pressure differences in bar.
        dpCHOKED,
        dpSIZING,

        // Overall valve pressures in bar absolute.
        pInAbsolute,
        pOutAbsolute,
        pV,
        pC,

        // Separate acoustic pressure inputs for inspection.
        ...acousticDiagnostics,
      },

      warnings: [
        ...inputWarnings,
        ...ffWarnings,
        ...chokingWarnings,
        ...(liquidCvResult?.warnings ?? []),
        ...(liquidCvResult ? trimResult.warnings : []),
        ...(liquidCvResult ? flpResult.warnings : []),
      ],

      canCalculate: Boolean(liquidCvResult),
    };
  });

  return {
    processCaseResults,
  };
}

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
    requiredCv: provisionalCv,
    calculationBasis:
      "Provisional liquid Cv: 1.156 × m / √(1000 × density × dP)",
    flowRegime:
      "Preliminary liquid calculation — choking not applied",
    warnings: [
      "Provisional Cv only: the correction pass is not yet implemented.",
      "The choking and sizing pressure drops are calculated separately but are not yet applied to Cv. Cavitation, flashing, viscosity, and fitting corrections are not yet applied to Cv.",
    ],
  };
}

function convertFlowToMassKgH(flowRate, flowUnit, densityKgM3) {
  if (flowRate === null || !Number.isFinite(flowRate)) {
    return null;
  }

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
    case "Pag":
    case "Paa":
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