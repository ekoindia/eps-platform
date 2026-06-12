/**
 * Full operator-wise BBPS Instant commission list.
 *
 * Excel-only payload: this module is NEVER imported by client code — it is
 * loaded via ssrLoadModule by vite-plugin-generate-xlsx.ts and rendered into
 * the "BBPS Operator Rates" sheet of the downloadable pricing workbook.
 *
 * All values are per transaction, EXCLUSIVE of GST. "fixed" commissions are
 * in ₹; "pct" commissions are percent-of-amount numbers (e.g. 2.56 = 2.56%).
 * Commission can differ for transactions above vs up to ₹5,000.
 *
 * Source: EPS Fintech API Commercial Proposal — "BBPS Instant —
 * Operator-wise Commission" (instant settlement).
 */

export interface BbpsOperator {
  /** Operator display name, e.g. "BSES Rajdhani" */
  operator: string;
  /** PDF category label, e.g. "Electricity", "EMI Payments" */
  category: string;
  /** Commission for transactions above ₹5,000 */
  commAbove5k: number;
  /** Commission for transactions up to ₹5,000 */
  commUpTo5k: number;
  /** "fixed" = ₹ per transaction; "pct" = % of transaction amount */
  type: "fixed" | "pct";
}

/** Compact row tuple: [operator, category, commAbove5k, commUpTo5k, type] */
type OperatorRow = [string, string, number, number, BbpsOperator["type"]];

