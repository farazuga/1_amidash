# Digital Signage Design System

> Design guidelines for AmiDash digital signage displays
> **Target:** 4K displays (3840x2160) in office/lobby environments
> **Viewing distance:** 10-20 feet | **Viewing time:** 10-20 seconds per slide

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Typography](#typography)
3. [Color System](#color-system)
4. [Layout & Grid](#layout--grid)
5. [Data Visualization](#data-visualization)
6. [Animation & Motion](#animation--motion)
7. [Accessibility](#accessibility)
8. [Slide Type Guidelines](#slide-type-guidelines)
9. [Anti-Patterns](#anti-patterns)

---

## Core Principles

### The 5-Second Rule
Every slide must communicate its primary message within **5 seconds** of viewing. If a viewer glances at the screen, they should immediately understand:
1. What type of information is shown
2. The single most important data point
3. Whether action is needed (for alerts)

### Information Hierarchy
Structure content with clear visual weight:
```
Hero Number (120px)     → The ONE number that matters most
├── Supporting KPIs (72px)  → 2-4 secondary metrics
├── Labels & Context (48px) → What the numbers mean
└── Timestamps (36px)       → When data was updated
```

### Less is More
- **Maximum 10-18 words** per slide (excluding data labels)
- **7-8 visual elements** maximum (charts, cards, indicators)
- **One primary focus** per slide - don't compete for attention

---

## Typography

### Font Sizes for 4K @ 10-20ft Viewing

| Use Case | Size | Weight | Example |
|----------|------|--------|---------|
| Hero numbers | 120px | 700 | `$2.4M` |
| Primary values | 72px | 600 | `87%` |
| Section headers | 56px | 700 | `MONTHLY REVENUE` |
| Card text / names | 48px | 400-600 | `Active Projects` |
| Labels / secondary | 40px | 400 | `vs. last month` |
| **Minimum** | 36px | 400 | `Updated 2:30 PM` |

> **Critical:** Nothing below 36px. Ever. It won't be readable at distance.

### Font Selection
- **Primary:** Sans-serif only (Helvetica, Inter, Arial, Roboto)
- **Avoid:** Serif fonts, decorative fonts, thin weights
- **Limit:** Maximum 2 font weights per slide (regular + bold)

### Text Guidelines
- **UPPERCASE** for headers and labels (increases scanability)
- **Title Case** for proper nouns and categories
- **Sentence case** for longer descriptive text
- **Never italicize** - reduces readability at distance
- **Line height:** 1.3-1.5 for any multi-line text

---

## Color System

### Primary Palette (Dark Theme)

```
Background Layers:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Base Background    #0F172A    rgb(15, 23, 42)     Slate 900
Card Background    #1E293B    rgb(30, 41, 59)     Slate 800
Elevated Surface   #334155    rgb(51, 65, 85)     Slate 700

Text Colors:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Primary Text       #FFFFFF    rgb(255, 255, 255)  White
Secondary Text     #94A3B8    rgb(148, 163, 184)  Slate 400
Muted Text         #64748B    rgb(100, 116, 139)  Slate 500

Accent Colors:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Primary Blue       #3B82F6    rgb(59, 130, 246)   For primary metrics
Success Green      #22C55E    rgb(34, 197, 94)    On track, positive
Warning Amber      #F59E0B    rgb(245, 158, 11)   Attention needed
Error Red          #EF4444    rgb(239, 68, 68)    Critical alerts
Info Cyan          #06B6D4    rgb(6, 182, 212)    Informational
```

### Semantic Color Usage

| Status | Color | Use For |
|--------|-------|---------|
| Positive | Green `#22C55E` | Goals met, improvements, on-track |
| Neutral | Blue `#3B82F6` | Standard data, informational |
| Attention | Amber `#F59E0B` | Behind target, needs review |
| Critical | Red `#EF4444` | Alerts, blockers, urgent issues |

### Contrast Requirements
- **Text on dark background:** Minimum 4.5:1 ratio (WCAG AA)
- **Large text (>72px):** Minimum 3:1 ratio acceptable
- **Interactive indicators:** Minimum 3:1 ratio
- **Test with:** [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

### Chart Color Palette
Use these colors for data series in order:
```
1. #3B82F6  Blue
2. #22C55E  Green
3. #F59E0B  Amber
4. #8B5CF6  Purple
5. #EC4899  Pink
6. #06B6D4  Cyan
```

> **Rule:** Maximum 4-5 colors in any single chart. If you need more, simplify the data.

---

## Layout & Grid

### Screen Zones (3840x2160)

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER ZONE (180px)                                         │
│ Logo (left) | Title (center) | Time/Status (right)          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                                                             │
│                    PRIMARY CONTENT ZONE                     │
│                        (1740px)                             │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ FOOTER ZONE (240px)                                         │
│ Secondary charts, progress bars, status indicators          │
└─────────────────────────────────────────────────────────────┘

Safe Margins: 140px on all sides
```

### Grid System

**12-Column Grid** for flexible layouts:
- Column width: ~267px (at 3840px with 140px margins)
- Gutter: 40px between columns
- Use 2, 3, 4, or 6 column layouts for balance

Common Layouts:
```
KPI Cards:      4 columns (4 equal cards across)
              ┌────┐ ┌────┐ ┌────┐ ┌────┐
              │    │ │    │ │    │ │    │
              └────┘ └────┘ └────┘ └────┘

Split View:     6+6 columns (two equal halves)
              ┌──────────┐ ┌──────────┐
              │          │ │          │
              │          │ │          │
              └──────────┘ └──────────┘

Feature + Cards: 8+4 columns (main + sidebar)
              ┌───────────────┐ ┌────┐
              │               │ │    │
              │               │ ├────┤
              │               │ │    │
              └───────────────┘ └────┘
```

### Spacing Scale
Use consistent spacing multiples:
```
xs:   20px   - Tight internal padding
sm:   40px   - Standard gaps between elements
md:   60px   - Section separation
lg:   80px   - Major section breaks
xl:  120px   - Header/footer separation
```

### Visual Rhythm
- **Align elements** to the grid - no arbitrary positioning
- **Group related items** with consistent spacing
- **Separate unrelated items** with larger gaps
- **White space is content** - don't fill every pixel

---

## Data Visualization

### Chart Selection Guide

| Data Type | Best Chart | Avoid |
|-----------|------------|-------|
| Single KPI value | Large number + trend indicator | Pie charts |
| Part-to-whole | Stacked bar, progress bar | Pie charts |
| Comparison | Horizontal bar chart | 3D charts |
| Trend over time | Line chart, area chart | Vertical bars (>6 items) |
| Status/categories | Color-coded cards | Complex visualizations |
| Rankings | Horizontal bar (sorted) | Tables with many rows |

### Chart Best Practices

**Bar Charts:**
- Maximum 8-10 bars visible
- Bar width: minimum 40px
- Gap between bars: 20-30px
- Always include value labels ON or NEAR bars
- Sort by value when order doesn't matter

**Line Charts:**
- Maximum 3-4 lines
- Line thickness: 4-6px minimum
- Data point markers: 12-16px diameter
- Direct label lines (no legends when possible)

**Progress Bars:**
- Height: 40-60px minimum
- Show percentage value prominently
- Use color to indicate status (green/amber/red zones)

**KPI Cards:**
- Large central number (72-120px)
- Clear label above (40-48px)
- Trend indicator or comparison below
- Consistent card sizes across slide

### Data Labels
- **Always label directly** - reduce legend reliance
- **Position labels** on or very near the data
- **Include units** (%, $, K, M) with the number
- **Round appropriately** - `$2.4M` not `$2,387,492`

### Number Formatting
```
Currency:  $1,234      $12.3K      $1.2M       $1.2B
Percent:   12%         87.5%       (one decimal max)
Count:     1,234       12.3K       1.2M
Duration:  3d 4h       2w 3d       (human readable)
```

---

## Animation & Motion

### Core Principles

1. **Purpose over decoration** - Every animation must serve a function
2. **Subtle over flashy** - Animation should enhance, not distract
3. **Consistent timing** - Use standard easing and durations
4. **Performance matters** - Maintain 60fps, avoid jank

### Animation Types

**Data Updates (Real-time motion)**
- Number counters: Animate value changes smoothly
- Progress bars: Ease to new position over 500ms
- Charts: Transition bars/lines to new values
- Easing: `ease-out` for entering, `ease-in-out` for updates

**Slide Transitions**
- Duration: 400-600ms
- Type: Fade or slide (not flip, bounce, zoom)
- Don't transition individual elements - transition the whole slide

**Ambient Motion** (use sparingly)
- Subtle gradient shifts: Very slow (30-60s cycle)
- Particle effects: Only for celebration/achievement states
- Pulsing indicators: For alerts only, 1-2s cycle

### Timing Standards
```
Micro-interactions:  150-250ms   (hover states, small feedback)
Standard transitions: 300-500ms  (slide changes, panel opens)
Data animations:      500-800ms  (number counting, bar growth)
Ambient loops:        10-60s     (background gradients)
```

### Easing Functions
```javascript
// Recommended easing curves
ease-out:      cubic-bezier(0.0, 0.0, 0.2, 1)   // Elements entering
ease-in:       cubic-bezier(0.4, 0.0, 1, 1)     // Elements leaving
ease-in-out:   cubic-bezier(0.4, 0.0, 0.2, 1)   // State changes
```

### What NOT to Animate
- Decorative bouncing or spinning
- Text that moves or scrolls
- Background elements that compete with data
- Gratuitous particle effects
- Anything that cycles faster than 1 second

---

## Accessibility

### Color Independence
- **Never use color alone** to convey meaning
- Pair color with: icons, patterns, labels, or position
- Example: Red alert should also have warning icon and text

### Contrast Standards (WCAG 2.1 AA)
| Element | Minimum Ratio |
|---------|---------------|
| Body text | 4.5:1 |
| Large text (>72px) | 3:1 |
| UI components | 3:1 |
| Charts/graphs | 3:1 |

### Testing
- Test in grayscale to verify information hierarchy
- Check with color blindness simulators
- View from actual intended distance
- Test under different lighting conditions

### Cognitive Load
- One primary message per slide
- Group related information visually
- Use consistent patterns across slides
- Avoid flashing or rapidly changing content

---

## Slide Type Guidelines

### KPI Dashboard
```
Purpose: Show 4-8 key metrics at a glance
Layout:  4-column card grid
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│ $2M │ │ 87% │ │ 142 │ │ 96% │
│Rev  │ │Goal │ │Proj │ │SLA  │
└─────┘ └─────┘ └─────┘ └─────┘

Guidelines:
• Hero number: 72-120px
• Labels: 40-48px
• Color-code status (green/amber/red)
• Include trend indicators (↑ ↓ →)
• Show comparison context ("vs last month")
```

### Alert/Status Dashboard
```
Purpose: Highlight items needing attention
Layout:  Priority list with status indicators
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌──────────────────────────────┐
│ 🔴 CRITICAL: Server down     │
├──────────────────────────────┤
│ 🟡 WARNING: 3 projects late  │
├──────────────────────────────┤
│ 🟢 OK: All systems normal    │
└──────────────────────────────┘

Guidelines:
• Critical alerts at top, always visible
• Clear color coding + icons
• Maximum 5-6 items visible
• Include action context if applicable
• Pulse animation for critical only
```

### Schedule/Timeline
```
Purpose: Show who's doing what and when
Layout:  Horizontal timeline with rows
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        Mon   Tue   Wed   Thu   Fri
Alice   █████████
Bob           ████████████
Carol               ██████████████

Guidelines:
• Today indicator (vertical line)
• Maximum 8-10 people visible
• Color by project or status
• Show dates/week prominently
• Truncate names if needed (first name + initial)
```

### Revenue/Metrics Chart
```
Purpose: Show trends and progress toward goals
Layout:  Large chart with KPI summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌─────────────────┐  ┌────┐
│                 │  │$2M │
│  ▄▄ ▄▄ ▄▄ ██   │  │YTD │
│  ██ ██ ██ ██   │  └────┘
│  J  F  M  A    │  ┌────┐
└─────────────────┘  │87% │
                     │Goal│
                     └────┘

Guidelines:
• Bar chart for discrete periods
• Line chart for continuous trends
• Include goal line for context
• Highlight current period
• Show YTD/MTD summary in sidebar
```

### Project Status Pipeline
```
Purpose: Show work moving through stages
Layout:  Horizontal pipeline or kanban
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Pending    In Progress    Review      Done
     (12)        (8)          (3)        (47)
   ┌────┐      ┌────┐       ┌────┐     ┌────┐
   │    │      │████│       │██  │     │████│
   │    │      │████│       │    │     │████│
   └────┘      └────┘       └────┘     └────┘

Guidelines:
• Show counts prominently per stage
• Visual representation of volume
• Color-code by age or priority
• Left-to-right flow (standard direction)
• Highlight bottlenecks
```

---

## Anti-Patterns

### Typography Mistakes
- Text smaller than 36px
- More than 2 font weights
- Italic or decorative fonts
- Centered long-form text
- Low-contrast text colors

### Color Mistakes
- Using color as the only indicator
- More than 5 colors in one chart
- Highly saturated colors on dark backgrounds
- Red/green only (color blindness)
- Insufficient contrast ratios

### Layout Mistakes
- Crowding content to edges
- Inconsistent spacing
- Too many competing focal points
- Misaligned elements
- Filling every available space

### Data Visualization Mistakes
- Pie charts (hard to compare accurately)
- 3D effects (distorts perception)
- Missing labels or legends
- Too many data points
- Decorative chart elements

### Animation Mistakes
- Movement for movement's sake
- Animations faster than 150ms
- Scrolling or marquee text
- Flashing elements (except critical alerts)
- Competing simultaneous animations

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│  DIGITAL SIGNAGE DESIGN QUICK REFERENCE                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  FONT SIZES              SPACING                        │
│  Hero:    120px          xs: 20px                       │
│  Large:    72px          sm: 40px                       │
│  Header:   56px          md: 60px                       │
│  Body:     48px          lg: 80px                       │
│  Label:    40px          xl: 120px                      │
│  Minimum:  36px          Margin: 140px                  │
│                                                         │
│  COLORS                  RULES                          │
│  Success: #22C55E        • Max 10-18 words              │
│  Warning: #F59E0B        • Max 7-8 visual elements      │
│  Error:   #EF4444        • 5-second comprehension       │
│  Info:    #3B82F6        • 4.5:1 contrast minimum       │
│                          • Never color-only meaning     │
│  ANIMATION                                              │
│  Transitions: 300-500ms                                 │
│  Data updates: 500-800ms                                │
│  Easing: ease-out (enter), ease-in-out (change)         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Resources

### Tools
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) - Verify color accessibility
- [Learn UI Data Color Picker](https://www.learnui.design/tools/data-color-picker.html) - Generate chart palettes
- [Coolors.co](https://coolors.co) - Explore color combinations

### Further Reading
- [ScreenCloud: 10 Rules for Digital Signage](https://screencloud.com/digital-signage/design-rules)
- [Rise Vision: Digital Signage Best Practices](https://www.risevision.com/blog/digital-signage-best-practices)
- [Geckoboard: Dashboard Design Guide](https://www.geckoboard.com/best-practice/dashboard-design/)
- [Visix: Data Visualization for Digital Signage](https://www.visix.com/blog/data-visualization-digital-signage/)

---

*Last updated: January 2026*
*Target: AmiDash Signage Engine v1.0*
