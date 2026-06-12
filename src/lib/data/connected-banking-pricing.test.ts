import { describe, expect, it } from "vitest";
import {
  calcCbQuote,
  CB_MAX_BANK_USERS,
  cbChargeForAmount,
} from "@/lib/data/connected-banking-pricing";

describe("cbChargeForAmount", () => {
  it("resolves slab boundaries correctly", () => {
    expect(cbChargeForAmount(100)).toBe(8);
    expect(cbChargeForAmount(1000)).toBe(8);
    expect(cbChargeForAmount(25000)).toBe(8);
    expect(cbChargeForAmount(25001)).toBe(15);
    expect(cbChargeForAmount(50000)).toBe(15);
  });

  it("clamps amounts above the last slab to the last slab", () => {
    expect(cbChargeForAmount(99999)).toBe(15);
  });
});

describe("calcCbQuote", () => {
  it("computes setup and monthly blocks with GST", () => {
    const quote = calcCbQuote({
      bankUsers: 2,
      monthlyTxns: 5000,
      avgAmount: 10000,
    });
    expect(quote.setupFee).toBe(150000);
    expect(quote.setupGst).toBe(27000);
    expect(quote.setupTotal).toBe(177000);
    expect(quote.perTxn).toBe(8);
    expect(quote.monthlySubtotal).toBe(40000);
    expect(quote.monthlyGst).toBe(7200);
    expect(quote.monthlyTotal).toBe(47200);
  });

  it("uses the higher per-txn charge above ₹25,000", () => {
    const quote = calcCbQuote({
      bankUsers: 1,
      monthlyTxns: 100,
      avgAmount: 30000,
    });
    expect(quote.perTxn).toBe(15);
    expect(quote.monthlySubtotal).toBe(1500);
  });

  it("clamps inputs to sane ranges", () => {
    const quote = calcCbQuote({
      bankUsers: 999,
      monthlyTxns: -5,
      avgAmount: Number.NaN,
    });
    expect(quote.setupFee).toBe(75000 * CB_MAX_BANK_USERS);
    expect(quote.monthlySubtotal).toBe(0);
    expect(quote.perTxn).toBe(8);
  });
});
