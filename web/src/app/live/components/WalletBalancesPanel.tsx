import type { ReactNode } from "react";
import { shortAddress } from "@/lib/mandate/format";
import { formatTokenAmount18 } from "../hooks/liveMintRequests";
import { weiToEthString } from "../hooks/liveWalletRequests";
import type { LiveWalletState } from "../hooks/useLiveWallet";

type Props = {
  wallet: LiveWalletState;
};

export default function WalletBalancesPanel({ wallet }: Props) {
  const nativeLabel = nativeBalanceLabel(wallet.nativeBalance, wallet.nativeBalanceLoading, wallet.nativeBalanceError);

  return (
    <section className="app-panel" aria-labelledby="live-wallet-balances-title">
      <div className="app-panel__header">
        <p className="mono">CONNECTED WALLET ASSETS</p>
        <h3 id="live-wallet-balances-title">Wallet Balances</h3>
        <p>Reads native ETH, wallet token balances, MandateAccount balances, and allowance directly from the wallet provider.</p>
      </div>
      <div className="app-state-grid">
        {rows([
          ["CONNECTED WALLET", wallet.address ? shortAddress(wallet.address) : "not connected"],
          ["Native ETH balance", nativeLabel],
          ...wallet.tokenBalanceRows.map((token) => [token.label, tokenBalanceLabel(token.balance, wallet.tokenBalancesLoading, wallet.tokenBalancesError)] as const)
        ])}
      </div>
      <div className="live-console__actions">
        <button className="button button--secondary" type="button" disabled={Boolean(wallet.refreshBalanceDisabledReason)} onClick={() => void wallet.refreshNativeBalance()}>
          Refresh Balance
        </button>
      </div>
      {wallet.refreshBalanceDisabledReason ? <p className="app-funding__notice"><strong>Refresh disabled:</strong> {wallet.refreshBalanceDisabledReason}</p> : null}
      {wallet.nativeBalanceError ? <p className="app-funding__error">{wallet.nativeBalanceError}</p> : null}
      {wallet.tokenBalancesError ? <p className="app-funding__error">{wallet.tokenBalancesError}</p> : null}
    </section>
  );
}

function nativeBalanceLabel(value: bigint | null, loading: boolean, error: string | null): string {
  if (loading) return "loading";
  if (error) return "read error";
  if (value === null) return "not loaded";
  if (value === 0n) return "0 ETH";
  return weiToEthString(value);
}

function tokenBalanceLabel(value: bigint | null, loading: boolean, error: string | null): string {
  if (loading) return "loading";
  if (error) return "read error";
  if (value === null) return "not loaded";
  return formatTokenAmount18(value);
}

function rows(items: readonly (readonly [string, ReactNode])[]) {
  return items.map(([label, value]) => (
    <div className="app-state-row" key={label}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  ));
}
