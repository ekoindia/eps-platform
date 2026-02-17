
# Add API Input/Output Preview Section to All Verification API Pages

## Overview
Add a visually engaging "Input and Output Preview" section to each Verification API product page. This section will show customers exactly what data they send and what they receive back, using a clean two-column card layout with example values.

## What Will Be Built

### New Component: `ApiInputOutputPreview`
A reusable component (`src/components/ApiInputOutputPreview.tsx`) that renders:
- A dynamic title: "{API Name} API Input & Output Preview"
- A subtitle: "Send simple inputs. Get rich, verified data in seconds."
- Two side-by-side cards (stacked on mobile):
  - **Left Card (API Input):** Form-style preview with labeled fields and example values, with a "REQUEST" badge
  - **Right Card (API Output):** Structured key-value response panel with a "RESPONSE" badge and verification status indicators
- A CTA row below with "View Sample Response" and "Try in Demo" buttons
- For inactive APIs: a "Coming Soon" badge instead of the full preview

### Integration into `ProductPageLayout`
- Add a new optional prop `inputOutputPreview` to `ProductPageLayout`
- The section will render between the "Key Benefits" and "Key Features" sections
- Each verification page will pass its specific input/output data

### API-wise Content

| API Page | Input Fields | Output Fields | Status |
|----------|-------------|---------------|--------|
| PAN Verification | PAN Number, Full Name, DOB | PAN Match, Name Match, DOB Match, Gender, Aadhaar Seeding Status | Active |
| Aadhaar Verification | -- | -- | Coming Soon |
| Bank Verification | Account Number, Bank Name, IFSC | Account Holder Name | Active |
| GST Verification | GST Number, Company Name | Legal Name, Address, Reg Date, Status, Constitution, Nature, Jurisdictions, Cancellation Date, Last Update, Taxpayer Type, Status Code | Active |
| UPI Verification | -- | -- | Coming Soon |
| DL Verification | Driving License Number | Name, DOB, Address, Issue Date, Validity, Father/Husband Name, Badge Details, COV Details | Active |
| RC Verification | Vehicle Number | Owner Name, Category, Address, Status, Color, Expiry, Body Type, Manufacturer, Model, Chassis No, Engine No, Year, Financer, Blacklist Status, Tax Validity, Reg Date, Insurance Co, Insurance Valid Upto, Authority, Norms, Wheelbase, Pincode | Active |
| Vehicle Verification | Vehicle Number | Same as RC (simplified) | Active |
| DigiLocker | -- | -- | Coming Soon |
| Employee Verification | Phone Number | Employee Name, DOB, PAN, UAN, Member ID, Company, Joining Date, Exit Date, Exit Reason, PF Filing | Active |
| Reverse Geocoding | Latitude, Longitude | Address, City, State, PIN Code | Active |

## Files Changed

1. **New:** `src/components/ApiInputOutputPreview.tsx` -- Reusable section component with input/output card layout, Coming Soon variant, and CTA row
2. **Edit:** `src/components/ProductPageLayout.tsx` -- Add new `inputOutputPreview` prop and render the section
3. **Edit:** All 11 verification page files to pass their specific input/output data:
   - `PanVerificationPage.tsx`
   - `AadhaarVerificationPage.tsx`
   - `BankVerificationPage.tsx`
   - `GstVerificationPage.tsx`
   - `UpiVerificationPage.tsx`
   - `DlVerificationPage.tsx`
   - `RcVerificationPage.tsx`
   - `VehicleVerificationPage.tsx`
   - `DigilockerApiPage.tsx`
   - `EmployeeVerificationPage.tsx`
   - `ReverseGeocodingPage.tsx`

## Technical Details

### `ApiInputOutputPreview` Props Interface
```text
interface ApiField {
  label: string;       // Human-readable label
  value: string;       // Example value
  icon?: string;       // Lucide icon name
}

interface ApiInputOutputPreviewProps {
  apiName: string;
  inputs: ApiField[];
  outputs: ApiField[];
  comingSoon?: boolean;
  docsUrl: string;
}
```

### Visual Design
- Cards use `bg-card` with subtle borders, rounded corners
- Input card has a navy "REQUEST" header badge; Output card has a gold/green "RESPONSE" header badge
- Field values shown in monospace font for a technical feel
- Output fields show small check icons for verified data
- Coming Soon variant shows a centered badge with muted styling
- Icons from lucide-react (CreditCard, User, Calendar, MapPin, Building, etc.) used contextually per field
- Responsive: two columns on desktop, stacked on mobile

### Placement in Layout
The section will appear after "Key Benefits" and before "Key Features" in the page flow, giving users an immediate understanding of the API before diving into detailed features.
