import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { buildMandateAction } from "./actions";
import { mandateAccountAbi } from "./abis";
import { buildPriceUrl, normalizePriceResponse, type PriceApiResponse } from "./prices";
import { DecisionStatus, ReasonCode, Role, decisionStatusLabel, reasonLabel } from "./reasons";
import type { MandateDeployment, PriceData, PreviewResult, SessionKeyState } from "./types";

export type DemoAgentActionKind = "safe" | "dangerous";

export type ParsedDemoAgentActionRequest =
  | { ok: true; kind: DemoAgentActionKind }
  | { ok: false; status: 400; body: { ok: false; reason: "invalid_request"; message: string } };

export type DemoAgentDependencies = {
  writes?: string[];
  priceRows: () => Promise<PriceData[]>;
  publicClient: {
    getChainId: () => Promise<number>;
    readContract: (args: { functionName: string; args?: unknown[] }) => Promise<unknown>;
    waitForTransactionReceipt: (args: { hash: Hex }) => Promise<{ status: string }>;
  };
  walletClient: {
    writeContract: (args: { functionName: string; args?: unknown[] }) => Promise<Hex>;
  };
};

export type DemoAgentResult =
  | { ok: false; reason: "session_key_mismatch" | "wrong_chain" | "session_key_inactive" | "prices_missing" | "prices_stale" | "preview_not_ok"; message: string; previewReason?: string; preview?: PreviewResult }
  | {
      ok: true;
      kind: DemoAgentActionKind;
      actionId: Hex;
      preview: PreviewResult;
      previewReason: string;
      submitTxHash: Hex;
      submitReceiptStatus: string;
      decisionStatus: string;
      executeTxHash?: Hex;
      executeReceiptStatus?: string;
      blockedReason?: string;
    };

export function createDemoAgentDependencies({
  deployment,
  privateKey,
  rpcUrl,
  priceUrl
}: {
  deployment: MandateDeployment;
  privateKey: Hex;
  rpcUrl: string;
  priceUrl: string;
}): DemoAgentDependencies {
  if (!rpcUrl) throw new Error("NEXT_PUBLIC_ROBINHOOD_RPC_URL is not configured for the demo agent relayer.");
  if (!priceUrl) throw new Error("NEXT_PUBLIC_MANDATE_PRICE_URL is not configured for the demo agent relayer.");

  const chain = defineChain({
    id: deployment.chainId,
    name: "Robinhood Chain Testnet",
    nativeCurrency: { name: "Test Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } }
  });
  const transport = http(rpcUrl);
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  return {
    priceRows: async () => {
      const response = await fetch(buildPriceUrl(priceUrl, deployment), { cache: "no-store" });
      if (!response.ok) throw new Error(`Price signer returned HTTP ${response.status}`);
      return normalizePriceResponse((await response.json()) as PriceApiResponse, deployment);
    },
    publicClient: {
      getChainId: () => publicClient.getChainId(),
      readContract: ({ functionName, args }) =>
        publicClient.readContract({
          address: deployment.contracts.mandateAccount,
          abi: mandateAccountAbi,
          functionName: functionName as never,
          args: args as never
        }),
      waitForTransactionReceipt: ({ hash }) => publicClient.waitForTransactionReceipt({ hash }).then((receipt) => ({ status: receipt.status }))
    },
    walletClient: {
      writeContract: ({ functionName, args }) =>
        walletClient.writeContract({
          address: deployment.contracts.mandateAccount,
          abi: mandateAccountAbi,
          functionName: functionName as never,
          args: args as never
        })
    }
  };
}

export function parseDemoAgentActionRequest(body: unknown): ParsedDemoAgentActionRequest {
  const message = "Request body must be exactly { kind: 'safe' } or { kind: 'dangerous' }.";
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, body: { ok: false, reason: "invalid_request", message } };
  }
  const entries = Object.entries(body as Record<string, unknown>);
  if (entries.length !== 1 || entries[0][0] !== "kind" || (entries[0][1] !== "safe" && entries[0][1] !== "dangerous")) {
    return { ok: false, status: 400, body: { ok: false, reason: "invalid_request", message } };
  }
  return { ok: true, kind: entries[0][1] };
}

