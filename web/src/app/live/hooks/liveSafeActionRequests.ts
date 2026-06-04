import { decodeFunctionResult, encodeFunctionData } from "viem";
import { buildMandateAction } from "../../../lib/mandate/actions";
import { mandateAccountAbi } from "../../../lib/mandate/abis";
import { DecisionStatus, ReasonCode, Role, reasonLabel } from "../../../lib/mandate/reasons";
import type { MandateAction, MandateConfig, MandateDeployment, PreviewResult, PriceData, SessionKeyState } from "../../../lib/mandate/types";
import type { DirectProvider, HexAddress } from "./liveWalletRequests";

export type SafeActionTransactionRequest = {
  from: HexAddress;
  to: HexAddress;
  data: `0x${string}`;
};

export type SessionAuthority = {
  connectedRole: number;
  sessionKeyRole: number;
  sessionKey: SessionKeyState;
};

export type SubmitSafeActionResult = {
  actionId: `0x${string}`;
  code: number;
  preExposureBps: number;
  postExposureBps: number;
};

export type DecisionState = {
  status: number;
  mandateVersion: bigint;
  submittedAt: bigint;
  expiresAt: bigint;
  priceDigest: `0x${string}`;
  priceTimestamp: bigint;
};

export type SafeExecuteDisabledReasonInput = {
  pending: boolean;
  providerPresent: boolean;
  isConnected: boolean;
  isCorrectChain: boolean;
  connectedAddress: HexAddress | null;
  expectedSessionKey: HexAddress;
  connectedRole: number | null;
  sessionKeyEnabled: boolean | null;
  nativeBalance: bigint | null;
  safeActionReady: boolean;
  pricesReady: boolean;
  previewCode?: number;
  decisionStatus: number | null;
};

export function buildStageFSafeAction({
  deployment,
  actionSchemaVersion,
  nonce,
  nowSeconds
}: {
  deployment: MandateDeployment;
  actionSchemaVersion: number;
  nonce: bigint;
  nowSeconds: number;
}): MandateAction {
  return buildMandateAction({ kind: "safe", deployment, actionSchemaVersion, nonce, nowSeconds });
}

export async function readActionSchemaVersionDirect(provider: DirectProvider, mandateAccount: HexAddress): Promise<number> {
  const result = await readContractDirect(provider, mandateAccount, encodeFunctionData({ abi: mandateAccountAbi, functionName: "ACTION_SCHEMA_VERSION" }));
  return Number(decodeFunctionResult({ abi: mandateAccountAbi, functionName: "ACTION_SCHEMA_VERSION", data: result }));
}

export async function readNextNonceDirect(provider: DirectProvider, mandateAccount: HexAddress): Promise<bigint> {
  const result = await readContractDirect(provider, mandateAccount, encodeFunctionData({ abi: mandateAccountAbi, functionName: "nextNonce" }));
  return BigInt(decodeFunctionResult({ abi: mandateAccountAbi, functionName: "nextNonce", data: result }).toString());
}

export async function readMandateConfigDirect(provider: DirectProvider, mandateAccount: HexAddress): Promise<MandateConfig> {
  const result = await readContractDirect(provider, mandateAccount, encodeFunctionData({ abi: mandateAccountAbi, functionName: "getMandate" }));
  return normalizeMandateConfig(decodeFunctionResult({ abi: mandateAccountAbi, functionName: "getMandate", data: result }));
}

export async function readAllowedAssetsDirect(provider: DirectProvider, mandateAccount: HexAddress): Promise<HexAddress[]> {
  const result = await readContractDirect(provider, mandateAccount, encodeFunctionData({ abi: mandateAccountAbi, functionName: "getAllowedAssets" }));
  return [...decodeFunctionResult({ abi: mandateAccountAbi, functionName: "getAllowedAssets", data: result })] as HexAddress[];
}

export async function readAssetAllowedDirect(provider: DirectProvider, mandateAccount: HexAddress, asset: HexAddress): Promise<boolean> {
  const result = await readContractDirect(provider, mandateAccount, encodeFunctionData({ abi: mandateAccountAbi, functionName: "isAssetAllowed", args: [asset] }));
  return Boolean(decodeFunctionResult({ abi: mandateAccountAbi, functionName: "isAssetAllowed", data: result }));
}

