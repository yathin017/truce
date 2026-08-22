"use client";

/**
 * A looping, self-contained explainer of what Truce does: four keepers fire a cheap claim into
 * the coordinator, one wins, the losers stand down, and only the winner runs the expensive
 * execution. No data — pure SVG + CSS so it always plays.
 */
export function HeroAnimation() {
  const lanes = [46, 104, 162, 220];
  const gateX = 300;
  const gateW = 150;
  const midY = 133;
  const execX = 690;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
        <span className="eyebrow">What Truce does</span>
        <span className="font-mono text-[11px] text-muted">four cheap claims in · one execution out</span>
      </div>

      <div className="px-4 py-5">
        <svg viewBox="0 0 760 266" className="w-full" role="img" aria-label="Keepers race a cheap claim; one winner executes.">
          <defs>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="4.5" refY="3" orient="auto">
              <path d="M0 0 L5 3 L0 6" fill="none" stroke="#C9C2B4" strokeWidth="1" />
            </marker>
          </defs>

          {/* connector lines */}
          {lanes.map((y, i) => (
            <line
              key={i}
              x1={92}
              y1={y}
              x2={gateX}
              y2={y}
              stroke="#E4DFD4"
              strokeWidth="1.5"
              strokeDasharray="3 4"
              markerEnd="url(#arrow)"
            />
          ))}
          <line
            x1={gateX + gateW}
            y1={midY}
            x2={execX - 26}
            y2={midY}
            stroke="#E4DFD4"
            strokeWidth="1.5"
            strokeDasharray="3 4"
            markerEnd="url(#arrow)"
          />

          {/* keeper nodes */}
          {lanes.map((y, i) => (
            <g key={i}>
              <circle cx={64} cy={y} r={15} fill="#FFFFFF" stroke="#E4DFD4" strokeWidth="1.5" />
              <text x={64} y={y + 4} textAnchor="middle" className="fill-[#4A453C]" fontSize="11" fontFamily="ui-monospace, monospace">
                K{i + 1}
              </text>
            </g>
          ))}
          <text x={64} y={252} textAnchor="middle" className="fill-[#9A9488]" fontSize="10" fontFamily="ui-monospace, monospace" letterSpacing="0.1em">
            KEEPERS
          </text>

          {/* the coordinator gate */}
          <rect x={gateX} y={22} width={gateW} height={222} rx={12} fill="#FCFBF7" stroke="#1C1B18" strokeWidth="1.5" />
          <text x={gateX + gateW / 2} y={126} textAnchor="middle" className="fill-[#1C1B18]" fontSize="15" fontWeight="600">
            Truce
          </text>
          <text x={gateX + gateW / 2} y={146} textAnchor="middle" className="fill-[#726C61]" fontSize="10" fontFamily="ui-monospace, monospace">
            claim gate
          </text>

          {/* execute node */}
          <g>
            <circle className="tr-exec-node" cx={execX} cy={midY} r={26} fill="#D8ECE2" stroke="#118A64" strokeWidth="1.5" />
            <text x={execX} y={midY - 2} textAnchor="middle" className="fill-[#0E7C66]" fontSize="11" fontWeight="600">
              execute
            </text>
            <text x={execX} y={midY + 12} textAnchor="middle" className="fill-[#0E7C66]" fontSize="9" fontFamily="ui-monospace, monospace">
              once
            </text>
          </g>

          {/* claim packets — three losers, one winner */}
          {lanes.map((y, i) => {
            const winner = i === 1;
            return (
              <g key={i} className={winner ? "tr-pkt-winner" : "tr-pkt-loser"} style={{ ["--y" as string]: `${y}px` }}>
                <rect x={84} y={y - 9} width={26} height={18} rx={5} fill={winner ? "#D8ECE2" : "#F4E3D6"} stroke={winner ? "#118A64" : "#C4551D"} strokeWidth="1.5" />
                <text x={97} y={y + 3} textAnchor="middle" fontSize="8" fontFamily="ui-monospace, monospace" className={winner ? "fill-[#0E7C66]" : "fill-[#C4551D]"}>
                  claim
                </text>
              </g>
            );
          })}

          {/* the single expensive execution packet, emitted from the gate */}
          <g className="tr-pkt-exec">
            <rect x={gateX + gateW - 6} y={midY - 11} width={40} height={22} rx={6} fill="#118A64" />
            <text x={gateX + gateW + 14} y={midY + 3} textAnchor="middle" fontSize="8" fontFamily="ui-monospace, monospace" fill="#FFFFFF">
              work
            </text>
          </g>

          {/* stand-down markers on the three losers */}
          {[0, 2, 3].map((i) => (
            <text
              key={i}
              className="tr-standdown"
              x={gateX - 16}
              y={lanes[i]! + 4}
              textAnchor="middle"
              fontSize="13"
              fill="#9A9488"
            >
              ✕
            </text>
          ))}
        </svg>

        <div className="mt-3 grid grid-cols-3 gap-3 border-t border-hairline pt-3">
          <Legend swatch="#C4551D" label="Claim · cheap, bonded" />
          <Legend swatch="#9A9488" label="Losers stand down" />
          <Legend swatch="#118A64" label="Winner executes once" />
        </div>
      </div>

      <style>{`
        @keyframes trLoserIn {
          0%, 3%   { transform: translateX(0); opacity: 0; }
          9%       { opacity: 1; }
          34%      { transform: translateX(190px); opacity: 1; }
          44%      { transform: translateX(196px); opacity: 0.14; }
          100%     { transform: translateX(196px); opacity: 0.14; }
        }
        @keyframes trWinnerIn {
          0%, 3%   { transform: translateX(0); opacity: 0; }
          9%       { opacity: 1; }
          34%,100% { transform: translateX(190px); opacity: 1; }
        }
        @keyframes trExecOut {
          0%, 46%  { transform: translateX(0); opacity: 0; }
          52%      { opacity: 1; }
          82%      { transform: translateX(232px); opacity: 1; }
          92%      { transform: translateX(232px); opacity: 0; }
          100%     { transform: translateX(232px); opacity: 0; }
        }
        @keyframes trExecNode {
          0%, 78%  { fill: #EEF6F1; }
          86%      { fill: #B7E0CD; }
          100%     { fill: #EEF6F1; }
        }
        @keyframes trStandDown {
          0%, 40%  { opacity: 0; }
          48%      { opacity: 1; }
          100%     { opacity: 1; }
        }
        .tr-pkt-loser  { animation: trLoserIn 7s cubic-bezier(0.4,0,0.2,1) infinite; }
        .tr-pkt-winner { animation: trWinnerIn 7s cubic-bezier(0.4,0,0.2,1) infinite; }
        .tr-pkt-exec   { animation: trExecOut 7s cubic-bezier(0.4,0,0.2,1) infinite; }
        .tr-exec-node  { animation: trExecNode 7s ease-in-out infinite; }
        .tr-standdown  { animation: trStandDown 7s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .tr-pkt-loser, .tr-pkt-winner, .tr-pkt-exec, .tr-exec-node, .tr-standdown { animation: none; }
          .tr-pkt-exec { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: swatch }} />
      <span className="font-mono text-[11px] leading-tight text-muted">{label}</span>
    </div>
  );
}
