

# High-Converting API Product Page Redesign

## Overview
Redesign the `ProductPageLayout` and supporting components to create high-converting, interactive, SEO-optimized API product pages. Starting with PAN Verification as the template, all API pages will benefit from the shared layout improvements.

## What Will Change

### 1. SEO and Structured Data Enhancements
- Update meta description for PAN page to the optimized copy: "Instantly verify PAN details in real-time with 99.9% accuracy..."
- Add JSON-LD structured data (SoftwareApplication + FAQPage schema) injected via `react-helmet-async` in each product page
- Hero title already uses `<h1>`; section titles already use `<h2>` -- no changes needed there

### 2. Live Code Preview (API Playground)
Replace the current static input/output cards in `ApiInputOutputPreview.tsx` with an interactive code playground:
- **Left pane:** Mock terminal with syntax-highlighted JSON request (dark theme, dot indicators, file name badge)
- **Right pane:** Syntax-highlighted JSON response with color-coded values (strings in green, booleans in blue, status highlighted)
- Keeps the existing friendly key-value view as a toggle ("Visual" / "JSON" tabs) so non-technical buyers still see the clean preview
- Responsive: stacks vertically on mobile

### 3. Interactive Integration Stepper
Convert the current grid of integration steps into a horizontal interactive stepper:
- Numbered circles connected by lines (horizontal on desktop, vertical on mobile)
- Each step highlights on hover, revealing a technical tip tooltip (e.g., "API keys generated instantly")
- Active/hover state shows expanded description with a subtle slide-down animation
- Uses existing Tailwind animations (`fade-up`, `slide-right`)

### 4. Trust Shield Badge
- Add a floating "99.9% Uptime" trust badge in the hero section (positioned near the form card)
- Small shield icon with the stat, using `bg-eko-gold/10` styling
- Visible on desktop, hidden on mobile to avoid clutter

### 5. Sticky CTA on Scroll
- Add a sticky top bar that appears when user scrolls past the hero section
- Contains the page title (compact) and a "Get API Access" button (gold variant)
- Smooth slide-down animation on appear, hidden when scrolling back to top
- Uses `position: sticky` or scroll-based state in `ProductPageLayout`

### 6. Feature Grid Upgrade
- Keep the existing 2-column feature grid but ensure the top 3 features ("High Accuracy", "Automation Friendly", "Scalable Verification") render in a highlighted 3-column row before the rest
- Add subtle fade-up animation on scroll using Intersection Observer (CSS-only approach with `animate-fade-up` and staggered delays)

### 7. Industry Cards with Hover Animation
- Restyle the "Who Should Use" section items as cards with icon, title, and hover-lift effect
- Use `hover:-translate-y-1 hover:shadow-lg transition-all duration-300` for the lift animation
- Add relevant industry icons (Building2 for Fintech, Store for Marketplaces, Landmark for NBFCs, etc.)

### 8. CTA Button Color Update
- Add a new `action` button variant with high-contrast orange/amber color for primary CTAs
- Apply to the hero form submit button and the sticky nav CTA

## Files Changed

### Modified Files
1. **`src/components/ApiInputOutputPreview.tsx`** -- Add JSON code view with Visual/JSON toggle tabs, syntax highlighting via custom styled `<pre>` blocks
2. **`src/components/ProductPageLayout.tsx`** -- Add sticky CTA bar with scroll detection, interactive stepper replacing step grid, trust shield badge in hero, feature grid with fade animations, industry cards with hover-lift, integration step tooltips
3. **`src/components/ui/button.tsx`** -- Add `action` variant (high-contrast amber/orange)
4. **`src/pages/products/PanVerificationPage.tsx`** -- Update meta description, add JSON-LD structured data script, add integration step tips data
5. **All other product pages** (16 files) -- Add JSON-LD structured data for FAQPage schema

## Technical Details

### Sticky CTA Implementation
```text
// In ProductPageLayout, use useState + useEffect with IntersectionObserver
// Observe the hero section; when it leaves viewport, show sticky bar
const [showSticky, setShowSticky] = useState(false);
// Renders a fixed top bar with z-50, bg-white, shadow, transition
```

### JSON-LD Schema (in each product page's Helmet)
```text
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "PAN Verification API",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web API",
  "description": "...",
  "offers": { "@type": "Offer", "availability": "https://schema.org/InStock" }
}
</script>
```

### Interactive Stepper Layout
```text
Horizontal on desktop (flex-row), vertical on mobile (flex-col)
Each step: circle (number) -> connector line -> circle
On hover: step expands to show description + tip
Active step has gold ring, others have border-muted
```

### API Playground JSON View
```text
// Left: Dark card with syntax-colored JSON
{
  "pan_number": "ABCDE1234F",
  "full_name": "Rajesh Kumar",
  "dob": "29/08/1994"
}

// Right: Dark card with response
{
  "status": "VALID",
  "pan_match": true,
  "name_match": true,
  ...
}
```

### Button Action Variant
```text
action: "bg-amber-500 text-white font-semibold hover:bg-amber-600 
         shadow-lg hover:shadow-xl hover:-translate-y-0.5"
```

### No New Dependencies
All features use existing Tailwind CSS animations, Intersection Observer API (native browser), and React state. No Framer Motion or other libraries needed -- the existing `animate-fade-up` and `animate-fade-in` keyframes in `tailwind.config.ts` provide sufficient animation.

