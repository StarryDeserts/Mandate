import { evidence } from "./evidence";

const base = evidence.network.explorerBaseUrl;

const hasExplorer = base.startsWith("http://") || base.startsWith("https://");

export const testnetProofHref = "#testnet-proof";

export const txUrl = (hash: string): string =>
  hasExplorer ? `${base.replace(/\/$/, "")}/tx/${hash}` : testnetProofHref;

export const addressUrl = (address: string): string =>
  hasExplorer ? `${base.replace(/\/$/, "")}/address/${address}` : testnetProofHref;

export const explorerHomeUrl = (): string => (hasExplorer ? base : testnetProofHref);
