/**
 * Joule Conversation — Laptop Request (Sample / Illustrative)
 *
 * Persona: Casual Buyer (guided-buying.md#casual-buyer) — a non-procurement
 * employee who occasionally buys something for work. Ariba app: Guided Buying.
 *
 * SCENARIO (illustrative — all data is fictional):
 *   Jordan Avery needs a replacement work laptop. This is the deliberate
 *   HAPPY-PATH CONTRAST to conversation-office-chairs (which owns the
 *   buy → policy-block → sourcing-redirect path): here a catalog item is found,
 *   a preferred supplier is already on file, and a direct purchase order goes
 *   through with routine manager approval. Joule speaks in plain language and
 *   avoids procurement jargon ("requisition", "RFQ") per the persona's needs.
 *
 * §10-SYNCED (like conversation-office-chairs.js): this script exists in all 5
 * ShellBar prototypes so in-conversation conv: links resolve from any of them.
 * Edit in NavigationLayout and replicate to all 5 in the same commit.
 *
 * HOW TO RUN:
 *   Reachable by URL only: joule/index.html?conv=conversation-laptop-request
 *   It is not wired as any ShellBar controller default.
 *
 * MODELING NOTES (engine shape — read before editing):
 *   - Scripted linear demo, not a chatbot. @user lines auto-advance; @joule lines
 *     pause until Enter/Space. Free-typed input does not drive the flow.
 *   - Welcome/inline chips START playback but DO NOT branch it (engine limitation).
 *   - statuscard supports only icon: accept in this engine — any other value
 *     silently falls back to accept.
 *   - richlist item status uses a COMMA (status:Text,State); set State explicitly
 *     or the engine defaults it to Success (green).
 *   - objectheader status: A SAPUI5 sap.m.ObjectStatus emits a screen-reader-only
 *     state announcement (e.g. "Object Status" + "Entry successfully validated" for
 *     a Success state) in a .sapUiPseudoInvisibleText span. It is a11y-only —
 *     clipped to 0x0, never visible — and is injected by the framework, not the
 *     script. Don't try to author or suppress it; it's expected.
 */

Joule.load(`
---
greeting: Hi Jordan,
title: Ordering a standard work laptop
chips: Order a laptop | Check my requests | Track an order
context: You're in Buying. Tell me what you need and I'll help you get it.
timestamp: <strong>Today</strong> 10:32 AM
---

@user
My work laptop is failing and I need a new one. Can you help me order a replacement?

@joule
{{statuscard
step: Found a matching item in your catalog
icon: accept
}}

Of course. I found a standard work laptop in your catalog, and it's from a supplier your company already buys from — so this can go straight through as a normal order. No special approvals or bidding needed.

{{objectheader
title: Dell Latitude 5550 — 16GB / 512GB
number: 1,420
numberUnit: USD
attr: Item: Standard Work Laptop (IT)
attr: Supplier: Northwind Technology (preferred, on contract)
attr: Delivery: 3–5 business days
status: Ready to order | Success
}}

Here's what happens next if you go ahead:

{{richlist
header: Your Order | 3 steps
item: Add to order | Dell Latitude 5550 ×1 | status:Ready,Success
item: Manager approval | Goes to Sam Rivera automatically | Routine — under your team limit | status:1 approver,Information
item: Delivery | To your office, 3–5 business days | status:Estimated,Information
footer: Place order | Change item
}}

@user
Great — place the order.

@joule
{{statuscard
step: Submitted your order for approval
icon: accept
}}

Done — your order is in. I've sent it to Sam Rivera for a quick approval, and you'll get a notification the moment it's approved. Nothing else is needed from you.

{{messagestrip type:Success
Order PR-2026-10457 placed. Estimated delivery 3–5 business days after approval.
}}

Want me to set a reminder to follow up if it isn't approved by tomorrow?
`);
