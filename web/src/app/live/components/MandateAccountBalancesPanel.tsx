import type { ReactNode } from "react";
import MonoValue from "./MonoValue";
import { formatTokenAmount18 } from "../hooks/liveMintRequests";
import type { LiveWalletState } from "../hooks/useLiveWallet";

type Props = {
  wallet: LiveWalletState;
};

export default function MandateAccountBalancesPanel({ wallet }: Props) {
  return (
    <section className="app-panel" aria-labelledby="live-mandate-balances-title">
      <div className="app-panel__header">
        <p className="mono">MANDATEACCOUNT BALANCES</p>
        <h3 id="live-mandate-balances-title">MandateAccount Balances</h3>
        <p>Funds are held by MandateAccount, not by the agent.</p>
      </div>
      <div className="app-state-grid">
        {rows([
          ["MANDATEACCOUNT", <MonoValue key="acct" value={wallet.mandateAccountAddress} />],
          ...wallet.mandateAccountBalanceRows.map((token) => [token.label, mandateBalanceLabel(token.balance, wallet.mandateAccountBalancesLoading, wallet.mandateAccountBalancesError)] as const)
        ])}
      </div>
      <p className="app-funding__notice">Funding changes the exposure baseline. Preview again before executing any agent action.</p>
      {wallet.mandateAccountBalancesError ? <p className="app-funding__error">{wallet.mandateAccountBalancesError}</p> : null}
    </section>
  );
}

function mandateBalanceLabel(value: bigint | null, loading: boolean, error: string | null): string {
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
