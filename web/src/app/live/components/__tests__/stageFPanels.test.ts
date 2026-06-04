import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getMandateDeployment } from "../../../../lib/mandate/deployment";
import { DecisionStatus, ReasonCode, Role } from "../../../../lib/mandate/reasons";
import type { LiveWalletState } from "../../hooks/useLiveWallet";
import DangerousBlockedPanel from "../DangerousBlockedPanel";
import MandatePolicyPanel from "../MandatePolicyPanel";
import SafeActionPreviewPanel from "../SafeActionPreviewPanel";
import SafeExecutionPanel from "../SafeExecutionPanel";
import SessionAuthorityPanel from "../SessionAuthorityPanel";

const deployment = getMandateDeployment();

function wallet(overrides: Partial<LiveWalletState> = {}): LiveWalletState {
  return {
    mandateAccountAddress: deployment.contracts.mandateAccount,
    mandateConfig: {
      mandateVersion: 1n,
      maxSingleAssetExposureBps: 3500,
      maxTradeSizeUSDG: 200_000_000_000_000_000_000n,
      maxDailyTurnoverBps: 2000,
      cooldownSeconds: 0n
    },
    allowedAssets: [deployment.contracts.usdg, deployment.contracts.tsla, deployment.contracts.amd],
    safeAdapterAllowed: true,
    priceOracle: deployment.contracts.priceFeed,
    actionSchemaVersion: 1,
    nextNonce: 7n,
    sessionAuthority: {
      connectedRole: Role.SESSION,
      sessionKeyRole: Role.SESSION,
      sessionKey: {
        enabled: true,
        validUntil: 4_102_444_800n,
        allowedActionTypes: 0,
        maxAmountInPerAction: 0n,
        scopeHash: "0x0000000000000000000000000000000000000000000000000000000000000000"
      }
    },
    connectedRoleLabel: "SESSION",
    sessionKeyRoleLabel: "SESSION",
    mandateSessionLoading: false,
    mandateSessionError: null,
    mandateSessionDisabledReason: null,
    refreshMandateSessionReads: async () => undefined,
    safeAction: {
      actionSchemaVersion: 1,
      account: deployment.contracts.mandateAccount,
      nonce: 7n,
      actionType: 0,
      assetIn: deployment.contracts.usdg,
      amountIn: 48_000_000_000_000_000_000n,
      assetOut: deployment.contracts.tsla,
      minAmountOut: 0n,
      adapter: deployment.contracts.adapter,
      recipient: deployment.contracts.mandateAccount,
      deadline: 1_700_001_200n
    },
    safeActionAmountLabel: "48 USDG",
    priceRows: [{ asset: deployment.contracts.tsla, priceUSDG1e18: 2_000_000_000_000_000_000n, timestamp: 1_700_000_000n, validUntil: 1_700_003_600n, signature: "0x1234" as `0x${string}` }],
    priceRowsLoading: false,
    priceRowsError: null,
    priceConfigError: null,
    safePreview: { code: ReasonCode.OK, preExposureBps: 3200, postExposureBps: 3300 },
    safePreviewStatusLabel: "OK",
    safePreviewLoading: false,
    safePreviewError: null,
    safePreviewDisabledReason: null,
    refreshSafeActionPreview: async () => undefined,
    safeExecuteDisabledReason: null,
    agentRelayerDisabledReason: null,
    safeActionPending: false,
    safeActionStep: "idle",
    safeActionError: null,
    safeActionId: "0x1111111111111111111111111111111111111111111111111111111111111111",
    safeDecision: {
      status: DecisionStatus.APPROVED,
      mandateVersion: 1n,
      submittedAt: 1_700_000_000n,
      expiresAt: 1_700_001_200n,
      priceDigest: "0x2222222222222222222222222222222222222222222222222222222222222222",
      priceTimestamp: 1_700_000_000n
    },
    safeDecisionStatusLabel: "APPROVED",
    safeSubmitSimulation: {
      actionId: "0x1111111111111111111111111111111111111111111111111111111111111111",
      code: ReasonCode.OK,
      preExposureBps: 3200,
      postExposureBps: 3300
    },
    safeSubmitTxHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
    safeSubmitReceiptStatus: "0x1",
    safeSubmitTransactionRequest: "submit request",
    safeExecuteTxHash: null,
    safeExecuteReceiptStatus: "none",
    safeExecuteTransactionRequest: "none",
    executeSafeAction: async () => undefined,
    runAgentSafeAction: async () => undefined,
    dangerousActionPending: false,
    dangerousActionError: null,
    dangerousActionDisabledReason: null,
    dangerousActionResult: {
      ok: true,
      kind: "dangerous",
      actionId: "0x4444444444444444444444444444444444444444444444444444444444444444",
      preview: { code: ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED, preExposureBps: 3200, postExposureBps: 7000 },
      previewReason: "SINGLE_ASSET_EXPOSURE_EXCEEDED",
      submitTxHash: "0x5555555555555555555555555555555555555555555555555555555555555555",
      submitReceiptStatus: "success",
      decisionStatus: "BLOCKED",
      blockedReason: "SINGLE_ASSET_EXPOSURE_EXCEEDED"
    },
    runAgentDangerousAction: async () => undefined,
    ...overrides
  } as LiveWalletState;
}

describe("Stage F live panels", () => {
  it("renders mandate/session reads and demo agent relayer panels without dangerous execution UI", () => {
    const html = renderToStaticMarkup(
      createElement(
        Fragment,
        null,
        createElement(MandatePolicyPanel, { wallet: wallet() }),
        createElement(SessionAuthorityPanel, { wallet: wallet(), deployment }),
        createElement(SafeActionPreviewPanel, { wallet: wallet() }),
        createElement(SafeExecutionPanel, { wallet: wallet() }),
        createElement(DangerousBlockedPanel, { wallet: wallet() })
      )
    );

    expect(html).toContain("Mandate Policy");
    expect(html).toContain("Session Authority");
    expect(html).toContain("Small TSLA Buy Preview");
    expect(html).toContain("Small TSLA Buy Execution");
    expect(html).toContain("Dangerous Blocked Action");
    expect(html).toContain("The session key is an actor, not the custodian.");
    expect(html).toContain("Demo agent relayer uses the configured server-side session key.");
    expect(html).toContain("User wallet funds MandateAccount. Demo agent holds the session key. Mandate enforces policy before funds move.");
    expect(html).toContain("Preview small TSLA buy");
    expect(html).toContain("Agent submit and execute approved candidate");
    expect(html).toContain("Agent submit blocked test action");
    expect(html).not.toContain("Execute dangerous");
    expect(html).not.toContain(`Submit and execute ${"dangerous"}`);
  });
});
