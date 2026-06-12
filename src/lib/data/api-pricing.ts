/**
 * Pricing configuration for Verification APIs.
 *
 * Pure data + math module — no React or UI imports — so it can be imported
 * cheaply from both the pricing calculator and ProductPageLayout.
 *
 * Rates sourced from the EPS Verification API Commercial Proposal.
 * All rates are in INR per transaction, EXCLUSIVE of GST @ 18%.
 *
 * A single product (e.g. PAN Verification, id "pan" in api-products.ts) can
 * map to multiple priced APIs (PAN Lite, Bulk PAN, PAN Comprehensive, …) via
 * the optional `productId` field. Priced APIs without a product page (e.g.
 * CKYC Download) simply omit `productId`.
 */

/** One volume slab. Tiers are sorted ascending; the last tier has upTo: null (= infinity). */
export interface PriceTier {
  /** Inclusive upper bound of monthly volume for this slab; null = no cap */
  upTo: number | null;
  /** INR per transaction, EXCLUDING GST */
  rate: number;
}

export interface PricedApi {
  /** Unique, URL-stable id used in query params, e.g. "pan-lite" */
  id: string;
  /** Display name, e.g. "PAN Verification (Lite)" */
  name: string;
  /** Short tag label for product-card chips, e.g. "Lite". Falls back to name. */
  shortName?: string;
  /**
   * Maps to ApiProductRef.id in api-products.ts. Optional — some priced APIs
   * (CKYC Download, Doctor Verification) have no product page.
   */
  productId?: string;
  /** Picker / rate-card group heading, e.g. "PAN", "Bank Account" */
  group: string;
  /**
   * How tiers apply. "volume" = the matched slab's rate applies to ALL units.
   * "graduated" = each slab is priced separately. Defaults to "volume".
   */
  tierMode?: "volume" | "graduated";
  /** Volume slabs, ascending. A flat rate is a single { upTo: null, rate } entry. */
  tiers: PriceTier[];
  /** Unit label for display; defaults to "per verification" */
  unitLabel?: string;
  /** Highlighted in quick-add chips and shown with a "Popular" badge */
  popular?: boolean;
  /**
   * One-time setup/activation fee in INR (excl. GST). Omit when none.
   * Waived site-wide while SETUP_FEE_WAIVED is true.
   */
  setupFee?: number;
  /**
   * Bulk APIs are billed per individual verification inside the bulk
   * request (not per bulk call). Renders an asterisk + footnote in the UI.
   */
  isBulk?: boolean;
  /** Optional footnote shown alongside the API */
  notes?: string;
}

/** A bundle of APIs whose combined one-time setup fee is discounted. */
export interface SetupFeePack {
  id: string;
  name: string;
  /** Priced-API ids covered by this pack */
  apiIds: string[];
  /** Discounted one-time fee for the whole pack (INR, excl. GST) */
  fee: number;
}

/** GST rate applied on top of all listed prices */
export const GST_RATE = 0.18;
/**
 * When true, all one-time setup fees are waived (limited-time offer).
 * Flip to false to start charging the configured setupFee / pack fees.
 */
export const SETUP_FEE_WAIVED = true;
/**
 * Discounted setup-fee bundles. A pack applies when ALL of its apiIds are
 * selected and its fee beats the sum of those APIs' individual setup fees.
 */
export const SETUP_FEE_PACKS: SetupFeePack[] = [];
/** Default monthly volume preselected for a newly added API */
export const DEFAULT_VOLUME = 10_000;
/** Hard cap for the volume input */
export const MAX_VOLUME = 10_000_000;

/** Ordered group labels — controls picker and rate-card section order */
export const PRICING_GROUP_ORDER = [
  "PAN",
  "Bank Account",
  "UPI",
  "GST & Business",
  "Identity Documents",
  "Vehicle",
  "Employment",
  "Data & Utility",
] as const;

