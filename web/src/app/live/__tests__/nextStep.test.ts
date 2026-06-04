import { describe, expect, it } from "vitest";
import { ReasonCode } from "@/lib/mandate/reasons";
import { getNextRecommendedStep, type LiveNextStepSnapshot } from "../nextStep";

const readySnapshot: LiveNextStepSnapshot = {
  address: "0x1111111111111111111111111111111111111111",
  isCorrectChain: true,
  selectedTokenBalance: 200n,
  selectedAmount: 100n,
  approvalRequired: false,
  mandateAccountFunded: true,
  mandateVerified: true,
  sessionKeyVerified: true,
  safePreviewCode: null,
  safeExecuted: false,
  dangerousPreviewBlocked: false,
  dangerousBlockedSubmitted: false
};

describe("getNextRecommendedStep", () => {
  it("guides disconnected and wrong-chain wallets first", () => {
    expect(getNextRecommendedStep({ ...readySnapshot, address: null })).toMatchObject({ id: "connect-wallet", status: "pending", title: "Connect wallet" });
    expect(getNextRecommendedStep({ ...readySnapshot, isCorrectChain: false })).toMatchObject({ id: "switch-chain", status: "ready", title: "Switch to Robinhood Chain" });
  });

  it("guides funding, approval, and deposit prerequisites", () => {
    expect(getNextRecommendedStep({ ...readySnapshot, selectedTokenBalance: 0n })).toMatchObject({ id: "mint-demo-assets", status: "ready", title: "Mint project demo tokens" });
    expect(getNextRecommendedStep({ ...readySnapshot, approvalRequired: true })).toMatchObject({ id: "approve-exact-amount", status: "ready", title: "Approve exact deposit amount" });
    expect(getNextRecommendedStep({ ...readySnapshot, mandateAccountFunded: false })).toMatchObject({ id: "deposit-funds", status: "ready", title: "Deposit into MandateAccount" });
  });

  it("guides preview, blocked preview, and safe execution states", () => {
    expect(getNextRecommendedStep(readySnapshot)).toMatchObject({ id: "preview-safe-candidate", status: "ready", title: "Preview small TSLA buy candidate" });
    expect(getNextRecommendedStep({ ...readySnapshot, safePreviewCode: ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED })).toMatchObject({ id: "safe-preview-blocked", status: "blocked", title: "Safe candidate currently blocked" });
    expect(getNextRecommendedStep({ ...readySnapshot, safePreviewCode: ReasonCode.OK })).toMatchObject({ id: "execute-safe-candidate", status: "ready", title: "Execute approved small TSLA buy" });
  });

  it("guides dangerous blocked proof after safe execution", () => {
    expect(getNextRecommendedStep({ ...readySnapshot, safePreviewCode: ReasonCode.OK, safeExecuted: true })).toMatchObject({ id: "safe-executed", status: "confirmed", title: "Safe action executed" });
    expect(getNextRecommendedStep({ ...readySnapshot, safePreviewCode: ReasonCode.OK, safeExecuted: true, dangerousPreviewBlocked: true })).toMatchObject({ id: "submit-blocked-proof", status: "ready", title: "Submit blocked evidence" });
    expect(getNextRecommendedStep({ ...readySnapshot, safePreviewCode: ReasonCode.OK, safeExecuted: true, dangerousPreviewBlocked: true, dangerousBlockedSubmitted: true })).toMatchObject({ id: "complete", status: "evidence", title: "Demo proof complete" });
  });
});
