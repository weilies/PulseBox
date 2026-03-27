# PulseBox Cyberpunk Theme Documentation

## Overview
PulseBox features a **futuristic cyberpunk dark theme** with neon accents, glassmorphism effects, and smooth animations. The theme is built with Tailwind CSS, CSS variables, and custom animations.

---

## Color Palette

### Neon Accents
- **Cyan** - `#00f0ff` - Primary action color
- **Purple** - `#c700ff` - Secondary/Highlight color
- **Blue** - `#0080ff` - Accent color
- **Pink** - `#ff006e` - Alert/Warning color
- **Lime** - `#39ff14` - Success color

### Dark Backgrounds
- **Primary** - `#0a0e27` - Main background
- **Secondary** - `#1a1f3a` - Card/Container background
- **Tertiary** - `#252d48` - Elevated surface

### Text
- **Primary** - `#e0e6ff` - Main text color
- **Secondary** - `#8b92c4` - Muted/secondary text

---

## CSS Classes & Utilities

### Text Effects

#### `.neon-cyan`
Cyan glow text effect
```tsx
<p className="neon-cyan">Glowing Text</p>
```

#### `.neon-purple`
Purple glow text effect
```tsx
<p className="neon-purple">Glowing Text</p>
```

#### `.neon-blue`
Blue glow text effect
```tsx
<p className="neon-blue">Glowing Text</p>
```

#### `.text-glow`
Animated pulsing glow effect (use with neon color classes)
```tsx
<p className="neon-cyan text-glow">Pulsing Text</p>
```

### Container Effects

#### `.glow-card`
Glassmorphic card with cyan border glow and hover effects
```tsx
<div className="glow-card p-6">
  <h3>Card Title</h3>
  <p>Content with glow effect</p>
</div>
```

**Features:**
- Smooth backdrop blur (glassmorphism)
- Cyan border with transparency
- Hover state with increased glow
- Smooth transitions

#### `.glow-border`
Just the border glow without background
```tsx
<div className="glow-border p-4">Border only effect</div>
```

#### `.glass-effect`
Subtle glassmorphism without glow
```tsx
<div className="glass-effect p-4">
  Subtle glass background
</div>
```

#### `.glassmorphism`
Strong glassmorphism with 20px blur
```tsx
<div className="glassmorphism p-6">
  Intense blur effect
</div>
```

#### `.pulse-glow`
Animated pulsing glow on the container
```tsx
<div className="glow-card pulse-glow">
  Pulsing container
</div>
```

### Button Styles

#### `.btn-neon`
Neon button with gradient background and glow effects
```tsx
<button className="btn-neon">
  Click Me
</button>
```

**Features:**
- Gradient background (cyan to purple)
- Cyan border
- Hover state with increased glow
- Smooth lift animation on hover
- Active state with press-down effect

**Variations:**
```tsx
// Purple variant
<button className="btn-neon" style={{ borderColor: '#c700ff', boxShadow: '0 0 15px rgba(199, 0, 255, 0.3)' }}>
  Purple Button
</button>

// Blue variant
<button className="btn-neon" style={{ borderColor: '#0080ff', boxShadow: '0 0 15px rgba(0, 128, 255, 0.3)' }}>
  Blue Button
</button>
```

---

## Animations

### Built-in Animations

#### `neon-glow`
Pulsing text glow (2s cycle)
```css
animation: neon-glow 2s ease-in-out infinite;
```

#### `pulse-glow`
Pulsing box shadow (2s cycle)
```css
animation: pulse-glow 2s ease-in-out infinite;
```

#### `grid-pulse`
Background grid pulse effect (8s cycle)
```css
animation: grid-pulse 8s ease-in-out infinite;
```

#### `float`
Subtle vertical floating motion (varies)
```css
animation: float 3s ease-in-out infinite;
```

#### `scan-lines`
Vertical scan line animation
```css
animation: scan-lines 8s linear infinite;
```

---

## Typography

### Font Families

#### Display/Main Titles (H1)
- Font: `Audiowide` (Sans-serif)
- Used for: Main page titles, app name
- Characteristics: Extremely futuristic, geometric, space-age aesthetic

#### Headings (H2-H6)
- Font: `Chakra Petch` (Sans-serif)
- Used for: Section headings, subheadings
- Characteristics: Bold, geometric, sci-fi, technical feel

#### Body & UI Text
- Font: `Space Mono` (Monospace)
- Used for: Paragraphs, buttons, labels, UI text
- Characteristics: Monospace, tech-forward, clean, readable

#### Code/Technical Content
- Font: `IBM Plex Mono` (Monospace)
- Used for: `<code>`, `<pre>`, code blocks
- Characteristics: Professional monospace, clear, precise

---

## Common Patterns

### Card with Glow Border
```tsx
<div className="glow-card p-6 rounded-lg">
  <h3 className="text-lg font-bold mb-2">Title</h3>
  <p className="text-muted-foreground">Description</p>
</div>
```

### Neon Button Group
```tsx
<div className="flex gap-4">
  <button className="btn-neon">Primary</button>
  <button className="btn-neon border-purple-400" style={{ borderColor: '#c700ff' }}>Secondary</button>
</div>
```

### Neon Title with Glow (Audiowide)
```tsx
<h1 className="text-5xl font-bold" style={{ fontFamily: "'Audiowide', sans-serif", letterSpacing: '2px' }}>
  <span className="neon-cyan">Cyber</span>
  <span className="neon-purple">Pulse</span>
</h1>
```

### Section Heading (Chakra Petch)
```tsx
<h2 className="text-3xl font-bold" style={{ fontFamily: "'Chakra Petch', sans-serif" }}>
  Advanced Analytics
</h2>
```

