/*
 * Liquid acoustic calculations.
 *
 * Pressure inputs: bara.
 * Choking pressure drop input: bar.
 * Density input: kg/m³.
 * Mass flow input: kg/h, converted internally to kg/s.
 *
 * Speed of sound:
 *   downstreamDiameterMm: downstream nominal bore in mm.
 *   downstreamWallThicknessMm: wall thickness in mm.
 *
 * Pipe internal diameter:
 *   pipeIDCsvText: loaded text contents of pipeID.csv.
 *   downstreamPipeSizeInch: nominal pipe size in inches.
 *   downstreamPipeSchedule: schedule matching a CSV header.
 *   CSV internal diameter: inches, converted to mm and metres.
 *
 * Strouhal geometry:
 *   D = downstreamPipeSizeInch * 0.0254.
 *   D: nominal pipe diameter in metres, not actual internal diameter.
 *
 *   trimAreaM2: A from the selected trim database row, in m².
 *   numberOfHoles: n0 from the same trim database row.
 *   cvPercent: Cv percentage at the selected stroke, on a 0–100 scale.
 *
 *   effectiveFlowAreaM2 = trimAreaM2 * numberOfHoles
 *                         * (cvPercent / 100).
 *   d0 = sqrt(4 * effectiveFlowAreaM2 / Math.PI).
 *   d0: equivalent seat diameter in metres.
 *
 *   Di does not appear in the Strouhal calculation.
 *   Inlet-to-vapour pressure difference is converted to Pa.
 *   N34 = 1.17 for Cv.
 *
 * Peak frequencies:
 *   fpTurb = Stp * uVC / Dj.
 *   fpCav = 6 * fpTurb
 *           * ((1 - xF) / (1 - xFZp1))^2
 *           * (xFZp1 / xF)^2.5.
 *   uVC: m/s. Dj: m. Frequencies: Hz.
 *
 * Pipe and air constants:
 *   cS = 5000 m/s.
 *   rhoS = 7800 kg/m³.
 *   ca = 343 m/s.
 *   rhoa = 1.293 kg/m³.
 *
 * Pipe ring frequency:
 *   fr = cS / (Math.PI * Di).
 *   Di: downstream internal pipe diameter in metres.
 *   fr: Hz.
 *
 * Reference transmission loss — Equation 22:
 *   TLfr = -10 - 10 * log10((cS * rhoS * t) / (ca * rhoa * Di)).
 *   t: downstream wall thickness in metres.
 *   Di: downstream internal pipe diameter in metres.
 *   TLfr: dB. The equation's sign is preserved.
 *
 * Overall A-weighted external sound pressure level at 1 metre:
 *   LpAe1m = 10 * log10(sum(10^(LpAe1m(fi) / 10))).
 *   Uses all 33 A-weighted frequency-band levels.
 *   Returned as results.noiseDBA, in dB(A).
 *   Missing band levels do not produce a partial total.
 *
 * Cv, Fd, FL, Ah, trimAreaM2, numberOfHoles, and cvPercent
 * must be supplied as finite numbers.
 * Negative and zero Ah values are valid.
 * Intermediate parameters are not intended for display.
 */

import calculateLiquidAcousticFrequencyTable from
  "./liquidAcousticFrequencyTable.js";

function parsePipeIDCsvRow(line) {
  const fields = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field.trim());
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error(
      "pipeID.csv contains an unterminated quoted field."
    );
  }

  fields.push(field.trim());
  return fields;
}

/*
 * Match nominal size against the first column and schedule
 * against the header. Keep 40, 40S, and STD distinct.
 * No fallback, interpolation, or schedule substitution.
 */

