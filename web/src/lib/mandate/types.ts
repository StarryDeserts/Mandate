import type { Address, Hex } from "viem";

export type MandateContracts = {
  usdg: Address;
  tsla: Address;
  amd: Address;
  amm: Address;
  adapter: Address;
  priceFeed: Address;
  mandateAccount: Address;
};

export type MandateDeployment = {
  chainId: 46630;
  network: string;
  status: string;
  owner: Address;
  priceSigner: Address;
  sessionKey: Address;
  priceMaxStaleness: number;
  contracts: MandateContracts;
  seedStatus: string;
};

export type MandateConfig = {
  mandateVersion: bigint;
  maxSingleAssetExposureBps: number;
  maxTradeSizeUSDG: bigint;
  maxDailyTurnoverBps: number;
  cooldownSeconds: bigint;
};

export type SessionKeyState = {
  enabled: boolean;
  validUntil: bigint;
  allowedActionTypes: number;
  maxAmountInPerAction: bigint;
  scopeHash: Hex;
};

export type MandateAction = {
  actionSchemaVersion: number;
  account: Address;
  nonce: bigint;
  actionType: 0;
  assetIn: Address;
  amountIn: bigint;
  assetOut: Address;
  minAmountOut: bigint;
  adapter: Address;
  recipient: Address;
  deadline: bigint;
};

export type PriceData = {
  asset: Address;
  priceUSDG1e18: bigint;
  timestamp: bigint;
  validUntil: bigint;
  signature: Hex;
};

export type ActionKind = "safe" | "dangerous";

export type PreviewResult = {
  code: number;
  preExposureBps: number;
  postExposureBps: number;
};
