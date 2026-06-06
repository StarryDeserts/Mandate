import { NextResponse } from "next/server";
import type { Hex } from "viem";
import {
  createDemoAgentDependencies,
  parseDemoAgentActionRequest,
  runDemoAgentAction,
  type DemoAgentFailureReason
} from "../../../../lib/mandate/demoAgentRelayer";
import { getMandateDeployment } from "../../../../lib/mandate/deployment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SessionKeyResult =
  | { ok: true; privateKey: Hex }
  | { ok: false; reason: "missing_session_key" | "invalid_session_key"; message: string };

export async function POST(request: Request) {
  const parsed = parseDemoAgentActionRequest(await readJson(request));
  if (!parsed.ok) return NextResponse.json(parsed.body, { status: parsed.status });

  const sessionKey = readSessionKey();
  if (!sessionKey.ok) {
    return NextResponse.json({ ok: false, reason: sessionKey.reason, message: sessionKey.message }, { status: 500 });
  }

  const rpcUrl = process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL ?? "";
  const priceSignerKey = (process.env.PRICE_SIGNER_KEY ?? "") as Hex;

  try {
    const deployment = getMandateDeployment();
    const result = await runDemoAgentAction({
      kind: parsed.kind,
      deployment,
      privateKey: sessionKey.privateKey,
      dependencies: createDemoAgentDependencies({ deployment, privateKey: sessionKey.privateKey, rpcUrl, priceSignerKey }),
      nowSeconds: () => Math.floor(Date.now() / 1000)
    });

    return NextResponse.json(result, { status: result.ok ? 200 : statusForReason(result.reason) });
  } catch {
    return NextResponse.json(
      { ok: false, reason: "unexpected_error", message: "Demo agent relayer failed before submitting the requested fixed action." },
      { status: 500 }
    );
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function readSessionKey(): SessionKeyResult {
  const raw = process.env.MANDATE_SESSION_KEY_PRIVATE_KEY;
  if (raw === undefined || raw.trim() === "") {
    return { ok: false, reason: "missing_session_key", message: "Demo agent relayer is not configured with a session key." };
  }

  const trimmed = raw.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
    return { ok: false, reason: "invalid_session_key", message: "Demo agent relayer session key must be a 0x-prefixed 32-byte private key." };
  }

  const normalized = `0x${trimmed.slice(2).toLowerCase()}` as Hex;
  if (BigInt(normalized) === 0n) {
    return { ok: false, reason: "invalid_session_key", message: "Demo agent relayer session key must not be zero." };
  }

  return { ok: true, privateKey: normalized };
}

function statusForReason(reason: DemoAgentFailureReason): number {
  switch (reason) {
    case "preview_not_ok":
    case "prices_stale":
    case "insufficient_session_gas":
    case "session_key_inactive":
    case "wrong_chain":
      return 409;
    case "session_key_mismatch":
      return 403;
    case "missing_session_key":
    case "invalid_session_key":
    case "price_rows_unavailable":
    case "price_rows_invalid":
    case "submit_failed":
    case "unexpected_error":
      return 500;
  }
}
