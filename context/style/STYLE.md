# STYLE.md

Lightweight visual style guide for PrepAhead.

Use this file as a soft design direction for UI work. It should help keep the app visually consistent without over-constraining implementation details.

---

## Visual Direction

PrepAhead should feel like a clean, modern SaaS product:

- calm and focused
- spacious and easy to scan
- professional, but not corporate-heavy
- friendly, but not playful
- modern AI-product vibe

Reference feel: Linear, Notion, Stripe-style SaaS dashboards.

Use this as inspiration, not as a strict template.

---

## Color Palette

PrepAhead uses a neutral base with a purple/indigo accent.

### Light Mode

```css
:root {
  --color-primary: #6366F1;
  --color-primary-hover: #4F46E5;
  --color-primary-soft: #EEF2FF;

  --color-background: #FAFAFA;
  --color-surface: #FFFFFF;
  --color-surface-muted: #F9FAFB;

  --color-border: #E5E7EB;

  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-text-tertiary: #9CA3AF;

  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;
}
```

### Dark Mode

```css
.dark {
  --color-primary: #818CF8;
  --color-primary-hover: #6366F1;
  --color-primary-soft: rgba(129, 140, 248, 0.14);

  --color-background: #0F1115;
  --color-surface: #171A22;
  --color-surface-muted: #1F2430;

  --color-border: #2A2F3A;

  --color-text-primary: #F3F4F6;
  --color-text-secondary: #9CA3AF;
  --color-text-tertiary: #6B7280;

  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #60A5FA;
}
```

### Color Usage

Use purple/indigo mainly for:

- primary buttons
- active or selected states
- progress indicators
- focus states
- small highlights

Most of the UI should stay neutral. Avoid making the whole interface purple.

---

## Typography

Preferred fonts:

- Inter
- Geist Sans
- system sans-serif fallback

General guidance:

- headings: clean, confident, slightly bold
- body text: readable and calm
- secondary text: muted gray
- avoid too many font sizes in one component

Suggested Tailwind scale:

```txt
Hero: text-5xl / text-6xl, font-bold, tracking-tight
Page title: text-2xl / text-3xl, font-semibold
Section title: text-lg / text-xl, font-semibold
Body: text-sm / text-base
Helper text: text-xs / text-sm
```

---

## Layout & Spacing

The UI should feel spacious.

Useful defaults:

```txt
Page padding: px-6 py-8
Card padding: p-6
Large card padding: p-8
Section gap: gap-6 or gap-8
Small gap: gap-2 or gap-3
```

Avoid cramped layouts, tiny cards, and dense admin-dashboard styling.

---

## Components

### Cards

Default style:

```txt
rounded-2xl
border border-gray-200
bg-white
p-6
shadow-sm
dark:bg-[#171A22]
dark:border-[#2A2F3A]
dark:shadow-none
```

Cards should be focused and easy to scan.

### Buttons

Primary buttons:

```txt
rounded-xl
bg-indigo-500 hover:bg-indigo-600
px-5 py-2.5
text-sm font-medium text-white
shadow-sm
transition
dark:bg-indigo-400 dark:hover:bg-indigo-500
```

Secondary buttons:

```txt
rounded-xl
border border-gray-200
bg-white hover:bg-gray-50
px-5 py-2.5
text-sm font-medium
dark:bg-[#171A22]
dark:border-[#2A2F3A]
dark:hover:bg-[#1F2430]
```

### Inputs

Inputs and textareas should be comfortable, calm, and readable.

```txt
rounded-xl
border border-gray-200
bg-white
px-4 py-3
text-sm
focus:border-indigo-500
focus:ring-2 focus:ring-indigo-500/20
dark:bg-[#171A22]
dark:border-[#2A2F3A]
dark:focus:border-indigo-400
```

For large textareas, prefer:

```txt
min-h-[180px] or min-h-[220px]
rounded-2xl
p-5
```

---

## Visual Details

Recommended:

- rounded corners
- subtle borders
- soft shadows in light mode
- mostly border-based separation in dark mode
- simple line icons, e.g. Lucide-style
- subtle transitions: `transition duration-200 ease-out`

Use gradients only sparingly, mostly for hero accents or small decorative polish.

Suggested gradient:

```txt
from-[#6366F1] to-[#8B5CF6]
```

---

## Dark Mode Notes

Dark mode should feel premium and calm.

Use:

- background: `#0F1115`
- cards: `#171A22`
- muted cards: `#1F2430`
- borders: `#2A2F3A`
- primary accent: `#818CF8`

Avoid pure black backgrounds and very high-contrast borders.

---

## For AI Coding Agents

When generating or refactoring UI, use this instruction:

```txt
Follow STYLE.md as a visual direction. Keep the UI clean, modern, spacious, and SaaS-like. Use the PrepAhead purple/indigo accent mainly for primary actions, active states, progress, and highlights. Keep most surfaces neutral. Preserve existing product logic unless explicitly asked to change it.
```

When refactoring existing UI:

```txt
Improve the visual style according to STYLE.md: spacing, typography, colors, cards, buttons, inputs, and light/dark mode consistency. Do not over-engineer the design and do not add unnecessary features.
```

---

## Soft Anti-patterns

Try to avoid:

- too many colors
- cramped spacing
- heavy shadows
- random gradients
- inconsistent border radius
- low-contrast text
- dense admin-dashboard layouts
- excessive icons or decorative elements

The goal is not to make every screen identical, but to keep the product visually coherent.
