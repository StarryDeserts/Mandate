import { describe, expect, it } from "vitest";
import { ReasonCode, humanizeReasonCode, reasonLabel, roleLabel } from "../reasons";

describe("reason labels", () => {
  it("maps reason code 3 to the blocked exposure reason", () => {
    expect(reasonLabel(ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED)).toBe("SINGLE_ASSET_EXPOSURE_EXCEEDED");
  });

  it("maps session role", () => {
    expect(roleLabel(1)).toBe("SESSION");
  });

  it("humanizes policy reasons without changing raw labels", () => {
    expect(reasonLabel(ReasonCode.DAILY_TURNOVER_EXCEEDED)).toBe("DAILY_TURNOVER_EXCEEDED");
    expect(humanizeReasonCode(ReasonCode.DAILY_TURNOVER_EXCEEDED)).toBe("Blocked because this action would exceed the 20% daily turnover limit. Deposit more USDG or reduce the action amount.");
    expect(reasonLabel(ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED)).toBe("SINGLE_ASSET_EXPOSURE_EXCEEDED");
    expect(humanizeReasonCode(ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED)).toBe("Blocked because post-trade exposure would exceed the 35% max exposure limit.");
  });
});
