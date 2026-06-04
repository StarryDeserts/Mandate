import { encodeFunctionResult } from "viem";
import { describe, expect, it } from "vitest";
import { mandateAccountAbi } from "../../../../lib/mandate/abis";
import { getMandateDeployment } from "../../../../lib/mandate/deployment";
import { DecisionStatus, ReasonCode, Role } from "../../../../lib/mandate/reasons";
import type { PriceData } from "../../../../lib/mandate/types";
import {
  buildExecuteSafeActionTransactionRequest,
  buildStageFSafeAction,
  buildSubmitSafeActionTransactionRequest,
  getSafeExecuteDisabledReason,
  previewSafeActionDirect,
  readMandateConfigDirect,
  readSessionAuthorityDirect,
  simulateSubmitSafeActionDirect
} from "../liveSafeActionRequests";

type RequestArgs = { method: string; params?: unknown[] };

function fakeProvider(handler: (args: RequestArgs) => Promise<unknown>) {
  const requests: RequestArgs[] = [];
  return {
    requests,
    provider: {
      async request(args: RequestArgs) {
        requests.push(args);
        return handler(args);
      }
    }
  };
}

const deployment = getMandateDeployment();
const safeAction = buildStageFSafeAction({ deployment, actionSchemaVersion: 1, nonce: 7n, nowSeconds: 1_700_000_000 });
const prices: PriceData[] = [
  { asset: deployment.contracts.tsla, priceUSDG1e18: 2_000_000_000_000_000_000n, timestamp: 1_700_000_000n, validUntil: 1_700_003_600n, signature: "0x1234" as `0x${string}` },
  { asset: deployment.contracts.amd, priceUSDG1e18: 1_000_000_000_000_000_000n, timestamp: 1_700_000_000n, validUntil: 1_700_003_600n, signature: "0x5678" as `0x${string}` }
].sort((left, right) => left.asset.localeCompare(right.asset));

