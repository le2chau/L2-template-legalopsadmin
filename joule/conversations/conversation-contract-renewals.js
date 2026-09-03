/**
 * Joule Conversation — Contract Renewals (Sample / Illustrative)
 *
 * Persona: Contract Manager (procurement.md#contract-manager) — manages the
 * contract lifecycle from negotiation through renewal/expiry. Ariba app:
 * Contract Management.
 *
 * SCENARIO (illustrative — all data is fictional):
 *   Dana Okafor asks what's expiring this quarter. Joule lists the contracts in
 *   their renewal window, shows how much has been spent against each (utilization),
 *   and recommends a renewal action — addressing the persona's twin pain points
 *   that "expiry alerts come too late" and "usage data is hard to find."
 *
 * §10-SYNCED (like conversation-office-chairs.js): this script exists in all 5
 * ShellBar prototypes so in-conversation conv: links resolve from any of them.
 * Edit in NavigationLayout and replicate to all 5 in the same commit.
 *
 * HOW TO RUN:
 *   Reachable by URL only: joule/index.html?conv=conversation-contract-renewals
 *   It is not wired as any ShellBar controller default.
 *
 * MODELING NOTES (engine shape — read before editing):
 *   - Scripted linear demo, not a chatbot. @user lines auto-advance; @joule lines
 *     pause until Enter/Space.
 *   - progress state defaults to None if omitted (a DIFFERENT default from richlist's
 *     Success) — state is set explicitly on every progress block below.
 *   - richlist status uses a COMMA (status:Text,State), set explicitly.
 *   - Chips START playback but DO NOT branch it (engine limitation).
 */

Joule.load(`
---
greeting: Hi Dana,
title: Contracts expiring this quarter
chips: Expiring this quarter | Low-utilization contracts | Renewal calendar
context: You're in Contract Management. I can track milestones, expiries, and utilization for you.
timestamp: <strong>Today</strong> 2:15 PM
---

@user
What contracts are expiring this quarter, and how much have we actually used them?

@joule
{{statuscard
step: Checked expiry dates and spend-to-date
icon: accept
}}

Three contracts fall in your renewal window before end of Q3. Here they are with utilization — spend to date against total contract value:

{{richlist
header: Expiring This Quarter | 3 contracts
item: Northwind Technology — IT Hardware | Expires Aug 31 | 3-year, $1.2M | status:Renew soon,Warning
item: Summit Facilities Services | Expires Sep 15 | 2-year, $480K | status:Renew soon,Warning
item: Meridian Travel | Expires Sep 30 | 1-year, $300K | status:Review,Information
footer: Open renewal calendar
}}

Utilization tells you which are worth renewing:

{{progress
value: 88
text: Northwind — $1.06M of $1.2M used (88%)
state: Success
}}

{{progress
value: 94
text: Summit Facilities — $451K of $480K used (94%)
state: Success
}}

{{progress
value: 22
text: Meridian Travel — $66K of $300K used (22%)
state: Warning
}}

@user
The travel one is barely used. What do you recommend?

@joule
Meridian is at **22% utilization** with two months left — you've committed to $300K and used $66K. A straight renewal at the same value would over-commit again.

{{messagestrip type:Warning
Renewing Meridian at $300K risks another year of low utilization. The gap is spend that could sit unused.
}}

{{options
- Renew at a lower committed value (e.g. $120K) to match actual travel volume
- Move to a no-minimum / pay-as-you-go rate card instead of a committed contract
- Let it lapse and consolidate travel into the Northwind master agreement
}}

I'd lead with the reduced-commitment option — it keeps the negotiated rates without locking in spend you're not using. Want me to draft the renewal request at $120K?
`);
