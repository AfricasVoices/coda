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


$.getJSON("./data/sessions-numbered-10000.json", function(data) {

    // todo ensure ALL IDs are unique
    var buildDataset = function(data) {

        var decorations = {};
        var eventCount = 0;

        var properDataset = new Dataset();
        Object.keys(data).forEach(function(sessionKey) {
            var events = [];
            Object.keys(data[sessionKey]["events"]).forEach(function(eventKey, index) {
                //var event = new RawEvent(data[sessionKey]["events"][eventKey]["name"], sessionKey, data[sessionKey]["events"][eventKey]["timestamp"], "", data[sessionKey]["events"][eventKey]["data"]);
                var event = new RawEvent(eventCount + "", sessionKey, data[sessionKey]["events"][eventKey]["timestamp"], "", data[sessionKey]["events"][eventKey]["data"]);
                properDataset.events.push(event);
                eventCount += 1;

                Object.keys(data[sessionKey]["events"][eventKey]["decorations"]).forEach(function (d) {

                    var decorationValue = data[sessionKey]["events"][eventKey]["decorations"][d];

                    if (!decorations.hasOwnProperty(d)) {
                        // TODO: how to do scheme ids
                        let newSchemeId = UIUtils.randomId(Object.keys(schemes));
                        schemes[newSchemeId] = new CodeScheme(newSchemeId, d, true);
                        decorations[d] = newSchemeId;
                    }

                    if (decorationValue.length > 0) {
                        var scheme = schemes[decorations[d]];
                        if (!schemes[decorations[d]].getCodeValues().has(decorationValue)) {
                            var newCodeId = decorations[d] + "-" + UIUtils.randomId(Array.from(scheme.codes.keys()));
                            scheme.codes.set(newCodeId, new Code(scheme, newCodeId, decorationValue, "#ffffff", "", false));
                        }

                        var code = scheme.getCodeByValue(decorationValue);
                        event.decorate(decorations[d], true, code, 0.95); // has to use decorations[d] as scheme key
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