"use client";

import type { ReactNode } from "react";
import type { MandateDeployment } from "@/lib/mandate/types";
import DangerousBlockedPanel from "./components/DangerousBlockedPanel";
import DemoTokenMintPanel from "./components/DemoTokenMintPanel";
import DepositIntoMandateAccountPanel from "./components/DepositIntoMandateAccountPanel";
import ExactApprovalPanel from "./components/ExactApprovalPanel";
import LiveActivityFeed from "./components/LiveActivityFeed";
import LiveResultSummaryCards from "./components/LiveResultSummaryCards";
import LiveTopbar from "./components/LiveTopbar";
import MandateAccountBalancesPanel from "./components/MandateAccountBalancesPanel";
import MandatePolicyPanel from "./components/MandatePolicyPanel";
import MonoValue from "./components/MonoValue";
import NextRecommendedStepBanner from "./components/NextRecommendedStepBanner";
import SafeActionPreviewPanel from "./components/SafeActionPreviewPanel";
import SafeExecutionPanel from "./components/SafeExecutionPanel";
import SessionAuthorityPanel from "./components/SessionAuthorityPanel";
import WalletBalancesPanel from "./components/WalletBalancesPanel";
import WalletDebugPanel from "./components/WalletDebugPanel";
import { useLiveWallet } from "./hooks/useLiveWallet";
import { getNextRecommendedStep } from "./nextStep";

