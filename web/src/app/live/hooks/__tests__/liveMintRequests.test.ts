import { describe, expect, it } from "vitest";
import { getMandateDeployment } from "../../../../lib/mandate/deployment";
import {
  buildLiveMintTokens,
  buildMintTransactionRequest,
  encodeBalanceOfCalldata,
  encodeMintCalldata,
  mintProjectDemoTokenDirect,
  parseTokenAmount18,
  readTokenBalanceDirect,
  waitForTransactionReceiptDirect
} from "../liveMintRequests";

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

describe("live mint direct provider requests", () => {
  it("resolves Stage C demo token addresses from deployments/46630.json", () => {
    const deployment = getMandateDeployment();

    expect(buildLiveMintTokens(deployment)).toEqual([
      { token: "usdg", label: "USDG", address: deployment.contracts.usdg },
      { token: "tsla", label: "TSLA", address: deployment.contracts.tsla },
      { token: "amd", label: "AMD", address: deployment.contracts.amd }
    ]);
  });

  it("encodes MockERC20.mint(address,uint256) calldata manually", () => {
    expect(encodeMintCalldata("0x4727165918986b69ff3F94aC1dAa94987B819cfD", 200000000000000000000n)).toBe(
      "0x40c10f190000000000000000000000004727165918986b69ff3f94ac1daa94987b819cfd00000000000000000000000000000000000000000000000ad78ebc5ac6200000"
    );
  });

  it("builds a safe eth_sendTransaction request for MockERC20.mint", () => {
    const request = buildMintTransactionRequest({
      from: "0x4727165918986b69ff3F94aC1dAa94987B819cfD",
      tokenAddress: "0xa30948059DC024c14e97Ca95f7C1141f9b0E79F9",
      amount: 10000000000000000000n
    });

    expect(request).toEqual({
      from: "0x4727165918986b69ff3F94aC1dAa94987B819cfD",
      to: "0xa30948059DC024c14e97Ca95f7C1141f9b0E79F9",
      data: "0x40c10f190000000000000000000000004727165918986b69ff3f94ac1daa94987b819cfd0000000000000000000000000000000000000000000000008ac7230489e80000"
    });
  });

  it("sends MockERC20.mint through eth_sendTransaction", async () => {
    const { provider, requests } = fakeProvider(async ({ method }) => {
      if (method === "eth_sendTransaction") return "0xabc123";
      throw new Error(`unexpected method ${method}`);
    });

    const hash = await mintProjectDemoTokenDirect(provider, {
      from: "0x4727165918986b69ff3F94aC1dAa94987B819cfD",
      tokenAddress: "0xa30948059DC024c14e97Ca95f7C1141f9b0E79F9",
      amount: 5000000000000000000n
    });

    expect(hash).toBe("0xabc123");
    expect(requests).toEqual([
      {
        method: "eth_sendTransaction",
        params: [
          {
            from: "0x4727165918986b69ff3F94aC1dAa94987B819cfD",
            to: "0xa30948059DC024c14e97Ca95f7C1141f9b0E79F9",
            data: "0x40c10f190000000000000000000000004727165918986b69ff3f94ac1daa94987b819cfd0000000000000000000000000000000000000000000000004563918244f40000"
          }
        ]
      }
    ]);
  });

  it("polls eth_getTransactionReceipt until the receipt is available", async () => {
    let attempts = 0;
    const { provider, requests } = fakeProvider(async ({ method }) => {
      if (method !== "eth_getTransactionReceipt") throw new Error(`unexpected method ${method}`);
      attempts += 1;
      return attempts === 3 ? { status: "0x1", transactionHash: "0xabc123" } : null;
    });

    const receipt = await waitForTransactionReceiptDirect(provider, "0xabc123", { maxAttempts: 3, delayMs: 0 });

    expect(receipt).toEqual({ status: "0x1", transactionHash: "0xabc123" });
    expect(requests).toEqual([
      { method: "eth_getTransactionReceipt", params: ["0xabc123"] },
      { method: "eth_getTransactionReceipt", params: ["0xabc123"] },
      { method: "eth_getTransactionReceipt", params: ["0xabc123"] }
    ]);
  });

  it("reads token balance with balanceOf(address) through eth_call", async () => {
    const { provider, requests } = fakeProvider(async ({ method }) => {
      if (method === "eth_call") return "0x00000000000000000000000000000000000000000000000ad78ebc5ac6200000";
      throw new Error(`unexpected method ${method}`);
    });

    const balance = await readTokenBalanceDirect(provider, "0xa30948059DC024c14e97Ca95f7C1141f9b0E79F9", "0x4727165918986b69ff3F94aC1dAa94987B819cfD");

    expect(balance).toBe(200000000000000000000n);
    expect(requests).toEqual([
      {
        method: "eth_call",
        params: [
          {
            to: "0xa30948059DC024c14e97Ca95f7C1141f9b0E79F9",
            data: encodeBalanceOfCalldata("0x4727165918986b69ff3F94aC1dAa94987B819cfD")
          },
          "latest"
        ]
      }
    ]);
  });

  it("parses the Stage C preset amounts as 18-decimal token units", () => {
    expect(parseTokenAmount18("200")).toBe(200000000000000000000n);
    expect(parseTokenAmount18("100")).toBe(100000000000000000000n);
    expect(parseTokenAmount18("10")).toBe(10000000000000000000n);
    expect(parseTokenAmount18("5")).toBe(5000000000000000000n);
  });
});