### Glass Panel
```tsx
<div className="glassmorphism p-8 rounded-lg">
  <h2>Premium Content</h2>
  <p>With strong blur and transparency</p>
</div>
```

### Status Indicator
```tsx
<div className="flex items-center gap-2">
  <div className="w-3 h-3 rounded-full bg-lime-400 animate-pulse" />
  <span>Active</span>
</div>
```

---

## CSS Variables (Advanced)

Access theme colors directly with CSS variables:

```css
var(--neon-cyan)      /* #00f0ff */
var(--neon-purple)    /* #c700ff */
var(--neon-blue)      /* #0080ff */
var(--neon-pink)      /* #ff006e */
var(--neon-lime)      /* #39ff14 */

var(--dark-bg-primary)    /* #0a0e27 */
var(--dark-bg-secondary)  /* #1a1f3a */
var(--dark-bg-tertiary)   /* #252d48 */

var(--glow-cyan)      /* Cyan glow shadow */
var(--glow-purple)    /* Purple glow shadow */
var(--glow-blue)      /* Blue glow shadow */
```

Example custom CSS:
```css
.custom-element {
  background: var(--dark-bg-secondary);
  border: 2px solid var(--neon-cyan);
  box-shadow: var(--glow-cyan);
}
```

---

## Dark Mode

The theme is **always in dark mode**. All styling uses the `.dark` class variant. No light mode alternatives exist.

---

## Performance Notes

1. **Animations** - CSS-only animations use `transform` and `opacity` for optimal performance
2. **Backgdrop Filter** - Uses GPU acceleration; minimal impact
3. **Text Shadow** - Used sparingly for glow effects
4. **Grid Background** - Subtle opacity prevents heavy rendering

---

## Extending the Theme

### Add a New Neon Color
Edit `src/app/globals.css` under `:root`:
```css
--neon-magenta: #ff0080;
--glow-magenta: 0 0 20px rgba(255, 0, 128, 0.5);
```

Then create utility classes:
```css
.neon-magenta {
  @apply text-magenta-400;
  text-shadow: 0 0 10px rgba(255, 0, 128, 0.8);
}
```

### Add a New Animation
Edit `src/app/globals.css` under `@keyframes`:
```css
@keyframes my-animation {
  0% { /* start */ }
  100% { /* end */ }
}
```

Then apply it:
```tsx
<div style={{ animation: 'my-animation 2s ease-in-out infinite' }}>
  Animated
</div>
```

---

## Standard UI Components (Dashboard)

> These patterns apply to **all dashboard pages**. Follow exactly — do not deviate.

### 3-Dot Row Action Menu (`...`)

```tsx
<DropdownMenu>
  <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition-colors">
    <MoreHorizontal className="h-4 w-4" />
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="bg-white border-gray-300 text-gray-900">
    {/* Standard item */}
    <DropdownMenuItem className="cursor-pointer hover:bg-gray-100 hover:text-blue-600">
      <Pencil className="mr-2 h-4 w-4" />
      Edit
    </DropdownMenuItem>
    <DropdownMenuSeparator className="bg-blue-50" />
    {/* Destructive item */}
    <DropdownMenuItem className="cursor-pointer text-red-400 hover:bg-red-50 hover:text-red-300">
      <Trash2 className="mr-2 h-4 w-4" />
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Rules:**
- Trigger: always `h-8 w-8`, `text-gray-500 hover:text-blue-600 hover:bg-gray-100`
- Content: always `bg-white border-gray-300 text-gray-900`
- Icon spacing: always `mr-2 h-4 w-4` (never `gap-2` with smaller icons)
- Separator: always `bg-blue-50`
- Section label: `text-xs font-normal text-gray-400 uppercase tracking-wide`
- Destructive: `text-red-400 hover:bg-red-50 hover:text-red-300`
- If trigger needs disabled state, add `disabled={loading}` + `disabled:opacity-50 disabled:pointer-events-none`

### Delete Confirmation Dialog

```tsx
<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
  <DialogContent className="bg-white border-gray-200 text-gray-900">
    <DialogHeader>
      <DialogTitle className="text-gray-900">Delete X</DialogTitle>
      <DialogDescription className="text-gray-500">
        This cannot be undone.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter className="mt-4">
      <DialogClose render={<Button type="button" variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50" />}>
        Cancel
      </DialogClose>
      <Button onClick={handleDelete} disabled={loading} variant="destructive">
        {loading ? "Deleting..." : "Delete"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Page Header with Action Button

```tsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-3">
    <Icon className="h-6 w-6 text-blue-600" />
    <div>
      <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
        Title
      </h1>
      <p className="text-sm text-gray-500 mt-0.5">Subtitle</p>
    </div>
  </div>
  <ActionButton />
</div>
```

### Badges

| Purpose | Classes |
|---------|---------|
| System | `border-yellow-500/50 text-yellow-400 text-xs` |
| Custom | `border-blue-500/50 text-blue-600 text-xs` |
| Active | `border-green-500/40 text-green-400 text-xs` |
| Inactive | `border-gray-300 text-gray-500 text-xs` |
| Role | `border-blue-500/40 text-blue-600 text-xs` |

---

## Showcase Component

View all theme elements in action:
```tsx
import { ThemeShowcase } from '@/components/theme-showcase';

export default function ShowcasePage() {
  return <ThemeShowcase />;
}
```

---

## Browser Support

- **Modern Chrome, Firefox, Safari, Edge** - Full support
- **Backdrop Filter** - Requires modern browsers (all except IE11)
- **CSS Variables** - Requires modern browsers
- **Gradients** - Full support across all modern browsers
