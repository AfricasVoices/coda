
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

        $('#color-pick').colorpicker({component: $("#colorpicker-trigger")});
        $('#color-pick').on("changeColor", function(event) {

            if (!$.isEmptyObject(state.activeEditorRow)) {
                $(state.activeEditorRow).css("background-color", event.color.toHex());
                var code = tempScheme.codes.get($(state.activeEditorRow).attr("id"));
                if (code) {
                    code.color = event.color.toHex();
                }
            }

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
            var newId = UIUtils.randomId(Object.keys(schemes));
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

                schemes[newId] = tempScheme;

                messageViewerManager.addNewSchemeColumn(tempScheme, name);

                var header = headerDecoColumn.find("[scheme='" + tempScheme["id"] + "']");
                header.children("i").text(tempScheme["name"]);

                editorContainer.hide();
                editorContainer.find("tbody").empty();
                codeEditorManager.bindAddCodeButtonListener();
                editorContainer.find("#scheme-name-input").val("");
                scrollbarManager.redraw(newDataset, newId);
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

            tempScheme["name"] = editorContainer.find("#scheme-name-input").val(); //todo codeobject should just have all this saved already

            // update header in message view
            var header = headerDecoColumn.find("[scheme='" + tempScheme["id"] + "']");
            header.children("i").text(tempScheme["name"]);



            /*
            $(".message").each(function (i, row) {
                var dropdown = $(row).find("." + tempScheme["id"]);
                var options = dropdown.children().not(".unassign");

                var shorterLength = options.length > tempScheme.codes.size ? tempScheme.codes.size : options.length;
                var j = 0;
                var codes = Array.from(tempScheme.codes.values());
                while (j < shorterLength) {
                    var optionId = $(options[j]).attr("id");
                    var text = $(options[j]).text();
                    var selected = dropdown.val();


                    if (codes[j]["id"] === optionId) { // todo fix
                        if (selected === text) {
                            $(row).children("td").each(function(i, td) {
                                $(td).css("background-color", codes[j]["color"]); //todo fix
                            });
                        }
                        $(options[j]).text(codes[j]["value"]); //todo fix

                    } else {
                        if (selected === text) {
                            dropdown.val("");
                            dropdown.removeClass("coded");
                            dropdown.addClass("uncoded");
                            $(row).children("td").each(function(i, td) {
                                $(td).css("background-color", "#ffffff");
                            });
                        }
                        $(options[j]).attr("id", codes[j]["id"]); //todo fix
                        $(options[j]).text(codes[j]["value"]); //Todo fix
                    }

                    j++;
                }

                if (options.length < tempScheme.codes.size) {

                    var newCodes = codes.slice(options.length-1, tempScheme.codes.size);
                    newCodes.forEach(function(codeObj) {
                        $("<option id='" + codeObj["id"] + "'>" + codeObj["value"] + "</option>").insertBefore(dropdown.children(".unassign"));
                    });

                }

                if (options.length > tempScheme.codes.size) {

                    options = options.slice(tempScheme.codes.size, options.length);
                    options.each(function(i, option) {
                        if ($(option).text() === selected) {
                            dropdown.val("");
                            dropdown.removeClass("coded");
                            dropdown.addClass("uncoded");
                            $(row).children("td").each(function(i, td) {
                                $(td).css("background-color", "#ffffff");
                            });
                        }
                        $(option).remove();
                    });
                }
            });
            */
            //tempScheme.codes = tempScheme.codes.filter(function(code) { return code !== ""; });
            //schemes[tempScheme["id"]] = tempScheme; // TODO NOOOOOOO MUST NOT DO THIS PLS
            schemes[tempScheme["id"]].copyCodesFrom(tempScheme);
            scrollbarManager.redraw(newDataset, tempScheme["id"]);

            // redraw rows
            var tbody = "";
            var sessions = newDataset.sessions;
            //var startOfPage = messageViewerManager.tablePages[messageViewerManager.lastLoadedPageIndex[0]].start;
            //var endOfPage = messageViewerManager.tablePages[messageViewerManager.lastLoadedPageIndex[1]].end;

            /*
            for (var i = startOfPage[0]; i <= endOfPage[0]; i++) {
                var events = sessions[i]["events"];
                var eventsToPrint = (i == endOfPage[0]) ? endOfPage[1] : events.length-1;
                for (var j = 0; j <= eventsToPrint; j++) {
                    if (i === startOfPage[0] && j < startOfPage[1]) continue;
                    else tbody += messageViewerManager.buildRow(sessions[i]["events"][j], j, i);
                }
            }
            */

            let halfPage = Math.floor(messageViewerManager.rowsInTable / 2);
            for (let i = (messageViewerManager.lastLoadedPageIndex - 1) * halfPage; i < messageViewerManager.lastLoadedPageIndex + halfPage; i++) {
                tbody += messageViewerManager.buildRow(newDataset.events[i], i, newDataset.events[i].owner);
            }


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

        });

        cancelButton.on("click", function() {
            editorContainer.hide();
            editorContainer.find("tbody").empty();
            codeEditorManager.bindAddCodeButtonListener();
            $("#scheme-name-input").attr("value", "").val("");
            editorOpen = false;
            state.activeEditorRow = {};
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
        });


    },

    addCodeInputRow: function(code, shortcut, color, id, words) {

        var bindInputListeners = codeEditorManager.bindInputListeners;
        var codeObject;

        var newId = id;
        if (id.length === 0) {
            newId = tempScheme["id"] + "-" + UIUtils.randomId();
            codeObject = new Code(tempScheme, newId, code, color, shortcut, false)
            tempScheme.codes.set(newId, codeObject); // todo: fix owner when saving to parent scheme - what does this mean
        }

        $(".code-row").each(function(i,row) {$(row).removeClass("active")});

        var row = $("<tr class='row active code-row' id='" + newId + "'></tr>").insertBefore($(".add-code-row"));
        state.activeEditorRow = row;

        var codeCell = $("<td class='col-md-6'></td>").appendTo(row);
        var shortcutCell = $("<td class='col-md-5'></td>").appendTo(row);
        var buttonCell = $("<td class='col-md-1'></td>").appendTo(row);

        var codeInput = $("<input type='text' class='form-control code-input' placeholder='enter code...' value='" + code + "'>")
            .appendTo(codeCell);

        shortcut = ("" + shortcut).length > 0 ? String.fromCharCode(shortcut) : "";
        var shortcutInput = $("<input type='text' class='form-control shortcut-input' placeholder='type shortcut key...' value='" +
            shortcut + "'>")
            .appendTo(shortcutCell);

        var button = $("<button type='button' class='btn btn-danger delete-code'>" +
            "<i class='glyphicon glyphicon-remove'></i>" +
            "</button>").appendTo(buttonCell);


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
                let textAreaParent = $("#word-textarea").parent();
                textAreaParent.empty().append("<div id='word-textarea'></div>");
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

        var color = codeObj["color"].length > 0 ? codeObj["color"] : "#ffffff";
        let words = codeObj["words"].length > 0 ? codeObj["words"].splice(0) : [];
        let colorPicker = $("#color-pick");
        var wordTextarea = $("#word-textarea");
        colorPicker.find("input").attr("value", color);
        colorPicker.colorpicker('setValue', color);


        wordTextarea.tags({
            tagData: words,
            caseInsensitive: true,
            tagSize: "sm",
            promptText: "Type here to add new words",
            afterAddingTag: function(tag) {
                // can't add to the same array used for "tag data"!!!!!
                codeObj["words"] = [tag];
                wordTextarea.find(".tag").css({"background-color": color, "color": "black"});

            },
            afterDeletingTag: function(tag) {
                codeObj.deleteWords([tag]);
            }
        });

        wordTextarea.find(".tag").css({"background-color": color, "color": "black"});

/*
        wordTextarea.tags({
            caseInsensitive: true,
            tagSize: "sm",
            promptText: "Type here to add new words",
        });

        for (let word of wordTextarea.tags().getTags()) {
            wordTextarea.tags().removeTag(word);
        }

        wordTextarea.tags().afterAddingTag = function(tag) {
            // can't add to the same array used for "tag data"!!!!!
            codeObj["words"] = [tag];
        };

        wordTextarea.tags().afterDeletingTag = function(tag) {
            codeObj.deleteWords([tag]);
        };

        for (let word of words) {
            wordTextarea.tags().addTag(word);
        }

        let tagsInput = wordTextarea.find(".tags-input");
        if (parseInt(tagsInput.css("width"),10) <= 0) {

            tagsInput.css("width", wordTextarea.css("width"));

        }
        */
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
                    var newCodeId = tempScheme["id"] + "-" + UIUtils.randomId(schemes[tempScheme["id"]].codes);
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

        });

    }
};