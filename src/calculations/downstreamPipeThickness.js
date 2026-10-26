/*
 * Downstream pipe wall thickness lookup.
 *
 * Source file:
 *   public/data/pipeThickness.csv
 *
 * Browser URL:
 *   /data/pipeThickness.csv
 *
 * Row lookup:
 *   "Size, inch" — nominal pipe size in inches.
 *
 * Column lookup:
 *   Schedule header, such as 40, STD, XS, or 10S.
 *
 * Table thickness values: inches.
 * Returned tMm: millimetres.
 *
 * Missing sizes, missing schedules, and N/A entries return null
 * with a warning. No interpolation or schedule substitution.
 */

const MM_PER_INCH = 25.4;

let cachedTablePromise = null;

/*
 * Parse one CSV row, including quoted headers containing commas:
 *
 * "Size, inch","Size, mm",10,20,...
 */
function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === "," && !insideQuotes) {
      fields.push(field.trim());
      field = "";
    } else {
      field += character;
    }
  }

  if (insideQuotes) {
    throw new Error(
      "Invalid pipe thickness CSV: an unclosed quoted field was found."
    );
  }

  fields.push(field.trim());

  return fields;
}

function readPositiveNumber(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) && number > 0
    ? number
    : null;
}

function normalizeSchedule(value) {
  return String(value ?? "").trim().toUpperCase();
}

/*
 * Load once and reuse the parsed table.
 *
 * Call this before running synchronous sizing calculations.
 * A failed load clears the cache so a later call can retry.
 */
export async function loadPipeThicknessTable() {
  if (!cachedTablePromise) {
    cachedTablePromise = (async () => {
      const response = await fetch("/data/pipeThickness.csv");

      if (!response.ok) {
        throw new Error(
          `Unable to load pipeThickness.csv: HTTP ${response.status}.`
        );
      }

      const csvText = await response.text();

      const lines = csvText
        .replace(/^\uFEFF/, "")
        .split(/\r\n|\n|\r/)
        .filter((line) => line.trim() !== "");

      if (lines.length < 2) {
        throw new Error(
          "Pipe thickness CSV must contain a header and at least one data row."
        );
      }

      const headers = parseCsvLine(lines[0]);

      if (
        headers[0] !== "Size, inch" ||
        headers[1] !== "Size, mm"
      ) {
        throw new Error(
          'Pipe thickness CSV must start with "Size, inch" and "Size, mm".'
        );
      }

      const schedules = headers.slice(2).map(normalizeSchedule);

      if (
        schedules.some((schedule) => schedule === "") ||
        new Set(schedules).size !== schedules.length
      ) {
        throw new Error(
          "Pipe thickness CSV contains blank or duplicate schedule headers."
        );
      }

      const rowsBySizeInch = new Map();

      for (let index = 1; index < lines.length; index += 1) {
        const cells = parseCsvLine(lines[index]);

        if (cells.length !== headers.length) {
          throw new Error(
            `Pipe thickness CSV row ${index + 1} has an unexpected number of columns.`
          );
        }

        const sizeInch = readPositiveNumber(cells[0]);

        if (sizeInch === null) {
          throw new Error(
            `Pipe thickness CSV row ${index + 1} has an invalid nominal size.`
          );
        }

        if (rowsBySizeInch.has(sizeInch)) {
          throw new Error(
            `Pipe thickness CSV contains duplicate nominal size ${sizeInch}.`
          );
        }

        const thicknessBySchedule = new Map(
          schedules.map((schedule, scheduleIndex) => [
            schedule,
            cells[scheduleIndex + 2],
          ])
        );

        rowsBySizeInch.set(sizeInch, thicknessBySchedule);
      }

      return {
        schedules,
        rowsBySizeInch,
      };
    })().catch((error) => {
      cachedTablePromise = null;
      throw error;
    });
  }

  return cachedTablePromise;
}

/*
 * Synchronous thickness calculation using the loaded table.
 *
 * downstreamSizeInch must be the nominal size in inches,
 * not the actual internal diameter or the nominal metric size.
 */
export function calculateDownstreamPipeThickness({
  table,
  downstreamSizeInch,
  downstreamSchedule,
} = {}) {
  const unavailable = (message) => ({
    tMm: null,
    thicknessInch: null,
    warnings: [message],
  });

  if (!(table?.rowsBySizeInch instanceof Map)) {
    return unavailable(
      "Downstream pipe thickness unavailable: the pipe thickness table has not been loaded."
    );
  }

  const sizeInch = readPositiveNumber(downstreamSizeInch);
  const schedule = normalizeSchedule(downstreamSchedule);

  if (sizeInch === null) {
    return unavailable(
      "Downstream pipe thickness requires a positive nominal pipe size in inches."
    );
  }

  if (!schedule) {
    return unavailable(
      "Downstream pipe thickness requires a downstream pipe schedule."
    );
  }

  const row = table.rowsBySizeInch.get(sizeInch);

  if (!row) {
    return unavailable(
      `Downstream pipe thickness unavailable: nominal size ${sizeInch} inch was not found in pipeThickness.csv.`
    );
  }

  if (!row.has(schedule)) {
    return unavailable(
      `Downstream pipe thickness unavailable: schedule ${schedule} was not found in pipeThickness.csv.`
    );
  }

  const rawThickness = row.get(schedule);

  if (
    String(rawThickness ?? "").trim().toUpperCase() === "N/A"
  ) {
    return unavailable(
      `Downstream pipe thickness is N/A for nominal size ${sizeInch} inch and schedule ${schedule}.`
    );
  }

  const thicknessInch = readPositiveNumber(rawThickness);

  if (thicknessInch === null) {
    return unavailable(
      `Downstream pipe thickness is invalid for nominal size ${sizeInch} inch and schedule ${schedule}.`
    );
  }

  const tMm = thicknessInch * MM_PER_INCH;

  if (!Number.isFinite(tMm) || tMm <= 0) {
    return unavailable(
      "Downstream pipe thickness conversion did not produce a finite positive value."
    );
  }

  return {
    tMm,
    thicknessInch,
    warnings: [],
  };
}