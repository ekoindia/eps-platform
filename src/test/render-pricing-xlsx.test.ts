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
import {
	AEPS_CASHOUT_SLABS,
	AEPS_MINI_STATEMENT_COMMISSION,
	AEPS_SETTLEMENT_CHARGES,
	BBPS_CATEGORIES,
	DMT_CUSTOMER_FEE_MIN,
	DMT_CUSTOMER_FEE_PCT,
	DMT_MAX_TXN_AMOUNT,
	DMT_SENDER_KYC_FEE,
	DMT_SLABS,
	TDS_RATE,
} from "@/lib/data/payments-pricing";
import {
	CB_BANKS,
	CB_MAX_BANK_USERS,
	CB_SETUP_FEE,
	CB_TXN_SLABS,
} from "@/lib/data/connected-banking-pricing";
import { BBPS_OPERATORS } from "@/lib/data/bbps-operators";
import { SITE_URL } from "@/lib/config/site";
import { renderPricingXlsx } from "../../ssg/render-pricing-xlsx";

const SHEET_ORDER = [
	"Index",
	"Verification Calculator",
	"Payments Earnings",
	"Connected Banking",
	"Verification Rate Card",
	"Payments Rate Card",
	"BBPS Operator Rates",
];

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
	let index: Worksheet;
	let calculator: Worksheet;
	let earnings: Worksheet;
	let banking: Worksheet;
	let rateCard: Worksheet;
	let paymentsRateCard: Worksheet;
	let bbpsOperators: Worksheet;

	beforeAll(async () => {
		const buffer = await renderPricingXlsx({
			groups: PRICING_GROUPS,
			gstRate: GST_RATE,
			setupFeeWaived: SETUP_FEE_WAIVED,
			hasVolumeDiscounts: HAS_VOLUME_DISCOUNTS,
			maxVolume: MAX_VOLUME,
			siteUrl: SITE_URL,
			displayName,
			dmt: {
				slabs: DMT_SLABS,
				senderKycFee: DMT_SENDER_KYC_FEE,
				customerFeePct: DMT_CUSTOMER_FEE_PCT,
				customerFeeMin: DMT_CUSTOMER_FEE_MIN,
				maxTxnAmount: DMT_MAX_TXN_AMOUNT,
				tdsRate: TDS_RATE,
			},
			aeps: {
				cashoutSlabs: AEPS_CASHOUT_SLABS,
				miniStatementCommission: AEPS_MINI_STATEMENT_COMMISSION,
				settlementCharges: AEPS_SETTLEMENT_CHARGES,
			},
			bbps: { categories: BBPS_CATEGORIES, operators: BBPS_OPERATORS },
			cb: {
				setupFee: CB_SETUP_FEE,
				banks: [...CB_BANKS],
				txnSlabs: CB_TXN_SLABS,
				maxBankUsers: CB_MAX_BANK_USERS,
			},
		});
		workbook = new Workbook();
		await workbook.xlsx.load(buffer);
		index = workbook.getWorksheet("Index")!;
		calculator = workbook.getWorksheet("Verification Calculator")!;
		earnings = workbook.getWorksheet("Payments Earnings")!;
		banking = workbook.getWorksheet("Connected Banking")!;
		rateCard = workbook.getWorksheet("Verification Rate Card")!;
		paymentsRateCard = workbook.getWorksheet("Payments Rate Card")!;
		bbpsOperators = workbook.getWorksheet("BBPS Operator Rates")!;
	});

	it("contains all seven sheets with Index first, in order", () => {
		expect(workbook.worksheets.map((ws) => ws.name)).toEqual(SHEET_ORDER);
	});

	describe("Index sheet", () => {
		it("links to every other sheet via internal hyperlinks", () => {
			const hyperlinks: string[] = [];
			index.eachRow((row) => {
				row.eachCell((cell) => {
					if (cell.hyperlink?.startsWith("#'")) hyperlinks.push(cell.hyperlink);
				});
			});
			for (const sheetName of SHEET_ORDER.slice(1)) {
				expect(hyperlinks).toContain(`#'${sheetName}'!A1`);
			}
		});
	});

	describe("Verification Calculator sheet", () => {
		it("lists every priced API with its lowest tier rate on both sheets", () => {
			for (const ws of [calculator, rateCard]) {
				const texts = cellTexts(ws);
				for (const api of PRICED_APIS) {
					const label = texts.find((text) => text.startsWith(displayName(api)));
					expect(
						label,
						`${displayName(api)} missing on ${ws.name}`,
					).toBeDefined();
				}
			}
			// Spot-check rate values: rate sits one column left of each usage input.
			const lowestRates = new Map(
				PRICED_APIS.map((api) => [
					displayName(api),
					Math.min(...api.tiers.map((tier) => tier.rate)),
				]),
			);
			let checked = 0;
			calculator.eachRow((row) => {
				const name = String(row.getCell(1).value ?? "").replace(
					/ \((Popular)\)| \*/g,
					"",
				);
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
				if (subtotalRef && formula === `${subtotalRef}*${GST_RATE}`)
					gstRef = `E${rowNumber}`;
			});
			expect(lineFormulas).toBe(PRICED_APIS.length);
			expect(subtotalRef).not.toBe("");
			expect(gstRef).not.toBe("");

			const texts = cellTexts(calculator);
			expect(texts).toContain(`GST @ ${Math.round(GST_RATE * 100)}%`);
			let grandTotalFound = false;
			calculator.eachRow((row) => {
				if (row.getCell(5).formula === `${subtotalRef}+${gstRef}`)
					grandTotalFound = true;
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

			for (const ws of [calculator, rateCard, earnings, banking]) {
				const protection = (
					ws as unknown as { sheetProtection: Record<string, unknown> }
				).sheetProtection;
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
				expect(texts).toContain(
					"Bulk APIs are billed per individual verification",
				);
			}
			expect(texts).toContain("Billed per successful API call");
			if (SETUP_FEE_WAIVED) {
				expect(texts).toContain("waived");
			}
		});
	});

	describe("Payments Earnings sheet", () => {
		it("resolves the DMT commission via VLOOKUP against the Payments Rate Card", () => {
			let vlookup = "";
			earnings.eachRow((row) => {
				const formula = row.getCell(5).formula ?? "";
				if (formula.includes("VLOOKUP")) vlookup = formula;
			});
			expect(vlookup).toContain("VLOOKUP(");
			expect(vlookup).toContain("'Payments Rate Card'!");
			expect(vlookup).toContain(",4,TRUE)");
		});

		it("lists every BBPS category plus DMT and both AePS products", () => {
			const texts = cellTexts(earnings);
			expect(texts).toContain("Domestic Money Transfer (DMT)");
			expect(texts).toContain("AePS Cash Withdrawal");
			expect(texts).toContain("AePS Mini Statement");
			for (const category of BBPS_CATEGORIES) {
				expect(texts).toContain(category.name);
			}
		});

		it("totals earnings with gross, TDS and net payout formulas", () => {
			let grossRef = "";
			let tdsRef = "";
			let netFound = false;
			earnings.eachRow((row, rowNumber) => {
				const formula = row.getCell(6).formula ?? "";
				if (formula.startsWith("SUM(F")) grossRef = `F${rowNumber}`;
				if (grossRef && formula === `${grossRef}*${TDS_RATE}`)
					tdsRef = `F${rowNumber}`;
				if (grossRef && tdsRef && formula === `${grossRef}-${tdsRef}`)
					netFound = true;
			});
			expect(grossRef).not.toBe("");
			expect(tdsRef).not.toBe("");
			expect(netFound).toBe(true);
		});

		it("unlocks only the avg-amount and txn-count input columns", () => {
			earnings.eachRow((row) => {
				row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
					if (cell.protection?.locked === false) {
						expect([3, 4]).toContain(colNumber);
					}
				});
			});
			// One txn input per product (DMT + 2 AePS + categories)
			let txnInputs = 0;
			earnings.eachRow((row) => {
				if (row.getCell(4).protection?.locked === false) txnInputs++;
			});
			expect(txnInputs).toBe(3 + BBPS_CATEGORIES.length);
		});
	});

	describe("Connected Banking sheet", () => {
		it("computes the setup fee from the bank-integration input", () => {
			let setupFound = false;
			banking.eachRow((row) => {
				const formula = row.getCell(2).formula ?? "";
				if (formula.startsWith(`${CB_SETUP_FEE}*B`)) setupFound = true;
			});
			expect(setupFound).toBe(true);
		});

		it("switches the per-transaction charge by amount slab", () => {
			let chargeFound = false;
			banking.eachRow((row) => {
				const formula = row.getCell(2).formula ?? "";
				if (formula.startsWith("IF(B") && formula.includes("<="))
					chargeFound = true;
			});
			expect(chargeFound).toBe(true);
			const texts = cellTexts(banking).join("\n");
			for (const bank of CB_BANKS) {
				expect(texts).toContain(bank);
			}
		});
	});

	describe("BBPS Operator Rates sheet", () => {
		it("lists every operator from the data module", () => {
			const texts = cellTexts(bbpsOperators);
			for (const operator of BBPS_OPERATORS) {
				expect(texts, `${operator.operator} missing`).toContain(
					operator.operator,
				);
			}
			// Row count: every operator appears exactly once (Type column set)
			let operatorRows = 0;
			bbpsOperators.eachRow((row) => {
				const type = String(row.getCell(5).value ?? "");
				if (type === "Fixed ₹" || type === "% of amount") operatorRows++;
			});
			expect(operatorRows).toBe(BBPS_OPERATORS.length);
		});

		it("has an auto-filter over the operator table", () => {
			expect(bbpsOperators.autoFilter).toBeTruthy();
		});
	});

	describe("Payments Rate Card sheet", () => {
		it("carries every DMT slab with its commission value", () => {
			// Numeric cells: cell.text is the raw value (numFmt isn't applied)
			const values = new Set<number>();
			paymentsRateCard.eachRow((row) => {
				const value = row.getCell(4).value;
				if (typeof value === "number") values.add(value);
			});
			for (const slab of DMT_SLABS) {
				expect(values, `commission ${slab.commission} missing`).toContain(
					slab.commission,
				);
			}
		});
	});
});
