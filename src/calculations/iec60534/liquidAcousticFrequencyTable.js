// liquidAcousticFrequencyTable.js

const THIRD_OCTAVE_FREQUENCIES_HZ = Object.freeze([
  12.5, 16, 20, 25, 31.5, 40,
  50, 63, 80, 100, 125, 160,
  200, 250, 315, 400, 500, 630,
  800, 1000, 1250, 1600, 2000, 2500,
  3150, 4000, 5000, 6300, 8000, 10000,
  12500, 16000, 20000,
]);

// Fixed A-weighting corrections in dB.
// Each entry corresponds to the frequency at the same array index.
const A_WEIGHTING_FACTORS_DB = Object.freeze([
  -63.4, -56.7, -50.5, -44.7, -39.4, -34.6,
  -30.2, -26.2, -22.5, -19.1, -16.1, -13.4,
  -10.9, -8.6, -6.6, -4.8, -3.2, -1.9,
  -0.8, 0, 0.6, 1, 1.2, 1.3,
  1.2, 1, 0.5, -0.1, -1.1, -2.5,
  -4.3, -6.6, -9.3,
]);

if (
  A_WEIGHTING_FACTORS_DB.length !==
  THIRD_OCTAVE_FREQUENCIES_HZ.length
) {
  throw new Error(
    "Each third-octave frequency must have an A-weighting factor."
  );
}

