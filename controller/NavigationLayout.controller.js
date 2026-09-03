sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/Popover",
    "sap/m/List",
    "sap/m/GroupHeaderListItem",
    "sap/m/StandardListItem",
    "sap/m/Button",
    "sap/m/IllustratedMessage",
    "sap/m/VBox",
    "sap/m/Avatar",
    "sap/m/Title",
    "sap/m/Text",
    "sap/m/Toolbar",
    "sap/m/ToolbarSpacer",
    "sap/m/Dialog",
    "sap/m/CustomListItem",
    "sap/ui/core/HTML",
    "sap/m/IllustrationPool",
    "sap/m/NotificationListGroup",
    "sap/m/NotificationListItem"
], function (Controller, MessageToast, Popover, List, GroupHeaderListItem, StandardListItem, Button, IllustratedMessage, VBox, MAvatar, TitleControl, MText, Toolbar, ToolbarSpacer, Dialog, CustomListItem, HTML, IllustrationPool, NotificationListGroup, NotificationListItem) {
    "use strict";

    var oTntRegistration = IllustrationPool.registerIllustrationSet({
        setFamily: "tnt",
        setURI: sap.ui.require.toUrl("sap/tnt/themes/base/illustrations")
    });

    var aRecentSearches = [
        "Contract summary", "Configure", "Requisition", "Requisition",
        "Manage Purchase Request Forms", "Laptop", "Sourcing", "Rece"
    ];

    var aNotifications = [
        {
            group: "Today",
            items: [
                {
                    title: "Your Request",
                    description: "Request for bottles is taking a long time to be approved. Follow up?",
                    authorName: "Product Name • Feature Name",
                    datetime: "11:13",
                    priority: "High",
                    unread: true
                }
            ]
        }
    ];

    var aApplications = [
        { icon: "sap-icon://account",                    title: "Administration Center",            subtitle: "salcp" },
        { icon: "sap-icon://grid",                       title: "Aggregation Workbench",            subtitle: "salcp" },
        { icon: "",                                      title: "Buying Profile",                   subtitle: "salcp" },
        { icon: "",                                      title: "Category Profile",                 subtitle: "salcp" },
        { icon: "sap-icon://grid",                       title: "Configure Common Services",        subtitle: "salcp" },
        { icon: "sap-icon://order-status",               title: "Contract Templates",               subtitle: "salcp" },
        { icon: "sap-icon://create-form",                title: "Contracts",                        subtitle: "salcp" },
        { icon: "sap-icon://grid",                       title: "Creation Jobs",                    subtitle: "salcp" },
        { icon: "sap-icon://grid",                       title: "Dashboards",                       subtitle: "salcp" },
        { icon: "sap-icon://grid",                       title: "Evaluation Templates - Suppliers", subtitle: "salcp" },
        { icon: "sap-icon://grid",                       title: "Event Templates",                  subtitle: "salcp" },
        { icon: "sap-icon://grid",                       title: "Invoice Capture Template",         subtitle: "salcp" },
        { icon: "sap-icon://grid",                       title: "Project Templates",                subtitle: "salcp" },
        { icon: "",                                      title: "Strategy and Plan",                subtitle: "salcp" },
        { icon: "sap-icon://grid",                       title: "Templates - Suppliers",            subtitle: "salcp" },
        { icon: "sap-icon://document",                   title: "Purchase Requests",                subtitle: "salcp" },
        { icon: "sap-icon://order-status",               title: "Purchase Orders",                  subtitle: "salcp" },
        { icon: "sap-icon://document",                   title: "Requisitions",                     subtitle: "salcp" },
        { icon: "sap-icon://geographic-bubble-chart",    title: "Sourcing",                         subtitle: "salcp" },
        { icon: "sap-icon://inventory",                  title: "Suppliers",                        subtitle: "salcp" },
        { icon: "sap-icon://money-bills",                title: "Invoicing",                        subtitle: "salcp" },
        { icon: "sap-icon://business-objects-experience",title: "Spend Insights",                   subtitle: "salcp" }
    ];

    return Controller.extend("com.sap.ariba.l2purchaserequisition.controller.NavigationLayout", {

        onInit: function () {
            var that = this;
            this._bPhoneNavOpen = false;

            if (oTntRegistration && oTntRegistration.then) {
                oTntRegistration.then(function () {
                    var oIM = that.byId("contentIllustration");
                    if (oIM) { oIM.invalidate(); }
                });
            }

            var oShellBar = this.byId("shellBar");

            var origAS = oShellBar._assignSearch.bind(oShellBar);
            oShellBar._assignSearch = function () {
                this.removeStyleClass("sapFShellBarFullSearch");
                if (this._getCurrentMediaRange() === "ExtraLargeDesktop") {
                    this.sCurrentRange = "LargeDesktop";
                    if (this._oManagedSearch) {
                        this._oManagedSearch.setIsOpen(false);
                        this._oManagedSearch._setMedia && this._oManagedSearch._setMedia("LargeDesktop");
                        if (this._oOverflowToolbar) {
                            this.addControlToCollection(this._oManagedSearch, this._oOverflowToolbar);
                        }
                    }
                    return;
                }
                origAS.call(this);
            };

            oShellBar.addEventDelegate({
                onAfterRendering: function () {
                    that._wrapBrandingButton();
                    that._attachSearchListeners();
                    that._suppressXXLBreakpoint();
                }
            });
        },

        onAfterRendering: function () {
            this._wrapBrandingButton();
            this._setSearchButtonTooltip();

            if (!this._bPhoneHandlersAttached) {
                this._bPhoneHandlersAttached = true;

                // Auto-close phone overlay when viewport grows back above S breakpoint
                sap.ui.Device.media.attachHandler(function (oParams) {
                    if (oParams.name !== "Phone" && this._bPhoneNavOpen) {
                        this._closePhoneNav();
                    }
                }.bind(this), null, sap.ui.Device.media.RANGESETS.SAP_STANDARD);
            }
        },

        _suppressXXLBreakpoint: function () {
            var oShellBar = this.byId("shellBar");
            var oRH = oShellBar && oShellBar._oResponsiveHandler;
            if (!oRH || oRH._xxlSuppressed) { return; }

            // Suppress _adaptSearch only at ExtraLargeDesktop. Blanking it entirely
            // was breaking overflow recalculation when search is open and the viewport
            // is resized at Desktop/Tablet ranges.
            var fnOrigAdaptSearch = oRH._adaptSearch ? oRH._adaptSearch.bind(oRH) : null;
            oRH._adaptSearch = function () {
                if (this.sCurrentRange === "ExtraLargeDesktop") { return; }
                fnOrigAdaptSearch && fnOrigAdaptSearch();
            };

            var fnOriginalHandleResize = oRH._handleResize;

            oRH._handleResize = function () {
                if (!this._oDomRef) { return; }
                var t = this._oControl.$();
                var e = Math.min(t.outerWidth(), 1919);
                var oMedia = sap.ui.require("sap/ui/Device").media;
                var a = oMedia.getCurrentRange(this._oControl._sRangeSet, e);
                var r;
                if (!a) { return; }
                if (this.sCurrentRange !== a.name) {
                    this._oControl._bOTBUpdateNeeded = true;
                    this.sCurrentRange = a.name;
                    this._oControl.sCurrentRange = a.name;
                    if (this._oControl._oManagedSearch && this._oControl._oOverflowToolbar) {
                        this._oControl.addControlToCollection(this._oControl._oManagedSearch, this._oControl._oOverflowToolbar);
                    }
                    this._oControl._oManagedSearch && this._oControl._oManagedSearch._setMedia(this.sCurrentRange);
                }
                if (a) {
                    r = this.sCurrentRange === "Phone";
                    t.toggleClass("sapFShellBarSizeExtraLargeDesktop", false);
                    t.toggleClass("sapFShellBarSizeLargeDesktop", this.sCurrentRange === "LargeDesktop");
                    t.toggleClass("sapFShellBarSizeDesktop", this.sCurrentRange === "Desktop");
                    t.toggleClass("sapFShellBarSizeTablet", this.sCurrentRange === "Tablet");
                    t.toggleClass("sapFShellBarSizePhone", r);
                }
                if (this._oControl._oManagedSearch && !this._oControl._oManagedSearch.getIsOpen()) {
                    this._oControl._bSearchPlaceHolder = false;
                }
                if (this.sCurrentRange !== "ExtraLargeDesktop" && this._oControl._oManagedSearch && this._oControl._oManagedSearch.getIsOpen()) {
                    if (!this._oControl._oManagedSearch._bUserOpened) {
                        this._oControl._oManagedSearch.setIsOpen(false);
                    } else {
                        setTimeout(this._adaptSearch.bind(this), 100);
                    }
                }
                this._oControl._bOTBUpdateNeeded && this._oControl.invalidate();
                if (this._iPreviousWidth === e) { return; }
                this._iPreviousWidth = e;
                if (!this._oControl._oNavButton && !this._oControl._oMenuButton && !this._oControl._oHomeIcon && !this._oControl._oMegaMenu && !this._oControl._oSecondTitle && !this._oControl._oManagedSearch && !this._oControl._oCopilot) { return; }
                if (r && !this.bWasInPhoneRange) {
                    this._transformToPhoneState();
                } else if (!r && this.bWasInPhoneRange) {
                    this._transformToRegularState();
                }
            };

            var oMedia = sap.ui.require("sap/ui/Device").media;
            var sRangeSet = oShellBar._sRangeSet;
            if (oMedia && sRangeSet && fnOriginalHandleResize) {
                oMedia.detachHandler(fnOriginalHandleResize, oRH, sRangeSet);
                oMedia.attachHandler(oRH._handleResize, oRH, sRangeSet);
            }

            oRH._xxlSuppressed = true;
            oRH._handleResize();
        },

        _wrapBrandingButton: function () {
            var oShellBarDom = this.byId("shellBar").getDomRef();
            if (!oShellBarDom) { return; }
            var oOLHB = oShellBarDom.querySelector(".sapFShellBarOLHB");
            if (!oOLHB || oOLHB.querySelector(".ariba-branding-btn")) { return; }

            var oLogo = oOLHB.querySelector("img.sapFShellBarHomeIcon");
            var oTitleDiv = oOLHB.querySelector(".sapFShellBarOAHB");
            if (!oLogo || !oTitleDiv) { return; }

            var oBtn = document.createElement("button");
            oBtn.className = "ariba-branding-btn";
            oBtn.setAttribute("type", "button");
            oBtn.setAttribute("aria-label", "Ariba home");

            oOLHB.insertBefore(oBtn, oLogo);
            oBtn.appendChild(oLogo);
            oBtn.appendChild(oTitleDiv);

            oLogo.removeAttribute("role");
            oLogo.setAttribute("tabindex", "-1");
            oLogo.setAttribute("aria-hidden", "true");

            oBtn.addEventListener("click", this.onBrandingPressed.bind(this));
        },

        // ---- Search Suggestion Popover ----

        _attachSearchListeners: function () {
            if (this._bSearchListenersAttached) { return; }
            var oShellBarDom = this.byId("shellBar").getDomRef();
            if (!oShellBarDom) { return; }
            var that = this;

            oShellBarDom.addEventListener("focusin", function (oE) {
                if (oE.target.classList.contains("sapMSFI")) {
                    that._updateSuggestPopover(oE.target.value || "");
                }
            });

            oShellBarDom.addEventListener("input", function (oE) {
                if (oE.target.classList.contains("sapMSFI")) {
                    that._updateSuggestPopover(oE.target.value || "");
                }
            });

            document.addEventListener("focusin", function (oE) {
                if (!that._oSuggestPopover || !that._oSuggestPopover.isOpen()) { return; }
                var oPopoverDom = that._oSuggestPopover.getDomRef();
                if (oPopoverDom && oPopoverDom.contains(oE.target)) { return; }
                if (oShellBarDom.contains(oE.target)) { return; }
                that._oSuggestPopover.close();
            }, true);

            this._bSearchListenersAttached = true;
        },

        _getSuggestPopover: function () {
            if (!this._oSuggestPopover) {
                var that = this;

                this._oSuggestList = new List({
                    mode: "None",
                    showSeparators: "Inner"
                });

                this._oNoResultsMsg = new IllustratedMessage({
                    illustrationType: "sapIllus-SearchEarth",
                    title: "We couldn't find a match",
                    description: "Try searching for something else",
                    illustrationSize: "Small",
                    visible: false
                });

                this._oShowAllBtn = new Button({
                    text: "Show All Search Results",
                    type: "Transparent",
                    width: "100%",
                    press: function () {
                        MessageToast.show("Show All Search Results — not yet implemented");
                        that._oSuggestPopover.close();
                    }
                });

                this._oSuggestPopover = new Popover({
                    showHeader: false,
                    placement: "Bottom",
                    showArrow: false,
                    contentWidth: "18rem",
                    content: [this._oSuggestList, this._oNoResultsMsg],
                    footer: this._oShowAllBtn,
                    afterOpen: function () {
                        var oInput = document.querySelector(".sapFShellBar .sapMSFI");
                        if (oInput) { oInput.focus(); }
                    }
                });

                this._oSuggestPopover.addStyleClass("aribaSuggestPopover sapUiSizeCompact");
                this.getView().addDependent(this._oSuggestPopover);
            }
            return this._oSuggestPopover;
        },

        _updateSuggestPopover: function (sQuery) {
            var oPopover = this._getSuggestPopover();

            if (!sQuery) {
                this._populateRecentSearches();
                this._oShowAllBtn.setVisible(false);
            } else {
                var aMatches = aApplications.filter(function (oApp) {
                    return oApp.title.toLowerCase().indexOf(sQuery.toLowerCase()) !== -1;
                });
                if (aMatches.length > 0) {
                    this._populateResults(aMatches);
                    this._oShowAllBtn.setVisible(true);
                } else {
                    this._populateNoResults();
                    this._oShowAllBtn.setVisible(false);
                }
            }

            if (!oPopover.isOpen()) {
                var oOpener = document.querySelector(".sapFShellBar .sapMSF");
                if (oOpener) { oPopover.openBy(oOpener); }
            }
        },

        _populateRecentSearches: function () {
            this._oSuggestList.destroyItems();
            this._oSuggestList.setVisible(true);
            this._oNoResultsMsg.setVisible(false);

            this._oSuggestList.addItem(new GroupHeaderListItem({ title: "Recent Searches" }));
            aRecentSearches.forEach(function (sSearch) {
                this._oSuggestList.addItem(new StandardListItem({
                    title: sSearch,
                    icon: "sap-icon://history",
                    iconInset: false
                }));
            }, this);
        },

        _populateResults: function (aResults) {
            this._oSuggestList.destroyItems();
            this._oSuggestList.setVisible(true);
            this._oNoResultsMsg.setVisible(false);

            this._oSuggestList.addItem(new GroupHeaderListItem({ title: "Applications" }));
            aResults.slice(0, 10).forEach(function (oApp) {
                var oItem = new StandardListItem({
                    title: oApp.title,
                    description: oApp.subtitle,
                    iconInset: false
                });
                if (oApp.icon) { oItem.setIcon(oApp.icon); }
                this._oSuggestList.addItem(oItem);
            }, this);
        },

        _populateNoResults: function () {
            this._oSuggestList.destroyItems();
            this._oSuggestList.setVisible(false);
            this._oNoResultsMsg.setVisible(true);
        },

        // ---- User Menu Popover ----

        _getUserMenuPopover: function () {
            if (!this._oUserMenuPopover) {
                var that = this;

                this._oUserInfoSection = new VBox({
                    alignItems: "Center"
                }).addStyleClass("aribaUserMenuHeader");

                this._oUserInfoSection.addItem(new MAvatar({
                    initials: "CE",
                    backgroundColor: "Accent6",
                    displaySize: "L",
                    showBorder: true
                }));
                this._oUserInfoSection.addItem(new TitleControl({
                    text: "Christopher Evans",
                    level: "H4"
                }));
                this._oUserInfoSection.addItem(new MText({
                    text: "christopher.evans@acme.com"
                }).addStyleClass("aribaUserMenuEmail"));

                var aItems = [
                    { key: "settings",     icon: "sap-icon://action-settings", title: "Settings" },
                    { key: "appFinder",    icon: "sap-icon://sys-find",         title: "App Finder" },
                    { key: "manageSite",   icon: "sap-icon://customize",        title: "Manage Site" },
                    { key: "appSettings",  icon: "sap-icon://user-settings",    title: "App Settings" },
                    { key: "legal",        icon: "sap-icon://official-service", title: "Legal Information" },
                    { key: "about",        icon: "sap-icon://hint",             title: "About" }
                ];

                this._oUserMenuList = new List({
                    mode: "None",
                    showSeparators: "None"
                });

                aItems.forEach(function (oItem) {
                    that._oUserMenuList.addItem(new StandardListItem({
                        icon: oItem.icon,
                        title: oItem.title,
                        type: "Active",
                        press: oItem.key === "settings" ? function () {
                            that._oUserMenuPopover.close();
                            that._openSettingsDialog();
                        } : function () {
                            MessageToast.show(oItem.title + " — not yet implemented");
                            that._oUserMenuPopover.close();
                        }
                    }));
                });

                this._oUserMenuPopover = new Popover({
                    showHeader: false,
                    placement: "Bottom",
                    showArrow: true,
                    contentWidth: "19rem",
                    content: [this._oUserInfoSection, this._oUserMenuList],
                    footer: new Toolbar({
                        content: [
                            new ToolbarSpacer(),
                            new Button({
                                text: "Sign Out",
                                icon: "sap-icon://log",
                                type: "Transparent",
                                press: function () {
                                    MessageToast.show("Sign Out — not yet implemented");
                                    that._oUserMenuPopover.close();
                                }
                            })
                        ]
                    })
                });

                this._oUserMenuPopover.addStyleClass("aribaUserMenuPopover sapUiSizeCompact");
                this.getView().addDependent(this._oUserMenuPopover);
            }
            return this._oUserMenuPopover;
        },

        onProfilePressed: function (oEvent) {
            var oPopover = this._getUserMenuPopover();
            var oAvatar = oEvent.getParameter("avatar");
            if (oPopover.isOpen()) {
                oPopover.close();
            } else {
                oPopover.openBy(oAvatar);
            }
        },

        // ---- Settings Dialog ----

        _openSettingsDialog: function () {
            if (!this._sCurrentTheme) {
                /* Seed only on first open — do NOT re-read after an Automatic save,
                   which would replace the row key with the framework's resolved real key. */
                this._sCurrentTheme = sap.ui.getCore().getConfiguration().getTheme();
            }
            this._sPendingTheme = this._sCurrentTheme;
            this._getSettingsDialog().open();
        },

        _applyTheme: function (sKey) {
            var sTheme = sKey;
            if (sKey === "sap_horizon_auto") {
                var bDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
                sTheme = bDark ? "sap_horizon_dark" : "sap_horizon";
            } else if (sKey === "sap_fiori_3_auto") {
                var bDark2 = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
                sTheme = bDark2 ? "sap_fiori_3_dark" : "sap_fiori_3";
            }
            /* Note: prefers-color-scheme is light/dark only — Automatic will not select HC variants
               under an OS high-contrast setting. Also no live listener for OS changes while the dialog
               is open. Both are acceptable prototype limitations; neither is a bug. */
            sap.ui.getCore().applyTheme(sTheme);
            this._sCurrentTheme = sKey; /* Store ROW key, not resolved key, so Automatic stays selected on reopen */
        },

        _switchSettingsPanel: function (sKey) {
            this._oSettingsContent.removeAllItems();
            this._oSettingsContent.addItem(this._oSettingsPanels[sKey]);
        },

        _getSettingsDialog: function () {
            if (!this._oSettingsDialog) {
                var that = this;

                var aNavItems = [
                    { key: "userAccount",    icon: "sap-icon://account",       title: "User Account" },
                    { key: "appearance",     icon: "sap-icon://palette",       title: "Appearance" },
                    { key: "languageRegion", icon: "sap-icon://world",         title: "Language and Region" },
                    { key: "notifications",  icon: "sap-icon://bell",          title: "Notifications" },
                    { key: "userDefaults",   icon: "sap-icon://user-settings", title: "User Defaults" },
                    { key: "cookieSettings", icon: "sap-icon://key",           title: "Cookie Settings" },
                    { key: "privacy",        icon: "sap-icon://shield",        title: "Privacy" }
                ];

                this._oSettingsPanels = {};

                var oUAPanel = new VBox({ width: "100%" });
                oUAPanel.addItem(new TitleControl({ text: "User Account", level: "H4" }).addStyleClass("aribaSettingsPanelTitle"));
                var oUABody = new VBox({ width: "100%" }).addStyleClass("aribaSettingsPanelBody");
                var oAvatarRow = new sap.m.FlexBox({ alignItems: "Center" }).addStyleClass("aribaSettingsAvatarRow");
                oAvatarRow.addItem(new MAvatar({ icon: "sap-icon://account", displaySize: "L" }));
                oAvatarRow.addItem(new TitleControl({ text: "Christopher Evans", level: "H5" }).addStyleClass("aribaSettingsUserName"));
                oUABody.addItem(oAvatarRow);
                [
                    ["Name",    "Christopher Evans"],
                    ["User ID", "CE123456789"],
                    ["Email",   "christopher.evans@acme.com"],
                    ["Server",  "acme.ariba.com"]
                ].forEach(function (aPair) {
                    var oRow = new sap.m.FlexBox({ alignItems: "Center" }).addStyleClass("aribaSettingsFormRow");
                    oRow.addItem(new MText({ text: aPair[0] + ":" }).addStyleClass("aribaSettingsFormLabel"));
                    oRow.addItem(new MText({ text: aPair[1] }));
                    oUABody.addItem(oRow);
                });
                oUAPanel.addItem(oUABody);
                this._oSettingsPanels["userAccount"] = oUAPanel;

                var oAppPanel = new VBox({ width: "100%" });
                oAppPanel.addItem(new TitleControl({ text: "Appearance", level: "H4" }).addStyleClass("aribaSettingsPanelTitle"));

                var aThemeGroups = [
                    {
                        label: "SAP Horizon (Set)",
                        themes: [
                            { key: "sap_horizon_auto", label: "Automatic (based on your operating system settings)", svgFile: "horizon_automatic.svg" },
                            { key: "sap_horizon",      label: "SAP Morning Horizon",                svgFile: "sap_horizon.svg" },
                            { key: "sap_horizon_dark", label: "SAP Evening Horizon",               svgFile: "sap_horizon_dark.svg" },
                            { key: "sap_horizon_hcw",  label: "SAP High Contrast White (Horizon)", svgFile: "sap_horizon_hcw.svg" },
                            { key: "sap_horizon_hcb",  label: "SAP High Contrast Black (Horizon)", svgFile: "sap_horizon_hcb.svg" }
                        ]
                    },
                    {
                        label: "SAP Quartz (Set)",
                        themes: [
                            { key: "sap_fiori_3_auto",  label: "Automatic (based on your operating system settings)", svgFile: "quartz_automatic.svg" },
                            { key: "sap_fiori_3",      label: "SAP Quartz Light",                   svgFile: "sap_fiori_3.svg" },
                            { key: "sap_fiori_3_dark",  label: "SAP Quartz Dark",                    svgFile: "sap_fiori_3_dark.svg" },
                            { key: "sap_fiori_3_hcw",   label: "SAP High Contrast White (Quartz)",   svgFile: "sap_fiori_3_hcw.svg" },
                            { key: "sap_fiori_3_hcb",   label: "SAP High Contrast Black (Quartz)",   svgFile: "sap_fiori_3_hcb.svg" }
                        ]
                    }
                ];

                that._oThemeList = new List({
                    mode: "SingleSelectMaster",
                    showSeparators: "Inner",
                    selectionChange: function (oE) {
                        var sKey = oE.getParameter("listItem").data("themeKey");
                        that._sPendingTheme = sKey;
                        /* No applyTheme here — theme applies only on Save */
                    }
                });

                aThemeGroups.forEach(function (oGroup) {
                    that._oThemeList.addItem(new GroupHeaderListItem({ title: oGroup.label }));
                    oGroup.themes.forEach(function (oTheme) {
                        var oRow = new sap.m.FlexBox({ alignItems: "Center" }).addStyleClass("aribaThemeRow");

                        if (oTheme.svgFile) {
                            /* Named themed row: S-size square Avatar wrapping same vendored SVG (PR #53).
                               displayShape "Square" preserves the rounded-square swatch; "Circle" would clip preview art. */
                            oRow.addItem(new MAvatar({
                                displaySize: "S",
                                displayShape: "Square",
                                src: "../assets/theme-avatars/" + oTheme.svgFile
                            }).addStyleClass("aribaThemeAvatar"));
                        }

                        oRow.addItem(new MText({ text: oTheme.label }));

                        var oItem = new CustomListItem({ content: [oRow] });
                        oItem.data("themeKey", oTheme.key);
                        that._oThemeList.addItem(oItem);

                        if (oTheme.key === that._sCurrentTheme) {
                            that._oThemeList.setSelectedItem(oItem);
                        }
                    });
                });

                var oAppBody = new VBox({ width: "100%" }).addStyleClass("aribaSettingsPanelBody");
                oAppBody.addItem(that._oThemeList);
                oAppPanel.addItem(oAppBody);
                this._oSettingsPanels["appearance"] = oAppPanel;

                aNavItems.slice(1).forEach(function (oItem) {
                    if (oItem.key === "appearance") { return; }
                    var oPanel = new VBox({ width: "100%" });
                    oPanel.addItem(new TitleControl({ text: oItem.title, level: "H4" }).addStyleClass("aribaSettingsPanelTitle"));
                    var oPlaceholderBody = new VBox({ width: "100%" }).addStyleClass("aribaSettingsPanelBody");
                    oPlaceholderBody.addItem(new MText({ text: oItem.title + " — not yet implemented" }).addStyleClass("aribaSettingsPlaceholder"));
                    oPanel.addItem(oPlaceholderBody);
                    that._oSettingsPanels[oItem.key] = oPanel;
                });

                this._oSettingsContent = new VBox({ width: "100%" }).addStyleClass("aribaSettingsContent");
                this._oSettingsContent.addItem(this._oSettingsPanels["userAccount"]);

                this._oSettingsNavList = new List({
                    mode: "SingleSelectMaster",
                    showSeparators: "All",
                    itemPress: function (oE) {
                        var sKey = oE.getParameter("listItem").data("key");
                        that._switchSettingsPanel(sKey);
                    }
                }).addStyleClass("aribaSettingsNav");

                aNavItems.forEach(function (oItem) {
                    var oLI = new StandardListItem({ icon: oItem.icon, title: oItem.title, type: "Active" });
                    oLI.data("key", oItem.key);
                    that._oSettingsNavList.addItem(oLI);
                });
                this._oSettingsNavList.setSelectedItem(this._oSettingsNavList.getItems()[0]);

                var oLeftPanel = new VBox().addStyleClass("aribaSettingsLeft");
                oLeftPanel.addItem(new TitleControl({ text: "Settings", level: "H4" }).addStyleClass("aribaSettingsLeftTitle"));

                oLeftPanel.addItem(this._oSettingsNavList);

                var oLayout = new sap.m.FlexBox({ width: "100%", height: "100%" }).addStyleClass("aribaSettingsLayout");
                oLayout.addItem(oLeftPanel);
                oLayout.addItem(this._oSettingsContent);

                this._oSettingsDialog = new Dialog({
                    showHeader: false,
                    contentWidth: "60rem",
                    contentHeight: "42.5rem",
                    verticalScrolling: false,
                    content: [oLayout],
                    footer: new Toolbar({
                        content: [
                            new ToolbarSpacer(),
                            new Button({
                                text: "Cancel",
                                type: "Transparent",
                                press: function () {
                                    /* Cancel: discard pending selection, restore list visual selection */
                                    that._sPendingTheme = that._sCurrentTheme;
                                    that._oThemeList.getItems().forEach(function (oItem) {
                                        if (oItem.data && oItem.data("themeKey") === that._sCurrentTheme) {
                                            that._oThemeList.setSelectedItem(oItem);
                                        }
                                    });
                                    that._oSettingsDialog.close();
                                }
                            }),
                            new Button({
                                text: "Save",
                                type: "Emphasized",
                                press: function () {
                                    that._applyTheme(that._sPendingTheme);
                                    that._oSettingsDialog.close();
                                }
                            })
                        ]
                    })
                });
                this._oSettingsDialog.addStyleClass("aribaSettingsDialog sapUiSizeCompact");
                this.getView().addDependent(this._oSettingsDialog);
            }
            return this._oSettingsDialog;
        },

        // ---- Handlers ----

        HOME_URL: "https://pages.github.tools.sap/ariba-ux-framework-platform/ux-prototypes/prototypes/AribaHome-SAL/",

        onNavBack: function () {
            window.history.back();
        },

        onBrandingPressed: function () {
            window.location.href = this.HOME_URL;
        },

        onHomeNavItem: function () {
            window.location.href = this.HOME_URL;
        },

        onSearch: function (oEvent) {
            if (this._oSuggestPopover && this._oSuggestPopover.isOpen()) {
                this._oSuggestPopover.close();
            }
            var sQuery = oEvent.getParameter("query") || "";
            if (sQuery) {
                MessageToast.show("Search: " + sQuery + " — not yet implemented");
            }
        },

        onJoule: function () {
            this._bJouleOpen = !this._bJouleOpen;
            var oBtn = this.byId("jouleBtn");
            if (this._bJouleOpen) {
                oBtn.setIcon("sap-icon://da-2");
                oBtn.addStyleClass("aribaJouleActive");
            } else {
                oBtn.setIcon("sap-icon://da");
                oBtn.removeStyleClass("aribaJouleActive");
            }
            this._toggleJoulePanel(this._bJouleOpen);
        },
        /* §9 carve-out — shows/hides the out-of-tree Joule container injected by
           joule/joule-panel.js. Touches only the DOM element; does not interact with
           _suppressXXLBreakpoint, _wrapBrandingButton, _oManagedSearch, or
           _oResponsiveHandler, and does not access any sap.tnt.ToolPage slot.
           On open: reads the host SAPUI5 theme and passes it to the iframe src so the
           panel loads in the same theme as the shell (load-time tracking). */
        _toggleJoulePanel: function (bOpen) {
            var oEl = document.getElementById("joule-host-main");
            var oIframe = document.getElementById("joule-host-iframe");
            if (!oEl) { return; }
            if (bOpen) {
                // Read current host theme — getConfiguration().getTheme() confirmed for 1.148.1
                var sHostTheme = sap.ui.getCore().getConfiguration().getTheme();
                // Whitelist to the four valid Horizon themes; default to Morning
                var aValid = ["sap_horizon", "sap_horizon_dark", "sap_horizon_hcw", "sap_horizon_hcb"];
                var sTheme = aValid.indexOf(sHostTheme) >= 0 ? sHostTheme : "sap_horizon";
                if (oIframe) {
                    oIframe.src = "joule/index.html?theme=" + encodeURIComponent(sTheme) + "&conv=conversation-office-chairs";
                }
                oEl.style.display = "block";
            } else {
                oEl.style.display = "none";
            }
        },

        onNotifications: function (oEvent) {
            var oPopover = this._getNotificationsPopover();
            if (oPopover.isOpen()) {
                oPopover.close();
            } else {
                oPopover.openBy(oEvent.getSource());
            }
        },

        _getNotificationsPopover: function () {
            if (!this._oNotificationsPopover) {
                var that = this;

                var oHeaderBar = new Toolbar({
                    content: [
                        new TitleControl({ text: "Notifications", level: "H5" }),
                        new ToolbarSpacer(),
                        new Button({ text: "Clear All", type: "Transparent", press: function () {
                            that._oNotifList.destroyItems();
                        }}),
                        new Button({ icon: "sap-icon://sort", type: "Transparent", tooltip: "Sort" }),
                        new Button({ icon: "sap-icon://action-settings", type: "Transparent", tooltip: "Notification Settings" })
                    ]
                }).addStyleClass("aribaNotificationsHeader");

                this._oNotifList = new List({
                    mode: "None",
                    showSeparators: "None",
                    noData: new IllustratedMessage({
                        illustrationType: "sapIllus-NoNotifications",
                        illustrationSize: "Dialog",
                        title: "You've no notifications",
                        description: "Check back again later."
                    })
                });

                aNotifications.forEach(function (oGroupData) {
                    var oGroup = new NotificationListGroup({ title: oGroupData.group, showCloseButton: false });
                    oGroupData.items.forEach(function (oItemData) {
                        var oItem = new NotificationListItem({
                            title: oItemData.title,
                            description: oItemData.description,
                            authorName: oItemData.authorName,
                            datetime: oItemData.datetime,
                            priority: oItemData.priority,
                            unread: oItemData.unread,
                            showCloseButton: true,
                            truncate: true,
                            close: function () {
                                oGroup.removeItem(oItem);
                                if (oGroup.getItems().length === 0) {
                                    that._oNotifList.removeItem(oGroup);
                                }
                                that._updateBellBadge();
                            }
                        });
                        oGroup.addItem(oItem);
                    });
                    that._oNotifList.addItem(oGroup);
                });

                this._oNotificationsPopover = new Popover({
                    showHeader: true,
                    customHeader: oHeaderBar,
                    placement: "Bottom",
                    showArrow: true,
                    contentWidth: "27rem",
                    contentMaxHeight: "40rem",
                    content: [this._oNotifList]
                });
                this._oNotificationsPopover.addStyleClass("aribaNotificationsPopover sapUiSizeCompact");
                this.getView().addDependent(this._oNotificationsPopover);
            }
            return this._oNotificationsPopover;
        },

        _updateBellBadge: function () {
            var iTotalItems = this._oNotifList.getItems().reduce(function (iSum, oGroup) {
                return iSum + (oGroup.getItems ? oGroup.getItems().length : 0);
            }, 0);

            var oBellBtn = this.byId("shellBar").getAdditionalContent().find(function (o) {
                return o.getIcon && o.getIcon() === "sap-icon://bell";
            });
            if (!oBellBtn) { return; }

            var oBadge = oBellBtn.getCustomData().find(function (d) {
                return d.isA("sap.m.BadgeCustomData");
            });
            if (oBadge) {
                oBadge.setVisible(iTotalItems > 0);
                if (iTotalItems > 0) { oBadge.setValue(String(iTotalItems)); }
            }
        },

        onFeedback: function () {
            MessageToast.show("Feedback — not yet implemented");
        },

        onHelp: function () {
            window.open("https://help.ariba.com/index.html#sal-login", "_blank", "noopener,noreferrer");
        },

        onToggleSideNav: function () {
            var sRange = sap.ui.Device.media.getCurrentRange(sap.ui.Device.media.RANGESETS.SAP_STANDARD).name;
            if (sRange === "Phone") {
                if (this._bPhoneNavOpen) {
                    this._closePhoneNav();
                } else {
                    this._bPhoneNavOpen = true;
                    this.byId("toolPage").addStyleClass("aribaPhoneNavOpen");
                }
            } else {
                var oToolPage = this.byId("toolPage");
                oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
            }
        },

        _closePhoneNav: function () {
            this._bPhoneNavOpen = false;
            this.byId("toolPage").removeStyleClass("aribaPhoneNavOpen");
        },

        _setSearchButtonTooltip: function () {
            var oShellBar = this.byId("shellBar");
            // The search toggle button is the _searchButton aggregation of the
            // ShellBar's internal sap.f.shellBar.Search control (_oManagedSearch).
            // Consistent with existing private-API usage in this controller.
            var oSearch = oShellBar._oManagedSearch;
            var oBtn = oSearch && oSearch.getAggregation("_searchButton");
            if (oBtn && oBtn.setTooltip) {
                oBtn.setTooltip("Open Search");
                return;
            }
            // Fallback: set title attribute on the DOM node in case the private
            // aggregation path changes across SAPUI5 patch versions.
            var oDom = oShellBar.getDomRef();
            if (!oDom) { return; }
            var oSearchBtnDom = oDom.querySelector(".sapFShellBarSearchWrap > button[title]");
            if (oSearchBtnDom) {
                oSearchBtnDom.setAttribute("title", "Open Search");
            }
        }
    });
});
