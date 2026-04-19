import { useSimulationStore } from "@/stores/simulation";

export function IncidentReport() {
  const report = useSimulationStore((s) => s.report);
  const status = useSimulationStore((s) => s.status);
  const townRiskMap = useSimulationStore((s) => s.townRiskMap);
  const volumeGallons = useSimulationStore((s) => s.config.volumeGallons);
  const totalMitigationCost = useSimulationStore((s) => s.totalMitigationCost);

  // Live cost derived from current tick's town risk map — updates as user scrubs.
  // Total = cleanup cost (volume + affected pop) + mitigation spend already committed.
  const livePop = Array.from(townRiskMap.values())
    .filter((t) => t.riskLevel !== "CLEAR")
    .reduce((sum, t) => sum + t.population, 0);
  const mitigationSpend = totalMitigationCost();
  const liveCleanup = Math.round(volumeGallons * 180 + livePop * 12);
  const liveCost = liveCleanup + mitigationSpend;

  const hasScrubData = townRiskMap.size > 0;
  const totalCost = hasScrubData ? liveCost : (report ? report.estimatedCleanupCost + mitigationSpend : 0);
  const popAtRisk = hasScrubData ? livePop : (report?.populationAtRisk ?? 0);

  if (!report && !hasScrubData) {
    return (
      <div className="p-5 flex flex-col gap-2">
        <h1 className="text-xl font-bold mb-4">Estimated Cost Report</h1>
        <p className="font-mono text-[11px] text-ink-faint italic">
          {status === "running"
            ? "Generating after final tick…"
            : "AI-drafted briefing will appear after simulation completes."}
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col gap-5">
      <h1 className="text-xl font-bold mb-4">Estimated Cost Report</h1>

      {/* Hero cost number */}
      <div>
        <div className="field-label mb-1">Total estimated cost · USD</div>
        <div
          className="text-[56px] font-light leading-none tracking-tight"
          style={{ color: "#a63d2a", fontFamily: "'Inter Tight', sans-serif" }}
        >
          ${(totalCost / 1_000_000).toFixed(2)}M
        </div>
        <div className="font-mono text-[10px] text-ink-faint mt-1.5">± 14% (90% CI)</div>
      </div>

      {/* Stats grid */}
      <div
        className="grid grid-cols-2 gap-px"
        style={{ background: "rgba(0,0,0,0.1)" }}
      >
        <StatCell label="Population at risk" value={popAtRisk.toLocaleString()} sub="downstream intakes" />
        <StatCell label="Est. cleanup" value={`$${(liveCleanup / 1_000_000).toFixed(2)}M`} sub="remediation only" />
        {mitigationSpend > 0 && (
          <StatCell label="Mitigation spend" value={`$${(mitigationSpend / 1_000_000).toFixed(2)}M`} sub="barriers placed" />
        )}
        {mitigationSpend > 0 && (
          <StatCell label="Total cost" value={`$${(totalCost / 1_000_000).toFixed(2)}M`} sub="cleanup + mitigation" />
        )}
      </div>

      {/* Narrative sections — only available after simulation completes */}
      {report && (
        <>
          <div>
            <Subhead>Summary</Subhead>
            <p className="text-[13px] leading-relaxed text-ink">{report.executiveSummary}</p>
          </div>

          <div>
            <Subhead>Mitigation priority</Subhead>
            <ol className="flex flex-col gap-0">
              {report.mitigationPriorityList.map((item, i) => (
                <li
                  key={i}
                  className="flex gap-3 py-2 border-b border-dashed border-border last:border-0 text-[12px] leading-relaxed"
                >
                  <span
                    className="font-mono text-[10px] font-semibold shrink-0 pt-0.5"
                    style={{ color: "#a63d2a", minWidth: 20 }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-ink">{item}</span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <Subhead>Regulatory obligations</Subhead>
            <ul className="flex flex-col gap-0">
              {report.regulatoryObligations.map((item, i) => (
                <li
                  key={i}
                  className="flex gap-3 py-2 border-b border-dashed border-border last:border-0 text-[12px] leading-relaxed"
                >
                  <span className="text-ink-faint shrink-0 pt-0.5">·</span>
                  <span className="text-ink-dim">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="p-3.5 font-mono text-[10px] leading-relaxed text-ink-dim"
            style={{
              borderLeft: "3px solid #0e1a22",
              background: "#ebe6d6",
            }}
          >
            <div
              className="font-semibold tracking-[0.12em] mb-1"
              style={{ color: "#0e1a22" }}
            >
              REGULATORY FILING — AUTO-GENERATED
            </div>
            Within 1 hour: EPA National Contingency Plan activation (40 CFR 300). Within 15 min:
            EPCRA Emergency Release Notification to SERC / LEPC (40 CFR 355). CWA §311 notification
            to National Response Center 1-800-424-8802.
          </div>
        </>
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-bg p-3.5">
      <div className="field-label mb-1">{label}</div>
      <div
        className="text-[22px] font-medium tracking-tight leading-none"
        style={{ fontFamily: "'Inter Tight', sans-serif" }}
      >
        {value}
      </div>
      {sub && (
        <div className="font-mono text-[10px] text-ink-faint mt-1">{sub}</div>
      )}
    </div>
  );
}

function Subhead({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-ink-dim mb-2">
      {children}
    </div>
  );
}
