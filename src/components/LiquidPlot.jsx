import React, { useMemo, useRef, useState } from "react";
import { calculateTrimCurve } from "../calculations/iec60534/trimStroke";

export default function LiquidPlot({
  trim = null,
  ratedCv = null,
  processCaseResults = [],
  labelPositions = undefined,
  onLabelPositionsChange = undefined,
}) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const [localLabelPositions, setLocalLabelPositions] = useState({});
  const [draggingCaseId, setDraggingCaseId] = useState(null);

  const positions = labelPositions ?? localLabelPositions;

  const width = 1100;
  const height = 540;

  const plot = {
    left: 86,
    right: 1056,
    top: 46,
    bottom: 450,
  };

  const plotWidth = plot.right - plot.left;
  const plotHeight = plot.bottom - plot.top;

  const colours = [
    "#2563eb",
    "#dc2626",
    "#059669",
    "#9333ea",
    "#d97706",
    "#0891b2",
    "#be185d",
    "#4f46e5",
  ];

  const curve = useMemo(
    () =>
      calculateTrimCurve({
        trim,
        ratedCv,
        sampleCount: 1000,
      }),
    [trim, ratedCv]
  );

  const maximumCv =
    curve.status === "estimated"
      ? curve.diagnostics.ratedCv
      : null;

  const yMaximum = maximumCv !== null ? maximumCv * 1.2 : 1;

  const cases = useMemo(
    () =>
      processCaseResults.map((result, index) => {
        const details = result.technicalDetails ?? {};
        const strokeDetails = details.strokeDetails ?? {};

        const strokePercent = details.strokePercent;
        const requiredCv = strokeDetails.diagnostics?.requiredCv;

        const plottable =
          details.strokeStatus === "estimated" &&
          Number.isFinite(strokePercent) &&
          strokePercent >= 0 &&
          strokePercent <= 100 &&
          Number.isFinite(requiredCv) &&
          requiredCv >= 0;

        let unavailableReason = "No estimated stroke is available.";

        if (details.strokeStatus === "insufficient-capacity") {
          unavailableReason = "Required Cv exceeds rated capacity.";
        } else if (details.strokeStatus === "invalid-geometry") {
          unavailableReason = "The trim geometry is invalid or incomplete.";
        } else if (details.strokeStatus === "unsupported") {
          unavailableReason = "The trim characteristic is unsupported.";
        } else if (
          requiredCv === null ||
          requiredCv === undefined
        ) {
          unavailableReason =
            "No refined Cv and valid stroke pair is available.";
        }

        return {
          id: result.id,
          name: result.caseName || `Case ${result.id}`,
          strokePercent,
          requiredCv,
          plottable,
          unavailableReason,
          colour: colours[index % colours.length],
        };
      }),
    [processCaseResults]
  );

  const plottedCases = cases.filter((item) => item.plottable);
  const unavailableCases = cases.filter((item) => !item.plottable);

  function xScale(strokePercent) {
    return plot.left + (strokePercent / 100) * plotWidth;
  }

  function yScale(cv) {
    return plot.bottom - (cv / yMaximum) * plotHeight;
  }

  function formatNumber(value, digits = 2) {
    if (!Number.isFinite(value)) return "—";

    return value.toLocaleString("en-GB", {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    });
  }

  function commitPositions(nextPositions) {
    setLocalLabelPositions(nextPositions);
    onLabelPositionsChange?.(nextPositions);
  }

  function getLabelPosition(item, index) {
    const saved = positions[String(item.id)];

    if (
      saved &&
      Number.isFinite(saved.x) &&
      Number.isFinite(saved.y)
    ) {
      return {
        x: Math.max(0, Math.min(100, saved.x)),
        y: Math.max(0, Math.min(yMaximum, saved.y)),
      };
    }

    return {
      x: 12 + (index % 4) * 25,
      y:
        yMaximum *
        (0.91 - (Math.floor(index / 4) % 5) * 0.15),
    };
  }

  function eventToSvgPoint(event) {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();

    if (!svg || !matrix) return null;

    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;

    return point.matrixTransform(matrix.inverse());
  }

  function beginDrag(event, item, index) {
    if (event.button !== 0) return;

    const point = eventToSvgPoint(event);
    if (!point) return;

    const labelPosition = getLabelPosition(item, index);

    dragRef.current = {
      caseId: String(item.id),
      pointerId: event.pointerId,
      offsetX: point.x - xScale(labelPosition.x),
      offsetY: point.y - yScale(labelPosition.y),
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingCaseId(String(item.id));
    event.preventDefault();
  }

  function moveDrag(event) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) return;

    const point = eventToSvgPoint(event);
    if (!point) return;

    const pixelX = Math.max(
      plot.left,
      Math.min(plot.right, point.x - drag.offsetX)
    );

    const pixelY = Math.max(
      plot.top,
      Math.min(plot.bottom, point.y - drag.offsetY)
    );

    commitPositions({
      ...positions,
      [drag.caseId]: {
        x: ((pixelX - plot.left) / plotWidth) * 100,
        y: ((plot.bottom - pixelY) / plotHeight) * yMaximum,
      },
    });
  }

  function endDrag(event) {
    if (
      dragRef.current &&
      dragRef.current.pointerId === event.pointerId
    ) {
      dragRef.current = null;
      setDraggingCaseId(null);
    }
  }

  function moveLabelWithKeyboard(event, item, index) {
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
    };

    const direction = directions[event.key];
    if (!direction) return;

    event.preventDefault();

    const position = getLabelPosition(item, index);
    const multiplier = event.shiftKey ? 5 : 1;

    commitPositions({
      ...positions,
      [String(item.id)]: {
        x: Math.max(
          0,
          Math.min(100, position.x + direction[0] * multiplier)
        ),
        y: Math.max(
          0,
          Math.min(
            yMaximum,
            position.y +
              direction[1] * yMaximum * 0.01 * multiplier
          )
        ),
      },
    });
  }

  /*
    Include exact operating-point coordinates in the displayed
    polyline so markers sit on it at the precision of the solver.
    All other points come from the shared forward characteristic.
  */
  const curvePath = useMemo(() => {
    if (curve.status !== "estimated") return "";

    const points = [
      ...curve.points.map((point) => ({
        strokePercent: point.strokePercent,
        cv: point.estimatedCv,
      })),
      ...cases
        .filter((item) => item.plottable)
        .map((item) => ({
          strokePercent: item.strokePercent,
          cv: item.requiredCv,
        })),
    ].sort((a, b) => a.strokePercent - b.strokePercent);

    return points
      .map((point, index) => {
        const x =
          plot.left + (point.strokePercent / 100) * plotWidth;

        const y =
          plot.bottom - (point.cv / yMaximum) * plotHeight;

        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, [curve, cases, yMaximum]);

  const buttonStyle = {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 13,
    cursor: "pointer",
  };

  const trimCode = trim?.code ?? trim?.Code ?? "";

  return (
    <section
      aria-label="Liquid trim Cv versus stroke characteristic"
      style={{
        gridColumn: "1 / -1",
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        marginTop: 16,
        padding: 20,
        border: "1px solid #dbe3ed",
        borderRadius: 10,
        background: "#ffffff",
        color: "#0f172a",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            Liquid trim characteristic
          </h2>

          <p
            style={{
              margin: "5px 0 0",
              fontSize: 13,
              color: "#64748b",
              overflowWrap: "anywhere",
            }}
          >
            {trimCode || "Select a trim to display its characteristic"}
            {maximumCv !== null
              ? ` · Rated Cv ${formatNumber(maximumCv)}`
              : ""}
          </p>
        </div>

        <button
          type="button"
          style={buttonStyle}
          onClick={() => commitPositions({})}
          disabled={Object.keys(positions).length === 0}
        >
          Reset label positions
        </button>
      </div>

      {curve.status !== "estimated" ? (
        <div
          role="status"
          style={{
            padding: 20,
            borderRadius: 8,
            background: "#f8fafc",
            color: "#475569",
            fontSize: 14,
          }}
        >
          <strong>Curve unavailable</strong>

          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
            {curve.warnings.map((warning, index) => (
              <li key={index} style={{ marginTop: 6 }}>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 12,
              color: "#64748b",
            }}
          >
            Drag case labels to reposition them. Keyboard: focus a
            label and use the arrow keys; hold Shift for larger moves.
          </p>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Estimated Cv versus total stroke for ${
              trimCode || "the selected trim"
            }. Deadlift is ${
              formatNumber(curve.diagnostics.deadliftStrokePercent)
            } percent of total stroke.`}
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              background: "#ffffff",
            }}
          >
            <title>Cv versus total stroke</title>

            <desc>
              Geometry-based hole-trim characteristic or linear
              slotted-trim characteristic. Operating points use
              refined process Cv and the same stroke calculation as
              the Results panel.
            </desc>

            <rect
              x={plot.left}
              y={plot.top}
              width={plotWidth}
              height={plotHeight}
              fill="#ffffff"
              stroke="#cbd5e1"
            />

            <rect
              x={plot.left}
              y={plot.top}
              width={
                xScale(curve.diagnostics.deadliftStrokePercent) -
                plot.left
              }
              height={plotHeight}
              fill="#f1f5f9"
            />

            {Array.from({ length: 11 }, (_, index) => {
              const strokePercent = index * 10;
              const x = xScale(strokePercent);

              return (
                <g key={`x-${index}`}>
                  <line
                    x1={x}
                    y1={plot.top}
                    x2={x}
                    y2={plot.bottom}
                    stroke="#e2e8f0"
                  />

                  <text
                    x={x}
                    y={plot.bottom + 24}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize={12}
                  >
                    {strokePercent}
                  </text>
                </g>
              );
            })}

            {Array.from({ length: 7 }, (_, index) => {
              const cv = (index / 6) * yMaximum;
              const y = yScale(cv);

              return (
                <g key={`y-${index}`}>
                  <line
                    x1={plot.left}
                    y1={y}
                    x2={plot.right}
                    y2={y}
                    stroke="#e2e8f0"
                  />

                  <text
                    x={plot.left - 12}
                    y={y + 4}
                    textAnchor="end"
                    fill="#64748b"
                    fontSize={12}
                  >
                    {formatNumber(cv)}
                  </text>
                </g>
              );
            })}

            <line
              x1={plot.left}
              y1={yScale(maximumCv)}
              x2={plot.right}
              y2={yScale(maximumCv)}
              stroke="#94a3b8"
              strokeDasharray="7 5"
            />

            <text
              x={plot.right - 8}
              y={yScale(maximumCv) - 8}
              textAnchor="end"
              fill="#64748b"
              fontSize={12}
            >
              Rated Cv {formatNumber(maximumCv)}
            </text>

            <line
              x1={xScale(curve.diagnostics.deadliftStrokePercent)}
              y1={plot.top}
              x2={xScale(curve.diagnostics.deadliftStrokePercent)}
              y2={plot.bottom}
              stroke="#64748b"
              strokeDasharray="5 5"
            />

            <text
              x={xScale(curve.diagnostics.deadliftStrokePercent) + 7}
              y={plot.top + 17}
              fill="#475569"
              fontSize={12}
            >
              Deadlift
            </text>

            <path
              d={curvePath}
              fill="none"
              stroke="#0f172a"
              strokeWidth={2.5}
              strokeLinejoin="round"
            />

            {plottedCases.map((item) => (
              <g key={`marker-${item.id}`}>
                <title>
                  {item.name}: Cv {formatNumber(item.requiredCv)},
                  stroke {formatNumber(item.strokePercent)}%
                </title>

                <line
                  x1={xScale(item.strokePercent)}
                  y1={yScale(item.requiredCv)}
                  x2={xScale(item.strokePercent)}
                  y2={plot.bottom}
                  stroke={item.colour}
                  strokeDasharray="3 5"
                  opacity={0.3}
                />

                <circle
                  cx={xScale(item.strokePercent)}
                  cy={yScale(item.requiredCv)}
                  r={5}
                  fill={item.colour}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              </g>
            ))}

            {plottedCases.map((item, index) => {
              const position = getLabelPosition(item, index);
              const anchorX = xScale(position.x);
              const anchorY = yScale(position.y);

              const title =
                item.name.length > 26
                  ? `${item.name.slice(0, 25)}…`
                  : item.name;

              const subtitle =
                `Cv ${formatNumber(item.requiredCv)} · ` +
                `${formatNumber(item.strokePercent)}% stroke`;

              const boxWidth = 196;
              const boxHeight = 52;

              // Keep the label box inside the chart while preserving
              // its stored anchor in stroke/Cv coordinates.
              const boxX = Math.max(
                plot.left + 4,
                Math.min(
                  plot.right - boxWidth - 4,
                  anchorX - boxWidth / 2
                )
              );

              const boxY = Math.max(
                plot.top + 4,
                Math.min(
                  plot.bottom - boxHeight - 4,
                  anchorY - boxHeight / 2
                )
              );

              return (
                <g key={`label-${item.id}`}>
                  <line
                    x1={xScale(item.strokePercent)}
                    y1={yScale(item.requiredCv)}
                    x2={boxX + boxWidth / 2}
                    y2={boxY + boxHeight / 2}
                    stroke={item.colour}
                    strokeWidth={1.2}
                    opacity={0.7}
                  />

                  <g
                    role="button"
                    tabIndex={0}
                    aria-label={`Move label for ${item.name}. Use arrow keys.`}
                    onPointerDown={(event) =>
                      beginDrag(event, item, index)
                    }
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onLostPointerCapture={endDrag}
                    onKeyDown={(event) =>
                      moveLabelWithKeyboard(event, item, index)
                    }
                    style={{
                      cursor:
                        draggingCaseId === String(item.id)
                          ? "grabbing"
                          : "grab",
                      touchAction: "none",
                      userSelect: "none",
                    }}
                  >
                    <title>{item.name}</title>

                    <rect
                      x={boxX}
                      y={boxY}
                      width={boxWidth}
                      height={boxHeight}
                      rx={6}
                      fill="#ffffff"
                      stroke={item.colour}
                      strokeWidth={
                        draggingCaseId === String(item.id) ? 2 : 1
                      }
                    />

                    <rect
                      x={boxX}
                      y={boxY + 8}
                      width={4}
                      height={boxHeight - 16}
                      rx={2}
                      fill={item.colour}
                    />

                    <text
                      x={boxX + 13}
                      y={boxY + 20}
                      fill="#0f172a"
                      fontSize={13}
                      fontWeight={600}
                      pointerEvents="none"
                    >
                      {title}
                    </text>

                    <text
                      x={boxX + 13}
                      y={boxY + 39}
                      fill="#475569"
                      fontSize={12}
                      pointerEvents="none"
                    >
                      {subtitle}
                    </text>
                  </g>
                </g>
              );
            })}

            <text
              x={plot.left + plotWidth / 2}
              y={height - 30}
              textAnchor="middle"
              fill="#334155"
              fontSize={14}
            >
              Total stroke (%) — including deadlift
            </text>

            <text
              transform={`translate(24 ${
                plot.top + plotHeight / 2
              }) rotate(-90)`}
              textAnchor="middle"
              fill="#334155"
              fontSize={14}
            >
              Cv
            </text>
          </svg>

          {plottedCases.length > 0 && (
            <div
              aria-label="Operating point values"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px 18px",
                marginTop: 8,
                fontSize: 12,
              }}
            >
              {plottedCases.map((item) => (
                <span
                  key={item.id}
                  style={{
                    color: item.colour,
                    overflowWrap: "anywhere",
                  }}
                >
                  <strong>{item.name}</strong>
                  {" — "}
                  Cv {formatNumber(item.requiredCv)}
                  {", "}
                  {formatNumber(item.strokePercent)}% stroke
                </span>
              ))}
            </div>
          )}

          {unavailableCases.length > 0 && (
            <div
              role="status"
              style={{
                marginTop: 14,
                padding: "10px 12px",
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 6,
                color: "#92400e",
                fontSize: 12,
              }}
            >
              <strong>Cases not plotted</strong>

              <ul
                style={{
                  margin: "6px 0 0",
                  paddingLeft: 18,
                }}
              >
                {unavailableCases.map((item) => (
                  <li key={item.id} style={{ marginTop: 3 }}>
                    {item.name}: {item.unavailableReason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <details
            style={{
              marginTop: 16,
              color: "#64748b",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <summary style={{ cursor: "pointer" }}>
              Estimated characteristic — modelling assumptions
            </summary>

            <ul style={{ paddingLeft: 18 }}>
              {curve.warnings.map((warning, index) => (
                <li key={index} style={{ marginTop: 6 }}>
                  {warning}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}