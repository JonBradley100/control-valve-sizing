/*
  Geometry-based Cv-to-stroke estimate.

  Supported:
    - Single-stage circular-hole trims.
    - Explicit hole-count arrangement in opening order.
    - Positive or negative signed axial edge-to-edge row gaps.

  Conventions:
    - Stroke is total piston travel, including deadlift.
    - At Deadlift, the first row begins to be uncovered.
    - Row pitch = hole diameter + signed rowGap.
    - Each row's exposed area is evaluated independently.
    - Rated Cv corresponds to the specified full stroke.

  Hydraulic assumption:
    Cv is proportional to exposed hole area, normalized against
    exposed area at the specified full stroke.

  This is not a manufacturer-validated Cv-versus-travel curve.
  alpha is not applied again because rated Cv provides calibration.

  No missing-geometry fallback, equal-row fallback, automatic
  gap adjustment, or capacity clamping is used.
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

function unavailableResult(status, warnings, diagnostics = {}) {
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
    model: "exposed-area-proportional",
    diagnostics,
    rows: [],
    warnings,
  };
}

/*
  Parse raw CSV arrangement instead of trusting holesArray.

  A trailing "/" is allowed.
  Interior empty entries, nonintegers and nonpositive counts
  are rejected rather than silently removed.
*/

function readArrangement(trim) {
  const rawArrangement = trim?.arrangement ?? trim?.Arrangement;

  if (
    rawArrangement !== null &&
    rawArrangement !== undefined &&
    String(rawArrangement).trim() !== ""
  ) {
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
      return null;
    }

    const counts = entries.map(Number);

    return counts.every(
      (count) => Number.isInteger(count) && count > 0
    )
      ? counts
      : null;
  }

  // Support already-validated programmatic rows.
  if (
    Array.isArray(trim?.holesArray) &&
    trim.holesArray.length > 0 &&
    trim.holesArray.every(
      (count) => Number.isInteger(count) && count > 0
    )
  ) {
    return [...trim.holesArray];
  }

  return null;
}

