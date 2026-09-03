# Joule Panel — Prototype Shell

This folder is a self-contained Joule conversation prototype: a floating AI-assistant
panel that plays scripted, Horizon-themed conversation demos inside the Ariba
prototype shell. It is used to prototype and demo Joule interactions for procurement
workflows without building a production conversational system.

> **This engine is forked from the [DNA Joule Conversation Prototype Kit](https://github.tools.sap/DNA-Design/DNA-Joule-Conversation-Prototype-Kit)**
> (DNA-Design org, GitHub Enterprise). The fork shares the DNA kit's conversation
> scripting format (a domain-specific language, or DSL) and core engine. Its **exact divergence point from upstream is not recorded** —
> there is no version tag, fork date, or commit reference in either codebase to anchor
> it. The fork has also modified several engine behaviors for Ariba (Horizon theming,
> host integration, a few bug fixes). **Where the DNA documentation and the Ariba docs
> disagree, the Ariba docs govern for this fork.** See [`ARIBA-AUTHORING.md`](./ARIBA-AUTHORING.md) for the
> full list of deltas.

---

## What's here

```
joule/
├── index.html          Engine page — runs inside the host iframe
├── src/joule.js        Conversation engine (DSL parser + playback + renderers)
├── joule-panel.js      Layer 1 host mount — injects the fixed container + iframe
├── joule-panel.css     Host container styling
├── assets/             Engine assets (icon font, Joule avatar)
├── conversations/      Conversation scripts (loaded by ?conv=<name>)
│   ├── conversation.js                  Blank template + DSL syntax comments
│   └── conversation-office-chairs.js    Worked sample (see authoring guide)
├── README.md           This file — orientation
└── ARIBA-AUTHORING.md  How to author conversations; component reference; deltas
```

---

## Architecture — two layers, two owners

The Joule panel is deliberately **not** a SAPUI5 control. It is a two-layer
structure that mirrors how the real Ariba product mounts Joule: a thin host
container owned by the Ariba shell, hosting an isolated engine in an iframe.

**Layer 1 — Host container (Ariba shell).** `joule-panel.js` injects an out-of-tree
`position: fixed` container (`#joule-host-main` → `#joule-host-container` →
`#joule-host-iframe`) into the page `<body>` on load. The host controller's
`_toggleJoulePanel` shows/hides it; `onJoule` (wired to the ShellBar Joule button)
drives the open/closed state, the button's active styling, and its icon. This layer
is small and fully measurable — it is the layer the Ariba shell genuinely owns, in contrast to
Layer 2 (the forked engine code).

**Layer 2 — Engine (iframe).** `index.html` + `src/joule.js` run the forked DNA
engine inside the iframe. The iframe loads `joule/index.html`; the engine parses a
conversation script and plays it back. Isolating the engine in an iframe keeps it
self-contained and lets it run independently of the host page's SAPUI5 runtime.

**Host ↔ engine communication:**

- **Theme** flows host → engine. `_toggleJoulePanel` reads the host's current SAPUI5
  theme and rebuilds `iframe.src` as `joule/index.html?theme=<theme>&conv=conversation-office-chairs`.
  The engine reads the `?theme=` param, validates it against an allowlist, and applies it (falling back to
  `sap_horizon`). All four Horizon themes are supported.
- **Close** flows engine → host. The panel's × button posts
  `{ type: 'joule-close' }` to the parent frame. `joule-panel.js` listens (same-origin
  validated), resolves the ShellBar Joule button from the DOM, and fires its press —
  so closing routes through the same authoritative toggle path as the button itself.
- **`_toggleJoulePanel` is the authoritative `iframe.src` setter.** It rebuilds the
  full src on every open, overwriting `joule-panel.js`'s injection-time value. To
  change the default conversation or theme handoff, edit `_toggleJoulePanel` (the
  per-prototype copies of the method), not `joule-panel.js`.

---

## Running a conversation

Conversations load by filename from `conversations/` via a URL parameter on the
engine page:

```
joule/index.html?conv=conversation-office-chairs
```

With no `?conv=` parameter, the engine loads `conversation.js` (the blank template).
In normal use the panel is opened from the ShellBar Joule button, which mounts the
iframe at its default conversation; the `?conv=` form is for previewing a specific
script directly.

See [**`ARIBA-AUTHORING.md`**](./ARIBA-AUTHORING.md) for how to write a conversation, the full component
reference, and the worked office-chairs sample.

---

## Propagation note

This `joule/` folder is **canonical in `NavigationLayout/`**. The other four ShellBar
prototypes (AribaHome-SAL, L2, L3, SearchResultsPage) carry their own per-prototype
copies of the panel so each prototype stays self-contained and forkable. The
authoring docs ship only here; `conversation-office-chairs.js` is propagated to all
five as the standing default conversation — edit it here and replicate to all 5 in
the same commit (the CLAUDE.md §10 sync rule). (The
per-prototype duplication is a known maintenance cost; the long-term fix is a
shared-shell extraction.)

---

## For the core DSL

The conversation DSL (frontmatter, `@user`/`@joule` turns, the documented components,
background switching, inline formatting) is documented in the
[DNA Joule Conversation Prototype Kit README](https://github.tools.sap/DNA-Design/DNA-Joule-Conversation-Prototype-Kit),
subject to the precedence note above. The Ariba-specific deltas, the components the
DNA README leaves undocumented, and the things to watch out for are in [`ARIBA-AUTHORING.md`](./ARIBA-AUTHORING.md).