describe("live safe action direct provider requests", () => {
  it("builds only the 48 USDG safe action from deployment addresses", () => {
    expect(safeAction).toEqual({
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
    });
  });

  it("reads and decodes MandateAccount.getMandate through eth_call", async () => {
    const { provider, requests } = fakeProvider(async ({ method }) => {
      if (method === "eth_call") {
        return encodeFunctionResult({
          abi: mandateAccountAbi,
          functionName: "getMandate",
          result: {
            mandateVersion: 3n,
            maxSingleAssetExposureBps: 3500,
            maxTradeSizeUSDG: 200_000_000_000_000_000_000n,
            maxDailyTurnoverBps: 2000,
            cooldownSeconds: 0n
          }
        });
      }
      throw new Error(`unexpected method ${method}`);
    });

    const mandate = await readMandateConfigDirect(provider, deployment.contracts.mandateAccount);

    expect(mandate).toEqual({ mandateVersion: 3n, maxSingleAssetExposureBps: 3500, maxTradeSizeUSDG: 200_000_000_000_000_000_000n, maxDailyTurnoverBps: 2000, cooldownSeconds: 0n });
    expect(requests).toEqual([{ method: "eth_call", params: [{ to: deployment.contracts.mandateAccount, data: "0x52f29508" }, "latest"] }]);
  });

  it("reads connected actor role and default session-key state through eth_call", async () => {
    const { provider, requests } = fakeProvider(async ({ method, params }) => {
      if (method !== "eth_call") throw new Error(`unexpected method ${method}`);
      const call = params?.[0] as { data: string };
      if (call.data.startsWith("0xa5d7827e")) return encodeFunctionResult({ abi: mandateAccountAbi, functionName: "roleOf", result: Role.SESSION });
      if (call.data.startsWith("0xb7b8d604")) {
        return encodeFunctionResult({
          abi: mandateAccountAbi,
          functionName: "sessionKeys",
          result: [true, 4_102_444_800n, 0, 0n, "0x0000000000000000000000000000000000000000000000000000000000000000"]
        });
      }
      throw new Error(`unexpected data ${call.data}`);
    });

    const authority = await readSessionAuthorityDirect(provider, deployment.contracts.mandateAccount, deployment.sessionKey, deployment.sessionKey);

    expect(authority).toEqual({
      connectedRole: Role.SESSION,
      sessionKeyRole: Role.SESSION,
      sessionKey: { enabled: true, validUntil: 4_102_444_800n, allowedActionTypes: 0, maxAmountInPerAction: 0n, scopeHash: "0x0000000000000000000000000000000000000000000000000000000000000000" }
    });
    expect(requests.map((request) => ((request.params?.[0] as { data: string }).data.slice(0, 10)))).toEqual(["0xa5d7827e", "0xa5d7827e", "0xb7b8d604"]);
  });

  it("previews the safe action through eth_call and decodes the OK result", async () => {
    const { provider, requests } = fakeProvider(async ({ method }) => {
      if (method === "eth_call") return encodeFunctionResult({ abi: mandateAccountAbi, functionName: "previewAction", result: [ReasonCode.OK, 3200, 3300] });
      throw new Error(`unexpected method ${method}`);
    });

    const preview = await previewSafeActionDirect(provider, deployment.contracts.mandateAccount, safeAction, prices);

    expect(preview).toEqual({ code: ReasonCode.OK, preExposureBps: 3200, postExposureBps: 3300 });
    expect(((requests[0].params?.[0] as { data: string }).data).startsWith("0x92bdd563")).toBe(true);
  });

  it("builds submit and execute eth_sendTransaction requests for the safe action only", () => {
    const submit = buildSubmitSafeActionTransactionRequest({ from: deployment.sessionKey, mandateAccount: deployment.contracts.mandateAccount, action: safeAction, prices });
    const execute = buildExecuteSafeActionTransactionRequest({ from: deployment.sessionKey, mandateAccount: deployment.contracts.mandateAccount, action: safeAction, prices });

    expect(submit.from).toBe(deployment.sessionKey);
    expect(submit.to).toBe(deployment.contracts.mandateAccount);
    expect(submit.data.startsWith("0x978f01ee")).toBe(true);
    expect(execute.from).toBe(deployment.sessionKey);
    expect(execute.to).toBe(deployment.contracts.mandateAccount);
    expect(execute.data.startsWith("0x703de370")).toBe(true);
    expect(submit.data).not.toContain("1b1ae4d6e2ef500000");
    expect(execute.data).not.toContain("1b1ae4d6e2ef500000");
  });

  it("simulates submitAction through eth_call before asking the wallet to sign", async () => {
    const { provider, requests } = fakeProvider(async ({ method }) => {
      if (method === "eth_call") {
        return encodeFunctionResult({
          abi: mandateAccountAbi,
          functionName: "submitAction",
          result: ["0x1111111111111111111111111111111111111111111111111111111111111111", ReasonCode.OK, 3200, 3300]
        });
      }
      throw new Error(`unexpected method ${method}`);
    });

    const result = await simulateSubmitSafeActionDirect(provider, { from: deployment.sessionKey, mandateAccount: deployment.contracts.mandateAccount, action: safeAction, prices });

    expect(result).toEqual({ actionId: "0x1111111111111111111111111111111111111111111111111111111111111111", code: ReasonCode.OK, preExposureBps: 3200, postExposureBps: 3300 });
    expect(requests).toEqual([{ method: "eth_call", params: [{ from: deployment.sessionKey, to: deployment.contracts.mandateAccount, data: expect.stringMatching(/^0x978f01ee/) }, "latest"] }]);
  });

  it("returns concrete disabled reasons before enabling safe execution", () => {
    const ready = {
      pending: false,
      providerPresent: true,
      isConnected: true,
      isCorrectChain: true,
      connectedAddress: deployment.sessionKey,
      expectedSessionKey: deployment.sessionKey,
      connectedRole: Role.SESSION,
      sessionKeyEnabled: true,
      nativeBalance: 1n,
      safeActionReady: true,
      pricesReady: true,
      previewCode: ReasonCode.OK,
      decisionStatus: DecisionStatus.NONE
    };

    expect(getSafeExecuteDisabledReason(ready)).toBeNull();
    expect(getSafeExecuteDisabledReason({ ...ready, pending: true })).toBe("Safe action transaction is already pending.");
    expect(getSafeExecuteDisabledReason({ ...ready, providerPresent: false })).toBe("No injected wallet provider detected.");
    expect(getSafeExecuteDisabledReason({ ...ready, isConnected: false })).toBe("Connect the default session key wallet before safe execution.");
    expect(getSafeExecuteDisabledReason({ ...ready, isCorrectChain: false })).toBe("Switch to Robinhood Chain testnet before safe execution.");
    expect(getSafeExecuteDisabledReason({ ...ready, connectedAddress: deployment.owner })).toBe("Connect the default session key wallet for safe execution.");
    expect(getSafeExecuteDisabledReason({ ...ready, connectedRole: Role.NONE })).toBe("Connected wallet does not have SESSION role.");
    expect(getSafeExecuteDisabledReason({ ...ready, sessionKeyEnabled: false })).toBe("Default session key is not enabled onchain.");
    expect(getSafeExecuteDisabledReason({ ...ready, nativeBalance: 0n })).toBe("Connected wallet has no native ETH for gas.");
    expect(getSafeExecuteDisabledReason({ ...ready, safeActionReady: false })).toBe("Safe action is not ready yet.");
    expect(getSafeExecuteDisabledReason({ ...ready, pricesReady: false })).toBe("Signed price rows are not loaded yet.");
    expect(getSafeExecuteDisabledReason({ ...ready, previewCode: undefined })).toBe("Safe preview is not ready yet.");
    expect(getSafeExecuteDisabledReason({ ...ready, previewCode: ReasonCode.TRADE_SIZE_EXCEEDED })).toBe("Safe preview is TRADE_SIZE_EXCEEDED, not OK.");
    expect(getSafeExecuteDisabledReason({ ...ready, decisionStatus: DecisionStatus.EXECUTED })).toBe("Safe action has already executed.");
  });
});
