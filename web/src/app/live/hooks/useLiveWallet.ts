"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  clearLiveActivityItems as clearStoredLiveActivityItems,
  createApprovalActivity,
  createDangerousBlockedActivity,
  createDepositActivity,
  createFailureActivity,
  createMintActivity,
  createSafeExecutionActivity,
  createSafeSubmitActivity,
  loadLiveActivityItems,
  saveLiveActivityItems,
  type LiveActivityItem,
  type LiveActivityStorage
} from "../activity";
import { publicRpcUrl } from "../../../lib/mandate/chain";
import { type FundingPresetId, type FundingTokenKey, fundingPresets, fundingTokenKeys } from "../../../lib/mandate/funding";
import { buildPriceUrl, normalizePriceResponse, type PriceApiResponse } from "../../../lib/mandate/prices";
import { DecisionStatus, ReasonCode, decisionStatusLabel, reasonLabel, roleLabel } from "../../../lib/mandate/reasons";
import type { MandateAction, MandateConfig, MandateDeployment, PreviewResult, PriceData } from "../../../lib/mandate/types";
import { approveExactAmountDirect, buildApproveTransactionRequest, isApprovalRequired, readAllowanceDirect } from "./liveApprovalRequests";
import {
  buildDepositTransactionRequest,
  depositIntoMandateAccountDirect,
  getDepositDisabledReason,
  readMandateAccountTokenBalanceDirect
} from "./liveDepositRequests";
import {
  buildLiveMintTokens,
  buildMintTransactionRequest,
  formatTokenAmount18,
  mintProjectDemoTokenDirect,
  parseTokenAmount18,
  readTokenBalanceDirect,
  waitForTransactionReceiptDirect
} from "./liveMintRequests";
import {
  buildExecuteSafeActionTransactionRequest,
  buildStageFSafeAction,
  buildSubmitSafeActionTransactionRequest,
  computeActionIdDirect,
  executeSafeActionDirect,
  getSafeExecuteDisabledReason,
  previewSafeActionDirect,
  readActionSchemaVersionDirect,
  readAdapterAllowedDirect,
  readAllowedAssetsDirect,
  readDecisionDirect,
  readMandateConfigDirect,
  readNextNonceDirect,
  readPriceOracleDirect,
  readSessionAuthorityDirect,
  simulateExecuteSafeActionDirect,
  simulateSubmitSafeActionDirect,
  submitSafeActionDirect,
  type DecisionState,
  type SessionAuthority,
  type SubmitSafeActionResult
} from "./liveSafeActionRequests";
import {
  type DirectProvider,
  type HexAddress,
  ROBINHOOD_CHAIN_ID_DECIMAL,
  connectWalletDirect,
  firstAddress,
  parseChainId,
  readChainIdDirect,
  readNativeBalanceDirect,
  switchToRobinhoodChainDirect
} from "./liveWalletRequests";

type WalletDebugState = {
  lastClickedButton: string;
  lastHandlerEntered: string;
  lastRequestMethod: string;
  lastRequestStatus: string;
  lastRequestError: string;
  lastTransactionRequest: string;
  lastApprovalSpender: string;
  lastApprovalRequest: string;
  lastApprovalResult: string;
  lastApprovalError: string;
  lastDepositMandateAccount: string;
  lastDepositRequest: string;
  lastDepositResult: string;
  lastDepositError: string;
  lastSimulationStart: string;
  lastSimulationResult: string;
  lastSimulationError: string;
  lastWriteStart: string;
  lastWriteResult: string;
  lastWriteError: string;
  lastTxHash: string;
  lastReceiptStatus: string;
};

type TokenBalances = Record<FundingTokenKey, bigint | null>;
type SafeActionStep = "idle" | "submitting" | "approved" | "executing" | "executed" | "error";
type AgentRelayerSuccess = {
  ok: true;
  kind: "safe" | "dangerous";
  actionId: `0x${string}`;
  preview: PreviewResult;
  previewReason: string;
  submitTxHash: `0x${string}`;
  submitReceiptStatus: string;
  decisionStatus: string;
  executeTxHash?: `0x${string}`;
  executeReceiptStatus?: string;
  blockedReason?: string;
};
type AgentRelayerResponse = AgentRelayerSuccess | { ok: false; reason: string; message: string; preview?: PreviewResult; previewReason?: string };

const initialDebugState: WalletDebugState = {
  lastClickedButton: "none",
  lastHandlerEntered: "none",
  lastRequestMethod: "none",
  lastRequestStatus: "none",
  lastRequestError: "none",
  lastTransactionRequest: "none in Stage E",
  lastApprovalSpender: "none",
  lastApprovalRequest: "none in Stage E",
  lastApprovalResult: "not started in Stage E",
  lastApprovalError: "none",
  lastDepositMandateAccount: "none",
  lastDepositRequest: "none in Stage E",
  lastDepositResult: "not started in Stage E",
  lastDepositError: "none",
  lastSimulationStart: "not started in Stage E",
  lastSimulationResult: "not started in Stage E",
  lastSimulationError: "not started in Stage E",
  lastWriteStart: "not started in Stage E",
  lastWriteResult: "not started in Stage E",
  lastWriteError: "none",
  lastTxHash: "none",
  lastReceiptStatus: "none"
};

export type LiveWalletState = ReturnType<typeof useLiveWallet>;