export async function readAdapterAllowedDirect(provider: DirectProvider, mandateAccount: HexAddress, adapter: HexAddress): Promise<boolean> {
  const result = await readContractDirect(provider, mandateAccount, encodeFunctionData({ abi: mandateAccountAbi, functionName: "isAdapterAllowed", args: [adapter] }));
  return Boolean(decodeFunctionResult({ abi: mandateAccountAbi, functionName: "isAdapterAllowed", data: result }));
}

export async function readPriceOracleDirect(provider: DirectProvider, mandateAccount: HexAddress): Promise<HexAddress> {
  const result = await readContractDirect(provider, mandateAccount, encodeFunctionData({ abi: mandateAccountAbi, functionName: "priceOracle" }));
  return decodeFunctionResult({ abi: mandateAccountAbi, functionName: "priceOracle", data: result }) as HexAddress;
}

export async function readRoleOfDirect(provider: DirectProvider, mandateAccount: HexAddress, actor: HexAddress): Promise<number> {
  const result = await readContractDirect(provider, mandateAccount, encodeFunctionData({ abi: mandateAccountAbi, functionName: "roleOf", args: [actor] }));
  return Number(decodeFunctionResult({ abi: mandateAccountAbi, functionName: "roleOf", data: result }));
}

export async function readSessionKeyDirect(provider: DirectProvider, mandateAccount: HexAddress, sessionKey: HexAddress): Promise<SessionKeyState> {
  const result = await readContractDirect(provider, mandateAccount, encodeFunctionData({ abi: mandateAccountAbi, functionName: "sessionKeys", args: [sessionKey] }));
  return normalizeSessionKey(decodeFunctionResult({ abi: mandateAccountAbi, functionName: "sessionKeys", data: result }));
}

export async function readSessionAuthorityDirect(provider: DirectProvider, mandateAccount: HexAddress, expectedSessionKey: HexAddress, connectedAddress: HexAddress): Promise<SessionAuthority> {
  const [connectedRole, sessionKeyRole, sessionKey] = await Promise.all([
    readRoleOfDirect(provider, mandateAccount, connectedAddress),
    readRoleOfDirect(provider, mandateAccount, expectedSessionKey),
    readSessionKeyDirect(provider, mandateAccount, expectedSessionKey)
  ]);
  return { connectedRole, sessionKeyRole, sessionKey };
}

export async function previewSafeActionDirect(provider: DirectProvider, mandateAccount: HexAddress, action: MandateAction, prices: PriceData[]): Promise<PreviewResult> {
  const result = await readContractDirect(provider, mandateAccount, encodeFunctionData({ abi: mandateAccountAbi, functionName: "previewAction", args: [action, prices] }));
  return normalizePreviewResult(decodeFunctionResult({ abi: mandateAccountAbi, functionName: "previewAction", data: result }));
}

export async function computeActionIdDirect(provider: DirectProvider, mandateAccount: HexAddress, action: MandateAction): Promise<`0x${string}`> {
  const result = await readContractDirect(provider, mandateAccount, encodeFunctionData({ abi: mandateAccountAbi, functionName: "computeActionId", args: [action] }));
  return decodeFunctionResult({ abi: mandateAccountAbi, functionName: "computeActionId", data: result }) as `0x${string}`;
}

export async function simulateSubmitSafeActionDirect(
  provider: DirectProvider,
  { from, mandateAccount, action, prices }: { from: HexAddress; mandateAccount: HexAddress; action: MandateAction; prices: PriceData[] }
): Promise<SubmitSafeActionResult> {
  const result = await readContractDirect(provider, mandateAccount, buildSubmitSafeActionTransactionRequest({ from, mandateAccount, action, prices }).data, from);
  return normalizeSubmitResult(decodeFunctionResult({ abi: mandateAccountAbi, functionName: "submitAction", data: result }));
}

export async function simulateExecuteSafeActionDirect(
  provider: DirectProvider,
  { from, mandateAccount, action, prices }: { from: HexAddress; mandateAccount: HexAddress; action: MandateAction; prices: PriceData[] }
): Promise<bigint> {
  const result = await readContractDirect(provider, mandateAccount, buildExecuteSafeActionTransactionRequest({ from, mandateAccount, action, prices }).data, from);
  return BigInt(decodeFunctionResult({ abi: mandateAccountAbi, functionName: "executeAction", data: result }).toString());
}

export function buildSubmitSafeActionTransactionRequest({
  from,
  mandateAccount,
  action,
  prices
}: {
  from: HexAddress;
  mandateAccount: HexAddress;
  action: MandateAction;
  prices: PriceData[];
}): SafeActionTransactionRequest {
  return {
    from,
    to: mandateAccount,
    data: encodeFunctionData({ abi: mandateAccountAbi, functionName: "submitAction", args: [action, prices] })
  };
}

