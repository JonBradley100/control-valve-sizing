export async function loadTrimDatabase() {
  const response = await fetch(`/data/trimDatabase.csv?t=${Date.now()}`);

  if (!response.ok && response.status !== 304) {
    throw new Error(`Failed to load trim database. Status: ${response.status}`);
  }

  const csvText = await response.text();

  return parseCsv(csvText);
}

function parseCsv(csvText) {
  const lines = csvText
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map((header) => normalizeHeader(header));

  return lines.slice(1).map((line, rowIndex) => {
    const values = splitCsvLine(line);

    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    row._rowNumber = rowIndex + 2;

    return normalizeTrimRow(row);
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());

  return result;
}

function normalizeHeader(header) {
  return String(header)
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .replace(/[^\w\s/()-]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/\//g, "_per_")
    .replace(/[()-]/g, "");
}

function normalizeTrimRow(row) {
  return {
    ...row,

    // Core trim identification fields
    valveSizeNumeric: parseNumber(row.size),
    classNumeric: parseNumber(row.class),
    designCvNumeric: parseNumber(row.cv_design),
    ratedCvNumeric: parseNumber(row.cv_design),

    stagesNumeric: parseNumber(row.stages),
    strokeNumeric: parseNumber(row.stroke),
    deadliftNumeric: parseNumber(row.deadlift),

    // Geometry fields
    areaNumeric: parseNumber(row.a),
    hydraulicDiameterNumeric: parseNumber(row.dh),
    widthNumeric: parseNumber(row.w),
    lengthNumeric: parseNumber(row.l),
    lwNumeric: parseNumber(row.lw),
    lPerWNumeric: parseNumber(row.l_per_w),
    rowGapNumeric: parseNumber(row.rowgap),
    alphaNumeric: parseNumber(row.alpha),
    ahNumeric: parseNumber(row.ah),
    stNumeric: parseNumber(row.st),
    n0Numeric: parseNumber(row.n0),

    // Stage pressure-drop fractions / indicators
    s1DpNumeric: parseNumber(row.s1_dp),
    s2DpNumeric: parseNumber(row.s2_dp),
    s3DpNumeric: parseNumber(row.s3_dp),
    s4DpNumeric: parseNumber(row.s4_dp),

    // Stage diameters or identifiers if present
    s1DNumeric: parseNumber(row.s1_d),
    s2DNumeric: parseNumber(row.s2_d),
    s3DNumeric: parseNumber(row.s3_d),
    s4DNumeric: parseNumber(row.s4_d),

    holesArray: parseHoleArrangement(row.arrangement),
  };
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const cleaned = String(value).replace(/,/g, "").trim();
  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

function parseHoleArrangement(value) {
  if (value === null || value === undefined || value === "") {
    return [];
  }

  return String(value)
    .trim()
    .split("/")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}