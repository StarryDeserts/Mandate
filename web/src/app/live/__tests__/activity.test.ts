import { describe, expect, it } from "vitest";
import {
  appendLiveActivityItem,
  clearLiveActivityItems,
  createApprovalActivity,
  createDangerousBlockedActivity,
  createDepositActivity,
  createFailureActivity,
  createMintActivity,
  createSafeExecutionActivity,
  createSafeSubmitActivity,
  loadLiveActivityItems,
  saveLiveActivityItems,
  type LiveActivityStorage
} from "../activity";

function memoryStorage(initial: Record<string, string> = {}): LiveActivityStorage & { values: Record<string, string> } {
  const values = { ...initial };
  return {
    values,
    getItem: (key) => values[key] ?? null,
    setItem: (key, value) => {
      values[key] = value;
    },
    removeItem: (key) => {
      delete values[key];
    }
  };
}

describe("live activity helpers", () => {
  it("formats transaction and relayer activity items", () => {
    expect(createMintActivity({ id: "mint-1", status: "confirmed", token: "USDG", amountLabel: "200 USDG", txHash: "0xaaa", timestamp: 1000 })).toMatchObject({
      id: "mint-1",
      type: "mint",
      title: "Mint confirmed",
      status: "confirmed",
      summary: "Minted 200 USDG project demo tokens to the connected wallet.",
      txHash: "0xaaa",
      balanceDelta: "+200 USDG wallet"
    });

    expect(createApprovalActivity({ id: "approve-1", status: "confirmed", token: "USDG", amountLabel: "200 USDG", txHash: "0xbbb", timestamp: 1001 })).toMatchObject({
      type: "approve",
      title: "Exact approval confirmed",
      summary: "Approved exactly 200 USDG for MandateAccount deposit."
    });

    expect(createDepositActivity({ id: "deposit-1", status: "confirmed", token: "USDG", amountLabel: "200 USDG", txHash: "0xccc", timestamp: 1002 })).toMatchObject({
      type: "deposit",
      title: "Deposit confirmed",
      summary: "Deposited 200 USDG into MandateAccount.",
      balanceDelta: "-200 USDG wallet / +200 USDG MandateAccount"
    });

    expect(createSafeSubmitActivity({ id: "safe-submit-1", txHash: "0xddd", timestamp: 1003 })).toMatchObject({
      type: "safe",
      title: "Small TSLA buy submitted",
      status: "confirmed",
      summary: "Demo agent submitted the small TSLA buy candidate to Mandate."
    });

    expect(createSafeExecutionActivity({ id: "safe-execute-1", txHash: "0xeee", timestamp: 1004 })).toMatchObject({
      type: "safe",
      title: "Small TSLA buy executed",
      status: "executed",
      summary: "Mandate approved and executed the small TSLA buy candidate.",
      balanceDelta: "MandateAccount balances updated"
    });

    expect(createDangerousBlockedActivity({ id: "dangerous-1", txHash: "0xfff", timestamp: 1005, reason: "SINGLE_ASSET_EXPOSURE_EXCEEDED" })).toMatchObject({
      type: "dangerous",
      title: "Dangerous action blocked",
      status: "blocked",
      summary: "Mandate blocked the aggressive TSLA increase. Funds moved: no.",
      reason: "SINGLE_ASSET_EXPOSURE_EXCEEDED"
    });

    expect(createFailureActivity({ id: "failure-1", type: "deposit", rejected: true, message: "User rejected request.", timestamp: 1006 })).toMatchObject({
      type: "deposit",
      title: "Deposit rejected",
      status: "rejected",
      summary: "User rejected request."
    });
  });

  it("loads, saves, appends, and clears activity items", () => {
    const storage = memoryStorage();
    const mint = createMintActivity({ id: "mint-1", status: "confirmed", token: "USDG", amountLabel: "200 USDG", timestamp: 1000 });
    const deposit = createDepositActivity({ id: "deposit-1", status: "confirmed", token: "USDG", amountLabel: "200 USDG", timestamp: 1001 });

    expect(loadLiveActivityItems(storage)).toEqual([]);
    expect(saveLiveActivityItems(storage, [mint])).toEqual([mint]);
    expect(loadLiveActivityItems(storage)).toEqual([mint]);
    expect(appendLiveActivityItem(storage, deposit)).toEqual([deposit, mint]);
    expect(clearLiveActivityItems(storage)).toEqual([]);
    expect(loadLiveActivityItems(storage)).toEqual([]);
  });

  it("tolerates missing storage and malformed JSON", () => {
    const malformed = memoryStorage({ "mandate.live.activity.v1": "{not valid json" });
    const mint = createMintActivity({ id: "mint-1", status: "confirmed", token: "USDG", amountLabel: "200 USDG", timestamp: 1000 });

    expect(loadLiveActivityItems(null)).toEqual([]);
    expect(saveLiveActivityItems(null, [mint])).toEqual([mint]);
    expect(appendLiveActivityItem(null, mint)).toEqual([mint]);
    expect(clearLiveActivityItems(null)).toEqual([]);
    expect(loadLiveActivityItems(malformed)).toEqual([]);
  });
});
