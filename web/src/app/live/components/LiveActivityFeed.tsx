import { useState } from "react";
import { txUrl } from "@/lib/explorer";
import { shortAddress } from "@/lib/mandate/format";
import type { LiveActivityItem } from "../activity";

type Props = {
  items: LiveActivityItem[];
  onClear: () => void;
};

export default function LiveActivityFeed({ items, onClear }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyHash(item: LiveActivityItem) {
    if (!item.txHash) return;
    void navigator.clipboard?.writeText(item.txHash);
    setCopiedId(item.id);
    window.setTimeout(() => setCopiedId((current) => (current === item.id ? null : current)), 2000);
  }

  return (
    <section className="app-panel live-activity" aria-labelledby="live-activity-title">
      <div className="app-panel__header live-panel-header-row">
        <div>
          <p className="mono">AUDIT / ACTIVITY STREAM</p>
          <h3 id="live-activity-title">Activity</h3>
          <p>Readable event cards for wallet transactions, agent submissions, executions, and blocked evidence.</p>
        </div>
        <button className="button button--secondary" type="button" onClick={onClear} disabled={items.length === 0}>Clear activity</button>
      </div>
      {items.length === 0 ? (
        <p className="app-funding__notice">No activity recorded yet. Confirmed transactions and relayer results will appear here.</p>
      ) : (
        <ol className="live-activity__list">
          {items.map((item) => (
            <li className={`live-activity__item live-activity__item--${item.status}`} key={item.id}>
              <div className="live-activity__item-header">
                <div>
                  <p className="mono">{item.type}</p>
                  <h4>{item.title}</h4>
                </div>
                <span className={`app-chip live-chip--${item.status}`}>{item.status}</span>
              </div>
              <p>{item.summary}</p>
              {item.balanceDelta ? <p className="live-activity__delta">{item.balanceDelta}</p> : null}
              {item.reason ? <p className="app-funding__notice">Reason: {item.reason}</p> : null}
              {item.txHash ? (
                <div className="live-activity__actions">
                  <a href={item.explorerUrl ?? txUrl(item.txHash)} target="_blank" rel="noreferrer">View tx {shortAddress(item.txHash, 10, 6)}</a>
                  <button className="button button--secondary" type="button" onClick={() => copyHash(item)}>Copy tx hash</button>
                  <span className="live-activity__copied" role="status" aria-live="polite">{copiedId === item.id ? "Copied" : ""}</span>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
