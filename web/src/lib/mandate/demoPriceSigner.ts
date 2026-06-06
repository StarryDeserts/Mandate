import { getAddress, isAddress, type Address, type Hex, type TypedDataDomain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { PriceApiResponse } from "./prices";
import type { MandateDeployment } from "./types";

export const PRICE_FEED_NAME = "MandatePriceFeed";
export const PRICE_FEED_VERSION = "1";
const TSLA_PRICE_USDG_1E18 = 2_000_000_000_000_000_000n;
const AMD_PRICE_USDG_1E18 = 1_000_000_000_000_000_000n;
const MAX_UINT64 = 18_446_744_073_709_551_615n;

const PRICE_DATA_TYPES = {
  PriceData: [
    { name: "asset", type: "address" },
    { name: "priceUSDG1e18", type: "uint256" },
    { name: "timestamp", type: "uint64" },
    { name: "validUntil", type: "uint64" }
  ]
} as const;

export type DemoPriceErrorReason = "configuration_error" | "signer_mismatch" | "invalid_assets" | "stale_config";

export class DemoPriceError extends Error {
  constructor(
    readonly status: number,
    readonly reason: DemoPriceErrorReason,
    message: string
  ) {
    super(message);
  }
}

export type DemoPriceConfig = {
  deployment: MandateDeployment;
  priceMap: Map<string, bigint>;
};

export function loadDemoPriceConfig(deployment: MandateDeployment): DemoPriceConfig {
  const priceMap = new Map<string, bigint>([
    [deployment.contracts.tsla.toLowerCase(), TSLA_PRICE_USDG_1E18],
    [deployment.contracts.amd.toLowerCase(), AMD_PRICE_USDG_1E18]
  ]);

  if (priceMap.size !== 2 || deployment.chainId !== 46630 || !isAddress(deployment.contracts.priceFeed, { strict: false })) {
    throw new DemoPriceError(500, "stale_config", "deployments/46630.json is missing required demo price configuration.");
  }

  return { deployment, priceMap };
}

export function parseDemoPriceAssets(rawAssets: string | null, priceMap: Map<string, bigint>): Address[] {
  if (rawAssets === null || rawAssets.trim() === "") throw invalidAssetsError();

  const assets = rawAssets
    .split(",")
    .map((asset) => asset.trim())
    .filter((asset) => asset !== "");

  if (assets.length === 0) throw invalidAssetsError();

  const normalizedAssets = assets.map((asset) => normalizeDemoPriceAsset(asset, priceMap));

  if (new Set(normalizedAssets.map((asset) => asset.toLowerCase())).size !== normalizedAssets.length) throw invalidAssetsError();
  return normalizedAssets;
}

export function buildPriceFeedDomain(deployment: MandateDeployment): TypedDataDomain {
  return {
    name: PRICE_FEED_NAME,
    version: PRICE_FEED_VERSION,
    chainId: deployment.chainId,
    verifyingContract: deployment.contracts.priceFeed
  };
}

export async function signDemoPriceRows({
  deployment,
  assets,
  priceSignerKey,
  nowSeconds = () => Math.floor(Date.now() / 1000)
}: {
  deployment: MandateDeployment;
  assets: Address[];
  priceSignerKey: Hex;
  nowSeconds?: () => number;
}): Promise<PriceApiResponse> {
  const config = loadDemoPriceConfig(deployment);
  const account = privateKeyToAccount(priceSignerKey);
  if (account.address.toLowerCase() !== deployment.priceSigner.toLowerCase()) {
    throw new DemoPriceError(500, "signer_mismatch", "Demo price signer key does not match deployments/46630.json priceSigner.");
  }

  const sortedAssets = assets
    .map((asset) => normalizeDemoPriceAsset(asset, config.priceMap))
    .sort((left, right) => compareAddresses(left, right));

  const timestamp = currentUnixTimestamp(nowSeconds);
  const validUntil = normalizeUint64(timestamp + config.deployment.priceMaxStaleness, "validUntil");
  const domain = buildPriceFeedDomain(config.deployment);

  const rows = await Promise.all(
    sortedAssets.map(async (asset) => ({
      asset,
      priceUSDG1e18: config.priceMap.get(asset.toLowerCase())!.toString(),
      timestamp,
      validUntil,
      signature: await account.signTypedData({
        domain,
        types: PRICE_DATA_TYPES,
        primaryType: "PriceData",
        message: {
          asset,
          priceUSDG1e18: config.priceMap.get(asset.toLowerCase())!,
          timestamp: BigInt(timestamp),
          validUntil: BigInt(validUntil)
        }
      })
    }))
  );

  return {
    domain: {
      name: PRICE_FEED_NAME,
      version: PRICE_FEED_VERSION,
      chainId: config.deployment.chainId,
      verifyingContract: config.deployment.contracts.priceFeed
    },
    rows
  };
}

function normalizeDemoPriceAsset(asset: string, priceMap: Map<string, bigint>): Address {
  if (!isAddress(asset, { strict: false })) throw invalidAssetsError();
  const normalized = getAddress(asset);
  if (!priceMap.has(normalized.toLowerCase())) throw invalidAssetsError();
  return normalized;
}

function invalidAssetsError(): DemoPriceError {
  return new DemoPriceError(400, "invalid_assets", "assets must be a comma-separated list of deployment asset addresses.");
}

function currentUnixTimestamp(nowSeconds: () => number): number {
  return Math.floor(nowSeconds());
}

function compareAddresses(left: Address, right: Address): number {
  const leftValue = BigInt(left);
  const rightValue = BigInt(right);
  if (leftValue < rightValue) return -1;
  if (leftValue > rightValue) return 1;
  return 0;
}

function normalizeUint64(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new DemoPriceError(500, "stale_config", `${label} must be a non-negative safe integer.`);
  if (BigInt(value) > MAX_UINT64) throw new DemoPriceError(500, "stale_config", `${label} exceeds uint64.`);
  return value;
}