export const PRICED_APIS: PricedApi[] = [
  // PAN
  {
    id: "pan-lite",
    name: "PAN Verification (Lite)",
    shortName: "Lite",
    productId: "pan",
    group: "PAN",
    tiers: [{ upTo: null, rate: 1.2 }],
    popular: true,
  },
  {
    id: "pan-comprehensive",
    name: "PAN Comprehensive",
    shortName: "Comprehensive",
    productId: "pan",
    group: "PAN",
    tiers: [{ upTo: null, rate: 2.04 }],
  },
  {
    id: "pan-bulk",
    name: "Bulk PAN Verification",
    shortName: "Bulk",
    productId: "pan",
    group: "PAN",
    tiers: [{ upTo: null, rate: 1.2 }],
    isBulk: true,
  },
  {
    id: "pan-bulk-status",
    name: "Bulk PAN Status",
    shortName: "Bulk Status",
    productId: "pan",
    group: "PAN",
    tiers: [{ upTo: null, rate: 1.2 }],
    isBulk: true,
  },

  // Bank Account
  {
    id: "bank-ifsc",
    name: "Bank Search by IFSC",
    shortName: "IFSC Lookup",
    productId: "bank",
    group: "Bank Account",
    tiers: [{ upTo: null, rate: 0.18 }],
    unitLabel: "per lookup",
  },
  {
    id: "bank-pennyless",
    name: "Bank Account Verification (Pennyless)",
    shortName: "Pennyless",
    productId: "bank",
    group: "Bank Account",
    tiers: [{ upTo: null, rate: 2.04 }],
  },
  {
    id: "bank-pennydrop",
    name: "Bank Account Verification (Pennydrop)",
    shortName: "Pennydrop",
    productId: "bank",
    group: "Bank Account",
    tiers: [{ upTo: null, rate: 3.0 }],
    popular: true,
  },
  {
    id: "bank-bulk",
    name: "Bulk Bank Account Verification",
    shortName: "Bulk",
    productId: "bank",
    group: "Bank Account",
    tiers: [{ upTo: null, rate: 2.04 }],
    isBulk: true,
  },

  // UPI
  {
    id: "upi-vpa",
    name: "UPI ID (VPA) Verification",
    shortName: "VPA Verify",
    productId: "upi",
    group: "UPI",
    tiers: [{ upTo: null, rate: 2.64 }],
    popular: true,
  },
  {
    id: "upi-mobile-to-vpa",
    name: "Mobile to VPA",
    shortName: "Mobile to VPA",
    productId: "upi",
    group: "UPI",
    tiers: [{ upTo: null, rate: 1.44 }],
    unitLabel: "per lookup",
  },

  // GST & Business
  {
    id: "gst-basic",
    name: "GST Verification (Basic)",
    shortName: "Basic",
    productId: "gst",
    group: "GST & Business",
    tiers: [{ upTo: null, rate: 0.72 }],
  },
  {
    id: "gst-fetch-by-pan",
    name: "Fetch GST with PAN",
    shortName: "Fetch by PAN",
    productId: "gst",
    group: "GST & Business",
    tiers: [{ upTo: null, rate: 2.04 }],
  },
  {
    id: "gst-advance",
    name: "Advance GST",
    shortName: "Advance",
    productId: "gst",
    group: "GST & Business",
    tiers: [{ upTo: null, rate: 4.2 }],
  },
  {
    id: "cin",
    name: "CIN Verification",
    productId: "cin",
    group: "GST & Business",
    tiers: [{ upTo: null, rate: 1.8 }],
  },
  {
    id: "din",
    name: "DIN Verification",
    productId: "din",
    group: "GST & Business",
    tiers: [{ upTo: null, rate: 2.04 }],
  },
  {
    id: "fssai",
    name: "FSSAI License Verification",
    productId: "fssai",
    group: "GST & Business",
    tiers: [{ upTo: null, rate: 3.24 }],
  },
  {
    id: "itr-compliance",
    name: "ITR Compliance Check",
    productId: "itr",
    group: "GST & Business",
    tiers: [{ upTo: null, rate: 2.04 }],
  },

  // Identity Documents
  {
    id: "dl",
    name: "Driving Licence Verification",
    productId: "dl",
    group: "Identity Documents",
    tiers: [{ upTo: null, rate: 1.8 }],
  },
  {
    id: "voter-id",
    name: "Voter ID Verification",
    productId: "voter-id",
    group: "Identity Documents",
    tiers: [{ upTo: null, rate: 1.8 }],
  },
  {
    id: "passport",
    name: "Passport Verification",
    productId: "passport",
    group: "Identity Documents",
    tiers: [{ upTo: null, rate: 1.8 }],
  },
  {
    id: "ckyc-download",
    name: "CKYC Download",
    group: "Identity Documents",
    tiers: [{ upTo: null, rate: 7.8 }],
    unitLabel: "per download",
  },
  {
    id: "digilocker-create-url",
    name: "DigiLocker (Create URL)",
    productId: "digilocker",
    group: "Identity Documents",
    tiers: [{ upTo: null, rate: 1.44 }],
    unitLabel: "per request",
  },
  {
    id: "name-match",
    name: "Name Match",
    productId: "name-match",
    group: "Identity Documents",
    tiers: [{ upTo: null, rate: 0.6 }],
    unitLabel: "per match",
  },

  // Vehicle
  {
    id: "rc",
    name: "Vehicle RC Verification",
    productId: "rc",
    group: "Vehicle",
    tiers: [{ upTo: null, rate: 3.0 }],
  },
  {
    id: "e-challan",
    name: "Vehicle E-Challan Advance",
    productId: "e-challan",
    group: "Vehicle",
    tiers: [{ upTo: null, rate: 2.04 }],
    unitLabel: "per check",
  },

  // Employment
  {
    id: "epfo-passbook",
    name: "EPFO Passbook",
    shortName: "EPFO Passbook",
    productId: "employee",
    group: "Employment",
    tiers: [{ upTo: null, rate: 7.2 }],
    unitLabel: "per fetch",
  },
  {
    id: "employee-detail",
    name: "Employee Detail",
    shortName: "Employee Detail",
    productId: "employee",
    group: "Employment",
    tiers: [{ upTo: null, rate: 6.0 }],
  },
  {
    id: "doctor",
    name: "Doctor Verification",
    group: "Employment",
    tiers: [{ upTo: null, rate: 3.6 }],
  },

  // Data & Utility
  {
    id: "email-check",
    name: "Email Verification",
    productId: "email",
    group: "Data & Utility",
    tiers: [{ upTo: null, rate: 8.4 }],
    unitLabel: "per check",
  },
  {
    id: "reverse-geocoding",
    name: "Reverse Geocoding",
    productId: "geocoding",
    group: "Data & Utility",
    tiers: [{ upTo: null, rate: 3.6 }],
    unitLabel: "per lookup",
  },
];

