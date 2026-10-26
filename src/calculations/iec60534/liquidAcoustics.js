/*
 * Liquid acoustic calculations.
 *
 * Pressure inputs: bara.
 * Choking pressure drop input: bar.
 * Density input: kg/m³.
 * Mass flow input: kg/h, converted internally to kg/s.
 *
 * Existing speed-of-sound calculation:
 *   Downstream diameter: nominal bore in mm, as previously agreed.
 *   Downstream wall thickness: mm.
 *
 * Equation 13 pipe internal diameter:
 *   pipeIDCsvText: loaded text contents of pipeID.csv.
 *   downstreamPipeSizeInch: nominal pipe size in inches.
 *   downstreamPipeSchedule: schedule matching a CSV header.
 *   CSV internal diameter: inches, converted to mm and then metres.
 *
 * Cv, Fd, FL, and Ah must be supplied as finite numbers.
 * Negative and zero Ah values are valid.
 *
 * Intermediate parameters are not intended for display.
 */

/*
 * Parse one CSV row.
 *
 * Quoted fields are supported, including headers such as
 * "size, inch" and "size, mm".
 *
 * Embedded newlines are not required by this numeric table.
 */

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
 * Resolve internal diameter from pipeID.csv.
 *
 * Match nominal pipe size against the first column.
 * Match schedule against the header.
 * Keep schedules such as 40, 40S, and STD distinct.
 *
 * No nominal-bore fallback, interpolation, or schedule
 * substitution is applied.
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

  const sizeInch =
    sizeText === "" ? NaN : Number(sizeText);

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

    const rowSize =
      row[0] === "" ? NaN : Number(row[0]);

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

  const internalDiameterMm =
    internalDiameterInch * 25.4;

  const internalDiameterM =
    internalDiameterMm / 1000;

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