export function useLiveWallet(deployment: MandateDeployment) {
  const mandateAccountAddress = deployment.contracts.mandateAccount as HexAddress;
  const approvalSpender = mandateAccountAddress;
  const [provider] = useState<DirectProvider | null>(() => (typeof window === "undefined" ? null : window.ethereum ?? null));
  const [address, setAddress] = useState<HexAddress | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [nativeBalance, setNativeBalance] = useState<bigint | null>(null);
  const [nativeBalanceLoading, setNativeBalanceLoading] = useState(false);
  const [nativeBalanceError, setNativeBalanceError] = useState<string | null>(null);
  const [tokenBalances, setTokenBalances] = useState<TokenBalances>(() => emptyTokenBalances());
  const [tokenBalancesLoading, setTokenBalancesLoading] = useState(false);
  const [tokenBalancesError, setTokenBalancesError] = useState<string | null>(null);
  const [mandateAccountBalances, setMandateAccountBalances] = useState<TokenBalances>(() => emptyTokenBalances());
  const [mandateAccountBalancesLoading, setMandateAccountBalancesLoading] = useState(false);
  const [mandateAccountBalancesError, setMandateAccountBalancesError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [connectPending, setConnectPending] = useState(false);
  const [switchPending, setSwitchPending] = useState(false);
  const [selectedMintPresetId, setSelectedMintPresetId] = useState<FundingPresetId>("usdg-200");
  const [mintPending, setMintPending] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintTxHash, setMintTxHash] = useState<`0x${string}` | null>(null);
  const [mintReceiptStatus, setMintReceiptStatus] = useState("none");
  const [mintTransactionRequest, setMintTransactionRequest] = useState("none");
  const [selectedAllowance, setSelectedAllowance] = useState<bigint | null>(null);
  const [allowanceLoading, setAllowanceLoading] = useState(false);
  const [allowanceError, setAllowanceError] = useState<string | null>(null);
  const [approvalPending, setApprovalPending] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvalTxHash, setApprovalTxHash] = useState<`0x${string}` | null>(null);
  const [approvalReceiptStatus, setApprovalReceiptStatus] = useState("none");
  const [approvalTransactionRequest, setApprovalTransactionRequest] = useState("none");
  const [depositPending, setDepositPending] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositTxHash, setDepositTxHash] = useState<`0x${string}` | null>(null);
  const [depositReceiptStatus, setDepositReceiptStatus] = useState("none");
  const [depositTransactionRequest, setDepositTransactionRequest] = useState("none");
  const [mandateConfig, setMandateConfig] = useState<MandateConfig | null>(null);
  const [allowedAssets, setAllowedAssets] = useState<HexAddress[]>([]);
  const [safeAdapterAllowed, setSafeAdapterAllowed] = useState<boolean | null>(null);
  const [priceOracle, setPriceOracle] = useState<HexAddress | null>(null);
  const [actionSchemaVersion, setActionSchemaVersion] = useState<number | null>(null);
  const [nextNonce, setNextNonce] = useState<bigint | null>(null);
  const [sessionAuthority, setSessionAuthority] = useState<SessionAuthority | null>(null);
  const [mandateSessionLoading, setMandateSessionLoading] = useState(false);
  const [mandateSessionError, setMandateSessionError] = useState<string | null>(null);
  const [priceRows, setPriceRows] = useState<PriceData[] | null>(null);
  const [priceRowsLoading, setPriceRowsLoading] = useState(false);
  const [priceRowsError, setPriceRowsError] = useState<string | null>(null);
  const [safeAction, setSafeAction] = useState<MandateAction | null>(null);
  const [safePreview, setSafePreview] = useState<PreviewResult | null>(null);
  const [safePreviewLoading, setSafePreviewLoading] = useState(false);
  const [safePreviewError, setSafePreviewError] = useState<string | null>(null);
  const [safeActionPending, setSafeActionPending] = useState(false);
  const [safeActionStep, setSafeActionStep] = useState<SafeActionStep>("idle");
  const [safeActionError, setSafeActionError] = useState<string | null>(null);
  const [safeActionId, setSafeActionId] = useState<`0x${string}` | null>(null);
  const [safeDecision, setSafeDecision] = useState<DecisionState | null>(null);
  const [safeSubmitSimulation, setSafeSubmitSimulation] = useState<SubmitSafeActionResult | null>(null);
  const [safeSubmitTxHash, setSafeSubmitTxHash] = useState<`0x${string}` | null>(null);
  const [safeSubmitReceiptStatus, setSafeSubmitReceiptStatus] = useState("none");
  const [safeSubmitTransactionRequest, setSafeSubmitTransactionRequest] = useState("none");
  const [safeExecuteTxHash, setSafeExecuteTxHash] = useState<`0x${string}` | null>(null);
  const [safeExecuteReceiptStatus, setSafeExecuteReceiptStatus] = useState("none");
  const [safeExecuteTransactionRequest, setSafeExecuteTransactionRequest] = useState("none");
  const [dangerousActionPending, setDangerousActionPending] = useState(false);
  const [dangerousActionError, setDangerousActionError] = useState<string | null>(null);
  const [dangerousActionResult, setDangerousActionResult] = useState<AgentRelayerSuccess | null>(null);
  const [debug, setDebug] = useState<WalletDebugState>(initialDebugState);
  const [activityItems, setActivityItems] = useState<LiveActivityItem[]>(() => loadLiveActivityItems(getLiveActivityStorage()));

  const instrumentedProvider = useMemo(() => (provider ? instrumentProvider(provider, setDebug) : null), [provider]);
  const recordActivity = useCallback((item: LiveActivityItem) => {
    setActivityItems((current) => saveLiveActivityItems(getLiveActivityStorage(), [item, ...current].slice(0, 50)));
  }, []);
  const clearActivityItems = useCallback(() => {
    setActivityItems(clearStoredLiveActivityItems(getLiveActivityStorage()));
  }, []);
  const mintTokens = useMemo(() => buildLiveMintTokens(deployment), [deployment]);
  const selectedMintPreset = fundingPresets.find((preset) => preset.id === selectedMintPresetId) ?? fundingPresets[0];
  const selectedMintToken = mintTokens.find((token) => token.token === selectedMintPreset.token) ?? mintTokens[0];
  const selectedMintAmount = useMemo(() => parseTokenAmount18(selectedMintPreset.amount), [selectedMintPreset.amount]);
  const selectedMintAmountLabel = `${formatTokenAmount18(selectedMintAmount)} ${selectedMintToken.label}`;
  const selectedTokenBalance = tokenBalances[selectedMintToken.token];
  const tokenBalanceRows = mintTokens.map((token) => ({ ...token, balance: tokenBalances[token.token] }));
  const mandateAccountBalanceRows = mintTokens.map((token) => ({ ...token, balance: mandateAccountBalances[token.token] }));
  const approvalRequired = selectedAllowance === null ? null : isApprovalRequired(selectedAllowance, selectedMintAmount);
  const isConnected = address !== null;
  const isCorrectChain = chainId === ROBINHOOD_CHAIN_ID_DECIMAL;
  const priceEndpointUrl = process.env.NEXT_PUBLIC_MANDATE_PRICE_URL ?? "";
  const configError = null;
  const priceConfigError = priceEndpointUrl ? null : "NEXT_PUBLIC_MANDATE_PRICE_URL is not configured for safe action preview.";
  const connectDisabledReason = connectPending ? "Wallet connection request is already pending." : provider ? (isConnected ? "Wallet already connected." : null) : "No injected wallet provider detected.";
  const switchChainDisabledReason = switchPending
    ? "Network switch request is already pending."
    : !provider
      ? "No injected wallet provider detected."
      : !isConnected
        ? "Connect a wallet before switching networks."
        : isCorrectChain
          ? "Wallet is already on Robinhood Chain testnet."
          : null;
  const refreshBalanceDisabledReason = nativeBalanceLoading || tokenBalancesLoading || mandateAccountBalancesLoading || allowanceLoading
    ? "Balance or allowance read is already pending."
    : !provider
      ? "No injected wallet provider detected."
      : !isConnected
        ? "Connect a wallet before reading balances."
        : !isCorrectChain
          ? "Switch to Robinhood Chain testnet before reading balances."
          : null;
  const mintDisabledReason = mintPending
    ? "Mint transaction is already pending."
    : !provider
      ? "No injected wallet provider detected."
      : !isConnected
        ? "Connect a wallet before minting project demo tokens."
        : !isCorrectChain
          ? "Switch to Robinhood Chain testnet before minting project demo tokens."
          : selectedMintToken
            ? null
            : "Select a project demo token preset before minting.";
  const approvalDisabledReason = approvalPending
    ? "Approval transaction is already pending."
    : !provider
      ? "No injected wallet provider detected."
      : !isConnected
        ? "Connect a wallet before approving a project demo token."
        : !isCorrectChain
          ? "Switch to Robinhood Chain testnet before approving a project demo token."
          : selectedMintAmount <= 0n
            ? "Selected amount is invalid."
            : selectedTokenBalance === null
              ? "Refresh wallet token balance before approval."
              : selectedTokenBalance < selectedMintAmount
                ? `Mint at least ${selectedMintAmountLabel} before approving.`
                : allowanceLoading
                  ? "Current allowance is still loading."
                  : selectedAllowance === null
                    ? "Current allowance is not loaded yet."
                    : !approvalRequired
                      ? "Allowance sufficient."
                      : null;
  const depositDisabledReason = getDepositDisabledReason({
    depositPending,
    providerPresent: provider !== null,
    isConnected,
    isCorrectChain,
    selectedTokenPresent: Boolean(selectedMintToken),
    selectedAmount: selectedMintAmount,
    selectedAmountLabel: selectedMintAmountLabel,
    selectedTokenBalance,
    allowanceLoading,
    selectedAllowance
  });
  const mandateSessionDisabledReason = mandateSessionLoading
    ? "Mandate and session reads are already loading."
    : !provider
      ? "No injected wallet provider detected."
      : !isConnected
        ? "Connect a wallet before reading mandate and session authority."
        : !isCorrectChain
          ? "Switch to Robinhood Chain testnet before reading mandate and session authority."
          : null;
  const safePreviewDisabledReason = safePreviewLoading || mandateSessionLoading || priceRowsLoading
    ? "Safe preview prerequisites are already loading."
    : !provider
      ? "No injected wallet provider detected."
      : !isConnected
        ? "Connect a wallet before previewing the safe action."
        : !isCorrectChain
          ? "Switch to Robinhood Chain testnet before previewing the safe action."
          : priceConfigError;
  const safeExecuteDisabledReason = getSafeExecuteDisabledReason({
    pending: safeActionPending,
    providerPresent: provider !== null,
    isConnected,
    isCorrectChain,
    connectedAddress: address,
    expectedSessionKey: deployment.sessionKey as HexAddress,
    connectedRole: sessionAuthority?.connectedRole ?? null,
    sessionKeyEnabled: sessionAuthority?.sessionKey.enabled ?? null,
    nativeBalance,
    safeActionReady: safeAction !== null,
    pricesReady: priceRows !== null,
    previewCode: safePreview?.code,
    decisionStatus: safeDecision?.status ?? null
  });
  const agentRelayerDisabledReason = safeActionPending || dangerousActionPending
    ? "Demo agent relayer transaction is already pending."
    : !isConnected
      ? "Connect the funding wallet before asking the demo agent to act."
      : !isCorrectChain
        ? "Switch to Robinhood Chain testnet before asking the demo agent to act."
        : null;
  const dangerousActionDisabledReason = dangerousActionPending || safeActionPending
    ? "Demo agent relayer transaction is already pending."
    : !isConnected
      ? "Connect the funding wallet before submitting blocked evidence."
      : !isCorrectChain
        ? "Switch to Robinhood Chain testnet before submitting blocked evidence."
        : null;

  const refreshAllowanceForToken = useCallback(
    async (providerForRead: DirectProvider, owner: HexAddress, tokenAddress: HexAddress) => {
      setAllowanceLoading(true);
      setAllowanceError(null);
      try {
        setSelectedAllowance(await readAllowanceDirect(providerForRead, tokenAddress, owner, approvalSpender));
      } catch (caught) {
        setAllowanceError(errorMessage(caught));
      } finally {
        setAllowanceLoading(false);
      }
    },
    [approvalSpender]
  );

  const refreshAllowanceFromProvider = useCallback(
    (providerForRead: DirectProvider, owner: HexAddress) => refreshAllowanceForToken(providerForRead, owner, selectedMintToken.address),
    [refreshAllowanceForToken, selectedMintToken.address]
  );

  const refreshTokenBalancesFromProvider = useCallback(
    async (providerForRead: DirectProvider, targetAddress: HexAddress) => {
      setTokenBalancesLoading(true);
      setTokenBalancesError(null);
      try {
        const entries = await Promise.all(mintTokens.map(async (token) => [token.token, await readTokenBalanceDirect(providerForRead, token.address, targetAddress)] as const));
        setTokenBalances(tokenBalanceMap(entries));
      } catch (caught) {
        setTokenBalancesError(errorMessage(caught));
      } finally {
        setTokenBalancesLoading(false);
      }
    },
    [mintTokens]
  );

  const refreshMandateAccountBalancesFromProvider = useCallback(
    async (providerForRead: DirectProvider) => {
      setMandateAccountBalancesLoading(true);
      setMandateAccountBalancesError(null);
      try {
        const entries = await Promise.all(mintTokens.map(async (token) => [token.token, await readMandateAccountTokenBalanceDirect(providerForRead, token.address, mandateAccountAddress)] as const));
        setMandateAccountBalances(tokenBalanceMap(entries));
      } catch (caught) {
        setMandateAccountBalancesError(errorMessage(caught));
      } finally {
        setMandateAccountBalancesLoading(false);
      }
    },
    [mandateAccountAddress, mintTokens]
  );

  const readNativeBalanceFromProvider = useCallback(async (providerForRead: DirectProvider) => {
    setNativeBalanceLoading(true);
    setNativeBalanceError(null);
    try {
      const balance = await readNativeBalanceDirect(providerForRead);
      setAddress(balance.address);
      setChainId(balance.chainId);
      setNativeBalance(balance.wei);
    } catch (caught) {
      setNativeBalanceError(errorMessage(caught));
    } finally {
      setNativeBalanceLoading(false);
    }
  }, []);

  const refreshMandateSessionReadsFromProvider = useCallback(
    async (providerForRead: DirectProvider, connectedAddress: HexAddress | null) => {
      setMandateSessionLoading(true);
      setMandateSessionError(null);
      try {
        const mandateAccount = mandateAccountAddress;
        const [nextActionSchemaVersion, nextActionNonce, nextMandateConfig, nextAllowedAssets, nextAdapterAllowed, nextPriceOracle] = await Promise.all([
          readActionSchemaVersionDirect(providerForRead, mandateAccount),
          readNextNonceDirect(providerForRead, mandateAccount),
          readMandateConfigDirect(providerForRead, mandateAccount),
          readAllowedAssetsDirect(providerForRead, mandateAccount),
          readAdapterAllowedDirect(providerForRead, mandateAccount, deployment.contracts.adapter as HexAddress),
          readPriceOracleDirect(providerForRead, mandateAccount)
        ]);
        setActionSchemaVersion(nextActionSchemaVersion);
        setNextNonce(nextActionNonce);
        setMandateConfig(nextMandateConfig);
        setAllowedAssets(nextAllowedAssets);
        setSafeAdapterAllowed(nextAdapterAllowed);
        setPriceOracle(nextPriceOracle);
        if (connectedAddress) setSessionAuthority(await readSessionAuthorityDirect(providerForRead, mandateAccount, deployment.sessionKey as HexAddress, connectedAddress));
      } catch (caught) {
        setMandateSessionError(errorMessage(caught));
      } finally {
        setMandateSessionLoading(false);
      }
    },
    [deployment.contracts.adapter, deployment.sessionKey, mandateAccountAddress]
  );

  const refreshPriceRowsFromEndpoint = useCallback(async () => {
    setPriceRowsLoading(true);
    setPriceRowsError(null);
    try {
      if (!priceEndpointUrl) throw new Error("NEXT_PUBLIC_MANDATE_PRICE_URL is not configured for safe action preview.");
      const response = await fetch(buildPriceUrl(priceEndpointUrl, deployment), { cache: "no-store" });
      if (!response.ok) throw new Error(`Price signer returned HTTP ${response.status}`);
      const json = (await response.json()) as PriceApiResponse;
      const rows = normalizePriceResponse(json, deployment);
      setPriceRows(rows);
      return rows;
    } catch (caught) {
      setPriceRows(null);
      setPriceRowsError(errorMessage(caught));
      throw caught;
    } finally {
      setPriceRowsLoading(false);
    }
  }, [deployment, priceEndpointUrl]);

  const refreshNativeBalance = useCallback(async () => {
    setDebug((current) => ({ ...current, lastClickedButton: "Refresh Balance", lastHandlerEntered: "refreshNativeBalance" }));
    setOperationError(null);

    const disabledReason = refreshBalanceDisabledReason;
    if (disabledReason) {
      setNativeBalanceError(disabledReason);
      setTokenBalancesError(disabledReason);
      setMandateAccountBalancesError(disabledReason);
      setAllowanceError(disabledReason);
      return;
    }
    if (!instrumentedProvider || !address) {
      setNativeBalanceError("Balance prerequisites are not ready.");
      return;
    }

    await readNativeBalanceFromProvider(instrumentedProvider);
    await refreshTokenBalancesFromProvider(instrumentedProvider, address);
    await refreshMandateAccountBalancesFromProvider(instrumentedProvider);
    await refreshAllowanceFromProvider(instrumentedProvider, address);
    await refreshMandateSessionReadsFromProvider(instrumentedProvider, address);
  }, [address, instrumentedProvider, readNativeBalanceFromProvider, refreshAllowanceFromProvider, refreshBalanceDisabledReason, refreshMandateAccountBalancesFromProvider, refreshMandateSessionReadsFromProvider, refreshTokenBalancesFromProvider]);

  const refreshMandateSessionReads = useCallback(async () => {
    setDebug((current) => ({ ...current, lastClickedButton: "Refresh mandate/session reads", lastHandlerEntered: "refreshMandateSessionReads" }));
    setMandateSessionError(null);

    const disabledReason = mandateSessionDisabledReason;
    if (disabledReason) {
      setMandateSessionError(disabledReason);
      return;
    }
    if (!instrumentedProvider || !address) {
      setMandateSessionError("Mandate and session prerequisites are not ready.");
      return;
    }

    await refreshMandateSessionReadsFromProvider(instrumentedProvider, address);
  }, [address, instrumentedProvider, mandateSessionDisabledReason, refreshMandateSessionReadsFromProvider]);

  const connectWallet = useCallback(async () => {
    setDebug((current) => ({ ...current, lastClickedButton: "Connect Wallet", lastHandlerEntered: "connectWallet" }));
    setOperationError(null);

    const disabledReason = connectDisabledReason;
    if (disabledReason) {
      setOperationError(disabledReason);
      return;
    }
    if (!instrumentedProvider) {
      setOperationError("No injected wallet provider detected.");
      return;
    }

    setConnectPending(true);
    try {
      const nextAddress = await connectWalletDirect(instrumentedProvider);
      setAddress(nextAddress);
      const nextChainId = await readChainIdDirect(instrumentedProvider);
      setChainId(nextChainId);
      if (nextAddress && nextChainId === ROBINHOOD_CHAIN_ID_DECIMAL) {
        await readNativeBalanceFromProvider(instrumentedProvider);
        await refreshTokenBalancesFromProvider(instrumentedProvider, nextAddress);
        await refreshMandateAccountBalancesFromProvider(instrumentedProvider);
        await refreshAllowanceFromProvider(instrumentedProvider, nextAddress);
        await refreshMandateSessionReadsFromProvider(instrumentedProvider, nextAddress);
      }
    } catch (caught) {
      setOperationError(errorMessage(caught));
    } finally {
      setConnectPending(false);
    }
  }, [connectDisabledReason, instrumentedProvider, readNativeBalanceFromProvider, refreshAllowanceFromProvider, refreshMandateAccountBalancesFromProvider, refreshMandateSessionReadsFromProvider, refreshTokenBalancesFromProvider]);

  const switchToRobinhoodChain = useCallback(async () => {
    setDebug((current) => ({ ...current, lastClickedButton: "Switch to Robinhood Chain", lastHandlerEntered: "switchToRobinhoodChain" }));
    setOperationError(null);

    const disabledReason = switchChainDisabledReason;
    if (disabledReason) {
      setOperationError(disabledReason);
      return;
    }
    if (!instrumentedProvider) {
      setOperationError("No injected wallet provider detected.");
      return;
    }

    setSwitchPending(true);
    try {
      await switchToRobinhoodChainDirect(instrumentedProvider, publicRpcUrl());
      setChainId(ROBINHOOD_CHAIN_ID_DECIMAL);
      await readNativeBalanceFromProvider(instrumentedProvider);
      await refreshMandateAccountBalancesFromProvider(instrumentedProvider);
      if (address) {
        await refreshTokenBalancesFromProvider(instrumentedProvider, address);
        await refreshAllowanceFromProvider(instrumentedProvider, address);
        await refreshMandateSessionReadsFromProvider(instrumentedProvider, address);
      }
    } catch (caught) {
      setOperationError(errorMessage(caught));
    } finally {
      setSwitchPending(false);
    }
  }, [address, instrumentedProvider, readNativeBalanceFromProvider, refreshAllowanceFromProvider, refreshMandateAccountBalancesFromProvider, refreshMandateSessionReadsFromProvider, refreshTokenBalancesFromProvider, switchChainDisabledReason]);

  const selectMintPreset = useCallback(
    (presetId: FundingPresetId) => {
      setSelectedMintPresetId(presetId);
      setMintError(null);
      setApprovalError(null);
      setDepositError(null);
      setSelectedAllowance(null);
      setAllowanceError(null);

      const preset = fundingPresets.find((item) => item.id === presetId);
      const token = preset ? mintTokens.find((item) => item.token === preset.token) : null;
      if (instrumentedProvider && address && chainId === ROBINHOOD_CHAIN_ID_DECIMAL && token) void refreshAllowanceForToken(instrumentedProvider, address, token.address);
    },
    [address, chainId, instrumentedProvider, mintTokens, refreshAllowanceForToken]
  );

  const mintProjectDemoToken = useCallback(async () => {
    setDebug((current) => ({ ...current, lastClickedButton: `Mint ${selectedMintPreset.label}`, lastHandlerEntered: "mintProjectDemoToken", lastWriteError: "none" }));
    setOperationError(null);
    setMintError(null);

    const disabledReason = mintDisabledReason;
    if (disabledReason) {
      setMintError(disabledReason);
      setDebug((current) => ({ ...current, lastWriteError: disabledReason }));
      return;
    }
    if (!instrumentedProvider || !address || !selectedMintToken) {
      const message = "Mint prerequisites are not ready.";
      setMintError(message);
      setDebug((current) => ({ ...current, lastWriteError: message }));
      return;
    }

    const transactionRequest = buildMintTransactionRequest({ from: address, tokenAddress: selectedMintToken.address, amount: selectedMintAmount });
    const transactionRequestJson = JSON.stringify(transactionRequest, null, 2);
    setMintTransactionRequest(transactionRequestJson);
    setMintTxHash(null);
    setMintReceiptStatus("none");
    setDebug((current) => ({
      ...current,
      lastTransactionRequest: transactionRequestJson,
      lastWriteStart: "awaiting wallet signature",
      lastWriteResult: "pending wallet signature",
      lastTxHash: "none",
      lastReceiptStatus: "none"
    }));

    setMintPending(true);
    recordActivity(createMintActivity({ id: activityId("mint"), status: "pending", token: selectedMintToken.label, amountLabel: selectedMintAmountLabel, timestamp: Date.now() }));
    try {
      const hash = await mintProjectDemoTokenDirect(instrumentedProvider, { from: address, tokenAddress: selectedMintToken.address, amount: selectedMintAmount });
      setMintTxHash(hash);
      recordActivity(createMintActivity({ id: activityId("mint"), status: "submitted", token: selectedMintToken.label, amountLabel: selectedMintAmountLabel, txHash: hash, timestamp: Date.now() }));
      setDebug((current) => ({ ...current, lastWriteResult: "transaction submitted", lastTxHash: hash, lastReceiptStatus: "confirming" }));

      const receipt = await waitForTransactionReceiptDirect(instrumentedProvider, hash);
      const status = receiptStatusLabel(receipt.status);
      setMintReceiptStatus(status);
      setDebug((current) => ({ ...current, lastReceiptStatus: status }));

      if (receipt.status !== "0x1") {
        const message = `Mint transaction failed with receipt status ${status}.`;
        setMintError(message);
        recordActivity(createMintActivity({ id: activityId("mint"), status: "failed", token: selectedMintToken.label, amountLabel: selectedMintAmountLabel, txHash: hash, message, timestamp: Date.now() }));
        setDebug((current) => ({ ...current, lastWriteResult: "failed", lastWriteError: message }));
        return;
      }

      recordActivity(createMintActivity({ id: activityId("mint"), status: "confirmed", token: selectedMintToken.label, amountLabel: selectedMintAmountLabel, txHash: hash, timestamp: Date.now() }));
      setDebug((current) => ({ ...current, lastWriteResult: "confirmed", lastWriteError: "none" }));
      await refreshTokenBalancesFromProvider(instrumentedProvider, address);
      await refreshAllowanceFromProvider(instrumentedProvider, address);
    } catch (caught) {
      const message = errorCodeMessage(caught);
      setMintError(message);
      recordActivity(createMintActivity({ id: activityId("mint"), status: isWalletRejection(caught) ? "rejected" : "failed", token: selectedMintToken.label, amountLabel: selectedMintAmountLabel, message, timestamp: Date.now() }));
      setDebug((current) => ({ ...current, lastWriteResult: "failed", lastWriteError: message }));
    } finally {
      setMintPending(false);
    }
  }, [address, instrumentedProvider, mintDisabledReason, recordActivity, refreshAllowanceFromProvider, refreshTokenBalancesFromProvider, selectedMintAmount, selectedMintAmountLabel, selectedMintPreset.label, selectedMintToken]);

  const approveExactAmount = useCallback(async () => {
    setDebug((current) => ({
      ...current,
      lastClickedButton: "Approve exact amount",
      lastHandlerEntered: "approveExactAmount",
      lastApprovalSpender: approvalSpender,
      lastApprovalError: "none",
      lastWriteError: "none"
    }));
    setOperationError(null);
    setApprovalError(null);

    const disabledReason = approvalDisabledReason;
    if (disabledReason) {
      setApprovalError(disabledReason);
      setDebug((current) => ({ ...current, lastApprovalError: disabledReason, lastWriteError: disabledReason }));
      return;
    }
    if (!instrumentedProvider || !address || !selectedMintToken) {
      const message = "Approval prerequisites are not ready.";
      setApprovalError(message);
      setDebug((current) => ({ ...current, lastApprovalError: message, lastWriteError: message }));
      return;
    }

    const transactionRequest = buildApproveTransactionRequest({ from: address, tokenAddress: selectedMintToken.address, spender: approvalSpender, amount: selectedMintAmount });
    const transactionRequestJson = JSON.stringify(transactionRequest, null, 2);
    setApprovalTransactionRequest(transactionRequestJson);
    setApprovalTxHash(null);
    setApprovalReceiptStatus("none");
    setDebug((current) => ({
      ...current,
      lastTransactionRequest: transactionRequestJson,
      lastApprovalRequest: transactionRequestJson,
      lastApprovalResult: "pending wallet signature",
      lastWriteStart: "awaiting wallet signature",
      lastWriteResult: "pending wallet signature",
      lastTxHash: "none",
      lastReceiptStatus: "none"
    }));

    setApprovalPending(true);
    recordActivity(createApprovalActivity({ id: activityId("approve"), status: "pending", token: selectedMintToken.label, amountLabel: selectedMintAmountLabel, timestamp: Date.now() }));
    try {
      const hash = await approveExactAmountDirect(instrumentedProvider, { from: address, tokenAddress: selectedMintToken.address, spender: approvalSpender, amount: selectedMintAmount });
      setApprovalTxHash(hash);
      recordActivity(createApprovalActivity({ id: activityId("approve"), status: "submitted", token: selectedMintToken.label, amountLabel: selectedMintAmountLabel, txHash: hash, timestamp: Date.now() }));
      setDebug((current) => ({ ...current, lastApprovalResult: "transaction submitted", lastWriteResult: "transaction submitted", lastTxHash: hash, lastReceiptStatus: "confirming" }));

      const receipt = await waitForTransactionReceiptDirect(instrumentedProvider, hash);
      const status = receiptStatusLabel(receipt.status);
      setApprovalReceiptStatus(status);
      setDebug((current) => ({ ...current, lastReceiptStatus: status }));

      if (receipt.status !== "0x1") {
        const message = `Approval transaction failed with receipt status ${status}.`;
        setApprovalError(message);
        recordActivity(createApprovalActivity({ id: activityId("approve"), status: "failed", token: selectedMintToken.label, amountLabel: selectedMintAmountLabel, txHash: hash, message, timestamp: Date.now() }));
        setDebug((current) => ({ ...current, lastApprovalResult: "failed", lastApprovalError: message, lastWriteResult: "failed", lastWriteError: message }));
        return;
      }

      recordActivity(createApprovalActivity({ id: activityId("approve"), status: "confirmed", token: selectedMintToken.label, amountLabel: selectedMintAmountLabel, txHash: hash, timestamp: Date.now() }));
      setDebug((current) => ({ ...current, lastApprovalResult: "confirmed", lastApprovalError: "none", lastWriteResult: "confirmed", lastWriteError: "none" }));
      await refreshAllowanceFromProvider(instrumentedProvider, address);
    } catch (caught) {
      const message = errorCodeMessage(caught);
      setApprovalError(message);
      recordActivity(createApprovalActivity({ id: activityId("approve"), status: isWalletRejection(caught) ? "rejected" : "failed", token: selectedMintToken.label, amountLabel: selectedMintAmountLabel, message, timestamp: Date.now() }));
      setDebug((current) => ({ ...current, lastApprovalResult: "failed", lastApprovalError: message, lastWriteResult: "failed", lastWriteError: message }));
    } finally {
      setApprovalPending(false);
    }
  }, [address, approvalDisabledReason, approvalSpender, instrumentedProvider, recordActivity, refreshAllowanceFromProvider, selectedMintAmount, selectedMintAmountLabel, selectedMintToken]);

  const depositIntoMandateAccount = useCallback(async () => {
    setDebug((current) => ({
      ...current,
      lastClickedButton: "Deposit into MandateAccount",
      lastHandlerEntered: "depositIntoMandateAccount",
      lastDepositMandateAccount: mandateAccountAddress,
      lastDepositError: "none",
      lastWriteError: "none"
    }));
    setOperationError(null);
    setDepositError(null);

    const disabledReason = depositDisabledReason;
    if (disabledReason) {
      setDepositError(disabledReason);
      setDebug((current) => ({ ...current, lastDepositError: disabledReason, lastWriteError: disabledReason }));
      return;
    }
    if (!instrumentedProvider || !address || !selectedMintToken) {
      const message = "Deposit prerequisites are not ready.";
      setDepositError(message);
      setDebug((current) => ({ ...current, lastDepositError: message, lastWriteError: message }));
      return;
    }

    const transactionRequest = buildDepositTransactionRequest({ from: address, mandateAccount: mandateAccountAddress, tokenAddress: selectedMintToken.address, amount: selectedMintAmount });
    const transactionRequestJson = JSON.stringify(transactionRequest, null, 2);
    setDepositTransactionRequest(transactionRequestJson);
    setDepositTxHash(null);
    setDepositReceiptStatus("none");
    setDebug((current) => ({
      ...current,
      lastTransactionRequest: transactionRequestJson,
      lastDepositRequest: transactionRequestJson,
      lastDepositResult: "pending wallet signature",
      lastWriteStart: "awaiting wallet signature",
      lastWriteResult: "pending wallet signature",
      lastTxHash: "none",
      lastReceiptStatus: "none"
    }));

    setDepositPending(true);
    recordActivity(createDepositActivity({ id: activityId("deposit"), status: "pending", token: selectedMintToken.label, amountLabel: selectedMintAmountLabel, timestamp: Date.now() }));
    try {
      const hash = await depositIntoMandateAccountDirect(instrumentedProvider, { from: address, mandateAccount: mandateAccountAddress, tokenAddress: selectedMintToken.address, amount: selectedMintAmount });
      setDepositTxHash(hash);
      recordActivity(createDepositActivity({ id: activityId("deposit"), status: "submitted", token: selectedMintToken.label, amountLabel: selectedMintAmountLabel, txHash: hash, timestamp: Date.now() }));
      setDebug((current) => ({ ...current, lastDepositResult: "transaction submitted", lastWriteResult: "transaction submitted", lastTxHash: hash, lastReceiptStatus: "confirming" }));

      const receipt = await waitForTransactionReceiptDirect(instrumentedProvider, hash);
      const status = receiptStatusLabel(receipt.status);
      setDepositReceiptStatus(status);
      setDebug((current) => ({ ...current, lastReceiptStatus: status }));

      if (receipt.status !== "0x1") {
        const message = `Deposit transaction failed with receipt status ${status}.`;
        setDepositError(message);
        recordActivity(createDepositActivity({ id: activityId("deposit"), status: "failed", token: selectedMintToken.label, amountLabel: selectedMintAmountLabel, txHash: hash, message, timestamp: Date.now() }));
        setDebug((current) => ({ ...current, lastDepositResult: "failed", lastDepositError: message, lastWriteResult: "failed", lastWriteError: message }));
        return;
      }

      recordActivity(createDepositActivity({ id: activityId("deposit"), status: "confirmed", token: selectedMintToken.label, amountLabel: selectedMintAmountLabel, txHash: hash, timestamp: Date.now() }));
      setDebug((current) => ({ ...current, lastDepositResult: "confirmed", lastDepositError: "none", lastWriteResult: "confirmed", lastWriteError: "none" }));
      await refreshTokenBalancesFromProvider(instrumentedProvider, address);
      await refreshMandateAccountBalancesFromProvider(instrumentedProvider);
      await refreshAllowanceFromProvider(instrumentedProvider, address);
      await refreshMandateSessionReadsFromProvider(instrumentedProvider, address);
    } catch (caught) {
      const message = errorCodeMessage(caught);
      setDepositError(message);
      recordActivity(createDepositActivity({ id: activityId("deposit"), status: isWalletRejection(caught) ? "rejected" : "failed", token: selectedMintToken.label, amountLabel: selectedMintAmountLabel, message, timestamp: Date.now() }));
      setDebug((current) => ({ ...current, lastDepositResult: "failed", lastDepositError: message, lastWriteResult: "failed", lastWriteError: message }));
    } finally {
      setDepositPending(false);
    }
  }, [address, depositDisabledReason, instrumentedProvider, mandateAccountAddress, recordActivity, refreshAllowanceFromProvider, refreshMandateAccountBalancesFromProvider, refreshMandateSessionReadsFromProvider, refreshTokenBalancesFromProvider, selectedMintAmount, selectedMintAmountLabel, selectedMintToken]);

  const refreshSafeActionPreview = useCallback(async () => {
    setDebug((current) => ({ ...current, lastClickedButton: "Preview safe action", lastHandlerEntered: "refreshSafeActionPreview", lastSimulationError: "none" }));
    setSafePreviewError(null);
    setSafeActionError(null);

    const disabledReason = safePreviewDisabledReason;
    if (disabledReason) {
      setSafePreviewError(disabledReason);
      setDebug((current) => ({ ...current, lastSimulationError: disabledReason }));
      return;
    }
    if (!instrumentedProvider || !address) {
      const message = "Safe preview prerequisites are not ready.";
      setSafePreviewError(message);
      setDebug((current) => ({ ...current, lastSimulationError: message }));
      return;
    }

    setSafePreviewLoading(true);
    setDebug((current) => ({ ...current, lastSimulationStart: "safe preview started", lastSimulationResult: "pending" }));
    try {
      await refreshMandateSessionReadsFromProvider(instrumentedProvider, address);
      const [schemaVersion, nonce, rows] = await Promise.all([
        readActionSchemaVersionDirect(instrumentedProvider, mandateAccountAddress),
        readNextNonceDirect(instrumentedProvider, mandateAccountAddress),
        refreshPriceRowsFromEndpoint()
      ]);
      const action = buildStageFSafeAction({ deployment, actionSchemaVersion: schemaVersion, nonce, nowSeconds: Math.floor(Date.now() / 1000) });
      const preview = await previewSafeActionDirect(instrumentedProvider, mandateAccountAddress, action, rows);
      setActionSchemaVersion(schemaVersion);
      setNextNonce(nonce);
      setSafeAction(action);
      setSafePreview(preview);
      setSafeDecision(null);
      setSafeActionStep("idle");
      setSafeSubmitSimulation(null);
      setSafeActionId(null);
      setSafeSubmitTxHash(null);
      setSafeSubmitReceiptStatus("none");
      setSafeExecuteTxHash(null);
      setSafeExecuteReceiptStatus("none");
      setDebug((current) => ({ ...current, lastSimulationResult: `safe preview ${reasonLabel(preview.code)} pre ${preview.preExposureBps} post ${preview.postExposureBps}`, lastSimulationError: "none" }));
    } catch (caught) {
      const message = errorMessage(caught);
      setSafePreviewError(message);
      setSafePreview(null);
      setDebug((current) => ({ ...current, lastSimulationResult: "failed", lastSimulationError: message }));
    } finally {
      setSafePreviewLoading(false);
    }
  }, [address, deployment, instrumentedProvider, mandateAccountAddress, refreshMandateSessionReadsFromProvider, refreshPriceRowsFromEndpoint, safePreviewDisabledReason]);

  const runAgentSafeAction = useCallback(async () => {
    setDebug((current) => ({ ...current, lastClickedButton: "Agent submit and execute safe action", lastHandlerEntered: "runAgentSafeAction", lastWriteError: "none", lastSimulationError: "none" }));
    setSafeActionError(null);

    const disabledReason = agentRelayerDisabledReason;
    if (disabledReason) {
      setSafeActionError(disabledReason);
      setDebug((current) => ({ ...current, lastWriteError: disabledReason }));
      return;
    }

    setSafeActionPending(true);
    setSafeActionStep("submitting");
    setSafeSubmitTxHash(null);
    setSafeSubmitReceiptStatus("none");
    setSafeExecuteTxHash(null);
    setSafeExecuteReceiptStatus("none");
    setSafeSubmitTransactionRequest("server-side demo agent relayer");
    setSafeExecuteTransactionRequest("server-side demo agent relayer");
    try {
      const result = await requestDemoAgentAction("safe");
      if (!result.ok) {
        if (result.preview) setSafePreview(result.preview);
        setSafeActionStep("error");
        setSafeActionError(result.message);
        recordActivity(createFailureActivity({ id: activityId("safe"), type: "safe", message: result.message, timestamp: Date.now() }));
        setDebug((current) => ({ ...current, lastWriteResult: "failed", lastWriteError: result.message, lastSimulationResult: result.previewReason ?? result.reason }));
        return;
      }

      setSafePreview(result.preview);
      setSafeActionId(result.actionId);
      setSafeSubmitTxHash(result.submitTxHash);
      setSafeSubmitReceiptStatus(result.submitReceiptStatus);
      setSafeExecuteTxHash(result.executeTxHash ?? null);
      setSafeExecuteReceiptStatus(result.executeReceiptStatus ?? "none");
      setSafeDecision(decisionFromLabel(result.decisionStatus));
      setSafeSubmitSimulation({ actionId: result.actionId, code: result.preview.code, preExposureBps: result.preview.preExposureBps, postExposureBps: result.preview.postExposureBps });
      setSafeActionStep(result.executeTxHash ? "executed" : "approved");
      recordActivity(createSafeSubmitActivity({ id: activityId("safe-submit"), txHash: result.submitTxHash, timestamp: Date.now() }));
      if (result.executeTxHash) recordActivity(createSafeExecutionActivity({ id: activityId("safe-execute"), txHash: result.executeTxHash, timestamp: Date.now() }));
      setDebug((current) => ({ ...current, lastWriteResult: result.executeTxHash ? "safe action executed by demo agent" : "safe action submitted by demo agent", lastTxHash: result.executeTxHash ?? result.submitTxHash, lastReceiptStatus: result.executeReceiptStatus ?? result.submitReceiptStatus, lastWriteError: "none" }));
      if (instrumentedProvider) {
        await refreshMandateAccountBalancesFromProvider(instrumentedProvider);
        if (address) await refreshTokenBalancesFromProvider(instrumentedProvider, address);
        if (address) await refreshMandateSessionReadsFromProvider(instrumentedProvider, address);
      }
    } catch (caught) {
      const message = errorCodeMessage(caught);
      setSafeActionStep("error");
      setSafeActionError(message);
      recordActivity(createFailureActivity({ id: activityId("safe"), type: "safe", rejected: isWalletRejection(caught), message, timestamp: Date.now() }));
      setDebug((current) => ({ ...current, lastWriteResult: "failed", lastWriteError: message }));
    } finally {
      setSafeActionPending(false);
    }
  }, [address, agentRelayerDisabledReason, instrumentedProvider, recordActivity, refreshMandateAccountBalancesFromProvider, refreshMandateSessionReadsFromProvider, refreshTokenBalancesFromProvider]);

  const runAgentDangerousAction = useCallback(async () => {
    setDebug((current) => ({ ...current, lastClickedButton: "Agent submit blocked test action", lastHandlerEntered: "runAgentDangerousAction", lastWriteError: "none" }));
    setDangerousActionError(null);

    const disabledReason = dangerousActionDisabledReason;
    if (disabledReason) {
      setDangerousActionError(disabledReason);
      setDebug((current) => ({ ...current, lastWriteError: disabledReason }));
      return;
    }

    setDangerousActionPending(true);
    try {
      const result = await requestDemoAgentAction("dangerous");
      if (!result.ok) {
        setDangerousActionError(result.message);
        recordActivity(createFailureActivity({ id: activityId("dangerous"), type: "dangerous", message: result.message, timestamp: Date.now() }));
        setDebug((current) => ({ ...current, lastWriteResult: "failed", lastWriteError: result.message }));
        return;
      }

      setDangerousActionResult(result);
      recordActivity(createDangerousBlockedActivity({ id: activityId("dangerous"), txHash: result.submitTxHash, reason: result.blockedReason ?? result.previewReason, timestamp: Date.now() }));
      setDebug((current) => ({ ...current, lastWriteResult: "blocked action submitted by demo agent", lastTxHash: result.submitTxHash, lastReceiptStatus: result.submitReceiptStatus, lastWriteError: "none" }));
      if (instrumentedProvider) await refreshMandateAccountBalancesFromProvider(instrumentedProvider);
    } catch (caught) {
      const message = errorCodeMessage(caught);
      setDangerousActionError(message);
      recordActivity(createFailureActivity({ id: activityId("dangerous"), type: "dangerous", rejected: isWalletRejection(caught), message, timestamp: Date.now() }));
      setDebug((current) => ({ ...current, lastWriteResult: "failed", lastWriteError: message }));
    } finally {
      setDangerousActionPending(false);
    }
  }, [dangerousActionDisabledReason, instrumentedProvider, recordActivity, refreshMandateAccountBalancesFromProvider]);

  const executeSafeAction = useCallback(async () => {
    setDebug((current) => ({ ...current, lastClickedButton: "Execute safe action", lastHandlerEntered: "executeSafeAction", lastWriteError: "none", lastSimulationError: "none" }));
    setSafeActionError(null);

    const disabledReason = safeExecuteDisabledReason;
    if (disabledReason) {
      setSafeActionError(disabledReason);
      setDebug((current) => ({ ...current, lastWriteError: disabledReason }));
      return;
    }
    if (!instrumentedProvider || !address || !safeAction || !priceRows) {
      const message = "Safe execution prerequisites are not ready.";
      setSafeActionError(message);
      setDebug((current) => ({ ...current, lastWriteError: message }));
      return;
    }

    const submitRequest = buildSubmitSafeActionTransactionRequest({ from: address, mandateAccount: mandateAccountAddress, action: safeAction, prices: priceRows });
    setSafeSubmitTransactionRequest(JSON.stringify(submitRequest, null, 2));
    setSafeSubmitTxHash(null);
    setSafeSubmitReceiptStatus("none");
    setSafeExecuteTxHash(null);
    setSafeExecuteReceiptStatus("none");
    setSafeActionPending(true);
    setSafeActionStep("submitting");
    setDebug((current) => ({ ...current, lastTransactionRequest: JSON.stringify(submitRequest, null, 2), lastSimulationStart: "submitAction simulation started", lastWriteStart: "safe submit preparing", lastWriteResult: "pending", lastTxHash: "none", lastReceiptStatus: "none" }));

    try {
      const actionId = await computeActionIdDirect(instrumentedProvider, mandateAccountAddress, safeAction);
      setSafeActionId(actionId);

      const submitSimulation = await simulateSubmitSafeActionDirect(instrumentedProvider, { from: address, mandateAccount: mandateAccountAddress, action: safeAction, prices: priceRows });
      setSafeSubmitSimulation(submitSimulation);
      setDebug((current) => ({ ...current, lastSimulationResult: `submitAction simulation ${reasonLabel(submitSimulation.code)}` }));
      if (submitSimulation.code !== ReasonCode.OK) throw new Error(`Safe action simulation returned ${reasonLabel(submitSimulation.code)}.`);

      setDebug((current) => ({ ...current, lastWriteStart: "awaiting safe submit wallet signature", lastWriteResult: "pending wallet signature" }));
      const submitHash = await submitSafeActionDirect(instrumentedProvider, { from: address, mandateAccount: mandateAccountAddress, action: safeAction, prices: priceRows });
      setSafeSubmitTxHash(submitHash);
      setDebug((current) => ({ ...current, lastWriteResult: "safe submit transaction submitted", lastTxHash: submitHash, lastReceiptStatus: "submit confirming" }));

      const submitReceipt = await waitForTransactionReceiptDirect(instrumentedProvider, submitHash);
      const submitStatus = receiptStatusLabel(submitReceipt.status);
      setSafeSubmitReceiptStatus(submitStatus);
      setDebug((current) => ({ ...current, lastReceiptStatus: `submit ${submitStatus}` }));
      if (submitReceipt.status !== "0x1") throw new Error(`Safe submit transaction failed with receipt status ${submitStatus}.`);

      const approvedDecision = await readDecisionDirect(instrumentedProvider, mandateAccountAddress, actionId);
      setSafeDecision(approvedDecision);
      if (approvedDecision.status !== DecisionStatus.APPROVED) throw new Error(`Safe action decision is ${decisionStatusLabel(approvedDecision.status)}, not APPROVED.`);
      setSafeActionStep("approved");

      const executeRequest = buildExecuteSafeActionTransactionRequest({ from: address, mandateAccount: mandateAccountAddress, action: safeAction, prices: priceRows });
      setSafeExecuteTransactionRequest(JSON.stringify(executeRequest, null, 2));
      setDebug((current) => ({ ...current, lastTransactionRequest: JSON.stringify(executeRequest, null, 2), lastSimulationStart: "executeAction simulation started", lastSimulationResult: "pending" }));
      await simulateExecuteSafeActionDirect(instrumentedProvider, { from: address, mandateAccount: mandateAccountAddress, action: safeAction, prices: priceRows });
      setDebug((current) => ({ ...current, lastSimulationResult: "executeAction simulation passed" }));

      setSafeActionStep("executing");
      setDebug((current) => ({ ...current, lastWriteStart: "awaiting safe execute wallet signature", lastWriteResult: "pending wallet signature" }));
      const executeHash = await executeSafeActionDirect(instrumentedProvider, { from: address, mandateAccount: mandateAccountAddress, action: safeAction, prices: priceRows });
      setSafeExecuteTxHash(executeHash);
      setDebug((current) => ({ ...current, lastWriteResult: "safe execute transaction submitted", lastTxHash: executeHash, lastReceiptStatus: "execute confirming" }));

      const executeReceipt = await waitForTransactionReceiptDirect(instrumentedProvider, executeHash);
      const executeStatus = receiptStatusLabel(executeReceipt.status);
      setSafeExecuteReceiptStatus(executeStatus);
      setDebug((current) => ({ ...current, lastReceiptStatus: `execute ${executeStatus}` }));
      if (executeReceipt.status !== "0x1") throw new Error(`Safe execute transaction failed with receipt status ${executeStatus}.`);

      const executedDecision = await readDecisionDirect(instrumentedProvider, mandateAccountAddress, actionId);
      setSafeDecision(executedDecision);
      if (executedDecision.status !== DecisionStatus.EXECUTED) throw new Error(`Safe action decision is ${decisionStatusLabel(executedDecision.status)}, not EXECUTED.`);
      setSafeActionStep("executed");
      setDebug((current) => ({ ...current, lastWriteResult: "safe action executed", lastWriteError: "none" }));
      await refreshMandateAccountBalancesFromProvider(instrumentedProvider);
      await refreshTokenBalancesFromProvider(instrumentedProvider, address);
      await refreshMandateSessionReadsFromProvider(instrumentedProvider, address);
    } catch (caught) {
      const message = errorCodeMessage(caught);
      setSafeActionStep("error");
      setSafeActionError(message);
      setDebug((current) => ({ ...current, lastWriteResult: "failed", lastWriteError: message }));
    } finally {
      setSafeActionPending(false);
    }
  }, [address, instrumentedProvider, mandateAccountAddress, priceRows, refreshMandateAccountBalancesFromProvider, refreshMandateSessionReadsFromProvider, refreshTokenBalancesFromProvider, safeAction, safeExecuteDisabledReason]);

  useEffect(() => {
    if (!provider || !instrumentedProvider) return;

    const directProvider = instrumentedProvider;

    void readChainIdDirect(directProvider)
      .then((nextChainId) => {
        setChainId(nextChainId);
        return directProvider.request({ method: "eth_accounts" }).then((accounts) => {
          const nextAddress = firstAddress(accounts);
          setAddress(nextAddress);
          if (nextAddress && nextChainId === ROBINHOOD_CHAIN_ID_DECIMAL) {
            void readNativeBalanceFromProvider(directProvider);
            void refreshTokenBalancesFromProvider(directProvider, nextAddress);
            void refreshMandateAccountBalancesFromProvider(directProvider);
            void refreshAllowanceFromProvider(directProvider, nextAddress);
            void refreshMandateSessionReadsFromProvider(directProvider, nextAddress);
          }
        });
      })
      .catch((caught) => setOperationError(errorMessage(caught)));

    function onAccountsChanged(accounts: unknown) {
      const nextAddress = firstAddress(accounts);
      setAddress(nextAddress);
      setNativeBalance(null);
      setNativeBalanceError(null);
      setTokenBalances(emptyTokenBalances());
      setTokenBalancesError(null);
      setMandateAccountBalances(emptyTokenBalances());
      setMandateAccountBalancesError(null);
      setSelectedAllowance(null);
      setAllowanceError(null);
      setSessionAuthority(null);
      setSafeAction(null);
      setSafePreview(null);
      setSafeActionId(null);
      setSafeDecision(null);
      setSafeActionStep("idle");
      setSafeActionError(null);
      setDangerousActionResult(null);
      setDangerousActionError(null);
      if (nextAddress && chainId === ROBINHOOD_CHAIN_ID_DECIMAL) {
        void readNativeBalanceFromProvider(directProvider);
        void refreshTokenBalancesFromProvider(directProvider, nextAddress);
        void refreshMandateAccountBalancesFromProvider(directProvider);
        void refreshAllowanceFromProvider(directProvider, nextAddress);
        void refreshMandateSessionReadsFromProvider(directProvider, nextAddress);
      }
    }

    function onChainChanged(nextChainId: unknown) {
      const parsedChainId = parseChainId(nextChainId);
      setChainId(parsedChainId);
      setNativeBalance(null);
      setNativeBalanceError(null);
      setTokenBalances(emptyTokenBalances());
      setTokenBalancesError(null);
      setMandateAccountBalances(emptyTokenBalances());
      setMandateAccountBalancesError(null);
      setSelectedAllowance(null);
      setAllowanceError(null);
      setSessionAuthority(null);
      setSafeAction(null);
      setSafePreview(null);
      setSafeActionId(null);
      setSafeDecision(null);
      setSafeActionStep("idle");
      setSafeActionError(null);
      setDangerousActionResult(null);
      setDangerousActionError(null);
      if (address && parsedChainId === ROBINHOOD_CHAIN_ID_DECIMAL) {
        void readNativeBalanceFromProvider(directProvider);
        void refreshTokenBalancesFromProvider(directProvider, address);
        void refreshMandateAccountBalancesFromProvider(directProvider);
        void refreshAllowanceFromProvider(directProvider, address);
        void refreshMandateSessionReadsFromProvider(directProvider, address);
      }
    }

    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("chainChanged", onChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
    };
  }, [address, chainId, instrumentedProvider, provider, readNativeBalanceFromProvider, refreshAllowanceFromProvider, refreshMandateAccountBalancesFromProvider, refreshMandateSessionReadsFromProvider, refreshTokenBalancesFromProvider]);

  return {
    address,
    chainId,
    expectedChainId: ROBINHOOD_CHAIN_ID_DECIMAL,
    isConnected,
    isCorrectChain,
    walletClientPresent: provider !== null,
    publicClientPresent: false,
    configError,
    priceConfigError,
    nativeBalance,
    nativeBalanceLoading,
    nativeBalanceError,
    tokenBalanceRows,
    tokenBalancesLoading,
    tokenBalancesError,
    mandateAccountAddress,
    mandateAccountBalanceRows,
    mandateAccountBalancesLoading,
    mandateAccountBalancesError,
    operationError,
    connectPending,
    switchPending,
    connectDisabledReason,
    switchChainDisabledReason,
    refreshBalanceDisabledReason,
    mintTokens,
    mintPresets: fundingPresets,
    selectedMintPresetId,
    selectedMintPreset,
    selectedMintToken,
    selectedMintAmount,
    selectedMintAmountLabel,
    selectedTokenBalance,
    mintDisabledReason,
    mintPending,
    mintError,
    mintTxHash,
    mintReceiptStatus,
    mintTransactionRequest,
    approvalSpender,
    selectedAllowance,
    selectedAllowanceLabel: selectedAllowance === null ? "not loaded" : `${formatTokenAmount18(selectedAllowance)} ${selectedMintToken.label}`,
    approvalRequired,
    approvalStatusLabel: selectedAllowance === null ? "allowance not loaded" : approvalRequired ? "approval required" : "Allowance sufficient",
    allowanceLoading,
    allowanceError,
    approvalDisabledReason,
    approvalPending,
    approvalError,
    approvalTxHash,
    approvalReceiptStatus,
    approvalTransactionRequest,
    depositDisabledReason,
    depositPending,
    depositError,
    depositTxHash,
    depositReceiptStatus,
    depositTransactionRequest,
    mandateSessionDisabledReason,
    mandateConfig,
    allowedAssets,
    safeAdapterAllowed,
    priceOracle,
    actionSchemaVersion,
    nextNonce,
    sessionAuthority,
    connectedRoleLabel: sessionAuthority ? roleLabel(sessionAuthority.connectedRole) : "not loaded",
    sessionKeyRoleLabel: sessionAuthority ? roleLabel(sessionAuthority.sessionKeyRole) : "not loaded",
    mandateSessionLoading,
    mandateSessionError,
    priceRows,
    priceRowsLoading,
    priceRowsError,
    safeAction,
    safeActionAmountLabel: safeAction ? `${formatTokenAmount18(safeAction.amountIn)} USDG` : "not ready",
    safePreview,
    safePreviewStatusLabel: safePreview ? reasonLabel(safePreview.code) : "not previewed",
    safePreviewLoading,
    safePreviewError,
    safePreviewDisabledReason,
    safeExecuteDisabledReason,
    agentRelayerDisabledReason,
    safeActionPending,
    safeActionStep,
    safeActionError,
    safeActionId,
    safeDecision,
    safeDecisionStatusLabel: safeDecision ? decisionStatusLabel(safeDecision.status) : "none",
    safeSubmitSimulation,
    safeSubmitTxHash,
    safeSubmitReceiptStatus,
    safeSubmitTransactionRequest,
    safeExecuteTxHash,
    safeExecuteReceiptStatus,
    safeExecuteTransactionRequest,
    dangerousActionPending,
    dangerousActionError,
    dangerousActionDisabledReason,
    dangerousActionResult,
    activityItems,
    clearActivityItems,
    debug: {
      ...debug,
      connectedAddress: address ?? "not connected",
      chainId: chainId?.toString() ?? "unknown",
      walletClientPresent: provider ? "direct window.ethereum provider" : "no",
      publicClientPresent: "not used in direct Stage F",
      selectedToken: selectedMintToken.label,
      selectedAmount: selectedMintPreset.amount
    },
    connectWallet,
    switchToRobinhoodChain,
    refreshNativeBalance,
    refreshMandateSessionReads,
    selectMintPreset,
    mintProjectDemoToken,
    approveExactAmount,
    depositIntoMandateAccount,
    refreshSafeActionPreview,
    runAgentSafeAction,
    runAgentDangerousAction,
    executeSafeAction
  };
}

