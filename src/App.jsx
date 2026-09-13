import { useMemo, useState } from "react";
import "./App.css";
import { calculateLiquidCv } from "./calculations/iec60534/liquidSizing";
import InputPanel from "./components/InputPanel";
import ResultPanel from "./components/ResultPanel";
import StatusCard from "./components/StatusCard";

function App() {
  const [inputs, setInputs] = useState({
    tagNumber: "LV-1001",
    fluidName: "Water",
    flowRateGpm: 100,
    specificGravity: 1,
    pressureDropPsi: 10,
  });

  const result = useMemo(() => calculateLiquidCv(inputs), [inputs]);

  function updateInput(field, value) {
    setInputs((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Control Valve Sizing Tool</p>
          <h1>Liquid Cv sizing prototype</h1>
          <p className="hero-text">
            First modular version for calculating a preliminary liquid valve flow
            coefficient using Cv-based units. The calculation engine will be
            developed in accordance with IEC 60534.
          </p>
        </div>

        <StatusCard />
      </section>

      <section className="content-grid">
        <InputPanel inputs={inputs} onInputChange={updateInput} />
        <ResultPanel inputs={inputs} result={result} />
      </section>
    </main>
  );
}

export default App;