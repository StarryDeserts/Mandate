import { getAddress, isAddress, isHex } from "viem";
import type { Address, Hex } from "viem";
import type { MandateDeployment, PriceData } from "./types";

type PriceApiRow = {
  asset: string;
  priceUSDG1e18: string;
  timestamp: number;
  validUntil: number;
  signature: string;
};

export type PriceApiResponse = {
  domain?: {
    name?: string;
    version?: string;
    chainId?: number;
    verifyingContract?: string;
  };
  rows?: PriceApiRow[];
};

export function priceAssetsForDemo(deployment: MandateDeployment): Address[] {
  return [deployment.contracts.tsla, deployment.contracts.amd];
}

export function buildPriceUrl(baseUrl: string, deployment: MandateDeployment): string {
  const endpoint = baseUrl.trim();
  const url = endpoint.startsWith("/") ? new URL(endpoint, "http://mandate.local") : priceEndpointUrl(endpoint);
  url.searchParams.set("assets", priceAssetsForDemo(deployment).join(","));
  return endpoint.startsWith("/") ? `${url.pathname}${url.search}` : url.toString();
}

function priceEndpointUrl(endpoint: string): URL {
  const url = new URL(endpoint);
  if (url.pathname === "/") return new URL("price", url.href.endsWith("/") ? url.href : `${url.href}/`);
  return url;
}

export function normalizePriceResponse(response: PriceApiResponse, deployment: MandateDeployment): PriceData[] {
  if (response.domain?.chainId !== deployment.chainId) {
    throw new Error("Price signer returned the wrong chainId");
  }
  if (response.domain?.verifyingContract?.toLowerCase() !== deployment.contracts.priceFeed.toLowerCase()) {
    throw new Error("Price signer returned the wrong verifying contract");
  }
  if (!Array.isArray(response.rows) || response.rows.length === 0) {
    throw new Error("Price signer returned no rows");
  }

  return response.rows.map((row) => {
    if (!isAddress(row.asset, { strict: false })) throw new Error("Price row has invalid asset");
    if (!/^\d+$/.test(row.priceUSDG1e18)) throw new Error("Price row has invalid price");
    if (!Number.isSafeInteger(row.timestamp) || row.timestamp <= 0) throw new Error("Price row has invalid timestamp");
    if (!Number.isSafeInteger(row.validUntil) || row.validUntil < row.timestamp) throw new Error("Price row has invalid validUntil");
    if (!isHex(row.signature)) throw new Error("Price row has invalid signature");

    return {
      asset: getAddress(row.asset),
      priceUSDG1e18: BigInt(row.priceUSDG1e18),
      timestamp: BigInt(row.timestamp),
      validUntil: BigInt(row.validUntil),
      signature: row.signature as Hex
    };
  });
}
