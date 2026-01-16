# Digital Signage Enhancement Plan

> **Last Updated**: January 6, 2026
> **Status**: Complete

## Overview
Enhance the AmiDash digital signage system to dynamically display more dashboard content across multiple slides, targeting office employees with quick 8-12 second transitions.

---

## Implementation Progress

### Phase 1: Data Infrastructure
- [x] Enhance metrics data fetcher (`src/data/fetchers/dashboard-metrics.ts`) - NEW FILE
  - [x] Add stuck projects calculation
  - [x] Add health metrics (sales health, ops health)
  - [x] Add velocity data (6-month PO vs Invoice)
  - [x] Add cycle time calculations
  - [x] Add on-time completion %
  - [x] Add customer concentration
- [x] Extend DataCache interface (`src/data/polling-manager.ts`)
  - [x] Add DashboardMetrics type (includes Health, Alerts, Performance, Velocity, CycleTime, Pipeline)
  - [x] Add fetchDashboardMetrics polling (30s interval)

### Phase 2: New Slide Implementations
- [x] Create Health Dashboard slide (`src/renderer/slides/health-dashboard.ts`)
  - [x] Semi-circular gauge component
  - [x] Diagnosis message display
  - [x] Bottleneck indicators
  - [x] Celebration animation trigger
- [x] Create Alerts Dashboard slide (`src/renderer/slides/alerts-dashboard.ts`)
  - [x] Overdue projects section
  - [x] Stuck projects section
  - [x] Pulsing attention indicators
  - [x] "All Clear" state
  - [x] Priority insertion logic
- [x] Create Performance Metrics slide (`src/renderer/slides/performance-metrics.ts`)
  - [x] On-Time % KPI card with gauge
  - [x] DTI KPI card
  - [x] Backlog Depth KPI card
  - [x] Customer Concentration KPI card
- [x] Create Velocity Chart slide (`src/renderer/slides/velocity-chart.ts`)
  - [x] 6-month bar chart
  - [x] Net change indicator
  - [x] Trend arrow (growing/shrinking/stable)
- [x] Create Status Pipeline slide (`src/renderer/slides/status-pipeline.ts`)
  - [x] Pipeline funnel visualization
  - [x] Project counts per status
  - [x] Revenue per status
  - [x] Bottleneck highlighting with glow effect
  - [x] Animated flow lines
- [x] Create Cycle Time slide (`src/renderer/slides/cycle-time.ts`)
  - [x] Horizontal bar chart
  - [x] Bottleneck status highlighting
  - [x] Total cycle time display

### Phase 3: Reusable Components
- [x] Create gauge component (`src/renderer/components/gauge.ts`)
  - [x] Semi-circular arc rendering
  - [x] Animated needle
  - [x] Color-coded zones (green/amber/red)
  - [x] Mini gauge variant for cards
  - [x] Horizontal gauge variant
- [x] Create celebrations component (`src/renderer/components/celebrations.ts`)
  - [x] Confetti particle system (integrated in health-dashboard.ts)
  - [x] Sparkle effects
  - [x] Goal achievement triggers

### Phase 4: Database & Configuration
- [x] Create migration (`supabase/migrations/029_signage_new_slides.sql`)
  - [x] Add new slide types to constraint
  - [x] Add default slide configurations
- [x] Update config schema (`src/config/schema.ts`)
  - [x] Add new slide type validation (12 types total)

### Phase 5: Admin UI Updates
- [x] Update slide editor (`../../src/components/signage/slide-editor.tsx`)
  - [x] Add new slide type options with icons
  - [x] Add descriptions for all slide types
- [x] Update actions file (`../../src/app/(dashboard)/admin/signage/actions.ts`)
  - [x] Add new slide types to SlideType union

### Phase 6: Integration & Testing
- [x] Register new slides in slide manager (`src/renderer/slide-manager.ts`)
  - [x] Import all 6 new slide classes
  - [x] Add to createSlide() switch
  - [x] Update mapSlideType() for database loading
- [ ] Test all new slides render correctly
- [ ] Test celebration animations
- [ ] Test priority insertion for alerts
- [ ] Verify data refresh intervals
- [ ] Profile frame rate performance

---

## New Slides Summary

| Slide | File | Key Features |
|-------|------|--------------|
| Health Dashboard | `health-dashboard.ts` | Speedometer gauges, celebration effects |
| Alerts Dashboard | `alerts-dashboard.ts` | Priority insertion, pulsing indicators |
| Performance Metrics | `performance-metrics.ts` | 2x2 KPI grid, color thresholds |
| Velocity Chart | `velocity-chart.ts` | 6-month bar chart, trend arrows |
| Status Pipeline | `status-pipeline.ts` | Funnel visualization, bottleneck highlighting |
| Cycle Time | `cycle-time.ts` | Horizontal bars, average totals |

---

## Slide Rotation Configuration

### Standard Rotation (No Alerts)
| Order | Slide | Duration |
|-------|-------|----------|
| 1 | Health Dashboard | 10s |
| 2 | Revenue Dashboard | 12s |
| 3 | Active Projects | 12s |
| 4 | Performance Metrics | 10s |
| 5 | Team Schedule | 12s |
| 6 | Alerts Dashboard | 8s |
| 7 | Velocity Chart | 10s |
| 8 | Status Pipeline | 10s |
| 9 | PO Ticker | 15s |
| 10 | Cycle Time | 10s |

**Total: ~109 seconds (~2 minutes per cycle)**

### Priority Rotation (When Alerts Exist)
Alerts slide appears every 3rd position when overdue/stuck projects exist.

---

## Design Specifications

### Colors (Amitrace Brand)
- Background: `#053B2C` (Dark green)
- Accent: `#C2E0AD` (Light green)
- Success: `#10B981`
- Warning: `#F59E0B`
- Error: `#EF4444`

### Gauges
- Style: Semi-circular speedometer
- Zones: 0-60% (red), 60-80% (amber), 80-100% (green)
- Animation: Smooth needle transition (300ms easing)

### Celebrations
- Trigger: 100% goal achievement, all-green health
- Effect: Confetti particles (100 particles, 3s duration)
- Sparkle: Radial glow effect

---

## Files Created/Modified

### New Files Created
```
signage-engine/src/data/fetchers/dashboard-metrics.ts
signage-engine/src/renderer/components/gauge.ts
signage-engine/src/renderer/slides/health-dashboard.ts
signage-engine/src/renderer/slides/alerts-dashboard.ts
signage-engine/src/renderer/slides/performance-metrics.ts
signage-engine/src/renderer/slides/velocity-chart.ts
signage-engine/src/renderer/slides/status-pipeline.ts
signage-engine/src/renderer/slides/cycle-time.ts
supabase/migrations/029_signage_new_slides.sql
```

### Files Modified
```
signage-engine/src/data/polling-manager.ts
signage-engine/src/renderer/slide-manager.ts
signage-engine/src/config/schema.ts
src/components/signage/slide-editor.tsx
src/app/(dashboard)/admin/signage/actions.ts
```

---

## Notes
- All slides maintain stale data warnings
- Font sizes optimized for 4K (3840x2160) at viewing distance
- Headlines max 5-7 words for quick comprehension
- F-pattern layout for eye tracking
- Dashboard metrics polled every 30 seconds