/** Map of all priced APIs for quick lookup by id */
export const PRICED_APIS_MAP: Record<string, PricedApi> = Object.fromEntries(
  PRICED_APIS.map((api) => [api.id, api]),
);

/**
 * True when any API has real volume tiers configured — drives all
 * "volume discount" UI (hero chip, FAQ, footnotes). With flat rates
 * everywhere, no volume-discount messaging is shown.
 */
export const HAS_VOLUME_DISCOUNTS = PRICED_APIS.some(
  (api) => api.tiers.length > 1,
);

/** A pricing FAQ entry (compatible with FaqSection's FaqItem shape). */
export interface PricingFaq {
  q: string;
  a: string;
}

/**
 * Pricing FAQs — single source of truth for the /pricing page, its JSON-LD
 * FAQPage schema, and the generated /pricing.md markdown.
 */
export const PRICING_FAQS: PricingFaq[] = [
  {
    q: "How does billing work?",
    a: "Usage is billed per successful API call — you pay only for verifications that return a result. There is no monthly minimum and no lock-in. Monthly invoices are available on the Connect portal.",
  },
  {
    q: "Is there a setup fee?",
    a: SETUP_FEE_WAIVED
      ? "Setup fees are currently waived as a limited-time offer — you pay ₹0 to activate. Standard activation fees may apply for new integrations once the offer ends."
      : "A one-time setup fee may apply per API or as a discounted bundle. The calculator shows the exact one-time fee for your selection before you sign up.",
  },
  {
    q: "Are the listed prices inclusive of GST?",
    a: "No. All listed rates are exclusive of GST, which is charged at 18%. The calculator lets you toggle the total between GST-inclusive and GST-exclusive views. Add your GST number on the Connect portal for GST-compliant invoices.",
  },
  {
    q: "Am I charged for failed verifications?",
    a: "No. You are only billed for successful API responses. Failed or errored calls are not counted toward your usage.",
  },
  ...(HAS_VOLUME_DISCOUNTS
    ? [
        {
          q: "Do you offer volume discounts?",
          a: "Yes. Volume-based rates are built into the calculator — as your monthly volume grows, the applicable per-transaction rate drops automatically.",
        },
      ]
    : []),
  {
    q: "Is there a free sandbox to test the APIs?",
    a: "Yes. Sandbox access is free — sign up, test every API end-to-end with sample data, and move to production whenever you're ready.",
  },
  {
    q: "Can prices change?",
    a: "Commercials are subject to change based on service-provider terms. Any revision is communicated in advance, and your dashboard always reflects the rates applicable to your account.",
  },
];

