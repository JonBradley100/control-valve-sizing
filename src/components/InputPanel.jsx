function InputPanel({ inputs, onInputChange }) {
  return (
    <div className="panel">
      <label>
        Liquid flow rate, Q/m
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