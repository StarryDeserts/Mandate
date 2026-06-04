"use client";

import { useCountUp } from "@/hooks/useCountUp";
import { copy } from "@/lib/copy";
import { evidence, formatPct } from "@/lib/evidence";
import { txUrl } from "@/lib/explorer";
import BoundaryField from "./BoundaryField";
import HeroBadges from "./HeroBadges";

export default function Hero() {
  useCountUp();
  const { safe, dangerous, blockedTx } = evidence.demo;

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__field" aria-hidden="true">
        <BoundaryField variant="hero" />
      </div>
      <div className="hero__foreground">
        <HeroBadges />
        <p className="hero__product mono">{copy.hero.product}</p>
        <h1 id="hero-title" className="hero__headline display">
          {copy.hero.headline}
        </h1>
        <p className="hero__subheadline">{copy.hero.subheadline}</p>
        <div className="hero__metrics" aria-label="Blocked action metrics">
          <div>
            <span className="mono">Current TSLA exposure</span>
            <strong data-count={safe.postExposurePct} data-count-suffix="%">
              {formatPct(safe.postExposurePct)}
            </strong>
          </div>
          <div>
            <span className="mono">Max allowed exposure</span>
            <strong>{formatPct(evidence.policy.maxSingleAssetExposurePct)}</strong>
          </div>
          <div>
            <span className="mono">Dangerous proposal</span>
            <strong>
              {dangerous.amountUsdg} {dangerous.fromSymbol} → {dangerous.toSymbol}
            </strong>
          </div>
          <div>
            <span className="mono">Post exposure would be</span>
            <strong className="hero__blocked" data-count={dangerous.postExposurePct} data-count-suffix="%">
              {formatPct(dangerous.postExposurePct)}
            </strong>
          </div>
        </div>
        <div className="hero__ctas">
          <a className="button button--primary" href="/live">
            {copy.hero.primaryCta}
          </a>
          <a className="button button--secondary" href={txUrl(blockedTx)}>
            {copy.hero.secondaryCta}
          </a>
        </div>
      </div>
    </section>
  );
}
