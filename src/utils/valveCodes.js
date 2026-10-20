/*
  Get the Cv parameter lookup code.

  Example:
  CU-06-015-1001-H-L -> 1HL
*/

export function getCvParameterCode(valveCode) {
  const parts = String(valveCode ?? "").trim().split("-");

  if (parts.length < 3) {
    return "";
  }

  const [stageCode, trimType, style] = parts
    .slice(-3)
    .map((part) => part.trim());

  if (!stageCode || !trimType || !style) {
    return "";
  }

  return `${stageCode.charAt(0)}${trimType}${style}`.toUpperCase();
}