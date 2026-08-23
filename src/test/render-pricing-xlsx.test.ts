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
	SETUP_FEE_DISCOUNT_PERCENT,
	VERIFICATION_SETUP_FEE,
	displayName,
} from "@/lib/data/api-pricing";
import {
	AEPS_CASHOUT_SLABS,
	AEPS_MINI_STATEMENT_COMMISSION,
	AEPS_SETTLEMENT_CHARGES,
	BBPS_CATEGORIES,
	BC_SETUP_FEE,
	TDS_RATE,
} from "@/lib/data/payments-pricing";
import {
	DMT_CUSTOMER_FEE_MIN,
	DMT_CUSTOMER_FEE_PCT,
	DMT_DEFAULT_AMOUNT,
	DMT_DEFAULT_MONTHLY_TXNS,
	DMT_MAX_TXN_AMOUNT,
	DMT_MIN_TXN_AMOUNT,
	DMT_RECIPIENT_VERIFY_FEE,
	DMT_SENDER_KYC_FEE,
	EKO_DMT_CHARGE,
	dmtRateCardRows,
	dmtSenderKycInclGst,
} from "@/lib/data/dmt-pricing";
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
	"DMT Calculator",
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
	let dmtSheet: Worksheet;
	let earnings: Worksheet;
	let banking: Worksheet;
	let rateCard: Worksheet;
	let paymentsRateCard: Worksheet;
	let bbpsOperators: Worksheet;

	beforeAll(async () => {
		const buffer = await renderPricingXlsx({
			groups: PRICING_GROUPS,
			gstRate: GST_RATE,
			setupFeeDiscountPercent: SETUP_FEE_DISCOUNT_PERCENT,
			verificationSetupFee: VERIFICATION_SETUP_FEE,
			bcSetupFee: BC_SETUP_FEE,
			tdsRate: TDS_RATE,
			hasVolumeDiscounts: HAS_VOLUME_DISCOUNTS,
			maxVolume: MAX_VOLUME,
			siteUrl: SITE_URL,
			displayName,
			dmt: {
				rows: dmtRateCardRows(),
				senderKycFee: DMT_SENDER_KYC_FEE,
				senderKycInclGst: dmtSenderKycInclGst(),
				recipientVerifyFee: DMT_RECIPIENT_VERIFY_FEE,
				customerFeePct: DMT_CUSTOMER_FEE_PCT,
				customerFeeMin: DMT_CUSTOMER_FEE_MIN,
				ekoCharge: EKO_DMT_CHARGE,
				minTxnAmount: DMT_MIN_TXN_AMOUNT,
				maxTxnAmount: DMT_MAX_TXN_AMOUNT,
				defaultAmount: DMT_DEFAULT_AMOUNT,
				defaultMonthlyTxns: DMT_DEFAULT_MONTHLY_TXNS,
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
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await workbook.xlsx.load(buffer as any);
		index = workbook.getWorksheet("Index")!;
		calculator = workbook.getWorksheet("Verification Calculator")!;
		dmtSheet = workbook.getWorksheet("DMT Calculator")!;
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
			if (SETUP_FEE_DISCOUNT_PERCENT >= 100) {
				expect(texts).toContain("waived");
			} else if (SETUP_FEE_DISCOUNT_PERCENT > 0) {
				expect(texts).toContain(`${SETUP_FEE_DISCOUNT_PERCENT}% off`);
			}
		});

		it("charges the setup fee per API with non-zero usage, net of the discount", () => {
			let formula = "";
			calculator.eachRow((row) => {
				const f = row.getCell(5).formula ?? "";
				if (f.includes("SUMPRODUCT")) formula = f;
			});
			// One fee per used API, scaled by the surviving share of the fee.
			const netFactor = (100 - SETUP_FEE_DISCOUNT_PERCENT) / 100;
			expect(formula).toContain(`>0))*${VERIFICATION_SETUP_FEE}*${netFactor}`);
		});
	});

	describe("Payments Earnings sheet", () => {
		it("charges one setup fee per API family, not per selected row", () => {
			let formula = "";
			earnings.eachRow((row) => {
				const f = row.getCell(6).formula ?? "";
				if (f.includes(`${BC_SETUP_FEE},0)`)) formula = f;
			});
			// AePS and BBPS — two IF terms however many BBPS categories the
			// sheet lists (DMT charges its family fee on its own sheet).
			const terms = formula.match(/IF\(SUM\(/g) ?? [];
			expect(terms).toHaveLength(2);
			const netFactor = (100 - SETUP_FEE_DISCOUNT_PERCENT) / 100;
			expect(formula).toContain(`*${netFactor}`);
		});

		it("lists every BBPS category and both AePS products, but not DMT", () => {
			const texts = cellTexts(earnings);
			expect(texts).not.toContain("Domestic Money Transfer (DMT)");
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
			// One txn input per product (2 AePS + categories)
			let txnInputs = 0;
			earnings.eachRow((row) => {
				if (row.getCell(4).protection?.locked === false) txnInputs++;
			});
			expect(txnInputs).toBe(2 + BBPS_CATEGORIES.length);
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
		it("no longer carries DMT — it moved to its own sheet", () => {
			const texts = cellTexts(paymentsRateCard);
			expect(
				texts.some((t) => t.includes("DMT — Commission by transaction amount")),
			).toBe(false);
			expect(
				texts.some((t) => t.includes("AePS — Cashout")),
			).toBe(true);
		});
	});

	describe("DMT Calculator sheet", () => {
		// The ledger is live formulas, rounded at the same points as
		// calcDmtTxn — otherwise the workbook and the website disagree.
		it("derives the whole ledger from the transfer-amount input", () => {
			const formulas: string[] = [];
			dmtSheet.eachRow((row) => {
				const f = row.getCell(2).formula;
				if (f) formulas.push(f);
			});
			const joined = formulas.join(" | ");
			expect(joined).toContain(
				`ROUND(MAX(${DMT_CUSTOMER_FEE_MIN},`,
			); // 1% floored at ₹10
			expect(joined).toContain(`*${DMT_CUSTOMER_FEE_PCT})`);
			expect(joined).toContain(`/(1+${GST_RATE})`); // strip the inclusive GST
			expect(joined).toContain(`-${EKO_DMT_CHARGE}`); // flat Eko charge, once
			expect(joined).toContain(`*${TDS_RATE},2)`); // TDS rounded to paise
			expect(joined).toContain(`*${GST_RATE},2)`); // RCM GST on commission
			// The ₹2.80 must appear exactly once as a deduction
			expect(joined.match(new RegExp(`-${EKO_DMT_CHARGE}`, "g"))).toHaveLength(
				1,
			);
			expect(joined).not.toContain("VLOOKUP");
		});

		it("offsets recovered add-ons instead of hiding the wallet debit", () => {
			const formulas: string[] = [];
			dmtSheet.eachRow((row) => {
				const f = row.getCell(2).formula;
				if (f) formulas.push(f);
			});
			const joined = formulas.join(" | ");
			expect(joined).toContain(`*${dmtSenderKycInclGst()}`);
			expect(joined).toContain(`*${DMT_RECIPIENT_VERIFY_FEE}`);
			expect(joined).toContain('="Yes"'); // recovery toggle
		});

		it("carries the derived rate card and the RCM guidance", () => {
			const values = new Set<number>();
			dmtSheet.eachRow((row) => {
				const value = row.getCell(5).value; // "Your commission" column
				if (typeof value === "number") values.add(value);
			});
			for (const dmtRow of dmtRateCardRows()) {
				expect(
					values,
					`commission ${dmtRow.grossCommission} missing`,
				).toContain(dmtRow.grossCommission);
			}
			const texts = cellTexts(dmtSheet).join(" ");
			expect(texts).toContain('RCM = "YES"');
			expect(texts).toContain("accountant");
		});
	});
});
