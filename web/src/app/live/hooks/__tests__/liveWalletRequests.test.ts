import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { connectWalletDirect, readNativeBalanceDirect, switchToRobinhoodChainDirect } from "../liveWalletRequests";

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

describe("live wallet direct provider requests", () => {
  it("connects by calling eth_requestAccounts directly", async () => {
    const { provider, requests } = fakeProvider(async () => ["0x4727165918986b69ff3F94aC1dAa94987B819cfD"]);

    const address = await connectWalletDirect(provider);

    expect(address).toBe("0x4727165918986b69ff3F94aC1dAa94987B819cfD");
    expect(requests).toEqual([{ method: "eth_requestAccounts" }]);
  });

  it("switches to Robinhood Chain with the proven chain id hex", async () => {
    const { provider, requests } = fakeProvider(async () => null);

    await switchToRobinhoodChainDirect(provider, "");

    expect(requests).toEqual([{ method: "wallet_switchEthereumChain", params: [{ chainId: "0xb626" }] }]);
  });

  it("adds Robinhood Chain with a caller-provided public RPC URL when the wallet does not know it", async () => {
    let switchAttempts = 0;
    const { provider, requests } = fakeProvider(async ({ method }) => {
      if (method === "wallet_switchEthereumChain") {
        switchAttempts += 1;
        if (switchAttempts === 1) throw Object.assign(new Error("chain not added"), { code: 4902 });
      }
      return null;
    });

    await switchToRobinhoodChainDirect(provider, "https://public-rpc.example");

    expect(requests).toEqual([
      { method: "wallet_switchEthereumChain", params: [{ chainId: "0xb626" }] },
      {
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xb626",
            chainName: "Robinhood Chain Testnet",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://public-rpc.example"],
            blockExplorerUrls: ["https://explorer.testnet.chain.robinhood.com"]
          }
        ]
      },
      { method: "wallet_switchEthereumChain", params: [{ chainId: "0xb626" }] }
    ]);
  });

  it("reads the connected account native balance through eth_getBalance", async () => {
    const { provider, requests } = fakeProvider(async ({ method }) => {
      if (method === "eth_accounts") return ["0x4727165918986b69ff3F94aC1dAa94987B819cfD"];
      if (method === "eth_chainId") return "0xb626";
      if (method === "eth_getBalance") return "0xde0b6b3a7640000";
      throw new Error(`unexpected method ${method}`);
    });

    const balance = await readNativeBalanceDirect(provider);

    expect(balance).toEqual({
      address: "0x4727165918986b69ff3F94aC1dAa94987B819cfD",
      chainId: 46630,
      rawWeiHex: "0xde0b6b3a7640000",
      wei: 1000000000000000000n,
      formattedEth: "1 ETH"
    });
    expect(requests).toEqual([
      { method: "eth_accounts" },
      { method: "eth_chainId" },
      { method: "eth_getBalance", params: ["0x4727165918986b69ff3F94aC1dAa94987B819cfD", "latest"] }
    ]);
  });

  it("keeps the live hook off viem wallet and public client abstractions", () => {
    const hookSource = readFileSync("src/app/live/hooks/useLiveWallet.ts", "utf8");

    expect(hookSource).not.toContain("createWalletClient");
    expect(hookSource).not.toContain("createPublicClient");
    expect(hookSource).not.toContain("custom(");
    expect(hookSource).not.toContain("http(");
  });
});
