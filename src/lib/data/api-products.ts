export type ApiProductRelevance = "H" | "M" | "L";

export interface ApiProductRef {
  id: string;
  name: string;
  shortName?: string;
  slug: string;
  href: string;
  category: "bc" | "payment" | "verification";
  shortDesc: string;
  /** When true, the product page is completely hidden from the website */
  disabled?: boolean;
}

export const API_PRODUCTS: ApiProductRef[] = [
  // BC APIs
  {
    id: "dmt",
    name: "Domestic Money Transfer (DMT)",
    shortName: "DMT",
    slug: "dmt-api",
    href: "/products/dmt-api",
    category: "bc",
    shortDesc: "Instant domestic money transfer via IMPS/NEFT",
  },
  {
    id: "aeps",
    name: "AePS Cashout",
    // shortName: "AePS",
    slug: "aeps-api",
    href: "/products/aeps-api",
    category: "bc",
    shortDesc: "Aadhaar-enabled biometric cash withdrawal & transfer",
  },

  // Payment APIs
  {
    id: "bbps",
    name: "Bharat Bill Payment System (BBPS)",
    shortName: "BBPS",
    slug: "bbps-api",
    href: "/products/bbps-api",
    category: "payment",
    shortDesc: "Bill payments for 25+ biller categories via Bharat Connect",
  },
  {
    id: "cms",
    name: "Cash Management System (CMS)",
    shortName: "CMS",
    slug: "cms-api",
    href: "/products/cms-api",
    category: "payment",
    shortDesc: "Cash management & collection services",
    disabled: true,
  },
  {
    id: "payment",
    name: "Payout",
    slug: "payment-api",
    href: "/products/payment-api",
    category: "payment",
    shortDesc: "Bulk payouts to bank accounts",
    disabled: true,
  },
  {
    id: "upi-payout",
    name: "UPI Payout",
    slug: "upi-payout-api",
    href: "/products/upi-payout-api",
    category: "payment",
    shortDesc: "Instant UPI-based fund transfers",
    disabled: true,
  },
  {
    id: "qr-payment",
    name: "QR Payment",
    slug: "qr-payment-api",
    href: "/products/qr-payment-api",
    category: "payment",
    shortDesc: "Generate and manage Dynamic QR codes",
    disabled: true,
  },

  // Verification APIs
  {
    id: "pan",
    name: "PAN Verification",
    slug: "pan-verification-api",
    href: "/products/pan-verification-api",
    category: "verification",
    shortDesc: "Full PAN identity fetch in <2 seconds",
  },
  {
    id: "aadhaar",
    name: "Aadhaar Verification",
    slug: "aadhaar-verification-api",
    href: "/products/aadhaar-verification-api",
    category: "verification",
    shortDesc: "Aadhaar-based identity & OTP verification",
    disabled: true,
  },
  {
    id: "bank",
    name: "Bank Account Verification",
    shortName: "Bank Verification",
    slug: "bank-verification-api",
    href: "/products/bank-verification-api",
    category: "verification",
    shortDesc: "Penny-drop bank account validation",
  },
  {
    id: "gst",
    name: "GST Verification",
    slug: "gst-verification-api",
    href: "/products/gst-verification-api",
    category: "verification",
    shortDesc: "GSTIN lookup & filing status",
  },
  {
    id: "digilocker",
    name: "DigiLocker Integration",
    shortName: "DigiLocker",
    slug: "digilocker-api",
    href: "/products/digilocker-api",
    category: "verification",
    shortDesc: "Fetch notarised docs — Aadhaar, DL, marksheets, etc",
  },
  {
    id: "upi",
    name: "UPI ID (VPA) Verification",
    shortName: "UPI ID Verification",
    slug: "upi-verification-api",
    href: "/products/upi-verification-api",
    category: "verification",
    shortDesc: "Validate UPI ID (VPA) in real time",
  },
  {
    id: "dl",
    name: "Driving Licence Verification",
    shortName: "DL Verification",
    slug: "dl-verification-api",
    href: "/products/dl-verification-api",
    category: "verification",
    shortDesc: "Driving licence validity & details",
  },
  {
    id: "rc",
    name: "Vehicle & RC Verification",
    shortName: "RC Verification",
    slug: "vehicle-rc-verification-api",
    href: "/products/vehicle-rc-verification-api",
    category: "verification",
    shortDesc: "Vehicle registration, ownership & insurance details",
  },
  {
    id: "employee",
    name: "Employee Verification",
    slug: "employee-verification-api",
    href: "/products/employee-verification-api",
    category: "verification",
    shortDesc: "Employment & background check via EPFO",
  },
  {
    id: "geocoding",
    name: "Reverse Geocoding",
    slug: "reverse-geocoding-api",
    href: "/products/reverse-geocoding-api",
    category: "verification",
    shortDesc: "Convert GPS coordinates to address",
  },
  {
    id: "voter-id",
    name: "Voter ID Verification",
    slug: "voter-id-verification-api",
    href: "/products/voter-id-verification-api",
    category: "verification",
    shortDesc: "Validate voter ID (EPIC) details instantly",
  },
  {
    id: "passport",
    name: "Passport Verification",
    slug: "passport-verification-api",
    href: "/products/passport-verification-api",
    category: "verification",
    shortDesc:
      "Verify Indian passport details using file number and date of birth",
  },
  {
    id: "cin",
    name: "CIN Verification",
    slug: "cin-verification-api",
    href: "/products/cin-verification-api",
    category: "verification",
    shortDesc: "Validate Company Identification Numbers via MCA",
  },
  {
    id: "ip",
    name: "IP Verification",
    slug: "ip-verification-api",
    href: "/products/ip-verification-api",
    category: "verification",
    shortDesc: "Geo-locate and risk-score IP addresses",
  },
  {
    id: "name-match",
    name: "Name Match",
    slug: "name-match-api",
    href: "/products/name-match-api",
    category: "verification",
    shortDesc: "Fuzzy name matching across identity documents",
  },
  {
    id: "itr",
    name: "ITR Compliance Check",
    shortName: "ITR Compliance",
    slug: "itr-compliance-api",
    href: "/products/itr-compliance-api",
    category: "verification",
    shortDesc: "Check income tax return filing and compliance status",
  },
  {
    id: "din",
    name: "DIN Verification",
    slug: "din-verification-api",
    href: "/products/din-verification-api",
    category: "verification",
    shortDesc: "Verify Director Identification Numbers via MCA",
  },
  {
    id: "e-challan",
    name: "E-Challan Verification",
    shortName: "E-Challan",
    slug: "e-challan-verification-api",
    href: "/products/e-challan-verification-api",
    category: "verification",
    shortDesc: "Check pending traffic challans for vehicles",
  },
  {
    id: "email",
    name: "Email Verification",
    slug: "email-verification-api",
    href: "/products/email-verification-api",
    category: "verification",
    shortDesc: "Validate email address deliverability and risk",
  },
  {
    id: "fssai",
    name: "FSSAI License Verification",
    shortName: "FSSAI Verification",
    slug: "fssai-verification-api",
    href: "/products/fssai-verification-api",
    category: "verification",
    shortDesc: "Verify FSSAI food license details and status",
  },
];

/** Map of all products for quick lookup by ID */
export const API_PRODUCTS_MAP: Record<string, ApiProductRef> =
  Object.fromEntries(API_PRODUCTS.map((p) => [p.id, p]));

/** Returns only products that are not disabled */
export const getActiveProducts = (): ApiProductRef[] =>
  API_PRODUCTS.filter((p) => !p.disabled);

/** Map of active (non-disabled) products for quick lookup by ID */
export const ACTIVE_PRODUCTS_MAP: Record<string, ApiProductRef> =
  Object.fromEntries(getActiveProducts().map((p) => [p.id, p]));