export function calculateLiquidAcoustics({
  p1BarAbsolute,
  p2BarAbsolute,
  pvBarAbsolute,
  Cv,
  Fd,
  FL,
  dpChokedBar,
  densityKgM3,
  massFlowKgH,
  downstreamDiameterMm,
  downstreamWallThicknessMm,
  Ah,
  pipeIDCsvText,
  downstreamPipeSizeInch,
  downstreamPipeSchedule,
} = {}) {
  const warnings = [];

  let xF = null;
  let xFZ = null;
  let xFZp1 = null;
  let Dj = null;
  let uVC = null;
  let Wm = null;
  let c = null;
  let etaTurb = null;
  let etaCav = null;
  let Wa = null;

  let downstreamInternalDiameterInch = null;
  let downstreamInternalDiameterMm = null;
  let Di = null;
  let Lpi = null;

  /*
   * PRESSURE RATIO
   *
   * xF = (p1 - p2) / (p1 - pv)
   */

  const pressures = [
    p1BarAbsolute,
    p2BarAbsolute,
    pvBarAbsolute,
  ];

  // Missing or blank inputs must not be treated as zero.
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
   *
   * xFZ = 0.90 / sqrt(
   *   1 + 3 * Fd * sqrt(Cv / (1.17 * FL))
   * )
   *
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
      Math.sqrt(
        1 + 3 * Fd * Math.sqrt(Cv / (1.17 * FL))
      );

    if (
      Number.isFinite(calculatedXFZ) &&
      calculatedXFZ > 0
    ) {
      xFZ = calculatedXFZ;
    } else {
      warnings.push(
        "The supplied trim values did not produce a finite positive xFZ."
      );
    }
  }

  /*
   * INLET-PRESSURE-CORRECTED xFZ
   *
   * xFZp1 = xFZ * (600000 / p1PaAbsolute)^0.125
   *
   * Convert inlet pressure from bara to Pa absolute.
   */

  if (
    !Number.isFinite(p1BarAbsolute) ||
    p1BarAbsolute <= 0
  ) {
    warnings.push(
      "Acoustic xFZp1 calculation requires a finite positive inlet absolute pressure."
    );
  } else if (xFZ === null) {
    warnings.push(
      "Acoustic xFZp1 calculation is unavailable because xFZ is unavailable."
    );
  } else {
    const p1PaAbsolute = p1BarAbsolute * 100000;

    if (
      !Number.isFinite(p1PaAbsolute) ||
      p1PaAbsolute <= 0
    ) {
      warnings.push(
        "Acoustic xFZp1 calculation could not convert inlet pressure to a finite positive value in Pa absolute."
      );
    } else {
      const calculatedXFZp1 =
        xFZ * Math.pow(600000 / p1PaAbsolute, 0.125);

      if (
        Number.isFinite(calculatedXFZp1) &&
        calculatedXFZp1 > 0
      ) {
        xFZp1 = calculatedXFZp1;
      } else {
        warnings.push(
          "The supplied values did not produce a finite positive xFZp1."
        );
      }
    }
  }

  /*
   * JET DIAMETER
   *
   * Dj = 0.0046 * Fd * sqrt(Cv * FL)
   *
   * Calculate independently of the pressure parameters.
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
    const calculatedDj =
      0.0046 * Fd * Math.sqrt(Cv * FL);

    if (
      Number.isFinite(calculatedDj) &&
      calculatedDj >= 0
    ) {
      Dj = calculatedDj;
    } else {
      warnings.push(
        "The supplied trim values did not produce a finite non-negative jet diameter."
      );
    }
  }

  /*
   * VELOCITY AT THE VENA CONTRACTA
   *
   * uVC = sqrt(2 * dpChokedPa / densityKgM3) / FL
   *
   * Convert choking pressure drop from bar to Pa.
   * Result: m/s.
   *
   * Uses dpCHOKED, not dpSIZING.
   */

  const velocityInputs = [
    FL,
    dpChokedBar,
    densityKgM3,
  ];

  if (!velocityInputs.every(Number.isFinite)) {
    warnings.push(
      "Acoustic uVC calculation requires finite numeric FL, choking pressure drop in bar, and density in kg/m³."
    );
  } else if (
    FL <= 0 ||
    dpChokedBar <= 0 ||
    densityKgM3 <= 0
  ) {
    warnings.push(
      "Acoustic uVC calculation requires positive FL, choking pressure drop, and density."
    );
  } else {
    const dpChokedPa = dpChokedBar * 100000;

    if (
      !Number.isFinite(dpChokedPa) ||
      dpChokedPa <= 0
    ) {
      warnings.push(
        "Acoustic uVC calculation could not convert choking pressure drop to a finite positive value in Pa."
      );
    } else {
      const calculatedUVC =
        Math.sqrt((2 * dpChokedPa) / densityKgM3) / FL;

      if (
        Number.isFinite(calculatedUVC) &&
        calculatedUVC > 0
      ) {
        uVC = calculatedUVC;
      } else {
        warnings.push(
          "The supplied values did not produce a finite positive vena-contracta velocity."
        );
      }
    }
  }

  /*
   * MECHANICAL POWER
   *
   * Wm = massFlowKgS * uVC^2 * FL^2 / 2
   *
   * Convert mass flow from kg/h to kg/s.
   * Result: watts.
   */

  if (
    !Number.isFinite(massFlowKgH) ||
    massFlowKgH <= 0
  ) {
    warnings.push(
      "Acoustic Wm calculation requires a finite positive mass flow in kg/h."
    );
  } else if (
    !Number.isFinite(FL) ||
    FL <= 0
  ) {
    warnings.push(
      "Acoustic Wm calculation requires a finite positive FL."
    );
  } else if (
    !Number.isFinite(uVC) ||
    uVC <= 0
  ) {
    warnings.push(
      "Acoustic Wm calculation is unavailable because a finite positive vena-contracta velocity is unavailable."
    );
  } else {
    const massFlowKgS = massFlowKgH / 3600;

    const calculatedWm =
      (massFlowKgS *
        Math.pow(uVC, 2) *
        Math.pow(FL, 2)) /
      2;

    if (
      Number.isFinite(calculatedWm) &&
      calculatedWm > 0
    ) {
      Wm = calculatedWm;
    } else {
      warnings.push(
        "The supplied values did not produce a finite positive mechanical power."
      );
    }
  }

  /*
   * SPEED OF SOUND
   *
   * c = 1 / sqrt(
   *   densityKgM3 * (
   *     4.65e-10
   *     + (downstreamDiameterMm / downstreamWallThicknessMm)
   *       * 5e-12
   *   )
   * )
   *
   * Diameter: downstream nominal bore in mm, as agreed.
   * Wall thickness: mm.
   * Result: m/s.
   *
   * Existing calculation preserved.
   * Missing wall thickness must not be replaced with zero.
   */

  const soundSpeedInputs = [
    densityKgM3,
    downstreamDiameterMm,
    downstreamWallThicknessMm,
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
      densityKgM3 *
      (4.65e-10 + diameterToThicknessRatio * 5e-12);

    if (
      !Number.isFinite(soundSpeedTerm) ||
      soundSpeedTerm <= 0
    ) {
      warnings.push(
        "The supplied values did not produce a finite positive term for the acoustic c calculation."
      );
    } else {
      const calculatedC = 1 / Math.sqrt(soundSpeedTerm);

      if (
        Number.isFinite(calculatedC) &&
        calculatedC > 0
      ) {
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
   *
   * etaTurb = 10^Ah * (uVC / c)
   *
   * Ah comes from the trim database.
   * Negative and zero Ah values are valid.
   * Result: dimensionless.
   *
   * No default Ah or efficiency clamping is applied.
   */

  if (!Number.isFinite(Ah)) {
    warnings.push(
      "Acoustic etaTurb calculation requires a finite numeric Ah coefficient from the trim database."
    );
  } else if (
    !Number.isFinite(uVC) ||
    uVC <= 0
  ) {
    warnings.push(
      "Acoustic etaTurb calculation is unavailable because a finite positive vena-contracta velocity is unavailable."
    );
  } else if (
    !Number.isFinite(c) ||
    c <= 0
  ) {
    warnings.push(
      "Acoustic etaTurb calculation is unavailable because a finite positive speed of sound is unavailable."
    );
  } else {
    const calculatedEtaTurb =
      Math.pow(10, Ah) * (uVC / c);

    if (
      Number.isFinite(calculatedEtaTurb) &&
      calculatedEtaTurb > 0
    ) {
      etaTurb = calculatedEtaTurb;
    } else {
      warnings.push(
        "The supplied values did not produce a finite positive turbulent-flow acoustic efficiency."
      );
    }
  }

  /*
   * CAVITATION ACOUSTIC EFFICIENCY
   *
   * etaCav =
   *   0.32
   *   * etaTurb
   *   * sqrt(((p1 - p2) / dpChokedBar) / xFZp1)
   *   * exp(5 * xFZp1)
   *   * ((1 - xFZp1) / (1 - xF))^0.5
   *   * (xF / xFZp1)^5
   *   * (xF - xFZp1)^1.5
   *
   * Both pressure differences use bar.
   * Result: dimensionless.
   *
   * Mathematical-domain checks prevent division by zero,
   * non-real fractional powers, and non-finite results.
   *
   * No substitution, clamping, or automatic zero outside
   * the equation's domain is applied.
   */

  const cavitationInputs = [
    etaTurb,
    p1BarAbsolute,
    p2BarAbsolute,
    dpChokedBar,
    xFZp1,
    xF,
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
    const pressureDropBar =
      p1BarAbsolute - p2BarAbsolute;

    const pressureTerm = Math.sqrt(
      (pressureDropBar / dpChokedBar) / xFZp1
    );

    const exponentialTerm =
      Math.exp(5 * xFZp1);

    const recoveryTerm = Math.sqrt(
      (1 - xFZp1) / (1 - xF)
    );

    const pressureRatioTerm =
      Math.pow(xF / xFZp1, 5);

    const onsetTerm =
      Math.pow(xF - xFZp1, 1.5);

    const calculatedEtaCav =
      0.32 *
      etaTurb *
      pressureTerm *
      exponentialTerm *
      recoveryTerm *
      pressureRatioTerm *
      onsetTerm;

    if (
      Number.isFinite(calculatedEtaCav) &&
      calculatedEtaCav >= 0
    ) {
      etaCav = calculatedEtaCav;
    } else {
      warnings.push(
        "The supplied values did not produce a finite non-negative cavitation acoustic efficiency."
      );
    }
  }

  /*
   * SOUND POWER
   *
   * If xF <= xFZp1:
   *   Wa = etaTurb * Wm
   *
   * If xFZp1 < xF < 1:
   *   Wa = (etaTurb + etaCav) * Wm
   *
   * Result: watts.
   *
   * The non-cavitating branch does not require etaCav.
   * No sound-power calculation is assigned for xF >= 1.
   */

  const soundPowerInputs = [
    xF,
    xFZp1,
    etaTurb,
    Wm,
  ];

  if (!soundPowerInputs.every(Number.isFinite)) {
    warnings.push(
      "Acoustic Wa calculation requires finite numeric xF, xFZp1, etaTurb, and Wm."
    );
  } else if (
    xF < 0 ||
    xFZp1 <= 0 ||
    etaTurb < 0 ||
    Wm < 0
  ) {
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
    } else if (
      !Number.isFinite(etaCav) ||
      etaCav < 0
    ) {
      warnings.push(
        "Acoustic Wa calculation in the cavitation region requires a finite non-negative etaCav."
      );
    } else {
      calculatedWa = (etaTurb + etaCav) * Wm;
    }

    if (calculatedWa !== null) {
      if (
        Number.isFinite(calculatedWa) &&
        calculatedWa >= 0
      ) {
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
   *
   * Look up nominal pipe size in the first CSV column
   * and schedule in the header.
   *
   * Intersecting value: internal diameter in inches.
   *
   * internalDiameterMm = internalDiameterInch * 25.4
   * Di = internalDiameterMm / 1000
   *
   * No fallback to nominal bore or another schedule.
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
   * INTERNAL SOUND PRESSURE LEVEL — EQUATION 13
   *
   * Lpi = 10 * log10(
   *   (3.2e9 * Wa * densityKgM3 * c) / Di^2
   * )
   *
   * Wa: watts, from the applicable sound-power branch.
   * densityKgM3: kg/m³.
   * c: m/s, from the existing speed-of-sound calculation.
   * Di: actual internal pipe diameter in metres.
   *
   * Result: internal sound pressure level in dB.
   * This is not the final external A-weighted noise level.
   *
   * Zero Wa cannot produce a finite logarithmic level.
   * No minimum sound power or noise floor is substituted.
   */

  const internalSoundPressureInputs = [
    Wa,
    densityKgM3,
    c,
    Di,
  ];

  if (!internalSoundPressureInputs.every(Number.isFinite)) {
    warnings.push(
      "Acoustic Lpi calculation requires finite numeric sound power, density, speed of sound, and downstream internal pipe diameter."
    );
  } else if (
    Wa <= 0 ||
    densityKgM3 <= 0 ||
    c <= 0 ||
    Di <= 0
  ) {
    warnings.push(
      "Acoustic Lpi calculation requires positive sound power, density, speed of sound, and downstream internal pipe diameter. No noise floor has been assigned."
    );
  } else {
    const internalSoundPressureTerm =
      (3.2e9 * Wa * densityKgM3 * c) /
      Math.pow(Di, 2);

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

  return {
    intermediate: {
      xF,
      xFZ,
      xFZp1,
      Dj,
      uVC,
      Wm,
      c,
      Ah: Number.isFinite(Ah) ? Ah : null,
      etaTurb,
      etaCav,
      Wa,
      downstreamInternalDiameterInch,
      downstreamInternalDiameterMm,
      Di,
      Lpi,
    },
    results: {
      // Final noise output has not yet been implemented.
      noiseDBA: null,
    },
    warnings,
  };
}