import { evidence, formatPct, shortenHash } from "@/lib/evidence";
import { txUrl } from "@/lib/explorer";

export default function BlockedStamp({ compact = false, interactive = true }: { compact?: boolean; interactive?: boolean }) {
  const { dangerous, blockedTx } = evidence.demo;
  const href = txUrl(blockedTx);
  const hash = shortenHash(blockedTx);

  return (
    <aside className={`blocked-stamp ${compact ? "blocked-stamp--compact" : ""}`} aria-label="Blocked onchain action evidence">
      <div className="blocked-stamp__label">{dangerous.result}</div>
      <div className="blocked-stamp__reason">
        {dangerous.reason} · #{dangerous.reasonCode}
      </div>
      <div className="blocked-stamp__math">
        <span>{formatPct(dangerous.preExposurePct)}</span>
        <span aria-hidden="true">→</span>
        <s>{formatPct(dangerous.postExposurePct)}</s>
      </div>
      {interactive ? (
        <a className="blocked-stamp__hash" href={href} aria-label={`Blocked transaction ${blockedTx}`}>
          {hash}
        </a>
      ) : (
        <span className="blocked-stamp__hash" aria-hidden="true">
          {hash}
        </span>
      )}
    </aside>
  );
}