export function buildExecuteSafeActionTransactionRequest({
  from,
  mandateAccount,
  action,
  prices
}: {
  from: HexAddress;
  mandateAccount: HexAddress;
  action: MandateAction;
  prices: PriceData[];
}): SafeActionTransactionRequest {
  return {
    from,
    to: mandateAccount,
    data: encodeFunctionData({ abi: mandateAccountAbi, functionName: "executeAction", args: [action, prices] })
  };
}

export async function submitSafeActionDirect(
  provider: DirectProvider,
  { from, mandateAccount, action, prices }: { from: HexAddress; mandateAccount: HexAddress; action: MandateAction; prices: PriceData[] }
): Promise<`0x${string}`> {
  const hash = await provider.request({ method: "eth_sendTransaction", params: [buildSubmitSafeActionTransactionRequest({ from, mandateAccount, action, prices })] });
  if (typeof hash !== "string" || !hash.startsWith("0x")) throw new Error("eth_sendTransaction did not return a transaction hash.");
  return hash as `0x${string}`;
}

export async function executeSafeActionDirect(
  provider: DirectProvider,
  { from, mandateAccount, action, prices }: { from: HexAddress; mandateAccount: HexAddress; action: MandateAction; prices: PriceData[] }
): Promise<`0x${string}`> {
  const hash = await provider.request({ method: "eth_sendTransaction", params: [buildExecuteSafeActionTransactionRequest({ from, mandateAccount, action, prices })] });
  if (typeof hash !== "string" || !hash.startsWith("0x")) throw new Error("eth_sendTransaction did not return a transaction hash.");
  return hash as `0x${string}`;
}

export async function readDecisionDirect(provider: DirectProvider, mandateAccount: HexAddress, actionId: `0x${string}`): Promise<DecisionState> {
  const result = await readContractDirect(provider, mandateAccount, encodeFunctionData({ abi: mandateAccountAbi, functionName: "decisions", args: [actionId] }));
  return normalizeDecisionState(decodeFunctionResult({ abi: mandateAccountAbi, functionName: "decisions", data: result }));
}

export function getSafeExecuteDisabledReason({
  pending,
  providerPresent,
  isConnected,
  isCorrectChain,
  connectedAddress,
  expectedSessionKey,
  connectedRole,
  sessionKeyEnabled,
  nativeBalance,
  safeActionReady,
  pricesReady,
  previewCode,
  decisionStatus
}: SafeExecuteDisabledReasonInput): string | null {
  if (pending) return "Safe action transaction is already pending.";
  if (!providerPresent) return "No injected wallet provider detected.";
  if (!isConnected) return "Connect the default session key wallet before safe execution.";
  if (!isCorrectChain) return "Switch to Robinhood Chain testnet before safe execution.";
  if (!connectedAddress || connectedAddress.toLowerCase() !== expectedSessionKey.toLowerCase()) return "Connect the default session key wallet for safe execution.";
  if (connectedRole !== Role.SESSION) return "Connected wallet does not have SESSION role.";
  if (!sessionKeyEnabled) return "Default session key is not enabled onchain.";
  if (nativeBalance === null) return "Native ETH balance is not loaded yet.";
  if (nativeBalance <= 0n) return "Connected wallet has no native ETH for gas.";
  if (!safeActionReady) return "Safe action is not ready yet.";
  if (!pricesReady) return "Signed price rows are not loaded yet.";
  if (previewCode === undefined) return "Safe preview is not ready yet.";
  if (previewCode !== ReasonCode.OK) return `Safe preview is ${reasonLabel(previewCode)}, not OK.`;
  if (decisionStatus === DecisionStatus.EXECUTED) return "Safe action has already executed.";
  return null;
}

async function readContractDirect(provider: DirectProvider, to: HexAddress, data: `0x${string}`, from?: HexAddress): Promise<`0x${string}`> {
  const call: { from?: HexAddress; to: HexAddress; data: `0x${string}` } = from ? { from, to, data } : { to, data };
  const result = await provider.request({ method: "eth_call", params: [call, "latest"] });
  if (typeof result !== "string" || !result.startsWith("0x")) throw new Error("eth_call did not return hex data.");
  return result as `0x${string}`;
}

