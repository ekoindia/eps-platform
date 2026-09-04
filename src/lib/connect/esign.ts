/**
 * E-signing the partner agreement — the one id two surfaces gate on.
 *
 * Lives here rather than in either caller because both the console rail
 * (`ConsoleLayout`) and the Next Steps card read it, and a leaf card importing
 * a constant out of the layout that renders it is a coupling neither needs.
 * Same shape as `KYC_LIST_ID` in `kyc.ts`: an *interaction* id from the
 * `/transactions/wlc` list, not an `interaction_type_id`.
 */

/** Interaction id for "e-sign the partner agreement". Gates the feature. */
export const ESIGN_ID = 223;

/** Where both surfaces send a partner who still owes a signature. */
export const ESIGN_PATH = `/console/transaction/${ESIGN_ID}`;
