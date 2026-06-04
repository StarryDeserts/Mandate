import deploymentFile from "../../../../deployments/46630.json";
import { getAddress, isAddress } from "viem";
import type { Address } from "viem";
import type { MandateContracts, MandateDeployment } from "./types";

type DeploymentFile = {
  chainId: number;
  network: string;
  status: string;
  owner: string;
  priceSigner: string;
  sessionKey: string;
  priceMaxStaleness: number;
  contracts: Record<keyof MandateContracts, string>;
  seed?: { status?: string };
};

const requiredContracts: Array<keyof MandateContracts> = [
  "usdg",
  "tsla",
  "amd",
  "amm",
  "adapter",
  "priceFeed",
  "mandateAccount"
];

export function getMandateDeployment(): MandateDeployment {
  const parsed = deploymentFile as DeploymentFile;

  if (parsed.chainId !== 46630) {
    throw new Error(`Expected deployment chainId 46630, got ${parsed.chainId}`);
  }

  return {
    chainId: 46630,
    network: parsed.network,
    status: parsed.status,
    owner: normalizeAddress(parsed.owner, "owner"),
    priceSigner: normalizeAddress(parsed.priceSigner, "priceSigner"),
    sessionKey: normalizeAddress(parsed.sessionKey, "sessionKey"),
    priceMaxStaleness: normalizePositiveSafeInteger(parsed.priceMaxStaleness, "priceMaxStaleness"),
    contracts: requiredContracts.reduce((contracts, key) => {
      contracts[key] = normalizeAddress(parsed.contracts[key], key);
      return contracts;
    }, {} as MandateContracts),
    seedStatus: parsed.seed?.status ?? "unknown"
  };
}

function normalizeAddress(value: string, label: string): Address {
  if (!isAddress(value, { strict: false })) {
    throw new Error(`deployments/46630.json has invalid ${label} address`);
  }
  return getAddress(value);
}

function normalizePositiveSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`deployments/46630.json has invalid ${label}`);
  }
  return value;
}
