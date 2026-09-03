/**
 * Joule Conversation — Office Chairs Sourcing (Sample / Illustrative)
 *
 * A short, runnable example for the Ariba Joule authoring guide. It shows a
 * single indirect-procurement exchange: a request, a policy response, and a
 * recommended next step. Kept deliberately focused — read it, copy it, extend it.
 *
 * SCENARIO (illustrative — all data is fictional):
 *   Riley Morgan needs ergonomic office chairs for a new floor. The category has
 *   no preferred supplier and company policy requires competitive bidding above a
 *   unit threshold, so Joule recommends creating a sourcing request to collect
 *   competitive bids. The sample ends at that recommendation.
 *
 * HOW TO RUN:
 *   This is the conversation the ShellBar controller loads when the Joule panel
 *   opens: _toggleJoulePanel appends "?conv=conversation-office-chairs" to the
 *   iframe src on every open. It is NOT the loader's own default — index.html
 *   falls back to the blank "conversation" template ("conversation.js") when no
 *   ?conv= param is present. So: open any ShellBar prototype and click the Joule
 *   button (controller path), or load by URL joule/index.html?conv=conversation-office-chairs.
 *   Opening joule/index.html with no ?conv= shows the blank template, not this file.
 *
 *   Authored canonically in NavigationLayout/joule/conversations/ and propagated
 *   to the other four (AribaHome-SAL, L2, L3, SearchResultsPage) as a §10-class
 *   synced file — edit here, replicate to all 5 in the same commit.
 *
 * MODELING NOTES (engine shape — read before editing):
 *   - This is a SCRIPTED LINEAR demo, not an interactive chatbot. @user lines
 *     auto-advance; free-typed input does not drive the flow.
 *   - This script uses a SINGLE @joule turn on purpose: all of Joule's response
 *     (policy warning, sourcing summary, and the designer note) renders as one
 *     message after one typing indicator, with no user keypress to advance.
 *     Splitting it into multiple @joule turns would reintroduce a per-turn pause
 *     where the user must press Enter / Space to reveal each following turn.
 *   - Welcome chips START the conversation but DO NOT branch it (engine
 *     limitation, shared with upstream). Every chip begins the same playback.
 *   - richlist item status uses a COMMA (status:Text,State). The STATE is set
 *     explicitly on every item below on purpose: if you omit it, the engine
 *     silently defaults to Success (green).
 */

Joule.load(`
---
greeting: Hello Riley,
title: Ordering ergonomic office chairs
chips: Request office chairs | Check sourcing policy | View open requests
context: You're in the Procurement workspace. How can I help you source today?
timestamp: <strong>Today</strong> 9:14 AM
---

@user
I need to order 120 ergonomic office chairs for the new third-floor workspace.

@joule
{{statuscard
step: Checked category and sourcing policy
icon: accept
}}

Got it — 120 ergonomic office chairs for the third-floor fit-out. Before I set this up, I checked the category and your company's sourcing policy.

{{messagestrip type:Warning
This category has no preferred supplier on file, and company policy requires competitive bidding for orders above 50 units. A direct purchase order isn't available here.
}}

Because competitive bidding applies, I'd recommend creating a **sourcing request** to collect bids from qualified suppliers. Here's what I'd include:

{{richlist
header: Sourcing Request Summary | 3 items
subtitle: Draft — not yet submitted
item: Ergonomic Task Chairs | Qty 120 | Adjustable lumbar, armrests | status:Ready,Success
item: Competitive Bidding | Policy-required | 3+ suppliers needed | status:Required,Warning
item: Preferred Supplier | None on file | Open sourcing event | status:Not set,Information
footer: Create sourcing request | Adjust details
}}

👋 Hi, Ariba designers — this is placeholder demo content. To author your own Joule conversation, see the [authoring guide](https://github.tools.sap/ariba-ux-framework-platform/ux-prototypes/blob/main/prototypes/NavigationLayout/joule/ARIBA-AUTHORING.md).

Or explore the other example conversations: [Laptop request](conv:conversation-laptop-request) · [Blocked invoices](conv:conversation-blocked-invoices) · [Contract renewals](conv:conversation-contract-renewals) · [Off-contract spend](conv:conversation-category-spend) · [Reorder supplies](conv:conversation-reorder-supplies)

`);