/*
  Circular segment exposed by a straight piston edge.

  exposedHeight and radius are in mm.
  Returned area is in mm².
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

export function calculateTrimStroke({
  trim = null,
  requiredCv = null,
  ratedCv = null,
} = {}) {
  const warnings = [];

  if (!trim) {
    return unavailableResult("unavailable", [
      "Stroke unavailable: select a trim with valid geometry.",
    ]);
  }

  const trimType = String(trim.type ?? trim.Type ?? "")
    .trim()
    .toUpperCase();

  const stages = readTrimNumber(trim, [
    "Stages",
    "stagesNumeric",
    "stages",
  ]);

  if (trimType !== "H" || stages !== 1) {
    return unavailableResult("unsupported", [
      "Stroke unavailable: the current exposed-area model supports single-stage circular-hole trims only. No alternative characteristic has been assumed.",
    ]);
  }

  const caseCv = readNumber(requiredCv);
  const maximumCv = readNumber(ratedCv);

  if (
    caseCv === null ||
    caseCv < 0 ||
    maximumCv === null ||
    maximumCv <= 0
  ) {
    return unavailableResult("unavailable", [
      "Stroke unavailable: a valid refined process Cv and positive rated Cv are required.",
    ]);
  }

  if (caseCv > maximumCv) {
    return unavailableResult(
      "insufficient-capacity",
      [
        `Stroke unavailable: required Cv ${caseCv.toFixed(2)} exceeds rated Cv ${maximumCv.toFixed(2)}. The case cannot be achieved within the rated stroke.`,
      ],
      {
        requiredCv: caseCv,
        ratedCv: maximumCv,
        cvCapacityPercent: (caseCv / maximumCv) * 100,
      }
    );
  }

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

  const arrangement = readArrangement(trim);

  if (strokeMm === null || strokeMm <= 0) {
    warnings.push(
      "Stroke unavailable: the trim requires a positive Stroke in mm."
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
      "Stroke unavailable: Deadlift must be nonnegative and less than Stroke, both in mm."
    );
  }

  if (holeDiameterMm === null || holeDiameterMm <= 0) {
    warnings.push(
      "Stroke unavailable: the circular-hole trim requires a positive dH in mm."
    );
  }

  if (rowGapMm === null) {
    warnings.push(
      "Stroke unavailable: a numeric signed rowGap in mm is required."
    );
  }

  if (!Number.isInteger(rowCount) || rowCount < 1) {
    warnings.push(
      "Stroke unavailable: Rows must be a positive integer."
    );
  }

  if (
    !Number.isInteger(totalHoleCount) ||
    totalHoleCount < 1
  ) {
    warnings.push(
      "Stroke unavailable: n0 must be a positive integer."
    );
  }

  if (!arrangement) {
    warnings.push(
      "Stroke unavailable: an explicit valid hole-count Arrangement in opening order is required."
    );
  }

  if (
    arrangement &&
    Number.isInteger(rowCount) &&
    arrangement.length !== rowCount
  ) {
    warnings.push(
      `Stroke unavailable: Arrangement contains ${arrangement.length} rows, but Rows specifies ${rowCount}.`
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
      `Stroke unavailable: Arrangement totals ${arrangementHoleCount} holes, but n0 specifies ${totalHoleCount}.`
    );
  }

  const rowPitchMm =
    holeDiameterMm !== null && rowGapMm !== null
      ? holeDiameterMm + rowGapMm
      : null;

  if (rowPitchMm !== null && rowPitchMm <= 0) {
    warnings.push(
      "Stroke unavailable: dH + rowGap must produce a positive axial row pitch."
    );
  }

  if (warnings.length > 0) {
    return unavailableResult(
      "invalid-geometry",
      warnings,
      {
        strokeMm,
        deadliftMm,
        holeDiameterMm,
        rowGapMm,
        rowPitchMm,
        rowCount,
        totalHoleCount,
        arrangementHoleCount,
      }
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

  if (
    !Number.isFinite(fullStrokeAreaMm2) ||
    fullStrokeAreaMm2 <= 0
  ) {
    return unavailableResult("invalid-geometry", [
      "Stroke unavailable: the specified full stroke does not expose a finite positive hole area.",
    ]);
  }

  if (fullOpeningBeyondStrokeMm > 1e-8) {
    warnings.push(
      `Stroke geometry: all rows become fully uncovered at ${allRowsFullyOpenTravelMm.toFixed(4)} mm, ${fullOpeningBeyondStrokeMm.toFixed(4)} mm beyond the specified stroke. The stored dimensions have not been adjusted; rated Cv is normalized against exposed area at the specified full stroke.`
    );
  }

  warnings.push(
    "Stroke is a geometry-based estimate assuming Cv is proportional to exposed hole area. Arrangement is interpreted in opening order and rowGap as a signed axial edge-to-edge gap. This is not a manufacturer-validated Cv-versus-travel curve."
  );

  const targetAreaMm2 =
    (caseCv / maximumCv) * fullStrokeAreaMm2;

  let travelMm = 0;

  if (caseCv > 0) {
    let lowerTravelMm = deadliftMm;
    let upperTravelMm = strokeMm;

    // Monotonic area function: solve for the earliest travel
    // reaching the requested area within the available stroke.
    for (let iteration = 0; iteration < 80; iteration += 1) {
      const midpointMm =
        (lowerTravelMm + upperTravelMm) / 2;

      const areaMm2 = calculateExposedArea(
        geometry,
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

  const exposedAreaMm2 = calculateExposedArea(
    geometry,
    travelMm
  );

  const areaFraction =
    exposedAreaMm2 / fullStrokeAreaMm2;

  const travelAfterDeadliftMm = Math.max(
    0,
    travelMm - deadliftMm
  );

  return {
    strokePercent: (travelMm / strokeMm) * 100,
    travelMm,
    travelAfterDeadliftMm,
    activeTravelPercent:
      (travelAfterDeadliftMm / (strokeMm - deadliftMm)) * 100,
    fullStrokeAreaPercent: areaFraction * 100,
    exposedAreaMm2,
    fullStrokeAreaMm2,
    estimatedCv: maximumCv * areaFraction,
    status: "estimated",
    model: "exposed-area-proportional",
    diagnostics: {
      trimCode: trim.code ?? trim.Code ?? null,
      requiredCv: caseCv,
      ratedCv: maximumCv,
      cvCapacityPercent: (caseCv / maximumCv) * 100,
      strokeMm,
      deadliftMm,
      holeDiameterMm,
      rowGapMm,
      rowPitchMm,
      rowCount,
      totalHoleCount,
      arrangementHoleCount,
      allHolesAreaMm2: totalHoleCount * singleHoleAreaMm2,
      allRowsFullyOpenTravelMm,
      fullOpeningBeyondStrokeMm,
      targetAreaMm2,
      arrangement: [...arrangement],
    },
    rows: calculateRowExposure(geometry, travelMm),
    warnings,
  };
}