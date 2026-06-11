import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to conditionally join class names together. It uses the `clsx` library to handle conditional logic and the `twMerge` library to merge Tailwind CSS class names without conflicts.
 * @param inputs - An array of class names or conditional class name objects.
 * @returns A string of merged class names.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Utility function to format a mobile number (string or number) by inserting spaces for better readability. If the mobile number has 10 digits, it formats it as `### ### ####`. For any other length, it returns the mobile number as a string without formatting.
 * @param mobile - The mobile number to format.
 * @returns A formatted mobile number string.
 */
export function formatMobile(mobile: string | number): string {
  const mobileStr = String(mobile).replace(/\s+/g, ""); // Remove any existing spaces
  if (mobileStr.length === 10) {
    return `+91 ${mobileStr.slice(0, 3)} ${mobileStr.slice(3, 6)} ${mobileStr.slice(6)}`;
  }
  return mobileStr;
}



/**
 * Formats a number as Indian Rupees with en-IN digit grouping (lakh/crore),
 * e.g. 100000 → "₹1,00,000".
 * @param amount - The amount in INR.
 * @param maxFractionDigits - Maximum decimal places to show (default 2).
 * @param minFractionDigits - Minimum decimal places to show (default 0). Pass 2 for per-unit rates so "₹1.20" keeps its trailing zero.
 * @returns Formatted INR currency string.
 */
export function formatINR(
  amount: number,
  maxFractionDigits = 2,
  minFractionDigits = 0,
): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  }).format(amount);
}

/**
 * Formats a per-transaction rate in INR with exactly two decimals,
 * e.g. 1.2 → "₹1.20", 3 → "₹3.00".
 * @param rate - The per-transaction rate in INR.
 * @returns Formatted INR rate string.
 */
export const formatINRRate = (rate: number): string => formatINR(rate, 2, 2);

/**
 * Formats a number in compact Indian units for tick labels and chips,
 * e.g. 500 → "500", 10000 → "10K", 100000 → "1L", 10000000 → "1Cr".
 * @param value - The number to format.
 * @returns Compact Indian-style number string.
 */
export function formatIndianCompact(value: number): string {
  const format = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
  if (value >= 10_000_000) return `${format(value / 10_000_000)}Cr`;
  if (value >= 100_000) return `${format(value / 100_000)}L`;
  if (value >= 1_000) return `${format(value / 1_000)}K`;
  return String(value);
}

/**
 * Utility function to normalize API label: Append "API" suffix if not already present (both singular or plural), and convert to title case. E.g. "GST Verification" becomes "GST Verification API", while "PAN API" stays "PAN API".
 * MARK: Normalize API Label
 * @param {string} label - The original API label to normalize.
 * @return {string} The normalized API label with "API" suffix if it wasn't already present.
 */
export const normalizeApiLabel = (label: string): string => {
  const _label = label.trim().toLowerCase();
  return label + (_label.endsWith("api") || _label.endsWith("apis") ? "" : " API");
};