import { NextResponse } from "next/server";
import type { Hex } from "viem";
import { createDemoAgentDependencies, parseDemoAgentActionRequest, runDemoAgentAction } from "../../../../lib/mandate/demoAgentRelayer";
import { getMandateDeployment } from "../../../../lib/mandate/deployment";

export async function POST(request: Request) {
  const parsed = parseDemoAgentActionRequest(await readJson(request));
  if (!parsed.ok) return NextResponse.json(parsed.body, { status: parsed.status });

  const privateKey = process.env.MANDATE_SESSION_KEY_PRIVATE_KEY;
  const rpcUrl = process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL ?? "";
  const priceUrl = process.env.NEXT_PUBLIC_MANDATE_PRICE_URL ?? "";
  if (!privateKey || !privateKey.startsWith("0x")) {
    return NextResponse.json({ ok: false, reason: "configuration_error", message: "Demo agent relayer is not configured." }, { status: 500 });
  }

  try {
    const deployment = getMandateDeployment();
    const result = await runDemoAgentAction({
      kind: parsed.kind,
      deployment,
      privateKey: privateKey as Hex,
      dependencies: createDemoAgentDependencies({ deployment, privateKey: privateKey as Hex, rpcUrl, priceUrl }),
      nowSeconds: () => Math.floor(Date.now() / 1000)
    });

    return NextResponse.json(result, { status: result.ok ? 200 : statusForReason(result.reason) });
  } catch {
    return NextResponse.json({ ok: false, reason: "relayer_error", message: "Demo agent relayer failed before submitting the requested fixed action." }, { status: 500 });
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function statusForReason(reason: string): number {
  if (reason === "preview_not_ok" || reason === "prices_stale" || reason === "prices_missing") return 409;
  return 403;
}