function validateFrequency(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number.`);
  }
}

function validatePipeDimensions(Di, t) {
  if (!Number.isFinite(Di) || Di <= 0) {
    throw new RangeError(
      "Di must be a positive finite number in metres."
    );
  }

  if (!Number.isFinite(t) || t < 0) {
    throw new RangeError(
      "t must be a non-negative finite number in metres."
    );
  }

  const outsideDiameter = Di + 2 * t;

  if (!Number.isFinite(outsideDiameter)) {
    throw new RangeError(
      "The pipe outside diameter must be finite."
    );
  }

  return outsideDiameter;
}

// Equation (16). Frequencies in Hz; result in dB.
export function calculateFturb(frequencyHz, fpTurbHz) {
  validateFrequency(frequencyHz, "frequencyHz");
  validateFrequency(fpTurbHz, "fpTurbHz");

  const ratio = frequencyHz / fpTurbHz;

  return -8 - 10 * Math.log10(
    0.25 * Math.pow(ratio, 3) + 1 / ratio
  );
}

// Equation (17). Frequencies in Hz; result in dB.
export function calculateFcav(frequencyHz, fpCavHz) {
  validateFrequency(frequencyHz, "frequencyHz");
  validateFrequency(fpCavHz, "fpCavHz");

  const ratio = frequencyHz / fpCavHz;

  return -9 - 10 * Math.log10(
    0.25 * Math.pow(ratio, 1.5) + Math.pow(ratio, -1.5)
  );
}

// Equations (14) and (15). Result in dB.
// Returns null for missing inputs or xF >= 1 (outside these branches).
export function calculateLpiBand({
  lpi = null,
  xF = null,
  xFzp1 = null,
  Fturb = null,
  Fcav = null,
  etaTurb = null,
  etaCav = null,
} = {}) {
  if ([lpi, xF, xFzp1, Fturb].some(value => value === null)) {
    return null;
  }

  if (![lpi, xF, xFzp1, Fturb].every(Number.isFinite)) {
    throw new TypeError(
      "lpi, xF, xFzp1 and Fturb must be finite numbers."
    );
  }

  if (xF < 0 || xFzp1 < 0) {
    throw new RangeError("xF and xFzp1 must be non-negative.");
  }

  if (xF >= 1) return null;

  // Non-cavitating conditions: Equation (14).
  if (xF <= xFzp1) return lpi + Fturb;

  // Cavitating conditions: Equation (15).
  if ([Fcav, etaTurb, etaCav].some(value => value === null)) {
    return null;
  }

  if (![Fcav, etaTurb, etaCav].every(Number.isFinite)) {
    throw new TypeError(
      "Fcav, etaTurb and etaCav must be finite numbers."
    );
  }

  if (etaTurb < 0 || etaCav < 0 || etaTurb + etaCav <= 0) {
    throw new RangeError(
      "Efficiencies must be non-negative with a positive sum."
    );
  }

  const etaTotal = etaTurb + etaCav;

  return lpi + 10 * Math.log10(
    (etaTurb / etaTotal) * Math.pow(10, 0.1 * Fturb) +
    (etaCav / etaTotal) * Math.pow(10, 0.1 * Fcav)
  );
}

// Frequency-dependent transmission loss, using the agreed expression.
// Frequencies in Hz; TLfr and result in dB.
//
// dTL(fi) = -20 * log10(fr / fi + (fi / fr)^1.5)
// TL(fi) = TLfr + dTL(fi)
//
// Both frequency terms are inside the logarithm.
// Returns null for missing inputs.
// Negative dB values are preserved; no clamping or fallback is applied.
export function calculateTLBand({
  frequencyHz = null,
  frHz = null,
  TLfr = null,
} = {}) {
  if ([frequencyHz, frHz, TLfr].some(value => value === null)) {
    return null;
  }

  validateFrequency(frequencyHz, "frequencyHz");
  validateFrequency(frHz, "frHz");

  if (!Number.isFinite(TLfr)) {
    throw new TypeError("TLfr must be a finite number in dB.");
  }

  const ratio = frequencyHz / frHz;
  const logarithmArgument =
    frHz / frequencyHz + Math.pow(ratio, 1.5);

  if (
    !Number.isFinite(logarithmArgument) ||
    logarithmArgument <= 0
  ) {
    throw new RangeError(
      "TL calculation requires a finite positive logarithm argument."
    );
  }

  const dTL = -20 * Math.log10(logarithmArgument);
  const TL = TLfr + dTL;

  if (!Number.isFinite(TL)) {
    throw new RangeError(
      "TL calculation did not produce a finite result in dB."
    );
  }

  return TL;
}

// External band sound pressure level at 1 metre.
//
// Lpe,1m(fi) = Lpi(fi) + TL(fi)
//             - 10 * log10((Di + 2*t + 2) / (Di + 2*t))
//
// Di: pipe internal diameter in metres.
// t: pipe wall thickness in metres.
// Lpi, TL and result: dB.
//
// The added 2 represents twice the 1-metre measurement distance.
// Returns null for missing inputs.
export function calculateLpe1mBand({
  Lpi = null,
  TL = null,
  Di = null,
  t = null,
} = {}) {
  if ([Lpi, TL, Di, t].some(value => value === null)) {
    return null;
  }

  if (![Lpi, TL].every(Number.isFinite)) {
    throw new TypeError("Lpi and TL must be finite numbers in dB.");
  }

  const outsideDiameter = validatePipeDimensions(Di, t);
  const logarithmArgument =
    (outsideDiameter + 2) / outsideDiameter;

  if (
    !Number.isFinite(logarithmArgument) ||
    logarithmArgument <= 0
  ) {
    throw new RangeError(
      "Lpe1m calculation requires a finite positive logarithm argument."
    );
  }

  const geometryCorrection = 10 * Math.log10(logarithmArgument);
  const Lpe1m = Lpi + TL - geometryCorrection;

  if (!Number.isFinite(Lpe1m)) {
    throw new RangeError(
      "Lpe1m calculation did not produce a finite result in dB."
    );
  }

  return Lpe1m;
}

// A-weighted external band sound pressure level at 1 metre.
//
// LpAe,1m(fi) = Lpe,1m(fi) + A(fi)
//
// Lpe1m and aWeighting: dB.
// Result: A-weighted band level in dB(A).
// Returns null for missing inputs.
export function calculateLpAe1mBand({
  Lpe1m = null,
  aWeighting = null,
} = {}) {
  if ([Lpe1m, aWeighting].some(value => value === null)) {
    return null;
  }

  if (![Lpe1m, aWeighting].every(Number.isFinite)) {
    throw new TypeError(
      "Lpe1m and aWeighting must be finite numbers in dB."
    );
  }

  const LpAe1m = Lpe1m + aWeighting;

  if (!Number.isFinite(LpAe1m)) {
    throw new RangeError(
      "LpAe1m calculation did not produce a finite result."
    );
  }

  return LpAe1m;
}

// Creates an independent 33-row table for each process case.
//
// frHz: pipe ring frequency in Hz.
// TLfr: reference transmission loss in dB.
// Di: pipe internal diameter in metres.
// t: pipe wall thickness in metres.
//
// Column 9 contains individual A-weighted band levels.
// The overall logarithmic summation is not performed here.
export function calculateLiquidAcousticFrequencyTable({
  fpTurbHz = null,
  fpCavHz = null,
  lpi = null,
  xF = null,
  xFzp1 = null,
  etaTurb = null,
  etaCav = null,
  frHz = null,
  TLfr = null,
  Di = null,
  t = null,
} = {}) {
  if (fpTurbHz !== null) {
    validateFrequency(fpTurbHz, "fpTurbHz");
  }

  if (fpCavHz !== null) {
    validateFrequency(fpCavHz, "fpCavHz");
  }

  if (frHz !== null) {
    validateFrequency(frHz, "frHz");
  }

  if (TLfr !== null && !Number.isFinite(TLfr)) {
    throw new TypeError("TLfr must be a finite number in dB.");
  }

  if (Di !== null && (!Number.isFinite(Di) || Di <= 0)) {
    throw new RangeError(
      "Di must be a positive finite number in metres."
    );
  }

  if (t !== null && (!Number.isFinite(t) || t < 0)) {
    throw new RangeError(
      "t must be a non-negative finite number in metres."
    );
  }

  if (Di !== null && t !== null) {
    validatePipeDimensions(Di, t);
  }

  return THIRD_OCTAVE_FREQUENCIES_HZ.map((frequencyHz, i) => {
    const Fturb = fpTurbHz === null
      ? null
      : calculateFturb(frequencyHz, fpTurbHz);

    const Fcav = fpCavHz === null
      ? null
      : calculateFcav(frequencyHz, fpCavHz);

    const Lpi = calculateLpiBand({
      lpi,
      xF,
      xFzp1,
      Fturb,
      Fcav,
      etaTurb,
      etaCav,
    });

    const TL = calculateTLBand({
      frequencyHz,
      frHz,
      TLfr,
    });

    const Lpe1m = calculateLpe1mBand({
      Lpi,
      TL,
      Di,
      t,
    });

    const aWeighting = A_WEIGHTING_FACTORS_DB[i];

    const LpAe1m = calculateLpAe1mBand({
      Lpe1m,
      aWeighting,
    });

    return {
      index: i + 1,  // 1. Index, i
      frequencyHz,   // 2. Frequency (Hz)
      Fturb,         // 3. Fturb(fi)
      Fcav,          // 4. Fcav(fi)
      Lpi,           // 5. Lpi(fi)
      TL,            // 6. TL(fi)
      Lpe1m,         // 7. Lpe,1m(fi)
      aWeighting,    // 8. A-weighting correction (dB)
      LpAe1m,        // 9. LpAe,1m(fi)
    };
  });
}

export default calculateLiquidAcousticFrequencyTable;