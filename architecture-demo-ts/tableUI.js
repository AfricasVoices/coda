var dataset;
var editorOpen;
var activeRow;
var UIUtils = UIUtils;
var codeEditorPanel = $("#code-editor-panel");

// need to set height of editor before hiding the body & we hide the body before loading the data
$("#editor-row").css("height", codeEditorPanel.outerHeight(true) - codeEditorPanel.find(".panel-heading").outerHeight(true) - $('#panel-row').outerHeight(true) - $('#button-row').outerHeight(true) - 10);
$("body").hide();

$.getJSON("data/sessions.json", function(data) {
    dataset = data;
    var messagePanel = $("#message-panel");
    var editorRow = $("#editor-row");


    messageViewerManager.init(messagePanel, dataset);

    $('#message-table').stickyTableHeaders({scrollableArea: messagePanel});
    $('#code-table').stickyTableHeaders({scrollableArea: editorRow});

    codeEditorPanel.resizable({
        handles: "nw",
        minWidth: 500,
        minHeight: 500
    });
    codeEditorManager.init($("#code-editor"));

    $("body").show();
});

var messageViewerManager = {
    messageContainer: {},
    table: {},

    init: function(messageContainer, data) {
        this.messageContainer = messageContainer;
        this.table = messageContainer.find("table");
        this.buildTable(data);
    },

    buildTable: function(data) {
        var availableSchemes = [{"name": "type", "codes": ["Incoming", "Outgoing", "Unknown"]}];
        var decoNumber = Object.keys(availableSchemes).length;
        var decoColumnWidth = (12/decoNumber>>0);
        var bindEditCodeschemeListener = this.bindEditSchemeButtonListener;
        var messagePanel = this.messageContainer;

        /*
        Build header
         */
        availableSchemes.forEach(function(scheme) {
            var decoColumn = $("#header-decoration-column");
            var col = $("<div class='col-md-" + decoColumnWidth + "'><i>" + scheme["name"] + "</i></div>").appendTo(decoColumn.find(".row"));

            var button = $("<button type='button' class='btn btn-default btn-xs edit-scheme-button'>" +
                "<i class='glyphicon glyphicon-edit'>" +
                "</i>" +
                "</button>").appendTo(col);

            bindEditCodeschemeListener(button, scheme);
        });



        /*
        Build rows
         */

        Object.keys(data).forEach(function(sessionKey) {
            var events = dataset[sessionKey]["events"];
            events.forEach(function(event) {
                var eventRow = $("<tr></tr>").appendTo("#message-table > tbody");
                eventRow.append("<td class='col-md-2'>" + event["timestamp"] + "</td>");
                eventRow.append("<td class='col-md-6'>" + event["data"] + "</td>");
                var decoColumn = $("<td class=col-md-4></td>").appendTo(eventRow);
                var decoCell =  $("<div class='row decorator-column'></div>").appendTo(decoColumn);


                //$("<td class=col-md-4><div class='row'></div></td>").appendTo(decoCell);

                Object.keys(event["decorations"]).forEach(function(decoKey) {

                    if (!availableSchemes.hasOwnProperty(decoKey)) {
                        availableSchemes[decoKey] = [];
                    }

                    if (availableSchemes[decoKey].indexOf(event["decorations"][decoKey]) === -1) {
                        availableSchemes[decoKey].push(event["decorations"][decoKey]);
                    }

                    var div = $("<div class='col-md-" + decoColumnWidth + "'></div>").appendTo(decoCell);
                    var input = $("<select class='form-control " + decoKey + "'></select>").appendTo(div);

                    var currentScheme = availableSchemes.filter(function(scheme) {return scheme["name"] === decoKey;})[0];
                    currentScheme["codes"].forEach(function(code) {
                       input.append("<option>" + code + "</option>");
                    });

                    input.val(event["decorations"][decoKey]);
                    if (event["decorations"][decoKey].length === 0) {
                        eventRow.addClass("uncoded");
                    }

                });
            });
        });


        /*
        ACTIVE ROW HANDLING
        */

        // init
        activeRow = this.table.find("tbody").find("tr:first");
        activeRow.toggleClass("active");


        // click select
        this.table.on('click', 'tbody tr', function() {
            $(this).addClass('active').siblings().removeClass('active');
            activeRow = $(this);
        });


        // keyboard nav
        $(document).on('keydown', function(event) {

            if (!editorOpen) {

                if (event.keyCode == 38) { // UP
                    var prev = activeRow.prev();

                    if (prev.length !== 0) {
                        activeRow.removeClass('active');
                        activeRow = prev.addClass('active');

                        if (!UIUtils.isRowVisible(prev[0], $("#message-panel")[0])) {

                        }

                    }
                }

                if (event.keyCode == 40) { // DOWN
                    var next = activeRow.next();

                    if (next.length !== 0) {
                        activeRow.removeClass('active');
                        activeRow = activeRow.next().addClass('active');
                    }
                }
            }

            if (event.keyCode == 13) { // ENTER
                activeRow.toggleClass("active");


                // get next row and make it active
                activeRow = UIUtils.nextUnfilledRow(activeRow, true);
                activeRow.toggleClass("active");


                var isVisible = UIUtils.isRowVisible(activeRow[0], messagePanel[0]);

                if (!isVisible) {
                    UIUtils.scrollRowToTop(activeRow[0], messagePanel[0]);
                }
            }

        });

    },

    addNewScheme: function(scheme) {
        var decorationCell = $("#header-decoration-column").find(".row");
        var numberOfDecorations = decorationCell.find("div[class*=col-]").length + 1;
        var newDecoColumnWidth = (12/numberOfDecorations>>0);

        var div = ($("<div class='col-md-" + newDecoColumnWidth + "'><i>" + scheme["name"] + "</i></div>")).appendTo(decorationCell);
        var button = $("<button type='button' class='btn btn-default btn-xs edit-scheme-button'>" +
        "<i class='glyphicon glyphicon-edit'>" +
        "</i>" +
        "</button>").appendTo(div);

        this.bindEditSchemeButtonListener(button, scheme);

        decorationCell.find("div[class*=col-]").attr("class", "col-md-" + newDecoColumnWidth);

        this.table.find("tbody > tr").each(function(index, row) {

            var decoCell = $(row).children("td:last").find(".row");

            // keep it a div instead of td so styles dont conflict
            var div = $("<div class='col-md-" + newDecoColumnWidth + "'></div>").appendTo(decoCell);
            var input = $("<select class='form-control'></select>").appendTo(div);

            scheme["codes"].forEach(function(code) {
                input.append("<option>" + code + "</option>");
            });
        });

        this.table.find("tbody > tr").each(function(index, row) {
            var decoCell = $(row).children("td:last");
            decoCell.find("div[class*=col-]").attr("class", "col-md-" + newDecoColumnWidth);
        });

    },

    bindEditSchemeButtonListener: function(editButton, scheme) {

        var codeEditor = $("#code-editor");

        $(editButton).on("click", function() {

                if (!(codeEditor.is(":visible"))) {

                    editorOpen = true;

                    scheme["codes"].forEach(function(code) {
                        codeEditorManager.addCodeInputRows(code, "");
                        $(".shortcut-input").siblings("div").hide();
                    });

                    var index;
                    $(this).closest(".row").find("div").each(function(i, columnDiv) {
                        if ($(columnDiv).text() === scheme["name"])
                            index = i;
                    });

                    codeEditorManager.bindSaveEditListener(index);

                    $("#scheme-name-input").val(scheme["name"]);
                    codeEditor.show();
                }

                codeEditor.find(".code-input").each(function(i, el) {
                   $(el).siblings(".input-group-btn").hide();
                });

                codeEditor.find(".shortcut-input").each(function(i, el) {
                    $(el).siblings(".input-group-btn").hide();
                });
        });
    }

};

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
        this.bindAddCodeButtonListener();
        this.bindCloseDialogListeners();
        this.bindAddSchemeListeners();

    },

    bindAddSchemeListeners: function() {
        var editorContainer = this.editorContainer;
        var addSchemeButton = this.addSchemeButton;
        var saveSchemeButton = this.saveSchemeButton;

        addSchemeButton.on("click", function() {
            saveSchemeButton.one("click", function() {
                var inputFields = editorContainer.find("input[class='form-control code-input']");
                var codes = [];

                inputFields.each(function(index, input) {
                    codes.push($(input).val());
                });

                var name = editorContainer.find("#scheme-name-input").val();

                messageViewerManager.addNewScheme({"name": name, "codes": codes});
                editorContainer.hide();
                editorContainer.find("tbody").empty();
                editorContainer.find("#scheme-name-input").val("");
                editorOpen = true;
            });

            $(editorContainer).show();
            editorOpen = true;
        });

    },


    bindSaveEditListener: function(index) {
        var editorContainer = this.editorContainer;
        var oneIndexed = index + 1;
        var headerDecoColumn = $("#header-decoration-column");

        $("#scheme-save-button").one("click", function () {

            var codes = [], shortcuts = [];

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
                shortcuts: shortcuts
            };

            var header = headerDecoColumn.find("div[class*='col-']:nth-child(" + oneIndexed + ")");
            header.find("i:first").text(newScheme["name"]);

            $(".decorator-column").each(function (i, row) {
                var dropdown = $(row).find(":nth-child(" + oneIndexed + ") > select");
                var options = $(dropdown).children();

                options.each(function(i, option) {

                    $(option).text(newScheme["codes"][i]);

                });
            });


            headerDecoColumn.find("button").off("click"); // turn off old listener and bind new one
            messageViewerManager.bindEditSchemeButtonListener(headerDecoColumn.find("button"), newScheme);

            editorContainer.find("tbody").empty();
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
            $("#scheme-name-input").attr("value", "").val("");
            editorOpen = false;
        });

        cancelButton.on("click", function() {
            editorContainer.hide();
            editorContainer.find("tbody").empty();
            $("#scheme-name-input").attr("value", "").val("");
            editorOpen = false;
        });


    },

    bindAddCodeButtonListener: function() {

        var addCodeInputRows = this.addCodeInputRows;

        this.addCodeButton.on("click", function() {
            addCodeInputRows("","");
        });
    },

    addCodeInputRows: function(code, shortcut) {

        var bindInputListeners = codeEditorManager.bindInputListeners;
        var codeTable = codeEditorManager.codeTable;

        var row = $("<tr class='row'></tr>").appendTo(codeTable);
        var codeCell = $("<td class='col-md-6'></td>").appendTo(row);
        var shortcutCell = $("<td class='col-md-6'></td>").appendTo(row);

        var codeCellInput = $("<div class='input-group'>" +
            "<input type='text' class='form-control code-input' placeholder='enter code...' value='" + code + "'>" +
            "<div class='input-group-btn'>" +
            "<button type='button' class='btn btn-success'>" +
            "<i class='glyphicon glyphicon-ok'></i>" +
            "</button>" +
            "<button type='button' class='btn btn-danger'>" +
            "<i class='glyphicon glyphicon-remove'></i>" +
            "</button>" +
            "</div>" +
            "</div>").appendTo(codeCell);

        var shortcutCellInput = $("<div class='input-group'>" +
            "<input type='text' class='form-control shortcut-input' placeholder='type shortcut key...' value='" + shortcut + "'>" +
            "<div class='input-group-btn'>" +
            "<button type='button' class='btn btn-success'>" +
            "<i class='glyphicon glyphicon-ok'></i>" +
            "</button>" +
            "<button type='button' class='btn btn-danger'>" +
            "<i class='glyphicon glyphicon-remove'></i>" +
            "</button>" +
            "</div>" +
            "</div>").appendTo(shortcutCell);


        codeCellInput.find("input").focus();

        bindInputListeners(codeCellInput);
        bindInputListeners(shortcutCellInput);
    },


    bindInputListeners: function(inputGroup) {
        var inputField = $(inputGroup).find(".form-control");
        var acceptButton = $(inputGroup).find(".btn-success");
        var rejectButton = $(inputGroup).find(".btn-danger");

        acceptButton.on("click", function(){
            $(this).hide();
            rejectButton.hide();
            inputField.attr("value", inputField.val());
        });

       rejectButton.on("click", function(){
           $(this).hide();
           acceptButton.hide();
           inputField.val(inputField.attr("value"));
        });

        inputField.on("click", function(){

            var inputClass = inputField.attr("class").split(' ')[1];
            $("." + inputClass).each(function(i, element) {
                $(element).siblings(".input-group-btn").hide();
            });

            $(inputGroup).find(".input-group-btn").show();
        });

    }
};