import { createRequire } from "node:module";
import { buildBbpsOperatorsSheet } from "./xlsx/bbps-operators-sheet";
import { buildConnectedBankingSheet } from "./xlsx/connected-banking-sheet";
import { buildIndexSheet } from "./xlsx/index-sheet";
import { buildPaymentsEarningsSheet } from "./xlsx/payments-earnings-sheet";
import { buildPaymentsRateCardSheet } from "./xlsx/payments-rate-card-sheet";
import { SHEETS, type PricingXlsxData } from "./xlsx/shared";
import { buildVerificationCalculatorSheet } from "./xlsx/verification-calculator-sheet";
import { buildVerificationRateCardSheet } from "./xlsx/verification-rate-card-sheet";

export type { PricingXlsxData } from "./xlsx/shared";

// exceljs ships CJS only. Load it via require() so this module works both in
// the node-ESM Vite config bundle (where named ESM imports of CJS fail) and
// under vitest's SSR transform.
const nodeRequire = createRequire(import.meta.url);
const ExcelJS: typeof import("exceljs") = nodeRequire("exceljs");

/**
 * Render `/eps-pricing-calculator.xlsx` — the offline companion to the
 * interactive `/pricing` calculators. Seven sheets, in tab order:
 *
 * 1. "Index" — what's inside + internal hyperlinks to every sheet.
 * 2. "Verification Calculator" — monthly COST estimate for verification APIs.
 * 3. "Payments Earnings" — monthly EARNINGS estimate for DMT/AePS/BBPS
 *    (commission products); DMT commission resolves via VLOOKUP against the
 *    slab table on the Payments Rate Card sheet.
 * 4. "Connected Banking" — one-time setup + monthly transaction costs.
 * 5. "Verification Rate Card" — static verification rate reference.
 * 6. "Payments Rate Card" — static DMT/AePS/BBPS commission reference.
 * 7. "BBPS Operator Rates" — full operator-wise BBPS commission list.
 *
 * Pure function — no filesystem or network access — so it can be unit-tested.
 */
export async function renderPricingXlsx(
	data: PricingXlsxData,
): Promise<Buffer> {
	const workbook = new ExcelJS.Workbook();
	workbook.creator = "Eko Platform Services";
	workbook.created = new Date();
	workbook.title =
		"Eko Platform Services — API Pricing & Commission Calculator";

	// Create worksheets up-front so tab order is independent of build order
	// (the Payments Rate Card must be BUILT before the earnings sheet to hand
	// over its DMT VLOOKUP range, but appears later in the tab order).
	const wsIndex = workbook.addWorksheet(SHEETS.index);
	const wsVerificationCalc = workbook.addWorksheet(
		SHEETS.verificationCalculator,
	);
	const wsPaymentsEarnings = workbook.addWorksheet(SHEETS.paymentsEarnings);
	const wsConnectedBanking = workbook.addWorksheet(SHEETS.connectedBanking);
	const wsVerificationRate = workbook.addWorksheet(SHEETS.verificationRateCard);
	const wsPaymentsRate = workbook.addWorksheet(SHEETS.paymentsRateCard);
	const wsBbpsOperators = workbook.addWorksheet(SHEETS.bbpsOperators);

	await buildIndexSheet(wsIndex, data);
	await buildVerificationCalculatorSheet(wsVerificationCalc, data);
	const { dmtLookupRange } = await buildPaymentsRateCardSheet(
		wsPaymentsRate,
		data,
	);
	await buildPaymentsEarningsSheet(wsPaymentsEarnings, data, dmtLookupRange);
	await buildConnectedBankingSheet(wsConnectedBanking, data);
	await buildVerificationRateCardSheet(wsVerificationRate, data);
	await buildBbpsOperatorsSheet(wsBbpsOperators, data);

	return Buffer.from(await workbook.xlsx.writeBuffer());
}
