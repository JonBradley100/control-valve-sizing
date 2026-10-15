/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  LIQUID Cv-BASED PARAMETERS

  r = provisionalCv / ratedCv

  FL = FL0
     + FL1 * r
     + FL2 * r²
     + FL3 * r³
     + FL4 * r⁴
     + FL5 * r⁵

  Fd = Fd_a * r^Fd_b

  xT = xT0
     + xT1 * r
     + xT2 * r²
     + xT3 * r³
     + xT4 * r⁴
     + xT5 * r⁵

  Diameter selections are in inches:
  d  = selectedValve.size
  D1 = pipework.inletPipeSize
  D2 = pipework.outletPipeSize

  zeta1  = 0.5 * (1 - (d / D1)^2)^2
  zeta2  = (1 - (d / D2)^2)^2
  zetaB1 = 1 - (d / D1)^4
  zetaB2 = 1 - (d / D2)^4

  sumZeta = zeta1 + zeta2 + zetaB1 - zetaB2

  User-specified FLP equation:
  FLP = FL / sqrt(
    1
    + (FL² / 0.00214)
      * sumZeta
      * (r / (d * 25.4)²)²
  )

  Equations and validation are retained from
  the original liquidSizing.js.

  Zeta values are internal calculations and
  are not exposed in technicalDetails.
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

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
  CALCULATE Cv RATIO, FL, Fd AND xT

  All calculations use the fractional Cv ratio:
  0.5 for 50%, not 50.

  No clamping is applied to the ratio.
  The fits' valid operating ranges must be
  checked against the coefficient data.

  FL, Fd and xT are calculated independently:
  missing coefficients for one do not prevent
  calculation of the others.

  flCoefficients contains:
  FL0, FL1, FL2, FL3, FL4, FL5,
  Fd_a, Fd_b,
  xT0, xT1, xT2, xT3, xT4, xT5
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

export function calculateLiquidTrimParameters({
  provisionalCv,
  ratedCv,
  flCoefficients,
}) {
  const cv = readNumber(provisionalCv);
  const designCv = readNumber(ratedCv);

  const result = {
    ratedCv: designCv,
    cvRatio: null,
    cvRatioPercent: null,
    FL: null,
    Fd: null,
    xT: null,
    warnings: [],
  };

  if (cv === null || cv <= 0) {
    return result;
  }

  if (designCv === null || designCv <= 0) {
    result.warnings.push(
      "FL, Fd and xT were not calculated: a positive selected-valve design Cv is required."
    );

    return result;
  }

  const cvRatio = cv / designCv;
  const cvRatioPercent = cvRatio * 100;

  if (
    !Number.isFinite(cvRatio) ||
    !Number.isFinite(cvRatioPercent)
  ) {
    result.warnings.push(
      "FL, Fd and xT were not calculated: the Cv ratio is not finite."
    );

    return result;
  }

  result.cvRatio = cvRatio;
  result.cvRatioPercent = cvRatioPercent;

  if (cvRatio > 1) {
    result.warnings.push(
      "Provisional Cv exceeds the selected valve's design Cv. Check whether the FL, Fd and xT coefficient fits are valid at this ratio."
    );
  }

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    Fd CALCULATION

    Fd = Fd_a * r^Fd_b
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  const fdCoefficientNames = ["Fd_a", "Fd_b"];

  const fdCoefficients = fdCoefficientNames.map((name) =>
    readNumber(flCoefficients?.[name])
  );

  const missingFdCoefficients = fdCoefficientNames.filter(
    (_, index) => fdCoefficients[index] === null
  );

  if (missingFdCoefficients.length > 0) {
    result.warnings.push(
      `Fd was not calculated: missing or invalid coefficients (${missingFdCoefficients.join(
        ", "
      )}).`
    );
  } else {
    const [Fd_a, Fd_b] = fdCoefficients;
    const Fd = Fd_a * Math.pow(cvRatio, Fd_b);

    if (Number.isFinite(Fd)) {
      result.Fd = Fd;
    } else {
      result.warnings.push(
        "The Fd calculation did not produce a finite result."
      );
    }
  }

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    xT CALCULATION

    Uses xT0 through xT5 from the CSV row,
    not the separate fixed xT column.
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  const xtCoefficientNames = [
    "xT0",
    "xT1",
    "xT2",
    "xT3",
    "xT4",
    "xT5",
  ];

  const xtCoefficients = xtCoefficientNames.map((name) =>
    readNumber(flCoefficients?.[name])
  );

  const missingXtCoefficients = xtCoefficientNames.filter(
    (_, index) => xtCoefficients[index] === null
  );

  if (missingXtCoefficients.length > 0) {
    result.warnings.push(
      `xT was not calculated: missing or invalid coefficients (${missingXtCoefficients.join(
        ", "
      )}).`
    );
  } else {
    const [xT0, xT1, xT2, xT3, xT4, xT5] = xtCoefficients;

    // Horner's method:
    // xT0 + xT1*r + xT2*r² + xT3*r³ + xT4*r⁴ + xT5*r⁵
    const xT =
      ((((xT5 * cvRatio + xT4) * cvRatio + xT3) * cvRatio + xT2) *
        cvRatio +
        xT1) *
        cvRatio +
      xT0;

    if (Number.isFinite(xT)) {
      result.xT = xT;
    } else {
      result.warnings.push(
        "The xT polynomial did not produce a finite result."
      );
    }
  }

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    FL CALCULATION

    Uses FL0 through FL5 from the CSV row.
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  const coefficientNames = [
    "FL0",
    "FL1",
    "FL2",
    "FL3",
    "FL4",
    "FL5",
  ];

  const coefficients = coefficientNames.map((name) =>
    readNumber(flCoefficients?.[name])
  );

  const missingCoefficients = coefficientNames.filter(
    (_, index) => coefficients[index] === null
  );

  if (missingCoefficients.length > 0) {
    result.warnings.push(
      `FL was not calculated: missing or invalid coefficients (${missingCoefficients.join(
        ", "
      )}).`
    );

    return result;
  }

  const [FL0, FL1, FL2, FL3, FL4, FL5] = coefficients;
  // Horner's method:
  // FL0 + FL1*r + FL2*r² + FL3*r³ + FL4*r⁴ + FL5*r⁵
  const FL =
    ((((FL5 * cvRatio + FL4) * cvRatio + FL3) * cvRatio + FL2) *
      cvRatio +
      FL1) *
      cvRatio +
    FL0;

  if (!Number.isFinite(FL)) {
    result.warnings.push(
      "The FL polynomial did not produce a finite result."
    );

    return result;
  }

  result.FL = FL;

  return result;
}

