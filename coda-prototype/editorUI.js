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

var codeEditorManager =  {

    editorContainer: {},
    editorPanel: {},
    codeTable: {},
    addCodeButton: {},
    closeEditorButton: {},
    cancelEditorButton: {},
    addSchemeButton: {},
    saveSchemeButton: {},

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
        }, 1000, false);

        $('#color-pick').colorpicker({component: $("#colorpicker-trigger")});
        $('#color-pick').on("changeColor", function(event) {

            if (!$.isEmptyObject(state.activeEditorRow)) {
                $(state.activeEditorRow).css("background-color", event.color.toHex());
                var code = tempScheme.codes.get($(state.activeEditorRow).attr("id"));
                if (code) {
                    code.color = event.color.toHex();
                }
            }

            $("#word-textarea").find(".tag").css({"background-color": event.color.toHex()});
            logColorChange(code, event.color); // will only run every N ms in order not to flood the activity log
        });

        $("#delete-scheme-button").on("click", () => {
           let nextActiveSchemeId = codeEditorManager.deleteScheme(tempScheme.id + "");
           activeSchemeId = nextActiveSchemeId;
           codeEditorManager.editorContainer.hide();
           codeEditorManager.editorContainer.find("tbody").empty();
           codeEditorManager.bindAddCodeButtonListener();
           codeEditorManager.editorContainer.find("#scheme-name-input").val("");
           editorOpen = false;

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

        nameInput.on("click", function() {
            $(this).prop("readonly", false);
        });

        nameInput.on("keydown", function(event) {

            if (event.keyCode === 13) {
                $(this).prop("readonly", true);
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
            var newId = UIUtils.randomId(Object.keys(newDataset.schemes));
            tempScheme = new CodeScheme(newId, "", true);
            $("#color-pick").colorpicker('setValue', "#ffffff");

            saveSchemeButton.off("click");
            saveSchemeButton.one("click", function() {

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

                // todo prevent saving when there is an empty code

                newDataset.schemes[newId] = tempScheme;
                messageViewerManager.codeSchemeOrder.push(newId + "");

                messageViewerManager.addNewSchemeColumn(tempScheme, name);

                var header = headerDecoColumn.find("[scheme='" + tempScheme["id"] + "']");
                header.children("i").text(tempScheme["name"]);

                editorContainer.hide();
                editorContainer.find("tbody").empty();
                codeEditorManager.bindAddCodeButtonListener();
                editorContainer.find("#scheme-name-input").val("");
                scrollbarManager.redraw(newDataset, newId);
                scrollbarManager.redrawThumb(0);
                $(scrollbarManager.scrollbarEl).drawLayers();
                editorOpen = false;
                tempScheme = {};
            });

            $("#scheme-name-input").prop("readonly", false);
            $(editorContainer).show();
            editorOpen = true;
            $("#scheme-name-input").focus();
        });

    },


    bindSaveEditListener: function() {
        var editorContainer = this.editorContainer;
        var saveSchemeButton = this.saveSchemeButton;
        var headerDecoColumn = $("#header-decoration-column");

        saveSchemeButton.off("click"); // only have one listener at a time
        saveSchemeButton.one("click", function () {

            tempScheme.codes.forEach(function(codeObj,codeIndex) {
                var row = editorContainer.find("tr[id='" + codeObj["id"] + "']");

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

            // update header in message view
            var header = headerDecoColumn.find("[scheme='" + tempScheme["id"] + "']");
            header.find("i.scheme-name").text(tempScheme["name"]);

            // update the original scheme
            newDataset.schemes[tempScheme["id"]].copyCodesFrom(tempScheme);

            // code and re-sort dataset
            regexMatcher.codeDataset(tempScheme["id"]);
            //newDataset.events = messageViewerManager.currentSort(newDataset.events, tempScheme, true);
            if (messageViewerManager.currentSort == messageViewerManager.sortUtils.sortEventsByConfidenceOnly) {
                newDataset.sortEventsByConfidenceOnly(tempScheme["id"]);
            }
            if (messageViewerManager.currentSort == messageViewerManager.sortUtils.sortEventsByScheme) {
                newDataset.sortEventsByScheme(tempScheme["id"], true);
            }
            if (messageViewerManager.currentSort == messageViewerManager.sortUtils.restoreDefaultSort) {
                newDataset.restoreDefaultSort();
            }


            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Saved scheme",
                "messageDetails": {"scheme": tempScheme["id"]},
                "data": newDataset.schemes[tempScheme["id"]].toJSON(),
                "timestamp": new Date()
            });

            // redraw rows
            var tbody = "";

            let halfPage = Math.floor(messageViewerManager.rowsInTable / 2);
            for (let i = (messageViewerManager.lastLoadedPageIndex - 1) * halfPage; i < messageViewerManager.lastLoadedPageIndex * halfPage + halfPage; i++) {
                tbody += messageViewerManager.buildRow(newDataset.events[i], i, newDataset.events[i].owner);
            }

            // redraw scrollbar
            const thumbPosition = scrollbarManager.getThumbPosition();
            scrollbarManager.redraw(newDataset, tempScheme["id"]);
            scrollbarManager.redrawThumb(thumbPosition);

            var messagesTbody = messageViewerManager.messageContainer.find("tbody");
            var previousScrollTop = messageViewerManager.messageContainer.scrollTop();
            var previousActiveRow = activeRow.attr("id");

            messagesTbody.empty();
            messagesTbody.append(tbody);
            messageViewerManager.messageContainer.scrollTop(previousScrollTop);
            activeRow = $("#" + previousActiveRow).addClass("active");

            editorContainer.hide();
            editorContainer.find("tbody").empty();
            codeEditorManager.bindAddCodeButtonListener();
            editorContainer.find("#scheme-name-input").val("");
            editorOpen = false;

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
            editorOpen = false;
            state.activeEditorRow = {};

            // update the activity stack
            storage.saveActivity({
                "category" : "SCHEME",
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
            editorOpen = false;
            state.activeEditorRow = {};

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

        var addCodeInputRow = codeEditorManager.addCodeInputRow;

        this.editorContainer.find("tbody").append('<tr class="row add-code-row">' +
            '<td class="col-md-6">' +
            '<button id="add-code" class="btn btn-default">' +
            '<i class="glyphicon glyphicon-plus">' +
            '</i>' +
            '</button>' +
            '</td>' +
            '<td class="col-md-5"></td>' +
            '<td class="col-md-1"></td>' +
            '</tr>');

        $(".add-code-row").on("click", function() {
            let newCode = addCodeInputRow("","", "#ffffff", "", []); // todo will return codeObject
            codeEditorManager.updateCodePanel(newCode);

            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Added new code to scheme",
                "messageDetails": {"scheme": tempScheme["id"], "code": newCode.id},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()});
        });
    },

    addCodeInputRow: function(code, shortcut, color, id, words) {

        var bindInputListeners = codeEditorManager.bindInputListeners;
        var codeObject;
        if (!color ||color == undefined) color = "#ffffff";

        var newId = id;
        if (id.length === 0) {
            newId = tempScheme["id"] + "-" + UIUtils.randomId();
            codeObject = new Code(tempScheme, newId, code, color, shortcut, false);
            tempScheme.codes.set(newId, codeObject); // todo: fix owner when saving to parent scheme - what does this mean
        }

        $(".code-row").each(function(i,row) {$(row).removeClass("active")});

        var row = $("<tr class='row active code-row' id='" + newId + "'></tr>").insertBefore($(".add-code-row"));
        state.activeEditorRow = row;

        var codeCell = $("<td class='col-md-6' style='background-color:" + color + "'></td>").appendTo(row);
        var shortcutCell = $("<td class='col-md-5' style='background-color:" + color + "'></td>").appendTo(row);
        var buttonCell = $("<td class='col-md-1' style='background-color:" + color + "'></td>").appendTo(row);

        var codeInput = $("<input type='text' class='form-control code-input' placeholder='enter code...' value='" + code + "'>")
            .appendTo(codeCell);

        shortcut = ("" + shortcut).length > 0 ? String.fromCharCode(shortcut) : "";
        var shortcutInput = $("<input type='text' class='form-control shortcut-input' placeholder='type shortcut key...' value='" +
            shortcut + "'>")
            .appendTo(shortcutCell);

        var button = $("<button type='button' class='btn btn-danger delete-code'>" +
            "<i class='glyphicon glyphicon-remove'></i>" +
            "</button>").appendTo(buttonCell);

        [codeCell, shortcutCell, buttonCell].forEach(function(td) {
           $(td).css({"background-color": color});
        });

        /*
        if (code.length != 0 && color.length != 0) {
            //$("#color-pick").colorpicker('setValue', color);
            codeEditorManager.updateCodePanel(color, words);
        } else {
            //$("#color-pick").colorpicker('setValue', "#ffffff");
            codeEditorManager.updateCodePanel("#ffffff", words);
        }
        */

        row.on("click", function() {
            state.activeEditorRow.removeClass("active");
            state.activeEditorRow = $(this);
            state.activeEditorRow.addClass("active");

            var code = tempScheme.codes.get($(this).attr("id"));

            if (code) {
                /*
                let textAreaParent = $("#word-textarea").parent();
                textAreaParent.empty().append("<div id='word-textarea'></div>");
                */
                codeEditorManager.updateCodePanel(code);
            }
        });

        codeInput.focus();
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
        colorPicker.find("input").attr("value", color);
        colorPicker.colorpicker('setValue', color);

        if (color == "#ffffff") color = "#9e9e9e"; // set the tags to a darker grey color
        let selectObj= wordTextarea.find("select");
        selectObj.tagsinput('removeAll');

        $(selectObj).off('itemAdded');
        $(selectObj).off('itemRemoved');

        for (let word of words) {
            selectObj.tagsinput('add', word);
        }

        $("span.tag").css({'background-color': color});

        $(selectObj).on('itemAdded', function(event) {
            // event.item: contains the item
            // event.cancel: set to true to prevent the item getting added
            let color = (codeObj["color"] == "#ffffff" ? "#9e9e9e" : codeObj["color"]);
            wordTextarea.find(".tag").css({'background-color': color});
            codeObj.addWords(event.item);
            regexField.val(regexMatcher.generateOrRegex(codeObj["words"]));
            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Added word to code in scheme",
                "messageDetails": {"word": event.item, "scheme": tempScheme["id"], "code": codeObj["id"]},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()});
        });

        $(selectObj).on('itemRemoved', function(event) {
            // event.item: contains the item
            codeObj.deleteWords([event.item]);
            regexField.val(regexMatcher.generateOrRegex(codeObj["words"]));
            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Deleted word from code in scheme",
                "messageDetails": {"word": event.item, "scheme": tempScheme["id"], "code": codeObj["id"]},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()});
        });

        regexField.val(regexMatcher.generateOrRegex(codeObj["words"]));
    },


    bindInputListeners: function(inputRow) {

        var inputRow = $(inputRow);
        var codeInput = inputRow.find(".code-input");
        var shortcutInput = inputRow.find(".shortcut-input");
        var deleteButton = inputRow.find(".delete-code");

        codeInput.on("keydown", function(event){
            if (event.keyCode === 13) {
                // save and move to shortcut field

                var index = $(this).parents("tr").attr("id");
                var codeObj = tempScheme.codes.get(index); //todo fetch by id

                if (codeObj) {
                    codeObj["value"] = ($(this).val());
                }

                $(this).prop("readonly", true);
                $(this).attr("value", $(this).val());
                $(this).parents("tr").find(".shortcut-input").prop("readonly", false).focus();

            }
        });

        shortcutInput.on("keydown", function(event){
            if (event.keyCode === 13) {
                $(this).attr("value", $(this).val());
                $(this).prop("readonly", true);

                //tempScheme.codes.get();

                var nextRow = $(this).parents("tr").next();

                if (nextRow.length > 0 && nextRow.attr("class") !== "row add-code-row") {
                    nextRow.find(".code-input")
                        .prop("readonly", false)
                        .focus();

                } else {
                    //codeEditorManager.addCodeInputRow("", "", "#ffffff", parseInt($("tbody > .code-row:last").attr("id")) + 1);

                    nextRow = $(this).parents("tr").next();
                    nextRow.find(".code-input")
                        .prop("readonly", false)
                        .focus();
                }
            }
        });

        codeInput.on("focusout", function(){

            var index = $(this).parents("tr").attr("id");
            var codeObj = tempScheme.codes.get(index); // todo fetch by id

            if (codeObj) {
                codeObj["value"] = ($(this).val());
            } else {
                if ($(this).val().length > 0) {
                    var newCodeId = tempScheme["id"] + "-" + UIUtils.randomId(newDataset.schemes[tempScheme["id"]].codes);
                    //tempScheme.codes[index] = new Code(tempScheme, newCodeId, $(this).val(), "#ffffff", "", false);
                }
            }

            $(this).prop("readonly", true);


        });

        shortcutInput.on("focusout", function(){

            var index = $(this).parents("tr").attr("id");
            var codeObj = tempScheme.codes.get(index); //todo fetch by id

            if (codeObj && $(this).val().length > 0) {
                codeObj["shortcut"] = UIUtils.ascii($(this).val());
            }

            $(this).prop("readonly", true);


        });

        shortcutInput.on("click", function(){

            $(this).prop("readonly", false);

        });

        codeInput.on("click", function() {
            $(this).prop("readonly", false);

        });

        deleteButton.on("click", function() {

            // TODO: unbind shortcuts
            // TODO: remove code from dropdowns
            // TODO: stop relying on Map keys as indices...
            let id = $(this).parents("tr").attr("id");
            let next = $(inputRow).next(".code-row");
            let prev = $(inputRow).prev(".code-row");
            $(inputRow).remove();
            tempScheme.codes.delete(id);

            if (next.length != 0) {
                $(next).addClass("active");
                state.activeEditorRow = $(next);
                codeEditorManager.updateCodePanel(tempScheme.codes.get($(next).attr("id")));

            } else if (prev.length != 0){
                $(prev).addClass("active");
                state.activeEditorRow = $(prev);
                codeEditorManager.updateCodePanel(tempScheme.codes.get($(prev).attr("id")));

            } else {
                // todo important - what happens when all codes are deleted from list
            }

            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Deleted code from scheme",
                "messageDetails": {"code": id ,"scheme": tempScheme["id"]},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()
            });

        });
    },

    deleteScheme: function(schemeId) {
        let schemeSnapshot = newDataset.schemes[schemeId];
        let nextSchemeId;

        // delegate uglifying to datastructure
        newDataset.deleteScheme(schemeId);
        delete schemes[schemeId];

        let schemeOrderIndex = messageViewerManager.codeSchemeOrder.indexOf(schemeId);
        if (schemeOrderIndex > -1) messageViewerManager.codeSchemeOrder.splice(schemeOrderIndex, 1);

        if (Object.keys(newDataset.schemes).length == 0) {
            // create new default coding scheme
            let newScheme = new CodeScheme(UIUtils.randomId([]) + "", "default", true);
            newScheme.codes.set(newScheme.id + "-" + "1", new Code(newScheme, newScheme.id + "-" + "1", "test", "#ffffff", "", false));
            newDataset.schemes[newScheme.id] = newScheme;
            messageViewerManager.addNewSchemeColumn(newScheme);
            messageViewerManager.codeSchemeOrder.push(newScheme.id);
            nextSchemeId = newScheme.id;
        }

        // save for UNDO and in storage
        undoManager.markUndoPoint();
        storage.saveDataset(newDataset);

        // handle UI changes
        nextSchemeId = messageViewerManager.deleteSchemeColumn(schemeId);
        return nextSchemeId;
    }
};