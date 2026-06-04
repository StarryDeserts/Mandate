import { describe, expect, it } from "vitest";
import { getMandateDeployment } from "../deployment";
import { fundingLabels, fundingPresets, fundingTokenAddress, fundingTokenKeys } from "../funding";

describe("funding helpers", () => {
  it("uses the final ordered project demo token presets", () => {
    expect(fundingPresets).toEqual([
      { id: "usdg-200", token: "usdg", amount: "200", label: "200 USDG" },
      { id: "usdg-100", token: "usdg", amount: "100", label: "100 USDG" },
      { id: "tsla-10", token: "tsla", amount: "10", label: "10 TSLA" },
      { id: "amd-5", token: "amd", amount: "5", label: "5 AMD" }
    ]);
  });

  it("keeps the supported token order stable", () => {
    expect(fundingTokenKeys).toEqual(["usdg", "tsla", "amd"]);
    expect(fundingLabels).toEqual({ usdg: "USDG", tsla: "TSLA", amd: "AMD" });
  });

  it("resolves funding token addresses from the deployment", () => {
    const deployment = getMandateDeployment();
    expect(fundingTokenAddress(deployment, "usdg")).toBe(deployment.contracts.usdg);
    expect(fundingTokenAddress(deployment, "tsla")).toBe(deployment.contracts.tsla);
    expect(fundingTokenAddress(deployment, "amd")).toBe(deployment.contracts.amd);
  });
});
