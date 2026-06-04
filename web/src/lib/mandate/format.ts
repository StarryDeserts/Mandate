import { formatUnits, getAddress, isAddress } from "viem";
import type { Address } from "viem";

export function shortAddress(address: string, head = 6, tail = 4): string {
  return address.length <= head + tail + 2 ? address : `${address.slice(0, head)}…${address.slice(-tail)}`;
}

export function normalizeAddress(value: string): Address | null {
  return isAddress(value, { strict: false }) ? getAddress(value) : null;
}

export function formatBps(bps: number | bigint): string {
  const value = typeof bps === "bigint" ? Number(bps) : bps;
  return `${(value / 100).toFixed(2)}%`;
}

export function formatTokenAmount(value: bigint, decimals = 18, maxFractionDigits = 2): string {
  const raw = formatUnits(value, decimals);
  const [whole, fraction = ""] = raw.split(".");
  const trimmed = fraction.slice(0, maxFractionDigits).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function formatUnixTime(value: bigint | number): string {
  const seconds = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isFinite(seconds) || seconds <= 0) return "inactive";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(seconds * 1000));
}
