/**
 * Joule Conversation — Category Spend (Sample / Illustrative)
 *
 * Persona: Category Manager (procurement.md#category-manager) — strategic owner
 * of a procurement category, responsible for compliance and savings. Ariba apps:
 * Spend Analysis / Category Management.
 *
 * SCENARIO (illustrative — all data is fictional):
 *   Alex Chen asks to see off-contract IT spend. Joule returns the spend breakdown,
 *   flags the compliance gap (spend going to non-contracted suppliers), and suggests
 *   consolidating onto the preferred contract — addressing the persona's pain points
 *   that "spend data is siloed" and "contract compliance is hard to enforce."
 *   This is an expert, data-dense persona, so the tone is direct and numeric.
 *
 * §10-SYNCED (like conversation-office-chairs.js): this script exists in all 5
 * ShellBar prototypes so in-conversation conv: links resolve from any of them.
 * Edit in NavigationLayout and replicate to all 5 in the same commit.
 *
 * HOW TO RUN:
 *   Reachable by URL only: joule/index.html?conv=conversation-category-spend
 *   It is not wired as any ShellBar controller default.
 *
 * MODELING NOTES (engine shape — read before editing):
 *   - Scripted linear demo, not a chatbot. @user lines auto-advance; @joule lines
 *     pause until Enter/Space.
 *   - richlist is used where a row carries a STATUS (compliance flag); table is
 *     reserved for the pure numeric supplier rows with no status. richlist status
 *     uses a COMMA (status:Text,State), set explicitly.
 *   - progress state is set explicitly (defaults to None if omitted).
 *   - Chips START playback but DO NOT branch it (engine limitation).
 */

Joule.load(`
---
greeting: Hi Alex,
title: Category spend breakdown
chips: Off-contract spend | Top suppliers | Savings opportunities
context: You're in Spend Analysis. Ask me about spend, compliance, or supplier consolidation.
timestamp: <strong>Today</strong> 11:05 AM
---

@user
Show me off-contract IT spend for the last quarter.

@joule
{{statuscard
step: Aggregated IT spend across business units
icon: accept
}}

Last quarter, IT category spend was **$2.4M**. Of that, **$430K (18%) went off-contract** — to suppliers without a negotiated agreement. Here's the compliance picture:

{{progress
value: 82
text: On-contract compliance — $1.97M of $2.4M (82%)
state: Warning
}}

{{richlist
header: Off-Contract IT Spend | $430K
subtitle: Where the leakage is concentrated
item: Laptops & peripherals | $210K | Bought from 4 non-contracted resellers | status:Off-contract,Error
item: Software licenses | $140K | Renewals not routed through Meridian contract | status:Off-contract,Error
item: Accessories | $80K | Low-value, spread across many suppliers | status:Watch,Warning
footer: Open spend dashboard
}}

The laptop leakage is the clearest fix — that volume is already covered by your Northwind contract:

{{table
columns: Reseller | Off-Contract Spend | Northwind Equivalent
row: TechDirect | $86K | $74K
row: BluePeak IT | $61K | $52K
row: Others (2) | $63K | $54K
}}

@user
So what would consolidating onto Northwind save us?

@joule
Moving that $210K of laptop spend onto the Northwind contract would cost about **$180K** at contracted rates — roughly **$30K saved**, plus it pulls compliance from 82% toward 90%.

{{messagestrip type:Success
Estimated annualized saving if the pattern holds: ~$120K, with compliance rising to ~90%.
}}

{{options
- Set Northwind as the default laptop supplier in Guided Buying (blocks off-contract at the point of purchase)
- Send the four resellers a wind-down notice
- Flag software renewals to route through the Meridian contract next
}}

I'd start with the first — enforcing at the point of purchase stops new leakage without chasing it after the fact. Want me to draft that policy change for review?
`);
