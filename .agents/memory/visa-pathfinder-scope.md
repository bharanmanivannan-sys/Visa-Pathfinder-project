---
name: Visa Pathfinder scope
description: Scope boundary and product direction for the first Visa Pathfinder release.
---

The planning experience is free-first and source-transparent, with maintained visa facts, regulation monitoring, and anonymous alerts backed by the API. Keep saved plans as a separate product phase.

**Why:** Immigration guidance changes frequently and can cause real harm when stale. The product should make the user journey trustworthy without presenting unreviewed or community data as official law.

**How to apply:** Keep visa facts, fees, timings, and eligibility guidance backed by maintained records with source and review metadata. Keep professional results and cost estimates clearly labeled as estimates unless they gain the same evidence trail.

Official source links must be selected for the submitted destination and purpose. Use passport country as a filter only when a maintained official record defines nationality-specific applicability; do not infer it from the user's occupation or skills.

**Why:** A visitor request must not surface work routes, and general destination pages should not be mistaken for passport-specific eligibility.

**How to apply:** Keep source records tagged by purpose and optional passport applicability. A blank passport list means the official resource is general; a populated list is an explicit filter.

For Australia, the Study flow covers full-time study with subclass 500; do not add Student Guardian subclass 590 to this flow. Show subclass 407 only when the applicant selects the Training purpose, not by inferring training from course level.

**Why:** The user chose to keep Study and Training as separate purposes and exclude the guardian route from this flow.

**How to apply:** Keep subclass 500 tagged to study and subclass 407 tagged to training. Do not infer subclass 407 from a vocational or technical course level or add subclass 590 to Study results.

Every configured destination should have an official visa discovery entry point. When a country has no single all-visa index, use its closest official immigration hub or separate official pages by purpose and authority, and state what the page does not cover.

**Why:** Immigration authorities do not all publish one comprehensive visa list; routes may be split by activity, stay length, or responsible agency.

**How to apply:** Prefer destination-government visa lists or finders. Clearly distinguish general directories from individual pathways, keep records purpose-matched, and never describe a partial overview as exhaustive.

Where an official government question-based finder exists, link users to it for broad or answer-dependent route discovery instead of trying to reproduce its decision tree. Pathfinder's maintained route cards are examples and must not be presented as the full official result set.

**Why:** Government visa options can branch on multiple answers and change over time; a small curated catalogue cannot safely claim exhaustive matching.

**How to apply:** Keep maintained routes purpose-matched, link the official finder prominently where configured, explain its broader/dynamic role, and do not claim answer-specific eligibility unless backed by reviewed official evidence.

Automated source checks are gated on a recorded access-policy review and must honor robots rules. A content or URL change is staged for review; do not silently replace material visa facts or retain scraped page text.

**Why:** Public availability alone does not establish permission for automated retrieval, and an unreviewed page change can make immigration guidance misleading.

**How to apply:** Monitor only configured HTTPS sources whose access rules have been reviewed. Use conditional requests and content hashes, keep only check metadata, and require a human review before changing a published source or guidance claim.

Global discovery is catalogue-based in the first release. Destinations without a maintained pathway record must return `OUT_OF_SCOPE` rather than a guessed visa result.

**Why:** A global promise without jurisdiction-specific sources would create false confidence and undermine the free-first trust model.

**How to apply:** Add a destination only with pathway-specific authority metadata, review dates, and evidence gaps; otherwise direct the user to the destination's official immigration authority.

The destination selector is limited to the 18 countries with configured first-release coverage. Passport country remains global and must not be restricted to the destination list.

**Why:** A passport country can be any nationality even when the app only has maintained destination resources for a smaller set.

**How to apply:** Use the maintained destination catalogue for destination suggestions and submission validation, while keeping the full country list for passport selection. Reset previously saved destinations that are no longer supported.

The committed Pathfinder destination and purpose are the source of truth for downstream pages; draft edits stay local to the intake until the user submits the search. Work-market and settlement content must be hidden for visitor contexts.

**Why:** Static Australia-first pages caused unrelated job, payroll, tax and settlement guidance to appear after searches for other destinations or tourism.

**How to apply:** Persist the committed context across navigation and reloads, show it in the shell, and make every context-sensitive page either derive from it or clearly state that its maintained coverage is unavailable.

The occupation field intentionally accepts free text but only treats plain, bounded, regex-valid input that matches an in-demand occupation alias as eligible for pathway scoring. When a backend is added, repeat the same validation server-side rather than trusting browser checks.

**Why:** Client-side checks improve the user experience and block accidental unsafe input in the prototype, but they are not a security boundary once requests can reach an API.

**How to apply:** Keep the occupation catalog and validation rules shared or mirrored between client and server, and reject malformed, markup-like, command-like, or prompt-style input at the API boundary as well.