export default function LiveConsoleClient({ deployment }: { deployment: MandateDeployment }) {
  const wallet = useLiveWallet(deployment);
  const nextStep = getNextRecommendedStep({
    address: wallet.address,
    isCorrectChain: wallet.isCorrectChain,
    selectedTokenBalance: wallet.selectedTokenBalance,
    selectedAmount: wallet.selectedMintAmount,
    approvalRequired: wallet.approvalRequired,
    mandateAccountFunded: wallet.mandateAccountBalanceRows.some((row) => (row.balance ?? 0n) > 0n),
    mandateVerified: Boolean(wallet.mandateConfig && wallet.allowedAssets.length > 0 && wallet.safeAdapterAllowed !== null && wallet.priceOracle),
    sessionKeyVerified: Boolean(wallet.sessionAuthority?.sessionKey.enabled),
    safePreviewCode: wallet.safePreview?.code ?? null,
    safeExecuted: wallet.safeActionStep === "executed" || wallet.safeDecisionStatusLabel === "EXECUTED" || Boolean(wallet.safeExecuteTxHash),
    dangerousPreviewBlocked: Boolean(wallet.dangerousActionResult),
    dangerousBlockedSubmitted: Boolean(wallet.dangerousActionResult?.submitTxHash)
  });

  return (
    <main className="live-console">
      <LiveTopbar address={wallet.address} chainId={wallet.chainId} expectedChainId={wallet.expectedChainId} />
      <div className="live-console__inner">
        <section className="app-console__intro" aria-labelledby="live-console-title">
          <p className="mono">WALLET FOUNDATION</p>
          <h1 id="live-console-title">Wallet-first Mandate live demo</h1>
          <p>Relayer mode — your wallet funds the MandateAccount, then a server-side demo agent submits a fixed safe or blocked action using the configured session key.</p>
          {wallet.configError ? <p className="app-funding__error">{wallet.configError}</p> : null}
          {wallet.operationError ? <p className="app-funding__error">{wallet.operationError}</p> : null}
          <div className="live-console__actions">
            <button className="button button--primary" type="button" disabled={Boolean(wallet.connectDisabledReason)} onClick={() => void wallet.connectWallet()}>
              {wallet.connectPending ? "Connecting Wallet" : "Connect Wallet"}
            </button>
            <button className="button button--secondary" type="button" disabled={Boolean(wallet.switchChainDisabledReason)} onClick={() => void wallet.switchToRobinhoodChain()}>
              {wallet.switchPending ? "Switching Network" : "Switch to Robinhood Chain"}
            </button>
          </div>
          <div className="live-console__reasons" aria-live="polite">
            {wallet.connectDisabledReason ? <p className="app-funding__notice"><strong>Connect disabled:</strong> {wallet.connectDisabledReason}</p> : null}
            {wallet.switchChainDisabledReason ? <p className="app-funding__notice"><strong>Switch disabled:</strong> {wallet.switchChainDisabledReason}</p> : null}
          </div>
        </section>

        <NextRecommendedStepBanner step={nextStep} />

        <Zone
          id="live-zone-funding"
          eyebrow="FUNDING"
          title="Fund the MandateAccount"
          description="Mint demo tokens, grant an exact approval, and deposit into the policy-controlled account."
        >
          <WalletBalancesPanel wallet={wallet} />
          <DemoTokenMintPanel wallet={wallet} />
          <ExactApprovalPanel wallet={wallet} />
          <DepositIntoMandateAccountPanel wallet={wallet} />
          <MandateAccountBalancesPanel wallet={wallet} />
        </Zone>

        <Zone
          id="live-zone-agent"
          eyebrow="AGENT ACTION"
          title="Agent acts under Mandate policy"
          description="The demo agent previews against live policy, then submits and executes only an approved candidate through the session key."
        >
          <MandatePolicyPanel wallet={wallet} />
          <SessionAuthorityPanel wallet={wallet} deployment={deployment} />
          <SafeActionPreviewPanel wallet={wallet} />
          <SafeExecutionPanel wallet={wallet} />
        </Zone>

        <Zone
          id="live-zone-blocked"
          eyebrow="BLOCKED-ACTION PROOF"
          title="Mandate blocks an over-limit action"
          description="The same agent submits an out-of-policy action; Mandate blocks it and execution is never exposed."
        >
          <DangerousBlockedPanel wallet={wallet} />
        </Zone>

        <Zone
          id="live-zone-evidence"
          eyebrow="EVIDENCE"
          title="Results and activity"
          description="Confirmed outcomes and the persisted activity trail for this session."
        >
          <LiveResultSummaryCards wallet={wallet} />
          <LiveActivityFeed items={wallet.activityItems} onClear={wallet.clearActivityItems} />
        </Zone>

        <Zone
          id="live-zone-diagnostics"
          eyebrow="DIAGNOSTICS"
          title="Diagnostics and boundaries"
          description="Raw wallet reads and the server-side session-key boundary. Optional reference for inspection."
          variant="muted"
        >
          <WalletDebugPanel wallet={wallet} />
          <section className="app-panel" aria-labelledby="live-stage-boundary-title">
            <div className="app-panel__header">
              <p className="mono">SERVER-SIDE SESSION KEY BOUNDARY</p>
              <h3 id="live-stage-boundary-title">Demo agent relayer</h3>
              <p>The browser never receives the session key private key. The relayer accepts only the fixed safe or dangerous demo action kind.</p>
            </div>
            <div className="app-state-grid">
              <div className="app-state-row"><span>MANDATEACCOUNT</span><strong><MonoValue value={deployment.contracts.mandateAccount} /></strong></div>
              <div className="app-state-row"><span>DEFAULT SESSION KEY</span><strong><MonoValue value={deployment.sessionKey} /></strong></div>
            </div>
          </section>
        </Zone>
      </div>
    </main>
  );
}

function Zone({
  id,
  eyebrow,
  title,
  description,
  variant,
  children
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  variant?: "muted";
  children: ReactNode;
}) {
  return (
    <section className={`live-zone${variant ? ` live-zone--${variant}` : ""}`} aria-labelledby={`${id}-title`}>
      <header className="live-zone__head">
        <p className="live-zone__eyebrow mono">{eyebrow}</p>
        <h2 className="live-zone__title" id={`${id}-title`}>{title}</h2>
        <p className="live-zone__desc">{description}</p>
      </header>
      {children}
    </section>
  );
}
