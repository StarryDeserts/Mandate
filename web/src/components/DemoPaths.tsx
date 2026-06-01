import { evidence, formatPct, shortenHash } from "@/lib/evidence";
import Section from "./Section";

export default function DemoPaths() {
  const { safe, dangerous, actor, role } = evidence.demo;

  return (
    <Section id="demo-paths" eyebrow="04 · Demo paths" title="Two proposals. One policy boundary.">
      <div className="demo-grid">
        <article className="demo-card demo-card--safe" data-reveal>
          <p className="demo-card__status mono">OK / {safe.result}</p>
          <h3>
            {safe.amountUsdg} {safe.fromSymbol} → {safe.toSymbol}
          </h3>
          <p>within 35% exposure limit</p>
          <strong>{formatPct(safe.postExposurePct)} post exposure</strong>
        </article>
        <article className="demo-card demo-card--blocked" data-reveal data-stagger="1">
          <p className="demo-card__status mono">{dangerous.result}</p>
          <h3>
            {dangerous.amountUsdg} {dangerous.fromSymbol} → {dangerous.toSymbol}
          </h3>
          <p>{dangerous.reason}</p>
          <strong>{formatPct(dangerous.postExposurePct)} would-be exposure · balances unchanged</strong>
        </article>
        <article className="demo-card demo-card--session" data-reveal data-stagger="2">
          <p className="demo-card__status mono">SESSION-KEY BOUNDARY</p>
          <h3>{shortenHash(actor)}</h3>
          <p>role {role}</p>
          <strong>ActionSubmitted · ActionBlocked · reason {dangerous.reasonCode}</strong>
        </article>
      </div>
    </Section>
  );
}
