import { describe, expect, it } from "vitest";
import {
  approveExactAmountDirect,
  buildApproveTransactionRequest,
  encodeAllowanceCalldata,
  encodeApproveCalldata,
  isApprovalRequired,
  readAllowanceDirect
} from "../liveApprovalRequests";

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

describe("live approval direct provider requests", () => {
  it("encodes ERC20.allowance(address,address) calldata manually", () => {
    expect(encodeAllowanceCalldata("0x4727165918986b69ff3F94aC1dAa94987B819cfD", "0x02A5d620dd3fF1cDaDe96d458e7A51988194E223")).toBe(
      "0xdd62ed3e0000000000000000000000004727165918986b69ff3f94ac1daa94987b819cfd00000000000000000000000002a5d620dd3ff1cdade96d458e7a51988194e223"
    );
  });

  it("encodes exact ERC20.approve(address,uint256) calldata manually", () => {
    expect(encodeApproveCalldata("0x02A5d620dd3fF1cDaDe96d458e7A51988194E223", 100000000000000000000n)).toBe(
      "0x095ea7b300000000000000000000000002a5d620dd3ff1cdade96d458e7a51988194e2230000000000000000000000000000000000000000000000056bc75e2d63100000"
    );
  });

  it("builds an exact approve eth_sendTransaction request", () => {
    const request = buildApproveTransactionRequest({
      from: "0x4727165918986b69ff3F94aC1dAa94987B819cfD",
      tokenAddress: "0xa30948059DC024c14e97Ca95f7C1141f9b0E79F9",
      spender: "0x02A5d620dd3fF1cDaDe96d458e7A51988194E223",
      amount: 100000000000000000000n
    });

    expect(request).toEqual({
      from: "0x4727165918986b69ff3F94aC1dAa94987B819cfD",
      to: "0xa30948059DC024c14e97Ca95f7C1141f9b0E79F9",
      data: "0x095ea7b300000000000000000000000002a5d620dd3ff1cdade96d458e7a51988194e2230000000000000000000000000000000000000000000000056bc75e2d63100000"
    });
  });

  it("reads allowance with eth_call and decodes uint256", async () => {
    const { provider, requests } = fakeProvider(async ({ method }) => {
      if (method === "eth_call") return "0x0000000000000000000000000000000000000000000000056bc75e2d63100000";
      throw new Error(`unexpected method ${method}`);
    });

    const allowance = await readAllowanceDirect(
      provider,
      "0xa30948059DC024c14e97Ca95f7C1141f9b0E79F9",
      "0x4727165918986b69ff3F94aC1dAa94987B819cfD",
      "0x02A5d620dd3fF1cDaDe96d458e7A51988194E223"
    );

    expect(allowance).toBe(100000000000000000000n);
    expect(requests).toEqual([
      {
        method: "eth_call",
        params: [
          {
            to: "0xa30948059DC024c14e97Ca95f7C1141f9b0E79F9",
            data: encodeAllowanceCalldata("0x4727165918986b69ff3F94aC1dAa94987B819cfD", "0x02A5d620dd3fF1cDaDe96d458e7A51988194E223")
          },
          "latest"
        ]
      }
    ]);
  });

  it("submits exact approve through eth_sendTransaction", async () => {
    const { provider, requests } = fakeProvider(async ({ method }) => {
      if (method === "eth_sendTransaction") return "0xapprove123";
      throw new Error(`unexpected method ${method}`);
    });

    const hash = await approveExactAmountDirect(provider, {
      from: "0x4727165918986b69ff3F94aC1dAa94987B819cfD",
      tokenAddress: "0xa30948059DC024c14e97Ca95f7C1141f9b0E79F9",
      spender: "0x02A5d620dd3fF1cDaDe96d458e7A51988194E223",
      amount: 100000000000000000000n
    });

    expect(hash).toBe("0xapprove123");
    expect(requests).toEqual([
      {
        method: "eth_sendTransaction",
        params: [
          {
            from: "0x4727165918986b69ff3F94aC1dAa94987B819cfD",
            to: "0xa30948059DC024c14e97Ca95f7C1141f9b0E79F9",
            data: "0x095ea7b300000000000000000000000002a5d620dd3ff1cdade96d458e7a51988194e2230000000000000000000000000000000000000000000000056bc75e2d63100000"
          }
        ]
      }
    ]);
  });

  it("only requires approval when current allowance is below the selected amount", () => {
    expect(isApprovalRequired(99999999999999999999n, 100000000000000000000n)).toBe(true);
    expect(isApprovalRequired(100000000000000000000n, 100000000000000000000n)).toBe(false);
    expect(isApprovalRequired(101000000000000000000n, 100000000000000000000n)).toBe(false);
  });
});
