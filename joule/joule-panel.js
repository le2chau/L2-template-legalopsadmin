/* Layer 1 — Joule host container mount
   Injects the out-of-tree fixed container and local iframe into <body>.
   Called on DOMContentLoaded; shown/hidden by _toggleJoulePanel in the controller. */
document.addEventListener("DOMContentLoaded", function () {
    var main = document.createElement("div");
    main.id = "joule-host-main";
    /* Explicit sapUiSizeCompact on the portal element — §1 three-layer pattern.
       Portal elements are appended to <body> after SAPUI5 hydration and do not
       inherit the compact class via cascade. */
    main.className = "sapUiSizeCompact";

    var container = document.createElement("div");
    container.id = "joule-host-container";

    var iframe = document.createElement("iframe");
    iframe.id = "joule-host-iframe";
    iframe.src = "joule/index.html";
    iframe.setAttribute("title", "Joule AI assistant");

    container.appendChild(iframe);
    main.appendChild(container);
    document.body.appendChild(main);

    /* postMessage listener — receives close requests from the iframe × button.
       Routes to the controller's onJoule (via firePress) so _bJouleOpen, the da/da-2
       icon, and aribaJouleActive all update through the single authoritative toggle path.
       Origin validated: same-origin only.

       Button ID resolved at runtime by querying DOM, then getting the SAPUI5 control via
       sap.ui.core.Element.closestTo(). This is robust against ID prefix changes and does
       not depend on a derived/guessed control ID. */
    window.addEventListener("message", function (oEvent) {
        if (oEvent.origin !== window.location.origin) { return; }
        if (!oEvent.data || oEvent.data.type !== "joule-close") { return; }
        try {
            /* Find the Joule ShellBar button by DOM attribute — stable regardless of
               SAPUI5-generated ID prefixes. */
            var domBtn = document.querySelector('[title="Joule"]');
            if (!domBtn) { return; }
            var oBtn = sap.ui.core.Element.closestTo(domBtn);
            if (oBtn && oBtn.firePress) { oBtn.firePress(); }
        } catch (e) {
            /* Fallback: direct DOM click if SAPUI5 API unavailable */
            var fallbackBtn = document.querySelector('[title="Joule"]');
            if (fallbackBtn) { fallbackBtn.click(); }
        }
    });
});
