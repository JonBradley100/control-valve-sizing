import { readNumber } from "../utils/readNumber";
import {
  convertAbsolutePressure,
  temperatureToKelvin,
} from "../utils/unitConversions";

export function calculateCaseVapourPressure(processCase, fluid) {
  if (!fluid) {
    return "";
  }

  const coefficientA = readNumber(fluid.pV_A);
  const coefficientB = readNumber(fluid.pV_B);
  const coefficientC = readNumber(fluid.pV_C);

  const temperatureK = temperatureToKelvin(
    processCase.temperature,
    processCase.temperatureUnit
  );

  if (
    coefficientA === null ||
    coefficientB === null ||
    coefficientC === null ||
    temperatureK === null
  ) {
    return "";
  }

  const denominator = temperatureK + coefficientC;

  if (!Number.isFinite(denominator) || denominator === 0) {
    return "";
  }

  const vapourPressureBara =
    Math.exp(coefficientA - coefficientB / denominator) / 760;

  if (
    !Number.isFinite(vapourPressureBara) ||
    vapourPressureBara < 0
  ) {
    return "";
  }

  return convertAbsolutePressure(
    vapourPressureBara,
    "bara",
    processCase.vapourPressureUnit ?? "bara"
  );
}