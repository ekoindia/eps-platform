# Profile fields, strength meter and home questions

One config, `src/lib/console/profile-fields.ts`, describes every field of the
partner's business profile. Three surfaces read it:

- **`/console/profile`**: the Business Profile, Legal & Compliance and Contact &
  Online Presence cards (`components/console/BusinessDetails.tsx`), edited in
  place.
- **Profile strength meter** (`components/console/SegmentMeter.tsx`): one
  segment per field, on both the profile page's identity card and Console
  Home's profile card.
- **Console Home question deck** (`components/console/ProfileQuestion.tsx`,
  inside `ProfileCard.tsx`): asks the empty fields one at a time.

## A field

```ts
{
	key: "Industry",                        // stable id (CRM api_name for CRM fields)
	label: "Industry",                      // row label + deck card header
	section: "Business Profile",            // which /console/profile card
	priority: 2,                            // 2 high · 1 medium · 0 low
	kind: "picklist",                       // picklist | text | gstin | url | integer
	question: "Which industry is your business in?", // absent → never asked
	saveTo: { crm: "Industry" },            // absent → read-only
	// options?: fixed choices (director range); picklists come from the backend
	// read?: (profile) => value, for profile-sourced read-only rows
}
```

`profileFields(profile)` returns the list for a partner. The director row
depends on the business type (`directorRule` in `lib/connect/directors.ts`). A
sole proprietor or individual has no director row. An OPC gets a read-only "1".
Every other type gets a question with the type's legal range as its options.

### Where answers are stored: `saveTo`

| Store | Key | Writer |
| --- | --- | --- |
| `crm` | Zoho Lead `api_name` | `PATCH /crm/lead` via `useCrmLead().update` (see [crm-lead.md](./crm-lead.md)) |
| `simplibank` | Eko profile field | `PATCH /profile` (eps-backend `http/profile.ts`). The backend acts as the caller and whitelists fields; today only `gstin`, through interaction **546**. A new field needs its interaction added there. |

A field can name both stores. `writeProfileStores` writes them in a fixed
order, used by both the profile page and the home deck:

1. **CRM first.** If it fails, nothing else is tried, and the usual error is
   shown.
2. **Then SimpliBank.** If this fails after the CRM write landed, the answer
   counts as saved, because the field now reads as filled. The partner sees
   "Saved to our records, but your Eko profile wasn't updated", followed by
   upstream's reason when it gave one. The write is also queued in memory.
3. **Retry.** The next save resends whatever is queued. That includes a profile
   page Save with nothing changed, because the CRM already holds the value.
   The queue is lost on reload.

 Every CRM field must also be in the backend
whitelist (`LEAD_FIELDS` in `packages/eps-backend/src/clients/lead-fields.ts`),
or the PATCH refuses it.

### Current fields

| Field | Question | Priority | Store |
| --- | --- | --- | --- |
| Company Type | (read-only, profile) | – | – |
| Industry | Which industry is your business in? | 2 | crm `Industry` |
| Annual Turnover | What is your annual turnover? | 1 | crm `Annual_Turnover` |
| Employees | How many people work in your business? | 1 | crm `Number_of_Employees` |
| Clients | Roughly how many clients do you serve? | 0 | crm `Number_of_Clients` |
| GST Number | What is your GST number? | 2 | crm `GST_No` + simplibank `gstin` |
| Number of Directors / Partners | How many {directors\|partners} does your business have? | 2 | crm `Count_of_Directors` |
| Authorized Signatory | Who is the authorized signatory? | 1 | crm `Authorized_Signatory_Full_name` |
| Email | (read-only, profile) | – | – |
| Website | What is your business website? | 2 | crm `Website` |
| Mobile App | What is your mobile app called? | 0 | crm `Mobile_App_Name` |

## Adding a field

1. If it is stored in the CRM, add it to `LEAD_FIELDS` in the backend, with its
   picklist options if it has them.
2. Add an entry to `profileFields()` with its label, section, priority, kind,
   question and `saveTo`.
3. The profile page row, the meter segment and the home question all follow from
   that entry. Update the table above.

## Strength meter

`profileStrength()` counts filled fields over all applicable fields, read-only
ones included. Onboarding steps are **not** counted. Before 2026-11 the profile
page measured onboarding progress, so every fully onboarded partner showed 100%
with blank business fields.

The meter is hidden until the CRM Lead has loaded (`strength` is `null`).
Without the Lead, every CRM field would read as empty and the meter would
under-report. It also stays hidden when there is no Lead (`none`) or the CRM is
down (`error`).

## Home question deck

- **Order.** `questionOrder()` puts the highest priority first and shuffles
  within each priority (Fisher–Yates), so partners don't all see the same
  question. The order is fixed once per mount. A field filled anywhere (the
  deck, the profile page, another tab) drops out on the next render.
- **Skip** moves the question to the back of the **whole** queue, so a
  lower-priority question can come up next. Priority only sets the starting
  order. Skips are not persisted and reset on reload. Skip is disabled on the
  last question.
- **Controls.** A list of up to 8 options shows as 2-column chips, and a click
  saves. A longer list (Industry has 14, the director range up to 15) shows as a
  select, and free-text kinds as an input. Save appears only once the draft
  passes `checkAnswer`, which keeps an empty card short. Pressing Enter on an
  invalid draft still submits, and the error is shown.
- **Checks** (`checkAnswer`): a blank answer is refused. An answer must be one
  of the offered options when there are any. Otherwise the same shape rules as
  the profile page apply: GSTIN, http(s) URL, 255 characters.
- **Failures** use `saveFailureMessage()`, shared with the profile page: the
  backend's message for a 400 or 409, otherwise a generic retry note. The
  question stays up.
- **Layout.** While a question is showing, the home card hides the mobile and
  email rows to make room. Both are still on the profile page.
- A picklist question whose backend options haven't arrived is not asked.
- **Done.** Once every field is filled (100%), the deck becomes a "Profile
  complete" note. If the queue is empty but a read-only field such as Email is
  still blank, only the meter shows.
- **No "not applicable" answers** such as "No website" or "Not GST registered".
  They would write placeholder strings into fields the CRM validates. Skip
  covers that case.
