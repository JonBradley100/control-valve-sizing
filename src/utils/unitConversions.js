import { readNumber } from "./readNumber";

const ABSOLUTE_PRESSURE_FACTORS = {
  bara: 100000,
  psia: 6894.757293168,
  kPaa: 1000,
  kgcm2a: 98066.5,
  MPaa: 1000000,
};

export function temperatureToKelvin(value, unit) {
  const temperature = readNumber(value);

  if (temperature === null) {
    return null;
  }

  let temperatureK;

  switch (unit) {
    case "°C":
    case "oC":
      temperatureK = temperature + 273.15;
      break;

    case "°F":
    case "oF":
      temperatureK = (temperature - 32) * (5 / 9) + 273.15;
      break;

    case "K":
      temperatureK = temperature;
      break;

    default:
      return null;
  }

  if (!Number.isFinite(temperatureK) || temperatureK <= 0) {
    return null;
  }

  return temperatureK;
}

export function convertAbsolutePressure(value, fromUnit, toUnit) {
  const pressure = readNumber(value);

  const fromFactor = ABSOLUTE_PRESSURE_FACTORS[fromUnit];
  const toFactor = ABSOLUTE_PRESSURE_FACTORS[toUnit];

  if (
    pressure === null ||
    pressure < 0 ||
    !fromFactor ||
    !toFactor
  ) {
    return "";
  }

  const convertedPressure = (pressure * fromFactor) / toFactor;

  if (!Number.isFinite(convertedPressure)) {
    return "";
  }

  return convertedPressure.toFixed(4);
}