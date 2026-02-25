

# Integrate Zoho Form Across All Lead Capture Points

## Overview
Replace all mock form submissions (which currently just show "Thank You" without sending data anywhere) with real submissions to the Zoho CRM form endpoint. The existing UI stays exactly the same -- only the submission logic changes.

## Where Forms Exist (4 locations)
1. **Header "Get Started" dialog** (`src/components/Header.tsx`) -- popup form
2. **Product page hero form** (`src/components/ProductPageLayout.tsx`) -- right-side lead form on every API page
3. **Homepage lead capture section** (`src/components/sections/LeadCaptureSection.tsx`) -- bottom-of-page form
4. **CTA section buttons** (`src/components/sections/CTASection.tsx`) -- "Get Started" and "Book a Demo" buttons (these should open the same dialog or link to the form)

## What Will Change

### 1. New Shared Form Submission Utility
Create `src/lib/zoho-form.ts` with a reusable async function that:
- Accepts `{ name, phone, email }` plus optional UTM parameters
- Submits via `fetch()` to `https://forms.zohopublic.in/ekoindiafinancialservicespvtlt/form/NewEkoinAPISignup/formperma/t7sfVQXMPus-0edXDrlVwvYeOUvLukZFFDUpISXlsnk/htmlRecords/submit`
- Maps fields to the Zoho field names: `SingleLine` (name), `PhoneNumber_countrycode` (+91), `PhoneNumber_countrycodeval` (number), `Email` (email)
- Includes hidden fields: `zf_referrer_name`, `zf_redirect_url`, `zc_gad`, and UTM params (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`)
- Reads UTM values from `window.location.search` at submission time
- Returns success/failure so the UI can show the thank-you state or an error toast
- Uses `multipart/form-data` encoding as required by the Zoho endpoint

### 2. Update Header Dialog Form (`Header.tsx`)
- Replace `handleFormSubmit` to call the shared Zoho submit function
- Add loading state on the submit button while the request is in flight
- Show error toast (via sonner) if submission fails; show existing "Thank You" on success

### 3. Update Product Page Hero Form (`ProductPageLayout.tsx`)
- Replace `handleFormSubmit` to call the shared Zoho submit function
- Add `zf_referrer_name` set to the current product page title for lead source tracking
- Add loading state and error handling

### 4. Update Homepage Lead Capture Form (`LeadCaptureSection.tsx`)
- Replace `handleSubmit` to call the shared Zoho submit function
- Add loading state and error handling

### 5. Update CTA Section (`CTASection.tsx`)
- Wire "Get Started" button to trigger the Header's Get Started dialog (currently does nothing)
- This requires either lifting the dialog state or using a custom event / shared context

### 6. Input Validation
- Validate phone: exactly 10 digits
- Validate name: non-empty, max 255 chars
- Validate email: valid format if provided, max 255 chars
- Show inline validation errors before attempting submission

## Files Changed

1. **New:** `src/lib/zoho-form.ts` -- shared submission utility
2. **Edit:** `src/components/Header.tsx` -- wire form to Zoho, add loading/error states
3. **Edit:** `src/components/ProductPageLayout.tsx` -- wire hero form to Zoho, add loading/error states
4. **Edit:** `src/components/sections/LeadCaptureSection.tsx` -- wire form to Zoho, add loading/error states
5. **Edit:** `src/components/sections/CTASection.tsx` -- wire buttons to open Get Started dialog

## Technical Details

### Zoho Field Mapping
```text
Form Field    → Zoho Name
─────────────────────────────────
Name (*)      → SingleLine
Country Code  → PhoneNumber_countrycode (value: "+91")
Phone (*)     → PhoneNumber_countrycodeval
Email         → Email
Referrer      → zf_referrer_name (set to page title or "homepage")
UTM Source    → utm_source (from URL params)
UTM Medium    → utm_medium (from URL params)
UTM Campaign  → utm_campaign (from URL params)
UTM Term      → utm_term (from URL params)
UTM Content   → utm_content (from URL params)
```

### Submission Method
The Zoho form requires `multipart/form-data` POST. The utility will construct a `FormData` object and submit via `fetch()` with `mode: 'no-cors'` (since Zoho's endpoint does not return CORS headers for cross-origin JS requests). Because `no-cors` responses are opaque, the form will optimistically show the success state after the request completes without error.

### UTM Parameter Extraction
```text
// Read from current URL at submission time
const params = new URLSearchParams(window.location.search);
formData.append('utm_source', params.get('utm_source') || '');
// ... same for medium, campaign, term, content
```

### Loading State
Each form gets an `isSubmitting` boolean state. While true, the submit button shows a spinner and is disabled to prevent double submissions.

