import type { Address } from "viem";
import type { MandateDeployment } from "./types";

export const fundingTokenKeys = ["usdg", "tsla", "amd"] as const;
export type FundingTokenKey = (typeof fundingTokenKeys)[number];

export type FundingPresetId = "usdg-200" | "usdg-100" | "tsla-10" | "amd-5";

export type FundingPreset = {
  id: FundingPresetId;
  token: FundingTokenKey;
  amount: string;
  label: string;
};

export const fundingLabels: Record<FundingTokenKey, string> = {
  usdg: "USDG",
  tsla: "TSLA",
  amd: "AMD"
};

export const fundingPresets: readonly FundingPreset[] = [
  { id: "usdg-200", token: "usdg", amount: "200", label: "200 USDG" },
  { id: "usdg-100", token: "usdg", amount: "100", label: "100 USDG" },
  { id: "tsla-10", token: "tsla", amount: "10", label: "10 TSLA" },
  { id: "amd-5", token: "amd", amount: "5", label: "5 AMD" }
] as const;

export function fundingTokenAddress(deployment: MandateDeployment, token: FundingTokenKey): Address {
  return deployment.contracts[token];
}
