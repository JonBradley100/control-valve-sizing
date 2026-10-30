/*
  Shared liquid-trim characteristic and Cv-to-stroke estimate.

  Supported:
    - Circular-hole trims (Type H), stages 1 to 4.
    - Explicit hole-count Arrangement in opening order.
    - Linear hole trims (Style L) with a blank Arrangement:
      equal counts are generated only when n0 / Rows is a
      positive integer.
    - Linear slotted trims (Type S, Style L), stages 1 to 4.

  Hole-trim conventions:
    - Geometry fields describe the final stage.
    - Standard liquid trims have identical stage geometry.
    - Stroke is total piston travel, including deadlift.
    - At Deadlift, the first row begins to be uncovered.
    - Row pitch = hole diameter + signed rowGap.
    - Each circular hole's exposed area is evaluated independently.
    - Cv is proportional to exposed final-stage hole area.
    - Whole-valve rated Cv calibrates the area exposed at Stroke.

  Slotted-trim conventions:
    - Cv is zero through Deadlift.
    - Cv increases linearly from Deadlift to Stroke.

  Solver:
    - Returns the earliest travel achieving the requested Cv.
    - Zero Cv is reported at zero travel.
    - Required Cv above rated Cv is unavailable, not clamped.

  Curve:
    - Uses the same forward characteristic as the stroke solver.
    - Includes geometry transition points.
    - Must be drawn with straight segments, without spline smoothing.

  These are estimated characteristics, not manufacturer-validated
  Cv-versus-travel curves. Alpha is not applied again because
  rated Cv provides calibration.
*/

function readNumber(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === "" ||
    String(value).trim() === "-"
  ) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readTrimNumber(trim, keys) {
  for (const key of keys) {
    const number = readNumber(trim?.[key]);

    if (number !== null) {
      return number;
    }
  }

  return null;
}

function readTrimText(trim, keys) {
  for (const key of keys) {
    const value = trim?.[key];

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    ) {
      return String(value).trim().toUpperCase();
    }
  }

  return "";
}

function isBlank(value) {
  return (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  );
}

function unavailableResult(
  status,
  warnings,
  diagnostics = {},
  model = null
) {
  return {
    strokePercent: null,
    travelMm: null,
    travelAfterDeadliftMm: null,
    activeTravelPercent: null,
    fullStrokeAreaPercent: null,
    exposedAreaMm2: null,
    fullStrokeAreaMm2: null,
    estimatedCv: null,
    status,
    model,
    diagnostics,
    rows: [],
    warnings,
  };
}

/*
  Parse raw Arrangement before considering holesArray.

  Trailing "/" delimiters are allowed.
  Interior empty entries, nonintegers and nonpositive counts
  are rejected rather than silently removed.

  A nonblank invalid arrangement never receives an equal-row
  fallback.
*/

function readArrangement(trim) {
  const rawArrangement = !isBlank(trim?.arrangement)
    ? trim.arrangement
    : trim?.Arrangement;

  if (!isBlank(rawArrangement)) {
    const entries = String(rawArrangement)
      .trim()
      .split("/")
      .map((entry) => entry.trim());

    while (
      entries.length > 0 &&
      entries[entries.length - 1] === ""
    ) {
      entries.pop();
    }

    if (
      entries.length === 0 ||
      entries.some((entry) => entry === "")
    ) {
      return {
        arrangement: null,
        source: "explicit",
        invalid: true,
      };
    }

    const counts = entries.map(Number);

    const valid = counts.every(
      (count) => Number.isInteger(count) && count > 0
    );

    return {
      arrangement: valid ? counts : null,
      source: "explicit",
      invalid: !valid,
    };
  }

  // Allow validated programmatic arrangements when no raw CSV
  // arrangement is supplied. An empty array means "not supplied".
  if (
    Array.isArray(trim?.holesArray) &&
    trim.holesArray.length > 0
  ) {
    const valid = trim.holesArray.every(
      (count) => Number.isInteger(count) && count > 0
    );

    return {
      arrangement: valid ? [...trim.holesArray] : null,
      source: "programmatic",
      invalid: !valid,
    };
  }

  return {
    arrangement: null,
    source: "missing",
    invalid: false,
  };
}

/*
  Circular segment uncovered by a straight piston edge.
  Dimensions are in mm; returned area is in mm².
*/

