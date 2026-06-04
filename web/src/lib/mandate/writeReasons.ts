import type { Address } from "viem";
import { ReasonCode, reasonLabel } from "./reasons";

export type FundingActionKind = "mint" | "approve" | "deposit";

export type FundingActionReasonPreset = {
  parsedAmount?: bigint;
  walletBalance?: bigint;
  allowance?: bigint;
  insufficientBalance: boolean;
  needsApproval: boolean;
};

export type FundingActionDisabledReasonInput = {
  action: FundingActionKind;
  pending: boolean;
  enabled: boolean;
  isConnected: boolean;
  isCorrectChain: boolean;
  walletAddress?: Address;
  publicClientReady: boolean;
  walletClientReady: boolean;
  selected?: FundingActionReasonPreset | null;
};

export function fundingActionDisabledReason({
  action,
  pending,
  enabled,
  isConnected,
  isCorrectChain,
  walletAddress,
  publicClientReady,
  walletClientReady,
  selected
}: FundingActionDisabledReasonInput): string | null {
  if (pending) return "Transaction already pending.";
  if (!isConnected) return "Connect a wallet from the topbar first.";
  if (!isCorrectChain) return "Switch to Robinhood Chain testnet before writing.";
  if (!enabled) return "Public Robinhood RPC is not configured for browser writes.";
  if (!walletAddress) return "Wallet address is not available yet.";
  if (!publicClientReady) return "Public RPC client is not ready.";
  if (!walletClientReady) return "Wallet client is not ready.";
  if (!selected) return "Select a funding preset first.";
  if (selected.parsedAmount === undefined) return "Token decimals are still loading.";

  if (action === "approve") {
    if (selected.allowance === undefined) return "Allowance is still loading.";
    if (!selected.needsApproval) return "Exact approval is already ready for this selected amount.";
  }

  if (action === "deposit") {
    if (selected.walletBalance === undefined) return "Wallet token balance is still loading.";
    if (selected.insufficientBalance) return "Mint project demo tokens first or select an amount covered by the wallet balance.";
    if (selected.allowance === undefined) return "Allowance is still loading.";
    if (selected.needsApproval) return "Approve the exact selected amount before depositing.";
  }

  return null;
}

export type SafeActionFlowStep = "idle" | "submitting" | "approved" | "executing" | "executed" | "error";

export type SafeActionDisabledReasonInput = {
  step: SafeActionFlowStep;
  canWrite: boolean;
  writeDisabledReason?: string | null;
  publicClientReady: boolean;
  walletClientReady: boolean;
  safeActionReady: boolean;
  pricesReady: boolean;
  safePreviewCode?: number;
};

export function safeActionDisabledReason({
  step,
  canWrite,
  writeDisabledReason,
  publicClientReady,
  walletClientReady,
  safeActionReady,
  pricesReady,
  safePreviewCode
}: SafeActionDisabledReasonInput): string | null {
  if (step === "submitting" || step === "executing") return "Safe action transaction is already pending.";
  if (step === "executed") return "Safe action has already executed.";
  if (!canWrite) return writeDisabledReason ?? "Connect the registered session-key wallet before executing agent actions.";
  if (!publicClientReady) return "Public RPC client is not ready.";
  if (!walletClientReady) return "Wallet client is not ready.";
  if (!safeActionReady) return "Safe action is not ready to submit.";
  if (!pricesReady) return "Price data is still loading.";
  if (safePreviewCode === undefined) return "Live safe preview is not ready yet.";
  if (safePreviewCode !== ReasonCode.OK) return `Safe preview is ${reasonLabel(safePreviewCode)}, not OK.`;
  return null;
}
