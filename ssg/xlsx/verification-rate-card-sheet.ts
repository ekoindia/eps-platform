import type { Worksheet } from "exceljs";
import {
  RATE_FORMAT,
  brandedTitle,
  headerRow,
  introRow,
  protectSheet,
  type PricingXlsxData,
} from "./shared";
import { apiLabel, apiNotes, lowestRate } from "./verification-calculator-sheet";

/** Build the static, read-only "Verification Rate Card" sheet. */
export async function buildVerificationRateCardSheet(
  ws: Worksheet,
  data: PricingXlsxData,
): Promise<void> {
  ws.columns = [
    { width: 22 },
    { width: 46 },
    { width: 18 },
    { width: 18 },
    { width: 48 },
  ];

  let row = 1;
  brandedTitle(
    ws,
    row,
    "E",
    "Eko Platform Services — Verification API Rate Card",
  );
  row++;

  const gstPct = Math.round(data.gstRate * 100);
  introRow(
    ws,
    row,
    "E",
    `All rates are in INR per transaction, exclusive of GST @ ${gstPct}%.`,
  );
  row++;

  row++; // spacer

  headerRow(ws, row, [
    "Group",
    "API",
    `Rate (₹, excl. GST)`,
    "Billing unit",
    "Notes",
  ]);
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

  await protectSheet(ws);
}
