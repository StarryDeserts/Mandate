import type { ReactNode } from "react";
import { formatUnixTime, shortAddress } from "../../../lib/mandate/format";
import type { MandateDeployment } from "../../../lib/mandate/types";
import type { LiveWalletState } from "../hooks/useLiveWallet";

type Props = {
  wallet: LiveWalletState;
  deployment: MandateDeployment;
};

export default function SessionAuthorityPanel({ wallet, deployment }: Props) {
  const sessionKey = wallet.sessionAuthority?.sessionKey;
  const connectedIsSessionKey = wallet.address ? wallet.address.toLowerCase() === deployment.sessionKey.toLowerCase() : false;

  return (
    <section className="app-panel" aria-labelledby="live-session-authority-title">
      <div className="app-panel__header">
        <p className="mono">SESSION AUTHORITY</p>
        <h3 id="live-session-authority-title">Session Authority</h3>
        <p>The session key is an actor, not the custodian.</p>
      </div>

      <div className="app-state-grid">
        {rows([
          ["DEFAULT SESSION KEY", shortAddress(deployment.sessionKey)],
          ["CONNECTED WALLET", wallet.address ? shortAddress(wallet.address) : "not connected"],
          ["CONNECTED ROLE", wallet.connectedRoleLabel],
          ["SESSION KEY ROLE", wallet.sessionKeyRoleLabel],
          ["SESSION KEY ENABLED", sessionKey ? (sessionKey.enabled ? "yes" : "no") : statusLabel(wallet.mandateSessionLoading, wallet.mandateSessionError)],
          ["VALID UNTIL", sessionKey ? formatUnixTime(sessionKey.validUntil) : statusLabel(wallet.mandateSessionLoading, wallet.mandateSessionError)],
          ["CONNECTED IS SESSION KEY", connectedIsSessionKey ? "yes" : "no"]
        ])}
      </div>

      <div className="app-state-grid">
        {rows([
          ["CAN", "propose policy-checked actions"],
          ["CAN", "submit allowed demo actions"],
          ["CANNOT", "bypass exposure cap"],
          ["CANNOT", "withdraw freely"],
          ["CANNOT", "use unapproved assets"],
          ["CANNOT", "execute blocked actions"]
        ])}
      </div>

      {!connectedIsSessionKey ? <p className="app-funding__notice">Connect the default session key wallet for live agent actions.</p> : null}
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
  return items.map(([label, value], index) => (
    <div className="app-state-row" key={`${label}-${index}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  ));
}
