function parseCsvLine(line) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && nextCharacter === '"' && insideQuotes) {
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
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function toNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const cleaned = String(value).replace(/,/g, "").trim();

  if (cleaned === "") {
    return null;
  }

  const numberValue = Number(cleaned);

  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizePhase(value) {
  const phase = String(value || "").trim().toLowerCase();

  if (phase === "liquid") return "liquid";
  if (phase === "gas") return "gas";

  return "";
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

    if (index === 0) {
      console.log("CSV headers:", headers);
      console.log("First CSV values:", values);
      console.log("First rawRow:", rawRow);
    }

    const pV_A = toNumber(rawRow.pv_a);
    const pV_B = toNumber(rawRow.pv_b);
    const pV_C = toNumber(rawRow.pv_c);

    return {
      id: `${rawRow.fluid || "fluid"}-${index}`,

      // Main display fields
      fluidName: rawRow.fluid || "",
      phase: normalizePhase(rawRow.phase),

      // Fluid properties
      rmm: toNumber(rawRow.rmm),
      kappa: toNumber(rawRow.kappa),
      criticalPressure: toNumber(rawRow.p_crit),
      criticalTemperature: toNumber(rawRow.t_crit),
      w: toNumber(rawRow.w),

      // Heat-capacity coefficients
      cpA: toNumber(rawRow.cp_a),
      cpB: toNumber(rawRow.cp_b),
      cpC: toNumber(rawRow.cp_c),
      cpD: toNumber(rawRow.cp_d),

      // Names used by the updated App.jsx
      pV_A,
      pV_B,
      pV_C,

      // Keep existing names for compatibility
      vaporPressureA: pV_A,
      vaporPressureB: pV_B,
      vaporPressureC: pV_C,

      // Density
      rho: toNumber(rawRow.rho),

      // Grouped objects for calculation modules
      cpCoefficients: {
        a: toNumber(rawRow.cp_a),
        b: toNumber(rawRow.cp_b),
        c: toNumber(rawRow.cp_c),
        d: toNumber(rawRow.cp_d),
      },

      vaporPressureCoefficients: {
        a: pV_A,
        b: pV_B,
        c: pV_C,
      },

      // Keep original row for debugging
      raw: rawRow,
    };
  });

  return rows.filter((row) => row.fluidName);
}