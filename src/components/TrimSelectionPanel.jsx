function TrimSelectionPanel({
  selectedValve,
  selectedValveCode,
  selectedTrim,
  selectedTrimDesignCv,
  onSelectedValveChange,
}) {
  const isComplete =
    selectedValve.directionality &&
    selectedValve.size &&
    selectedValve.pressureClass &&
    selectedValve.stages &&
    selectedValve.trimType &&
    selectedValve.style;

  return (
    <section className="panel trim-selection-panel">
      <div className="panel-header trim-selection-header">
        <div>
          <h2>Trim selection</h2>
        </div>
      </div>

      <div className="input-grid trim-selection-grid">
        <label>
          Directionality:
          <select
            value={selectedValve.directionality}
            onChange={(event) =>
              onSelectedValveChange("directionality", event.target.value)
            }
          >
            <option value="">Select directionality...</option>
            <option value="CB">Bi-directional</option>
            <option value="CU">Uni-directional</option>
          </select>
        </label>

        <label>
          Size:
          <select
            value={selectedValve.size}
            onChange={(event) =>
              onSelectedValveChange("size", event.target.value)
            }
          >
            <option value="">Select size...</option>
            <option value="02">2 inch</option><option value="03">3 inch</option><option value="04">4 inch</option>
            <option value="06">6 inch</option><option value="08">8 inch</option><option value="10">10 inch</option>
            <option value="12">12 inch</option><option value="14">14 inch</option><option value="16">16 inch</option>
            <option value="18">18 inch</option><option value="20">20 inch</option><option value="24">24 inch</option>
            <option value="28">28 inch</option><option value="30">30 inch</option><option value="32">32 inch</option>
            <option value="34">34 inch</option><option value="36">36 inch</option><option value="38">38 inch</option>
            <option value="40">40 inch</option><option value="42">42 inch</option><option value="48">48 inch</option>
          </select>
        </label>

        <label>
          Class:
          <select
            value={selectedValve.pressureClass}
            onChange={(event) =>
              onSelectedValveChange("pressureClass", event.target.value)
            }
          >
            <option value="">Select class...</option>
            <option value="015">150#</option><option value="030">300#</option><option value="060">600#</option>
            <option value="090">900#</option><option value="150">1500#</option><option value="250">2500#</option>
          </select>
        </label>

        <label>
          No. of Stages:
          <select
            value={selectedValve.stages}
            onChange={(event) =>
              onSelectedValveChange("stages", event.target.value)
            }
          >
            <option value="">Select stages...</option>
            <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
          </select>
        </label>

        <label>
          Type:
          <select
            value={selectedValve.trimType}
            onChange={(event) =>
              onSelectedValveChange("trimType", event.target.value)
            }
          >
            <option value="">Select type...</option>
            <option value="S">S - Slotted</option><option value="H">H - Holes</option>
          </select>
        </label>

        <label>
          Characteristic:
          <select
            value={selectedValve.style}
            onChange={(event) =>
              onSelectedValveChange("style", event.target.value)
            }
          >
            <option value="">Select characteristic...</option>
            <option value="L">L - Linear</option><option value="E">E - Equal percentage</option><option value="Q">Q - Equal-linear</option>
          </select>
        </label>
      </div>

      <div className="result-card trim-results-card">
        <span className="trim-result-label">Trim Code:</span>
        <strong className="trim-result-value">
          {isComplete ? selectedValveCode : "Incomplete selection"}
        </strong>

        <span className="trim-result-label">Rated Cv:</span>
        <strong className="trim-result-value">
          {isComplete
            ? selectedTrim
              ? selectedTrimDesignCv
              : "Not found in database"
            : "Incomplete selection"}
        </strong>
      </div>
    </section>
  );
}

export default TrimSelectionPanel;