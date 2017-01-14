var dataset;
var newDataset;
var editorOpen;
var UIUtils = UIUtils;
var codeEditorPanel = $("#code-editor-panel");

var schemes = {};
var tempScheme = {};

var activeRow;
var activeSchemeId;


var state = {
    activeMessageRow: {},
    activeEditorRow: {},
    activeCell: {decoName: "type", index: "0"},
    schemes: {
        type: {"name": "type", "codes": ["Incoming", "Outgoing", "Unknown"], "colors": ["#2ecc71", "#9b59b6", "#e74c3c"]}
    }
};



// need to set height of editor before hiding the body & we hide the body before loading the data
$("#editor-row").css("height", codeEditorPanel.outerHeight(true) - codeEditorPanel.find(".panel-heading").outerHeight(true) - $('#panel-row').outerHeight(true) - $('#button-row').outerHeight(true) - 10);
$("body").hide();


// USE EITHER sessions--.json or sessions-numbered-10000.json for just numbers
$.getJSON("data/sessions-numbered-10000.json", function(data) {

    // todo ensure ALL IDs are unique
    var buildDataset = function(data) {

        var decorations = {};
        var eventCount = 0;

        var properDataset = new Dataset();
        Object.keys(data).forEach(function(sessionKey) {
            var events = [];
            Object.keys(data[sessionKey]["events"]).forEach(function(eventKey) {
                var event = new RawEvent(data[sessionKey]["events"][eventKey]["name"], sessionKey, data[sessionKey]["events"][eventKey]["timestamp"], "", data[sessionKey]["events"][eventKey]["data"]);
                properDataset.events.push(event);
                eventCount += 1;

                Object.keys(data[sessionKey]["events"][eventKey]["decorations"]).forEach(function (d) {

                    var decorationValue = data[sessionKey]["events"][eventKey]["decorations"][d];

                    if (!decorations.hasOwnProperty(d)) {
                        // TODO: how to do scheme ids
                        schemes[sessionKey] = new CodeScheme(sessionKey, d, true);
                        decorations[d] = sessionKey;
                    }

                    if (decorationValue.length > 0) {
                        var scheme = schemes[decorations[d]];
                        if (!schemes[decorations[d]].getCodeValues().has(decorationValue)) {
                            var newCodeId = sessionKey + "-" + UIUtils.randomId(Array.from(scheme.codes.keys()));
                            scheme.codes.set(newCodeId, new Code(scheme, newCodeId, decorationValue, "#ffffff", "", false));
                        }

                        var code = scheme.getCodeByValue(decorationValue);
                        event.decorate(decorations[d], code); // has to use decorations[d] as scheme key
                    }

                    /* TODO  write tests for this */

                });

                events.push(event);
            });

            var session = new Session(sessionKey, events);
            properDataset.sessions.push(session);
        });

        properDataset.schemes = schemes;
        properDataset.eventCount = eventCount;
        return properDataset;

    }(data);

    dataset = data;
    newDataset = buildDataset;

    console.time("TOTAL UI INITIALISATION TIME");
    var messagePanel = $("#message-panel");
    var editorRow = $("#editor-row");

    console.time("total messageview init");
    messageViewerManager.init(messagePanel, dataset);
    console.timeEnd("total messageview init");

    console.time("stickyheaders init");
    $('#message-table').stickyTableHeaders({scrollableArea: messagePanel});
    $('#code-table').stickyTableHeaders({scrollableArea: editorRow});
    console.timeEnd("stickyheaders init");

    codeEditorPanel.resizable({
        handles: "nw",
        minWidth: 500,
        minHeight: 500
    });

    console.time("editor init");
    codeEditorManager.init($("#code-editor"));
    console.timeEnd("editor init");

    console.time("body.show()");
    $("body").show();
    console.timeEnd("body.show()");
    console.timeEnd("TOTAL UI INITIALISATION TIME");


});