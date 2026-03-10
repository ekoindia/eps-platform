

## Plan: Hero Image + Relocated Lead Form

### What changes

**1. Copy the SVG asset into the project**
- Copy `user-uploads://money-transfer-api-opt.svg` to `src/assets/money-transfer-api.svg`

**2. Update `ProductPageLayout.tsx`**

- **Hero section**: Add an optional `heroImage` prop (string). When provided, render the image on the right side instead of the lead form. Apply a 3D perspective transform (`perspective`, `rotateY`, `rotateX`) with a subtle floating animation. Use `drop-shadow` and remove any background from the SVG so it blends with the dark navy hero.

- **New "Get API Access" section**: Move the existing lead form (Zoho iframe) into a new section placed **after the FAQ section and before the Footer**. Style it as a full-width CTA section with the navy gradient background, keeping the same form card design.

- Update the sticky CTA bar's `#lead-form` anchor to point to the new bottom section.

**3. Update `DmtApiPage.tsx`**
- Import the SVG and pass `heroImage` prop to `ProductPageLayout`.

### Layout change summary

```text
BEFORE:                          AFTER:
┌──────────┬──────────┐          ┌──────────┬──────────┐
│ Hero Text│ Lead Form│          │ Hero Text│ 3D Image │
└──────────┴──────────┘          └──────────┴──────────┘
│  Features, Benefits  │          │  Features, Benefits  │
│  Integration, FAQ    │          │  Integration, FAQ    │
└──────────────────────┘          ├──────────────────────┤
│       Footer         │          │  Lead Form (CTA)     │
└──────────────────────┘          ├──────────────────────┤
                                  │       Footer         │
                                  └──────────────────────┘
```

### 3D image effect
- CSS `transform: perspective(1000px) rotateY(-5deg) rotateX(5deg)` with hover removing the rotation
- Subtle `drop-shadow(0 25px 50px rgba(0,0,0,0.5))` for depth
- `animate-float` for gentle movement
- The SVG has a transparent/light background that will need a `filter: drop-shadow` to pop against the dark navy

