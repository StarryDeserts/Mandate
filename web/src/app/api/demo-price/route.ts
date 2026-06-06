import { NextResponse } from "next/server";
import { type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getMandateDeployment } from "../../../lib/mandate/deployment";
import { DemoPriceError, loadDemoPriceConfig, parseDemoPriceAssets, signDemoPriceRows } from "../../../lib/mandate/demoPriceSigner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const config = loadDemoPriceConfig(getMandateDeployment());
    const privateKey = readPriceSignerKey();
    assertSignerMatchesDeployment(privateKey, config.deployment.priceSigner);

    const assets = parseDemoPriceAssets(new URL(request.url).searchParams.get("assets"), config.priceMap);
    const response = await signDemoPriceRows({ deployment: config.deployment, assets, priceSignerKey: privateKey });

    return NextResponse.json(response);
  } catch (caught) {
    if (caught instanceof DemoPriceError) {
      return NextResponse.json({ ok: false, reason: caught.reason, message: caught.message }, { status: caught.status });
    }
    return NextResponse.json(
      { ok: false, reason: "stale_config", message: "deployments/46630.json is missing required demo price configuration." },
      { status: 500 }
    );
  }
}

function readPriceSignerKey(): Hex {
  const raw = process.env.PRICE_SIGNER_KEY;
  if (raw === undefined || raw.trim() === "") {
    throw new DemoPriceError(500, "configuration_error", "PRICE_SIGNER_KEY is required.");
  }

  const trimmed = raw.trim();
  if (!/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    throw new DemoPriceError(500, "configuration_error", "PRICE_SIGNER_KEY must be a 0x-prefixed hexadecimal private key.");
  }

  const hex = trimmed.slice(2).toLowerCase();
  if (hex.length > 64) throw new DemoPriceError(500, "configuration_error", "PRICE_SIGNER_KEY must not exceed 32 bytes.");

  const normalized = `0x${hex.padStart(64, "0")}` as Hex;
  if (BigInt(normalized) === 0n) throw new DemoPriceError(500, "configuration_error", "PRICE_SIGNER_KEY must not be zero.");
  return normalized;
}

function assertSignerMatchesDeployment(privateKey: Hex, expectedSigner: Address): void {
  const signerAddress = privateKeyToAccount(privateKey).address;
  if (signerAddress.toLowerCase() !== expectedSigner.toLowerCase()) {
    throw new DemoPriceError(500, "signer_mismatch", "PRICE_SIGNER_KEY must match deployments/46630.json priceSigner.");
  }
}
