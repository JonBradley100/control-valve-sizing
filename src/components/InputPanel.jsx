function InputPanel({ inputs, onInputChange }) {
  return (
    <div className="panel">
      <h2>Input data</h2>

      <label>
        Tag number
        <input
          type="text"
          value={inputs.tagNumber}
          onChange={(event) => onInputChange("tagNumber", event.target.value)}
        />
      </label>

      <label>
        Fluid name
        <input
          type="text"
          value={inputs.fluidName}
          onChange={(event) => onInputChange("fluidName", event.target.value)}
        />
      </label>

      <label>
        Liquid flow rate, Q
        <div className="input-with-unit">
          <input
            type="number"
            value={inputs.flowRateGpm}
            onChange={(event) =>
              onInputChange("flowRateGpm", event.target.value)
            }
          />
          <span>gpm</span>
        </div>
      </label>

      <label>
        Specific gravity, SG
        <input
          type="number"
          step="0.01"
          value={inputs.specificGravity}
          onChange={(event) =>
            onInputChange("specificGravity", event.target.value)
          }
        />
      </label>

      <label>
        Pressure drop, ΔP
        <div className="input-with-unit">
          <input
            type="number"
            step="0.01"
            value={inputs.pressureDropPsi}
            onChange={(event) =>
              onInputChange("pressureDropPsi", event.target.value)
            }
          />
          <span>psi</span>
        </div>
      </label>
    </div>
  );
}

export default InputPanel;