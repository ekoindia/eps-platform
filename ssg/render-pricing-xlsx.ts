import { createRequire } from "node:module";
import type { Workbook, Worksheet } from "exceljs";
import type { PricedApi } from "../src/lib/data/api-pricing";

// exceljs ships CJS only. Load it via require() so this module works both in
// the node-ESM Vite config bundle (where named ESM imports of CJS fail) and
// under vitest's SSR transform.
const nodeRequire = createRequire(import.meta.url);
const ExcelJS: typeof import("exceljs") = nodeRequire("exceljs");

/**
 * Pricing inputs for the workbook renderer. Passed in (rather than imported)
 * so this module stays node-only and never drags exceljs near client code;
 * the Vite plugin loads `api-pricing.ts` via `ssrLoadModule` and hands the
 * data over.
 */
export interface PricingXlsxData {
  /** `PRICING_GROUPS` — APIs grouped and ordered for display. */
  groups: { label: string; apis: PricedApi[] }[];
  /** `GST_RATE` — e.g. 0.18. */
  gstRate: number;
  /** `SETUP_FEE_WAIVED` — limited-time-offer flag. */
  setupFeeWaived: boolean;
  /** `HAS_VOLUME_DISCOUNTS` — any API with more than one tier. */
  hasVolumeDiscounts: boolean;
  /** `MAX_VOLUME` — upper bound for the usage-input validation. */
  maxVolume: number;
  /** `SITE_URL` — canonical site origin for the live-calculator link. */
  siteUrl: string;
  /** `displayName` helper from api-pricing. */
  displayName: (api: PricedApi) => string;
}

// Brand colours (ARGB) — derived from --color-eko-navy / --color-eko-gold in src/index.css.
const NAVY = "FF033849";
const GOLD = "FFFAB719";
const INPUT_FILL = "FFFEF6E0"; // light gold — signals "type here"
const HEADER_FILL = "FFF1F5F9"; // light slate
const GROUP_FILL = "FFE8EEF1"; // light navy tint

/** Indian-grouping rupee format (₹1,23,45,678) with plain fallback below 1 lakh. */
const INR_FORMAT = '[>=10000000]"₹"##\\,##\\,##\\,##0;[>=100000]"₹"##\\,##\\,##0;"₹"#,##0';
const RATE_FORMAT = '"₹"#,##0.00';

const solidFill = (argb: string) =>
  ({ type: "pattern", pattern: "solid", fgColor: { argb } }) as const;

/** Lowest rate across tiers — matches the rate card's headline figure. */
const lowestRate = (api: PricedApi): number =>
  Math.min(...api.tiers.map((tier) => tier.rate));

/**
 * API label with the same markers the markdown rate card uses.
 * `displayName` already appends the bulk asterisk.
 */
const apiLabel = (api: PricedApi, data: PricingXlsxData): string => {
  const label = data.displayName(api);
  return api.popular ? `${label} (Popular)` : label;
};

/** Notes-column text: per-API note plus a tier hint when discounts exist. */
const apiNotes = (api: PricedApi): string => {
  const notes: string[] = [];
  if (api.notes) notes.push(api.notes);
  if (api.tiers.length > 1) notes.push("Volume discounts apply — see live calculator.");
  return notes.join(" ");
};

/** Merged full-width text row; returns the master cell for further styling. */
const fullWidthRow = (ws: Worksheet, row: number, lastCol: string, value: unknown) => {
  ws.mergeCells(`A${row}:${lastCol}${row}`);
  const cell = ws.getCell(`A${row}`);
  cell.value = value as string;
  return cell;
};

