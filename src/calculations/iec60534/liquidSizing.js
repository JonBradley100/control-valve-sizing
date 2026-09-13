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

  // Preliminary incompressible liquid relationship.
  // Full IEC 60534 implementation will add correction factors and limit checks.
  const cv = q * Math.sqrt(sg / dp);

  return {
    requiredCv: cv,
    calculationBasis: "IEC 60534 liquid sizing foundation",
    flowRegime: "Preliminary non-choked liquid",
    warnings: [
      "Prototype only: correction factors, cavitation, flashing, viscosity, fittings, and choked-flow checks are not yet implemented.",
    ],
  };
}