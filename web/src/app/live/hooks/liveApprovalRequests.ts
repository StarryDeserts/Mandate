import type { DirectProvider, HexAddress } from "./liveWalletRequests";

const APPROVE_SELECTOR = "0x095ea7b3";
const ALLOWANCE_SELECTOR = "0xdd62ed3e";

export type ApproveTransactionRequest = {
  from: HexAddress;
  to: HexAddress;
  data: `0x${string}`;
};

export function buildApproveTransactionRequest({
  from,
  tokenAddress,
  spender,
  amount
}: {
  from: HexAddress;
  tokenAddress: HexAddress;
  spender: HexAddress;
  amount: bigint;
}): ApproveTransactionRequest {
  return {
    from,
    to: tokenAddress,
    data: encodeApproveCalldata(spender, amount)
  };
}

export function encodeApproveCalldata(spender: HexAddress, amount: bigint): `0x${string}` {
  return `${APPROVE_SELECTOR}${encodeAddressWord(spender)}${encodeUintWord(amount)}`;
}

export function encodeAllowanceCalldata(owner: HexAddress, spender: HexAddress): `0x${string}` {
  return `${ALLOWANCE_SELECTOR}${encodeAddressWord(owner)}${encodeAddressWord(spender)}`;
}

export async function readAllowanceDirect(provider: DirectProvider, tokenAddress: HexAddress, owner: HexAddress, spender: HexAddress): Promise<bigint> {
  const allowance = await provider.request({
    method: "eth_call",
    params: [
      {
        to: tokenAddress,
        data: encodeAllowanceCalldata(owner, spender)
      },
      "latest"
    ]
  });
  if (typeof allowance !== "string" || !allowance.startsWith("0x")) throw new Error("Allowance response was not a uint256 hex string.");
  return BigInt(allowance);
}

export async function approveExactAmountDirect(
  provider: DirectProvider,
  { from, tokenAddress, spender, amount }: { from: HexAddress; tokenAddress: HexAddress; spender: HexAddress; amount: bigint }
): Promise<`0x${string}`> {
  const hash = await provider.request({ method: "eth_sendTransaction", params: [buildApproveTransactionRequest({ from, tokenAddress, spender, amount })] });
  if (typeof hash !== "string" || !hash.startsWith("0x")) throw new Error("eth_sendTransaction did not return a transaction hash.");
  return hash as `0x${string}`;
}

export function isApprovalRequired(currentAllowance: bigint, selectedAmount: bigint): boolean {
  return currentAllowance < selectedAmount;
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
