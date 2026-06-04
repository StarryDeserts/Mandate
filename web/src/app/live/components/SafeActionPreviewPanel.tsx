import type { ReactNode } from "react";
import { formatBps, formatUnixTime, shortAddress } from "../../../lib/mandate/format";
import { ReasonCode, humanizeReasonCode } from "../../../lib/mandate/reasons";
import type { LiveWalletState } from "../hooks/useLiveWallet";

type Props = {
  wallet: LiveWalletState;
};

export default function SafeActionPreviewPanel({ wallet }: Props) {
  const action = wallet.safeAction;
  const preview = wallet.safePreview;
  const latestPriceTimestamp = wallet.priceRows?.reduce<bigint | null>((latest, row) => (latest === null || row.timestamp > latest ? row.timestamp : latest), null) ?? null;

  return (
    <section className="app-panel" aria-labelledby="live-safe-preview-title">
      <div className="app-panel__header">
        <p className="mono">PREVIEW</p>
        <h3 id="live-safe-preview-title">Small TSLA Buy Preview</h3>
        <p>The agent can propose, but Mandate decides. Executable only if Mandate preview returns OK.</p>
      </div>

      <div className="app-state-grid">
        {rows([
          ["CANDIDATE", "48 USDG → TSLA"],
          ["ACTION AMOUNT", wallet.safeActionAmountLabel],
          ["ASSET IN", action ? shortAddress(action.assetIn) : "not ready"],
          ["ASSET OUT", action ? shortAddress(action.assetOut) : "not ready"],
          ["ADAPTER", action ? shortAddress(action.adapter) : "not ready"],
          ["NONCE", action ? action.nonce.toString() : wallet.nextNonce === null ? "not loaded" : wallet.nextNonce.toString()],
          ["PRICE ROWS", priceRowsLabel(wallet)],
          ["PRICE TIMESTAMP", latestPriceTimestamp === null ? "not loaded" : formatUnixTime(latestPriceTimestamp)],
          ["PREVIEW STATUS", previewStatusLabel(wallet)],
          ["PRE EXPOSURE", preview ? formatBps(preview.preExposureBps) : "not previewed"],
          ["POST EXPOSURE", preview ? formatBps(preview.postExposureBps) : "not previewed"],
          ["MAX EXPOSURE", wallet.mandateConfig ? formatBps(wallet.mandateConfig.maxSingleAssetExposureBps) : "not loaded"]
        ])}
      </div>

      <div className="live-console__actions">
        <button className="button button--primary" type="button" disabled={Boolean(wallet.safePreviewDisabledReason)} onClick={() => void wallet.refreshSafeActionPreview()}>
          {wallet.safePreviewLoading ? "Previewing small TSLA buy" : "Preview small TSLA buy"}
        </button>
      </div>

      {preview && preview.code !== ReasonCode.OK ? <p className="app-funding__notice">Currently blocked under live portfolio state. {humanizeReasonCode(preview.code)}</p> : null}
      {wallet.priceConfigError ? <p className="app-funding__notice"><strong>Price config:</strong> {wallet.priceConfigError}</p> : null}
      {wallet.safePreviewDisabledReason ? <p className="app-funding__notice"><strong>Preview disabled:</strong> {wallet.safePreviewDisabledReason}</p> : null}
      {wallet.priceRowsError ? <p className="app-funding__error">{wallet.priceRowsError}</p> : null}
      {wallet.safePreviewError ? <p className="app-funding__error">{wallet.safePreviewError}</p> : null}
    </section>
  );
}

function priceRowsLabel(wallet: LiveWalletState): string {
  if (wallet.priceRowsLoading) return "loading";
  if (wallet.priceRowsError) return "read failed";
  if (!wallet.priceRows) return "not loaded";
  return `${wallet.priceRows.length} signed rows`;
}

function previewStatusLabel(wallet: LiveWalletState): string {
  if (wallet.safePreviewLoading) return "previewing";
  if (wallet.safePreviewError) return "preview failed";
  return wallet.safePreviewStatusLabel;
}

function rows(items: readonly (readonly [string, ReactNode])[]) {
  return items.map(([label, value]) => (
    <div className="app-state-row" key={label}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  ));
}