function circularSegmentArea(exposedHeight, radius) {
  const diameter = 2 * radius;
  const completeArea = Math.PI * radius * radius;

  if (exposedHeight <= 0) return 0;
  if (exposedHeight >= diameter) return completeArea;

  const offset = radius - exposedHeight;

  const acosInput = Math.max(
    -1,
    Math.min(1, offset / radius)
  );

  const radicand = Math.max(
    0,
    2 * radius * exposedHeight -
      exposedHeight * exposedHeight
  );

  const area =
    radius * radius * Math.acos(acosInput) -
    offset * Math.sqrt(radicand);

  return Math.max(0, Math.min(completeArea, area));
}

function calculateExposedArea(geometry, travelMm) {
  let totalArea = 0;

  geometry.arrangement.forEach((holeCount, index) => {
    const startTravelMm =
      geometry.deadliftMm + index * geometry.rowPitchMm;

    const exposedHeightMm = Math.max(
      0,
      Math.min(
        geometry.holeDiameterMm,
        travelMm - startTravelMm
      )
    );

    totalArea +=
      holeCount *
      circularSegmentArea(
        exposedHeightMm,
        geometry.holeRadiusMm
      );
  });

  return totalArea;
}

function calculateRowExposure(geometry, travelMm) {
  return geometry.arrangement.map((holeCount, index) => {
    const startTravelMm =
      geometry.deadliftMm + index * geometry.rowPitchMm;

    const exposedHeightMm = Math.max(
      0,
      Math.min(
        geometry.holeDiameterMm,
        travelMm - startTravelMm
      )
    );

    const areaPerHoleMm2 = circularSegmentArea(
      exposedHeightMm,
      geometry.holeRadiusMm
    );

    return {
      row: index + 1,
      holeCount,
      startTravelMm,
      fullyOpenTravelMm:
        startTravelMm + geometry.holeDiameterMm,
      exposedHeightMm,
      openAreaPercent:
        (areaPerHoleMm2 / geometry.singleHoleAreaMm2) * 100,
      exposedAreaMm2: holeCount * areaPerHoleMm2,
      status:
        exposedHeightMm <= 0
          ? "covered"
          : exposedHeightMm >= geometry.holeDiameterMm
            ? "fully open"
            : "partially open",
    };
  });
}

/*
  Create the shared forward model.

  evaluateTravel() accepts travel within the specified stroke.
  It returns null for invalid or out-of-range travel.

  The returned object includes a function and is intended for
  in-memory use. Store curve points/results, not this object,
  in reports or scenario JSON.
*/

