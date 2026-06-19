export type ApiProductRelevance = "H" | "M" | "L";

/** The three product categories — the single source of truth for categories. */
export type ApiProductCategory = "bc" | "payment" | "verification";

export interface ApiProductRef {
	id: string;
	name: string;
	shortName?: string;
	slug: string;
	category: ApiProductCategory;
	shortDesc: string;
	/** When true, the product page is completely hidden from the website */
	disabled?: boolean;
}

/** URL section segment under which all product pages live */
export const PRODUCTS_SECTION_SLUG = "products";

/** Canonical site-relative path for a product page, derived from its slug */
export const productHref = (slug: string): string =>
	`/${PRODUCTS_SECTION_SLUG}/${slug}`;

const API_PRODUCTS_DATA = [
	// BC APIs
	{
		id: "dmt",
		name: "Domestic Money Transfer (DMT)",
		shortName: "DMT",
		slug: "dmt-api",
		category: "bc",
		shortDesc: "Instant domestic money transfer via IMPS/NEFT",
	},
	{
		id: "aeps",
		name: "AePS Cashout",
		// shortName: "AePS",
		slug: "aeps-api",
		category: "bc",
		shortDesc: "Aadhaar-enabled biometric cash withdrawal & transfer",
	},
	{
		id: "ppi-levin",
		name: "PPI Transactions (Levin)",
		slug: "ppi-levin-api",
		category: "bc",
		shortDesc: "Prepaid Instrument (PPI) wallet management and transactions",
	},
	{
		id: "ppi-digikhata",
		name: "PPI DigiKhata (Prepaid Wallet)",
		slug: "ppi-digikhata-api",
		category: "bc",
		shortDesc:
			"DigiKhata prepaid wallet — sender onboarding, Aadhaar KYC, wallet load & transfers",
	},
	{
		id: "user-management",
		name: "User & Agent Management",
		slug: "user-management-api",
		category: "bc",
		shortDesc:
			"Onboard agents/retailers, manage their services, and check settlement balance",
	},
	{
		id: "customer-management",
		name: "Customer Management",
		slug: "customer-management-api",
		category: "bc",
		shortDesc:
			"Rail-agnostic customer onboarding, lookup, and OTP verification",
	},

	// Payment APIs
	{
		id: "transactions",
		name: "Transactions & Refunds",
		slug: "transactions-api",
		category: "payment",
		shortDesc: "Transaction status inquiry and OTP-based refunds",
	},
	{
		id: "bbps",
		name: "Bharat Bill Payment System (BBPS)",
		shortName: "BBPS",
		slug: "bbps-api",
		category: "payment",
		shortDesc: "Bill payments for 25+ biller categories via Bharat Connect",
	},
	{
		id: "cms",
		name: "Cash Management System (CMS)",
		shortName: "CMS",
		slug: "cms-api",
		category: "payment",
		shortDesc: "Cash management & collection services",
		disabled: true,
	},
	{
		id: "payment",
		name: "Payout",
		slug: "payment-api",
		category: "payment",
		shortDesc: "Bulk payouts to bank accounts",
		disabled: true,
	},
	{
		id: "upi-payout",
		name: "UPI Payout",
		slug: "upi-payout-api",
		category: "payment",
		shortDesc: "Instant UPI-based fund transfers",
		disabled: true,
	},
	{
		id: "qr-payment",
		name: "QR Payment",
		slug: "qr-payment-api",
		category: "payment",
		shortDesc: "Generate and manage Dynamic QR codes",
		disabled: true,
	},

	// Verification APIs
	{
		id: "pan",
		name: "PAN Verification",
		slug: "pan-verification-api",
		category: "verification",
		shortDesc: "Full PAN identity fetch in <2 seconds",
	},
	{
		id: "aadhaar",
		name: "Aadhaar Verification",
		slug: "aadhaar-verification-api",
		category: "verification",
		shortDesc: "Aadhaar-based identity & OTP verification",
		disabled: true,
	},
	{
		id: "bank",
		name: "Bank Account Verification",
		shortName: "Bank Verification",
		slug: "bank-verification-api",
		category: "verification",
		shortDesc: "Penny-drop bank account validation",
	},
	{
		id: "gst",
		name: "GST Verification",
		slug: "gst-verification-api",
		category: "verification",
		shortDesc: "GSTIN lookup & filing status",
	},
	{
		id: "digilocker",
		name: "DigiLocker Integration",
		shortName: "DigiLocker",
		slug: "digilocker-api",
		category: "verification",
		shortDesc: "Fetch notarised docs — Aadhaar, DL, marksheets, etc",
	},
	{
		id: "upi",
		name: "UPI ID (VPA) Verification",
		shortName: "UPI ID Verification",
		slug: "upi-verification-api",
		category: "verification",
		shortDesc: "Validate UPI ID (VPA) in real time",
	},
	{
		id: "dl",
		name: "Driving Licence Verification",
		shortName: "DL Verification",
		slug: "dl-verification-api",
		category: "verification",
		shortDesc: "Driving licence validity & details",
	},
	{
		id: "rc",
		name: "Vehicle & RC Verification",
		shortName: "RC Verification",
		slug: "vehicle-rc-verification-api",
		category: "verification",
		shortDesc: "Vehicle registration, ownership & insurance details",
	},
	{
		id: "employee",
		name: "Employee Verification",
		slug: "employee-verification-api",
		category: "verification",
		shortDesc: "Employment & background check via EPFO",
	},
	{
		id: "geocoding",
		name: "Reverse Geocoding",
		slug: "reverse-geocoding-api",
		category: "verification",
		shortDesc: "Convert GPS coordinates to address",
	},
	{
		id: "voter-id",
		name: "Voter ID Verification",
		slug: "voter-id-verification-api",
		category: "verification",
		shortDesc: "Validate voter ID (EPIC) details instantly",
	},
	{
		id: "passport",
		name: "Passport Verification",
		slug: "passport-verification-api",
		category: "verification",
		shortDesc:
			"Verify Indian passport details using file number and date of birth",
	},
	{
		id: "cin",
		name: "CIN Verification",
		slug: "cin-verification-api",
		category: "verification",
		shortDesc: "Validate Company Identification Numbers via MCA",
	},
	{
		id: "ip",
		name: "IP Verification",
		slug: "ip-verification-api",
		category: "verification",
		shortDesc: "Geo-locate and risk-score IP addresses",
	},
	{
		id: "name-match",
		name: "Name Match",
		slug: "name-match-api",
		category: "verification",
		shortDesc: "Fuzzy name matching across identity documents",
	},
	{
		id: "itr",
		name: "ITR Compliance Check",
		shortName: "ITR Compliance",
		slug: "itr-compliance-api",
		category: "verification",
		shortDesc: "Check income tax return filing and compliance status",
	},
	{
		id: "din",
		name: "DIN Verification",
		slug: "din-verification-api",
		category: "verification",
		shortDesc: "Verify Director Identification Numbers via MCA",
	},
	{
		id: "e-challan",
		name: "E-Challan Verification",
		shortName: "E-Challan",
		slug: "e-challan-verification-api",
		category: "verification",
		shortDesc: "Check pending traffic challans for vehicles",
	},
	{
		id: "email",
		name: "Email Verification",
		slug: "email-verification-api",
		category: "verification",
		shortDesc: "Validate email address deliverability and risk",
	},
	{
		id: "fssai",
		name: "FSSAI License Verification",
		shortName: "FSSAI Verification",
		slug: "fssai-verification-api",
		category: "verification",
		shortDesc: "Verify FSSAI food license details and status",
	},
] as const;

/**
 * Union of every defined product id — the valid values for `ApiSpec.productId`.
 * Derived from the literal `as const` data so the FK is checked at compile time.
 */
export type ApiProductId = (typeof API_PRODUCTS_DATA)[number]["id"];

/**
 * All defined API products. Exposed as `readonly ApiProductRef[]` so consumers
 * see the uniform interface shape (every optional key present in the type),
 * while {@link ApiProductId} above keeps the literal id union for FK checking.
 */
export const API_PRODUCTS: readonly ApiProductRef[] = API_PRODUCTS_DATA;

/** Map of all products for quick lookup by ID */
export const API_PRODUCTS_MAP: Record<string, ApiProductRef> =
	Object.fromEntries(API_PRODUCTS.map((p) => [p.id, p]));

/** Returns only products that are not disabled */
export const getActiveProducts = (): ApiProductRef[] =>
	API_PRODUCTS.filter((p) => !p.disabled);

/** Map of active (non-disabled) products for quick lookup by ID */
export const ACTIVE_PRODUCTS_MAP: Record<string, ApiProductRef> =
	Object.fromEntries(getActiveProducts().map((p) => [p.id, p]));
