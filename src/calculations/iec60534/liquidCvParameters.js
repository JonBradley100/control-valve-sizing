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

  Zeta calculations:
  zeta1  = 0.5 * (1 - (d / D1)^2)^2
  zeta2  = (1 - (d / D2)^2)^2
  zetaB1 = 1 - (d / D1)^4
  zetaB2 = 1 - (d / D2)^4

  sumZeta = zeta1 + zeta2 + zetaB1 - zetaB2

  Existing FLP coefficient retained:
  flpFittingsCoefficient = zeta1 + zeta2

  Actual Cv:
  actualCv = r * ratedCv

  Diameter used below:
  diameterMm = d * 25.4

  FP = (
    1
    + (sumZeta / 0.00214)
      * (actualCv / diameterMm²)²
  )^-0.5

  FLP = FL / sqrt(
    1
    + (FL² / 0.00214)
      * flpFittingsCoefficient
      * (actualCv / diameterMm²)²
  )

  xTP = (xT / FP²) / (
    1
    + (xT * (zeta1 + zetaB1) / 0.00241)
      * (actualCv / diameterMm²)²
  )

  Zeta values remain internal.
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

  Polynomial calculations use the fractional
  Cv ratio: 0.5 for 50%, not 50.

  No clamping is applied to the ratio.

  FL, Fd and xT are calculated independently.
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

    const xT =
      ((((xT5 * cvRatio + xT4) * cvRatio + xT3) *
        cvRatio +
        xT2) *
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

  const FL =
    ((((FL5 * cvRatio + FL4) * cvRatio + FL3) *
      cvRatio +
      FL2) *
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
  CALCULATE FP, FLP AND xTP

  Existing function name retained so the
  liquidSizing.js import does not change.

  xT is an additional optional input.
  Existing callers remain compatible, but
  must supply xT to calculate xTP.

  FP does not require FL or xT.

  xTP is calculated before FL validation,
  so missing FL does not prevent xTP.

  Diameter inputs are treated as inches and
  converted directly to mm, as before.
  Pipe schedule is not used.
XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

export function calculateLiquidFLP({
  FL,
  xT = null,
  r,
  ratedCv,
  selectedValve = null,
  pipework = null,
} = {}) {
  const result = {
    FP: null,
    FLP: null,
    xTP: null,
    warnings: [],
  };

  const ratio = readNumber(r);
  const designCv = readNumber(ratedCv);

  if (ratio === null || ratio <= 0) {
    result.warnings.push(
      "FP, FLP and xTP were not calculated: a positive Cv ratio is required."
    );

    return result;
  }

  if (designCv === null || designCv <= 0) {
    result.warnings.push(
      "FP, FLP and xTP were not calculated: a positive selected-valve design Cv is required."
    );

    return result;
  }

  const actualCv = ratio * designCv;

  if (!Number.isFinite(actualCv) || actualCv <= 0) {
    result.warnings.push(
      "FP, FLP and xTP were not calculated: the reconstructed Cv must be finite and positive."
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
      "FP, FLP and xTP were not calculated: positive valve, inlet pipe and outlet pipe sizes in inches are required."
    );

    return result;
  }

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    ZETA CALCULATIONS
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  const inletDiameterRatio = valveSize / inletPipeSize;
  const outletDiameterRatio = valveSize / outletPipeSize;

  const zeta1 =
    0.5 * (1 - inletDiameterRatio ** 2) ** 2;

  const zeta2 =
    (1 - outletDiameterRatio ** 2) ** 2;

  const zetaB1 =
    1 - inletDiameterRatio ** 4;

  const zetaB2 =
    1 - outletDiameterRatio ** 4;

  // Full sum used for FP.
  const sumZeta =
    zeta1 + zeta2 + zetaB1 - zetaB2;

  // Existing FLP coefficient retained separately.
  const flpFittingsCoefficient =
    zeta1 + zeta2;

  // Inlet coefficient used for xTP.
  const xtpFittingsCoefficient =
    zeta1 + zetaB1;

  const valveDiameterMm = valveSize * 25.4;

  const cvDiameterTerm =
    (actualCv / valveDiameterMm ** 2) ** 2;

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    FP CALCULATION

    FP = (
      1 + (sumZeta / 0.00214) * cvDiameterTerm
    )^-0.5
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  const fpRootTerm =
    1 + (sumZeta / 0.00214) * cvDiameterTerm;

  if (
    !Number.isFinite(fpRootTerm) ||
    fpRootTerm <= 0
  ) {
    result.warnings.push(
      "FP was not calculated: the square-root term must be finite and positive."
    );
  } else {
    const FP = Math.pow(fpRootTerm, -0.5);

    if (Number.isFinite(FP) && FP > 0) {
      result.FP = FP;
    } else {
      result.warnings.push(
        "The FP calculation did not produce a finite positive result."
      );
    }
  }

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    xTP CALCULATION

    xTP = (xT / FP²) / (
      1
      + (xT * (zeta1 + zetaB1) / 0.00241)
        * cvDiameterTerm
    )

    Calculated independently of FL and FLP.
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  const xt = readNumber(xT);

  // Missing xT is already reported by the
  // trim parameter calculation when applicable.
  if (xt !== null) {
    if (xt <= 0) {
      result.warnings.push(
        "xTP was not calculated: xT must be positive."
      );
    } else if (result.FP === null) {
      result.warnings.push(
        "xTP was not calculated: a finite positive FP is required."
      );
    } else {
      const xtpCorrectionTerm =
        1 +
        ((xt * xtpFittingsCoefficient) / 0.00241) *
          cvDiameterTerm;

      if (
        !Number.isFinite(xtpCorrectionTerm) ||
        xtpCorrectionTerm <= 0
      ) {
        result.warnings.push(
          "xTP was not calculated: the correction term must be finite and positive."
        );
      } else {
        const xTP =
          (xt / result.FP ** 2) / xtpCorrectionTerm;

        if (Number.isFinite(xTP) && xTP > 0) {
          result.xTP = xTP;
        } else {
          result.warnings.push(
            "The xTP calculation did not produce a finite positive result."
          );
        }
      }
    }
  }

  /*XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    FLP CALCULATION

    Existing fittings expression retained.
  XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX*/

  const fl = readNumber(FL);

  // Missing FL is already reported by the
  // trim parameter calculation.
  if (fl === null) {
    return result;
  }

  if (fl <= 0) {
    result.warnings.push(
      "FLP was not calculated: FL must be positive."
    );

    return result;
  }

  const flpRootTerm =
    1 +
    (fl ** 2 / 0.00214) *
      flpFittingsCoefficient *
      cvDiameterTerm;

  if (
    !Number.isFinite(flpRootTerm) ||
    flpRootTerm <= 0
  ) {
    result.warnings.push(
      "FLP was not calculated: the square-root term must be finite and positive."
    );

    return result;
  }

  const FLP = fl / Math.sqrt(flpRootTerm);

  if (!Number.isFinite(FLP) || FLP <= 0) {
    result.warnings.push(
      "The FLP calculation did not produce a finite positive result."
    );

    return result;
  }

  result.FLP = FLP;

  return result;
}