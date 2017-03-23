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

//UI globals
//var dataset;
var editorOpen;
var UIUtils = UIUtils;
var codeEditorPanel = $("#code-editor-panel");

var schemes = Object.create(null);
var tempScheme = Object.create(null);

var activeRow;
var activeSchemeId;

var state = {
    activeMessageRow: {},
    activeEditorRow: {},
};

storage = StorageManager.instance;
undoManager = new UndoManager();

// need to set height of editor before hiding the body & we hide the body before loading the data
$("#editor-row").css("height", codeEditorPanel.outerHeight(true) - codeEditorPanel.find(".panel-heading").outerHeight(true) - $('#panel-row').outerHeight(true) - $('#button-row').outerHeight(true) - 10);
$("body").hide();

/*

 POPULATING THE UI

 Check if valid data is saved in storage
 - if yes, then populate table accordingly
 - else: load from local example file

 */

storage.getDataset().then(dataset => {
    dataset = typeof dataset == "string" ? JSON.parse(dataset) : dataset;
    newDataset = new Dataset().setFields(dataset.sessions, dataset.schemes, dataset.events);
    undoManager.modelUndoStack = [Dataset.clone(newDataset)];

    // update the activity stack
    storage.getActivity().then(act => {
        if (act) {
            activity = JSON.parse(act);
        }
        storage.saveActivity({
            "category": "DATASET",
            "message": "Resuming coding dataset", // todo add identifier
            "data": "Last edit:",
            "timestamp": new Date()
        });
        initUI(newDataset);

    });

}).catch(error => {
    if (error) console.log(error);
    $.getJSON("./data/sessions-numbered-10000.json", function (data) {

        // todo ensure ALL IDs are unique

        //var buildDataset = function (data) {
        newDataset = function(data) {
            var decorations = {};
            var eventCount = 0;
            var schemes = {};

            var properDataset = new Dataset();
            Object.keys(data).forEach(function (sessionKey) {
                var events = [];
                Object.keys(data[sessionKey]["events"]).forEach(function (eventKey, index) {
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
                            //schemes[newSchemeId] = newDataset.schemes[newSchemeId];
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
                    });
                    events.push(event);
                });
                var session = new Session(sessionKey, events);
                properDataset.sessions.set(sessionKey, session);
            });

            properDataset.schemes = schemes;
            properDataset.eventCount = eventCount;
            return properDataset;

        }(data);

        //dataset = data;
        //newDataset = buildDataset;
        undoManager.modelUndoStack = [Dataset.clone(newDataset)];
        // update the activity stack
        storage.saveActivity({
            "category": "DATASET",
            "message": "Loaded default dataset",
            "data": "sessions-numbered-1000.txt",
            "timestamp": new Date()
        });
        initUI(newDataset);
    });
});

