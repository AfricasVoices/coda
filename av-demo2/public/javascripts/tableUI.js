/**
 * Created by fletna on 28/10/16.
 */

var dataset;

$.getJSON("../sessions-test.json", function(data) {
    dataset = data;
    buildTable();
    $('#message-table').stickyTableHeaders({scrollableArea: $("#message-panel")});
    $('#code-table').stickyTableHeaders({scrollableArea: $("#editor-row")});
    $('#editor-row').css("height", $('#code-editor-panel').outerHeight(true) - $('#code-editor-panel > .panel-heading').outerHeight(true) - $('#panel-row').outerHeight(true) - $('#button-row').outerHeight(true) - 10);
    $( "#code-editor-panel" ).resizable({
        handles: "nw",
        minWidth: 500,
        minHeight: 500

    });
    codeEditorManager.init($("#code-editor"));
});

var buildTable = function() {
    Object.keys(dataset).forEach(function(sessionKey) {
        var events = dataset[sessionKey]["events"];
        events.forEach(function(event) {
            var eventRow = $("<tr></tr>").appendTo("#message-table > tbody");
            eventRow.append("<td class='col-md-2'>" + event["timestamp"] + "</td>")
            eventRow.append("<td class='col-md-6'>" + event["data"] + "</td>");

            var decoColumn = $("<td class=col-md-4><div class='row'></div></td>").appendTo(eventRow);
            var decoNumber = Object.keys(event["decorations"]).length;
            var decoColumnWidth = (12/decoNumber>>0);

            Object.keys(event["decorations"]).forEach(function(decoKey) {
                decoColumn.append("<td class='col-md-" + decoColumnWidth + "'>" + event["decorations"][decoKey] + "</td>");
            });
        });
    });
};

var messageViewerManager = {
    messageContainer: {},
    table: {},

    init: function() {

    },

    buildTable: function(data) {
        Object.keys(data).forEach(function(sessionKey) {
            var events = dataset[sessionKey]["events"];
            events.forEach(function(event) {
                var eventRow = $("<tr></tr>").appendTo("#message-table > tbody");
                eventRow.append("<td class='col-md-2'>" + event["timestamp"] + "</td>")
                eventRow.append("<td class='col-md-6'>" + event["data"] + "</td>");

                var decoColumn = $("<td class=col-md-4><div class='row'></div></td>").appendTo(eventRow);
                var decoNumber = Object.keys(event["decorations"]).length;
                var decoColumnWidth = (12/decoNumber>>0);
                var availableLabels = [];

                Object.keys(event["decorations"]).forEach(function(decoKey) {
                    var td = $("<td class='col-md-" + decoColumnWidth + "'>" + event["decorations"][decoKey] + "</td>").appendTo(decoColumn);
                    var input = $("<select class='form-control'></select>").appendTo(td);
                    availableLabels.forEach(function(label) {

                    });
                });
            });
        });
    },

    addNewScheme: function(scheme) {

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
        this.editorContainer = editorContainer;
        this.editorPanel = this.editorContainer.find(".panel");
        this.codeTable = this.editorPanel.find("tbody");
        this.addCodeButton = this.editorPanel.find("#add-code");
        this.closeEditorButton = this.editorPanel.find("#close-editor");
        this.cancelEditorButton = this.editorPanel.find("#cancel-button");
        this.addSchemeButton = $("#add-scheme");
        this.saveSchemeButton = this.editorPanel.find("#scheme-save-button")
        this.bindAddButtonListener();
        this.bindCloseDialogListeners();

        $(editorContainer).hide();
    },

    bindAddSchemeListeners: function() {
        var editorContainer = this.editorContainer;
        var addSchemeButton = this.addSchemeButton;
        var saveSchemeButton = this.saveSchemeButton;

        addSchemeButton.on("click", function() {
            $(editorContainer).show();
        });

        saveSchemeButton.on("click", function() {

        });

    },

    bindCloseDialogListeners: function() {
        var editorContainer = this.editorContainer;
        var closeButton = this.closeEditorButton;
        var cancelButton = this.cancelEditorButton;


        closeButton.on("click", function() {
            editorContainer.hide();
        });

        cancelButton.on("click", function() {
           editorContainer.hide();
        });


    },

    bindAddButtonListener: function() {

        var bindInputListeners = this.bindInputListeners;
        var codeTable = this.codeTable;

        this.addCodeButton.on("click", function(event) {
            var row = $("<tr class='row'></tr>").appendTo(codeTable);
            var codeCell = $("<td class='col-md-6'></td>").appendTo(row);
            var shortcutCell = $("<td class='col-md-6'></td>").appendTo(row);

            var codeCellInput = $("<div class='input-group'>" +
                "<input type='text' class='form-control'>" +
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
                "<input type='text' class='form-control'>" +
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


        });
    },

    bindInputListeners: function(inputGroup) {
        var inputField = $(inputGroup).find(".form-control");
        var acceptButton = $(inputGroup).find(".btn-success");
        var rejectButton = $(inputGroup).find(".btn-danger");

        acceptButton.on("click", function(){
            $(this).hide();

            rejectButton.hide();

            inputField.attr("value", inputField.val());
            inputField.attr("readonly","");
        });

       rejectButton.on("click", function(){
           $(this).hide();

           acceptButton.hide();

           inputField.val(inputField.attr("value"));
           inputField.attr("readonly","");
        });

        inputField.on("click", function(){
            acceptButton.show();
            rejectButton.show();
            inputField.removeAttr("readonly");

        });

    }


}