/*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  CALCULATE FLP

  Implements the user-specified equation.
  r is the fractional Cv ratio already used
  by the trim parameter calculations.
  The inch-to-mm conversion cancels within
  the diameter ratios used for zeta values.
  In the FLP equation, the valve diameter is
  converted directly from inches to mm.
  Pipe schedule is not used by this direct
  conversion approach.
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

export function calculateLiquidFLP({
  FL,
  r,
  selectedValve = null,
  pipework = null,
} = {}) {
  const result = {
    FLP: null,
    warnings: [],
  };

  const fl = readNumber(FL);
  const ratio = readNumber(r);

  // Missing trim data is already reported by the
  // trim parameter calculation.
  if (fl === null || ratio === null) {
    return result;
  }

  if (fl <= 0 || ratio <= 0) {
    result.warnings.push(
      "FLP was not calculated: FL and the Cv ratio must be positive."
    );

    return result;
  }

  const valveSize = readNumber(selectedValve?.size);
  const inletPipeSize = readNumber(pipework?.inletPipeSize);
  const outletPipeSize = readNumber(pipework?.outletPipeSize);

  if (
    valveSize === null ||
    inletPipeSize === null ||
    outletPipeSize === null ||
    valveSize <= 0 ||
    inletPipeSize <= 0 ||
    outletPipeSize <= 0
  ) {
    result.warnings.push(
      "FLP was not calculated: positive valve, inlet pipe and outlet pipe sizes in inches are required."
    );

    return result;
  }

  const zeta1 =
    0.5 * (1 - (valveSize / inletPipeSize) ** 2) ** 2;
  const zeta2 =
    (1 - (valveSize / outletPipeSize) ** 2) ** 2;
  const zetaB1 =
    1 - (valveSize / inletPipeSize) ** 4;
  const zetaB2 =
    1 - (valveSize / outletPipeSize) ** 4;
  const sumZeta = zeta1 + zeta2 + zetaB1 - zetaB2;
  const squareRootTerm =
    1 +
    (fl ** 2 / 0.00214) *
      sumZeta *
      (ratio / (valveSize * 25.4) ** 2) ** 2;
  if (
    !Number.isFinite(squareRootTerm) ||
    squareRootTerm <= 0
  ) {
    result.warnings.push(
      "FLP was not calculated: the square-root term must be finite and positive."
    );
    return result;
  }

  const FLP = fl / Math.sqrt(squareRootTerm);

  if (!Number.isFinite(FLP) || FLP <= 0) {
    result.warnings.push(
      "The FLP calculation did not produce a finite positive result."
    );

    return result;
  }

  result.FLP = FLP;

  return result;
}