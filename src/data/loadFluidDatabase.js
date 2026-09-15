function parseCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && nextCharacter === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      insideQuotes = !insideQuotes;
    } else if (character === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current.trim());

  return values;
}

function normalizeHeader(header) {
  return String(header)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const cleaned = String(value).replace(/,/g, "").trim();
  const numberValue = Number(cleaned);

  return Number.isFinite(numberValue) ? numberValue : null;
}

export async function loadFluidDatabase() {
  const response = await fetch("/data/fluidData.csv");

  if (!response.ok) {
    throw new Error(`Unable to load fluid database: ${response.status}`);
  }

  const csvText = await response.text();

  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);

  const rows = lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);

    const rawRow = headers.reduce((row, header, headerIndex) => {
      row[header] = values[headerIndex] ?? "";
      return row;
    }, {});

    return {
      id: `${rawRow.fluid || "fluid"}-${index}`,

      // Main display field
      fluidName: rawRow.fluid || "",

      // Real CSV fields
      rmm: toNumber(rawRow.rmm),
      kappa: toNumber(rawRow.kappa),
      criticalPressure: toNumber(rawRow.p_crit),
      criticalTemperature: toNumber(rawRow.t_crit),
      w: toNumber(rawRow.w),

      cpA: toNumber(rawRow.cp_a),
      cpB: toNumber(rawRow.cp_b),
      cpC: toNumber(rawRow.cp_c),
      cpD: toNumber(rawRow.cp_d),

      vaporPressureA: toNumber(rawRow.pv_a),
      vaporPressureB: toNumber(rawRow.pv_b),
      vaporPressureC: toNumber(rawRow.pv_c),

      rho: toNumber(rawRow.rho),

      // Grouped objects for later calculation modules
      cpCoefficients: {
        a: toNumber(rawRow.cp_a),
        b: toNumber(rawRow.cp_b),
        c: toNumber(rawRow.cp_c),
        d: toNumber(rawRow.cp_d),
      },

      vaporPressureCoefficients: {
        a: toNumber(rawRow.pv_a),
        b: toNumber(rawRow.pv_b),
        c: toNumber(rawRow.pv_c),
      },

      // Keep original row for debugging
      raw: rawRow,
    };
  });

  return rows.filter((row) => row.fluidName);
}