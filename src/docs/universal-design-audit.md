# Universal design audit

Date: 2026-08-25

This is a source-level first pass of the TDC 2026 site. It is not a formal
conformance assessment; real assistive-technology and venue testing is still
needed before publishing an accessibility statement.

## Changes made on this branch

- Removed reliance on `title` tooltips for partner logos. Linked logos now
  expose their partner name and the fact that they open a new tab through an
  accessible name.
- Added a visible underline as well as `aria-current="location"` for the
  active single-page navigation item, so the state is not communicated by
  colour alone.
- Localised the mobile menu's open/close label and used `aria-current="page"`
  for the language switcher.
- Added initial focus to modal close controls and restored focus to the
  invoking speaker/session control after a modal closes.
- Replaced symbol-only speaker social links with readable link text.

## Positive findings

- The document has a language attribute, a skip link, landmark elements, and
  labelled sections.
- Content images have meaningful `alt` text. Decorative duck imagery and SVG
  decoration are hidden from assistive technology.
- Native modal dialogs are opened with `showModal()`, which supplies Escape
  handling and makes the page behind the modal inert in supporting browsers.
- Keyboard focus styles, a reduced-motion media query, responsive layout, and
  labelled form controls are already present.

## Follow-up checks

1. Test keyboard-only operation at narrow and wide breakpoints: menu open and
   close, language switch, theme switch, filters, FAQ, speaker/session dialogs,
   and focus order.
2. Test with NVDA or VoiceOver, including the live Sessionize refresh path and
   failed/empty image loads.
3. Run axe or Accessibility Insights against both languages in dark and light
   themes, then manually verify contrast for partner logos and focus rings.
4. Check 200% text zoom and narrow mobile widths for clipping or horizontal
   scrolling, especially the schedule.
5. Confirm that external content (ticketing, volunteer form, Sessionize data)
   has equivalent labels and keyboard support; third-party content is outside
   this repository's control.

References: WCAG 2.2 Success Criteria 1.1.1 (Non-text Content), 1.4.1 (Use of
Colour), 2.4.7/2.4.11 (Focus Visible/Focus Not Obscured), and 2.4.3 (Focus
Order); MDN, “`<dialog>` HTML dialog element”, especially its Accessibility
guidance on initial focus and explicit close mechanisms.