function lookupPipeInternalDiameter({
  pipeIDCsvText,
  downstreamPipeSizeInch,
  downstreamPipeSchedule,
}) {
  if (
    typeof pipeIDCsvText !== "string" ||
    pipeIDCsvText.trim() === ""
  ) {
    throw new Error(
      "Acoustic pipe ID lookup requires the loaded text contents of pipeID.csv."
    );
  }

  const sizeText =
    typeof downstreamPipeSizeInch === "number" ||
    typeof downstreamPipeSizeInch === "string"
      ? String(downstreamPipeSizeInch).trim()
      : "";

  const sizeInch = sizeText === "" ? NaN : Number(sizeText);

  if (!Number.isFinite(sizeInch) || sizeInch <= 0) {
    throw new Error(
      "Acoustic pipe ID lookup requires a finite positive downstream nominal pipe size in inches."
    );
  }

  const schedule =
    typeof downstreamPipeSchedule === "number" ||
    typeof downstreamPipeSchedule === "string"
      ? String(downstreamPipeSchedule).trim().toUpperCase()
      : "";

  if (schedule === "") {
    throw new Error(
      "Acoustic pipe ID lookup requires a downstream pipe schedule."
    );
  }

  const lines = pipeIDCsvText
    .replace(/^\uFEFF/, "")
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    throw new Error(
      "pipeID.csv must contain a header and at least one data row."
    );
  }

  const headers = parsePipeIDCsvRow(lines[0]);

  if (
    headers[0]?.toLowerCase() !== "size, inch" ||
    headers[1]?.toLowerCase() !== "size, mm"
  ) {
    throw new Error(
      'pipeID.csv must begin with the headers "size, inch" and "size, mm".'
    );
  }

  const scheduleColumns = [];

  for (let index = 2; index < headers.length; index += 1) {
    if (headers[index].toUpperCase() === schedule) {
      scheduleColumns.push(index);
    }
  }

  if (scheduleColumns.length === 0) {
    throw new Error(
      `Downstream pipe schedule "${schedule}" was not found in pipeID.csv.`
    );
  }

  if (scheduleColumns.length > 1) {
    throw new Error(
      `Downstream pipe schedule "${schedule}" appears more than once in pipeID.csv.`
    );
  }

  const scheduleColumn = scheduleColumns[0];
  let matchingRow = null;

  for (let index = 1; index < lines.length; index += 1) {
    const row = parsePipeIDCsvRow(lines[index]);

    if (row.length !== headers.length) {
      throw new Error(
        `pipeID.csv row ${index + 1} has ${row.length} fields; expected ${headers.length}.`
      );
    }

    const rowSize = row[0] === "" ? NaN : Number(row[0]);

    if (!Number.isFinite(rowSize) || rowSize <= 0) {
      throw new Error(
        `pipeID.csv row ${index + 1} has an invalid nominal pipe size.`
      );
    }

    if (rowSize === sizeInch) {
      if (matchingRow !== null) {
        throw new Error(
          `Nominal pipe size ${sizeInch} inches appears more than once in pipeID.csv.`
        );
      }

      matchingRow = row;
    }
  }

  if (matchingRow === null) {
    throw new Error(
      `Downstream nominal pipe size ${sizeInch} inches was not found in pipeID.csv.`
    );
  }

  const cell = matchingRow[scheduleColumn];

  if (cell === "" || cell.toUpperCase() === "N/A") {
    throw new Error(
      `pipeID.csv has no internal diameter for ${sizeInch}-inch pipe, schedule ${schedule}. No substitute has been assigned.`
    );
  }

  const internalDiameterInch = Number(cell);

  if (
    !Number.isFinite(internalDiameterInch) ||
    internalDiameterInch <= 0
  ) {
    throw new Error(
      `pipeID.csv does not contain a finite positive internal diameter for ${sizeInch}-inch pipe, schedule ${schedule}.`
    );
  }

  const internalDiameterMm = internalDiameterInch * 25.4;
  const internalDiameterM = internalDiameterMm / 1000;

  if (
    !Number.isFinite(internalDiameterMm) ||
    internalDiameterMm <= 0 ||
    !Number.isFinite(internalDiameterM) ||
    internalDiameterM <= 0
  ) {
    throw new Error(
      "Acoustic pipe ID lookup could not convert the internal diameter to finite positive values in millimetres and metres."
    );
  }

  return {
    internalDiameterInch,
    internalDiameterMm,
    internalDiameterM,
  };
}

/*
 * Combine the 33 A-weighted frequency-band levels.
 *
 * Returns null if any band level is missing.
 * No missing bands are omitted or replaced with zero.
 *
 * The maximum-level reference is mathematically equivalent
 * to the direct logarithmic summation, but avoids overflow
 * when converting large dB values to linear quantities.
 */

function calculateOverallLpAe1m(frequencyTable) {
  if (!Array.isArray(frequencyTable)) {
    throw new TypeError(
      "Overall acoustic noise calculation requires a frequency table."
    );
  }

  if (frequencyTable.length !== 33) {
    throw new RangeError(
      "Overall acoustic noise calculation requires all 33 frequency bands."
    );
  }

  const bandLevels = [];

  for (let index = 0; index < frequencyTable.length; index += 1) {
    const row = frequencyTable[index];

    if (row === null || typeof row !== "object") {
      throw new TypeError(
        `Acoustic frequency-table row ${index + 1} is invalid.`
      );
    }

    const level = row.LpAe1m;

    if (
      level !== null &&
      level !== undefined &&
      !Number.isFinite(level)
    ) {
      throw new TypeError(
        `A-weighted acoustic level in row ${index + 1} must be a finite number or null.`
      );
    }

    bandLevels.push(level);
  }

  if (
    bandLevels.some(
      (level) => level === null || level === undefined
    )
  ) {
    return null;
  }

  const maximumLevel = Math.max(...bandLevels);

  const scaledEnergySum = bandLevels.reduce(
    (sum, level) =>
      sum + Math.pow(10, (level - maximumLevel) / 10),
    0
  );

  const overallLevel =
    maximumLevel + 10 * Math.log10(scaledEnergySum);

  if (!Number.isFinite(overallLevel)) {
    throw new RangeError(
      "The acoustic band summation did not produce a finite overall noise level."
    );
  }

  return overallLevel;
}

