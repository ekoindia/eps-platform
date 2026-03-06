

## Plan: Header Logo & Styling Overhaul

### Current State
- Header has `h-16` logo, white background on homepage, `#00394b` on legal pages
- EkoLogo `isLight` prop exists but is ignored — the same SVG is always rendered
- The SVG logo has gold icon + white "PLATFORM SERVICES" text (cls-3)
- On homepage, the hero section below has a dark gradient background, but the header is solid white

### Changes

#### 1. EkoLogo — implement `isLight` prop
- When `isLight=true`, apply CSS filter `brightness(0) invert(1)` to make the entire logo white
- This avoids needing a separate white SVG asset

#### 2. Header — transparent background on homepage (not scrolled)
- On the homepage (`/`), when not scrolled: set header background to `transparent` so the dark hero gradient shows through
- Logo: white (`isLight=true`), size stays `h-16`
- Nav text: white (`text-white`)
- Mobile menu icon: white

#### 3. Header — scrolled state (all pages)
- Background: `bg-white/95 backdrop-blur-md shadow-sm`
- Logo: original colors (`isLight=false`), size stays `h-16`
- Nav text: `text-eko-slate` (grey, current default)

#### 4. Header — dark header pages (legal, about, blog, press) when not scrolled
- Keep existing `bg-[#00394b]` behavior
- Logo: white, nav text: white (already working)

### Logic Summary
```text
Homepage, not scrolled  → bg-transparent, white logo, white text
Dark pages, not scrolled → bg-[#00394b], white logo, white text
All other pages, not scrolled → bg-white, original logo, grey text
Any page, scrolled → bg-white/95, original logo, grey text
```

### Files Modified
- `src/components/EkoLogo.tsx` — add CSS filter for `isLight`
- `src/components/Header.tsx` — add homepage detection, update background/text logic

