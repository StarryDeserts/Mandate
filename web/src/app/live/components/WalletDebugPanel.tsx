import type { ReactNode } from "react";
import type { LiveWalletState } from "../hooks/useLiveWallet";

type Props = {
  wallet: LiveWalletState;
};

export default function WalletDebugPanel({ wallet }: Props) {
  return (
    <section className="app-panel live-debug-panel" aria-labelledby="live-wallet-debug-title">
      <details className="live-debug-panel__details">
        <summary>
          <span className="mono">WALLET DEBUG</span>
          <strong>Developer diagnostics</strong>
          <span>Raw wallet requests and relayer state are collapsed by default.</span>
        </summary>
        <div className="app-panel__header">
          <p className="mono">WALLET DEBUG</p>
          <h3 id="live-wallet-debug-title">Wallet Debug</h3>
          <p>Visible during manual wallet testing to prove each handler enters and each direct provider request is explicit.</p>
        </div>
        <div className="app-state-grid">
          {rows([
          ["CONNECTED ADDRESS", wallet.debug.connectedAddress],
          ["CHAIN ID", wallet.debug.chainId],
          ["WALLET CLIENT PRESENT", wallet.debug.walletClientPresent],
          ["PUBLIC CLIENT PRESENT", wallet.debug.publicClientPresent],
          ["SELECTED TOKEN", wallet.debug.selectedToken],
          ["SELECTED AMOUNT", wallet.debug.selectedAmount],
          ["LAST CLICKED BUTTON", wallet.debug.lastClickedButton],
          ["LAST HANDLER ENTERED", wallet.debug.lastHandlerEntered],
          ["LAST REQUEST METHOD", wallet.debug.lastRequestMethod],
          ["LAST REQUEST STATUS", wallet.debug.lastRequestStatus],
          ["LAST REQUEST ERROR", wallet.debug.lastRequestError],
          ["LAST TRANSACTION REQUEST", wallet.debug.lastTransactionRequest],
          ["LAST APPROVAL SPENDER", wallet.debug.lastApprovalSpender],
          ["LAST APPROVAL REQUEST", wallet.debug.lastApprovalRequest],
          ["LAST APPROVAL RESULT", wallet.debug.lastApprovalResult],
          ["LAST APPROVAL ERROR", wallet.debug.lastApprovalError],
          ["LAST DEPOSIT MANDATEACCOUNT", wallet.debug.lastDepositMandateAccount],
          ["LAST DEPOSIT REQUEST", wallet.debug.lastDepositRequest],
          ["LAST DEPOSIT RESULT", wallet.debug.lastDepositResult],
          ["LAST DEPOSIT ERROR", wallet.debug.lastDepositError],
          ["SAFE PREVIEW STATUS", wallet.safePreviewStatusLabel],
          ["SAFE ACTION STEP", wallet.safeActionStep],
          ["SAFE DECISION", wallet.safeDecisionStatusLabel],
          ["SAFE SUBMIT TX", wallet.safeSubmitTxHash ?? "none"],
          ["SAFE EXECUTE TX", wallet.safeExecuteTxHash ?? "none"],
          ["LAST SIMULATION START", wallet.debug.lastSimulationStart],
          ["LAST SIMULATION RESULT", wallet.debug.lastSimulationResult],
          ["LAST SIMULATION ERROR", wallet.debug.lastSimulationError],
          ["LAST WRITE START", wallet.debug.lastWriteStart],
          ["LAST WRITE RESULT", wallet.debug.lastWriteResult],
          ["LAST WRITE ERROR", wallet.debug.lastWriteError],
          ["LAST TX HASH", wallet.debug.lastTxHash],
          ["LAST RECEIPT STATUS", wallet.debug.lastReceiptStatus]
          ])}
        </div>
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