/**
 * Display name for a priced API — bulk APIs get an asterisk pointing to
 * the "billed per individual verification" footnote.
 * @param api - The priced API
 */
export const displayName = (api: PricedApi): string =>
  api.isBulk ? `${api.name}*` : api.name;

/** Priced APIs grouped in display order — for the picker and the rate card */
export const PRICING_GROUPS: { label: string; apis: PricedApi[] }[] =
  PRICING_GROUP_ORDER.map((label) => ({
    label,
    apis: PRICED_APIS.filter((api) => api.group === label),
  })).filter((group) => group.apis.length > 0);

/**
 * Returns all priced APIs belonging to a product (ApiProductRef.id).
 * @param productId - Product id from api-products.ts, e.g. "pan"
 */
export const getPricedApisForProduct = (productId: string): PricedApi[] =>
  PRICED_APIS.filter((api) => api.productId === productId);

/**
 * Lowest per-transaction rate across a product's priced APIs (for
 * "Starts at ₹X" hints). Undefined when the product has no priced APIs.
 * @param productId - Product id from api-products.ts
 */
export const getStartingRate = (productId: string): number | undefined => {
  const rates = getPricedApisForProduct(productId).flatMap((api) =>
    api.tiers.map((tier) => tier.rate),
  );
  return rates.length > 0 ? Math.min(...rates) : undefined;
};

/**
 * Unit label for the API behind getStartingRate (the one holding the
 * lowest per-transaction rate), e.g. "per lookup" for Reverse Geocoding.
 * Falls back to the default "per verification".
 * @param productId - Product id from api-products.ts
 */
export const getStartingUnitLabel = (productId: string): string => {
  const startingRate = getStartingRate(productId);
  const startingApi = getPricedApisForProduct(productId).find((api) =>
    api.tiers.some((tier) => tier.rate === startingRate),
  );
  return startingApi?.unitLabel ?? "per verification";
};

/**
 * Short tag labels for a product's priced APIs (shortName, falling back to
 * name) — used for the variant chips on /products cards.
 * @param productId - Product id from api-products.ts, e.g. "pan"
 */
export const getVariantLabels = (productId: string): string[] =>
  getPricedApisForProduct(productId).map((api) => api.shortName ?? api.name);

/**
 * True when any of a product's priced APIs carries the `popular` flag —
 * drives the "Popular" badge on /products cards.
 * @param productId - Product id from api-products.ts
 */
export const hasPopularApi = (productId: string): boolean =>
  getPricedApisForProduct(productId).some((api) => api.popular);

/**
 * Resolves the applicable per-transaction rate for a monthly volume.
 * In "volume" mode (default) the matched slab's rate applies to all units.
 * @param api - The priced API
 * @param volume - Monthly transaction volume
 */
export const getRateForVolume = (api: PricedApi, volume: number): number => {
  const tier =
    api.tiers.find((t) => t.upTo === null || volume <= t.upTo) ??
    api.tiers[api.tiers.length - 1];
  return tier.rate;
};

/** Rate in integer paise, avoiding float drift in line math */
const rateInPaise = (rate: number): number => Math.round(rate * 100);

/**
 * Monthly cost for one API at a volume, in INR (excl. GST).
 * Uses graduated slab math when tierMode is "graduated".
 * @param api - The priced API
 * @param volume - Monthly transaction volume
 */
export const calcLineCost = (api: PricedApi, volume: number): number => {
  if (api.tierMode === "graduated") {
    let remaining = volume;
    let prevCap = 0;
    let paise = 0;
    for (const tier of api.tiers) {
      if (remaining <= 0) break;
      const slabSize =
        tier.upTo === null ? remaining : Math.min(remaining, tier.upTo - prevCap);
      paise += rateInPaise(tier.rate) * slabSize;
      remaining -= slabSize;
      prevCap = tier.upTo ?? prevCap;
    }
    return paise / 100;
  }
  return (rateInPaise(getRateForVolume(api, volume)) * volume) / 100;
};

