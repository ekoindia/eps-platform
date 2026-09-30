# Security & Data Protection content

The `/security` page answers the safety and security questions prospective
partners ask during due diligence: infrastructure, data residency, Aadhaar and
biometric handling, audits, API security, transaction safeguards and
reconciliation.

## Single source of truth

All copy lives in [`src/lib/data/security.ts`](../src/lib/data/security.ts):

| Export | Used by |
|---|---|
| `SECURITY_SECTIONS` | `/security` page (`src/pages/SecurityPage.tsx`), `/security.md` twin (`src/lib/markdown/render-security.ts`), MCP `security` topic (`buildTopics` in `src/lib/agent/build-agent-bundle.ts`) |
| `SECURITY_FAQS` (tag `security`) | `/faq`, `/faq.md`, FAQPage JSON-LD, `/docs/faqs` "Security & compliance", MCP `get_faqs({ tag: "security" })` |
| `TRANSACTION_AUTH` | The page's transaction section, plus the DMT / AePS / BBPS product-page FAQs |
| `AEPS_OTP_THRESHOLD`, `CLIENT_REF_ID_LENGTH` | Numbers interpolated into the copy above and into the common "gotchas" FAQ |
| `SECURITY_PAGE_TITLE` / `_DESCRIPTION` | Page `<Helmet>` and `.md` front matter |

The DMT per-transfer cap comes from `DMT_MAX_TXN_AMOUNT` in `dmt-pricing.ts`.

### Product-gated copy

The DMT / AePS / BBPS bullets in the "Transaction security" section are
product-specific points (`{ productId, text }`), and are dropped while that
product is `disabled` in `api-products.ts`:

- `SECURITY_SECTIONS` is `resolveSecuritySections(isProductActive)`, so the
  page, `/security.md` and the MCP topic all lose the bullet together.
- The "How are … authenticated?" FAQ lists only enabled products in both
  question and answer, and disappears when none is enabled.
- The product-page FAQs vanish with their product page.

To gate a new product, add it to `TRANSACTION_AUTH` and `TRANSACTION_PRODUCTS`,
and add its key phrases to `PRODUCT_STATEMENTS` in the test.

> [!WARNING]
> Disabling DMT currently breaks `buildAgentBundle`: the DMT recipes in
> `api-recipes.ts` still reference DMT specs (`assertRecipeSlugs` throws). That's
> an existing recipe issue, not a security-page one.

The MCP `get_topic` enum is derived from the bundle's topic keys. Adding a
topic to `AgentTopics` (defined in both `src/lib/agent/agent-bundle-types.ts`
and `packages/eps-context-mcp/src/bundle-types.ts`) and to `buildTopics` needs
no change in `server.ts`.

## Sign-off rule (read before editing)

Every statement is **IT-confirmed public copy**. Never strengthen a claim
without IT and legal sign-off. In particular:

- ISO wording is "audited **against** ISO/IEC 27001". Never "certified".
- There is **no** encryption-at-rest claim. Don't add one.
- IP whitelisting is **optional** and **production-only**.
- `client_ref_id` must be 10–20 characters (10 recommended). The shared param
  description matches, but deliberately has no `minLength` validation, which
  would start rejecting short refs client-side in every SDK.
- DMT monthly sender limits are not yet confirmed. The copy only says "sender-level
  monthly limits apply". Existing per-page limit strings conflict
  (`dmt-pricing.ts` FAQ vs `dmt-fino-sender-ekyc.md` vs `get-customer-info.md`)
  and still need reconciling.

`src/lib/data/security.test.ts` enforces this. Every approved statement,
qualifiers included, must appear in the page data, the markdown twin and the
MCP topic. "certified" and "at rest" are rejected, and every `/security#anchor`
link must hit a real section. If you change a statement, update
`APPROVED_STATEMENTS` in the same change, after sign-off.

## Adding a fact

1. Get IT/legal sign-off on the exact wording.
2. Add it as a bullet in the right `SECURITY_SECTIONS` entry (markdown: bold,
   inline code, site-relative links; links are made absolute for `.md`/MCP).
3. If partners ask it as a question, add a `SECURITY_FAQS` entry linking to
   `/security#<section-id>`.
4. Add the key phrase to `APPROVED_STATEMENTS` in the test.
5. Run `npm run build` to regenerate `security.md`, `llms.txt` and the MCP bundle.