export function calculateLiquidAcoustics({
  p1BarAbsolute, p2BarAbsolute, pvBarAbsolute,
  Cv, Fd, FL, dpChokedBar, densityKgM3,
  massFlowKgH, downstreamDiameterMm,
  downstreamWallThicknessMm, Ah,
  pipeIDCsvText, downstreamPipeSizeInch,
  downstreamPipeSchedule,
  trimAreaM2, numberOfHoles, cvPercent,
} = {}) {
  const warnings = [];

  const cS = 5000;
  const rhoS = 7800;
  const ca = 343;
  const rhoa = 1.293;

  let xF = null; let xFZ = null; let xFZp1 = null;
  let Dj = null; let uVC = null; let Wm = null;
  let c = null; let etaTurb = null; let etaCav = null;
  let Wa = null; let Stp = null;
  let fpTurb = null; let fpCav = null;

  let D = null;
  let maximumFlowAreaM2 = null;
  let effectiveFlowAreaM2 = null;
  let d0 = null;

  let downstreamInternalDiameterInch = null;
  let downstreamInternalDiameterMm = null;
  let Di = null; let t = null; let fr = null;
  let TLfr = null; let Lpi = null;

  let frequencyTable = null;
  let noiseDBA = null;

  /*
   * PRESSURE RATIO
   * xF = (p1 - p2) / (p1 - pv)
   */

  const pressures = [
    p1BarAbsolute, p2BarAbsolute, pvBarAbsolute,
  ];

  if (!pressures.every(Number.isFinite)) {
    warnings.push(
      "Acoustic xF calculation requires valid inlet, outlet, and vapour pressures in bara."
    );
  } else {
    const pressureWarnings = [];

    if (
      p1BarAbsolute <= 0 ||
      p2BarAbsolute <= 0 ||
      pvBarAbsolute < 0
    ) {
      pressureWarnings.push(
        "Absolute inlet and outlet pressures must be positive, and vapour pressure must not be negative."
      );
    }

    if (p1BarAbsolute <= pvBarAbsolute) {
      pressureWarnings.push(
        "The xF calculation requires inlet pressure to be greater than vapour pressure."
      );
    }

    if (p2BarAbsolute > p1BarAbsolute) {
      pressureWarnings.push(
        "The xF calculation requires outlet pressure not to exceed inlet pressure."
      );
    }

    warnings.push(...pressureWarnings);

    if (pressureWarnings.length === 0) {
      const calculatedXF =
        (p1BarAbsolute - p2BarAbsolute) /
        (p1BarAbsolute - pvBarAbsolute);

      if (Number.isFinite(calculatedXF)) {
        xF = calculatedXF;
      } else {
        warnings.push(
          "The supplied pressures did not produce a finite xF."
        );
      }
    }
  }

  /*
   * xFZ
   * xFZ = 0.90 / sqrt(1 + 3 * Fd * sqrt(Cv / (1.17 * FL)))
   * Cv is the refined case Cv supplied by liquidSizing.js.
   */

  const trimInputs = [Cv, Fd, FL];

  if (!trimInputs.every(Number.isFinite)) {
    warnings.push(
      "Acoustic xFZ calculation requires finite numeric Cv, Fd, and FL values."
    );
  } else if (Cv <= 0 || FL <= 0 || Fd < 0) {
    warnings.push(
      "Acoustic xFZ calculation requires positive Cv and FL values, and a non-negative Fd."
    );
  } else {
    const calculatedXFZ =
      0.90 /
      Math.sqrt(1 + 3 * Fd * Math.sqrt(Cv / (1.17 * FL)));

    if (Number.isFinite(calculatedXFZ) && calculatedXFZ > 0) {
      xFZ = calculatedXFZ;
    } else {
      warnings.push(
        "The supplied trim values did not produce a finite positive xFZ."
      );
    }
  }

  /*
   * INLET-PRESSURE-CORRECTED xFZ
   * xFZp1 = xFZ * (600000 / p1PaAbsolute)^0.125
   */

  if (!Number.isFinite(p1BarAbsolute) || p1BarAbsolute <= 0) {
    warnings.push(
      "Acoustic xFZp1 calculation requires a finite positive inlet absolute pressure."
    );
  } else if (xFZ === null) {
    warnings.push(
      "Acoustic xFZp1 calculation is unavailable because xFZ is unavailable."
    );
  } else {
    const p1PaAbsolute = p1BarAbsolute * 100000;

    if (!Number.isFinite(p1PaAbsolute) || p1PaAbsolute <= 0) {
      warnings.push(
        "Acoustic xFZp1 calculation could not convert inlet pressure to a finite positive value in Pa absolute."
      );
    } else {
      const calculatedXFZp1 =
        xFZ * Math.pow(600000 / p1PaAbsolute, 0.125);

      if (Number.isFinite(calculatedXFZp1) && calculatedXFZp1 > 0) {
        xFZp1 = calculatedXFZp1;
      } else {
        warnings.push(
          "The supplied values did not produce a finite positive xFZp1."
        );
      }
    }
  }

  /*
   * NOMINAL PIPE DIAMETER FOR STROUHAL
   * D = downstreamPipeSizeInch * 0.0254
   * Result: metres.
   *
   * Accept a numeric input or numeric string, consistently
   * with the pipe ID lookup.
   * D is not the actual internal pipe diameter Di.
   */

  const nominalPipeSizeText =
    typeof downstreamPipeSizeInch === "number" ||
    typeof downstreamPipeSizeInch === "string"
      ? String(downstreamPipeSizeInch).trim()
      : "";

  const nominalPipeSizeInch =
    nominalPipeSizeText === ""
      ? NaN
      : Number(nominalPipeSizeText);

  if (
    !Number.isFinite(nominalPipeSizeInch) ||
    nominalPipeSizeInch <= 0
  ) {
    warnings.push(
      "Acoustic D calculation requires a finite positive nominal pipe size in inches."
    );
  } else {
    const calculatedD = nominalPipeSizeInch * 0.0254;

    if (Number.isFinite(calculatedD) && calculatedD > 0) {
      D = calculatedD;
    } else {
      warnings.push(
        "Acoustic D calculation could not convert nominal pipe size to a finite positive diameter in metres."
      );
    }
  }

  /*
   * EFFECTIVE FLOW AREA AND EQUIVALENT SEAT DIAMETER
   *
   * A and n0 must come from the same selected trim row.
   * cvPercent must be the Cv percentage at the selected stroke,
   * not the stroke percentage itself.
   *
   * maximumFlowAreaM2 = trimAreaM2 * numberOfHoles
   * effectiveFlowAreaM2 = maximumFlowAreaM2 * (cvPercent / 100)
   * d0 = sqrt(4 * effectiveFlowAreaM2 / Math.PI)
   *
   * A is already in m², so d0 is already in metres.
   * Zero Cv% produces zero area and zero d0; the Strouhal
   * calculation below cannot use a zero denominator.
   * No fallback or clamping is applied.
   */

  const seatGeometryInputs = [
    trimAreaM2, numberOfHoles, cvPercent,
  ];

  if (!seatGeometryInputs.every(Number.isFinite)) {
    warnings.push(
      "Acoustic seat diameter calculation requires finite numeric trim area A in m², hole count n0, and Cv percentage on a 0–100 scale."
    );
  } else if (
    trimAreaM2 <= 0 ||
    numberOfHoles <= 0 ||
    cvPercent < 0 ||
    cvPercent > 100
  ) {
    warnings.push(
      "Acoustic seat diameter calculation requires positive trim area A and hole count n0, and Cv percentage between 0 and 100. No clamping has been applied."
    );
  } else {
    const calculatedMaximumFlowAreaM2 =
      trimAreaM2 * numberOfHoles;

    if (
      !Number.isFinite(calculatedMaximumFlowAreaM2) ||
      calculatedMaximumFlowAreaM2 <= 0
    ) {
      warnings.push(
        "The supplied trim area and hole count did not produce a finite positive maximum total flow area."
      );
    } else {
      maximumFlowAreaM2 = calculatedMaximumFlowAreaM2;

      const calculatedEffectiveFlowAreaM2 =
        maximumFlowAreaM2 * (cvPercent / 100);

      if (
        !Number.isFinite(calculatedEffectiveFlowAreaM2) ||
        calculatedEffectiveFlowAreaM2 < 0
      ) {
        warnings.push(
          "The supplied Cv percentage did not produce a finite non-negative effective flow area."
        );
      } else {
        effectiveFlowAreaM2 = calculatedEffectiveFlowAreaM2;

        const calculatedD0 =
          Math.sqrt((4 * effectiveFlowAreaM2) / Math.PI);

        if (Number.isFinite(calculatedD0) && calculatedD0 >= 0) {
          d0 = calculatedD0;
        } else {
          warnings.push(
            "The effective flow area did not produce a finite non-negative equivalent seat diameter in metres."
          );
        }
      }
    }
  }

  /*
   * STROUHAL NUMBER — EQUATION 19
   * Stp = (0.036 * FL^2 * Cv * Fd^0.75)
   *       / (N34 * xFZp1^1.5 * D * d0)
   *       * (1 / (p1PaAbsolute - pvPaAbsolute))^0.57
   *
   * N34 = 1.17 for Cv.
   * D: nominal pipe diameter in metres.
   * d0: effective equivalent seat diameter in metres.
   * Di is not used here.
   * Result: dimensionless.
   * No defaults or clamping are applied.
   */

  const strouhalInputs = [
    Cv, Fd, FL, xFZp1, D, d0,
    p1BarAbsolute, pvBarAbsolute,
  ];

  if (!strouhalInputs.every(Number.isFinite)) {
    warnings.push(
      "Acoustic Stp calculation requires finite numeric Cv, Fd, FL, xFZp1, nominal pipe diameter D and effective seat diameter d0 in metres, and inlet and vapour pressures in bara."
    );
  } else if (
    Cv <= 0 ||
    FL <= 0 ||
    Fd < 0 ||
    xFZp1 <= 0 ||
    D <= 0 ||
    d0 <= 0
  ) {
    warnings.push(
      "Acoustic Stp calculation requires positive Cv, FL, xFZp1, nominal pipe diameter D, and effective seat diameter d0, and a non-negative Fd."
    );
  } else if (
    pvBarAbsolute < 0 ||
    p1BarAbsolute <= pvBarAbsolute
  ) {
    warnings.push(
      "Acoustic Stp calculation requires non-negative vapour absolute pressure and inlet absolute pressure greater than vapour pressure."
    );
  } else {
    const N34 = 1.17;
    const inletToVapourPressurePa =
      (p1BarAbsolute - pvBarAbsolute) * 100000;

    if (
      !Number.isFinite(inletToVapourPressurePa) ||
      inletToVapourPressurePa <= 0
    ) {
      warnings.push(
        "Acoustic Stp calculation could not convert inlet-to-vapour pressure difference to a finite positive value in Pa."
      );
    } else {
      const denominator =
        N34 * Math.pow(xFZp1, 1.5) * D * d0;

      if (!Number.isFinite(denominator) || denominator <= 0) {
        warnings.push(
          "The supplied values did not produce a finite positive denominator for the acoustic Stp calculation."
        );
      } else {
        const calculatedStp =
          (
            0.036 *
            Math.pow(FL, 2) *
            Cv *
            Math.pow(Fd, 0.75) /
            denominator
          ) *
          Math.pow(1 / inletToVapourPressurePa, 0.57);

        if (Number.isFinite(calculatedStp) && calculatedStp >= 0) {
          Stp = calculatedStp;
        } else {
          warnings.push(
            "The supplied values did not produce a finite non-negative Strouhal number."
          );
        }
      }
    }
  }

  /*
   * JET DIAMETER
   * Dj = 0.0046 * Fd * sqrt(Cv * FL)
   * Result: m.
   */

  if (!trimInputs.every(Number.isFinite)) {
    warnings.push(
      "Acoustic jet diameter calculation requires finite numeric Cv, Fd, and FL values."
    );
  } else if (Cv <= 0 || FL <= 0 || Fd < 0) {
    warnings.push(
      "Acoustic jet diameter calculation requires positive Cv and FL values, and a non-negative Fd."
    );
  } else {
    const calculatedDj = 0.0046 * Fd * Math.sqrt(Cv * FL);

    if (Number.isFinite(calculatedDj) && calculatedDj >= 0) {
      Dj = calculatedDj;
    } else {
      warnings.push(
        "The supplied trim values did not produce a finite non-negative jet diameter."
      );
    }
  }

  /*
   * VELOCITY AT THE VENA CONTRACTA
   * uVC = sqrt(2 * dpChokedPa / densityKgM3) / FL
   * Result: m/s. Uses dpCHOKED, not dpSIZING.
   */

  const velocityInputs = [FL, dpChokedBar, densityKgM3];

  if (!velocityInputs.every(Number.isFinite)) {
    warnings.push(
      "Acoustic uVC calculation requires finite numeric FL, choking pressure drop in bar, and density in kg/m³."
    );
  } else if (FL <= 0 || dpChokedBar <= 0 || densityKgM3 <= 0) {
    warnings.push(
      "Acoustic uVC calculation requires positive FL, choking pressure drop, and density."
    );
  } else {
    const dpChokedPa = dpChokedBar * 100000;

    if (!Number.isFinite(dpChokedPa) || dpChokedPa <= 0) {
      warnings.push(
        "Acoustic uVC calculation could not convert choking pressure drop to a finite positive value in Pa."
      );
    } else {
      const calculatedUVC =
        Math.sqrt((2 * dpChokedPa) / densityKgM3) / FL;

      if (Number.isFinite(calculatedUVC) && calculatedUVC > 0) {
        uVC = calculatedUVC;
      } else {
        warnings.push(
          "The supplied values did not produce a finite positive vena-contracta velocity."
        );
      }
    }
  }

  /*
   * TURBULENT-FLOW PEAK FREQUENCY
   * fpTurb = Stp * uVC / Dj
   * Result: Hz. Dj must be positive.
   */

  const turbulentPeakFrequencyInputs = [Stp, uVC, Dj];

  if (!turbulentPeakFrequencyInputs.every(Number.isFinite)) {
    warnings.push(
      "Acoustic fpTurb calculation requires finite numeric Stp, vena-contracta velocity in m/s, and jet diameter in metres."
    );
  } else if (Stp < 0 || uVC <= 0 || Dj <= 0) {
    warnings.push(
      "Acoustic fpTurb calculation requires a non-negative Stp, positive vena-contracta velocity, and positive jet diameter. No fallback frequency has been assigned."
    );
  } else {
    const calculatedFpTurb = (Stp * uVC) / Dj;

    if (Number.isFinite(calculatedFpTurb) && calculatedFpTurb >= 0) {
      fpTurb = calculatedFpTurb;
    } else {
      warnings.push(
        "The supplied values did not produce a finite non-negative turbulent-flow peak frequency."
      );
    }
  }

  /*
   * CAVITATION PEAK FREQUENCY
   * fpCav = 6 * fpTurb
   *         * ((1 - xF) / (1 - xFZp1))^2
   *         * (xFZp1 / xF)^2.5
   * Result: Hz. Domain: 0 < xFZp1 <= xF < 1.
   */

  const cavitationPeakFrequencyInputs = [fpTurb, xF, xFZp1];

  if (!cavitationPeakFrequencyInputs.every(Number.isFinite)) {
    warnings.push(
      "Acoustic fpCav calculation requires finite numeric fpTurb in Hz, xF, and xFZp1."
    );
  } else if (fpTurb < 0) {
    warnings.push(
      "Acoustic fpCav calculation requires a non-negative turbulent-flow peak frequency."
    );
  } else if (
    xFZp1 <= 0 ||
    xFZp1 >= 1 ||
    xF < xFZp1 ||
    xF >= 1
  ) {
    warnings.push(
      "Acoustic fpCav calculation requires 0 < xFZp1 <= xF < 1. No fallback frequency has been assigned."
    );
  } else {
    const calculatedFpCav =
      6 *
      fpTurb *
      Math.pow((1 - xF) / (1 - xFZp1), 2) *
      Math.pow(xFZp1 / xF, 2.5);

    if (Number.isFinite(calculatedFpCav) && calculatedFpCav >= 0) {
      fpCav = calculatedFpCav;
    } else {
      warnings.push(
        "The supplied values did not produce a finite non-negative cavitation peak frequency."
      );
    }
  }

  /*
   * MECHANICAL POWER
   * Wm = massFlowKgS * uVC^2 * FL^2 / 2
   * Result: watts.
   */

  if (!Number.isFinite(massFlowKgH) || massFlowKgH <= 0) {
    warnings.push(
      "Acoustic Wm calculation requires a finite positive mass flow in kg/h."
    );
  } else if (!Number.isFinite(FL) || FL <= 0) {
    warnings.push(
      "Acoustic Wm calculation requires a finite positive FL."
    );
  } else if (!Number.isFinite(uVC) || uVC <= 0) {
    warnings.push(
      "Acoustic Wm calculation is unavailable because a finite positive vena-contracta velocity is unavailable."
    );
  } else {
    const massFlowKgS = massFlowKgH / 3600;
    const calculatedWm =
      (massFlowKgS * Math.pow(uVC, 2) * Math.pow(FL, 2)) / 2;

    if (Number.isFinite(calculatedWm) && calculatedWm > 0) {
      Wm = calculatedWm;
    } else {
      warnings.push(
        "The supplied values did not produce a finite positive mechanical power."
      );
    }
  }

  /*
   * SPEED OF SOUND
   * c = 1 / sqrt(densityKgM3 *
   *     (4.65e-10 +
   *      (downstreamDiameterMm / downstreamWallThicknessMm) * 5e-12))
   *
   * Existing calculation preserved.
   * Diameter: downstream nominal bore in mm.
   * Wall thickness: mm. Result: m/s.
   */

  const soundSpeedInputs = [
    densityKgM3, downstreamDiameterMm, downstreamWallThicknessMm,
  ];

  if (!soundSpeedInputs.every(Number.isFinite)) {
    warnings.push(
      "Acoustic c calculation requires finite numeric density in kg/m³, downstream nominal bore in mm, and downstream wall thickness in mm."
    );
  } else if (
    densityKgM3 <= 0 ||
    downstreamDiameterMm <= 0 ||
    downstreamWallThicknessMm <= 0
  ) {
    warnings.push(
      "Acoustic c calculation requires positive density, downstream nominal bore, and downstream wall thickness."
    );
  } else {
    const diameterToThicknessRatio =
      downstreamDiameterMm / downstreamWallThicknessMm;
    const soundSpeedTerm =
      densityKgM3 * (4.65e-10 + diameterToThicknessRatio * 5e-12);

    if (!Number.isFinite(soundSpeedTerm) || soundSpeedTerm <= 0) {
      warnings.push(
        "The supplied values did not produce a finite positive term for the acoustic c calculation."
      );
    } else {
      const calculatedC = 1 / Math.sqrt(soundSpeedTerm);

      if (Number.isFinite(calculatedC) && calculatedC > 0) {
        c = calculatedC;
      } else {
        warnings.push(
          "The supplied values did not produce a finite positive speed of sound."
        );
      }
    }
  }

  /*
   * TURBULENT-FLOW ACOUSTIC EFFICIENCY
   * etaTurb = 10^Ah * (uVC / c)
   * Negative and zero Ah are valid.
   * No default Ah or efficiency clamping is applied.
   */

  if (!Number.isFinite(Ah)) {
    warnings.push(
      "Acoustic etaTurb calculation requires a finite numeric Ah coefficient from the trim database."
    );
  } else if (!Number.isFinite(uVC) || uVC <= 0) {
    warnings.push(
      "Acoustic etaTurb calculation is unavailable because a finite positive vena-contracta velocity is unavailable."
    );
  } else if (!Number.isFinite(c) || c <= 0) {
    warnings.push(
      "Acoustic etaTurb calculation is unavailable because a finite positive speed of sound is unavailable."
    );
  } else {
    const calculatedEtaTurb = Math.pow(10, Ah) * (uVC / c);

    if (Number.isFinite(calculatedEtaTurb) && calculatedEtaTurb > 0) {
      etaTurb = calculatedEtaTurb;
    } else {
      warnings.push(
        "The supplied values did not produce a finite positive turbulent-flow acoustic efficiency."
      );
    }
  }

  /*
   * CAVITATION ACOUSTIC EFFICIENCY
   * etaCav = 0.32 * etaTurb
   *          * sqrt(((p1 - p2) / dpChokedBar) / xFZp1)
   *          * exp(5 * xFZp1)
   *          * ((1 - xFZp1) / (1 - xF))^0.5
   *          * (xF / xFZp1)^5
   *          * (xF - xFZp1)^1.5
   *
   * Pressure differences use bar. Result: dimensionless.
   * No substitution, clamping, or automatic zero outside
   * the equation's domain is applied.
   */

  const cavitationInputs = [
    etaTurb, p1BarAbsolute, p2BarAbsolute,
    dpChokedBar, xFZp1, xF,
  ];

  if (!cavitationInputs.every(Number.isFinite)) {
    warnings.push(
      "Acoustic etaCav calculation requires finite numeric etaTurb, inlet and outlet absolute pressures, choking pressure drop, xFZp1, and xF."
    );
  } else if (
    etaTurb < 0 ||
    p1BarAbsolute <= 0 ||
    p2BarAbsolute <= 0 ||
    p2BarAbsolute > p1BarAbsolute ||
    dpChokedBar <= 0
  ) {
    warnings.push(
      "Acoustic etaCav calculation requires non-negative etaTurb, positive absolute pressures with inlet pressure not below outlet pressure, and a positive choking pressure drop."
    );
  } else if (
    xFZp1 <= 0 ||
    xFZp1 >= 1 ||
    xF < xFZp1 ||
    xF >= 1
  ) {
    warnings.push(
      "Acoustic etaCav expression cannot be evaluated in its real, non-singular domain: it requires 0 < xFZp1 <= xF < 1. No fallback value has been assigned."
    );
  } else {
    const pressureDropBar = p1BarAbsolute - p2BarAbsolute;
    const pressureTerm =
      Math.sqrt((pressureDropBar / dpChokedBar) / xFZp1);
    const exponentialTerm = Math.exp(5 * xFZp1);
    const recoveryTerm = Math.sqrt((1 - xFZp1) / (1 - xF));
    const pressureRatioTerm = Math.pow(xF / xFZp1, 5);
    const onsetTerm = Math.pow(xF - xFZp1, 1.5);

    const calculatedEtaCav =
      0.32 *
      etaTurb *
      pressureTerm *
      exponentialTerm *
      recoveryTerm *
      pressureRatioTerm *
      onsetTerm;

    if (Number.isFinite(calculatedEtaCav) && calculatedEtaCav >= 0) {
      etaCav = calculatedEtaCav;
    } else {
      warnings.push(
        "The supplied values did not produce a finite non-negative cavitation acoustic efficiency."
      );
    }
  }

  /*
   * SOUND POWER
   * xF <= xFZp1: Wa = etaTurb * Wm.
   * xFZp1 < xF < 1: Wa = (etaTurb + etaCav) * Wm.
   * The non-cavitating branch does not require etaCav.
   * No calculation is assigned for xF >= 1.
   */

  const soundPowerInputs = [xF, xFZp1, etaTurb, Wm];

  if (!soundPowerInputs.every(Number.isFinite)) {
    warnings.push(
      "Acoustic Wa calculation requires finite numeric xF, xFZp1, etaTurb, and Wm."
    );
  } else if (xF < 0 || xFZp1 <= 0 || etaTurb < 0 || Wm < 0) {
    warnings.push(
      "Acoustic Wa calculation requires non-negative xF, etaTurb, and Wm, and a positive xFZp1."
    );
  } else if (xF >= 1) {
    warnings.push(
      "Acoustic Wa calculation has not yet been defined for xF >= 1."
    );
  } else {
    let calculatedWa = null;

    if (xF <= xFZp1) {
      calculatedWa = etaTurb * Wm;
    } else if (!Number.isFinite(etaCav) || etaCav < 0) {
      warnings.push(
        "Acoustic Wa calculation in the cavitation region requires a finite non-negative etaCav."
      );
    } else {
      calculatedWa = (etaTurb + etaCav) * Wm;
    }

    if (calculatedWa !== null) {
      if (Number.isFinite(calculatedWa) && calculatedWa >= 0) {
        Wa = calculatedWa;
      } else {
        warnings.push(
          "The supplied values did not produce a finite non-negative sound power."
        );
      }
    }
  }

  /*
   * DOWNSTREAM PIPE INTERNAL DIAMETER
   * CSV value: inches. Di: metres.
   */

  try {
    const pipeDiameter = lookupPipeInternalDiameter({
      pipeIDCsvText,
      downstreamPipeSizeInch,
      downstreamPipeSchedule,
    });

    downstreamInternalDiameterInch =
      pipeDiameter.internalDiameterInch;
    downstreamInternalDiameterMm =
      pipeDiameter.internalDiameterMm;
    Di = pipeDiameter.internalDiameterM;
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? error.message
        : "Acoustic pipe ID lookup failed."
    );
  }

  /*
   * PIPE WALL THICKNESS
   * t = downstreamWallThicknessMm / 1000
   * Result: metres.
   * Missing or invalid thickness is not replaced with zero.
   */

  if (
    !Number.isFinite(downstreamWallThicknessMm) ||
    downstreamWallThicknessMm <= 0
  ) {
    warnings.push(
      "Acoustic pipe transmission calculations require a finite positive downstream wall thickness in mm."
    );
  } else {
    const calculatedT = downstreamWallThicknessMm / 1000;

    if (Number.isFinite(calculatedT) && calculatedT > 0) {
      t = calculatedT;
    } else {
      warnings.push(
        "Acoustic pipe transmission calculations could not convert wall thickness to a finite positive value in metres."
      );
    }
  }

  /*
   * PIPE RING FREQUENCY
   * fr = cS / (Math.PI * Di)
   * Result: Hz. Uses CSV internal diameter, not nominal bore.
   */

  const ringFrequencyInputs = [cS, Di];

  if (!ringFrequencyInputs.every(Number.isFinite)) {
    warnings.push(
      "Acoustic fr calculation requires finite numeric pipe-material sound velocity in m/s and downstream internal pipe diameter in metres."
    );
  } else if (cS <= 0 || Di <= 0) {
    warnings.push(
      "Acoustic fr calculation requires positive pipe-material sound velocity and downstream internal pipe diameter. No fallback frequency has been assigned."
    );
  } else {
    const calculatedFr = cS / (Math.PI * Di);

    if (Number.isFinite(calculatedFr) && calculatedFr > 0) {
      fr = calculatedFr;
    } else {
      warnings.push(
        "The supplied values did not produce a finite positive pipe ring frequency."
      );
    }
  }

  /*
   * REFERENCE TRANSMISSION LOSS — EQUATION 22
   * TLfr = -10 - 10 * log10((cS * rhoS * t) / (ca * rhoa * Di))
   *
   * cS and ca: m/s.
   * rhoS and rhoa: kg/m³.
   * t and Di: metres.
   * Result: dB.
   *
   * The equation's sign is preserved.
   * No absolute value, clamping, or fallback is applied.
   */

  const referenceTransmissionInputs = [
    cS, rhoS, t, ca, rhoa, Di,
  ];

  if (!referenceTransmissionInputs.every(Number.isFinite)) {
    warnings.push(
      "Acoustic TLfr calculation requires finite numeric pipe and air sound velocities, pipe and air densities, wall thickness in metres, and downstream internal pipe diameter in metres."
    );
  } else if (
    !referenceTransmissionInputs.every((value) => value > 0)
  ) {
    warnings.push(
      "Acoustic TLfr calculation requires positive pipe and air sound velocities, pipe and air densities, wall thickness, and downstream internal pipe diameter."
    );
  } else {
    const referenceTransmissionTerm =
      (cS * rhoS * t) / (ca * rhoa * Di);

    if (
      !Number.isFinite(referenceTransmissionTerm) ||
      referenceTransmissionTerm <= 0
    ) {
      warnings.push(
        "The supplied values did not produce a finite positive logarithm argument for the acoustic TLfr calculation."
      );
    } else {
      const calculatedTLfr =
        -10 - 10 * Math.log10(referenceTransmissionTerm);

      if (Number.isFinite(calculatedTLfr)) {
        TLfr = calculatedTLfr;
      } else {
        warnings.push(
          "The supplied values did not produce a finite reference transmission loss."
        );
      }
    }
  }

  /*
   * INTERNAL SOUND PRESSURE LEVEL — EQUATION 13
   * Lpi = 10 * log10((3.2e9 * Wa * densityKgM3 * c) / Di^2)
   */

  const internalSoundPressureInputs = [Wa, densityKgM3, c, Di];

  if (!internalSoundPressureInputs.every(Number.isFinite)) {
    warnings.push(
      "Acoustic Lpi calculation requires finite numeric sound power, density, speed of sound, and downstream internal pipe diameter."
    );
  } else if (Wa <= 0 || densityKgM3 <= 0 || c <= 0 || Di <= 0) {
    warnings.push(
      "Acoustic Lpi calculation requires positive sound power, density, speed of sound, and downstream internal pipe diameter. No noise floor has been assigned."
    );
  } else {
    const internalSoundPressureTerm =
      (3.2e9 * Wa * densityKgM3 * c) / Math.pow(Di, 2);

    if (
      !Number.isFinite(internalSoundPressureTerm) ||
      internalSoundPressureTerm <= 0
    ) {
      warnings.push(
        "The supplied values did not produce a finite positive logarithm argument for the acoustic Lpi calculation."
      );
    } else {
      const calculatedLpi =
        10 * Math.log10(internalSoundPressureTerm);

      if (Number.isFinite(calculatedLpi)) {
        Lpi = calculatedLpi;
      } else {
        warnings.push(
          "The supplied values did not produce a finite internal sound pressure level."
        );
      }
    }
  }

  /*
   * FREQUENCY TABLE
   *
   * Map the main calculation's variable names to the
   * frequency-table module's input names.
   *
   * Missing inputs remain null. The table module can
   * return partially populated rows for inspection.
   */

  try {
    frequencyTable = calculateLiquidAcousticFrequencyTable({
      fpTurbHz: fpTurb,
      fpCavHz: fpCav,
      lpi: Lpi,
      xF,
      xFzp1: xFZp1,
      etaTurb,
      etaCav,
      frHz: fr,
      TLfr,
      Di,
      t,
    });
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `Acoustic frequency-table calculation failed: ${error.message}`
        : "Acoustic frequency-table calculation failed."
    );
  }

  /*
   * OVERALL A-WEIGHTED NOISE AT 1 METRE
   *
   * Combine column 9 across all 33 frequency bands.
   * Return the overall level as results.noiseDBA.
   * No partial total, noise floor, or fallback is assigned.
   */

  if (frequencyTable === null) {
    warnings.push(
      "Overall acoustic noise is unavailable because the frequency table could not be calculated."
    );
  } else {
    try {
      const calculatedNoiseDBA =
        calculateOverallLpAe1m(frequencyTable);

      if (calculatedNoiseDBA === null) {
        warnings.push(
          "Overall acoustic noise requires a calculated A-weighted level in all 33 frequency bands. No partial total has been assigned."
        );
      } else {
        noiseDBA = calculatedNoiseDBA;
      }
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Overall acoustic noise calculation failed: ${error.message}`
          : "Overall acoustic noise calculation failed."
      );
    }
  }

  return {
    intermediate: {
      xF, xFZ, xFZp1,
      D, maximumFlowAreaM2, effectiveFlowAreaM2, d0,
      Stp, Dj, uVC,
      fpTurb, fpCav, Wm, c,
      Ah: Number.isFinite(Ah) ? Ah : null,
      etaTurb, etaCav, Wa,
      downstreamInternalDiameterInch,
      downstreamInternalDiameterMm, Di, t,
      cS, rhoS, ca, rhoa, fr, TLfr, Lpi,
    },
    frequencyTable,
    results: {
      noiseDBA,
    },
    warnings,
  };
}