# Joule welcome gradient-mesh layer images — provenance

The four `joule-mesh-{a,b,c,d}.png` files are the pre-blurred gradient-mesh layers
used behind the Joule welcome/splash view (Sapphire).

**Source:** captured from the live SAP Joule webclient, cross-origin iframe
`cai-webclient-iframe` (host `sapit-home-prod-004.eu10.sapdas.cloud.sap`), served
under `sap/resources/webclient/`. The live webclient injects them as
`<img class="meshLayerImage layer-{a..d}">` inside `.dasSplashScreen .meshLayerContainer`.

**Captured:** 2026-07-16 (one.int.sap, logged-in session). Native size 1600×347 px.

**Original hashed filenames → semantic names:**

| Layer | Original filename | Semantic name | Tint |
|---|---|---|---|
| a | `6d31a61406c72c03dc15b2bab414cccc.png` | `joule-mesh-a.png` | pale purple |
| b | `ff6dfa5d12bb97311c2ecc977f703fdf.png` | `joule-mesh-b.png` | pale blue |
| c | `6e85eb43630885856326cb4cf227d026.png` | `joule-mesh-c.png` | pink / magenta |
| d | `5c1f3b5c7cca9c51d8b1eb39d3d28d14.png` | `joule-mesh-d.png` | faint lavender |

Palette (Sapphire gradient family) is baked into the images — no CSS color token applies.
The mesh is shown in `sap_horizon` + `sap_horizon_dark` and hidden in the two HC themes.
