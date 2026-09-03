/**
 * Joule Conversation — Blank Template
 *
 * Copy this file and rename it (e.g., conversation-my-flow.js).
 * Load it via: joule/index.html?conv=conversation-my-flow
 * Default (no ?conv param): loads this file (conversation.js).
 *
 * PLAYBACK: @user lines auto-advance; @joule lines pause until Enter or Space
 * (with the input focused). There is no click-to-advance.
 *
 * For the full DSL syntax, the component reference, Ariba deltas, and a worked
 * example, see ../README.md and ../ARIBA-AUTHORING.md. A runnable sample lives at
 * conversation-office-chairs.js.
 */

Joule.load(`
---
greeting: Hello,
# title: Your conversation title — shown in the panel header after the first status card; roughly 25 characters fit at the 416px panel, longer titles truncate with an ellipsis (see ARIBA-AUTHORING.md). Uncomment and edit to enable.
chips: How can Joule help? | Learn more
context: Conversation content coming soon. This template is ready for staging-sourced scripts.
timestamp: <strong>Today</strong>
---

@user
Hello, Joule.

@joule
Hello! I'm Joule, your AI assistant for SAP Ariba.

Conversation content for this prototype will be sourced from live Ariba staging patterns.
This canvas is ready — scripts will be added in the follow-up PR.

{{messagestrip type:Information
This is a placeholder conversation. Staging-sourced content is pending.
}}
`);
