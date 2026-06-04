import { NextResponse } from "next/server";
import { getAddress, isAddress, type Address, type Hex, type TypedDataDomain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getMandateDeployment } from "../../../lib/mandate/deployment";
import type { MandateDeployment } from "../../../lib/mandate/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRICE_FEED_NAME = "MandatePriceFeed";
const PRICE_FEED_VERSION = "1";
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

type PriceConfig = {
  deployment: MandateDeployment;
  priceMap: Map<string, bigint>;
};

type ErrorReason = "configuration_error" | "signer_mismatch" | "invalid_assets" | "stale_config";

class DemoPriceError extends Error {
  constructor(
    readonly status: number,
    readonly reason: ErrorReason,
    message: string
  ) {
    super(message);
  }
}

export async function GET(request: Request) {
  try {
    const config = loadPriceConfig();
    const privateKey = readPriceSignerKey();
    assertSignerMatchesDeployment(privateKey, config.deployment.priceSigner);

    const assets = parseAssets(new URL(request.url).searchParams.get("assets"), config.priceMap);
    const rows = await signRows(assets, config, privateKey);

    return NextResponse.json({
      domain: {
        name: PRICE_FEED_NAME,
        version: PRICE_FEED_VERSION,
        chainId: config.deployment.chainId,
        verifyingContract: config.deployment.contracts.priceFeed
      },
      rows
    });
  } catch (caught) {
    if (caught instanceof DemoPriceError) {
      return NextResponse.json({ ok: false, reason: caught.reason, message: caught.message }, { status: caught.status });
    }
    return NextResponse.json(
      { ok: false, reason: "stale_config", message: "deployments/46630.json is missing required demo price configuration." },
      { status: 500 }
    );
  }
}

function loadPriceConfig(): PriceConfig {
  const deployment = getMandateDeployment();
  const priceMap = new Map<string, bigint>([
    [deployment.contracts.tsla.toLowerCase(), TSLA_PRICE_USDG_1E18],
    [deployment.contracts.amd.toLowerCase(), AMD_PRICE_USDG_1E18]
  ]);

  if (priceMap.size !== 2 || deployment.chainId !== 46630 || !isAddress(deployment.contracts.priceFeed, { strict: false })) {
    throw new DemoPriceError(500, "stale_config", "deployments/46630.json is missing required demo price configuration.");
  }

  return { deployment, priceMap };
}

function readPriceSignerKey(): Hex {
  const raw = process.env.PRICE_SIGNER_KEY;
  if (raw === undefined || raw.trim() === "") {
    throw new DemoPriceError(500, "configuration_error", "PRICE_SIGNER_KEY is required.");
  }

  const trimmed = raw.trim();
  if (!/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    throw new DemoPriceError(500, "configuration_error", "PRICE_SIGNER_KEY must be a 0x-prefixed hexadecimal private key.");
  }

  const hex = trimmed.slice(2).toLowerCase();
  if (hex.length > 64) throw new DemoPriceError(500, "configuration_error", "PRICE_SIGNER_KEY must not exceed 32 bytes.");

  const normalized = `0x${hex.padStart(64, "0")}` as Hex;
  if (BigInt(normalized) === 0n) throw new DemoPriceError(500, "configuration_error", "PRICE_SIGNER_KEY must not be zero.");
  return normalized;
}

function assertSignerMatchesDeployment(privateKey: Hex, expectedSigner: Address): void {
  const signerAddress = privateKeyToAccount(privateKey).address;
  if (signerAddress.toLowerCase() !== expectedSigner.toLowerCase()) {
    throw new DemoPriceError(500, "signer_mismatch", "PRICE_SIGNER_KEY must match deployments/46630.json priceSigner.");
  }
}

function parseAssets(rawAssets: string | null, priceMap: Map<string, bigint>): Address[] {
  if (rawAssets === null || rawAssets.trim() === "") throw invalidAssetsError();

  const assets = rawAssets
    .split(",")
    .map((asset) => asset.trim())
    .filter((asset) => asset !== "");

  if (assets.length === 0) throw invalidAssetsError();

  const normalizedAssets = assets.map((asset) => {
    if (!isAddress(asset, { strict: false })) throw invalidAssetsError();
    const normalized = getAddress(asset);
    if (!priceMap.has(normalized.toLowerCase())) throw invalidAssetsError();
    return normalized;
  });

  if (new Set(normalizedAssets.map((asset) => asset.toLowerCase())).size !== normalizedAssets.length) throw invalidAssetsError();
  return normalizedAssets;
}

function invalidAssetsError(): DemoPriceError {
  return new DemoPriceError(400, "invalid_assets", "assets must be a comma-separated list of deployment asset addresses.");
}

async function signRows(assets: Address[], config: PriceConfig, privateKey: Hex) {
  const sortedAssets = [...assets].sort((left, right) => compareAddresses(left, right));

  const timestamp = currentUnixTimestamp();
  const validUntil = normalizeUint64(timestamp + config.deployment.priceMaxStaleness, "validUntil");
  const account = privateKeyToAccount(privateKey);
  const domain = buildPriceFeedDomain(config.deployment);

  return Promise.all(
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
}

function buildPriceFeedDomain(deployment: MandateDeployment): TypedDataDomain {
  return {
    name: PRICE_FEED_NAME,
    version: PRICE_FEED_VERSION,
    chainId: deployment.chainId,
    verifyingContract: deployment.contracts.priceFeed
  };
}

function currentUnixTimestamp(): number {
  return Math.floor(Date.now() / 1000);
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
