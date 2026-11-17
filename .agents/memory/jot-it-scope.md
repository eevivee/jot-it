---
name: Jot It product constraints
description: User's product intent and deployment constraints for the personal journal.
---

Jot It is for personal use on the user's phone, not app-store distribution.
Use a mobile-friendly static website that can be hosted on GitHub Pages.

**Why:** The user explicitly said they do not need an app store and want hosting
like their Moon & Bloom app.

**How to apply:** Do not introduce a native app, paid backend, or Replit-only
runtime dependency as a prerequisite. A Replit account connector cannot
authorize a separately hosted GitHub Pages browser: use Google's browser
authorization for private Sheets access there.

The user wants a sophisticated, chic feel and the palette from yeslyapp.com.
Mood emoji are an explicit requirement.

**Why:** The user asked to match their Moon & Bloom and Yesly apps, then
specified Yesly's palette and “sophisticated and chic.”

**How to apply:** Preserve that identity in future visual changes; do not
replace mood emoji with generic icons merely to follow a no-emoji default.

Weeks begin on Monday and end on Sunday. Goals cover tomorrow, the current
week, calendar quarter, and year, with conversational achievement reflections
when those periods finish.

**Why:** These calendar rules and reflection intervals were explicitly requested.

**How to apply:** Keep historical goals when periods roll over, and keep whole
weeks together across month boundaries. Use 52 or 53 ISO weeks as needed;
do not force every calendar year to exactly 52.