export function createTrimCharacteristic({
  trim = null,
  ratedCv = null,
} = {}) {
  const warnings = [];

  function fail(status, messages, diagnostics = {}, model = null) {
    return {
      status,
      model,
      warnings: messages,
      diagnostics,
      geometry: null,
      evaluateTravel: null,
    };
  }

  if (!trim) {
    return fail("unavailable", [
      "Trim characteristic unavailable: select a trim with valid geometry.",
    ]);
  }

  const trimType = readTrimText(trim, ["type", "Type"]);
  const style = readTrimText(trim, ["style", "Style"]);

  const stages = readTrimNumber(trim, [
    "Stages",
    "stagesNumeric",
    "stages",
  ]);

  const maximumCv = readNumber(ratedCv);

  const strokeMm = readTrimNumber(trim, [
    "strokeNumeric",
    "stroke",
    "Stroke",
  ]);

  const deadliftMm = readTrimNumber(trim, [
    "deadliftNumeric",
    "deadlift",
    "Deadlift",
  ]);

  const model =
    trimType === "H"
      ? "exposed-area-proportional"
      : trimType === "S" && style === "L"
        ? "linear-active-stroke"
        : null;

  const baseDiagnostics = {
    trimCode: trim.code ?? trim.Code ?? null,
    trimType,
    style,
    stages,
    geometryStage: stages,
    ratedCv: maximumCv,
    strokeMm,
    deadliftMm,
    deadliftStrokePercent:
      strokeMm !== null &&
      strokeMm > 0 &&
      deadliftMm !== null
        ? (deadliftMm / strokeMm) * 100
        : null,
  };

  if (model === null) {
    return fail(
      "unsupported",
      [
        "Trim characteristic unavailable: supported types are circular-hole trims (H) and linear slotted trims (S, Style L). No alternative characteristic has been assumed.",
      ],
      baseDiagnostics
    );
  }

  if (
    !Number.isInteger(stages) ||
    stages < 1 ||
    stages > 4
  ) {
    warnings.push(
      "Trim characteristic unavailable: Stages must be an integer from 1 to 4."
    );
  }

  if (maximumCv === null || maximumCv <= 0) {
    warnings.push(
      "Trim characteristic unavailable: a positive rated Cv is required."
    );
  }

  if (strokeMm === null || strokeMm <= 0) {
    warnings.push(
      "Trim characteristic unavailable: a positive Stroke in mm is required."
    );
  }

  if (
    deadliftMm === null ||
    deadliftMm < 0 ||
    (
      strokeMm !== null &&
      strokeMm > 0 &&
      deadliftMm >= strokeMm
    )
  ) {
    warnings.push(
      "Trim characteristic unavailable: Deadlift must be nonnegative and less than Stroke, both in mm."
    );
  }

  if (warnings.length > 0) {
    return fail(
      "invalid-geometry",
      warnings,
      baseDiagnostics,
      model
    );
  }

  if (model === "linear-active-stroke") {
    warnings.push(
      "Stroke is estimated using a linear slotted-trim characteristic: zero Cv through Deadlift, then a linear increase to whole-valve rated Cv at the specified full stroke. This is not a manufacturer-validated Cv-versus-travel curve."
    );

    if (stages > 1) {
      warnings.push(
        "The linear slotted characteristic is applied to the complete multi-stage liquid trim. Individual stage hydraulic characteristics have not been independently modelled."
      );
    }

    return {
      status: "estimated",
      model,
      warnings,
      diagnostics: baseDiagnostics,
      geometry: {
        strokeMm,
        deadliftMm,
      },
      evaluateTravel(travelValue) {
        const travelMm = readNumber(travelValue);

        if (
          travelMm === null ||
          travelMm < 0 ||
          travelMm > strokeMm
        ) {
          return null;
        }

        const fraction =
          travelMm <= deadliftMm
            ? 0
            : (travelMm - deadliftMm) /
              (strokeMm - deadliftMm);

        return {
          travelMm,
          strokePercent: (travelMm / strokeMm) * 100,
          estimatedCv: maximumCv * fraction,
          cvCapacityPercent: fraction * 100,

          // This model does not calculate physical exposed area.
          exposedAreaMm2: null,
          fullStrokeAreaMm2: null,
          fullStrokeAreaPercent: null,
        };
      },
    };
  }

  const holeDiameterMm = readTrimNumber(trim, [
    "hydraulicDiameterNumeric",
    "dh",
    "dH",
  ]);

  const rowGapMm = readTrimNumber(trim, [
    "rowGapNumeric",
    "rowgap",
    "rowGap",
  ]);

  const rowCount = readTrimNumber(trim, [
    "rowsNumeric",
    "rows",
    "Rows",
  ]);

  const totalHoleCount = readTrimNumber(trim, [
    "n0Numeric",
    "n0",
  ]);

  const parsedArrangement = readArrangement(trim);

  let arrangement = parsedArrangement.arrangement;
  let arrangementSource = parsedArrangement.source;

  if (holeDiameterMm === null || holeDiameterMm <= 0) {
    warnings.push(
      "Trim characteristic unavailable: the circular-hole trim requires a positive dH in mm."
    );
  }

  if (rowGapMm === null) {
    warnings.push(
      "Trim characteristic unavailable: a numeric signed rowGap in mm is required."
    );
  }

  if (!Number.isInteger(rowCount) || rowCount < 1) {
    warnings.push(
      "Trim characteristic unavailable: Rows must be a positive integer."
    );
  }

  if (
    !Number.isInteger(totalHoleCount) ||
    totalHoleCount < 1
  ) {
    warnings.push(
      "Trim characteristic unavailable: n0 must be a positive integer."
    );
  }

  if (parsedArrangement.invalid) {
    warnings.push(
      "Trim characteristic unavailable: the supplied Arrangement must contain positive integer hole counts in opening order, with no interior empty entries."
    );
  } else if (!arrangement) {
    if (style !== "L") {
      warnings.push(
        "Trim characteristic unavailable: an explicit Arrangement is required for a non-linear hole trim. Equal rows have not been assumed."
      );
    } else if (
      Number.isInteger(rowCount) &&
      rowCount > 0 &&
      Number.isInteger(totalHoleCount) &&
      totalHoleCount > 0
    ) {
      const holesPerRow = totalHoleCount / rowCount;

      if (
        !Number.isInteger(holesPerRow) ||
        holesPerRow <= 0
      ) {
        warnings.push(
          `Trim characteristic unavailable: the linear trim has a blank Arrangement, but n0 / Rows (${totalHoleCount} / ${rowCount}) is not a positive whole number. Hole counts have not been rounded.`
        );
      } else {
        arrangement = Array(rowCount).fill(holesPerRow);
        arrangementSource = "generated-equal-rows";
      }
    }
  }

  if (
    arrangement &&
    Number.isInteger(rowCount) &&
    arrangement.length !== rowCount
  ) {
    warnings.push(
      `Trim characteristic unavailable: Arrangement contains ${arrangement.length} rows, but Rows specifies ${rowCount}.`
    );
  }

  const arrangementHoleCount = arrangement
    ? arrangement.reduce((total, count) => total + count, 0)
    : null;

  if (
    arrangement &&
    Number.isInteger(totalHoleCount) &&
    arrangementHoleCount !== totalHoleCount
  ) {
    warnings.push(
      `Trim characteristic unavailable: Arrangement totals ${arrangementHoleCount} holes, but n0 specifies ${totalHoleCount}.`
    );
  }

  const rowPitchMm =
    holeDiameterMm !== null && rowGapMm !== null
      ? holeDiameterMm + rowGapMm
      : null;

  if (rowPitchMm !== null && rowPitchMm <= 0) {
    warnings.push(
      "Trim characteristic unavailable: dH + rowGap must produce a positive axial row pitch."
    );
  }

  const geometryDiagnostics = {
    ...baseDiagnostics,
    holeDiameterMm,
    rowGapMm,
    rowPitchMm,
    rowCount,
    totalHoleCount,
    arrangementHoleCount,
    arrangementSource,
    arrangement: arrangement ? [...arrangement] : null,
  };

  if (warnings.length > 0) {
    return fail(
      "invalid-geometry",
      warnings,
      geometryDiagnostics,
      model
    );
  }

  const holeRadiusMm = holeDiameterMm / 2;
  const singleHoleAreaMm2 =
    Math.PI * holeRadiusMm * holeRadiusMm;

  const geometry = {
    strokeMm,
    deadliftMm,
    holeDiameterMm,
    holeRadiusMm,
    rowGapMm,
    rowPitchMm,
    rowCount,
    totalHoleCount,
    singleHoleAreaMm2,
    arrangement,
  };

  const allRowsFullyOpenTravelMm =
    deadliftMm +
    (rowCount - 1) * rowPitchMm +
    holeDiameterMm;

  const fullOpeningBeyondStrokeMm = Math.max(
    0,
    allRowsFullyOpenTravelMm - strokeMm
  );

  const fullStrokeAreaMm2 = calculateExposedArea(
    geometry,
    strokeMm
  );

  const allHolesAreaMm2 =
    totalHoleCount * singleHoleAreaMm2;

  if (
    !Number.isFinite(allHolesAreaMm2) ||
    allHolesAreaMm2 <= 0 ||
    !Number.isFinite(fullStrokeAreaMm2) ||
    fullStrokeAreaMm2 <= 0 ||
    !Number.isFinite(allRowsFullyOpenTravelMm)
  ) {
    return fail(
      "invalid-geometry",
      [
        "Trim characteristic unavailable: the stored geometry did not produce finite positive hole areas and finite row positions.",
      ],
      geometryDiagnostics,
      model
    );
  }

  if (arrangementSource === "generated-equal-rows") {
    warnings.push(
      `Linear hole trim: the blank Arrangement has been resolved to ${rowCount} equal rows of ${arrangement[0]} holes from n0 / Rows. The characteristic still uses circular-hole exposure, not an imposed straight line.`
    );
  }

  if (fullOpeningBeyondStrokeMm > 1e-8) {
    warnings.push(
      `Stroke geometry: all rows become fully uncovered at ${allRowsFullyOpenTravelMm.toFixed(4)} mm, ${fullOpeningBeyondStrokeMm.toFixed(4)} mm beyond the specified stroke. Stored dimensions have not been adjusted; rated Cv is normalized against exposed area at the specified full stroke.`
    );
  }

  warnings.push(
    "Stroke is a geometry-based estimate assuming Cv is proportional to exposed hole area. Arrangement is interpreted in opening order and rowGap as a signed axial edge-to-edge gap. This is not a manufacturer-validated Cv-versus-travel curve."
  );

  if (stages > 1) {
    warnings.push(
      "Multi-stage liquid-trim characteristic uses final-stage exposed hole area calibrated to whole-valve rated Cv. For differing-stage designs, upstream-stage exposure and hydraulic interactions have not been independently modelled."
    );
  }

  const diagnostics = {
    ...geometryDiagnostics,
    allHolesAreaMm2,
    fullStrokeAreaMm2,
    allRowsFullyOpenTravelMm,
    fullOpeningBeyondStrokeMm,
    ratedCapacityFirstTravelMm: Math.min(
      allRowsFullyOpenTravelMm,
      strokeMm
    ),
  };

  return {
    status: "estimated",
    model,
    warnings,
    diagnostics,
    geometry,
    evaluateTravel(travelValue) {
      const travelMm = readNumber(travelValue);

      if (
        travelMm === null ||
        travelMm < 0 ||
        travelMm > strokeMm
      ) {
        return null;
      }

      const exposedAreaMm2 = calculateExposedArea(
        geometry,
        travelMm
      );

      const fraction =
        exposedAreaMm2 / fullStrokeAreaMm2;

      return {
        travelMm,
        strokePercent: (travelMm / strokeMm) * 100,
        estimatedCv: maximumCv * fraction,
        cvCapacityPercent: fraction * 100,
        exposedAreaMm2,
        fullStrokeAreaMm2,
        fullStrokeAreaPercent: fraction * 100,
      };
    },
  };
}

