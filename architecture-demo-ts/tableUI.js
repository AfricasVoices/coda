/**
 * Created by fletna on 28/10/16.
 */

var dataset;

$("body").hide();

$.getJSON("data/sessions.json", function(data) {
    dataset = data;
    var messagePanel = $("#message-panel");
    var codeEditorPanel = $("#code-editor-panel");
    var editorRow = $("#editor-row");

    messageViewerManager.init(messagePanel, dataset);

    $('#message-table').stickyTableHeaders({scrollableArea: messagePanel});
    $('#code-table').stickyTableHeaders({scrollableArea: editorRow});

    editorRow.css("height", codeEditorPanel.outerHeight(true) - codeEditorPanel.find(".panel-heading").outerHeight(true) - $('#panel-row').outerHeight(true) - $('#button-row').outerHeight(true) - 10);
    codeEditorPanel.resizable({
        handles: "nw",
        minWidth: 500,
        minHeight: 500
    });
    codeEditorManager.init($("#code-editor"));

    $("body").show();
});

/*
var buildTable = function(data) {
    Object.keys(data).forEach(function(sessionKey) {
        var events = dataset[sessionKey]["events"];
        events.forEach(function(event) {
            var eventRow = $("<tr></tr>").appendTo("#message-table > tbody");
            eventRow.append("<td class='col-md-2'>" + event["timestamp"] + "</td>");
            eventRow.append("<td class='col-md-6'>" + event["data"] + "</td>");

            var decoColumn = $("<td class=col-md-4><div class='row'></div></td>").appendTo(eventRow);
            var decoNumber = Object.keys(event["decorations"]).length;
            var decoColumnWidth = (12/decoNumber>>0);

            Object.keys(event["decorations"]).forEach(function(decoKey) {
                // make it a div rather than a td to not conflict with table styling
                eventRow.append("<div class='col-md-" + decoColumnWidth + "'>" + event["decorations"][decoKey] + "</div>");
            });
        });
    });
};
*/

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

        /*
        Build header
         */
        availableSchemes.forEach(function(scheme) {
            var decoColumn = $("#decoration-column");
            var col = $("<div class='col-md-" + decoColumnWidth + "'>" + scheme["name"] + "</div>").appendTo(decoColumn.find(".row"));

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
                var decoCell =  $("<div class='row'></div>").appendTo(decoColumn);


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
                });
            });


        });
/*
        Object.keys(availableLabels).forEach(function(decoKey) {
            availableLabels[decoKey].forEach(function(label) {
                $("select." + decoKey).append("<option>" + label + "</option>");
            });
        });
*/

   /*     Object.keys(data).forEach(function(sessionKey) {
            var events = dataset[sessionKey]["events"];
            events.forEach(function(event) {
                Object.keys(event["decorations"]).forEach(function(decoKey) {
                    $("select." + decoKey).val(event["decorations"][decoKey]);
                });
            });
        }); */
    },

    addNewScheme: function(scheme) {
        var decorationCell = $("#decoration-column").find(".row");
        var numberOfDecorations = decorationCell.find("div[class*=col-]").length + 1;
        var newDecoColumnWidth = (12/numberOfDecorations>>0);

        var div = ($("<div class='col-md-" + newDecoColumnWidth + "'>" + scheme["name"] + "</div>")).appendTo(decorationCell);
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
        $(editButton).on("click", function() {
            scheme["codes"].forEach(function(code) {
                codeEditorManager.addCodeInputRows(code, "");
            });

            $("#scheme-name-input").attr("value", scheme["name"]);
            $("#code-editor").show();

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
            $(editorContainer).show();
        });

        saveSchemeButton.on("click", function() {
            var inputFields = editorContainer.find("input[class='form-control code-input']");
            var codes = [];

            inputFields.each(function(index, input) {
               codes.push($(input).val());
            });

            var name = editorContainer.find("#scheme-name-input").val();

            messageViewerManager.addNewScheme({"name": name, "codes": codes});
            $(editorContainer).hide();
            $(editorContainer).find("tbody").empty();
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

        });

        cancelButton.on("click", function() {
            editorContainer.hide();
            editorContainer.find("tbody").empty();
            $("#scheme-name-input").attr("value", "").val("");
        });


    },

    bindAddCodeButtonListener: function() {

        var addCodeInputRows = this.addCodeInputRows;

        this.addCodeButton.on("click", function() {
            addCodeInputRows("","");
        });


            /*function(event) {
            var row = $("<tr class='row'></tr>").appendTo(codeTable);
            var codeCell = $("<td class='col-md-6'></td>").appendTo(row);
            var shortcutCell = $("<td class='col-md-6'></td>").appendTo(row);

            var codeCellInput = $("<div class='input-group'>" +
                "<input type='text' class='form-control code-input' placeholder='enter code...'>" +
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
                "<input type='text' class='form-control shortcut-input' placeholder='type shortcut key...'>" +
                "<div class='input-group-btn'>" +
                "<button type='button' class='btn btn-success'>" +
                "<i class='glyphicon glyphicon-ok'></i>" +
                "</button>" +
                "<button type='button' class='btn btn-danger'>" +
                "<i class='glyphicon glyphicon-remove'></i>" +
                "</button>" +
                "</div>" +
                "</div>").appendTo(shortcutCell);

            codeCellInput.find(".btn-default").hide();
            shortcutCellInput.find(".btn-default").hide();
            codeCellInput.find("input").focus();

            bindInputListeners(codeCellInput);
            bindInputListeners(shortcutCellInput);


        });*/
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

        codeCellInput.find(".btn-default").hide();
        shortcutCellInput.find(".btn-default").hide();
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
            acceptButton.show();
            rejectButton.show();
        });

    }


};