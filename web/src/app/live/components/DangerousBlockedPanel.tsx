import type { ReactNode } from "react";
import { formatBps, shortAddress } from "../../../lib/mandate/format";
import { humanizeReasonCode } from "../../../lib/mandate/reasons";
import type { LiveWalletState } from "../hooks/useLiveWallet";

type Props = {
  wallet: LiveWalletState;
};

export default function DangerousBlockedPanel({ wallet }: Props) {
  const result = wallet.dangerousActionResult;

  return (
    <section className="app-panel" aria-labelledby="live-dangerous-blocked-title">
      <div className="app-panel__header">
        <p className="mono">DEMO AGENT BLOCKED PATH</p>
        <h3 id="live-dangerous-blocked-title">Dangerous Blocked Action</h3>
        <p>Submits the fixed 500 USDG → TSLA blocked-path candidate for evidence only. This panel never exposes an execute CTA.</p>
      </div>

      <div className="app-state-grid">
        {rows([
          ["CANDIDATE", "500 USDG → TSLA"],
          ["PREVIEW REASON", result ? result.previewReason : "not submitted"],
          ["BLOCKED REASON", result?.blockedReason ?? "not submitted"],
          ["PRE EXPOSURE", result ? formatBps(result.preview.preExposureBps) : "not submitted"],
          ["POST EXPOSURE", result ? formatBps(result.preview.postExposureBps) : "not submitted"],
          ["ACTION ID", result ? shortAddress(result.actionId, 10, 8) : "none"],
          ["SUBMIT TX", result ? shortAddress(result.submitTxHash, 10, 8) : "none"],
          ["SUBMIT RECEIPT", result?.submitReceiptStatus ?? "none"],
          ["DECISION STATUS", result?.decisionStatus ?? "none"]
        ])}
      </div>

      <div className="live-console__actions">
        <button className="button button--secondary" type="button" disabled={Boolean(wallet.dangerousActionDisabledReason)} onClick={() => void wallet.runAgentDangerousAction()}>
          {wallet.dangerousActionPending ? "Agent submitting blocked action" : "Agent submit blocked test action"}
        </button>
      </div>

      {wallet.dangerousActionDisabledReason ? <p className="app-funding__notice"><strong>Blocked action disabled:</strong> {wallet.dangerousActionDisabledReason}</p> : null}
      {result ? <p className="app-funding__notice">{humanizeReasonCode(result.preview.code)} Funds moved: no.</p> : null}
      {wallet.dangerousActionError ? <p className="app-funding__error">{wallet.dangerousActionError}</p> : null}
      <p className="app-funding__notice">Dangerous action execution is prevented server-side and no execute button is rendered.</p>
    </section>
  );
}

function rows(items: readonly (readonly [string, ReactNode])[]) {
  return items.map(([label, value]) => (
    <div className="app-state-row" key={label}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  ));
}
