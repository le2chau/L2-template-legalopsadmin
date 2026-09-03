sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/ResizeHandler",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Sorter",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/m/Token",
    "sap/ui/unified/FileUploader"
], function (Controller, ResizeHandler, Filter, FilterOperator, JSONModel, Sorter, MessageToast, Fragment, Token, FileUploader) {
    "use strict";

    // Starts-with, case-insensitive suggestion filter. Replaces the sap.m default ("contains").
    function _startsWithFilter(sValue, oItem) {
        return oItem.getText().toLowerCase().indexOf(sValue.toLowerCase()) === 0;
    }

    var L3_URL = "http://localhost:3031/";

    // Maps column header label text → mock data binding path used for sorting
    var _mColSortPaths = {
        "PR Title":  "title",
        "Status":    "status",
        "Supplier":  "supplier",
        "Requester": "requester",
        "Amount":    "amountValue",
        "Need By":   "needBy"
    };

    return Controller.extend("com.sap.ariba.l2purchaserequisition.controller.PurchaseRequisitionList", {

        onInit: function () {
            var oTable = this.byId("prTable");
            oTable.setHiddenInPopin([]);
            oTable.setSticky(["ColumnHeaders"]);
            oTable.addEventDelegate({ onclick: this._onTableHeaderClick.bind(this) }, this);
            setTimeout(this._syncAndRegisterResize.bind(this, 0), 0);
            setTimeout(this._selectNavItem.bind(this), 0);

            this.byId("governingLawFilter").setFilterFunction(_startsWithFilter);

            // Per-column settings state (keyed by column header label text)
            this._oColState = {};

            // colSettings model: drives the Column Settings popover bindings
            this.getView().setModel(
                new JSONModel({
                    columnLabel: "",
                    columnWidthPx: 160,
                    "sort_PR Title":   "none",
                    "sort_Status":     "none",
                    "sort_Supplier":   "none",
                    "sort_Requester":  "none",
                    "group_PR Title":  false,
                    "group_Status":    false,
                    "group_Supplier":  false,
                    "group_Requester": false
                }),
                "colSettings"
            );
        },

        _selectNavItem: function () {
            var oNavList, oItem;
            sap.ui.core.Element.registry.forEach(function (el) {
                if (!oNavList && el.isA && el.isA("sap.tnt.NavigationList")) {
                    oNavList = el;
                }
                if (!oItem && el.isA && el.isA("sap.tnt.NavigationListItem") && el.getText && el.getText() === "Legal Agreement Templates") {
                    oItem = el;
                }
            });
            if (oNavList && oItem) {
                oNavList.setSelectedItem(oItem);
            }
        },

        // Retries until the table DOM exists (async root view may render later than
        // the onInit tick). Sets contextual width to the DynamicPage content area so
        // autoPopinMode uses the true available width instead of the ToolPage wrapper.
        _syncAndRegisterResize: function (nAttempt) {
            var oTable = this.byId("prTable");
            var oTableDom = oTable && oTable.getDomRef();
            if (!oTableDom && nAttempt < 10) {
                setTimeout(this._syncAndRegisterResize.bind(this, nAttempt + 1), 50);
                return;
            }
            this._syncContextualWidth();
            var oContentEl = oTableDom && oTableDom.closest(".sapFDynamicPageContent");
            if (oContentEl && !this._sResizeHandlerId) {
                this._sResizeHandlerId = ResizeHandler.register(
                    oContentEl,
                    this._syncContextualWidth.bind(this)
                );
            }
        },

        onExit: function () {
            if (this._sResizeHandlerId) {
                ResizeHandler.deregister(this._sResizeHandlerId);
            }
            if (this._oAdaptFiltersDialog) {
                this._oAdaptFiltersDialog.destroy();
            }
            if (this._oColSettingsPopover) {
                this._oColSettingsPopover.destroy();
            }
            if (this._oCreateFromDocDialog) {
                this._oCreateFromDocDialog.destroy();
            }
        },

        _syncContextualWidth: function () {
            var oTable = this.byId("prTable");
            if (!oTable) { return; }
            var oTableDom = oTable.getDomRef();
            var oContentEl = oTableDom && oTableDom.closest(".sapFDynamicPageContent");
            if (!oContentEl) { return; }
            var nWidth = Math.floor(oContentEl.getBoundingClientRect().width);
            if (nWidth > 0) {
                oTable.setContextualWidth(nWidth + "px");
            }
        },

        // ---- Filtering ----

        // aExcludeKeys (optional): requester keys to treat as already-removed this tick — used
        // by onRequesterTokenUpdate, where tokenUpdate fires before the token aggregation mutates.
        _applyFilters: function (aExcludeKeys) {
            var oTable = this.byId("prTable");
            var oBinding = oTable.getBinding("items");
            var aFilters = [];

            var sSearch = this.byId("searchField").getValue();
            if (sSearch) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("title", FilterOperator.Contains, sSearch),
                        new Filter("id", FilterOperator.Contains, sSearch)
                    ],
                    and: false
                }));
            }

            // Status: MultiComboBox -> OR across selected keys. getSelectedKeys() inside
            // selectionChange reflects the just-toggled item (verified 1.148.1: the
            // selectedItems association updates before selectionChange fires).
            var aStatusKeys = this.byId("statusFilter").getSelectedKeys();
            if (aStatusKeys.length) {
                aFilters.push(new Filter({
                    filters: aStatusKeys.map(function (sKey) {
                        return new Filter("status", FilterOperator.EQ, sKey);
                    }),
                    and: false
                }));
            }

            // Contract Type: MultiComboBox -> OR across selected keys
            var aContractTypeKeys = this.byId("contractTypeFilter").getSelectedKeys();
            if (aContractTypeKeys.length) {
                aFilters.push(new Filter({
                    filters: aContractTypeKeys.map(function (sKey) {
                        return new Filter("contractType", FilterOperator.EQ, sKey);
                    }),
                    and: false
                }));
            }

            // Governing Law: MultiInput -> OR across token keys. aExcludeKeys drops keys
            // for tokens being removed this event (tokenUpdate fires before the aggregation
            // mutates — verified 1.148.1 — so getTokens() still includes them here).
            var aGovLawKeys = this.byId("governingLawFilter").getTokens().map(function (oToken) {
                return oToken.getKey();
            });
            if (aExcludeKeys && aExcludeKeys.length) {
                aGovLawKeys = aGovLawKeys.filter(function (sKey) { return aExcludeKeys.indexOf(sKey) === -1; });
            }
            if (aGovLawKeys.length) {
                aFilters.push(new Filter({
                    filters: aGovLawKeys.map(function (sKey) {
                        return new Filter("governingLaw", FilterOperator.EQ, sKey);
                    }),
                    and: false
                }));
            }

            oBinding.filter(aFilters.length > 0 ? new Filter({ filters: aFilters, and: true }) : []);
        },

        onSearch: function () {
            this._applyFilters();
        },

        // ---- Governing Law token removal ----

        onGoverningLawTokenUpdate: function (oEvent) {
            var aRemoved = (oEvent.getParameter("removedTokens") || []).map(function (oToken) {
                return oToken.getKey();
            });
            this._applyFilters(aRemoved.length ? aRemoved : undefined);
        },

        onAdaptFilters: function () {
            if (!this._oAdaptFiltersDialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "com.sap.ariba.l2purchaserequisition.view.AdaptFiltersDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._oAdaptFiltersDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.open();
                }.bind(this));
            } else {
                this._oAdaptFiltersDialog.open();
            }
        },

        onToggleFilterVisibility: function (oEvent) {
            var oBtn = oEvent.getSource();
            var bNowVisible = oBtn.getPressed();

            // Walk: eye ToggleButton → right HBox → outer HBox → left HBox → ComboBox
            var oComboBox = oBtn.getParent().getParent().getItems()[0].getItems()[1];

            oBtn.setIcon(bNowVisible ? "sap-icon://show" : "sap-icon://hide");

            if (!bNowVisible) {
                oComboBox.setValueState("Warning");
                oComboBox.setValueStateText(
                    oComboBox.getValue() ? "" : "If hidden and empty, this filter will be removed."
                );
            } else {
                oComboBox.setValueState("None");
                oComboBox.setValueStateText("");
            }
        },

        onAdaptFiltersReset: function () {
            MessageToast.show("Filters reset");
        },

        onAdaptFiltersOk: function () {
            this._oAdaptFiltersDialog.close();
        },

        onAdaptFiltersFilter: function () {
            this._oAdaptFiltersDialog.close();
            MessageToast.show("Filters applied");
        },

        onAdaptFiltersCancel: function () {
            this._oAdaptFiltersDialog.close();
        },

        // ---- Show/Hide Details (3-way: compact / show all / per-row) ----

        onShowHideDetails: function (oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            var oTable = this.byId("prTable");
            if (sKey === "dtshow") {
                oTable.setHiddenInPopin([]);
            } else {
                oTable.setHiddenInPopin(["None"]);
            }
        },

        // ---- Column Settings Popover ----

        _onTableHeaderClick: function (oEvent) {
            var oTH = oEvent.target.closest("th");
            if (!oTH || !oTH.parentElement ||
                !oTH.parentElement.classList.contains("sapMListTblHeader")) { return; }
            var oTable = this.byId("prTable");
            var aColumns = oTable.getColumns();
            for (var i = 0; i < aColumns.length; i++) {
                if (aColumns[i].getDomRef() === oTH) {
                    this._openColSettings(aColumns[i]);
                    return;
                }
            }
        },

        _openColSettings: function (oColumn) {
            var oTable = this.byId("prTable");

            var sLabel = oColumn.getHeader().getText();

            // Initialise per-column state on first open, reading the rendered width from DOM
            if (!this._oColState[sLabel]) {
                var oColDom = oColumn.getDomRef();
                var nWidthPx = oColDom ? Math.round(oColDom.getBoundingClientRect().width) : 160;
                this._oColState[sLabel] = { sortDir: "none", groupBy: false, columnWidthPx: nWidthPx };
            }

            var _aPopoverCols = ["PR Title", "Status", "Requester", "Supplier"];
            var oData = { columnLabel: sLabel, columnWidthPx: this._oColState[sLabel].columnWidthPx };
            _aPopoverCols.forEach(function (sCol) {
                var oS = this._oColState[sCol] || { sortDir: "none", groupBy: false };
                oData["sort_" + sCol]  = oS.sortDir;
                oData["group_" + sCol] = oS.groupBy;
            }.bind(this));
            this.getView().getModel("colSettings").setData(oData);

            var oColDomRef = oColumn.getDomRef();

            if (!this._oColSettingsPopover) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "com.sap.ariba.l2purchaserequisition.view.ColumnSettingsPopover",
                    controller: this
                }).then(function (oPopover) {
                    this._oColSettingsPopover = oPopover;
                    this.getView().addDependent(oPopover);
                    oPopover.openBy(oColDomRef);
                }.bind(this));
            } else {
                this._oColSettingsPopover.openBy(oColDomRef);
            }
        },

        onColSettingsSortChange: function (oEvent) {
            var sKey   = oEvent.getParameter("item").getKey();
            var sLabel = oEvent.getSource().getParent().getLabel();

            if (!this._oColState[sLabel]) {
                this._oColState[sLabel] = { sortDir: "none", groupBy: false, columnWidthPx: 160 };
            }
            this._oColState[sLabel].sortDir = sKey;
            this.getView().getModel("colSettings").setProperty("/sort_" + sLabel, sKey);

            var oTable   = this.byId("prTable");
            var oBinding = oTable.getBinding("items");

            oTable.getColumns().forEach(function (oCol) {
                oCol.setSortIndicator("None");
            });

            if (sKey === "none") {
                oBinding.sort([]);
                return;
            }

            var sSortPath = _mColSortPaths[sLabel];
            if (!sSortPath) { return; }

            oBinding.sort(new Sorter(sSortPath, sKey === "desc"));

            oTable.getColumns().forEach(function (oCol) {
                var oHeader = oCol.getHeader();
                if (oHeader && oHeader.getText && oHeader.getText() === sLabel) {
                    oCol.setSortIndicator(sKey === "asc" ? "Ascending" : "Descending");
                }
            });
        },

        onColSettingsGroupByChange: function (oEvent) {
            var bGrouped = oEvent.getParameter("state");
            var sLabel   = oEvent.getSource().getParent().getLabel();
            if (!this._oColState[sLabel]) {
                this._oColState[sLabel] = { sortDir: "none", groupBy: false, columnWidthPx: 160 };
            }
            this._oColState[sLabel].groupBy = bGrouped;
            this.getView().getModel("colSettings").setProperty("/group_" + sLabel, bGrouped);
            MessageToast.show(bGrouped ? sLabel + ": grouped" : sLabel + ": ungrouped");
        },

        onColSettingsWidthChange: function (oEvent) {
            var nWidth = oEvent.getSource().getValue();
            var sLabel = this.getView().getModel("colSettings").getProperty("/columnLabel");
            this._oColState[sLabel].columnWidthPx = nWidth;

            var oTable = this.byId("prTable");
            oTable.getColumns().forEach(function (oCol) {
                var oHeader = oCol.getHeader();
                if (oHeader && oHeader.getText && oHeader.getText() === sLabel) {
                    oCol.setWidth(nWidth + "px");
                }
            });
        },

        onColSettingsClose: function () {
            if (this._oColSettingsPopover) {
                this._oColSettingsPopover.close();
            }
        },

        onColSettingsMore: function () {
            MessageToast.show("More column settings — not yet implemented");
        },

        // ---- Row/Table Actions ----

        onDelete: function () {
            MessageToast.show("Delete — not yet implemented");
        },

        onTableActions: function () {
            MessageToast.show("Actions — not yet implemented");
        },

        onExport: function () {
            MessageToast.show("Export to Spreadsheet — not yet implemented");
        },

        // ---- Row Actions ----

        onItemPress: function () {
            window.location.href = "../L3-Ariba-Object-Page-Floorplan/";
        },

        onSupplierPress: function (oEvent) {
            oEvent.preventDefault();
            MessageToast.show("Supplier Quick View — not yet implemented");
        },

        onRequesterPress: function (oEvent) {
            oEvent.preventDefault();
            MessageToast.show("Contact Quick View — not yet implemented");
        },

        // ---- Page Actions ----

        onCreate: function () {
            MessageToast.show("Create Purchase Request — not yet implemented");
        },

        onCreateFromDocument: function () {
            var oView = this.getView();
            var fnOpen = function (oDialog) {
                this.byId("createFromDocFileUploader").setValue("");
                var oModel = oDialog.getModel("createFromDoc");
                oModel.setProperty("/hasFile", false);
                oModel.setProperty("/showEmpty", true);
                oModel.setProperty("/fileName", "");
                oModel.setProperty("/fileSize", "");
                oDialog.open();
            }.bind(this);

            if (!this._oCreateFromDocDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "com.sap.ariba.l2purchaserequisition.view.CreateFromDocumentDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._oCreateFromDocDialog = oDialog;
                    oView.addDependent(oDialog);
                    oDialog.addStyleClass("sapUiSizeCompact");
                    oDialog.setModel(new JSONModel({ hasFile: false, showEmpty: true, fileName: "", fileSize: "" }), "createFromDoc");
                    fnOpen(oDialog);
                }.bind(this));
            } else {
                fnOpen(this._oCreateFromDocDialog);
            }
        },

        onCreateFromDocFileChange: function (oEvent) {
            var sName  = oEvent.getParameter("newValue");
            if (!sName) { return; }
            var oFiles = oEvent.getParameter("files");
            var nBytes = oFiles && oFiles[0] ? oFiles[0].size : 0;
            var sSizeLabel = nBytes ? (nBytes / (1024 * 1024)).toFixed(1) + " Mb" : "";
            var oModel = this._oCreateFromDocDialog.getModel("createFromDoc");
            oModel.setProperty("/fileName", sName);
            oModel.setProperty("/fileSize", sSizeLabel);
            oModel.setProperty("/showEmpty", false);
            oModel.setProperty("/hasFile", true);
        },

        onCreateFromDocRemoveFile: function () {
            this.byId("createFromDocFileUploader").setValue("");
            var oModel = this._oCreateFromDocDialog.getModel("createFromDoc");
            oModel.setProperty("/hasFile", false);
            oModel.setProperty("/showEmpty", true);
            oModel.setProperty("/fileName", "");
            oModel.setProperty("/fileSize", "");
        },

        onCreateFromDocReplace: function () {
            var oFU = this.byId("createFromDocFileUploader");
            if (oFU && oFU.oFileUpload) {
                oFU.oFileUpload.click();
            }
        },

        onCreateFromDocFileNamePress: function () {
            MessageToast.show("File preview — not yet implemented");
        },

        onCreateFromDocContinue: function () {
            this._oCreateFromDocDialog.close();
            window.open(L3_URL, "_blank");
        },

        onCreateFromDocCancel: function () {
            this._oCreateFromDocDialog.close();
        },

        onColumnSettings: function () {
            MessageToast.show("Column Settings — not yet implemented");
        },

        onOverflow: function () {
            MessageToast.show("More actions — not yet implemented");
        },

        onVariantSelect: function (oEvent) {
            MessageToast.show("View: " + oEvent.getParameter("key"));
        },

        onVariantSave: function () {
            MessageToast.show("View saved");
        },

        onVariantManage: function () {
            MessageToast.show("Manage Views — not yet implemented");
        },

        onBreadcrumbPress: function (oEvent) {
            MessageToast.show("Navigate: " + oEvent.getSource().getText());
        }
    });
});
