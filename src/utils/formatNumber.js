export function formatNumber(value, decimalPlaces = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "";
  }

  return number.toFixed(decimalPlaces);
}