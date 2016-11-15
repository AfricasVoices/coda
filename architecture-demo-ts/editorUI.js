
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
                var code = Array.from(tempScheme.codes.values())[$(state.activeEditorRow).attr("id")];
                code.color = event.color.toHex();
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

        addSchemeButton.on("click", function() {

            // TODO: cleverly assign scheme ids
            var newId = 10;
            while (Object.keys(schemes).indexOf(newId) !== -1) {
                newId = Math.floor(Math.random()*100);
            }

            tempScheme = new CodeScheme(newId, "");


            saveSchemeButton.one("click", function() {

                //var name = editorContainer.find("#scheme-name-input").attr("value");
                //tempScheme.name = editorContainer.find("#scheme-name-input").attr("value");


                var codeInputFields = editorContainer.find("input[class='form-control code-input']");
                var shortcutInputFields = editorContainer.find("input[class='form-control shortcut-input']");

                var codes = [];
                var shortcuts = [];

                codeInputFields.each(function(index, input) {
                    if ($(input).val().length > 0)
                        codes.push($(input).val());
                        shortcuts.push($(shortcutInputFields[index]).val());
                });

                //messageViewerManager.addNewScheme({"name": name, "codes": codes});
                messageViewerManager.addNewScheme(new CodeScheme(newId), name);
                state.schemes[name] = {"name": name, "codes": codes};

                editorContainer.hide();
                editorContainer.find("tbody").empty();
                editorContainer.find("#scheme-name-input").val("");
                editorOpen = true;

                codeEditorManager.bindAddCodeButtonListener(editorContainer.find("tbody"));

            });

            $("#scheme-name-input").prop("readonly", false);
            $(editorContainer).show();
            editorOpen = true;
            $("#scheme-name-input").focus();
        });

    },


    bindSaveEditListener: function(index) {
        var editorContainer = this.editorContainer;
        var oneIndexed = index + 1;
        var headerDecoColumn = $("#header-decoration-column");

        $("#scheme-save-button").one("click", function () {

            var codes = [], shortcuts = [], colors = [];

            /*
             editorContainer.find(".code-row").each(function(index, row) {
             codes.push($(row).find(".code-input").val());
             codes.push(UIUtils.ascii($(row).find(".shortcut-input").val()));
             colors.push($(row).css("background-color"));

             });
             */
            var codeOrder = Array.from(tempScheme.codes.keys()); // ????? whatever todo fix this

            codeOrder.forEach(function(codeIndex) {
                var row = editorContainer.find("tr[id='" + codeIndex + "']");

                if (row.length > 0) {
                    if (tempScheme.codes.has(codeIndex)) {
                        var code = tempScheme.codes.get(codeIndex);
                        code.value = row.find(".code-input").val();

                        var shortcut = row.find(".shortcut-input").val();
                        if (shortcut.length > 0) {
                            code.shortcut = UIUtils.ascii(row.find(".shortcut-input").val());
                        }
                    }
                }
            });

            tempScheme["name"] = editorContainer.find("#scheme-name-input").val();



// TODO: jquery each is slow
            var inputFields = editorContainer.find("input[class='form-control code-input']");
            inputFields.each(function(index, input) {
                codes.push($(input).val());
            });

            var shortcutFields = editorContainer.find("input[class='form-control shortcut-input']");
            shortcutFields.each(function(index, shortcut) {
                shortcuts.push(UIUtils.ascii($(shortcut).val()));
            });

            var newScheme = {
                name: editorContainer.find("#scheme-name-input").val(),
                codes: codes,
                shortcuts: shortcuts,
            };

            state.schemes[newScheme["name"]] = newScheme;

            //var header = headerDecoColumn.find("div[class*='col-']:nth-child(" + oneIndexed + ")");
            //header.find("i:first").text(newScheme["name"]);

            var header = headerDecoColumn.find("#header" + tempScheme["id"]);
            header.children("i").text(tempScheme["name"]);

            /*
            $(".decorator-column").find(".form-control " + tempScheme["id"]).each(function (i, row) {
                var dropdown = $(row).find(":nth-child(" + oneIndexed + ") > select");
                var options = $(dropdown).children();

                options.each(function(i, option) {

                    $(option).text(newScheme["codes"][i]);

                });
            });
*/

            // TODO detect which ones were edited vs added
            $(".message").each(function (i, row) {
                var dropdown = $(row).find("." + tempScheme["id"]);


                // same name, different color
                // renamed, same color
                // renamed, different color
                // gone

                var selected = dropdown.val();

                //                $(row).children("td").each(function(i, td) {


                Array.from(tempScheme.codes).forEach(function(code, i) {
                    var options = dropdown.children();
                    var option = options[i];
                    var text = $(option).text();
                    var color;

                    if (selected) {
                        if (text === selected) {
                            var codeObj = code[1];

                            if (option && codeObj.edited) {
                                color = tempScheme.codes.get(i)["color"];

                            } else if (option && !codeObj.edited) {
                                dropdown.val("");
                                color = schemes[tempScheme["id"]].getCodeByValue(selected)["color"];
                            } else {
                                option = ("<option>" + codeObj["value"] + "</option>").appendTo(dropdown);
                            }

                            $(row).children("td").each(function(i, td) {
                                if (color.length > 0) {
                                    $(td).css("background-color", color);
                                } else {
                                    $(td).css("background-color", "#ffffff");
                                }
                            });

                        }
                    }
                    $(option).text(tempScheme["codes"].get(i)["value"]);

                });


                });







            schemes[tempScheme["id"]] = tempScheme;

            //var button = headerDecoColumn.find("button")[index]; // raw element


            //$(button).off("click"); // turn off old listener and bind new one
            //messageViewerManager.bindEditSchemeButtonListener( $(button), newScheme);

            editorContainer.find("tbody > tr").not().empty();
            editorContainer.hide();
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
            codeEditorManager.bindAddCodeButtonListener(editorContainer.find("tbody"));
            $("#scheme-name-input").attr("value", "").val("");
            editorOpen = false;
            state.activeEditorRow = {};

        });

        cancelButton.on("click", function() {
            editorContainer.hide();
            editorContainer.find("tbody").empty();
            codeEditorManager.bindAddCodeButtonListener(editorContainer.find("tbody"));
            $("#scheme-name-input").attr("value", "").val("");
            editorOpen = false;
            state.activeEditorRow = {};

        });


    },

    bindAddCodeButtonListener: function(tableBody) {

        var addCodeInputRow = codeEditorManager.addCodeInputRow;

        $(tableBody).append('<tr class="row add-code-row">' +
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
            addCodeInputRow("","", "#ffffff", parseInt($("tbody > .code-row:last").attr("id")) + 1);

        });
    },

    addCodeInputRow: function(code, shortcut, color, index) {

        if (!tempScheme.codes.get(index) && code.length > 0) {
            tempScheme.codes.set(index, new Code(tempScheme, code, color, shortcut)); // todo: fix owner when saving to parent scheme
        }

        var bindInputListeners = codeEditorManager.bindInputListeners;
        var codeTable = codeEditorManager.codeTable;

        $(".code-row").each(function(i,row) {$(row).removeClass("active")});

        var row = $("<tr class='row active code-row' id='" + index + "'></tr>").insertBefore($(".add-code-row"));
        state.activeEditorRow = row;

        var codeCell = $("<td class='col-md-6'></td>").appendTo(row);
        var shortcutCell = $("<td class='col-md-5'></td>").appendTo(row);
        var buttonCell = $("<td class='col-md-1'></td>").appendTo(row);

        var codeInput = $("<input type='text' class='form-control code-input' placeholder='enter code...' value='" + code + "'>")
            .appendTo(codeCell);

        var shortcutInput = $("<input type='text' class='form-control shortcut-input' placeholder='type shortcut key...' value='" + shortcut + "'>")
            .appendTo(shortcutCell);

        var button = $("<button type='button' class='btn btn-danger delete-code'>" +
            "<i class='glyphicon glyphicon-remove'></i>" +
            "</button>").appendTo(buttonCell);

        if (code.length != 0 && color.length != 0) {
            //row.css("background-color", color);
            $("#color-pick").colorpicker('setValue', color);
        } else {
            //row.css("background-color", "white");
            $("#color-pick").colorpicker('setValue', "#ffffff");

        }

        row.on("click", function() {
            state.activeEditorRow.removeClass("active");
            state.activeEditorRow = $(this);
            state.activeEditorRow.addClass("active");

            var code = Array.from(tempScheme.codes.values())[$(this).attr("id")];

            var color = code["color"].length > 0 ? code["color"] : "#ffffff";
            codeEditorManager.updateCodePanel(color);

        });

        codeInput.focus();
        bindInputListeners(row);
    },


    updateCodePanel: function(color) {

        var colorPicker = $("#color-pick");
        colorPicker.find("input").attr("value", color);
        colorPicker.colorpicker('setValue', color);

    },


    bindInputListeners: function(inputRow) {

        var inputRow = $(inputRow);
        var codeInput = inputRow.find(".code-input");
        var shortcutInput = inputRow.find(".shortcut-input");
        var deleteButton = inputRow.find(".delete-code");

        codeInput.on("keydown", function(event){
            if (event.keyCode === 13) {

                var index = $(this).parents("tr").attr("id");
                if (tempScheme.codes.get("index")) {

                } else {
                    tempScheme.codes.set($(this).val(), new Code(tempScheme, $(this).val(), "", ""));
                }
                // save changes in this field, move to shortcut field

                $(this).prop("readonly", true);
                $(this).attr("value", $(this).val());
                $(this).parents("tr").find(".shortcut-input")
                    .prop("readonly", false)
                    .focus();
            }
        });

        shortcutInput.on("keydown", function(event){
            if (event.keyCode === 13) {
                $(this).attr("value", $(this).val());
                $(this).prop("readonly", true);

                tempScheme.codes.get();

                var nextRow = $(this).parents("tr").next();

                if (nextRow.length > 0 && nextRow.attr("class") !== "row add-code-row") {
                    nextRow.find(".code-input")
                        .prop("readonly", false)
                        .focus();

                } else {
                    codeEditorManager.addCodeInputRow("","");
                    nextRow = $(this).parents("tr").next();
                    nextRow.find(".code-input")
                        .prop("readonly", false)
                        .focus();
                }
            }
        });

        codeInput.on("focusout", function(){

            var index = $(this).parents("tr").attr("id");
            var codeObj = Array.from(tempScheme.codes.values())[index];

            if (codeObj) {
                codeObj["value"] = ($(this).val());
            } else {
                if ($(this).val().length > 0) {
                    tempScheme.codes.set($(this).val(), new Code(tempScheme, $(this).val(), "#ffffff"), "");
                }
            }

            $(this).prop("readonly", true);

            /*
            var inputs = $(".shortcut-input").add($(".code-input"));


            inputs.each(function(index, input) {
                $(input).val($(input).attr("value"));
            });
            */
        });

        shortcutInput.on("focusout", function(){

            var index = $(this).parents("tr").attr("id");
            var codeObj = Array.from(tempScheme.codes.values())[index];

            if (codeObj && $(this).val().length > 0) {
                codeObj["shortcut"] = UIUtils.ascii($(this).val());
            }

            $(this).prop("readonly", true);


        });

        shortcutInput.on("click", function(){

            $(this).prop("readonly", false);

            /*
            var inputs = $(".shortcut-input").add($(".code-input"));

            inputs.each(function(index, input) {
                $(input).val($(input).attr("value"));
            });
            */
        });

        codeInput.on("click", function() {
            $(this).prop("readonly", false);


        });

        deleteButton.on("click", function() {

            // TODO: unbind shortcuts
            // TODO: remove code from dropdowns

            // TODO: stop relying on Map keys as indices...

            $(inputRow).remove();
            tempScheme.codes.delete(parseInt($(this).parents(".code-row").attr("id")));

        });

    }
};