function getLiveActivityStorage(): LiveActivityStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function activityId(type: string): string {
  return `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isWalletRejection(caught: unknown): boolean {
  const code = caught && typeof caught === "object" && "code" in caught ? String(caught.code) : "";
  return code === "4001" || /reject/i.test(errorMessage(caught));
}

async function requestDemoAgentAction(kind: "safe" | "dangerous"): Promise<AgentRelayerResponse> {
  const response = await fetch("/api/demo-agent/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind })
  });
  const result = (await response.json()) as AgentRelayerResponse;
  if (!response.ok && result.ok) throw new Error("Demo agent relayer returned an invalid success response.");
  return result;
}

function decisionFromLabel(label: string): DecisionState {
  return {
    status: decisionStatusFromLabel(label),
    mandateVersion: 0n,
    submittedAt: 0n,
    expiresAt: 0n,
    priceDigest: "0x0000000000000000000000000000000000000000000000000000000000000000",
    priceTimestamp: 0n
  };
}

function decisionStatusFromLabel(label: string): number {
  switch (label) {
    case "BLOCKED":
      return DecisionStatus.BLOCKED;
    case "APPROVED":
      return DecisionStatus.APPROVED;
    case "EXECUTED":
      return DecisionStatus.EXECUTED;
    case "EXPIRED":
      return DecisionStatus.EXPIRED;
    case "CANCELLED":
      return DecisionStatus.CANCELLED;
    default:
      return DecisionStatus.NONE;
  }
}

function instrumentProvider(provider: DirectProvider, setDebug: Dispatch<SetStateAction<WalletDebugState>>): DirectProvider {
  return {
    request(args) {
      setDebug((current) => ({ ...current, lastRequestMethod: args.method, lastRequestStatus: "request started", lastRequestError: "none" }));
      return provider.request(args).then(
        (result) => {
          setDebug((current) => ({ ...current, lastRequestMethod: args.method, lastRequestStatus: "request succeeded", lastRequestError: "none" }));
          return result;
        },
        (caught: unknown) => {
          setDebug((current) => ({ ...current, lastRequestMethod: args.method, lastRequestStatus: "request failed", lastRequestError: errorCodeMessage(caught) }));
          throw caught;
        }
      );
    },
    on: provider.on?.bind(provider),
    removeListener: provider.removeListener?.bind(provider)
  };
}

function emptyTokenBalances(): TokenBalances {
  return fundingTokenKeys.reduce((balances, token) => {
    balances[token] = null;
    return balances;
  }, {} as TokenBalances);
}

function tokenBalanceMap(entries: readonly (readonly [FundingTokenKey, bigint])[]): TokenBalances {
  return entries.reduce((balances, [token, balance]) => {
    balances[token] = balance;
    return balances;
  }, emptyTokenBalances());
}

function receiptStatusLabel(status: unknown): string {
  if (typeof status === "string") return status;
  return "unknown";
}

function errorMessage(caught: unknown): string {
  if (caught instanceof Error) return caught.message;
  return String(caught);
}

function errorCodeMessage(caught: unknown): string {
  const code = caught && typeof caught === "object" && "code" in caught ? String(caught.code) : "unknown";
  return `code: ${code}; message: ${errorMessage(caught)}`;
}

declare global {
  interface Window {
    ethereum?: DirectProvider;
  }
}
