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
