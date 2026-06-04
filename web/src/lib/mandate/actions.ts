import { parseUnits } from "viem";
import type { ActionKind, MandateAction, MandateDeployment } from "./types";

export const SAFE_AMOUNT_USDG = 48;
export const DANGEROUS_AMOUNT_USDG = 500;
export const ACTION_TYPE_SWAP = 0 as const;
export const ACTION_DEADLINE_SECONDS = 20 * 60;

export function buildMandateAction({
  kind,
  deployment,
  actionSchemaVersion,
  nonce,
  nowSeconds
}: {
  kind: ActionKind;
  deployment: MandateDeployment;
  actionSchemaVersion: number;
  nonce: bigint;
  nowSeconds: number;
}): MandateAction {
  const amount = kind === "safe" ? SAFE_AMOUNT_USDG : DANGEROUS_AMOUNT_USDG;

  return {
    actionSchemaVersion,
    account: deployment.contracts.mandateAccount,
    nonce,
    actionType: ACTION_TYPE_SWAP,
    assetIn: deployment.contracts.usdg,
    amountIn: parseUnits(String(amount), 18),
    assetOut: deployment.contracts.tsla,
    minAmountOut: 0n,
    adapter: deployment.contracts.adapter,
    recipient: deployment.contracts.mandateAccount,
    deadline: BigInt(nowSeconds + ACTION_DEADLINE_SECONDS)
  };
}