/** Build the interactive "Calculator" sheet (usage inputs + live formulas). */
async function addCalculatorSheet(workbook: Workbook, data: PricingXlsxData): Promise<void> {
  const ws = workbook.addWorksheet("Calculator");
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
  const title = fullWidthRow(ws, row, "F", "Eko Platform Services — Verification API Pricing Calculator");
  title.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  title.fill = solidFill(NAVY);
  title.alignment = { vertical: "middle" };
  ws.getRow(row).height = 30;
  row++;

  const gstPct = Math.round(data.gstRate * 100);
  const intro = fullWidthRow(
    ws,
    row,
    "F",
    `Enter your expected monthly volumes in the highlighted "Monthly usage" column. All rates are in INR, exclusive of GST @ ${gstPct}%.`
  );
  intro.font = { size: 10, color: { argb: "FF475569" } };
  row++;

  const liveUrl = `${data.siteUrl}/pricing`;
  const link = fullWidthRow(ws, row, "F", { text: `Open the live calculator: ${liveUrl}`, hyperlink: liveUrl });
  link.font = { size: 10, underline: true, color: { argb: "FF0563C1" } };
  row++;

  if (data.setupFeeWaived) {
    const waived = fullWidthRow(ws, row, "F", "One-time setup fee: ₹0 — waived (limited-time offer).");
    waived.font = { size: 10, italic: true, color: { argb: "FF475569" } };
    row++;
  }

  row++; // spacer

  // -- Column header (frozen) -------------------------------------------
  const headerRow = row;
  const headers = ["API", "Billing unit", `Rate (₹, excl. GST)`, "Monthly usage", "Monthly cost (₹)", "Notes"];
  headers.forEach((header, i) => {
    const cell = ws.getCell(headerRow, i + 1);
    cell.value = header;
    cell.font = { bold: true, size: 10 };
    cell.fill = solidFill(HEADER_FILL);
    cell.border = { bottom: { style: "thin", color: { argb: NAVY } } };
  });
  ws.views = [{ state: "frozen", ySplit: headerRow }];
  row++;

  // -- API rows, grouped --------------------------------------------------
  let firstDataRow = 0;
  let lastDataRow = 0;
  for (const group of data.groups) {
    const groupCell = fullWidthRow(ws, row, "F", group.label);
    groupCell.font = { bold: true, size: 10, color: { argb: NAVY } };
    groupCell.fill = solidFill(GROUP_FILL);
    row++;

    for (const api of group.apis) {
      if (!firstDataRow) firstDataRow = row;
      lastDataRow = row;

      ws.getCell(`A${row}`).value = apiLabel(api, data);
      ws.getCell(`B${row}`).value = api.unitLabel ?? "per verification";

      const rateCell = ws.getCell(`C${row}`);
      rateCell.value = lowestRate(api);
      rateCell.numFmt = RATE_FORMAT;

      const usageCell = ws.getCell(`D${row}`);
      usageCell.numFmt = "#,##0";
      usageCell.fill = solidFill(INPUT_FILL);
      usageCell.protection = { locked: false };
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
  const summaryRow = (label: string, value: { formula: string } | number, opts?: { bold?: boolean; gold?: boolean }) => {
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

  const subtotalRow = summaryRow("Subtotal (excl. GST)", { formula: `SUM(E${firstDataRow}:E${lastDataRow})` });
  const gstRow = summaryRow(`GST @ ${gstPct}%`, { formula: `E${subtotalRow}*${data.gstRate}` });
  summaryRow(
    data.setupFeeWaived ? "One-time setup fee (waived — limited-time offer)" : "One-time setup fee",
    0,
    { bold: false }
  );
  summaryRow("Estimated monthly total (incl. GST)", { formula: `E${subtotalRow}+E${gstRow}` }, { gold: true });

  row++; // spacer

  // -- Footnotes ------------------------------------------------------------
  const footnotes: string[] = [];
  if (data.groups.some((group) => group.apis.some((api) => api.isBulk))) {
    footnotes.push("* Bulk APIs are billed per individual verification inside the bulk request, not per bulk call.");
  }
  footnotes.push("Billed per successful API call — failed or errored calls are not charged.");
  if (data.hasVolumeDiscounts) {
    footnotes.push("Volume discounts apply automatically — higher monthly volumes get lower per-transaction rates.");
  }
  footnotes.push("Commercials are subject to change based on service-provider terms; revisions are communicated in advance.");
  for (const note of footnotes) {
    const cell = fullWidthRow(ws, row, "F", note);
    cell.font = { size: 9, italic: true, color: { argb: "FF64748B" } };
    row++;
  }

  // Lock everything except the usage column. Empty password = protection
  // without a password prompt (Excel's "Unprotect Sheet" just works) — the
  // goal is preventing accidental edits, not access control.
  await ws.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatColumns: true,
    formatRows: true,
  });
}

/** Build the static, read-only "Rate Card" sheet. */
async function addRateCardSheet(workbook: Workbook, data: PricingXlsxData): Promise<void> {
  const ws = workbook.addWorksheet("Rate Card");
  ws.columns = [{ width: 22 }, { width: 46 }, { width: 18 }, { width: 18 }, { width: 48 }];

  let row = 1;
  const title = fullWidthRow(ws, row, "E", "Eko Platform Services — Verification API Rate Card");
  title.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  title.fill = solidFill(NAVY);
  title.alignment = { vertical: "middle" };
  ws.getRow(row).height = 30;
  row++;

  const gstPct = Math.round(data.gstRate * 100);
  const intro = fullWidthRow(ws, row, "E", `All rates are in INR per transaction, exclusive of GST @ ${gstPct}%.`);
  intro.font = { size: 10, color: { argb: "FF475569" } };
  row++;

  row++; // spacer

  const headerRow = row;
  ["Group", "API", `Rate (₹, excl. GST)`, "Billing unit", "Notes"].forEach((header, i) => {
    const cell = ws.getCell(headerRow, i + 1);
    cell.value = header;
    cell.font = { bold: true, size: 10 };
    cell.fill = solidFill(HEADER_FILL);
    cell.border = { bottom: { style: "thin", color: { argb: NAVY } } };
  });
  ws.views = [{ state: "frozen", ySplit: headerRow }];
  row++;

  for (const group of data.groups) {
    for (const api of group.apis) {
      ws.getCell(`A${row}`).value = group.label;
      ws.getCell(`B${row}`).value = apiLabel(api, data);
      const rateCell = ws.getCell(`C${row}`);
      rateCell.value = lowestRate(api);
      rateCell.numFmt = RATE_FORMAT;
      ws.getCell(`D${row}`).value = api.unitLabel ?? "per verification";
      const notesCell = ws.getCell(`E${row}`);
      notesCell.value = apiNotes(api);
      notesCell.font = { size: 9, color: { argb: "FF64748B" } };
      row++;
    }
  }

  await ws.protect("", { selectLockedCells: true, selectUnlockedCells: true });
}

/**
 * Render `/eps-pricing-calculator.xlsx` — the offline companion to the
 * interactive `/pricing` calculator. Sheet "Calculator" lets partners enter
 * monthly usage volumes against the live rate card (formulas compute line
 * totals, subtotal, GST and the grand total); sheet "Rate Card" is a static
 * reference listing.
 *
 * Pure function — no filesystem or network access — so it can be unit-tested.
 */
export async function renderPricingXlsx(data: PricingXlsxData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Eko Platform Services";
  workbook.created = new Date();
  workbook.title = "Eko Platform Services — Verification API Pricing Calculator";

  await addCalculatorSheet(workbook, data);
  await addRateCardSheet(workbook, data);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
