import { describe, expect, it } from "vitest";
import { erc20FundingAbi, mandateAccountAbi } from "../abis";

function functionNames(abi: readonly { type: string; name?: string }[]) {
  return abi.filter((entry) => entry.type === "function").map((entry) => entry.name);
}

describe("Mandate frontend ABIs", () => {
  it("exposes the deposit-enabled MandateAccount surface", () => {
    expect(functionNames(mandateAccountAbi)).toContain("deposit");
  });

  it("exposes exact approval and public demo mint funding methods", () => {
    const names = functionNames(erc20FundingAbi);

    expect(names).toContain("allowance");
    expect(names).toContain("approve");
    expect(names).toContain("mint");
  });
});
