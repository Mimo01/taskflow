# Taskflow Logo Design Documentation

## Design Concept

The Taskflow logo consists of two overlapping S-curve ribbons with subtle inner highlights, representing the concept of "flow" -- the core idea behind Taskflow. The blue ribbon sits behind and the orange ribbon sits in front, creating a layered depth effect where they overlap.

The design went through 15 iterations to arrive at the final form: smooth, sleek, modern, and minimal. Two thick flowing ribbons with a single S-curve each, overlapping with consistent 50px coverage, and subtle 18%-opacity white highlights along the top edge of each ribbon.

## Brand Colors

| Color  | Hex       | Role                     |
|--------|-----------|--------------------------|
| Blue   | `#0ea5e9` | Primary ribbon (behind)  |
| Orange | `#f97316` | Primary ribbon (in front)|
| White  | `#ffffff` | Background, highlights   |

Highlight strips use `#ffffff` at `opacity="0.18"`.

## Canvas and Clip Path

- **Canvas:** 1024x1024 viewBox
- **macOS squircle clip path:** `<rect x="100" y="100" width="824" height="824" rx="185" ry="185" />`
- **Safe zone:** Content should stay within the 824x824 clipped area with ~70px inner padding
- **Effective content area:** approximately 240x240 to 784x784

## Scale and Centering

The final design uses a 90% scale factor centered on (512, 512), then shifted +33px down for perfect vertical centering.

- **X range:** 195 to 829 (634px span, centered at x=512)
- **Y range:** 283 to 741 (458px span, centered at y=512)
- **Transform applied:** `new_coord = 512 + (original - 512) * 0.9`, then y += 33

## Complete SVG Path Data

### Blue Ribbon (behind)

```
fill="#0ea5e9"
```

**Top edge** (two cubic beziers joined at inflection point x=512):

```
M 195,390 C 339,283 501,283 512,372 C 523,461 685,461 829,354
```

- Start: (195, 390)
- Left half: cubic bezier to (512, 372) with control points (339, 283) and (501, 283)
- Right half: cubic bezier to (829, 354) with control points (523, 461) and (685, 461)

**Bottom edge** (line to right edge, then two cubic beziers back):

```
L 829,516 C 685,624 523,624 512,534 C 501,445 339,445 195,552 Z
```

- Right edge: vertical line from (829, 354) to (829, 516) -- bar thickness = 162px
- Right half return: cubic bezier to (512, 534) with control points (685, 624) and (523, 624)
- Left half return: cubic bezier to (195, 552) with control points (501, 445) and (339, 445)

### Blue Ribbon Highlight

```
fill="#ffffff" opacity="0.18"
```

```
M 204,413 C 343,310 501,310 512,395 C 523,480 681,480 821,377
L 821,417 C 681,516 523,516 512,432 C 501,346 343,346 204,450 Z
```

- Offset ~9-13px inward from main ribbon edges
- Thickness: ~40px
- Same S-curve shape, slightly smaller

### Orange Ribbon (in front)

```
fill="#f97316"
```

```
M 195,507 C 339,399 501,399 512,489 C 523,579 685,579 829,471
L 829,633 C 685,741 523,741 512,651 C 501,561 339,561 195,669 Z
```

- Offset +117px down from blue ribbon top edge
- Same S-curve shape and thickness as blue ribbon
- Rendered after blue so it appears on top

### Orange Ribbon Highlight

```
fill="#ffffff" opacity="0.18"
```

```
M 204,530 C 343,422 501,422 512,512 C 523,597 681,597 821,494
L 821,534 C 681,633 523,633 512,552 C 501,463 343,463 204,566 Z
```

## Mathematical Description

### S-Curve Construction

Each ribbon edge is composed of two cubic bezier segments joined at the inflection point (x=512). The S-curve creates a smooth wave that flows from upper-left to lower-right.

**Left half pattern:** `M startX,startY C cp1x,cp1y cp2x,cp2y 512,midY`
- Control points cp1 and cp2 have the SAME y-value (pulled strongly up or down)
- This creates a smooth approach to the inflection point

**Right half pattern:** `C cp3x,cp3y cp4x,cp4y endX,endY`
- Control points cp3 and cp4 have the SAME y-value (opposite direction from left half)
- This creates the complementary curve after the inflection

### Key Relationships

| Parameter | Value | How to modify |
|-----------|-------|---------------|
| Bar thickness | 162px | Change vertical offset between top and bottom edges |
| Overlap | ~50px | Adjust vertical offset between blue bottom and orange top |
| S-curve amplitude | ~107px | Change control point y-values (bigger = more dramatic wave) |
| Highlight thickness | ~40px | Change offset between highlight top and bottom edges |
| Highlight opacity | 0.18 | Adjust `opacity` attribute |
| Scale | 90% of 1024 | Apply `512 + (coord - 512) * scale` to all coordinates |
| Vertical center | y=512 | Shift all y-values by `target_center - current_center` |

### Modifying the Design

