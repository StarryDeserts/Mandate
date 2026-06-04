import { describe, expect, it } from "vitest";
import {
  buildDepositTransactionRequest,
  depositIntoMandateAccountDirect,
  encodeDepositCalldata,
  getDepositDisabledReason,
  readMandateAccountTokenBalanceDirect
} from "../liveDepositRequests";
import { encodeBalanceOfCalldata } from "../liveMintRequests";

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

describe("live deposit direct provider requests", () => {
  it("encodes MandateAccount.deposit(address,uint256) calldata manually", () => {
    expect(encodeDepositCalldata("0xa30948059DC024c14e97Ca95f7C1141f9b0E79F9", 100000000000000000000n)).toBe(
      "0x47e7ef24000000000000000000000000a30948059dc024c14e97ca95f7c1141f9b0e79f90000000000000000000000000000000000000000000000056bc75e2d63100000"
    );
  });

  it("builds a MandateAccount.deposit eth_sendTransaction request", () => {
    const request = buildDepositTransactionRequest({
      from: "0x4727165918986b69ff3F94aC1dAa94987B819cfD",
      mandateAccount: "0x02A5d620dd3fF1cDaDe96d458e7A51988194E223",
      tokenAddress: "0xa30948059DC024c14e97Ca95f7C1141f9b0E79F9",
      amount: 100000000000000000000n
    });

    expect(request).toEqual({
      from: "0x4727165918986b69ff3F94aC1dAa94987B819cfD",
      to: "0x02A5d620dd3fF1cDaDe96d458e7A51988194E223",
      data: "0x47e7ef24000000000000000000000000a30948059dc024c14e97ca95f7c1141f9b0e79f90000000000000000000000000000000000000000000000056bc75e2d63100000"
    });
  });

  it("submits MandateAccount.deposit through eth_sendTransaction", async () => {
    const { provider, requests } = fakeProvider(async ({ method }) => {
      if (method === "eth_sendTransaction") return "0xdeposit123";
      throw new Error(`unexpected method ${method}`);
    });

    const hash = await depositIntoMandateAccountDirect(provider, {
      from: "0x4727165918986b69ff3F94aC1dAa94987B819cfD",
      mandateAccount: "0x02A5d620dd3fF1cDaDe96d458e7A51988194E223",
      tokenAddress: "0xa30948059DC024c14e97Ca95f7C1141f9b0E79F9",
      amount: 100000000000000000000n
    });

    expect(hash).toBe("0xdeposit123");
    expect(requests).toEqual([
      {
        method: "eth_sendTransaction",
        params: [
          {
            from: "0x4727165918986b69ff3F94aC1dAa94987B819cfD",
            to: "0x02A5d620dd3fF1cDaDe96d458e7A51988194E223",
            data: "0x47e7ef24000000000000000000000000a30948059dc024c14e97ca95f7c1141f9b0e79f90000000000000000000000000000000000000000000000056bc75e2d63100000"
          }
        ]
      }
    ]);
  });

  it("reads MandateAccount token balance with ERC20.balanceOf(address) through eth_call", async () => {
    const { provider, requests } = fakeProvider(async ({ method }) => {
      if (method === "eth_call") return "0x00000000000000000000000000000000000000000000000ad78ebc5ac6200000";
      throw new Error(`unexpected method ${method}`);
    });

    const balance = await readMandateAccountTokenBalanceDirect(
      provider,
      "0xa30948059DC024c14e97Ca95f7C1141f9b0E79F9",
      "0x02A5d620dd3fF1cDaDe96d458e7A51988194E223"
    );

    expect(balance).toBe(200000000000000000000n);
    expect(requests).toEqual([
      {
        method: "eth_call",
        params: [
          {
            to: "0xa30948059DC024c14e97Ca95f7C1141f9b0E79F9",
            data: encodeBalanceOfCalldata("0x02A5d620dd3fF1cDaDe96d458e7A51988194E223")
          },
          "latest"
        ]
      }
    ]);
  });

  it("returns concrete disabled reasons before enabling deposit", () => {
    const ready = {
      depositPending: false,
      providerPresent: true,
      isConnected: true,
      isCorrectChain: true,
      selectedTokenPresent: true,
      selectedAmount: 100000000000000000000n,
      selectedAmountLabel: "100 USDG",
      selectedTokenBalance: 100000000000000000000n,
      allowanceLoading: false,
      selectedAllowance: 100000000000000000000n
    };

    expect(getDepositDisabledReason(ready)).toBeNull();
    expect(getDepositDisabledReason({ ...ready, depositPending: true })).toBe("Deposit transaction is already pending.");
    expect(getDepositDisabledReason({ ...ready, providerPresent: false })).toBe("No injected wallet provider detected.");
    expect(getDepositDisabledReason({ ...ready, isConnected: false })).toBe("Connect a wallet before depositing into MandateAccount.");
    expect(getDepositDisabledReason({ ...ready, isCorrectChain: false })).toBe("Switch to Robinhood Chain testnet before depositing into MandateAccount.");
    expect(getDepositDisabledReason({ ...ready, selectedTokenPresent: false })).toBe("Select a project demo token preset before depositing.");
    expect(getDepositDisabledReason({ ...ready, selectedAmount: 0n })).toBe("Selected amount is invalid.");
    expect(getDepositDisabledReason({ ...ready, selectedTokenBalance: null })).toBe("Refresh wallet token balance before deposit.");
    expect(getDepositDisabledReason({ ...ready, selectedTokenBalance: 99999999999999999999n })).toBe("Insufficient wallet balance for 100 USDG.");
    expect(getDepositDisabledReason({ ...ready, allowanceLoading: true })).toBe("Current allowance is still loading.");
    expect(getDepositDisabledReason({ ...ready, selectedAllowance: null })).toBe("Current allowance is not loaded yet.");
    expect(getDepositDisabledReason({ ...ready, selectedAllowance: 99999999999999999999n })).toBe("Approval required before deposit.");
  });
});
