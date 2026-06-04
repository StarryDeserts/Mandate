import type { ReactNode } from "react";
import { formatBps, formatTokenAmount, shortAddress } from "../../../lib/mandate/format";
import MonoValue from "./MonoValue";
import type { LiveWalletState } from "../hooks/useLiveWallet";

type Props = {
  wallet: LiveWalletState;
};

export default function MandatePolicyPanel({ wallet }: Props) {
  const mandate = wallet.mandateConfig;

  return (
    <section className="app-panel" aria-labelledby="live-mandate-policy-title">
      <div className="app-panel__header">
        <p className="mono">MANDATE POLICY</p>
        <h3 id="live-mandate-policy-title">Mandate Policy</h3>
        <p>Read-only onchain policy used before any safe action can be submitted by the session key.</p>
      </div>

      <div className="app-state-grid">
        {rows([
          ["MANDATEACCOUNT", <MonoValue key="acct" value={wallet.mandateAccountAddress} />],
          ["MANDATE VERSION", mandate ? mandate.mandateVersion.toString() : statusLabel(wallet.mandateSessionLoading, wallet.mandateSessionError)],
          ["MAX SINGLE-ASSET EXPOSURE", mandate ? formatBps(mandate.maxSingleAssetExposureBps) : statusLabel(wallet.mandateSessionLoading, wallet.mandateSessionError)],
          ["MAX TRADE SIZE", mandate ? `${formatTokenAmount(mandate.maxTradeSizeUSDG)} USDG` : statusLabel(wallet.mandateSessionLoading, wallet.mandateSessionError)],
          ["MAX DAILY TURNOVER", mandate ? formatBps(mandate.maxDailyTurnoverBps) : statusLabel(wallet.mandateSessionLoading, wallet.mandateSessionError)],
          ["COOLDOWN", mandate ? `${mandate.cooldownSeconds.toString()} seconds` : statusLabel(wallet.mandateSessionLoading, wallet.mandateSessionError)],
          ["ALLOWED ASSETS", wallet.allowedAssets.length ? wallet.allowedAssets.map((asset) => shortAddress(asset)).join(" · ") : statusLabel(wallet.mandateSessionLoading, wallet.mandateSessionError)],
          ["APPROVED ADAPTER", wallet.safeAdapterAllowed === null ? statusLabel(wallet.mandateSessionLoading, wallet.mandateSessionError) : wallet.safeAdapterAllowed ? "yes" : "no"],
          ["REGISTERED PRICE ORACLE", wallet.priceOracle ? shortAddress(wallet.priceOracle) : statusLabel(wallet.mandateSessionLoading, wallet.mandateSessionError)],
          ["ACTION SCHEMA VERSION", wallet.actionSchemaVersion === null ? statusLabel(wallet.mandateSessionLoading, wallet.mandateSessionError) : wallet.actionSchemaVersion.toString()],
          ["NEXT NONCE", wallet.nextNonce === null ? statusLabel(wallet.mandateSessionLoading, wallet.mandateSessionError) : wallet.nextNonce.toString()]
        ])}
      </div>

      <div className="live-console__actions">
        <button className="button button--secondary" type="button" disabled={Boolean(wallet.mandateSessionDisabledReason)} onClick={() => void wallet.refreshMandateSessionReads()}>
          {wallet.mandateSessionLoading ? "Refreshing mandate reads" : "Refresh mandate/session reads"}
        </button>
      </div>

      {wallet.mandateSessionDisabledReason ? <p className="app-funding__notice"><strong>Mandate reads disabled:</strong> {wallet.mandateSessionDisabledReason}</p> : null}
      {wallet.mandateSessionError ? <p className="app-funding__error">{wallet.mandateSessionError}</p> : null}
    </section>
  );
}

function statusLabel(loading: boolean, error: string | null): string {
  if (loading) return "loading";
  if (error) return "read failed";
  return "not loaded";
}

function rows(items: readonly (readonly [string, ReactNode])[]) {
  return items.map(([label, value]) => (
    <div className="app-state-row" key={label}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  ));
}
