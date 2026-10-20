function parseCvBasedParameters(csvText) {
  const lines = String(csvText)
    .replace(/^\uFEFF/, "")
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CvBasedParameters.csv contains no parameter rows.");
  }

  const headers = lines[0].split(",").map((header) => header.trim());

  const requiredHeaders = [
    "code",
    "FL0",
    "FL1",
    "FL2",
    "FL3",
    "FL4",
    "FL5",
  ];

  const missingHeaders = requiredHeaders.filter(
    (header) => !headers.includes(header)
  );

  if (missingHeaders.length > 0) {
    throw new Error(
      `CvBasedParameters.csv is missing columns: ${missingHeaders.join(", ")}.`
    );
  }

  const seenCodes = new Set();

  return lines.slice(1).map((line, index) => {
    const values = line.split(",").map((value) => value.trim());

    if (values.length !== headers.length) {
      throw new Error(
        `CvBasedParameters.csv row ${index + 2} has ${values.length} values; expected ${headers.length}.`
      );
    }

    const row = Object.fromEntries(
      headers.map((header, columnIndex) => [
        header,
        values[columnIndex],
      ])
    );

    row.code = row.code.trim().toUpperCase();

    if (!row.code) {
      throw new Error(
        `CvBasedParameters.csv row ${index + 2} has an empty code.`
      );
    }

    if (seenCodes.has(row.code)) {
      throw new Error(
        `CvBasedParameters.csv contains duplicate code "${row.code}".`
      );
    }

    seenCodes.add(row.code);

    return row;
  });
}

export async function loadCvParameterDatabase({ signal } = {}) {
  const response = await fetch("/data/CvBasedParameters.csv", {
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Could not load /data/CvBasedParameters.csv: HTTP ${response.status}.`
    );
  }

  const csvText = await response.text();

  return parseCvBasedParameters(csvText);
}