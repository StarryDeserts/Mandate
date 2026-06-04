import { ReasonCode, humanizeReasonCode } from "@/lib/mandate/reasons";

export type LiveNextStepStatus = "pending" | "ready" | "confirmed" | "blocked" | "evidence";

export type LiveNextRecommendedStep = {
  id: string;
  status: LiveNextStepStatus;
  title: string;
  summary: string;
};

export type LiveNextStepSnapshot = {
  address: string | null;
  isCorrectChain: boolean;
  selectedTokenBalance: bigint | null;
  selectedAmount: bigint;
  approvalRequired: boolean | null;
  mandateAccountFunded: boolean;
  mandateVerified: boolean;
  sessionKeyVerified: boolean;
  safePreviewCode: number | null;
  safeExecuted: boolean;
  dangerousPreviewBlocked: boolean;
  dangerousBlockedSubmitted: boolean;
};

export function getNextRecommendedStep(snapshot: LiveNextStepSnapshot): LiveNextRecommendedStep {
  if (!snapshot.address) {
    return {
      id: "connect-wallet",
      status: "pending",
      title: "Connect wallet",
      summary: "Connect the user funding wallet to start the live Mandate flow."
    };
  }

  if (!snapshot.isCorrectChain) {
    return {
      id: "switch-chain",
      status: "ready",
      title: "Switch to Robinhood Chain",
      summary: "Switch the connected wallet to Robinhood Chain testnet before sending demo transactions."
    };
  }

  if (snapshot.selectedTokenBalance === null || snapshot.selectedTokenBalance < snapshot.selectedAmount) {
    return {
      id: "mint-demo-assets",
      status: "ready",
      title: "Mint project demo tokens",
      summary: "Mint enough project demo tokens for the selected deposit preset."
    };
  }

  if (snapshot.approvalRequired !== false) {
    return {
      id: "approve-exact-amount",
      status: "ready",
      title: "Approve exact deposit amount",
      summary: "Approve only the selected amount for MandateAccount deposit."
    };
  }

  if (!snapshot.mandateAccountFunded) {
    return {
      id: "deposit-funds",
      status: "ready",
      title: "Deposit into MandateAccount",
      summary: "Move funds into MandateAccount so the agent can act without custody."
    };
  }

  if (!snapshot.mandateVerified || !snapshot.sessionKeyVerified) {
    return {
      id: "verify-mandate-session",
      status: "ready",
      title: "Verify mandate and session key",
      summary: "Refresh policy and session authority before previewing an agent action."
    };
  }

  if (snapshot.safePreviewCode === null) {
    return {
      id: "preview-safe-candidate",
      status: "ready",
      title: "Preview small TSLA buy candidate",
      summary: "Send the small TSLA buy candidate to Mandate preview before execution."
    };
  }

  if (snapshot.safePreviewCode !== ReasonCode.OK) {
    return {
      id: "safe-preview-blocked",
      status: "blocked",
      title: "Safe candidate currently blocked",
      summary: humanizeReasonCode(snapshot.safePreviewCode)
    };
  }

  if (!snapshot.safeExecuted) {
    return {
      id: "execute-safe-candidate",
      status: "ready",
      title: "Execute approved small TSLA buy",
      summary: "Mandate preview returned OK. Execute only this approved candidate through the demo agent relayer."
    };
  }

  if (!snapshot.dangerousPreviewBlocked) {
    return {
      id: "safe-executed",
      status: "confirmed",
      title: "Safe action executed",
      summary: "Safe execution is confirmed. Next, prove the boundary by previewing the dangerous candidate."
    };
  }

  if (!snapshot.dangerousBlockedSubmitted) {
    return {
      id: "submit-blocked-proof",
      status: "ready",
      title: "Submit blocked evidence",
      summary: "The dangerous candidate is blocked. Submit blocked evidence without exposing any execute path."
    };
  }

  return {
    id: "complete",
    status: "evidence",
    title: "Demo proof complete",
    summary: "Mint, deposit, safe execution, and dangerous blocked evidence are recorded."
  };
}
