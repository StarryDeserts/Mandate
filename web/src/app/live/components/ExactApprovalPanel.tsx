import type { ReactNode } from "react";
import { txUrl } from "@/lib/explorer";
import { shortAddress } from "@/lib/mandate/format";
import MonoValue from "./MonoValue";
import type { LiveWalletState } from "../hooks/useLiveWallet";

type Props = {
  wallet: LiveWalletState;
};

export default function ExactApprovalPanel({ wallet }: Props) {
  return (
    <section className="app-panel" aria-labelledby="live-exact-approval-title">
      <div className="app-panel__header">
        <p className="mono">STEP 2 OF 3 · APPROVE</p>
        <h3 id="live-exact-approval-title">Exact ERC20 Approval</h3>
        <p>Approve only the selected preset amount for MandateAccount. Unlimited approval is not used.</p>
      </div>

      <div className="app-state-grid">
        {rows([
          ["SELECTED TOKEN", wallet.selectedMintToken.label],
          ["SELECTED AMOUNT", wallet.selectedMintAmountLabel],
          ["SPENDER", <MonoValue key="spender" value={wallet.approvalSpender} />],
          ["CURRENT ALLOWANCE", allowanceLabel(wallet)],
          ["APPROVAL REQUIRED", wallet.approvalStatusLabel],
          ["TX HASH", wallet.approvalTxHash ? <MonoValue key="tx" value={wallet.approvalTxHash} head={10} tail={8} /> : "none"],
          ["RECEIPT STATUS", wallet.approvalReceiptStatus]
        ])}
      </div>

      <div className="live-console__actions">
        <button className="button button--primary" type="button" disabled={Boolean(wallet.approvalDisabledReason)} onClick={() => void wallet.approveExactAmount()}>
          {wallet.approvalPending ? "Approving exact amount" : "Approve exact amount"}
        </button>
      </div>

      {wallet.approvalReceiptStatus === "0x1" && wallet.approvalTxHash ? (
        <p className="live-confirm" role="status">
          <span className="app-chip live-chip--confirmed">confirmed</span>
          <strong>Approved {wallet.selectedMintAmountLabel} for MandateAccount.</strong>
          <a href={txUrl(wallet.approvalTxHash)} target="_blank" rel="noreferrer">View tx {shortAddress(wallet.approvalTxHash, 10, 6)}</a>
        </p>
      ) : null}

      {wallet.approvalDisabledReason ? <p className="app-funding__notice"><strong>Approve disabled:</strong> {wallet.approvalDisabledReason}</p> : null}
      {wallet.allowanceError ? <p className="app-funding__error">{wallet.allowanceError}</p> : null}
      {wallet.approvalError ? <p className="app-funding__error">{wallet.approvalError}</p> : null}

      <details className="live-console__request-block">
        <summary className="live-console__request-summary mono">Approval transaction request object</summary>
        <pre className="live-console__request">{wallet.approvalTransactionRequest}</pre>
      </details>
    </section>
  );
}

function allowanceLabel(wallet: LiveWalletState): string {
  if (wallet.allowanceLoading) return "loading";
  if (wallet.allowanceError) return "read error";
  return wallet.selectedAllowanceLabel;
}

function rows(items: readonly (readonly [string, ReactNode])[]) {
  return items.map(([label, value]) => (
    <div className="app-state-row" key={label}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  ));
}
