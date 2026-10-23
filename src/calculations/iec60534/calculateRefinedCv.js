/**
 * Calculate refined liquid Cv using the piping geometry factor
 * and the sizing pressure drop.
 *
 * Inputs:
 *   volumetricFlowM3H — flow at flowing conditions, m³/h
 *   densityKgM3      — liquid density, kg/m³
 *   FP               — piping geometry factor, dimensionless
 *   dpSIZING         — sizing pressure drop, bar
 *
 * Formula:
 *   Cv = Q / (0.865 * FP) * sqrt(density / (1000 * dpSIZING))
 *
 * This is a single correction pass, not an iterative calculation.
 *
 * Returns:
 *   A non-negative Cv, or null when inputs are unavailable
 *   or invalid.
 */
export default function calculateRefinedCv({
  volumetricFlowM3H,
  densityKgM3,
  FP,
  dpSIZING,
} = {}) {
  const inputs = [
    volumetricFlowM3H,
    densityKgM3,
    FP,
    dpSIZING,
  ];

  const hasMissingInput = inputs.some(
    (value) =>
      value === null ||
      value === undefined ||
      String(value).trim() === ""
  );

  if (hasMissingInput) {
    return null;
  }

  const flow = Number(volumetricFlowM3H);
  const density = Number(densityKgM3);
  const pipingFactor = Number(FP);
  const sizingPressureDrop = Number(dpSIZING);

  if (
    !Number.isFinite(flow) ||
    !Number.isFinite(density) ||
    !Number.isFinite(pipingFactor) ||
    !Number.isFinite(sizingPressureDrop) ||
    flow < 0 ||
    density <= 0 ||
    pipingFactor <= 0 ||
    sizingPressureDrop <= 0
  ) {
    return null;
  }

  const refinedCv =
    (flow / (0.865 * pipingFactor)) *
    Math.sqrt(density / (1000 * sizingPressureDrop));

  return Number.isFinite(refinedCv) ? refinedCv : null;
}