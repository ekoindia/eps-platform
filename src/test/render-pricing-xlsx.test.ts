// @vitest-environment node
import { Workbook } from "exceljs";
import type { Worksheet } from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  GST_RATE,
  HAS_VOLUME_DISCOUNTS,
  MAX_VOLUME,
  PRICED_APIS,
  PRICING_GROUPS,
  SETUP_FEE_WAIVED,
  displayName,
} from "@/lib/data/api-pricing";
import { SITE_URL } from "@/lib/config/site";
import { renderPricingXlsx } from "../../ssg/render-pricing-xlsx";

/** All non-empty string cell values of a worksheet (handles rich/link values). */
const cellTexts = (ws: Worksheet): string[] => {
  const texts: string[] = [];
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      texts.push(cell.text);
    });
  });
  return texts;
};

describe("renderPricingXlsx", () => {
  let workbook: Workbook;
  let calculator: Worksheet;
  let rateCard: Worksheet;

  beforeAll(async () => {
    const buffer = await renderPricingXlsx({
      groups: PRICING_GROUPS,
      gstRate: GST_RATE,
      setupFeeWaived: SETUP_FEE_WAIVED,
      hasVolumeDiscounts: HAS_VOLUME_DISCOUNTS,
      maxVolume: MAX_VOLUME,
      siteUrl: SITE_URL,
      displayName,
    });
    workbook = new Workbook();
    await workbook.xlsx.load(buffer);
    calculator = workbook.getWorksheet("Calculator")!;
    rateCard = workbook.getWorksheet("Rate Card")!;
  });

  it("contains the Calculator and Rate Card sheets", () => {
    expect(calculator).toBeDefined();
    expect(rateCard).toBeDefined();
  });

  it("lists every priced API with its lowest tier rate on both sheets", () => {
    for (const ws of [calculator, rateCard]) {
      const texts = cellTexts(ws);
      for (const api of PRICED_APIS) {
        const label = texts.find((text) => text.startsWith(displayName(api)));
        expect(label, `${displayName(api)} missing on ${ws.name}`).toBeDefined();
      }
    }
    // Spot-check rate values: rate sits one column left of each usage input.
    const lowestRates = new Map(
      PRICED_APIS.map((api) => [displayName(api), Math.min(...api.tiers.map((tier) => tier.rate))])
    );
    let checked = 0;
    calculator.eachRow((row) => {
      const name = String(row.getCell(1).value ?? "").replace(/ \((Popular)\)| \*/g, "");
      if (lowestRates.has(name)) {
        expect(row.getCell(3).value).toBe(lowestRates.get(name));
        checked++;
      }
    });
    expect(checked).toBe(PRICED_APIS.length);
  });

  it("wires line totals, subtotal, GST and grand total as live formulas", () => {
    let lineFormulas = 0;
    let subtotalRef = "";
    let gstRef = "";
    calculator.eachRow((row, rowNumber) => {
      const cost = row.getCell(5);
      const formula = cost.formula ?? "";
      if (formula === `C${rowNumber}*D${rowNumber}`) lineFormulas++;
      if (formula.startsWith("SUM(E")) subtotalRef = `E${rowNumber}`;
      if (subtotalRef && formula === `${subtotalRef}*${GST_RATE}`) gstRef = `E${rowNumber}`;
    });
    expect(lineFormulas).toBe(PRICED_APIS.length);
    expect(subtotalRef).not.toBe("");
    expect(gstRef).not.toBe("");

    const texts = cellTexts(calculator);
    expect(texts).toContain(`GST @ ${Math.round(GST_RATE * 100)}%`);
    let grandTotalFound = false;
    calculator.eachRow((row) => {
      if (row.getCell(5).formula === `${subtotalRef}+${gstRef}`) grandTotalFound = true;
    });
    expect(grandTotalFound).toBe(true);
  });

  it("unlocks only the usage-input cells and protects the sheet without a password", () => {
    let unlockedCells = 0;
    calculator.eachRow((row) => {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (cell.protection?.locked === false) {
          expect(colNumber).toBe(4); // only the "Monthly usage" column
          unlockedCells++;
        }
      });
    });
    expect(unlockedCells).toBe(PRICED_APIS.length);

    for (const ws of [calculator, rateCard]) {
      const protection = ws.sheetProtection as Record<string, unknown>;
      expect(protection.sheet).toBe(true);
      expect(protection.algorithmName).toBeUndefined(); // no password hash
    }
  });

  it("validates usage inputs as whole numbers within the volume cap", () => {
    let validated = 0;
    calculator.eachRow((row) => {
      const validation = row.getCell(4).dataValidation;
      if (validation?.type === "whole") {
        expect(validation.formulae).toEqual([0, MAX_VOLUME]);
        validated++;
      }
    });
    expect(validated).toBe(PRICED_APIS.length);
  });

  it("links back to the live calculator and carries the billing footnotes", () => {
    const liveUrl = `${SITE_URL}/pricing`;
    let hyperlink = "";
    calculator.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.hyperlink) hyperlink = cell.hyperlink;
      });
    });
    expect(hyperlink).toBe(liveUrl);

    const texts = cellTexts(calculator).join("\n");
    if (PRICED_APIS.some((api) => api.isBulk)) {
      expect(texts).toContain("Bulk APIs are billed per individual verification");
    }
    expect(texts).toContain("Billed per successful API call");
    if (SETUP_FEE_WAIVED) {
      expect(texts).toContain("waived");
    }
  });
});
