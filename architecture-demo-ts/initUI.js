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

$.getJSON("data/sessions.json", function(data) {

    var buildDataset = function(data) {

        var decorations = {};

        var properDataset = new Dataset();
        Object.keys(data).forEach(function(sessionKey, i) {
            var events = [];
            Object.keys(data[sessionKey]["events"]).forEach(function(eventKey) {
                var event = new RawEvent(data[sessionKey]["events"][eventKey]["name"], data[sessionKey]["events"][eventKey]["timestamp"], "", data[sessionKey]["events"][eventKey]["data"], "");

                Object.keys(data[sessionKey]["events"][eventKey]["decorations"]).forEach(function (d) {

                    var decorationValue = data[sessionKey]["events"][eventKey]["decorations"][d];
                    if (decorationValue.length > 0) {
                        event.decorate(d, decorationValue, "#ffffff");
                    }

                    if (!decorations.hasOwnProperty(d)) {
                        // TODO: how to do scheme ids
                        schemes[sessionKey] = new CodeScheme(sessionKey, d, true);
                        decorations[d] = sessionKey;
                    }

                    if (decorationValue.length > 0 && !schemes[decorations[d]].getCodeValues().has(decorationValue)) {
                        var scheme = schemes[decorations[d]];
                        var newCodeId = sessionKey + "-" + UIUtils.randomId(Array.from(scheme.codes.keys()));
                        scheme.codes.set(newCodeId, new Code(scheme, newCodeId, decorationValue, "#ffffff", "", false));
                    }

                });

                events.push(event);
            });

            var session = new Session(sessionKey, events);
            properDataset.sessions.set(sessionKey, session);
        });

        properDataset.schemes = schemes;
        return properDataset;

    }(data);

    dataset = data;
    newDataset = buildDataset;


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