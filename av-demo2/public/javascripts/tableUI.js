/**
 * Created by fletna on 28/10/16.
 */

var dataset;

$.getJSON("../sessions.json", function(data) {
    dataset = data;
    buildTable();
    $('table').stickyTableHeaders({scrollableArea: $(".panel")});

});

var buildTable = function() {
    Object.keys(dataset).forEach(function(sessionKey) {
        var events = dataset[sessionKey]["events"];
        events.forEach(function(event) {
            var eventRow = $("<tr></tr>").appendTo("tbody");
            eventRow.append("<td class=col-md-2>" + event["timestamp"] + "</td>")
            eventRow.append("<td class=col-md-6>" + event["data"] + "</td>");

            var decoColumn = $("<td class=col-md-4><div class='row'></div></td>").appendTo(eventRow);
            var decoNumber = Object.keys(event["decorations"]).length;
            var decoColumnWidth = (12/decoNumber>>0);


            Object.keys(event["decorations"]).forEach(function(decoKey) {
                decoColumn.append("<td class=col-md-" + decoColumnWidth + ">" + event["decorations"][decoKey] + "</td>");
            });
        });
    });

};