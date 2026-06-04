import { describe, expect, it } from "vitest";
import { getMandateDeployment } from "../deployment";
import { buildPriceUrl, normalizePriceResponse } from "../prices";

describe("price helpers", () => {
  it("builds the signer URL from public asset addresses", () => {
    const deployment = getMandateDeployment();
    const url = buildPriceUrl("http://127.0.0.1:8787", deployment);

    expect(url).toContain("/price?");
    expect(url).toContain(encodeURIComponent(deployment.contracts.tsla));
    expect(url).toContain(encodeURIComponent(deployment.contracts.amd));
  });

  it("supports the Vercel-relative demo price route", () => {
    const deployment = getMandateDeployment();
    const url = buildPriceUrl("/api/demo-price", deployment);

    expect(url).toContain("/api/demo-price?");
    expect(url).toContain(encodeURIComponent(deployment.contracts.tsla));
    expect(url).toContain(encodeURIComponent(deployment.contracts.amd));
  });

  it("normalizes existing signer rows", () => {
    const deployment = getMandateDeployment();
    const rows = normalizePriceResponse(
      {
        domain: {
          name: "MandatePriceFeed",
          version: "1",
          chainId: 46630,
          verifyingContract: deployment.contracts.priceFeed
        },
        rows: [
          {
            asset: deployment.contracts.tsla,
            priceUSDG1e18: "1000000000000000000",
            timestamp: 1700000000,
            validUntil: 1700003600,
            signature: "0x1234"
          }
        ]
      },
      deployment
    );

    expect(rows[0].asset).toBe(deployment.contracts.tsla);
    expect(rows[0].priceUSDG1e18).toBe(1000000000000000000n);
    expect(rows[0].timestamp).toBe(1700000000n);
  });
});
