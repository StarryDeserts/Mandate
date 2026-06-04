import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getMandateDeployment } from "../deployment";

describe("getMandateDeployment", () => {
  it("loads the Robinhood testnet deployment without mutating it", () => {
    const deployment = getMandateDeployment();

    expect(deployment.chainId).toBe(46630);
    expect(deployment.sessionKey).toBe("0x3836B6E85F45bC20093bD81d8665659D3fe63B22");
    expect(deployment.contracts.mandateAccount).toBe("0x02A5d620dd3fF1cDaDe96d458e7A51988194E223");
    expect(deployment.contracts.usdg).toBe("0xa30948059DC024c14e97Ca95f7C1141f9b0E79F9");
    expect(deployment.contracts.tsla).toBe("0x640a8E64b877B9675606869d3E9ED5E628817AE2");
    expect(deployment.contracts.amd).toBe("0x1a12f142A87d757642E82517eaF3EB10449d0001");
    expect(deployment.contracts.amm).toBe("0xE4F7b15e3a69Bb0bfe6781B5D415Ed08d36e2aF3");
    expect(deployment.contracts.adapter).toBe("0x83C1ec0D973632032c241C4cEA3c7Bc8Bc427b8e");
    expect(deployment.contracts.priceFeed).toBe("0x9737301e300CA96223396D94aA176193Fc5a1D87");
    expect(deployment.priceMaxStaleness).toBe(3600);
  });

  it("loads the deployment independent of process.cwd", () => {
    const originalCwd = process.cwd();
    try {
      process.chdir(join(originalCwd, ".."));

      expect(getMandateDeployment().chainId).toBe(46630);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
