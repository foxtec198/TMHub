import "./ambient-particles.css";

// Camada apenas decorativa: poucos elementos CSS, sem canvas nem timers de JS.
// A distribuição é determinística para não causar reflow durante a navegação.
const PARTICLES = [
  ["8%", "14%", "5px", "-1s"], ["18%", "72%", "7px", "-4s"], ["28%", "32%", "4px", "-2s"],
  ["39%", "83%", "6px", "-5s"], ["52%", "18%", "5px", "-3s"], ["63%", "68%", "8px", "-6s"],
  ["75%", "27%", "4px", "-2.5s"], ["87%", "78%", "6px", "-4.5s"], ["94%", "42%", "5px", "-1.5s"],
  ["11%", "48%", "4px", "-5.5s"], ["46%", "51%", "6px", "-3.5s"], ["82%", "11%", "4px", "-6.5s"],
  ["4%", "89%", "5px", "-2.8s"], ["23%", "8%", "4px", "-5.8s"], ["34%", "59%", "7px", "-1.7s"],
  ["58%", "91%", "4px", "-4.8s"], ["71%", "47%", "6px", "-3.2s"], ["91%", "16%", "5px", "-5.1s"],
];

export function AmbientParticles({ enabled }) {
  if (!enabled) return null;

  return (
    <div className="ambient-particles" aria-hidden="true">
      {PARTICLES.map(([left, top, size, delay], index) => (
        <i
          key={index}
          style={{
            "--particle-left": left,
            "--particle-top": top,
            "--particle-size": size,
            "--particle-delay": delay,
          }}
        />
      ))}
    </div>
  );
}
