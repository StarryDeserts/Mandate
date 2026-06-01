"use client";

import { useEffect, useRef } from "react";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { copy } from "@/lib/copy";
import { evidence, formatPct, shortenHash } from "@/lib/evidence";
import BoundaryField from "./BoundaryField";
import BlockedStamp from "./BoundaryField/BlockedStamp";

export default function BlockedAction() {
  const ref = useRef<HTMLElement>(null);
  const progress = useScrollProgress(ref);
  const { dangerous, actor, role, blockedTx } = evidence.demo;

  useEffect(() => {
    const phase = progress > 0.3 && progress < 0.85 ? 2 : null;
    window.dispatchEvent(new CustomEvent("mandate-boundary-freeze", { detail: { phase } }));
  }, [progress]);

  return (
    <section ref={ref} id="blocked-action" className="blocked-action" aria-labelledby="blocked-action-title">
      <div className="blocked-action__field" aria-hidden="true">
        <BoundaryField variant="echo" />
      </div>
      <div className="blocked-action__content">
        <p className="section__eyebrow mono">06 · Onchain blocked action</p>
        <h2 id="blocked-action-title" className="blocked-action__title display">
          {copy.blocked.title}
        </h2>
        <div className="blocked-action__grid">
          <BlockedStamp />
          <div className="blocked-action__receipt">
            <p>{copy.blocked.body}</p>
            <dl>
              <div><dt>Action</dt><dd>{dangerous.amountUsdg} {dangerous.fromSymbol} → {dangerous.toSymbol}</dd></div>
              <div><dt>Pre-exposure</dt><dd>{formatPct(dangerous.preExposurePct)}</dd></div>
              <div><dt>Would-be exposure</dt><dd>{formatPct(dangerous.postExposurePct)}</dd></div>
              <div><dt>Actor</dt><dd>{shortenHash(actor)}</dd></div>
              <div><dt>Role</dt><dd>{role}</dd></div>
              <div><dt>Tx</dt><dd>{shortenHash(blockedTx, 8, 8)}</dd></div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
