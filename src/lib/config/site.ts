/**
 * Site-wide constants.
 */
export const SITE_URL = "https://eps.eko.in";
export const SALES_MOBILE = "9513181707";
export const SIGNUP_PAGE = "/signup";

export const SITE_ORG_NAME = "Eko Platform Services";
export const SITE_LOGO_URL = `${SITE_URL}/eps-logo-color.svg`;

export const API_DEFAULT_VERSION = "v3";

export const PARENT_SITE_URL = "https://eko.in";
export const PARENT_SITE_NAME = "Eko Bharat Ventures Pvt. Ltd.";

/**
 * Default SEO meta — used by DefaultMeta.tsx as the base layer for Helmet cascading.
 */
export const SITE_TITLE = "Fintech APIs & Platform for KYC, Verification & Transactions in India | Eko Platform Services";
export const SITE_DESCRIPTION = "Compliant fintech APIs built for India. Power KYC, verification, bill payments, and financial workflows for NBFCs, fintech startups, and developers.";
export const SITE_KEYWORDS = "fintech, payment API, verification API, DMT, AePS, BBPS, PAN verification, Aadhaar, KYC, DigiLocker";
export const SITE_OG_TITLE = "Fintech APIs for KYC, Verification & Transactions in India | Eko Platform Services";
export const SITE_OG_IMAGE = `${SITE_URL}/eps-website-social-preview.png`;

/** Social media profile links and handles. */
export const SOCIAL_TWITTER_HANDLE = "@ekospeaks";
export const SOCIAL_LINKS = {
	linkedin: "https://www.linkedin.com/company/eko-bharat-ventures/",
	facebook: "https://www.facebook.com/EkoEPS",
	instagram: "https://www.instagram.com/eko__India",
	youtube: "https://www.youtube.com/@eko_india",
	x: "https://x.com/ekospeaks",
} as const;
