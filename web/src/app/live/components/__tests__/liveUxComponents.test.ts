import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LiveActivityItem } from "../../activity";
import type { LiveNextRecommendedStep } from "../../nextStep";
import type { LiveWalletState } from "../../hooks/useLiveWallet";
import LiveActivityFeed from "../LiveActivityFeed";
import LiveResultSummaryCards from "../LiveResultSummaryCards";
import NextRecommendedStepBanner from "../NextRecommendedStepBanner";
import WalletDebugPanel from "../WalletDebugPanel";

const submitHash = "0x3333333333333333333333333333333333333333333333333333333333333333" as const;
const executeHash = "0x4444444444444444444444444444444444444444444444444444444444444444" as const;
const blockedHash = "0x5555555555555555555555555555555555555555555555555555555555555555" as const;

const step: LiveNextRecommendedStep = {
  id: "preview-safe-candidate",
  status: "ready",
  title: "Preview small TSLA buy candidate",
  summary: "Send the small TSLA buy candidate to Mandate preview before execution."
};

const activityItems: LiveActivityItem[] = [
  {
    id: "deposit-1",
    type: "deposit",
    title: "Deposit confirmed",
    status: "confirmed",
    summary: "Deposited 200 USDG into MandateAccount.",
    timestamp: 1000,
    txHash: submitHash,
    balanceDelta: "-200 USDG wallet / +200 USDG MandateAccount"
  },
  {
    id: "dangerous-1",
    type: "dangerous",
    title: "Dangerous action blocked",
    status: "blocked",
    summary: "Mandate blocked the aggressive TSLA increase. Funds moved: no.",
    timestamp: 1001,
    txHash: blockedHash,
    reason: "SINGLE_ASSET_EXPOSURE_EXCEEDED"
  }
];

function wallet(overrides: Partial<LiveWalletState> = {}): LiveWalletState {
  return {
    selectedMintToken: { token: "usdg", label: "USDG", address: "0x1111111111111111111111111111111111111111" },
    selectedMintAmountLabel: "200 USDG",
    depositTxHash: submitHash,
    depositReceiptStatus: "0x1",
    safeSubmitTxHash: submitHash,
    safeExecuteTxHash: executeHash,
    safeDecisionStatusLabel: "EXECUTED",
    dangerousActionResult: {
      ok: true,
      kind: "dangerous",
      actionId: "0x2222222222222222222222222222222222222222222222222222222222222222",
      preview: { code: 3, preExposureBps: 3200, postExposureBps: 7000 },
      previewReason: "SINGLE_ASSET_EXPOSURE_EXCEEDED",
      submitTxHash: blockedHash,
      submitReceiptStatus: "success",
      decisionStatus: "BLOCKED",
      blockedReason: "SINGLE_ASSET_EXPOSURE_EXCEEDED"
    },
    safePreviewStatusLabel: "OK",
    safeActionStep: "executed",
    debug: {
      connectedAddress: "0x1111111111111111111111111111111111111111",
      chainId: "46630",
      walletClientPresent: "direct window.ethereum provider",
      publicClientPresent: "not used in direct Stage F",
      selectedToken: "USDG",
      selectedAmount: "200",
      lastClickedButton: "Deposit into MandateAccount",
      lastHandlerEntered: "depositIntoMandateAccount",
      lastRequestMethod: "eth_sendTransaction",
      lastRequestStatus: "request succeeded",
      lastRequestError: "none",
      lastTransactionRequest: "{}",
      lastApprovalSpender: "0x2222222222222222222222222222222222222222",
      lastApprovalRequest: "{}",
      lastApprovalResult: "confirmed",
      lastApprovalError: "none",
      lastDepositMandateAccount: "0x3333333333333333333333333333333333333333",
      lastDepositRequest: "{}",
      lastDepositResult: "confirmed",
      lastDepositError: "none",
      lastSimulationStart: "safe preview started",
      lastSimulationResult: "safe preview OK",
      lastSimulationError: "none",
      lastWriteStart: "awaiting signature",
      lastWriteResult: "safe action executed",
      lastWriteError: "none",
      lastTxHash: executeHash,
      lastReceiptStatus: "success"
    },
    ...overrides
  } as LiveWalletState;
}

describe("live UX components", () => {
  it("renders next-step guidance, result summaries, activity, and collapsed diagnostics", () => {
    const html = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement(NextRecommendedStepBanner, { step }),
        createElement(LiveResultSummaryCards, { wallet: wallet() }),
        createElement(LiveActivityFeed, { items: activityItems, onClear: () => undefined }),
        createElement(WalletDebugPanel, { wallet: wallet() })
      )
    );

    expect(html).toContain("Next recommended step");
    expect(html).toContain("Preview small TSLA buy candidate");
    expect(html).toContain("Deposit confirmed");
    expect(html).toContain("Safe action executed");
    expect(html).toContain("Dangerous action blocked");
    expect(html).toContain("Funds moved: no");
    expect(html).toContain("Clear activity");
    expect(html).toContain("Copy tx hash");
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).not.toContain("<details open");
  });

  it("hides result summaries until matching transactions exist", () => {
    const html = renderToStaticMarkup(
      createElement(LiveResultSummaryCards, {
        wallet: wallet({ depositTxHash: null, safeSubmitTxHash: null, safeExecuteTxHash: null, dangerousActionResult: null })
      })
    );

    expect(html).not.toContain("Deposit confirmed");
    expect(html).not.toContain("Safe action executed");
    expect(html).not.toContain("Dangerous action blocked");
  });
});
