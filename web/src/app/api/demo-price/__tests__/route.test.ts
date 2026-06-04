import { privateKeyToAccount } from "viem/accounts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMandateDeployment } from "../../../../lib/mandate/deployment";
import { GET } from "../route";

const matchingPriceSignerKey = "0x00000000000000000000000000000000000000000000000000000000b0bd3a01" as const;
const mismatchedPriceSignerKey = "0x0000000000000000000000000000000000000000000000000000000000000001" as const;
const privateKeyPattern = /0x[0-9a-fA-F]{64}/;

vi.mock("../../../../lib/mandate/deployment", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/mandate/deployment")>();
  const deployment = actual.getMandateDeployment();

  return {
    ...actual,
    getMandateDeployment: vi.fn(() => ({
      ...deployment,
      priceSigner: privateKeyToAccount(matchingPriceSignerKey).address
    }))
  };
});

afterEach(() => {
  delete process.env.PRICE_SIGNER_KEY;
  vi.useRealTimers();
});

describe("GET /api/demo-price", () => {
  it("returns existing signer-compatible signed rows for requested deployment assets", async () => {
    vi.setSystemTime(new Date("2026-06-04T12:00:00.000Z"));
    process.env.PRICE_SIGNER_KEY = matchingPriceSignerKey;
    const deployment = getMandateDeployment();

    const response = await GET(requestForAssets(deployment.contracts.amd, deployment.contracts.tsla));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      domain: {
        name: "MandatePriceFeed",
        version: "1",
        chainId: deployment.chainId,
        verifyingContract: deployment.contracts.priceFeed
      },
      rows: [
        {
          asset: deployment.contracts.amd,
          priceUSDG1e18: "1000000000000000000",
          timestamp: 1780574400,
          validUntil: 1780578000,
          signature: expect.stringMatching(/^0x[0-9a-f]+$/)
        },
        {
          asset: deployment.contracts.tsla,
          priceUSDG1e18: "2000000000000000000",
          timestamp: 1780574400,
          validUntil: 1780578000,
          signature: expect.stringMatching(/^0x[0-9a-f]+$/)
        }
      ]
    });
    expect(JSON.stringify(body)).not.toContain(matchingPriceSignerKey);
  });

  it("fails closed when PRICE_SIGNER_KEY is missing", async () => {
    const response = await GET(requestForAssets(getMandateDeployment().contracts.tsla));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ ok: false, reason: "configuration_error", message: "PRICE_SIGNER_KEY is required." });
  });

  it("fails closed when PRICE_SIGNER_KEY does not match deployments priceSigner", async () => {
    process.env.PRICE_SIGNER_KEY = mismatchedPriceSignerKey;

    const response = await GET(requestForAssets(getMandateDeployment().contracts.tsla));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ ok: false, reason: "signer_mismatch", message: "PRICE_SIGNER_KEY must match deployments/46630.json priceSigner." });
    expect(JSON.stringify(body)).not.toMatch(privateKeyPattern);
  });

  it("rejects invalid assets", async () => {
    process.env.PRICE_SIGNER_KEY = matchingPriceSignerKey;

    const response = await GET(new Request("http://localhost/api/demo-price?assets=not-an-address"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, reason: "invalid_assets", message: "assets must be a comma-separated list of deployment asset addresses." });
  });

  it("rejects assets outside the deployment price config", async () => {
    process.env.PRICE_SIGNER_KEY = matchingPriceSignerKey;

    const response = await GET(requestForAssets("0x00000000000000000000000000000000000000aA"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, reason: "invalid_assets", message: "assets must be a comma-separated list of deployment asset addresses." });
  });

  it("rejects duplicate assets like the standalone signer", async () => {
    process.env.PRICE_SIGNER_KEY = matchingPriceSignerKey;
    const deployment = getMandateDeployment();

    const response = await GET(requestForAssets(deployment.contracts.tsla, deployment.contracts.tsla));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, reason: "invalid_assets", message: "assets must be a comma-separated list of deployment asset addresses." });
  });
});

function requestForAssets(...assets: string[]): Request {
  const url = new URL("http://localhost/api/demo-price");
  url.searchParams.set("assets", assets.join(","));
  return new Request(url);
}