const ROWS: OperatorRow[] = [
  ["Airtel Landline", "Landline", 0.72, 0.72, "fixed"],
  ["Airtel Postpaid", "Postpaid", 0.72, 0.72, "fixed"],
  ["Reliance Energy Mumbai", "Electricity", 1.2, 1.2, "fixed"],
  ["BSES Rajdhani", "Electricity", 1.2, 1.2, "fixed"],
  ["BSES Yamuna", "Electricity", 1.2, 1.2, "fixed"],
  ["BSNL Cellone", "Postpaid", 0.72, 0.72, "fixed"],
  ["ICICI Prudential Life Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["Mahanagar Gas Limited", "Gas", 1.2, 1.2, "fixed"],
  ["MSEB Mumbai", "Electricity", 1.2, 1.2, "fixed"],
  ["Tata Power Delhi Distribution", "Electricity", 1.2, 1.2, "fixed"],
  ["Tata AIA Life Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["Tata TeleServices CDMA", "Landline", 0.72, 0.72, "fixed"],
  ["Tikona Infinet Pvt Ltd", "Postpaid", 0.72, 0.72, "fixed"],
  ["Reliance Postpaid CDMA", "Postpaid", 0.72, 0.72, "fixed"],
  ["Birla Sun Life Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["Madhya Gujarat Vij Company", "Electricity", 1.2, 1.2, "fixed"],
  ["Dakshin Gujarat Vij Company", "Electricity", 1.2, 1.2, "fixed"],
  ["Paschim Gujarat Vij Company", "Electricity", 1.2, 1.2, "fixed"],
  ["Uttar Gujarat Vij Company", "Electricity", 1.2, 1.2, "fixed"],
  ["BEST", "Electricity", 1.2, 1.2, "fixed"],
  ["Chhattisgarh Electricity Board", "Electricity", 1.2, 1.2, "fixed"],
  ["Noida Power Company Limited", "Electricity", 1.2, 1.2, "fixed"],
  ["Jaipur Vidyut Vitran Nigam Ltd", "Electricity", 1.2, 1.2, "fixed"],
  ["Jodhpur Vidyut Vitran Nigam Ltd", "Electricity", 1.2, 1.2, "fixed"],
  ["Indraprastha Gas", "Gas", 1.2, 1.2, "fixed"],
  ["Gujarat Gas Company Limited", "Gas", 1.2, 1.2, "fixed"],
  ["Bangalore Electricity Supply", "Electricity", 1.2, 1.2, "fixed"],
  ["Bangalore Water Supply", "Water", 1.2, 1.2, "fixed"],
  ["Torrent Power Ltd.", "Electricity", 1.2, 1.2, "fixed"],
  ["SBI Life Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["Hathway", "Broadband", 0.72, 0.72, "fixed"],
  ["Reliance Jio Postpaid", "Postpaid", 0.72, 0.72, "fixed"],
  ["Tata Power Mumbai", "Electricity", 1.2, 1.2, "fixed"],
  ["Uttarakhand Jal Sansthan", "Water", 1.2, 1.2, "fixed"],
  ["Assam Power Distribution Company", "Electricity", 1.2, 1.2, "fixed"],
  ["Municipal Corporation of Gurugram", "Municipal Corp", 0.72, 1.824, "fixed"],
  ["Mumbai Metro", "Metro", 0.8, 0.8, "fixed"],
  ["Bajaj Finance Ltd (Overdue)", "EMI Payments", 0.72, 0.72, "fixed"],
  ["Bajaj Allianz Life Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["UPPCL - URBAN", "Electricity", 1.2, 1.2, "fixed"],
  ["South Bihar Power Distribution", "Electricity", 1.2, 1.2, "fixed"],
  ["Haryana City Gas", "Gas", 1.2, 1.2, "fixed"],
  ["NESCO, Odisha", "Electricity", 1.2, 1.2, "fixed"],
  ["Uttarakhand Power Corporation", "Electricity", 1.2, 1.2, "fixed"],
  ["Tamil Nadu Electricity Board (TNEB)", "Electricity", 1.2, 1.2, "fixed"],
  ["UPPCL - RURAL", "Electricity", 1.2, 1.2, "fixed"],
  ["UHBVN", "Electricity", 1.2, 1.2, "fixed"],
  ["DHBVN", "Electricity", 1.2, 1.2, "fixed"],
  ["Punjab State Power Corp (PSPCL)", "Electricity", 1.2, 1.2, "fixed"],
  ["Jharkhand Bijli Vitran Nigam (JBVNL)", "Electricity", 1.2, 1.2, "fixed"],
  ["WBSEDCL", "Electricity", 1.2, 1.2, "fixed"],
  ["Himachal Pradesh Electricity", "Electricity", 1.2, 1.2, "fixed"],
  ["Airtel Broadband", "Broadband", 0.72, 0.72, "fixed"],
  ["Delhi Jal Board", "Water", 1.2, 1.2, "fixed"],
  ["Haryana Urban Development Authority", "Water", 1.2, 1.2, "fixed"],
  ["IndusInd Bank FASTag", "FASTag", 1.12, 1.12, "fixed"],
  ["ICICI Bank FASTag", "FASTag", 1.12, 1.12, "fixed"],
  ["HDFC Bank FASTag", "FASTag", 1.12, 1.12, "fixed"],
  ["IDFC FIRST Bank FASTag", "FASTag", 1.12, 1.12, "fixed"],
  ["Axis Bank FASTag", "FASTag", 1.12, 1.12, "fixed"],
  ["Kotak Mahindra Bank FASTag", "FASTag", 1.12, 1.12, "fixed"],
  ["IOB FASTag", "FASTag", 1.12, 1.12, "fixed"],
  ["Paytm Payments Bank FASTag", "FASTag", 1.12, 1.12, "fixed"],
  ["Federal Bank FASTag", "FASTag", 1.12, 1.12, "fixed"],
  ["State Bank of India FASTag", "FASTag", 1.12, 1.12, "fixed"],
  ["Bank of Maharashtra FASTag", "FASTag", 1.12, 1.12, "fixed"],
  ["Karnataka Bank FASTag", "FASTag", 1.12, 1.12, "fixed"],
  ["Indian Bank FASTag", "FASTag", 1.12, 1.12, "fixed"],
  ["Transcorp International FASTag", "FASTag", 1.12, 1.12, "fixed"],
  ["Hindustan Petroleum (HPCL)", "LPG Booking", 0.8, 0, "fixed"],
  ["Bharat Petroleum (BPCL)", "LPG Booking", 0.8, 0, "fixed"],
  ["Indian Oil Corporation", "LPG Booking", 0.8, 0, "fixed"],
  ["Flexsalary", "EMI Payments", 2, 2, "fixed"],
  ["L&T Financial Services", "EMI Payments", 2, 2, "fixed"],
  ["Tata Capital Financial Services", "EMI Payments", 2, 2, "fixed"],
  ["Shriram City Union Finance", "EMI Payments", 2, 2, "fixed"],
  ["Indiabulls Housing Finance", "EMI Payments", 2, 2, "fixed"],
  ["IIFL Finance Limited", "EMI Payments", 2, 2, "fixed"],
  ["IIFL Home Finance", "EMI Payments", 2, 2, "fixed"],
  ["HDB Financial Services", "EMI Payments", 2, 2, "fixed"],
  ["Muthoot Finance", "EMI Payments", 2, 2, "fixed"],
  ["Bajaj Housing Finance", "EMI Payments", 2, 2, "fixed"],
  ["LIC Housing Finance", "EMI Payments", 2, 2, "fixed"],
  ["Kotak Mahindra Bank - Loans", "EMI Payments", 2, 2, "fixed"],
  ["ICICI Bank - Loans", "EMI Payments", 2, 2, "fixed"],
  ["Axis Bank - Retail Loan", "EMI Payments", 2, 2, "fixed"],
  ["Shriram Transport Finance", "EMI Payments", 2, 2, "fixed"],
  ["Mahindra & Mahindra Financial", "EMI Payments", 2, 2, "fixed"],
  ["TVS Credit", "EMI Payments", 2, 2, "fixed"],
  ["Tata Motors Finance", "EMI Payments", 2, 2, "fixed"],
  ["CreditAccess Grameen", "EMI Payments", 2, 2, "fixed"],
  ["Spandana Sphoorty Financial", "EMI Payments", 2, 2, "fixed"],
  ["Ujjivan Small Finance Bank", "EMI Payments", 2, 2, "fixed"],
  ["Equitas SFB - Microfinance", "EMI Payments", 2, 2, "fixed"],
  ["Equitas SFB - Retail Loan", "EMI Payments", 2, 2, "fixed"],
  ["Suryoday Small Finance Bank", "EMI Payments", 2, 2, "fixed"],
  ["Jana Small Finance Bank", "EMI Payments", 2, 2, "fixed"],
  ["Fincare Small Finance Bank", "EMI Payments", 2, 2, "fixed"],
  ["Unity Small Finance Bank", "EMI Payments", 2, 2, "fixed"],
  ["Muthoot Microfin Limited", "EMI Payments", 2, 2, "fixed"],
  ["Muthoot Fincorp Ltd", "EMI Payments", 2, 2, "fixed"],
  ["Bharat Financial Inclusion", "EMI Payments", 2, 2, "fixed"],
  ["Annapurna Finance (MSME)", "EMI Payments", 2, 2, "fixed"],
  ["Annapurna Finance (MFI)", "EMI Payments", 2, 2, "fixed"],
  ["Five Star Business Finance", "EMI Payments", 2, 2, "fixed"],
  ["Poonawalla Fincorp Ltd", "EMI Payments", 2, 2, "fixed"],
  ["Cholamandalam Investment", "EMI Payments", 2, 2, "fixed"],
  ["HDFC Life Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["Max Life Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["IndiaFirst Life Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["Kotak Life Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["Reliance Nippon Life Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["Reliance General Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["Star Health & Allied Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["Aditya Birla Health Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["ICICI Lombard General Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["Magma HDI - Health Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["Magma HDI - Life Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["Manipal Cigna Health Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["Royal Sundaram General Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["Go Digit Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["Chola Insurance", "Insurance", 1.744, 3.76, "fixed"],
  ["Fee Payment", "Education", 1.744, 1.744, "fixed"],
  ["JIO Mobile", "Prepaid", 1, 1, "pct"],
  ["Airtel Mobile", "Prepaid", 1, 1, "pct"],
  ["VI Mobile", "Prepaid", 2.56, 2.56, "pct"],
  ["BSNL Special Mobile", "Prepaid", 3.04, 3.04, "pct"],
  ["Airtel DTH", "DTH", 2.56, 2.56, "pct"],
  ["Dish TV", "DTH", 2.56, 2.56, "pct"],
  ["Sun Direct", "DTH", 2.56, 2.56, "pct"],
  ["Tata Play", "DTH", 2, 2, "pct"],
  ["Videocon D2H", "DTH", 2, 2, "pct"],
  ["BSNL Recharge", "Prepaid", 3.04, 3.04, "pct"],
  ["Credit Card Bill Payment", "Credit Card", 0.2, 0.2, "fixed"],
  ["FASTag (General)", "FASTag", 0.05, 0.05, "pct"],
];

export const BBPS_OPERATORS: BbpsOperator[] = ROWS.map(
  ([operator, category, commAbove5k, commUpTo5k, type]) => ({
    operator,
    category,
    commAbove5k,
    commUpTo5k,
    type,
  }),
);
