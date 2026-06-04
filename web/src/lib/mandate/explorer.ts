import { evidence } from "@/lib/evidence";

export function txUrl(hash: string): string {
  const base = evidence.network.explorerBaseUrl;
  if (base.startsWith("#")) return `/${base}`;
  return `${base.replace(/\/$/, "")}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  const base = evidence.network.explorerBaseUrl;
  if (base.startsWith("#")) return `/${base}`;
  return `${base.replace(/\/$/, "")}/address/${address}`;
}