**To change amplitude** (how dramatic the wave is):
- Increase/decrease the control point y-displacement from the start/end y-values
- Current: control points are ~107px above/below the edge start points
- Example: for a gentler wave, reduce to ~80px; for more dramatic, increase to ~140px

**To change bar thickness:**
- Current bottom edge = top edge y + 162px (at endpoints)
- Change the L command y-offset and adjust bottom-edge control points proportionally

**To change gap/overlap between bars:**
- Current orange top is ~117px below blue top
- Increase for more gap, decrease for more overlap
- At 162px offset (= bar thickness), bars would just touch with no overlap

**To add a third bar:**
- Copy the blue ribbon paths
- Offset all y-coordinates by -110px (above blue) or +234px (below orange)
- Use a lighter color like `#38bdf8` at `opacity="0.55"`

**To change shading style:**
- Gradient: replace `fill="#0ea5e9"` with `fill="url(#grad)"` and define a linearGradient
- Drop shadow: add `filter="url(#shadow)"` with a feDropShadow (stdDeviation=5, opacity=0.12)
- Remove highlights: delete the highlight path elements

## File Locations

| File | Purpose | How Updated |
|------|---------|-------------|
| `taskflow/app-icon-source.svg` | 1024x1024 source SVG (canonical) | Edit directly |
| `taskflow/public/app-icon.svg` | Public SVG for favicon | Copy from source |
| `taskflow/src/components/app/AppIcon.tsx` | Inline JSX for sidebar (32x32) | Manual JSX conversion |
| `taskflow/src-tauri/icons/icon.icns` | macOS app icon | Generated from source |
| `taskflow/src-tauri/icons/icon.ico` | Windows app icon | Generated from source |
| `taskflow/src-tauri/icons/icon.png` | Generic PNG (512x512) | Generated from source |
| `taskflow/src-tauri/icons/32x32.png` | Small PNG | Generated from source |
| `taskflow/src-tauri/icons/64x64.png` | Medium PNG | Generated from source |
| `taskflow/src-tauri/icons/128x128.png` | Large PNG | Generated from source |
| `taskflow/src-tauri/icons/128x128@2x.png` | Retina PNG (256x256) | Generated from source |
| `taskflow/index.html` | Favicon reference | Points to `/app-icon.svg` |

## Regenerating Platform Icons

After modifying `app-icon-source.svg`, regenerate all platform icons:

```bash
cd taskflow

# Option 1: Tauri CLI (generates everything including .icns, .ico)
npx @tauri-apps/cli icon app-icon-source.svg -o src-tauri/icons

# Option 2: Manual with rsvg-convert + iconutil
rsvg-convert -w 32 -h 32 app-icon-source.svg -o src-tauri/icons/32x32.png
rsvg-convert -w 64 -h 64 app-icon-source.svg -o src-tauri/icons/64x64.png
rsvg-convert -w 128 -h 128 app-icon-source.svg -o src-tauri/icons/128x128.png
rsvg-convert -w 256 -h 256 app-icon-source.svg -o src-tauri/icons/128x128@2x.png
rsvg-convert -w 512 -h 512 app-icon-source.svg -o src-tauri/icons/icon.png

# For .icns (macOS):
mkdir -p /tmp/icon.iconset
for size in 16 32 128 256 512; do
  rsvg-convert -w $size -h $size app-icon-source.svg -o /tmp/icon.iconset/icon_${size}x${size}.png
  rsvg-convert -w $((size*2)) -h $((size*2)) app-icon-source.svg -o /tmp/icon.iconset/icon_${size}x${size}@2x.png
done
iconutil -c icns /tmp/icon.iconset -o src-tauri/icons/icon.icns
rm -rf /tmp/icon.iconset
```

Also copy updated SVG to public:
```bash
cp app-icon-source.svg public/app-icon.svg
```

And update `src/components/app/AppIcon.tsx` with the new JSX (convert kebab-case attributes to camelCase, prefix IDs with `app-`).

## JSX Conversion Rules

When converting SVG to JSX for AppIcon.tsx:

| SVG attribute | JSX attribute |
|---------------|---------------|
| `clip-path` | `clipPath` |
| `stroke-width` | `strokeWidth` |
| `stroke-linecap` | `strokeLinecap` |
| `stroke-linejoin` | `strokeLinejoin` |
| `flood-color` | `floodColor` |
| `flood-opacity` | `floodOpacity` |
| `stop-color` | `stopColor` |
| `class` | `className` |

All `id` attributes must be prefixed with `app-` (e.g., `id="sq"` becomes `id="app-sq"`).

## Usage Guidelines

- **Sidebar icon (32x32):** Use the AppIcon.tsx component with `className="w-8 h-8"`
- **Favicon:** Served from `/app-icon.svg` via index.html link tag
- **macOS dock:** Uses `icon.icns` (automatically via Tauri)
- **Windows taskbar:** Uses `icon.ico` (automatically via Tauri)
- **Marketing/large display:** Use `app-icon-source.svg` directly or render at desired resolution with rsvg-convert
- **Minimum legible size:** 24x24px (tested down to 32x32)
- **Always use on white or very light backgrounds** -- the white squircle background ensures consistency
