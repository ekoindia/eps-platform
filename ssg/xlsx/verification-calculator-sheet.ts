import type { Worksheet } from "exceljs";
import type { PricedApi } from "../../src/lib/data/api-pricing";
import {
  GOLD,
  INR_FORMAT,
  RATE_FORMAT,
  brandedTitle,
  footnoteRow,
  fullWidthRow,
  groupBandRow,
  headerRow,
  introRow,
  markInputCell,
  protectSheet,
  solidFill,
  type PricingXlsxData,
} from "./shared";

/** Lowest rate across tiers — matches the rate card's headline figure. */
export const lowestRate = (api: PricedApi): number =>
  Math.min(...api.tiers.map((tier) => tier.rate));

/**
 * API label with the same markers the markdown rate card uses.
 * `displayName` already appends the bulk asterisk.
 */
export const apiLabel = (api: PricedApi, data: PricingXlsxData): string => {
  const label = data.displayName(api);
  return api.popular ? `${label} (Popular)` : label;
};

/** Notes-column text: per-API note plus a tier hint when discounts exist. */
export const apiNotes = (api: PricedApi): string => {
  const notes: string[] = [];
  if (api.notes) notes.push(api.notes);
  if (api.tiers.length > 1)
    notes.push("Volume discounts apply — see live calculator.");
  return notes.join(" ");
};

/** Build the interactive "Verification Calculator" sheet (usage inputs + live formulas). */
export async function buildVerificationCalculatorSheet(
  ws: Worksheet,
  data: PricingXlsxData,
): Promise<void> {
  ws.columns = [
    { width: 46 },
    { width: 18 },
    { width: 18 },
    { width: 16 },
    { width: 18 },
    { width: 48 },
  ];

  let row = 1;

  // -- Branded header ---------------------------------------------------
  brandedTitle(
    ws,
    row,
    "F",
    "Eko Platform Services — Verification API Pricing Calculator",
  );
  row++;

  const gstPct = Math.round(data.gstRate * 100);
  introRow(
    ws,
    row,
    "F",
    `Enter your expected monthly volumes in the highlighted "Monthly usage" column. All rates are in INR, exclusive of GST @ ${gstPct}%.`,
  );
  row++;

  const liveUrl = `${data.siteUrl}/pricing`;
  const link = fullWidthRow(ws, row, "F", {
    text: `Open the live calculator: ${liveUrl}`,
    hyperlink: liveUrl,
  });
  link.font = { size: 10, underline: true, color: { argb: "FF0563C1" } };
  row++;

  if (data.setupFeeWaived) {
    const waived = fullWidthRow(
      ws,
      row,
      "F",
      "One-time setup fee: ₹0 — waived (limited-time offer).",
    );
    waived.font = { size: 10, italic: true, color: { argb: "FF475569" } };
    row++;
  }

  row++; // spacer

  // -- Column header (frozen) -------------------------------------------
  headerRow(ws, row, [
    "API",
    "Billing unit",
    `Rate (₹, excl. GST)`,
    "Monthly usage",
    "Monthly cost (₹)",
    "Notes",
  ]);
  row++;

  // -- API rows, grouped --------------------------------------------------
  let firstDataRow = 0;
  let lastDataRow = 0;
  for (const group of data.groups) {
    groupBandRow(ws, row, "F", group.label);
    row++;

    for (const api of group.apis) {
      if (!firstDataRow) firstDataRow = row;
      lastDataRow = row;

      ws.getCell(`A${row}`).value = apiLabel(api, data);
      ws.getCell(`B${row}`).value = api.unitLabel ?? "per verification";

      const rateCell = ws.getCell(`C${row}`);
      rateCell.value = lowestRate(api);
      rateCell.numFmt = RATE_FORMAT;

      const usageCell = markInputCell(ws, `D${row}`);
      usageCell.numFmt = "#,##0";
      usageCell.dataValidation = {
        type: "whole",
        operator: "between",
        allowBlank: true,
        showErrorMessage: true,
        formulae: [0, data.maxVolume],
        errorTitle: "Invalid volume",
        error: `Enter a whole number between 0 and ${data.maxVolume.toLocaleString("en-IN")}.`,
      };

      const costCell = ws.getCell(`E${row}`);
      costCell.value = { formula: `C${row}*D${row}` };
      costCell.numFmt = INR_FORMAT;

      const notesCell = ws.getCell(`F${row}`);
      notesCell.value = apiNotes(api);
      notesCell.font = { size: 9, color: { argb: "FF64748B" } };

      row++;
    }
  }

  row++; // spacer

  // -- Summary block ------------------------------------------------------
  const summaryRow = (
    label: string,
    value: { formula: string } | number,
    opts?: { bold?: boolean; gold?: boolean },
  ) => {
    ws.mergeCells(`A${row}:D${row}`);
    const labelCell = ws.getCell(`A${row}`);
    labelCell.value = label;
    labelCell.alignment = { horizontal: "right" };
    labelCell.font = { bold: opts?.bold ?? true, size: opts?.gold ? 12 : 10 };
    const valueCell = ws.getCell(`E${row}`);
    valueCell.value = value;
    valueCell.numFmt = INR_FORMAT;
    valueCell.font = { bold: true, size: opts?.gold ? 12 : 10 };
    if (opts?.gold) {
      labelCell.fill = solidFill(GOLD);
      valueCell.fill = solidFill(GOLD);
    }
    const r = row;
    row++;
    return r;
  };

  const subtotalRow = summaryRow("Subtotal (excl. GST)", {
    formula: `SUM(E${firstDataRow}:E${lastDataRow})`,
  });
  const gstRow = summaryRow(`GST @ ${gstPct}%`, {
    formula: `E${subtotalRow}*${data.gstRate}`,
  });
  summaryRow(
    data.setupFeeWaived
      ? "One-time setup fee (waived — limited-time offer)"
      : "One-time setup fee",
    0,
    { bold: false },
  );
  summaryRow(
    "Estimated monthly total (incl. GST)",
    { formula: `E${subtotalRow}+E${gstRow}` },
    { gold: true },
  );

  row++; // spacer

  // -- Footnotes ------------------------------------------------------------
  const footnotes: string[] = [];
  if (data.groups.some((group) => group.apis.some((api) => api.isBulk))) {
    footnotes.push(
      "* Bulk APIs are billed per individual verification inside the bulk request, not per bulk call.",
    );
  }
  footnotes.push(
    "Billed per successful API call — failed or errored calls are not charged.",
  );
  if (data.hasVolumeDiscounts) {
    footnotes.push(
      "Volume discounts apply automatically — higher monthly volumes get lower per-transaction rates.",
    );
  }
  footnotes.push(
    "Commercials are subject to change based on service-provider terms; revisions are communicated in advance.",
  );
  for (const note of footnotes) {
    footnoteRow(ws, row, "F", note);
    row++;
  }

  await protectSheet(ws);
}