/*
  Produce serializable curve points for charts and exports.

  In addition to uniform stroke samples, include:
    - Zero travel.
    - Deadlift.
    - Full stroke.
    - Samples across every circular-hole row opening.
    - Exact row start and fully-open boundaries.

  Draw points in their returned order with linear segments.
*/

export function calculateTrimCurve({
  trim = null,
  ratedCv = null,
  sampleCount = 1000,
} = {}) {
  const characteristic = createTrimCharacteristic({
    trim,
    ratedCv,
  });

  if (characteristic.status !== "estimated") {
    return {
      status: characteristic.status,
      model: characteristic.model,
      diagnostics: characteristic.diagnostics,
      warnings: [...characteristic.warnings],
      points: [],
    };
  }

  const { strokeMm, deadliftMm } = characteristic.geometry;
  const travelSamples = new Set([0, deadliftMm, strokeMm]);

  // Sampling changes display resolution, not the model.
  const requestedSamples = readNumber(sampleCount);
  const intervals = Math.max(
    2,
    Math.min(
      10000,
      requestedSamples === null
        ? 1000
        : Math.round(requestedSamples)
    )
  );

  for (let index = 0; index <= intervals; index += 1) {
    travelSamples.add((index / intervals) * strokeMm);
  }

  if (characteristic.model === "exposed-area-proportional") {
    const geometry = characteristic.geometry;

    geometry.arrangement.forEach((holeCount, rowIndex) => {
      const startTravelMm =
        deadliftMm + rowIndex * geometry.rowPitchMm;

      for (let index = 0; index <= 24; index += 1) {
        const travelMm =
          startTravelMm +
          (index / 24) * geometry.holeDiameterMm;

        if (travelMm >= 0 && travelMm <= strokeMm) {
          travelSamples.add(travelMm);
        }
      }
    });
  }

  const points = [...travelSamples]
    .sort((a, b) => a - b)
    .map((travelMm) =>
      characteristic.evaluateTravel(travelMm)
    );

  return {
    status: "estimated",
    model: characteristic.model,
    diagnostics: { ...characteristic.diagnostics },
    warnings: [...characteristic.warnings],
    points,
  };
}

