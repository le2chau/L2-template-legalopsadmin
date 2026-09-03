/**
 * Joule Conversation — Blocked Invoices (Sample / Illustrative)
 *
 * Persona: Finance A&R Admin (guided-buying.md#finance-ar-admin) — processes
 * invoices and payment approvals downstream of purchasing. Ariba app: Invoicing.
 *
 * SCENARIO (illustrative — all data is fictional):
 *   Priya Nair asks which invoices are blocked and why. Joule surfaces the blocked
 *   invoices with the specific reason for each (PO quantity mismatch, missing goods
 *   receipt, price variance) and the next step to clear each one — directly
 *   addressing the persona's "poor visibility into which invoices are blocked and
 *   why" pain point.
 *
 * §10-SYNCED (like conversation-office-chairs.js): this script exists in all 5
 * ShellBar prototypes so in-conversation conv: links resolve from any of them.
 * Edit in NavigationLayout and replicate to all 5 in the same commit.
 *
 * HOW TO RUN:
 *   Reachable by URL only: joule/index.html?conv=conversation-blocked-invoices
 *   It is not wired as any ShellBar controller default.
 *
 * MODELING NOTES (engine shape — read before editing):
 *   - Scripted linear demo, not a chatbot. @user lines auto-advance; @joule lines
 *     pause until Enter/Space.
 *   - richlist (not table) is used for the invoice rows because each row carries a
 *     STATUS — table has no per-row status coloring. richlist status uses a COMMA
 *     (status:Text,State); State is set explicitly on every row.
 *   - Chips START playback but DO NOT branch it (engine limitation).
 */

Joule.load(`
---
greeting: Hi Priya,
title: Resolving blocked invoices
chips: Show blocked invoices | This week's exceptions | Payments due
context: You're in Invoicing. I can help you find and clear invoice exceptions.
timestamp: <strong>Today</strong> 8:47 AM
---

@user
Which invoices are blocked right now, and why?

@joule
{{statuscard
step: Reviewed open invoice exceptions
icon: accept
}}

You have **3 blocked invoices** totaling $41,900. Here they are, with the reason each one is held and what it needs to clear:

{{richlist
header: Blocked Invoices | 3 held
subtitle: Sorted by amount — highest first
item: INV-4821 | Acme Corp — $24,300 | PO quantity mismatch: billed 120, received 100 | status:Blocked,Error
item: INV-4795 | Summit Office Supply — $12,400 | No goods receipt posted yet | status:Blocked,Error
item: INV-4830 | Northwind Technology — $5,200 | Unit price $2 over PO — within tolerance | status:Review,Warning
footer: Open worklist | Export list
}}

The first two need action from a specific person; the third is a small price variance you can approve.

@user
What's the fastest way to clear the Acme one?

@joule
For **INV-4821**, the invoice bills 120 units but only 100 were received, so it can't three-way match. Two ways to resolve it:

{{list
- If 20 more units are arriving: wait for the goods receipt, then it clears automatically.
- If only 100 were ordered/received: ask Acme for a corrected invoice, or short-pay to the received quantity.
}}

{{messagestrip type:Information
The receiving team logged this PO as "partial — remainder expected 07/24." So the most likely fix is to wait for the final receipt.
}}

Want me to message the receiving contact to confirm the remaining 20 units are still coming?
`);
