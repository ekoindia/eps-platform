/**
 * Site-wide constants.
 */
export const SITE_URL = "https://eps.eko.in";
export const SALES_MOBILE = "9513181707";
export const SIGNUP_PAGE = "/signup";
/**
 * External self-serve signup funnel (ekostore). Users land here to sign up,
 * verify identity, and start testing. Will move in-house later — change here.
 * (The `?mobile=` merge-field param is Zoho-CRM/email-only and not added on-site.)
 */
export const SIGNUP_URL = "https://ekostore.app/eps";

export const SITE_ORG_NAME = "Eko Platform Services";
export const SITE_LOGO_URL = `${SITE_URL}/eps-logo-color.svg`;

export const API_DEFAULT_VERSION = "v3";

/**
 * npm spec for the EPS context MCP server. The `@latest` tag makes `npx`
 * re-resolve the newest publish on each launch, so users track new releases
 * (code + baked API bundle) without re-editing their MCP config. Offline
 * launches fall back to the npx cache; pin `@<version>` to freeze.
 */
export const EPS_MCP_PKG = "@ekoindia/eps-context-mcp@latest";
/** Command to run the EPS context MCP server (used on the AI + docs pages). */
export const EPS_MCP_CMD = `npx -y ${EPS_MCP_PKG}`;

export const PARENT_SITE_URL = "https://eko.in";
export const PARENT_SITE_NAME = "Eko Bharat Ventures Pvt. Ltd.";

/**
 * Default SEO meta — used by DefaultMeta.tsx as the base layer for Helmet cascading.
 */
export const SITE_TITLE =
	"Fintech APIs & Platform for KYC, Verification & Transactions in India | Eko Platform Services";
export const SITE_DESCRIPTION =
	"Compliant fintech APIs built for India. Power KYC, verification, bill payments, and financial workflows for NBFCs, fintech startups, and developers.";
export const SITE_KEYWORDS =
	"fintech, payment API, verification API, DMT, AePS, BBPS, PAN verification, Aadhaar, KYC, DigiLocker";
export const SITE_OG_TITLE =
	"Fintech APIs for KYC, Verification & Transactions in India | Eko Platform Services";
export const SITE_OG_IMAGE = `${SITE_URL}/eps-website-social-preview.png`;

/** Eko organization GitHub (promoted in the Developers menu + footer). */
export const GITHUB_ORG_URL = "https://github.com/ekoindia";

/** Social media profile links and handles. */
export const SOCIAL_TWITTER_HANDLE = "@ekospeaks";
export const SOCIAL_LINKS = {
	linkedin: "https://www.linkedin.com/company/eko-platform-services/",
	facebook: "https://www.facebook.com/EkoEPS",
	instagram: "https://www.instagram.com/eko__India",
	youtube: "https://www.youtube.com/@eko_india",
	x: "https://x.com/ekospeaks",
} as const;
