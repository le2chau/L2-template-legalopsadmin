/**
 * Joule Conversation — Reorder Supplies (Sample / Illustrative)
 *
 * Persona: Facilities Buyer (guided-buying.md#facilities-buyer) — dedicated buyer
 * for facilities, office supplies, and maintenance. Ariba app: Buying.
 *
 * SCENARIO (illustrative — all data is fictional):
 *   Morgan Lee reorders recurring janitorial supplies. This leans on the persona's
 *   ACTUAL differentiator — quick-reorder from order history / favorites of recurring
 *   items, NOT a generic new purchase — and shows budget consumption inline, per the
 *   persona's "repetitive data entry" and "budget visibility is fragmented" pains.
 *
 * §10-SYNCED (like conversation-office-chairs.js): this script exists in all 5
 * ShellBar prototypes so in-conversation conv: links resolve from any of them.
 * Edit in NavigationLayout and replicate to all 5 in the same commit.
 *
 * HOW TO RUN:
 *   Reachable by URL only: joule/index.html?conv=conversation-reorder-supplies
 *   It is not wired as any ShellBar controller default.
 *
 * MODELING NOTES (engine shape — read before editing):
 *   - Scripted linear demo, not a chatbot. @user lines auto-advance; @joule lines
 *     pause until Enter/Space.
 *   - richlist status uses a COMMA (status:Text,State), set explicitly on every row.
 *   - progress state is set explicitly (defaults to None if omitted).
 *   - Chips START playback but DO NOT branch it (engine limitation).
 */

Joule.load(`
---
greeting: Hi Morgan,
title: Reordering monthly supplies
chips: Reorder last month's supplies | My favorites | Budget left this quarter
context: You're in Buying. I can reorder recurring items and keep an eye on your budget.
timestamp: <strong>Today</strong> 9:03 AM
---

@user
Reorder the janitorial supplies I get every month.

@joule
{{statuscard
step: Pulled your recurring janitorial order
icon: accept
}}

Found it — this matches the order you've placed the last 3 months, all from Summit Office Supply (on contract). I can repeat it as-is:

{{richlist
header: Recurring Order — Janitorial | 4 items
subtitle: Last ordered June 5 — same supplier, same quantities
item: Multi-surface cleaner | 24 units | $6/unit | status:In stock,Success
item: Paper towels (bulk) | 40 units | $9/unit | status:In stock,Success
item: Trash liners (55 gal) | 20 units | $12/unit | status:In stock,Success
item: Hand soap refills | 30 units | $4/unit — 2-day lead | status:Backorder,Warning
footer: Reorder all | Edit quantities
}}

One change since last month: hand soap refills are on a short backorder (2-day lead). Everything else ships next day. Here's where your budget stands:

{{progress
value: 64
text: Facilities supplies budget — $12,800 of $20,000 used this quarter
state: Success
}}

This reorder is **$984**, which keeps you at 69% — comfortably within budget.

@user
Go ahead, but drop the hand soap since it's backordered.

@joule
{{statuscard
step: Placed your reorder (3 of 4 items)
icon: accept
}}

Done — I reordered the three in-stock items and left off the hand soap refills. Total **$864**, arriving tomorrow.

{{messagestrip type:Success
Order PR-2026-10461 placed with Summit Office Supply. Budget now at 68% for the quarter.
}}

Want me to set the hand soap to auto-reorder as soon as it's back in stock, so you don't have to track it?
`);
