export const Role = {
  NONE: 0,
  SESSION: 1,
  OWNER: 2
} as const;

export const DecisionStatus = {
  NONE: 0,
  BLOCKED: 1,
  APPROVED: 2,
  EXECUTED: 3,
  EXPIRED: 4,
  CANCELLED: 5
} as const;

export const ReasonCode = {
  OK: 0,
  ASSET_NOT_ALLOWED: 1,
  ADAPTER_NOT_ALLOWED: 2,
  SINGLE_ASSET_EXPOSURE_EXCEEDED: 3,
  TRADE_SIZE_EXCEEDED: 4,
  DAILY_TURNOVER_EXCEEDED: 5,
  COOLDOWN_ACTIVE: 6,
  PRICE_STALE: 7,
  SESSION_EXPIRED: 8,
  RECIPIENT_NOT_ALLOWED: 9,
  SLIPPAGE: 10
} as const;

export function reasonLabel(code: number): string {
  switch (code) {
    case ReasonCode.OK:
      return "OK";
    case ReasonCode.ASSET_NOT_ALLOWED:
      return "ASSET_NOT_ALLOWED";
    case ReasonCode.ADAPTER_NOT_ALLOWED:
      return "ADAPTER_NOT_ALLOWED";
    case ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED:
      return "SINGLE_ASSET_EXPOSURE_EXCEEDED";
    case ReasonCode.TRADE_SIZE_EXCEEDED:
      return "TRADE_SIZE_EXCEEDED";
    case ReasonCode.DAILY_TURNOVER_EXCEEDED:
      return "DAILY_TURNOVER_EXCEEDED";
    case ReasonCode.COOLDOWN_ACTIVE:
      return "COOLDOWN_ACTIVE";
    case ReasonCode.PRICE_STALE:
      return "PRICE_STALE";
    case ReasonCode.SESSION_EXPIRED:
      return "SESSION_EXPIRED";
    case ReasonCode.RECIPIENT_NOT_ALLOWED:
      return "RECIPIENT_NOT_ALLOWED";
    case ReasonCode.SLIPPAGE:
      return "SLIPPAGE";
    default:
      return `UNKNOWN_${code}`;
  }
}

export function humanizeReasonCode(code: number): string {
  switch (code) {
    case ReasonCode.DAILY_TURNOVER_EXCEEDED:
      return "Blocked because this action would exceed the 20% daily turnover limit. Deposit more USDG or reduce the action amount.";
    case ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED:
      return "Blocked because post-trade exposure would exceed the 35% max exposure limit.";
    case ReasonCode.OK:
      return "Mandate preview returned OK.";
    default:
      return reasonLabel(code);
  }
}

export function roleLabel(role: number): string {
  if (role === Role.SESSION) return "SESSION";
  if (role === Role.OWNER) return "OWNER";
  return "NONE";
}

export function decisionStatusLabel(status: number): string {
  switch (status) {
    case DecisionStatus.BLOCKED:
      return "BLOCKED";
    case DecisionStatus.APPROVED:
      return "APPROVED";
    case DecisionStatus.EXECUTED:
      return "EXECUTED";
    case DecisionStatus.EXPIRED:
      return "EXPIRED";
    case DecisionStatus.CANCELLED:
      return "CANCELLED";
    default:
      return "NONE";
  }
}
