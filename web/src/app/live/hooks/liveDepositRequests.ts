import { readTokenBalanceDirect } from "./liveMintRequests";
import type { DirectProvider, HexAddress } from "./liveWalletRequests";

const DEPOSIT_SELECTOR = "0x47e7ef24";

export type DepositTransactionRequest = {
  from: HexAddress;
  to: HexAddress;
  data: `0x${string}`;
};

export type DepositDisabledReasonInput = {
  depositPending: boolean;
  providerPresent: boolean;
  isConnected: boolean;
  isCorrectChain: boolean;
  selectedTokenPresent: boolean;
  selectedAmount: bigint;
  selectedAmountLabel: string;
  selectedTokenBalance: bigint | null;
  allowanceLoading: boolean;
  selectedAllowance: bigint | null;
};

export function buildDepositTransactionRequest({
  from,
  mandateAccount,
  tokenAddress,
  amount
}: {
  from: HexAddress;
  mandateAccount: HexAddress;
  tokenAddress: HexAddress;
  amount: bigint;
}): DepositTransactionRequest {
  return {
    from,
    to: mandateAccount,
    data: encodeDepositCalldata(tokenAddress, amount)
  };
}

export function encodeDepositCalldata(tokenAddress: HexAddress, amount: bigint): `0x${string}` {
  return `${DEPOSIT_SELECTOR}${encodeAddressWord(tokenAddress)}${encodeUintWord(amount)}`;
}

export async function depositIntoMandateAccountDirect(
  provider: DirectProvider,
  { from, mandateAccount, tokenAddress, amount }: { from: HexAddress; mandateAccount: HexAddress; tokenAddress: HexAddress; amount: bigint }
): Promise<`0x${string}`> {
  const hash = await provider.request({ method: "eth_sendTransaction", params: [buildDepositTransactionRequest({ from, mandateAccount, tokenAddress, amount })] });
  if (typeof hash !== "string" || !hash.startsWith("0x")) throw new Error("eth_sendTransaction did not return a transaction hash.");
  return hash as `0x${string}`;
}

export function readMandateAccountTokenBalanceDirect(provider: DirectProvider, tokenAddress: HexAddress, mandateAccount: HexAddress): Promise<bigint> {
  return readTokenBalanceDirect(provider, tokenAddress, mandateAccount);
}

export function getDepositDisabledReason({
  depositPending,
  providerPresent,
  isConnected,
  isCorrectChain,
  selectedTokenPresent,
  selectedAmount,
  selectedAmountLabel,
  selectedTokenBalance,
  allowanceLoading,
  selectedAllowance
}: DepositDisabledReasonInput): string | null {
  if (depositPending) return "Deposit transaction is already pending.";
  if (!providerPresent) return "No injected wallet provider detected.";
  if (!isConnected) return "Connect a wallet before depositing into MandateAccount.";
  if (!isCorrectChain) return "Switch to Robinhood Chain testnet before depositing into MandateAccount.";
  if (!selectedTokenPresent) return "Select a project demo token preset before depositing.";
  if (selectedAmount <= 0n) return "Selected amount is invalid.";
  if (selectedTokenBalance === null) return "Refresh wallet token balance before deposit.";
  if (selectedTokenBalance < selectedAmount) return `Insufficient wallet balance for ${selectedAmountLabel}.`;
  if (allowanceLoading) return "Current allowance is still loading.";
  if (selectedAllowance === null) return "Current allowance is not loaded yet.";
  if (selectedAllowance < selectedAmount) return "Approval required before deposit.";
  return null;
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