export interface QuoteLine {
  api: PricedApi;
  volume: number;
  /** Applied per-transaction rate (INR, excl. GST) */
  rate: number;
  /** Monthly line cost (INR, excl. GST) */
  cost: number;
}

export interface SetupFeeQuote {
  /** Applicable one-time fees after best pack pricing (INR, excl. GST) */
  amount: number;
  /** What the user actually pays — 0 while SETUP_FEE_WAIVED */
  payable: number;
  waived: boolean;
  /** Names of setup-fee packs applied (discounted bundles) */
  appliedPacks: string[];
}

export interface Quote {
  lines: QuoteLine[];
  /** Sum of line costs (INR, excl. GST) */
  subtotal: number;
  /** GST amount at GST_RATE */
  gst: number;
  /** subtotal + gst */
  total: number;
  /** Total monthly transaction volume across lines */
  totalVolume: number;
  /** Blended cost per transaction excl. GST; 0 when totalVolume is 0 */
  effectiveRate: number;
  /** One-time setup fee — kept separate from the monthly total */
  setupFee: SetupFeeQuote;
}

/**
 * Computes the one-time setup fee for a set of selected APIs.
 * Greedy pack pricing: packs (in declared order) whose apiIds are all
 * selected replace those APIs' individual fees when cheaper; each API is
 * counted at most once. Returns 0 payable while SETUP_FEE_WAIVED.
 * @param apiIds - Selected priced-API ids
 */
export const calcSetupFee = (apiIds: string[]): SetupFeeQuote => {
  const selected = new Set(apiIds.filter((id) => PRICED_APIS_MAP[id]));
  const uncovered = new Set(selected);
  const appliedPacks: string[] = [];
  let paise = 0;

  for (const pack of SETUP_FEE_PACKS) {
    if (!pack.apiIds.every((id) => uncovered.has(id))) continue;
    const individualPaise = pack.apiIds.reduce(
      (sum, id) => sum + Math.round((PRICED_APIS_MAP[id].setupFee ?? 0) * 100),
      0,
    );
    const packPaise = Math.round(pack.fee * 100);
    if (packPaise < individualPaise) {
      paise += packPaise;
      appliedPacks.push(pack.name);
      pack.apiIds.forEach((id) => uncovered.delete(id));
    }
  }

  for (const id of uncovered) {
    paise += Math.round((PRICED_APIS_MAP[id].setupFee ?? 0) * 100);
  }

  const amount = paise / 100;
  return {
    amount,
    payable: SETUP_FEE_WAIVED ? 0 : amount,
    waived: SETUP_FEE_WAIVED,
    appliedPacks,
  };
};

/**
 * Computes the full monthly quote for a selection of APIs.
 * Unknown api ids are ignored; volumes are clamped to [0, MAX_VOLUME].
 * @param selection - Array of { apiId, volume } pairs
 */
export const calcQuote = (
  selection: { apiId: string; volume: number }[],
): Quote => {
  const lines: QuoteLine[] = selection.flatMap(({ apiId, volume }) => {
    const api = PRICED_APIS_MAP[apiId];
    if (!api) return [];
    const safeVolume = Math.min(
      Math.max(Math.round(Number.isFinite(volume) ? volume : 0), 0),
      MAX_VOLUME,
    );
    return [
      {
        api,
        volume: safeVolume,
        rate: getRateForVolume(api, safeVolume),
        cost: calcLineCost(api, safeVolume),
      },
    ];
  });

  const subtotalPaise = lines.reduce(
    (sum, line) => sum + Math.round(line.cost * 100),
    0,
  );
  const gstPaise = Math.round(subtotalPaise * GST_RATE);
  const totalVolume = lines.reduce((sum, line) => sum + line.volume, 0);

  return {
    lines,
    subtotal: subtotalPaise / 100,
    gst: gstPaise / 100,
    total: (subtotalPaise + gstPaise) / 100,
    totalVolume,
    effectiveRate: totalVolume > 0 ? subtotalPaise / 100 / totalVolume : 0,
    setupFee: calcSetupFee(lines.map((line) => line.api.id)),
  };
};
