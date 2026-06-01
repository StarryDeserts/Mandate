import { evidence } from "./evidence";

export const contracts = evidence.contracts;

export type ContractKey = keyof typeof contracts;

export const contractRows: Array<{ key: ContractKey; label: string }> = [
  { key: "mandateAccount", label: "MandateAccount" },
  { key: "usdg", label: "USDG MockERC20" },
  { key: "tsla", label: "TSLA MockERC20" },
  { key: "amd", label: "AMD MockERC20" },
  { key: "amm", label: "MockAMM" },
  { key: "adapter", label: "ApprovedSwapAdapter" },
  { key: "priceFeed", label: "SignedDemoPriceFeed" }
];
