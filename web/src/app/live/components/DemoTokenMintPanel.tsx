import type { ReactNode } from "react";
import { txUrl } from "@/lib/explorer";
import { shortAddress } from "@/lib/mandate/format";
import MonoValue from "./MonoValue";
import type { LiveWalletState } from "../hooks/useLiveWallet";

type Props = {
  wallet: LiveWalletState;
};

export default function DemoTokenMintPanel({ wallet }: Props) {
  return (
    <section className="app-panel" aria-labelledby="live-demo-mint-title">
      <div className="app-panel__header">
        <p className="mono">STEP 1 OF 3 · MINT</p>
        <h3 id="live-demo-mint-title">Mint Project Demo Tokens</h3>
        <p>Project demo token. Public mint is enabled for this testnet prototype.</p>
      </div>

      <div className="app-funding__tokens" aria-label="Mint presets">
        {wallet.mintPresets.map((preset) => (
          <button
            className={`app-funding__token${wallet.selectedMintPresetId === preset.id ? " app-funding__token--selected" : ""}`}
            key={preset.id}
            type="button"
            aria-pressed={wallet.selectedMintPresetId === preset.id}
            onClick={() => wallet.selectMintPreset(preset.id)}
          >
            <span>{preset.token.toUpperCase()}</span>
            <strong>{preset.label}</strong>
          </button>
        ))}
      </div>

      <div className="app-state-grid">
        {rows([
          ["SELECTED TOKEN", wallet.selectedMintToken.label],
          ["SELECTED AMOUNT", wallet.selectedMintAmountLabel],
          ["TOKEN ADDRESS", <MonoValue key="addr" value={wallet.selectedMintToken.address} />],
          ["TX HASH", wallet.mintTxHash ? <MonoValue key="tx" value={wallet.mintTxHash} head={10} tail={8} /> : "none"],
          ["RECEIPT STATUS", wallet.mintReceiptStatus]
        ])}
      </div>

      <div className="live-console__actions">
        <button className="button button--primary" type="button" disabled={Boolean(wallet.mintDisabledReason)} onClick={() => void wallet.mintProjectDemoToken()}>
          {wallet.mintPending ? "Minting Project Demo Token" : `Mint ${wallet.selectedMintPreset.label}`}
        </button>
      </div>

      {wallet.mintReceiptStatus === "0x1" && wallet.mintTxHash ? (
        <p className="live-confirm" role="status">
          <span className="app-chip live-chip--confirmed">confirmed</span>
          <strong>Minted {wallet.selectedMintAmountLabel}.</strong>
          <a href={txUrl(wallet.mintTxHash)} target="_blank" rel="noreferrer">View tx {shortAddress(wallet.mintTxHash, 10, 6)}</a>
        </p>
      ) : null}

      {wallet.mintDisabledReason ? <p className="app-funding__notice"><strong>Mint disabled:</strong> {wallet.mintDisabledReason}</p> : null}
      {wallet.mintError ? <p className="app-funding__error">{wallet.mintError}</p> : null}

      <details className="live-console__request-block">
        <summary className="live-console__request-summary mono">Transaction request object</summary>
        <pre className="live-console__request">{wallet.mintTransactionRequest}</pre>
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
