import type { MandateDeployment } from "../../../lib/mandate/types";
import { type FundingTokenKey, fundingLabels, fundingTokenKeys } from "../../../lib/mandate/funding";
import type { DirectProvider, HexAddress } from "./liveWalletRequests";

const MINT_SELECTOR = "0x40c10f19";
const BALANCE_OF_SELECTOR = "0x70a08231";
const DECIMALS = 18n;
const UNIT = 10n ** DECIMALS;

export type LiveMintToken = {
  token: FundingTokenKey;
  label: string;
  address: HexAddress;
};

export type MintTransactionRequest = {
  from: HexAddress;
  to: HexAddress;
  data: `0x${string}`;
};

export type TransactionReceipt = {
  status?: string;
  transactionHash?: string;
  [key: string]: unknown;
};

export type ReceiptPollingOptions = {
  maxAttempts?: number;
  delayMs?: number;
};

export function buildLiveMintTokens(deployment: MandateDeployment): LiveMintToken[] {
  return fundingTokenKeys.map((token) => ({ token, label: fundingLabels[token], address: deployment.contracts[token] as HexAddress }));
}

export function buildMintTransactionRequest({ from, tokenAddress, amount }: { from: HexAddress; tokenAddress: HexAddress; amount: bigint }): MintTransactionRequest {
  return {
    from,
    to: tokenAddress,
    data: encodeMintCalldata(from, amount)
  };
}

export function encodeMintCalldata(to: HexAddress, amount: bigint): `0x${string}` {
  return `${MINT_SELECTOR}${encodeAddressWord(to)}${encodeUintWord(amount)}`;
}

export function encodeBalanceOfCalldata(account: HexAddress): `0x${string}` {
  return `${BALANCE_OF_SELECTOR}${encodeAddressWord(account)}`;
}

export async function mintProjectDemoTokenDirect(
  provider: DirectProvider,
  { from, tokenAddress, amount }: { from: HexAddress; tokenAddress: HexAddress; amount: bigint }
): Promise<`0x${string}`> {
  const hash = await provider.request({ method: "eth_sendTransaction", params: [buildMintTransactionRequest({ from, tokenAddress, amount })] });
  if (typeof hash !== "string" || !hash.startsWith("0x")) throw new Error("eth_sendTransaction did not return a transaction hash.");
  return hash as `0x${string}`;
}

export async function waitForTransactionReceiptDirect(provider: DirectProvider, hash: `0x${string}`, options: ReceiptPollingOptions = {}): Promise<TransactionReceipt> {
  const maxAttempts = options.maxAttempts ?? 40;
  const delayMs = options.delayMs ?? 1500;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const receipt = await provider.request({ method: "eth_getTransactionReceipt", params: [hash] });
    if (receipt && typeof receipt === "object") return receipt as TransactionReceipt;
    if (delayMs > 0) await delay(delayMs);
  }

  throw new Error(`Transaction receipt was not available after ${maxAttempts} attempts.`);
}

export async function readTokenBalanceDirect(provider: DirectProvider, tokenAddress: HexAddress, account: HexAddress): Promise<bigint> {
  const balance = await provider.request({
    method: "eth_call",
    params: [
      {
        to: tokenAddress,
        data: encodeBalanceOfCalldata(account)
      },
      "latest"
    ]
  });
  if (typeof balance !== "string" || !balance.startsWith("0x")) throw new Error("Token balance response was not a uint256 hex string.");
  return BigInt(balance);
}

export function parseTokenAmount18(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(trimmed)) throw new Error("Token amount must be a positive decimal with up to 18 decimals.");

  const [whole, fraction = ""] = trimmed.split(".");
  return BigInt(whole) * UNIT + BigInt(fraction.padEnd(18, "0"));
}

export function formatTokenAmount18(value: bigint): string {
  const whole = value / UNIT;
  const fraction = (value % UNIT).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function encodeAddressWord(address: HexAddress): string {
  const normalized = address.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(normalized)) throw new Error("Address must be a 20-byte hex string.");
  return normalized.padStart(64, "0");
}

function encodeUintWord(value: bigint): string {
  if (value < 0n) throw new Error("Uint value cannot be negative.");
  return value.toString(16).padStart(64, "0");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
