import type { ReactNode } from "react";
import { txUrl } from "../../../lib/explorer";
import { shortAddress } from "../../../lib/mandate/format";
import { reasonLabel } from "../../../lib/mandate/reasons";
import type { LiveWalletState } from "../hooks/useLiveWallet";

type Props = {
  wallet: LiveWalletState;
};

export default function SafeExecutionPanel({ wallet }: Props) {
  return (
    <section className="app-panel" aria-labelledby="live-safe-execution-title">
      <div className="app-panel__header">
        <p className="mono">EXECUTE</p>
        <h3 id="live-safe-execution-title">Small TSLA Buy Execution</h3>
        <p>Demo agent relayer uses the configured server-side session key. The user wallet funds the account; the agent runtime submits only the fixed small TSLA buy candidate.</p>
        <p>User wallet funds MandateAccount. Demo agent holds the session key. Mandate enforces policy before funds move.</p>
      </div>

      <div className="app-state-grid">
        {rows([
          ["ACTION STEP", wallet.safeActionStep],
          ["ACTION ID", wallet.safeActionId ? shortAddress(wallet.safeActionId, 10, 8) : "none"],
          ["DECISION STATUS", wallet.safeDecisionStatusLabel],
          ["SUBMIT SIMULATION", wallet.safeSubmitSimulation ? reasonLabel(wallet.safeSubmitSimulation.code) : "not run"],
          ["SUBMIT TX", wallet.safeSubmitTxHash ? shortAddress(wallet.safeSubmitTxHash, 10, 8) : "none"],
          ["SUBMIT RECEIPT", wallet.safeSubmitReceiptStatus],
          ["EXECUTE TX", wallet.safeExecuteTxHash ? shortAddress(wallet.safeExecuteTxHash, 10, 8) : "none"],
          ["EXECUTE RECEIPT", wallet.safeExecuteReceiptStatus]
        ])}
      </div>

      <div className="live-console__actions">
        <button className="button button--primary" type="button" disabled={Boolean(wallet.agentRelayerDisabledReason)} onClick={() => void wallet.runAgentSafeAction()}>
          {wallet.safeActionPending ? "Agent submitting small TSLA buy" : "Agent submit and execute approved candidate"}
        </button>
      </div>

      {wallet.safeExecuteTxHash ? (
        <p className="live-confirm" role="status">
          <span className="app-chip live-chip--executed">executed</span>
          <strong>Safe action executed — small TSLA buy after Mandate approval.</strong>
          <a href={txUrl(wallet.safeExecuteTxHash)} target="_blank" rel="noreferrer">View tx {shortAddress(wallet.safeExecuteTxHash, 10, 6)}</a>
        </p>
      ) : null}

      {wallet.agentRelayerDisabledReason ? <p className="app-funding__notice"><strong>Agent relayer disabled:</strong> {wallet.agentRelayerDisabledReason}</p> : null}
      {wallet.safeActionError ? <p className="app-funding__error">{wallet.safeActionError}</p> : null}

      <details className="live-console__request-block">
        <summary className="live-console__request-summary mono">Submit transaction request object</summary>
        <pre className="live-console__request">{wallet.safeSubmitTransactionRequest}</pre>
      </details>
      <details className="live-console__request-block">
        <summary className="live-console__request-summary mono">Execute transaction request object</summary>
        <pre className="live-console__request">{wallet.safeExecuteTransactionRequest}</pre>
      </details>
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
