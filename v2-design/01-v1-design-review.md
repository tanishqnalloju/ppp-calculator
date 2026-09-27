# 01 — v1 design review

Lens: ui-design plugin skills (`visual-design-foundations`, `design-system-patterns`, `responsive-design`, `interaction-design`, `accessibility-compliance`) plus a practical WCAG 2.2 AA mindset. Review only — not a redesign.

## What’s working

- **Clear product voice.** Serif title + italic tagline + warm paper palette reads “editorial calculator,” not fintech dashboard. Matches README “restraint as craft.”
- **Primary answer is marked.** `.metric.primary` (accent border + soft fill + accent value) correctly elevates PPP over FX.
- **Live region** on `#results` (`aria-live="polite"`) plus `role="status"` for errors — good baseline for dynamic updates.
- **Skip link**, semantic `<main>`, labeled fields, theme persistence, `prefers-reduced-motion` kill-switch.
- **Honest empty/gap states** for commodities and unreliable PLI (warn, hide Infinity) — product integrity.
- **Share-by-URL without chrome** — params always reflect state; KingIndex handoff reuses them.

## Hierarchy

| Issue | Detail |
|-------|--------|
| Metric twins | PPP and FX use the same value scale (`clamp(1.35rem…1.7rem)`); primary differentiation is color, not size/weight. At a glance on mobile they compete. |
| Lead vs metrics | Serif lead is strong storytelling, but the numeric “punch” sits one scroll beat below inputs. On short viewports, first paint is mostly the control panel. |
| Worked example | H2 + quote block restates lead/metrics; visual weight similar to answers → noise after first use. |
| Section titles | Commodities / FAQ / methodology all ~1.15rem Newsreader — flat after the answer block; little “secondary vs tertiary” step-down. |

**Recommendation for v2:** Make PPP a clear display size step above FX; demote or fold worked example into the lead/detail; reserve one “supporting evidence” band for cost+PLI+commodities.

## Spacing & layout

- Content max-width **42rem** is readable for prose but leaves large side gutters on ≥1024px with no second column for comparison.
- Grid breakpoints at 520/560px are content-sensible; touch targets for theme toggle and picker rows look ≥44px tall — good.
- Spacing is mostly one-off rem values (0.55, 0.65, 0.85, 0.9, 1.15…) rather than a named 4/8-pt scale → harder to keep rhythm in a redesign.
- Panel padding vs metric padding are close; cards don’t “breathe” differently enough to signal importance.

## Color & contrast

- Light theme: dark ink on warm paper — generally strong. Muted `#6b6458` on `#f7f5f0` / `#f3f0ea` should be verified (≥4.5:1 for body-sized muted text; micro-labels at 0.72rem are riskier).
- Dark theme accent `#5fbf9a` on `#1e332a` (primary metric) needs a contrast check for the large value text; soft green-on-green can fail for small labels.
- Status uses warn tokens — good semantic split from accent.
- No high-contrast / `prefers-contrast` path yet.

## Typography

- Instrument Sans + Newsreader pairing is distinctive and on-brand; retain unless synthesis finds a better pair.
- Uppercase tracked labels at ~11–12px effective size: hierarchy cue, but accessibility and readability tradeoff (WCAG doesn’t forbid ALL CAPS, but effective size + tracking hurts).
- Tabular nums only on commodity prices — **should also apply to metric values and income input** for stable layout as digits change.
- Line-height 1.55 body is solid; heading line-heights 1.15–1.2 are fine.

## Interaction & states

| Gap | Notes |
|-----|--------|
| Loading | No skeleton / “Loading country data…” before fetch completes. |
| Empty income | Soft placeholder lead — good; could still show PLI/cost (income-independent) earlier — currently cost/PLI also blank until income > 0. |
| Picker keyboard | Arrow/Enter/Escape present; missing Home/End, typeahead highlight sync with `aria-activedescendant`, and Escape restoring prior label. |
| Theme toggle | Label flips to opposite theme (“Dark” when light) — slightly ambiguous; icon-only + `aria-pressed` or “Use dark theme” is clearer. |
| Motion | Number changes hard-cut; optional subtle crossfade (respect reduced motion) would help orientation without decoration. |
| Share | Silent URL write — power users get it; others won’t know to copy the address bar. |

## Responsive

- Mobile-first stack works; dual metrics collapse cleanly.
- Commodity `auto-fill minmax(9.5rem)` can produce awkward 3–4 column denseness on mid widths; horizontal scroll strip might scan better for “samples.”
- No container queries; not required at this size, but a two-pane desktop layout will want either grid areas or a ≥900px breakpoint.

## Accessibility (WCAG 2.2 AA lens)

**Pass / mostly pass**

- Semantic structure, form labels (`for=`), skip link, focus-visible ring, live regions, FAQ/methodology as native `<details>`.

**Gaps to fix in v2**

1. Combobox pattern incomplete (`aria-expanded` yes; need option `id`s + `aria-activedescendant`, `aria-controls` already set).  
2. `:focus { outline: none }` is OK with strong `:focus-visible`, but ensure mouse users who tab still see rings on all custom controls (picker buttons, summary).  
3. Theme control: expose state (`aria-pressed` or text “Theme: dark”).  
4. Status color alone shouldn’t carry meaning — text is present (good); keep icon optional, not sole cue.  
5. Verify muted text contrast; bump `--muted` if needed.  
6. Ensure zoom 200% doesn’t clip picker dropdown (`max-height` + overflow ok).  
7. Commodity cards: pair name is clear; ISO3 alone may need full country name for SR context (visible short label can stay ISO3 if `aria-label` includes names).

## Design-system readiness

v1 tokens are a flat `:root` list (bg, panel, text, accent…) — good start, but missing:

- Named **spacing scale**, **type scale**, **radii scale** beyond one `--radius`
- Semantic aliases (`--surface-elevated`, `--text-secondary`, `--border-subtle`)
- Motion easings / durations
- Component-level tokens for metric primary vs secondary

v2 should promote a primitive → semantic hierarchy (per `design-system-patterns`) without inventing a component library framework.

## Severity summary

| Severity | Items |
|----------|--------|
| High (fix in v2) | Combobox a11y; muted/primary contrast verification; loading state; PPP vs FX visual hierarchy |
| Medium (polish) | Desktop underuse; worked-example redundancy; type-field prominence; share affordance; tabular nums on money |
| Low | Inline style hint; FAQ/method overlap; theme label wording; commodity grid denseness |

## Bottom line

v1 is a coherent, restrained MVP with real accessibility bones. Redesign should **amplify the answer hierarchy and desktop comparison layout**, **tighten token discipline**, and **close combobox/loading/share gaps** — without changing math, params, or product story.
