import { defineChain } from "viem";
import { evidence } from "@/lib/evidence";

export const ROBINHOOD_CHAIN_ID = 46630;
export const KNOWN_SESSION_KEY = evidence.demo.actor;

export const robinhoodTestnet = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain Testnet",
  nativeCurrency: {
    name: "Test Ether",
    symbol: "ETH",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || "http://127.0.0.1:0"]
    }
  }
});

export function hasPublicRpc(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL);
}

export function publicRpcUrl(): string {
  return process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL ?? "";
}

export function hasPublicPriceEndpoint(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_MANDATE_PRICE_URL);
}
