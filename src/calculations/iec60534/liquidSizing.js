export function calculateLiquidSizing(inputs) {
  const processCaseResults = inputs.processCases.map((processCase) => {
    const flowRate = Number(processCase.flowRate);
    const pressureIn = Number(processCase.pressureIn);
    const pressureOut = Number(processCase.pressureOut);

    const pressureDrop = pressureIn - pressureOut;

    const flowRateGpm = convertFlowToGpm(flowRate, processCase.flowUnit);
    const pressureDropPsi = convertPressureDropToPsi(
      pressureDrop,
      processCase.pressureUnit
    );

    const specificGravity = getSpecificGravity(processCase, inputs);

    const liquidCvResult = calculateLiquidCv({
      flowRateGpm,
      specificGravity,
      pressureDropPsi,
    });

    return {
      id: processCase.id,
      caseName: processCase.caseName,

      flowRateGpm,
      pressureDrop,
      pressureDropPsi,
      specificGravity,

      requiredCv: liquidCvResult?.requiredCv ?? null,
      calculationBasis: liquidCvResult?.calculationBasis ?? null,
      flowRegime: liquidCvResult?.flowRegime ?? null,
      warnings: liquidCvResult?.warnings ?? [],
      canCalculate: Boolean(liquidCvResult),
    };
  });

  return {
    processCaseResults,
  };
}

export function calculateLiquidCv({
  flowRateGpm,
  specificGravity,
  pressureDropPsi,
}) {
  const q = Number(flowRateGpm);
  const sg = Number(specificGravity);
  const dp = Number(pressureDropPsi);

  if (!q || !sg || !dp || q <= 0 || sg <= 0 || dp <= 0) {
    return null;
  }

  const cv = q * Math.sqrt(sg / dp);

  return {
    requiredCv: cv,
    calculationBasis: "Preliminary liquid Cv calculation",
    flowRegime: "Preliminary non-choked liquid",
    warnings: [
      "Prototype only: correction factors, cavitation, flashing, viscosity, fittings, and choked-flow checks are not yet implemented.",
    ],
  };
}

function convertFlowToGpm(flowRate, flowUnit) {
  if (!Number.isFinite(flowRate)) {
    return null;
  }

  switch (flowUnit) {
    case "m3/h":
      return flowRate * 4.402867;
    case "gpm":
      return flowRate;
    default:
      return flowRate;
  }
}

function convertPressureDropToPsi(pressureDrop, pressureUnit) {
  if (!Number.isFinite(pressureDrop)) {
    return null;
  }

  switch (pressureUnit) {
    case "barg":
    case "bara":
    case "bar":
      return pressureDrop * 14.5038;
    case "psi":
    case "psig":
    case "psia":
      return pressureDrop;
    default:
      return pressureDrop;
  }
}

function getSpecificGravity(processCase, inputs) {
  if (inputs.densityMode === "sg") {
    return Number(processCase.specificGravity);
  }

  const density = Number(processCase.density);

  if (!Number.isFinite(density)) {
    return null;
  }

  switch (inputs.densityUnit) {
    case "kg/m³":
      return density / 1000;
    case "lb/ft³":
      return density / 62.4;
    default:
      return density / 1000;
  }
}