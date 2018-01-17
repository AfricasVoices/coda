/*
Copyright (c) 2017 Coda authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/*

EDITORUI.JS
Responsible for drawing and initialising the code editor
Handles events related to, and happening within, the editor:

- adding a new scheme (with the UI changes handled by tableUI as it's a part of table UI)
- scheme name
- adding and deleting codes
- assigning shortcuts
- assigning colors
- assigning words
- initiates uploading new coding schemes
- initiates exporting the current coding scheme
- deleting the coding scheme (with the UI changes handled by tableUI as it's a part of table UI)

 */

var codeEditorManager = {

    editorContainer: {},
    editorPanel: {},
    codeTable: {},
    addCodeButton: {},
    closeEditorButton: {},
    cancelEditorButton: {},
    addSchemeButton: {},
    saveSchemeButton: {},
    activeCode: "",

    init: function(editorContainer) {

        $(editorContainer).hide();
        editorOpen = false;

        this.editorContainer = editorContainer;
        this.editorPanel = this.editorContainer.find(".panel");
        this.codeTable = this.editorPanel.find("tbody");
        this.addCodeButton = this.editorPanel.find("#add-code");
        this.closeEditorButton = this.editorPanel.find("#close-editor");
        this.cancelEditorButton = this.editorPanel.find("#cancel-button");
        this.addSchemeButton = $("#add-scheme");
        this.saveSchemeButton = this.editorPanel.find("#scheme-save-button");
        this.bindAddCodeButtonListener(this.codeTable);
        this.bindCloseDialogListeners();
        this.bindAddSchemeListeners();
        this.bindNameInputListeners();

        var logColorChange = debounce((code, color) => {
            if (code) {
                if (tempScheme && tempScheme instanceof CodeScheme) { // otherwise the editor was already closed in the meantime

                    console.log(new Date() + " color");
                    // update the activity stack
                    storage.saveActivity({
                        "category": "SCHEME",
                        "message": "Changed color for code in scheme",
                        "messageDetails": {"scheme": code.owner.id, "code": code.id, "color": color.toHex()},
                        "data": tempScheme.toJSON(),
                        "timestamp": new Date()
                    });
                }
            }
        }, 1000, false);

        $("#color-pick").colorpicker({
            component: $("#colorpicker-trigger"),
            container: editorContainer,
            useAlpha: false
        });

        $("#color-pick").on("changeColor", function(event) {

            if (state.activeEditorRow && state.activeEditorRow.length > 0) {
                $(".code-row[codeid='" + state.activeEditorRow + "']").css("background-color", event.color.toHex());
                var code = tempScheme.codes.get(state.activeEditorRow);
                if (code) {
                    code.color = event.color.toHex();
                }
            }

            $("#word-textarea").find(".tag").css({"background-color": event.color.toHex()});
            logColorChange(code, event.color); // will only run every N ms in order not to flood the activity log
        });
        $("#color-pick").on("showPicker", () => {
            $(".colorpicker").offset({top: 511, left: 1080 + $("body").scrollLeft()});
        });

        $("#code-details-panel").on("scroll", () => {
            $("#color-pick").focusout(); // to hide it
        });

        $("#delete-scheme-button").on("click", () => {
            let nextActiveSchemeId = codeEditorManager.deleteScheme(tempScheme.id + "");
            activeSchemeId = nextActiveSchemeId;
            messageViewerManager.activeSchemeId = nextActiveSchemeId;

            codeEditorManager.editorContainer.hide();
            codeEditorManager.editorContainer.find("tbody").empty();
            codeEditorManager.bindAddCodeButtonListener();
            codeEditorManager.editorContainer.find("#scheme-name-input").val("");
            editorOpen = false;

            messageViewerManager.resizeViewport();

            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Deleted scheme",
                "messageDetails": {"scheme": tempScheme["id"]},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()
            });
            tempScheme = {};
        });
    },

    bindNameInputListeners: function() {

        var nameInput = $("#scheme-name-input");

        nameInput.on("keydown", function(event) {

            if (event.keyCode === 13) {
                $(this).attr("value", $(this).val());
                tempScheme.name = $(this).attr("value");
                $(this).blur();
            }

            event.stopPropagation();

        });

    },

    bindAddSchemeListeners: function() {
        var editorContainer = this.editorContainer;
        var addSchemeButton = this.addSchemeButton;
        var saveSchemeButton = this.saveSchemeButton;
        var headerDecoColumn = $("#header-decoration-column");

        addSchemeButton.on("click", function() {

            // TODO: cleverly assign scheme ids
            var newId = UIUtils.randomId(newDataset.schemeIds);
            tempScheme = new CodeScheme(newId, "", true);
            $("#color-pick").colorpicker("setValue", "#ffffff");

            saveSchemeButton.off("click");
            saveSchemeButton.on("click", function() {

                tempScheme["name"] = editorContainer.find("#scheme-name-input").val();
                tempScheme.codes.forEach(function(codeObj) {
                    var row = editorContainer.find("tr[id='" + codeObj["id"] + "']");

                    if (row.length > 0) {
                        var value = row.find(".code-input").val();
                        var shortcut = row.find(".shortcut-input").val();

                        if (value.length > 0) {
                            codeObj.value = value;
                        }

                        if (shortcut.length > 0) {
                            codeObj.shortcut = UIUtils.ascii(shortcut);
                        }
                    }
                });

                let validation = CodeScheme.validateScheme(tempScheme);
                var hasError = false;

                if (!validation.name) {
                    // turn on error on scheme name field
                    let schemeNameCol = $("#scheme-name-col");
                    schemeNameCol.addClass("has-error");
                    schemeNameCol.find(".input-group")
                        .addClass("has-feedback")
                        .addClass("has-error");
                    hasError = true;
                    console.log("Error: Invalid input values given for scheme.");

                } else {
                    let schemeNameCol = $("#scheme-name-col");
                    schemeNameCol.removeClass("has-error");
                    schemeNameCol.find(".input-group")
                        .removeClass("has-feedback")
                        .removeClass("has-error");
                }

                let codeTable = $("#code-table");
                // turn on error on the right shortcut field(s)
                codeTable.find(".code-row").each((index, codeRow) => {
                    let codeId = $(codeRow).attr("codeid");
                    if (validation.invalidShortcuts.indexOf(codeId) > -1) {
                        $(codeRow).find(".feedback-input-field.shortcut")
                            .addClass("has-error")
                            .addClass("has-feedback");

                        hasError = true;
                        console.log("Error: Invalid shortcut input values given for scheme.");

                    } else {
                        $(codeRow).find(".feedback-input-field.shortcut")
                            .removeClass("hass-error")
                            .removeClass("has-feedback");
                    }
                });

                // turn on error on the right code value field(s)
                codeTable.find(".code-row").each((index, codeRow) => {
                    let codeId = $(codeRow).attr("codeid");
                    if (validation.invalidValues.indexOf(codeId) > -1) {
                        $(codeRow).find(".feedback-input-field.code")
                            .addClass("has-error")
                            .addClass("has-feedback");

                        hasError = true;
                        console.log("Error: Invalid code name input values given for scheme.");

                    } else {
                        $(codeRow).find(".feedback-input-field.code")
                            .removeClass("has-error")
                            .removeClass("has-feedback");
                    }
                });

                if (hasError) {
                    return;
                }

                // remove error message for scheme name
                let schemeNameCol = $("#scheme-name-col");
                schemeNameCol.removeClass("has-error");
                schemeNameCol.find(".input-group")
                    .removeClass("has-feedback")
                    .removeClass("has-error");

                newDataset.addScheme(tempScheme);
                messageViewerManager.addNewSchemeColumn(tempScheme);

                undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);

                editorContainer.hide();
                editorContainer.find("tbody").empty();
                codeEditorManager.bindAddCodeButtonListener();
                editorContainer.find("#scheme-name-input").val("");
                scrollbarManager.redraw(newDataset, newId);
                scrollbarManager.redrawThumb(0);
                $(scrollbarManager.scrollbarEl).drawLayers();
                editorOpen = false;
                tempScheme = {};
                messageViewerManager.resizeViewport();

            });

            $(editorContainer).show();
            editorOpen = true;
            $("#scheme-name-input").focus();
        });

    },

    bindSaveEditListener: function(header) {
        var editorContainer = this.editorContainer;
        var saveSchemeButton = this.saveSchemeButton;

        saveSchemeButton.off("click");

        saveSchemeButton.on("click", function() {
            // Updates the scheme used by the table to match the modified temporary version in the editor UI, if valid.
            // As far as I can tell, this doesn't actually perform a persistent save.

            tempScheme.codes.forEach(function(codeObj) {
                var row = editorContainer.find("tr[codeid='" + codeObj["id"] + "']");

                if (row.length > 0) {
                    //todo codeobject should just have all this saved already
                    let value = row.find(".code-input").val();
                    let shortcut = row.find(".shortcut-input").val();

                    if (value.length > 0) {
                        codeObj.value = value;
                    }

                    if (shortcut.length > 0) {
                        codeObj.shortcut = UIUtils.ascii(shortcut);
                    }
                }
            });

            tempScheme["name"] = editorContainer.find("#scheme-name-input").val(); //todo codeobject should just have all this saved already

            /*
            Validate entered values
             */
            let validation = CodeScheme.validateScheme(tempScheme);
            var hasError = false;
            if (!validation.name) {
                // turn on error on scheme name field
                let schemeNameCol = $("#scheme-name-col");
                schemeNameCol.addClass("has-error");
                schemeNameCol.find(".input-group")
                    .addClass("has-feedback")
                    .addClass("has-error");
                hasError = true;
            } else {
                let schemeNameCol = $("#scheme-name-col");
                schemeNameCol.removeClass("has-error");
                schemeNameCol.find(".input-group")
                    .removeClass("has-feedback")
                    .removeClass("has-error");
            }

            // turn on error on the right shortcut field(s)
            $("#code-table").find(".code-row").each((index, codeRow) => {
                let codeId = $(codeRow).attr("codeid");
                if (validation.invalidShortcuts.indexOf(codeId) > -1) {
                    $(codeRow).find(".feedback-input-field.shortcut")
                        .addClass("has-error")
                        .addClass("has-feedback");
                    hasError = true;

                } else {
                    $(codeRow).find(".feedback-input-field.shortcut")
                        .removeClass("hass-error")
                        .removeClass("has-feedback");
                }
            });

            // turn on error on the right code value field(s)
            $("#code-table").find(".code-row").each((index, codeRow) => {
                let codeId = $(codeRow).attr("codeid");
                if (validation.invalidValues.indexOf(codeId) > -1) {
                    $(codeRow).find(".feedback-input-field.code")
                        .addClass("has-error")
                        .addClass("has-feedback");
                    hasError = true;
                } else {
                    $(codeRow).find(".feedback-input-field.code")
                        .removeClass("has-error")
                        .removeClass("has-feedback");
                }
            });

            if (hasError) {
                return;
            }

            // if no error, remove the error message around scheme name
            let schemeNameCol = $("#scheme-name-col");
            schemeNameCol.removeClass("has-error");
            schemeNameCol.find(".input-group")
                .removeClass("has-feedback")
                .removeClass("has-error");

            // update header in message view
            header.find(".scheme-name").text(tempScheme["name"]);

            // update the original scheme
            newDataset.getScheme(tempScheme.id).copyCodesFrom(tempScheme);

            // code and re-sort dataset
            regexMatcher.codeDataset(tempScheme["id"]);
            if (messageViewerManager.currentSort === messageViewerManager.sortUtils.sortEventsByConfidenceOnly) {
                newDataset.sortEventsByConfidenceOnly(tempScheme["id"]);
            }
            if (messageViewerManager.currentSort === messageViewerManager.sortUtils.sortEventsByScheme) {
                newDataset.sortEventsByScheme(tempScheme["id"], true);
            }
            if (messageViewerManager.currentSort === messageViewerManager.sortUtils.restoreDefaultSort) {
                newDataset.restoreDefaultSort();
            }

            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Saved scheme",
                "messageDetails": {"scheme": tempScheme["id"]},
                "data": newDataset.getScheme(tempScheme["id"]).toJSON(),
                "timestamp": new Date()
            });

            // redraw rows
            let messageTableTbody = "";
            let decoTableTbody = "";

            let halfPage = Math.floor(messageViewerManager.rowsInTable / 2);
            let stoppingCondition = (messageViewerManager.lastLoadedPageIndex * halfPage + halfPage > newDataset.eventCount) ? newDataset.eventCount : messageViewerManager.lastLoadedPageIndex * halfPage + halfPage;
            for (let i = (messageViewerManager.lastLoadedPageIndex - 1) * halfPage; i < stoppingCondition; i++) {
                let event = newDataset.eventAtPosition(i);
                if (event === undefined) {
                    console.log("ERROR: No event exists at position " + i);
                    continue;
                }

                messageTableTbody += messageViewerManager.buildMessageTableRow(event, i, event.owner, messageViewerManager.activeSchemeId);
                decoTableTbody += messageViewerManager.buildDecorationTableRow(event, i, event.owner, messageViewerManager.codeSchemeOrder.slice(1));
            }

            let messageTableTbodyElement = messageViewerManager.messageTable.find("tbody");
            let decoTableTbodyElement = messageViewerManager.decorationTable.find("tbody");
            let previousScrollTop = messageViewerManager.messageContainer.scrollTop();
            let previousActiveRow = activeRow.attr("eventid");

            messageTableTbodyElement.empty();
            decoTableTbodyElement.empty();

            let messageRows = $(messageTableTbody).prependTo(messageTableTbodyElement);
            let decoRows = $(decoTableTbody).prependTo(decoTableTbodyElement);

            for (let i = 0; i < messageRows.length; i++) {
                // need to adjust heights so rows match in each table
                let outerHeight = $(messageRows[i]).outerHeight();
                $(decoRows[i]).outerHeight(outerHeight);
            }

            messageViewerManager.messageContainer.scrollTop(previousScrollTop);
            activeRow = messageTableTbodyElement.find("tr[eventid='" + previousActiveRow + "']").addClass("active");

            // redraw scrollbar
            const thumbPosition = scrollbarManager.getThumbPosition();
            scrollbarManager.redraw(newDataset, tempScheme["id"]);
            scrollbarManager.redrawThumb(thumbPosition);

            messageViewerManager.changeActiveScheme(tempScheme["id"]);

            undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);

            editorContainer.hide();
            editorContainer.find("tbody").empty();
            codeEditorManager.bindAddCodeButtonListener();
            editorContainer.find("#scheme-name-input").val("");
            editorOpen = false;
            messageViewerManager.resizeViewport();

        });
    },

    bindCloseDialogListeners: function() {
        var editorContainer = this.editorContainer;
        var closeButton = this.closeEditorButton;
        var cancelButton = this.cancelEditorButton;

        closeButton.on("click", function() {
            editorContainer.hide();
            editorContainer.find("tbody").empty();
            codeEditorManager.bindAddCodeButtonListener();
            $("#scheme-name-input").attr("value", "").val("");

            // clear potential error message for scheme name (rows will be deleted anyway)
            let schemeNameCol = $("#scheme-name-col");
            schemeNameCol.removeClass("has-error");
            schemeNameCol.find(".input-group")
                .removeClass("has-feedback")
                .removeClass("has-error");

            editorOpen = false;
            state.activeEditorRow = "";

            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Closed editor for scheme",
                "messageDetails": {"scheme": tempScheme["id"]},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()
            });
        });

        cancelButton.on("click", function() {
            editorContainer.hide();
            editorContainer.find("tbody").empty();
            codeEditorManager.bindAddCodeButtonListener();
            $("#scheme-name-input").attr("value", "").val("");

            // clear potential error message for scheme name (rows will be deleted anyway)
            let schemeNameCol = $("#scheme-name-col");
            schemeNameCol.removeClass("has-error");
            schemeNameCol.find(".input-group")
                .removeClass("has-feedback")
                .removeClass("has-error");

            editorOpen = false;
            state.activeEditorRow = "";

            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Cancel edits to scheme",
                "messageDetails": {"scheme": tempScheme["id"]},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()
            });
        });
    },

    bindAddCodeButtonListener: function() {

        let addCodeInputRow = codeEditorManager.addCodeInputRow;

        this.editorContainer.find("tbody").append("<tr class=\"row add-code-row\">" +
            "<td class=\"col-md-6\">" +
            "<button id=\"add-code\" class=\"btn btn-default\">" +
            "<i class=\"glyphicon glyphicon-plus\">" +
            "</i>" +
            "</button>" +
            "</td>" +
            "<td class=\"col-md-5\"></td>" +
            "<td class=\"col-md-1\"></td>" +
            "</tr>");

        $(".add-code-row").on("click", function() {
            let newCode = addCodeInputRow("", "", "#ffffff", "", []); // todo will return codeObject
            codeEditorManager.updateCodePanel(newCode);

            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Added new code to scheme",
                "messageDetails": {"scheme": tempScheme["id"], "code": newCode.id},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()
            });
        });
    },

    addCodeInputRow: function(code, shortcut, color, id, words) {

        var bindInputListeners = codeEditorManager.bindInputListeners;
        var codeObject;
        if (!color) color = "#ffffff";

        var newId = id;
        if (id.length === 0) {
            // create new placeholder code
            newId = tempScheme["id"] + "-" + UIUtils.randomId(); // todo: check for duplicates
            codeObject = new Code(tempScheme, newId, code, color, shortcut, false);
            tempScheme.codes.set(newId, codeObject); // todo: fix owner when saving to parent scheme - what does this mean
        }

        let oldRow = $(".code-row[codeid='" + state.activeEditorRow + "']");
        $(oldRow).css("background-color", "#ffffff");
        state.activeEditorRow = newId;

        $(".code-row").each(function(i, row) {
            $(row).removeClass("active");
        });

        var row = $("<tr class='row active code-row' codeid='" + newId + "'></tr>").insertBefore($(".add-code-row"));

        var codeCell = $("<td class='col-md-6' style='background-color:" + color + "'></td>").appendTo(row);
        var shortcutCell = $("<td class='col-md-5' style='background-color:" + color + "'></td>").appendTo(row);
        var buttonCell = $("<td class='col-md-1' style='background-color:" + color + "'></td>").appendTo(row);

        var codeInputWithFeedback =
            $("<div class='feedback-input-field code'>" +
                "<i class='glyphicon glyphicon-exclamation-sign'></i>" +
                "<input type='text' class='form-control code-input' placeholder='enter code...' value='" + code + "'/>" +
                "<small class='help-block' result='INVALID'>Invalid code name format<sup data-toggle='tooltip' data-placement='top'" +
                "data-container='body' data-original-title='Valid characters: a-zA-Z0-9 and -/ or whitespace in between, max length 50'>?</sup></small>" +
                "</div>")
                .appendTo(codeCell);

        codeInputWithFeedback.find("sup").tooltip();
        codeInputWithFeedback.find("input").focus();

        shortcut = ("" + shortcut).length > 0 ? String.fromCharCode(shortcut) : "";

        var shortcutInputWithFeedback =
            $("<div class='feedback-input-field shortcut'>" +
                "<i class='glyphicon glyphicon-exclamation-sign'></i>" +
                "<input type='text' class='form-control shortcut-input' placeholder='type shortcut key...' maxlength='1' value='" + shortcut + "'/>" +
                "<small class='help-block' result='INVALID'>Invalid shortcut character<sup data-toggle='tooltip' data-placement='top'" +
                "data-container='body' data-original-title='Valid characters: a-zA-Z0-9'>?</sup></small>" +
                "</div>")
                .appendTo(shortcutCell);

        shortcutInputWithFeedback.find("sup").tooltip();

        var button = $("<button type='button' class='btn btn-danger delete-code'>" +
            "<i class='glyphicon glyphicon-remove'></i>" +
            "</button>").appendTo(buttonCell);

        [codeCell, shortcutCell, buttonCell].forEach(function(td) {
            $(td).css({"background-color": color});
        });

        row.on("click", function() {
            let oldRow = $(".code-row[codeid='" + state.activeEditorRow + "']");
            $(oldRow).css("background-color", "#ffffff");
            oldRow.removeClass("active");

            state.activeEditorRow = $(this).attr("codeid");

            let newRow = $(".code-row[codeid='" + state.activeEditorRow + "']");
            newRow.addClass("active");

            var code = tempScheme.codes.get(state.activeEditorRow);

            if (code) {
                codeEditorManager.updateCodePanel(code);
            }
        });

        bindInputListeners(row);

        return codeObject;
    },

    updateCodePanel: function(codeObj) {
        // todo problem when new row is added - codeObj doesn't exist yet, so can't bind the event handler for tags
        // assume called with valid codeObject

        var color = codeObj ? (codeObj["color"].length > 0 ? codeObj["color"] : "#ffffff") : "#ffffff";
        let words = codeObj ? (codeObj["words"].length > 0 ? codeObj["words"].slice(0) : []) : [];
        let colorPicker = $("#color-pick");
        var wordTextarea = $("#word-textarea");
        var regexField = $("#regex-edit").find("input");
        var userRegexField = $("#regex-user").find("input");
        colorPicker.find("input").attr("value", color);
        colorPicker.colorpicker("setValue", color);

        if (color === "#ffffff") color = "#9e9e9e"; // set the tags to a darker grey color
        let selectObj = wordTextarea.find("select");
        selectObj.tagsinput("removeAll");

        $(selectObj).off("itemAdded");
        $(selectObj).off("itemRemoved");

        for (let word of words) {
            selectObj.tagsinput("add", word);
        }

        $("span.tag").css({"background-color": color});

        $(selectObj).on("itemAdded", function(event) {
            // event.item: contains the item
            // event.cancel: set to true to prevent the item getting added
            let color = (codeObj["color"] === "#ffffff" ? "#9e9e9e" : codeObj["color"]);
            wordTextarea.find(".tag").css({"background-color": color});
            codeObj.addWords(event.item);
            regexField.val(regexMatcher.generateOrRegex(codeObj["words"]));
            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Added word to code in scheme",
                "messageDetails": {"word": event.item, "scheme": tempScheme["id"], "code": codeObj["id"]},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()
            });
        });

        $(selectObj).on("itemRemoved", function(event) {
            // event.item: contains the item
            codeObj.deleteWords([event.item]);
            regexField.val(regexMatcher.generateOrRegex(codeObj["words"]));
            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Deleted word from code in scheme",
                "messageDetails": {"word": event.item, "scheme": tempScheme["id"], "code": codeObj["id"]},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()
            });
        });

        let wordsRegex = regexMatcher.generateOrRegex(codeObj["words"]);
        if (wordsRegex) {
            regexField.val(wordsRegex.source); // dont display flags
        } else {
            regexField.val("");
        }

        let userRegex;
        if (!codeObj.regex || codeObj.regex.length === 0 || codeObj.regex[0].length === 0) {
            // set placeholder text in input field!
            userRegexField.val("");
        } else {
            try {
                userRegex = new RegExp(codeObj.regex[0], codeObj.regex[1]);
                userRegexField.val(userRegex);
            } catch (e) {
                console.log(e);
                // append exclamation mark
            }
        }
    },

    bindInputListeners: function(inputRow) {

        var inputRow = $(inputRow);
        var codeInput = inputRow.find(".code-input");
        var shortcutInput = inputRow.find(".shortcut-input");
        var deleteButton = inputRow.find(".delete-code");

        codeInput.on("keydown", function(event) {
            if (event.keyCode === 13) {
                // save and move to shortcut field

                var codeId = $(this).parents("tr").attr("codeid");
                var codeObj = tempScheme.codes.get(codeId);

                if (codeObj) {
                    codeObj["value"] = ($(this).val());
                }

                $(this).attr("value", $(this).val());
                $(this).parents("tr").find(".shortcut-input").focus();

            }
        });

        shortcutInput.on("keydown", function(event) {
            if (event.keyCode === 13) {
                $(this).attr("value", $(this).val());

                var nextRow = $(this).parents("tr").next();

                if (nextRow.length > 0 && nextRow.attr("class") !== "row add-code-row") {
                    nextRow.find(".code-input").focus();

                } else {
                    //codeEditorManager.addCodeInputRow("", "", "#ffffff", parseInt($("tbody > .code-row:last").attr("id")) + 1);

                    nextRow = $(this).parents("tr").next();
                    nextRow.find(".code-input").focus();
                }
            }
        });

        codeInput.on("focusout", function() {

            var codeId = $(this).parents("tr").attr("codeid");
            var codeObj = tempScheme.codes.get(codeId);

            if (codeObj) {
                codeObj["value"] = ($(this).val());
            }
        });

        shortcutInput.on("focusout", function() {

            var codeId = $(this).parents("tr").attr("codeid");
            var codeObj = tempScheme.codes.get(codeId);

            if (codeObj) {
                let ascii = UIUtils.ascii($(this).val());

                if ($(this).val().length === 0 || isNaN(ascii)) {
                    codeObj["shortcut"] = "";
                } else {
                    codeObj["shortcut"] = ascii;
                }
            }

        });

        deleteButton.on("click", function() {

            // TODO: unbind shortcuts
            // TODO: remove code from dropdowns
            // TODO: stop relying on Map keys as indices...
            let id = $(this).parents("tr").attr("codeid");
            let next = $(inputRow).next(".code-row");
            let prev = $(inputRow).prev(".code-row");
            $(inputRow).remove();
            tempScheme.codes.delete(id);

            if (next.length != 0) {
                $(next).addClass("active");
                state.activeEditorRow = $(next).attr("codeid");
                codeEditorManager.updateCodePanel(tempScheme.codes.get(state.activeEditorRow));

            } else if (prev.length != 0) {
                $(prev).addClass("active");
                state.activeEditorRow = $(prev).attr("codeid");
                codeEditorManager.updateCodePanel(tempScheme.codes.get($(prev).attr("codeid")));

            } else {
                // todo important - what happens when all codes are deleted from list
            }

            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Deleted code from scheme",
                "messageDetails": {"code": id, "scheme": tempScheme["id"]},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()
            });

        });
    },

    deleteScheme: function(schemeId) {
        let schemeSnapshot = CodeScheme.clone(newDataset.getScheme(schemeId));

        // delegate uglifying to datastructure
        newDataset.deleteScheme(schemeId);
        delete schemes[schemeId];

        // remove from scheme order
        let schemeOrderIndex = messageViewerManager.codeSchemeOrder.indexOf(schemeId);
        if (schemeOrderIndex > -1) messageViewerManager.codeSchemeOrder.splice(schemeOrderIndex, 1);
        activeSchemeId = messageViewerManager.codeSchemeOrder[0];
        messageViewerManager.activeSchemeId = messageViewerManager.codeSchemeOrder[0];

        if (newDataset.schemeCount === 0) {
            // create new default coding scheme
            let newScheme = new CodeScheme(UIUtils.randomId([]) + "", "default", true);
            newScheme.codes.set(newScheme.id + "-" + "1", new Code(newScheme, newScheme.id + "-" + "1", "test", "#ffffff", "", false));
            newDataset.addScheme(newScheme);

            messageViewerManager.codeSchemeOrder.push(newScheme.id + "");
            messageViewerManager.addNewActiveScheme(newScheme.id);
            schemeId = newScheme.id + "";
            messageViewerManager.activeSchemeId = newScheme.id + "";

            // save for UNDO and in storage
            undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);
            storage.saveDataset(newDataset);

            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Deleted scheme " + schemeId,
                "data": schemeSnapshot.toJSON(),
                "timestamp": new Date()
            });

            // in this case the default coding scheme was added and UI changes were already handled by addNewSchemeColumn
            return schemeId;

        } else {
            // save for UNDO and in storage
            undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);
            storage.saveDataset(newDataset);

            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Deleted scheme " + schemeId,
                "data": schemeSnapshot.toJSON(),
                "timestamp": new Date()
            });

            // UI changes need extra handling since there are multiple columns
            let newSchemeId = messageViewerManager.deleteSchemeColumn(schemeId);
            return newSchemeId;
        }
    },

    updateScheme(updatedScheme) {
        // Update the current scheme with the scheme just uploaded
        let oldActiveRowCodeId = $(".code-row.active").attr("codeid");

        for (let [codeId, code] of tempScheme.codes.entries()) {
            // update existing codes
            let codeRow = $(".code-row[codeid='" + codeId + "']");
            if (updatedScheme.codes.has(codeId)) {
                let newCode = updatedScheme.codes.get(codeId);
                newCode.owner = tempScheme;
                codeRow.find(".code-input").attr("value", newCode.value);

                if (newCode.shortcut.length > 0) {
                    // don't set value to empty string, it still counts as value, fails validation and loses placeholder text
                    codeRow.find(".shortcut-input").attr("value", String.fromCharCode(newCode.shortcut));
                }

                codeRow.find("td").attr("style", "background-color: " + (newCode.color ? newCode.color : "#ffffff"));
                tempScheme.codes.set(codeId, newCode);
                updatedScheme.codes.delete(codeId);
            } else {
                // not in the new scheme, remove row and set a new active row if necessary
                // TODO: what was this, and why has been commented?
                /*
                let isActive = codeRow.hasClass("active");
                if (isActive) {
                    let newActiveRow = $(".code-row:last");
                    newActiveRow.addClass("active");
                    codeEditorManager.activeCode = newActiveRow.attr("code-id");
                }
                */

                codeRow.remove();
                tempScheme.codes.delete(codeId);
            }
        }

        for (let [codeId, code] of updatedScheme.codes.entries()) {
            // add new codes
            code.owner = tempScheme;
            codeEditorManager.addCodeInputRow(code.value, code.shortcut, code.color, codeId);
            tempScheme.codes.set(codeId, code);
        }

        $("#scheme-name-input").val(updatedScheme.name);

        let newActiveRowCodeId = $(".code-row.active").attr("codeid");
        if (newActiveRowCodeId !== oldActiveRowCodeId) {
            let newActiveRow = $(".code-row:last");
            newActiveRow.addClass("active");
        }

        codeEditorManager.activeCode = newActiveRowCodeId;
        codeEditorManager.updateCodePanel(tempScheme.codes.get(codeEditorManager.activeCode));

        // TODO: what was this, and why has it been commented?
        /*
        let activeCode = tempScheme.codes.get($(".code-row.active").attr("code-id"));
        if (activeCode) {
            codeEditorManager.updateCodePanel(activeCode);
        } else {
            // make a row active and update the code panel accordingly
            let newActiveRow = $(".code-row:last");
            newActiveRow.addClass('active');
            codeEditorManager.activeCode = newActiveRow.attr("code-id");
            codeEditorManager.updateCodePanel(tempScheme.codes.get(codeEditorManager.activeCode.id));
        }
        */
    }
};
