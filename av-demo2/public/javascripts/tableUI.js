/**
 * Created by fletna on 28/10/16.
 */

var dataset;

$.getJSON("../sessions.json", function(data) {
    dataset = data;
    buildTable();
    $('#message-table').stickyTableHeaders({scrollableArea: $("#message-panel")});
    $( "#code-editor-panel" ).resizable({
        handles: "nw",
        minWidth: 500,
        minHeight: 500

    });
    codeEditorManager.init($("#code-editor-panel"));
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

var codeEditorManager =  {

    editorPanel: {},
    codeTable: {},
    addButton: {},

    init: function(editorElement) {
        this.editorPanel = editorElement;
        this.codeTable = this.editorPanel.find("tbody");
        this.addButton = this.editorPanel.find("#add-code");
        this.bindAddButtonListener();
    },

    bindAddButtonListener: function() {

        var bindInputListeners = this.bindInputListeners;
        var codeTable = this.codeTable;

        this.addButton.on("click", function(event) {
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