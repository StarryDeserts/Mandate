import { describe, expect, it } from "vitest";
import { formatUnits } from "viem";
import { buildMandateAction } from "../actions";
import { getMandateDeployment } from "../deployment";

describe("buildMandateAction", () => {
  it("builds the fixed safe action", () => {
    const deployment = getMandateDeployment();
    const action = buildMandateAction({
      kind: "safe",
      deployment,
      actionSchemaVersion: 1,
      nonce: 12n,
      nowSeconds: 1_700_000_000
    });

    expect(action.account).toBe(deployment.contracts.mandateAccount);
    expect(action.assetIn).toBe(deployment.contracts.usdg);
    expect(action.assetOut).toBe(deployment.contracts.tsla);
    expect(formatUnits(action.amountIn, 18)).toBe("48");
    expect(action.recipient).toBe(deployment.contracts.mandateAccount);
    expect(action.deadline).toBe(1_700_001_200n);
  });

  it("builds the fixed dangerous action", () => {
    const deployment = getMandateDeployment();
    const action = buildMandateAction({
      kind: "dangerous",
      deployment,
      actionSchemaVersion: 1,
      nonce: 12n,
      nowSeconds: 1_700_000_000
    });

    expect(formatUnits(action.amountIn, 18)).toBe("500");
  });
});