function initUI(dataset) {
    console.time("TOTAL UI INITIALISATION TIME");
    var messagePanel = $("#message-panel");
    var editorRow = $("#editor-row");

    console.time("total messageview init");
    $("#success-codescheme-alert").hide();
    $("#success-dataset-alert").hide();
    $("#fail-upload").hide();
    messageViewerManager.init(messagePanel, dataset);
    console.timeEnd("total messageview init");

    console.time("stickyheaders init");
    $('#message-table').stickyTableHeaders({scrollableArea: messagePanel, container:messagePanel});
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


    $("#export-instrumentation").on("click", () => {
        storage.getActivity().then(activity => {
            let dataBlob = new Blob([Papa.unparse(activity, {header:true, delimiter:";"})], {type: 'text/plain'});
            chrome.downloads.download({url: window.URL.createObjectURL(dataBlob), saveAs: true}, function(dlId) {
                console.log("Downloaded activity file with id: " + dlId);
            });
        });
    });

    $("#export-dataset").click(() => {

        let eventJSON = {"data": [], "fields" : ["id", "timestamp", "owner", "data", "schemeId", "schemeName", "deco_codeValue", "deco_codeId", "deco_confidence", "deco_manual", "deco_timestamp", "deco_author"]};
        for (let event of newDataset.events) {
            for (let schemeKey of Object.keys(newDataset.schemes)) {
                let newEventData = [];
                newEventData.push(event.name);
                newEventData.push(event.timestamp);
                newEventData.push(event.owner);
                newEventData.push(event.data);
                newEventData.push(schemeKey);
                newEventData.push(newDataset.schemes[schemeKey].name);

                if (event.decorations.has(schemeKey)) {
                    let deco = event.decorations.get(schemeKey);
                    if (deco.code != null) {
                        newEventData.push(deco.code.value);
                        newEventData.push(deco.code.id);
                    } else {
                        newEventData.push("");
                        newEventData.push("");
                    }
                    newEventData.push(deco.confidence);
                    newEventData.push(deco.manual);
                    newEventData.push((deco.timestamp) ? deco.timestamp : "");
                    newEventData.push("");
                } else {
                    newEventData.push("");
                    newEventData.push("");
                    newEventData.push("");
                    newEventData.push("");
                    newEventData.push("");
                    newEventData.push("");
                }
                eventJSON["data"].push(newEventData);
            }

            if (Object.keys(newDataset.schemes).length == 0) {
                let newEventData = [];
                newEventData.push(event.name);
                newEventData.push(event.timestamp);
                newEventData.push(event.owner);
                newEventData.push(event.data);
                newEventData.push("");
                newEventData.push("");
                newEventData.push("");
                newEventData.push("");
                newEventData.push("");
                newEventData.push("");
                newEventData.push("");
                newEventData.push("");

                eventJSON["data"].push(newEventData);
            }

        }

        let dataBlob = new Blob([Papa.unparse(eventJSON, {header:true, delimiter:";"})], {type: 'text/plain'});

        chrome.downloads.download({url: window.URL.createObjectURL(dataBlob), saveAs: true}, function(dlId) {
            console.log("Downloaded file with id: " + dlId);
            storage.saveActivity({
                "category": "DATASET",
                "message": "Exported dataset", //todo identifier
                "data": JSON.stringify(tempScheme),
                "timestamp": new Date()
            });
        });
    });

    $("#dataset-file").on("change", event => {

        $(event.target).parents(".dropdown").removeClass("open");

        let files = $("#dataset-file")[0].files;
        let len = files.length;

        if (len) {
            console.log("Filename: " + files[0].name);
            console.log("Type: " + files[0].type);
            console.log("Size: " + files[0].size + " bytes");


            let read = new FileReader();
            read.readAsText(files[0]);
            read.onloadend = function(){
                let csvResult = read.result;
                let parse = Papa.parse(csvResult, {header: true});
                if (parse.errors.length > 0) {
                    let failAlert = $("#alert");
                    failAlert.addClass("alert-danger");
                    failAlert.append("<strong>Oh snap!</strong> Something is wrong with the data format. Change a few things up, refresh and try again.");
                    $(".tableFloatingHeaderOriginal").hide();
                    failAlert.show();
                    failAlert.fadeTo(4000, 500).slideUp(500, () => {
                        failAlert.slideUp(500, () => {
                            failAlert.removeClass("alert-danger");
                            failAlert.empty();
                            $(".tableFloatingHeaderOriginal").show(); // hack until header bug is fixed (todo)
                        });
                    });
                    return; // todo: alert error
                }

                let parsedObjs = parse.data;
                let dataset = new Dataset();
                let events = new Map();
                let newEvent = null;

                schemes = Object.create(null);
                messageViewerManager.codeSchemeOrder = [];

                for (let eventRow of parsedObjs) {

                    //id	timestamp	owner	data	schemeId	schemeName	deco_codevalue	deco_codeId	deco_confidence	deco_manual	deco_timestamp	deco_author

                    let id = eventRow.hasOwnProperty("id"),
                        timestamp = eventRow.hasOwnProperty("timestamp"),
                        owner = eventRow.hasOwnProperty("owner"),
                        data = eventRow.hasOwnProperty("data"),
                        schemeId = eventRow.hasOwnProperty("schemeId"),
                        schemeName = eventRow.hasOwnProperty("schemeName"),
                        deco_codevalue = eventRow.hasOwnProperty("deco_codeValue"),
                        deco_codeId = eventRow.hasOwnProperty("deco_codeId"),
                        deco_confidence = eventRow.hasOwnProperty("deco_confidence"),
                        deco_manual = eventRow.hasOwnProperty("deco_manual"),
                        deco_timestamp = eventRow.hasOwnProperty("deco_timestamp"),
                        deco_author = eventRow.hasOwnProperty("deco_author");

                    if (id && owner && data) {

                        if (!dataset) {
                            dataset = new Dataset();
                        }

                        let timestampData = timestamp ? eventRow["timestamp"] : "";
                        let isEventNew;

                        if (!events.has(eventRow["id"])){
                            newEvent = new RawEvent(events.size + "", eventRow["owner"], timestampData, eventRow["id"], eventRow["data"]);
                            events.set(eventRow["id"], newEvent);
                            isEventNew = true;
                        } else {
                            newEvent = events.get(eventRow["id"]);
                            isEventNew = false;
                        }

                        if (!dataset.sessions.has(eventRow["owner"])) {
                            let newSession = new Session(eventRow["owner"], [newEvent]);
                            dataset.sessions.set(eventRow["owner"], newSession);
                        }

                        if (schemeId & schemeName && deco_codevalue && deco_codeId && deco_manual) {
                            if (eventRow["schemeId"].length > 0 && eventRow["schemeName"].length > 0 && eventRow["deco_codeValue"].length > 0) {
                                let newScheme;
                                if (!dataset.schemes[eventRow["schemeId"]]) {
                                    newScheme = new CodeScheme(eventRow["schemeId"], eventRow["schemeName"], false);
                                    dataset.schemes[newScheme.id] = newScheme;
                                } else {
                                    newScheme = dataset.schemes[eventRow["schemeId"]];
                                }

                                if (!newScheme.codes.has(eventRow["deco_codeId"])) {
                                    newScheme.codes.set(eventRow["deco_codeId"], new Code(newScheme, eventRow["deco_codeId"], eventRow["deco_codeValue"], "", "", false));
                                }

                                let manual;
                                if (eventRow["deco_manual"].toLocaleLowerCase() == "true") {
                                    manual = true;
                                } else if (eventRow["deco_manual"].toLocaleLowerCase() == "false") {
                                    manual = false;
                                } else {
                                    manual = true
                                }

                                let confidence;
                                if (deco_confidence) {
                                    if (eventRow["deco_confidence"].length == 0) {
                                        confidence = 0.95;
                                    } else {
                                        let float = parseFloat(eventRow["deco_confidence"]);
                                        if (!isNaN(float)) {
                                            confidence = float;
                                        } else {
                                            confidence = 0.95;
                                        }
                                    }
                                } else {
                                    confidence = undefined;
                                }

                                newEvent.decorate(newScheme.id, manual, newScheme.codes.get(eventRow["deco_codeId"]), confidence);
                            }

                        }

                        if (isEventNew) dataset.events.push(newEvent);

                    }

                }

                if (dataset && dataset.events.length != 0) {
                    if (Object.keys(dataset.schemes).length == 0) {
                        let defaultScheme = new CodeScheme("1", "default", false);
                        defaultScheme.codes.set(defaultScheme.id + "-" + "01", new Code(defaultScheme,defaultScheme.id + "-" + "01","Test", "#ffffff", UIUtils.ascii("t"), false));
                        dataset.schemes[defaultScheme["id"]] = defaultScheme;
                    }
                    newDataset = dataset;
                    //newDataset.schemes = schemes;
                    messageViewerManager.buildTable(newDataset, messageViewerManager.rowsInTable, true);
                    $("body").show();

                    undoManager.modelUndoStack = [Dataset.clone(newDataset)];
                    undoManager.pointer = 0;
                    storage.saveDataset(dataset);

                    // update the activity stack
                    storage.saveActivity({
                        "category": "DATASET",
                        "message": "Imported dataset", // todo find identifier
                        "data": JSON.stringify(dataset.events[0]),
                        "timestamp": new Date()
                    });

                    /* TODO do we reset instrumentation on data reload?
                    storage.clearActivityLog().then(() => {
                        storage.saveActivity({
                            "category": "DATASET",
                            "message": "Imported dataset", // todo find identifier
                            "data": JSON.stringify(dataset.events[0]),
                            "timestamp": new Date()
                        });
                    });
                    */

                    // success message
                    let successAlert = $("#alert");
                    successAlert.addClass("alert-success");
                    successAlert.append("<strong>Success!</strong> New dataset was imported.");
                    successAlert.show();
                    $(".tableFloatingHeaderOriginal").hide();
                    successAlert.fadeTo(2000, 500).slideUp(500, () => {
                        successAlert.slideUp(500, () => {
                            successAlert.removeClass("alert-success");
                            successAlert.empty();
                            $(".tableFloatingHeaderOriginal").show(); // hack until header bug is fixed (todo)
                        });
                    });

                } else {
                    // update the activity stack
                    storage.saveActivity({
                        "category": "DATASET",
                        "message": "Failed to import dataset",
                        "data": "",
                        "timestamp": new Date()});

                    let failAlert = $("#alert");
                    failAlert.addClass("alert-danger");
                    failAlert.append("<strong>Oh snap!</strong> Something is wrong with the data format. Change a few things up, refresh and try again.");
                    $(".tableFloatingHeaderOriginal").hide();
                    failAlert.show();
                    failAlert.fadeTo(4000, 500).slideUp(500, () => {
                        failAlert.slideUp(500, () => {
                            failAlert.removeClass("alert-danger");
                            failAlert.empty();
                            $(".tableFloatingHeaderOriginal").show(); // hack until header bug is fixed (todo)
                        });
                    });
                }
            }
        }


    });

    $("#scheme-file").on("change", event => {

        $(event.target).parents(".dropdown").removeClass("open");

        let files = $("#scheme-file")[0].files;
        let len = files.length;

        if (len) {
            console.log("Filename: " + files[0].name);
            console.log("Type: " + files[0].type);
            console.log("Size: " + files[0].size + " bytes");


            let read = new FileReader();
            read.readAsText(files[0]);
            // todo: error handling

            read.onloadend = function(){
                let csvResult = read.result;
                let parse = Papa.parse(csvResult, {header: true});
                if (parse.errors.length > 0) {
                    let failAlert = $("#alert");
                    failAlert.addClass("alert-danger");
                    failAlert.append("<strong>Oh snap!</strong> Something is wrong with the data format. Change a few things up, refresh and try again.");
                    $(".tableFloatingHeaderOriginal").hide();
                    failAlert.show();
                    failAlert.fadeTo(4000, 500).slideUp(500, () => {
                        failAlert.slideUp(500, () => {
                            failAlert.removeClass("alert-danger");
                            failAlert.empty();
                            $(".tableFloatingHeaderOriginal").show(); // hack until header bug is fixed (todo)
                        });
                    });
                    return; // todo: alert error
                }

                let parsedObjs = parse.data;
                let newScheme = null;

                for (let codeRow of parsedObjs) {

                    let id = codeRow.hasOwnProperty("scheme_id"),
                        name = codeRow.hasOwnProperty("scheme_name"),
                        code_id = codeRow.hasOwnProperty("code_id"),
                        code_value = codeRow.hasOwnProperty("code_value"),
                        code_colour = codeRow.hasOwnProperty("code_colour"),
                        code_shortcut = codeRow.hasOwnProperty("code_shortcut"),
                        code_words = codeRow.hasOwnProperty("code_words");

                    if (id && name && code_id && code_value) {

                        // todo handle if loading an edit of a scheme that was already loaded in... how to deal if code was deleted?

                        if (!newScheme) {
                            newScheme = new CodeScheme(codeRow["scheme_id"], codeRow["scheme_name"], false);
                        }

                        let newShortcut = codeRow["code_shortcut"];
                        if (codeRow["code_shortcut"].length == 1 && Number.isNaN(parseInt(codeRow["code_shortcut"]))) {
                            newShortcut = UIUtils.ascii(codeRow["code_shortcut"]);
                        }

                        let newCode = new Code(newScheme, codeRow["code_id"], codeRow["code_value"], codeRow["code_colour"], newShortcut, false);

                        if (code_words) {

                            if (codeRow["code_words"].length != 0) {
                                let words = codeRow["code_words"].split(",");
                                if (words.length > 0) {
                                    newCode.addWords(words);
                                }
                            }
                        }

                        newScheme.codes.set(codeRow["code_id"], newCode);

                    }
                }

                if (newScheme == null || newScheme.codes.size == 0 || newDataset.schemes[newScheme["id"]] != undefined) {

                    let isDuplicate = newDataset.schemes[newScheme["id"]] != undefined;
                    let errorText = (isDuplicate) ? "Can't import duplicate coding scheme (ID: '" + newScheme["id"] + "'). To update an existing coding scheme access it via code editor." : "Something is wrong with the data format. Change a few things up, refresh and try again.";

                    let failAlert = $("#alert");
                    failAlert.addClass("alert-danger");
                    failAlert.append("<strong>Oh snap!</strong> " + errorText);
                    $(".tableFloatingHeaderOriginal").hide();
                    failAlert.show();
                    failAlert.fadeTo(5000, 500).slideUp(500, () => {
                        failAlert.slideUp(500, () => {
                            failAlert.removeClass("alert-danger");
                            failAlert.empty();
                            $(".tableFloatingHeaderOriginal").show(); // hack until header bug is fixed (todo)
                        });
                    });
                } else {
                    // todo: what is the behaviour when scheme id is a duplicate - overwrite??
                    // update the activity stack
                    storage.saveActivity({
                        "category": "SCHEME",
                        "message": "Imported new scheme " + newScheme.id,
                        "data": JSON.stringify(newScheme),
                        "timestamp": new Date()
                    });

                    newDataset.schemes[newScheme["id"]] = newScheme;
                    messageViewerManager.codeSchemeOrder.push(newScheme["id"] + "");
                    messageViewerManager.addNewSchemeColumn(newScheme);

                    let successAlert = $("#alert");
                    successAlert.addClass("alert-success");
                    successAlert.append("<strong>Success!</strong> New coding scheme was imported.");
                    successAlert.show();
                    $(".tableFloatingHeaderOriginal").hide();
                    successAlert.fadeTo(2000, 500).slideUp(500, () => {
                        successAlert.slideUp(500, () => {
                            successAlert.removeClass("alert-danger");
                            successAlert.empty();
                            $(".tableFloatingHeaderOriginal").show(); // hack until header bug is fixed (todo)
                        });
                    });
                }
            }
        }


    });

    $("#quit").on("click", () => {

        storage.saveDataset(newDataset);

        // todo: prompt to export all files with dialog box

        chrome.tabs.getCurrent(tab => {
            chrome.tabs.remove(tab.id);
        });

    });


    $("#scheme-download").on("click", () => {

        let schemeJSON = {"data": [], "fields":["scheme_id", "scheme_name", "code_id", "code_value", "code_colour", "code_shortcut","code_words"]};
        for (let [codeId, code] of tempScheme.codes) {
            let codeArr = [tempScheme.id, tempScheme.name, codeId, code.value, code.color, code.shortcut, code.words.toString()];
            schemeJSON["data"].push(codeArr);
        }

        let dataBlob = new Blob([Papa.unparse(schemeJSON, {header:true, delimiter:";"})], {type: 'text/plain'});
        chrome.downloads.download({url: window.URL.createObjectURL(dataBlob), saveAs: true}, function(dlId) {
            console.log("Downloaded file with id: " + dlId);

            storage.saveActivity({
                "category": "SCHEME",
                "message": "Exported scheme " + tempScheme.id,
                "data": JSON.stringify(tempScheme),
                "timestamp": new Date()
            });

        });
    });

    $("#scheme-download").tooltip();
    $("#scheme-upload").tooltip();

    /*
    SCHEME UPLOAD - via editor
     */
    $("#scheme-upload-file").on("change", () => {

        let files = $("#scheme-upload-file")[0].files;
        let len = files.length;

        if (len) {
            console.log("Filename: " + files[0].name);
            console.log("Type: " + files[0].type);
            console.log("Size: " + files[0].size + " bytes");

            let read = new FileReader();
            read.readAsText(files[0]);
            // todo: error handling

            read.onloadend = function() {
                let csvResult = read.result;
                let parse = Papa.parse(csvResult, {header: true});
                if (parse.errors.length > 0) {
                    return; // todo: alert error
                }

                let parsedObjs = parse.data;
                let newScheme = null;
                for (let codeRow of parsedObjs) {

                    let id = codeRow.hasOwnProperty("scheme_id"),
                        name = codeRow.hasOwnProperty("scheme_name"),
                        code_id = codeRow.hasOwnProperty("code_id"),
                        code_value = codeRow.hasOwnProperty("code_value"),
                        code_colour = codeRow.hasOwnProperty("code_colour"),
                        code_shortcut = codeRow.hasOwnProperty("code_shortcut"),
                        code_words = codeRow.hasOwnProperty("code_words");

                    if (id && name && code_id && code_value) {

                        if (codeRow["scheme_id"] != tempScheme["id"]) {
                            console.log("ERROR: Trying to upload scheme with a wrong ID");
                            return; // todo UI error message
                        }

                        if (!newScheme) {
                            newScheme = new CodeScheme(codeRow["scheme_id"], codeRow["scheme_name"], false);
                        }

                        let newShortcut = codeRow["code_shortcut"];
                        if (codeRow["code_shortcut"].length == 1 && Number.isNaN(parseInt(codeRow["code_shortcut"]))) {
                            // initialize shortcuts
                            newShortcut = UIUtils.ascii(codeRow["code_shortcut"]);
                        }

                        let newCode = new Code(newScheme, codeRow["code_id"], codeRow["code_value"], codeRow["code_colour"], newShortcut, false);

                        if (code_words) {

                            if (codeRow["code_words"].length != 0) {
                                let words = codeRow["code_words"].split(",");
                                if (words.length > 0) {
                                    newCode.addWords(words);
                                }
                            }
                        }
                        newScheme.codes.set(codeRow["code_id"], newCode);
                    }
                }

                /*
                Update the currently loaded scheme
                 */
                for (let [codeId, code] of tempScheme.codes.entries()) {
                    // update existing codes
                    let codeRow = $(".code-row[id='" + codeId + "']");
                    if (newScheme.codes.has(codeId)) {
                        let newCode = newScheme.codes.get(codeId);
                        newCode.owner = tempScheme;
                        codeRow.find(".code-input").attr("value", newCode.value);
                        codeRow.find(".shortcut-input").attr("value", String.fromCharCode(newCode.shortcut));
                        codeRow.find("td").attr("style", "background-color: " + (newCode.color ? newCode.color : "#ffffff"));
                        tempScheme.codes.set(codeId, newCode);
                        newScheme.codes.delete(codeId);
                    } else {
                        let isActive = codeRow.hasClass("active");
                        codeRow.remove();
                        if (isActive) {
                            $(".code-row:first").addClass("active");
                        }
                        tempScheme.codes.delete(codeId);
                    }
                }

                for (let [codeId, code] of newScheme.codes.entries()) {
                    // add new codes
                    code.owner = tempScheme;
                    codeEditorManager.addCodeInputRow(code.value, code.shortcut, code.color, codeId);
                    tempScheme.codes.set(codeId, code);
                }

                $("#scheme-name-input").val(newScheme.name);
                let activeCode = tempScheme.codes.get($(".code-row.active").attr("id"));
                if (activeCode) codeEditorManager.updateCodePanel(activeCode);

                // update the activity stack
                storage.saveActivity({
                    "category": "SCHEME",
                    "message": "Uploaded new version of scheme " + tempScheme.id,
                    "data": JSON.stringify(tempScheme),
                    "timestamp": new Date()
                });
            }
        }
    });

    $("#undo").on("click", () => {
       messageViewerManager.undoHandler();
    });

    $("#redo").on("click", () => {
        messageViewerManager.redoHandler();
    });

    console.time("body.show()");
    $("body").show();
    console.timeEnd("body.show()");
    console.timeEnd("TOTAL UI INITIALISATION TIME");
}