/*
  Existing entry point used by liquidSizing.js.

  Output field names are retained so ResultPanel continues
  to read technicalDetails.strokePercent without changes.
*/

export function calculateTrimStroke({
  trim = null,
  requiredCv = null,
  ratedCv = null,
} = {}) {
  const characteristic = createTrimCharacteristic({
    trim,
    ratedCv,
  });

  if (characteristic.status !== "estimated") {
    return unavailableResult(
      characteristic.status,
      [...characteristic.warnings],
      characteristic.diagnostics,
      characteristic.model
    );
  }

  const caseCv = readNumber(requiredCv);
  const maximumCv = characteristic.diagnostics.ratedCv;

  const diagnostics = {
    ...characteristic.diagnostics,
    requiredCv: caseCv,
    cvCapacityPercent:
      caseCv !== null ? (caseCv / maximumCv) * 100 : null,
  };

  if (caseCv === null || caseCv < 0) {
    return unavailableResult(
      "unavailable",
      [
        ...characteristic.warnings,
        "Stroke unavailable: a valid nonnegative refined process Cv is required. No provisional-Cv fallback has been used.",
      ],
      diagnostics,
      characteristic.model
    );
  }

  if (caseCv > maximumCv) {
    return unavailableResult(
      "insufficient-capacity",
      [
        ...characteristic.warnings,
        `Stroke unavailable: required Cv ${caseCv.toFixed(2)} exceeds rated Cv ${maximumCv.toFixed(2)}. The case cannot be achieved within the rated stroke.`,
      ],
      diagnostics,
      characteristic.model
    );
  }

  const { strokeMm, deadliftMm } = characteristic.geometry;

  let travelMm = 0;
  let targetAreaMm2 = null;

  if (characteristic.model === "linear-active-stroke") {
    if (caseCv > 0) {
      travelMm =
        deadliftMm +
        (caseCv / maximumCv) * (strokeMm - deadliftMm);
    }
  } else {
    targetAreaMm2 =
      (caseCv / maximumCv) *
      characteristic.diagnostics.fullStrokeAreaMm2;

    if (caseCv > 0) {
      let lowerTravelMm = deadliftMm;

      // Once all rows are open, further travel cannot add area.
      // Keeping the upper bound here also preserves the earliest
      // rated-Cv travel when capacity is reached before Stroke.
      let upperTravelMm =
        characteristic.diagnostics.ratedCapacityFirstTravelMm;

      for (let iteration = 0; iteration < 80; iteration += 1) {
        const midpointMm =
          (lowerTravelMm + upperTravelMm) / 2;

        // Stop when floating-point precision prevents refinement.
        if (
          midpointMm === lowerTravelMm ||
          midpointMm === upperTravelMm
        ) {
          break;
        }

        const areaMm2 = calculateExposedArea(
          characteristic.geometry,
          midpointMm
        );

        if (areaMm2 < targetAreaMm2) {
          lowerTravelMm = midpointMm;
        } else {
          upperTravelMm = midpointMm;
        }
      }

      travelMm = upperTravelMm;
    }
  }

  const evaluated = characteristic.evaluateTravel(travelMm);

  if (!evaluated) {
    return unavailableResult(
      "unavailable",
      [
        ...characteristic.warnings,
        "Stroke unavailable: the solver did not produce travel within the specified stroke.",
      ],
      diagnostics,
      characteristic.model
    );
  }

  const travelAfterDeadliftMm = Math.max(
    0,
    travelMm - deadliftMm
  );

  return {
    strokePercent: evaluated.strokePercent,
    travelMm,
    travelAfterDeadliftMm,
    activeTravelPercent:
      (travelAfterDeadliftMm / (strokeMm - deadliftMm)) * 100,
    fullStrokeAreaPercent: evaluated.fullStrokeAreaPercent,
    exposedAreaMm2: evaluated.exposedAreaMm2,
    fullStrokeAreaMm2: evaluated.fullStrokeAreaMm2,
    estimatedCv: evaluated.estimatedCv,
    status: "estimated",
    model: characteristic.model,
    diagnostics: {
      ...diagnostics,
      targetAreaMm2,
    },
    rows:
      characteristic.model === "exposed-area-proportional"
        ? calculateRowExposure(
            characteristic.geometry,
            travelMm
          )
        : [],
    warnings: [...characteristic.warnings],
  };
}