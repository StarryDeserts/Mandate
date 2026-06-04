import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { DecisionStatus, ReasonCode, Role } from "../reasons";
import { getMandateDeployment } from "../deployment";
import { parseDemoAgentActionRequest, runDemoAgentAction, type DemoAgentDependencies } from "../demoAgentRelayer";

const matchingPrivateKey = "0x0000000000000000000000000000000000000000000000000000000000000001" as const;
const mismatchPrivateKey = "0x0000000000000000000000000000000000000000000000000000000000000002" as const;
const matchingSessionKey = privateKeyToAccount(matchingPrivateKey).address;

function deploymentFixture() {
  return { ...getMandateDeployment(), sessionKey: matchingSessionKey };
}

function dependencies({
  previewCode = ReasonCode.OK,
  decisionStatus = DecisionStatus.APPROVED,
  decisionStatuses,
  sessionKeyRead = { enabled: true, validUntil: 4_102_444_800n, allowedActionTypes: 0, maxAmountInPerAction: 0n, scopeHash: "0x0000000000000000000000000000000000000000000000000000000000000000" }
}: {
  previewCode?: number;
  decisionStatus?: number;
  decisionStatuses?: number[];
  sessionKeyRead?: unknown;
} = {}): DemoAgentDependencies {
  const writes: string[] = [];
  let decisionReadIndex = 0;
  return {
    writes,
    priceRows: async () => [
      { asset: deploymentFixture().contracts.tsla, priceUSDG1e18: 2_000_000_000_000_000_000n, timestamp: 1_700_000_000n, validUntil: 1_700_003_600n, signature: "0x1234" as `0x${string}` }
    ],
    publicClient: {
      getChainId: async () => 46630,
      readContract: async ({ functionName }: { functionName: string }) => {
        if (functionName === "ACTION_SCHEMA_VERSION") return 1;
        if (functionName === "nextNonce") return 7n;
        if (functionName === "roleOf") return Role.SESSION;
        if (functionName === "sessionKeys") return sessionKeyRead;
        if (functionName === "previewAction") return { code: previewCode, preExposureBps: 3200, postExposureBps: 3600 };
        if (functionName === "computeActionId") return "0x1111111111111111111111111111111111111111111111111111111111111111";
        if (functionName === "decisions") {
          const statuses = decisionStatuses ?? [decisionStatus];
          const status = statuses[Math.min(decisionReadIndex, statuses.length - 1)];
          decisionReadIndex += 1;
          return { status, mandateVersion: 1n, submittedAt: 1_700_000_000n, expiresAt: 1_700_001_200n, priceDigest: "0x2222222222222222222222222222222222222222222222222222222222222222", priceTimestamp: 1_700_000_000n };
        }
        throw new Error(`unexpected read ${functionName}`);
      },
      waitForTransactionReceipt: async () => ({ status: "success" })
    },
    walletClient: {
      writeContract: async ({ functionName }: { functionName: string }) => {
        writes.push(functionName);
        return `0x${functionName.padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
      }
    }
  } as DemoAgentDependencies;
}

describe("demo agent relayer", () => {
  it("fails closed when the private key does not match the deployment session key", async () => {
    const deps = dependencies();

    const result = await runDemoAgentAction({
      kind: "safe",
      deployment: deploymentFixture(),
      privateKey: mismatchPrivateKey,
      dependencies: deps,
      nowSeconds: () => 1_700_000_000
    });

    expect(result).toEqual({ ok: false, reason: "session_key_mismatch", message: "Configured demo agent session key does not match deployments/46630.json." });
    expect(deps.writes).toEqual([]);
  });

  it("treats tuple-shaped sessionKeys reads as active when enabled and not expired", async () => {
    const deps = dependencies({
      previewCode: ReasonCode.OK,
      decisionStatuses: [DecisionStatus.APPROVED, DecisionStatus.EXECUTED],
      sessionKeyRead: [true, 4_102_444_800n, 0, 0n, "0x0000000000000000000000000000000000000000000000000000000000000000"]
    });

    const result = await runDemoAgentAction({
      kind: "safe",
      deployment: deploymentFixture(),
      privateKey: matchingPrivateKey,
      dependencies: deps,
      nowSeconds: () => 1_700_000_000
    });

    expect(result).toMatchObject({ ok: true, kind: "safe", decisionStatus: "EXECUTED" });
    expect(deps.writes).toEqual(["submitAction", "executeAction"]);
  });

  it("refuses a safe action when preview is not OK", async () => {
    const deps = dependencies({ previewCode: ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED });

    const result = await runDemoAgentAction({
      kind: "safe",
      deployment: deploymentFixture(),
      privateKey: matchingPrivateKey,
      dependencies: deps,
      nowSeconds: () => 1_700_000_000
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "preview_not_ok",
      previewReason: "SINGLE_ASSET_EXPOSURE_EXCEEDED",
      message: "Safe candidate is currently blocked under live portfolio state. Deposit more USDG or reduce safe amount."
    });
    expect(deps.writes).toEqual([]);
  });

  it("submits dangerous blocked evidence but never executes it", async () => {
    const deps = dependencies({ previewCode: ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED, decisionStatus: DecisionStatus.BLOCKED });

    const result = await runDemoAgentAction({
      kind: "dangerous",
      deployment: deploymentFixture(),
      privateKey: matchingPrivateKey,
      dependencies: deps,
      nowSeconds: () => 1_700_000_000
    });

    expect(result).toMatchObject({ ok: true, kind: "dangerous", blockedReason: "SINGLE_ASSET_EXPOSURE_EXCEEDED", decisionStatus: "BLOCKED" });
    expect(deps.writes).toEqual(["submitAction"]);
  });

  it("executes a safe action only after the decision is approved", async () => {
    const deps = dependencies({ previewCode: ReasonCode.OK, decisionStatuses: [DecisionStatus.APPROVED, DecisionStatus.EXECUTED] });

    const result = await runDemoAgentAction({
      kind: "safe",
      deployment: deploymentFixture(),
      privateKey: matchingPrivateKey,
      dependencies: deps,
      nowSeconds: () => 1_700_000_000
    });

    expect(result).toMatchObject({ ok: true, kind: "safe", previewReason: "OK", decisionStatus: "EXECUTED", executeReceiptStatus: "success" });
    expect(deps.writes).toEqual(["submitAction", "executeAction"]);
  });

  it("rejects arbitrary action payload fields at the API boundary", () => {
    expect(parseDemoAgentActionRequest({ kind: "safe", amountIn: "999", calldata: "0x1234" })).toEqual({ ok: false, status: 400, body: { ok: false, reason: "invalid_request", message: "Request body must be exactly { kind: 'safe' } or { kind: 'dangerous' }." } });
  });

  it("never includes the private key in relayer responses", async () => {
    const result = await runDemoAgentAction({
      kind: "safe",
      deployment: deploymentFixture(),
      privateKey: matchingPrivateKey,
      dependencies: dependencies({ previewCode: ReasonCode.OK, decisionStatus: DecisionStatus.APPROVED }),
      nowSeconds: () => 1_700_000_000
    });

    expect(JSON.stringify(result)).not.toContain(matchingPrivateKey);
  });
});
