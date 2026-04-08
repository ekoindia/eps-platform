export type ApiProductRelevance = "H" | "M" | "L";

export interface ApiProductRef {
  id: string;
  name: string;
  slug: string;
  href: string;
  category: "bc" | "payment" | "verification";
  shortDesc: string;
}

export const API_PRODUCTS: ApiProductRef[] = [
  // BC APIs
  { id: "dmt", name: "DMT", slug: "dmt-api", href: "/products/dmt-api", category: "bc", shortDesc: "Instant domestic money transfer via IMPS/NEFT" },
  { id: "aeps", name: "AePS", slug: "aeps-api", href: "/products/aeps-api", category: "bc", shortDesc: "Aadhaar-enabled biometric cash withdrawal & transfer" },
  // Payment APIs
  { id: "bbps", name: "BBPS", slug: "bbps-api", href: "/products/bbps-api", category: "payment", shortDesc: "Bill payments for 25+ biller categories via Bharat Connect" },
  { id: "cms", name: "CMS", slug: "cms-api", href: "/products/cms-api", category: "payment", shortDesc: "Cash management & collection services" },
  { id: "payment", name: "Payout API", slug: "payment-api", href: "/products/payment-api", category: "payment", shortDesc: "Bulk payouts to bank accounts" },
  { id: "upi-payout", name: "UPI Payout", slug: "upi-payout-api", href: "/products/upi-payout-api", category: "payment", shortDesc: "Instant UPI-based fund transfers" },
  { id: "qr-payment", name: "QR Payment", slug: "qr-payment-api", href: "/products/qr-payment-api", category: "payment", shortDesc: "Generate and manage Dynamic QR codes" },
  // Verification APIs
  { id: "pan", name: "PAN Verification", slug: "pan-verification-api", href: "/products/pan-verification-api", category: "verification", shortDesc: "Full PAN identity fetch in <2 seconds" },
  { id: "aadhaar", name: "Aadhaar Verification", slug: "aadhaar-verification-api", href: "/products/aadhaar-verification-api", category: "verification", shortDesc: "Aadhaar-based identity & OTP verification" },
  { id: "bank", name: "Bank Verification", slug: "bank-verification-api", href: "/products/bank-verification-api", category: "verification", shortDesc: "Penny-drop bank account validation" },
  { id: "gst", name: "GST Verification", slug: "gst-verification-api", href: "/products/gst-verification-api", category: "verification", shortDesc: "GSTIN lookup & filing status" },
  { id: "upi", name: "UPI Verification", slug: "upi-verification-api", href: "/products/upi-verification-api", category: "verification", shortDesc: "Validate UPI VPAs in real time" },
  { id: "dl", name: "DL Verification", slug: "dl-verification-api", href: "/products/dl-verification-api", category: "verification", shortDesc: "Driving licence validity & details" },
  { id: "rc", name: "RC Verification", slug: "rc-verification-api", href: "/products/rc-verification-api", category: "verification", shortDesc: "Vehicle registration certificate lookup" },
  { id: "vehicle", name: "Vehicle Verification", slug: "vehicle-verification-api", href: "/products/vehicle-verification-api", category: "verification", shortDesc: "Comprehensive vehicle & chassis details" },
  { id: "digilocker", name: "DigiLocker", slug: "digilocker-api", href: "/products/digilocker-api", category: "verification", shortDesc: "Fetch notarised docs — Aadhaar, DL, marksheets" },
  { id: "employee", name: "Employee Verification", slug: "employee-verification-api", href: "/products/employee-verification-api", category: "verification", shortDesc: "Employment & background check via EPFO" },
  { id: "geocoding", name: "Reverse Geocoding", slug: "reverse-geocoding-api", href: "/products/reverse-geocoding-api", category: "verification", shortDesc: "Convert GPS coordinates to address" },
];

export const API_PRODUCTS_MAP: Record<string, ApiProductRef> = Object.fromEntries(
  API_PRODUCTS.map((p) => [p.id, p])
);
