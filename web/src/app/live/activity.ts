export const LIVE_ACTIVITY_STORAGE_KEY = "mandate.live.activity.v1";

export type LiveActivityType = "mint" | "approve" | "deposit" | "safe" | "dangerous";
export type LiveActivityStatus = "pending" | "submitted" | "confirmed" | "executed" | "blocked" | "failed" | "rejected";

export type LiveActivityItem = {
  id: string;
  type: LiveActivityType;
  title: string;
  status: LiveActivityStatus;
  summary: string;
  timestamp: number;
  txHash?: `0x${string}`;
  explorerUrl?: string;
  balanceDelta?: string;
  reason?: string;
};

export type LiveActivityStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type TransactionActivityInput = {
  id: string;
  status: Extract<LiveActivityStatus, "pending" | "submitted" | "confirmed" | "failed" | "rejected">;
  token: string;
  amountLabel: string;
  timestamp: number;
  txHash?: `0x${string}`;
  explorerUrl?: string;
  message?: string;
};

export function createMintActivity(input: TransactionActivityInput): LiveActivityItem {
  return compactActivity({
    id: input.id,
    type: "mint",
    title: `Mint ${input.status}`,
    status: input.status,
    summary: input.message ?? (input.status === "confirmed" ? `Minted ${input.amountLabel} project demo tokens to the connected wallet.` : `Mint ${input.amountLabel} project demo tokens.`),
    timestamp: input.timestamp,
    txHash: input.txHash,
    explorerUrl: input.explorerUrl,
    balanceDelta: input.status === "confirmed" ? `+${input.amountLabel} wallet` : undefined
  });
}

export function createApprovalActivity(input: TransactionActivityInput): LiveActivityItem {
  return compactActivity({
    id: input.id,
    type: "approve",
    title: `Exact approval ${input.status}`,
    status: input.status,
    summary: input.message ?? (input.status === "confirmed" ? `Approved exactly ${input.amountLabel} for MandateAccount deposit.` : `Approve exactly ${input.amountLabel} for MandateAccount deposit.`),
    timestamp: input.timestamp,
    txHash: input.txHash,
    explorerUrl: input.explorerUrl
  });
}

export function createDepositActivity(input: TransactionActivityInput): LiveActivityItem {
  return compactActivity({
    id: input.id,
    type: "deposit",
    title: `Deposit ${input.status}`,
    status: input.status,
    summary: input.message ?? (input.status === "confirmed" ? `Deposited ${input.amountLabel} into MandateAccount.` : `Deposit ${input.amountLabel} into MandateAccount.`),
    timestamp: input.timestamp,
    txHash: input.txHash,
    explorerUrl: input.explorerUrl,
    balanceDelta: input.status === "confirmed" ? `-${input.amountLabel} wallet / +${input.amountLabel} MandateAccount` : undefined
  });
}

export function createSafeSubmitActivity(input: { id: string; timestamp: number; txHash?: `0x${string}`; explorerUrl?: string }): LiveActivityItem {
  return compactActivity({
    id: input.id,
    type: "safe",
    title: "Small TSLA buy submitted",
    status: "confirmed",
    summary: "Demo agent submitted the small TSLA buy candidate to Mandate.",
    timestamp: input.timestamp,
    txHash: input.txHash,
    explorerUrl: input.explorerUrl
  });
}

export function createSafeExecutionActivity(input: { id: string; timestamp: number; txHash?: `0x${string}`; explorerUrl?: string }): LiveActivityItem {
  return compactActivity({
    id: input.id,
    type: "safe",
    title: "Small TSLA buy executed",
    status: "executed",
    summary: "Mandate approved and executed the small TSLA buy candidate.",
    timestamp: input.timestamp,
    txHash: input.txHash,
    explorerUrl: input.explorerUrl,
    balanceDelta: "MandateAccount balances updated"
  });
}

export function createDangerousBlockedActivity(input: { id: string; timestamp: number; reason: string; txHash?: `0x${string}`; explorerUrl?: string }): LiveActivityItem {
  return compactActivity({
    id: input.id,
    type: "dangerous",
    title: "Dangerous action blocked",
    status: "blocked",
    summary: "Mandate blocked the aggressive TSLA increase. Funds moved: no.",
    timestamp: input.timestamp,
    txHash: input.txHash,
    explorerUrl: input.explorerUrl,
    reason: input.reason
  });
}

export function createFailureActivity(input: { id: string; type: LiveActivityType; rejected?: boolean; message: string; timestamp: number }): LiveActivityItem {
  const status = input.rejected ? "rejected" : "failed";
  return {
    id: input.id,
    type: input.type,
    title: `${activityNoun(input.type)} ${status}`,
    status,
    summary: input.message,
    timestamp: input.timestamp
  };
}

export function loadLiveActivityItems(storage: LiveActivityStorage | null | undefined): LiveActivityItem[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(LIVE_ACTIVITY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isLiveActivityItem) : [];
  } catch {
    return [];
  }
}

export function saveLiveActivityItems(storage: LiveActivityStorage | null | undefined, items: LiveActivityItem[]): LiveActivityItem[] {
  if (!storage) return items;
  try {
    storage.setItem(LIVE_ACTIVITY_STORAGE_KEY, JSON.stringify(items));
  } catch {
    return items;
  }
  return items;
}

export function appendLiveActivityItem(storage: LiveActivityStorage | null | undefined, item: LiveActivityItem, limit = 50): LiveActivityItem[] {
  return saveLiveActivityItems(storage, [item, ...loadLiveActivityItems(storage)].slice(0, limit));
}

export function clearLiveActivityItems(storage: LiveActivityStorage | null | undefined): LiveActivityItem[] {
  if (!storage) return [];
  try {
    storage.removeItem(LIVE_ACTIVITY_STORAGE_KEY);
  } catch {
    return [];
  }
  return [];
}

function compactActivity(item: LiveActivityItem): LiveActivityItem {
  return Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined)) as LiveActivityItem;
}

function activityNoun(type: LiveActivityType): string {
  if (type === "approve") return "Approval";
  if (type === "safe") return "Safe action";
  if (type === "dangerous") return "Dangerous action";
  return type[0].toUpperCase() + type.slice(1);
}

function isLiveActivityItem(value: unknown): value is LiveActivityItem {
  if (value === null || typeof value !== "object") return false;
  const item = value as Partial<LiveActivityItem>;
  return typeof item.id === "string" && typeof item.type === "string" && typeof item.title === "string" && typeof item.status === "string" && typeof item.summary === "string" && typeof item.timestamp === "number";
}