function normalizeMandateConfig(result: unknown): MandateConfig {
  const value = unwrapTuple(result) as { mandateVersion?: bigint; maxSingleAssetExposureBps?: number; maxTradeSizeUSDG?: bigint; maxDailyTurnoverBps?: number; cooldownSeconds?: bigint } | readonly unknown[];
  if (Array.isArray(value)) {
    return {
      mandateVersion: BigInt(String(value[0])),
      maxSingleAssetExposureBps: Number(value[1]),
      maxTradeSizeUSDG: BigInt(String(value[2])),
      maxDailyTurnoverBps: Number(value[3]),
      cooldownSeconds: BigInt(String(value[4]))
    };
  }
  const objectValue = value as { mandateVersion?: bigint; maxSingleAssetExposureBps?: number; maxTradeSizeUSDG?: bigint; maxDailyTurnoverBps?: number; cooldownSeconds?: bigint };
  return {
    mandateVersion: BigInt(String(objectValue.mandateVersion)),
    maxSingleAssetExposureBps: Number(objectValue.maxSingleAssetExposureBps),
    maxTradeSizeUSDG: BigInt(String(objectValue.maxTradeSizeUSDG)),
    maxDailyTurnoverBps: Number(objectValue.maxDailyTurnoverBps),
    cooldownSeconds: BigInt(String(objectValue.cooldownSeconds))
  };
}

function normalizeSessionKey(result: unknown): SessionKeyState {
  const value = result as { enabled?: boolean; validUntil?: bigint; allowedActionTypes?: number; maxAmountInPerAction?: bigint; scopeHash?: `0x${string}` } | readonly unknown[];
  if (Array.isArray(value)) {
    return {
      enabled: Boolean(value[0]),
      validUntil: BigInt(String(value[1])),
      allowedActionTypes: Number(value[2]),
      maxAmountInPerAction: BigInt(String(value[3])),
      scopeHash: value[4] as `0x${string}`
    };
  }
  const objectValue = value as { enabled?: boolean; validUntil?: bigint; allowedActionTypes?: number; maxAmountInPerAction?: bigint; scopeHash?: `0x${string}` };
  return {
    enabled: Boolean(objectValue.enabled),
    validUntil: BigInt(String(objectValue.validUntil)),
    allowedActionTypes: Number(objectValue.allowedActionTypes),
    maxAmountInPerAction: BigInt(String(objectValue.maxAmountInPerAction)),
    scopeHash: objectValue.scopeHash ?? "0x0000000000000000000000000000000000000000000000000000000000000000"
  };
}

function normalizePreviewResult(result: unknown): PreviewResult {
  const value = result as readonly unknown[];
  return { code: Number(value[0]), preExposureBps: Number(value[1]), postExposureBps: Number(value[2]) };
}

function normalizeSubmitResult(result: unknown): SubmitSafeActionResult {
  const value = result as readonly unknown[];
  return { actionId: value[0] as `0x${string}`, code: Number(value[1]), preExposureBps: Number(value[2]), postExposureBps: Number(value[3]) };
}

function normalizeDecisionState(result: unknown): DecisionState {
  const value = result as { status?: number; mandateVersion?: bigint; submittedAt?: bigint; expiresAt?: bigint; priceDigest?: `0x${string}`; priceTimestamp?: bigint } | readonly unknown[];
  if (Array.isArray(value)) {
    return {
      status: Number(value[0]),
      mandateVersion: BigInt(String(value[1])),
      submittedAt: BigInt(String(value[2])),
      expiresAt: BigInt(String(value[3])),
      priceDigest: value[4] as `0x${string}`,
      priceTimestamp: BigInt(String(value[5]))
    };
  }
  const objectValue = value as { status?: number; mandateVersion?: bigint; submittedAt?: bigint; expiresAt?: bigint; priceDigest?: `0x${string}`; priceTimestamp?: bigint };
  return {
    status: Number(objectValue.status),
    mandateVersion: BigInt(String(objectValue.mandateVersion)),
    submittedAt: BigInt(String(objectValue.submittedAt)),
    expiresAt: BigInt(String(objectValue.expiresAt)),
    priceDigest: objectValue.priceDigest ?? "0x0000000000000000000000000000000000000000000000000000000000000000",
    priceTimestamp: BigInt(String(objectValue.priceTimestamp))
  };
}

function unwrapTuple(result: unknown): unknown {
  if (Array.isArray(result) && result.length === 1 && (Array.isArray(result[0]) || typeof result[0] === "object")) return result[0];
  return result;
}