export async function runDemoAgentAction({
  kind,
  deployment,
  privateKey,
  dependencies,
  nowSeconds
}: {
  kind: DemoAgentActionKind;
  deployment: MandateDeployment;
  privateKey: Hex;
  dependencies: DemoAgentDependencies;
  nowSeconds: () => number;
}): Promise<DemoAgentResult> {
  const sessionAddress = privateKeyToAccount(privateKey).address as Address;
  if (sessionAddress.toLowerCase() !== deployment.sessionKey.toLowerCase()) {
    return { ok: false, reason: "session_key_mismatch", message: "Configured demo agent session key does not match deployments/46630.json." };
  }

  const chainId = await dependencies.publicClient.getChainId();
  if (chainId !== deployment.chainId) {
    return { ok: false, reason: "wrong_chain", message: "Demo agent relayer RPC is not connected to Robinhood Chain testnet." };
  }

  const [role, sessionKey, actionSchemaVersion, nonce, prices] = await Promise.all([
    dependencies.publicClient.readContract({ functionName: "roleOf", args: [sessionAddress] }),
    dependencies.publicClient.readContract({ functionName: "sessionKeys", args: [sessionAddress] }),
    dependencies.publicClient.readContract({ functionName: "ACTION_SCHEMA_VERSION" }),
    dependencies.publicClient.readContract({ functionName: "nextNonce" }),
    dependencies.priceRows()
  ]);
  if (Number(role) !== Role.SESSION || !isActiveSessionKey(sessionKey, nowSeconds())) {
    return { ok: false, reason: "session_key_inactive", message: "Configured demo agent session key is not active onchain." };
  }
  if (prices.length === 0) {
    return { ok: false, reason: "prices_missing", message: "Demo agent relayer could not load signed price rows." };
  }
  if (prices.some((price) => price.validUntil < BigInt(nowSeconds()))) {
    return { ok: false, reason: "prices_stale", message: "Demo agent relayer loaded stale signed price rows." };
  }

  const action = buildMandateAction({ kind, deployment, actionSchemaVersion: Number(actionSchemaVersion), nonce: BigInt(String(nonce)), nowSeconds: nowSeconds() });
  const preview = normalizePreview(await dependencies.publicClient.readContract({ functionName: "previewAction", args: [action, prices] }));
  if (kind === "safe" && preview.code !== ReasonCode.OK) {
    return {
      ok: false,
      reason: "preview_not_ok",
      previewReason: reasonLabel(preview.code),
      preview,
      message: "Safe candidate is currently blocked under live portfolio state. Deposit more USDG or reduce safe amount."
    };
  }

  const actionId = (await dependencies.publicClient.readContract({ functionName: "computeActionId", args: [action] })) as Hex;
  const submitTxHash = await dependencies.walletClient.writeContract({ functionName: "submitAction", args: [action, prices] });
  const submitReceipt = await dependencies.publicClient.waitForTransactionReceipt({ hash: submitTxHash });
  const decision = normalizeDecision(await dependencies.publicClient.readContract({ functionName: "decisions", args: [actionId] }));

  if (kind === "dangerous") {
    return {
      ok: true,
      kind,
      actionId,
      preview,
      previewReason: reasonLabel(preview.code),
      submitTxHash,
      submitReceiptStatus: submitReceipt.status,
      decisionStatus: decisionStatusLabel(decision.status),
      blockedReason: reasonLabel(preview.code)
    };
  }

  if (decision.status !== DecisionStatus.APPROVED) {
    return {
      ok: true,
      kind,
      actionId,
      preview,
      previewReason: reasonLabel(preview.code),
      submitTxHash,
      submitReceiptStatus: submitReceipt.status,
      decisionStatus: decisionStatusLabel(decision.status)
    };
  }

  const executeTxHash = await dependencies.walletClient.writeContract({ functionName: "executeAction", args: [action, prices] });
  const executeReceipt = await dependencies.publicClient.waitForTransactionReceipt({ hash: executeTxHash });
  const executedDecision = normalizeDecision(await dependencies.publicClient.readContract({ functionName: "decisions", args: [actionId] }));
  return {
    ok: true,
    kind,
    actionId,
    preview,
    previewReason: reasonLabel(preview.code),
    submitTxHash,
    submitReceiptStatus: submitReceipt.status,
    decisionStatus: decisionStatusLabel(executedDecision.status),
    executeTxHash,
    executeReceiptStatus: executeReceipt.status
  };
}

function isActiveSessionKey(value: unknown, nowSeconds: number): boolean {
  const sessionKey = normalizeSessionKey(value);
  return sessionKey.enabled && sessionKey.validUntil >= BigInt(nowSeconds);
}

function normalizeSessionKey(value: unknown): SessionKeyState {
  if (Array.isArray(value)) {
    return {
      enabled: Boolean(value[0]),
      validUntil: BigInt(String(value[1])),
      allowedActionTypes: Number(value[2]),
      maxAmountInPerAction: BigInt(String(value[3])),
      scopeHash: value[4] as `0x${string}`
    };
  }

  const sessionKey = value as Partial<SessionKeyState>;
  return {
    enabled: Boolean(sessionKey.enabled),
    validUntil: BigInt(String(sessionKey.validUntil)),
    allowedActionTypes: Number(sessionKey.allowedActionTypes),
    maxAmountInPerAction: BigInt(String(sessionKey.maxAmountInPerAction)),
    scopeHash: sessionKey.scopeHash ?? "0x0000000000000000000000000000000000000000000000000000000000000000"
  };
}

function normalizePreview(value: unknown): PreviewResult {
  if (Array.isArray(value)) return { code: Number(value[0]), preExposureBps: Number(value[1]), postExposureBps: Number(value[2]) };
  const preview = value as { code?: number; preExposureBps?: number; postExposureBps?: number };
  return { code: Number(preview.code), preExposureBps: Number(preview.preExposureBps), postExposureBps: Number(preview.postExposureBps) };
}

function normalizeDecision(value: unknown): { status: number } {
  if (Array.isArray(value)) return { status: Number(value[0]) };
  const decision = value as { status?: number };
  return { status: Number(decision.status ?? DecisionStatus.NONE) };
}
