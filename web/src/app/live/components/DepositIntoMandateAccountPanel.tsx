import type { ReactNode } from "react";
import { txUrl } from "@/lib/explorer";
import { shortAddress } from "@/lib/mandate/format";
import MonoValue from "./MonoValue";
import { formatTokenAmount18 } from "../hooks/liveMintRequests";
import type { LiveWalletState } from "../hooks/useLiveWallet";

type Props = {
  wallet: LiveWalletState;
};

export default function DepositIntoMandateAccountPanel({ wallet }: Props) {
  return (
    <section className="app-panel" aria-labelledby="live-deposit-title">
      <div className="app-panel__header">
        <p className="mono">STEP 3 OF 3 · DEPOSIT</p>
        <h3 id="live-deposit-title">Deposit into MandateAccount</h3>
        <p>Calls MandateAccount.deposit(token, selectedAmount) after exact approval is sufficient. No direct ERC20 transfer is used.</p>
      </div>

      <div className="app-state-grid">
        {rows([
          ["SELECTED TOKEN", wallet.selectedMintToken.label],
          ["SELECTED AMOUNT", wallet.selectedMintAmountLabel],
          ["WALLET BALANCE", walletBalanceLabel(wallet)],
          ["ALLOWANCE", allowanceLabel(wallet)],
          ["MANDATEACCOUNT", <MonoValue key="acct" value={wallet.mandateAccountAddress} />],
          ["TX HASH", wallet.depositTxHash ? <MonoValue key="tx" value={wallet.depositTxHash} head={10} tail={8} /> : "none"],
          ["RECEIPT STATUS", wallet.depositReceiptStatus]
        ])}
      </div>

      <div className="live-console__actions">
        <button className="button button--primary" type="button" disabled={Boolean(wallet.depositDisabledReason)} onClick={() => void wallet.depositIntoMandateAccount()}>
          {wallet.depositPending ? "Depositing into MandateAccount" : "Deposit into MandateAccount"}
        </button>
      </div>

      {wallet.depositReceiptStatus === "0x1" && wallet.depositTxHash ? (
        <p className="live-confirm" role="status">
          <span className="app-chip live-chip--confirmed">confirmed</span>
          <strong>Deposited {wallet.selectedMintAmountLabel} into MandateAccount.</strong>
          <a href={txUrl(wallet.depositTxHash)} target="_blank" rel="noreferrer">View tx {shortAddress(wallet.depositTxHash, 10, 6)}</a>
        </p>
      ) : null}

      {wallet.depositDisabledReason ? <p className="app-funding__notice"><strong>Deposit disabled:</strong> {wallet.depositDisabledReason}</p> : null}
      {wallet.depositError ? <p className="app-funding__error">{wallet.depositError}</p> : null}

      <details className="live-console__request-block">
        <summary className="live-console__request-summary mono">Deposit transaction request object</summary>
        <pre className="live-console__request">{wallet.depositTransactionRequest}</pre>
      </details>
    </section>
  );
}

function walletBalanceLabel(wallet: LiveWalletState): string {
  if (wallet.tokenBalancesLoading) return "loading";
  if (wallet.tokenBalancesError) return "read error";
  if (wallet.selectedTokenBalance === null) return "not loaded";
  return `${formatTokenAmount18(wallet.selectedTokenBalance)} ${wallet.selectedMintToken.label}`;
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
