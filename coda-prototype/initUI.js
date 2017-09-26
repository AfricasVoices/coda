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


/*
INITUI.JS
Checks UUID
Loads the initial data - either from storage or the default dataset.
Handles data I/O
Handles interaction via navbar menus and buttons - undo/redo, export, load...
 */


//UI globals
var UUID;
var editorOpen;
var UIUtils = UIUtils;
var codeEditorPanel = $("#code-editor-panel");

var schemes = Object.create(null);
var tempScheme = Object.create(null);

var activeRow;
var activeSchemeId;

var state = {
    activeMessageRow: {},
    activeEditorRow: "",
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

function initDataset(storageObj) {
    storage.getDataset()
        .then(dataset => {
            console.time("Data init");
            dataset = typeof dataset === "string" ? JSON.parse(dataset) : dataset;
            newDataset = Dataset.restoreFromTypelessDataset(dataset);//new Dataset().setFields(dataset["sessions"], dataset["schemes"], dataset["events"]);
            console.log("LOG - Dataset restored is valid: " + JSON.stringify(Dataset.validate(newDataset)));
            console.timeEnd("Data init");

            // update the activity stack
            storage.saveActivity({
                "category": "DATASET",
                "message": "Resuming coding dataset",
                "messageDetails": "", // todo add identifier
                "data": {"events": newDataset["events"].size, "schemes": Object.keys(newDataset["schemes"]).length, "sessions": newDataset["sessions"].size},
                "timestamp": new Date()
            });
            initUI(newDataset);
            undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);
        })
        .catch(error => {
            if (error) console.log(error);
            console.time("Default data init");
            // TODO: this example file can't actually be parsed by the "load dataset" button
            $.getJSON("./data/sessions-numbered-10000.json", function (data) {

                // todo ensure ALL IDs are unique

                newDataset = function (data) {
                    var decorations = {};
                    var eventCount = 0;
                    var schemes = {};

                    var properDataset = new Dataset();
                    Object.keys(data).forEach(function (sessionKey) {
                        var events = [];
                        data[sessionKey]["events"].forEach(function (event) {
                            var newEventObj = new RawEvent(eventCount + "", sessionKey, event["timestamp"], "", event["data"]);
                            properDataset.eventOrder.push(newEventObj.name);
                            properDataset.events.set(newEventObj.name, newEventObj);
                            eventCount += 1;

                            Object.keys(event["decorations"]).forEach(function (d) {

                                var decorationValue = event["decorations"][d];

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
                                    newEventObj.decorate(decorations[d], true, UUID, code, 0.95); // has to use decorations[d] as scheme key
                                }
                            });
                            events.push(newEventObj);
                        });
                        var session = new Session(sessionKey, events);
                        properDataset.sessions.set(sessionKey, session);
                    });

                    properDataset.schemes = schemes;
                    properDataset.eventCount = eventCount;
                    console.log(properDataset);
                    return properDataset;

                }(data);

                console.timeEnd("Default data init");

                //dataset = data;
                //newDataset = buildDataset;
                // update the activity stack
                storage.saveActivity({
                    "category": "DATASET",
                    "message": "Loaded default dataset",
                    "messageDetails": "",
                    "data": "sessions-numbered-1000.txt",
                    "timestamp": new Date()
                });
                initUI(newDataset);
                undoManager.modelUndoStack = [];
                undoManager.schemaUndoStack = [];
                undoManager.pointer = 0;
                undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);

            });
        });
}

storage
    .getUUID().then(id => {
        if (id && id.length === 36) {
            // stored id is in valid format
            UUID = id;
            return initDataset(storage);
        } else {
            // create and save UUID
            UUID = uuid.v4();
            return storage.saveUUID(UUID)
                .then(id => {
                    return initDataset(storage);
                })
                .catch(err => {
                    // set UUID object anyway, try to save again at first logging action
                    console.log(err);
                    UUID = uuid.v4();
                    return initDataset(storage);
                });
        }
    }).catch(err => {
        // will catch errors at getting UUID
        // set UUID object anyway, try to save again at first logging action
        console.log(err);
        UUID = uuid.v4();
        return storage.saveUUID(UUID)
            .then(id => {
                return initDataset(storage);
            })
            .catch(err => {
                console.log(err);
                return initDataset(storage);
            });
    })/*.then(dataset => {
        console.time("Data init");
        dataset = typeof dataset === "string" ? JSON.parse(dataset) : dataset;
        newDataset = Dataset.restoreFromTypelessDataset(dataset);//new Dataset().setFields(dataset["sessions"], dataset["schemes"], dataset["events"]);
        console.log("LOG - Dataset restored is valid: " + JSON.stringify(Dataset.validate(newDataset)));
        console.timeEnd("Data init");

        // update the activity stack
        storage.saveActivity({
            "category": "DATASET",
            "message": "Resuming coding dataset",
            "messageDetails": "", // todo add identifier
            "data": {"events": newDataset["events"].size, "schemes": Object.keys(newDataset["schemes"]).length, "sessions": newDataset["sessions"].size},
            "timestamp": new Date()
        });
        initUI(newDataset);
        undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);
    }).catch(error => {
        if (error) console.log(error);
        console.time("Default data init");
        $.getJSON("./data/sessions-numbered-10000.json", function (data) {

            // todo ensure ALL IDs are unique

            newDataset = function (data) {
                var decorations = {};
                var eventCount = 0;
                var schemes = {};

                var properDataset = new Dataset();
                Object.keys(data).forEach(function (sessionKey) {
                    var events = [];
                    data[sessionKey]["events"].forEach(function (event) {
                        var newEventObj = new RawEvent(eventCount + "", sessionKey, event["timestamp"], "", event["data"]);
                        properDataset.eventOrder.push(newEventObj.name);
                        properDataset.events.set(newEventObj.name, newEventObj);
                        eventCount += 1;

                        Object.keys(event["decorations"]).forEach(function (d) {

                            var decorationValue = event["decorations"][d];

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
                                newEventObj.decorate(decorations[d], true, UUID, code, 0.95); // has to use decorations[d] as scheme key
                            }
                        });
                        events.push(newEventObj);
                    });
                    var session = new Session(sessionKey, events);
                    properDataset.sessions.set(sessionKey, session);
                });

                properDataset.schemes = schemes;
                properDataset.eventCount = eventCount;
                console.log(properDataset);
                return properDataset;

            }(data);

            console.timeEnd("Default data init");

            //dataset = data;
            //newDataset = buildDataset;
            // update the activity stack
            storage.saveActivity({
                "category": "DATASET",
                "message": "Loaded default dataset",
                "messageDetails": "",
                "data": "sessions-numbered-1000.txt",
                "timestamp": new Date()
            });
            initUI(newDataset);
            undoManager.modelUndoStack = [];
            undoManager.schemaUndoStack = [];
            undoManager.pointer = 0;
            undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);

        });
    }); */
/*
storage.getDataset().then(dataset => {
    console.time("Data init");
    dataset = typeof dataset === "string" ? JSON.parse(dataset) : dataset;
    newDataset = new Dataset().setFields(dataset["sessions"], dataset["schemes"], dataset["events"]);
    console.timeEnd("Data init");

    // update the activity stack
    storage.saveActivity({
        "category": "DATASET",
        "message": "Resuming coding dataset",
        "messageDetails": "", // todo add identifier
        "data": {"events": newDataset["events"].size, "schemes": Object.keys(newDataset["schemes"]).length, "sessions": newDataset["sessions"].size},
        "timestamp": new Date()
    });
    initUI(newDataset);
    undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);

}).catch(error => {
    if (error) console.log(error);
    console.time("Default data init");
    $.getJSON("./data/sessions-numbered-10000.json", function (data) {

        // todo ensure ALL IDs are unique

        newDataset = function(data) {
            var decorations = {};
            var eventCount = 0;
            var schemes = {};

            var properDataset = new Dataset();
            Object.keys(data).forEach(function (sessionKey) {
                var events = [];
                data[sessionKey]["events"].forEach(function (event) {
                    var newEventObj = new RawEvent(eventCount + "", sessionKey, event["timestamp"], "", event["data"]);
                    properDataset.eventOrder.push(newEventObj.name);
                    properDataset.events.set(newEventObj.name, newEventObj);
                    eventCount += 1;

                    Object.keys(event["decorations"]).forEach(function (d) {

                        var decorationValue = event["decorations"][d];

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
                            newEventObj.decorate(decorations[d], true, code, 0.95); // has to use decorations[d] as scheme key
                        }
                    });
                    events.push(newEventObj);
                });
                var session = new Session(sessionKey, events);
                properDataset.sessions.set(sessionKey, session);
            });

            properDataset.schemes = schemes;
            properDataset.eventCount = eventCount;
            console.log(properDataset);
            return properDataset;

        }(data);

        console.timeEnd("Default data init");

        //dataset = data;
        //newDataset = buildDataset;
        // update the activity stack
        storage.saveActivity({
            "category": "DATASET",
            "message": "Loaded default dataset",
            "messageDetails": "",
            "data": "sessions-numbered-1000.txt",
            "timestamp": new Date()
        });
        initUI(newDataset);
        undoManager.modelUndoStack = [];
        undoManager.schemaUndoStack = [];
        undoManager.pointer = 0;
        undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);

    });
});
*/


function initUI(dataset) {
    console.time("TOTAL UI INITIALISATION TIME");
    var messagePanel = $("#message-panel");
    var editorRow = $("#editor-row");

    console.time("total messageview init");
    $("#success-codescheme-alert").hide();
    $("#success-dataset-alert").hide();
    $("#fail-upload").hide();
    $("#alert").hide();

    messageViewerManager.init(messagePanel, dataset);
    console.timeEnd("total messageview init");

    console.time("stickyheaders init");
    $('#deco-table').stickyTableHeaders({scrollableArea: messagePanel, container:messagePanel, fixedOffset: 1});

    $('#message-table').stickyTableHeaders({scrollableArea: messagePanel, container:messagePanel, fixedOffset: 1});

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


    $("[data-hide]").on("click", () => {
        let alert = $("#alert");
        alert[0].childNodes.forEach(node => {
           if (node.nodeName === "#text") {
               node.remove();
           }
        });
        alert.hide();
        $(".tableFloatingHeaderOriginal").show();
    });

    $("#export-instrumentation").on("click", () => {
        storage.getActivity().then(activity => {
            if (!activity || activity.length === 0) {
                activity = "";
                console.log("Exporting empty instrumentation file.");
            }
            let dataBlob = new Blob([activity], {type: 'application/json'});
            FileIO.saveFile(dataBlob, downloadId => console.log("Downloaded activity file with id: " + downloadId));
        });
    });

    $("#export-dataset").click(() => FileIO.saveDataset(newDataset));

    $("#dataset-file").on("change", event => { // Fires when the dataset file has been changed by the file picker UI
        $(event.target).parents(".dropdown").removeClass("open");

        // Hide the existing alert.
        let alert = $("#alert");
        alert[0].childNodes.forEach(node => {
            if (node.nodeName === "#text") {
                node.remove();
            }
        });
        alert.hide();
        $(".tableFloatingHeaderOriginal").show();

        let files = $("#dataset-file")[0].files;
        if (files.length > 0) {
            let file = files[0];
            console.log("Filename: " + file.name);
            console.log("Type: " + file.type);
            console.log("Size: " + file.size + " bytes");

            /**
             * Loads the parsed dataset into the UI if it has data; displays an error message to the user otherwise.
             * @param dataset Dataset which was correctly parsed.
             */
            function handleDatasetParsed(dataset) {
                messageViewerManager.codeSchemeOrder = []; // TODO: What does this line do?

                if (dataset && dataset.events.size !== 0) {
                    if (Object.keys(dataset.schemes).length === 0) {
                        let defaultScheme = new CodeScheme("1", "default", false);
                        defaultScheme.codes.set(
                            defaultScheme.id + "-" + "01",
                            new Code(
                                defaultScheme, defaultScheme.id + "-" + "01","Test", "#ffffff",
                                UIUtils.ascii("t"), false
                            )
                        );
                        dataset.schemes[defaultScheme["id"]] = defaultScheme;
                    }
                    newDataset = dataset;
                    newDataset.restoreDefaultSort();
                    messageViewerManager.buildTable(newDataset, messageViewerManager.rowsInTable, true);
                    $("body").show();
                    messageViewerManager.resizeViewport();

                    undoManager.pointer = 0;
                    undoManager.schemaUndoStack  = [];
                    undoManager.modelUndoStack = [];
                    undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);
                    storage.saveDataset(dataset);

                    // update the activity stack
                    storage.saveActivity({
                        "category": "DATASET",
                        "message": "Imported dataset",
                        "messageDetails": {"dataset": file.name},
                        "data": "",
                        "timestamp": new Date()
                    });

                    // TODO do we reset instrumentation on data reload?

                    // success message
                    let successAlert = $("#alert");
                    successAlert.removeClass("alert-danger").addClass("alert-success");
                    successAlert.append("<strong>Success!</strong> New dataset was imported.");
                    successAlert.show();
                    $(".tableFloatingHeaderOriginal").hide();
                    successAlert.fadeTo(2000, 500).slideUp(500, () => {
                        successAlert.slideUp(500, () => {
                            successAlert.removeClass("alert-success");
                            successAlert.empty();
                            successAlert.append($('<a href="#" class="close" data-hide="alert" aria-label="close">&times;</a>'));
                            $(".tableFloatingHeaderOriginal").show(); // hack until header bug is fixed. FIXME
                                                                      // Also, what header bug?
                        });
                    });
                } else {
                    // update the activity stack
                    storage.saveActivity({
                        "category": "DATASET",
                        "message": "Failed to import dataset",
                        "messageDetails": {"dataset": file.name},
                        "data": "",
                        "timestamp": new Date()
                    });

                    // TODO: There is duplication between here and handleParseError.
                    // TODO: There should therefore be a function for displaying errors.
                    let failAlert = $("#alert");
                    failAlert.removeClass("alert-success").addClass("alert-danger");
                    let errorMessage = document.createTextNode("Something is wrong with the data format. " +
                        "Change a few things up, refresh and try again.");
                    failAlert.append(errorMessage);
                    $(".tableFloatingHeaderOriginal").hide();
                    failAlert.show();

                    console.log("ERROR: Dataset object is empty or has no events.");
                    console.log(dataset);
                }
            }

            /**
             * Notifies the user that parsing the dataset file failed, via the alert banner.
             * Prints the first 100 parse errors to the console.
             */
            function handleDatasetParseError(parseErrors) {
                let errorMessage = document.createTextNode("Something is wrong with the data format. " +
                    "Change a few things up, refresh and try again.");
                let failAlert = $("#alert");
                failAlert.addClass("alert-danger");
                failAlert.append(errorMessage);
                failAlert.show();
                $(".tableFloatingHeaderOriginal").hide();

                let errors = parseErrors;
                if (errors.length > 100) { // only report first 100 wrong lines
                    errors = parseErrors.slice(0, 100);
                }

                console.log("ERROR: CANNOT PARSE CSV");
                console.log(JSON.stringify(errors));
            }

            FileIO.loadDataset(file, UUID).then(handleDatasetParsed, handleDatasetParseError);
        }

       $("#dataset-file")[0].value = ""; // need to reset so the 'onchange' listener will catch reloading the same file

    });

    $("#scheme-file").on("change", event => {
        $(event.target).parents(".dropdown").removeClass("open");

        // Hide the currently displayed alert.
        let alert = $("#alert");
        alert[0].childNodes.forEach(node => {
            if (node.nodeName === "#text") {
                node.remove();
            }
        });
        alert.hide();
        $(".tableFloatingHeaderOriginal").show();

        let files = $("#scheme-file")[0].files;

        if (files.length > 0) {
            let file = files[0];
            console.log("Filename: " + file.name);
            console.log("Type: " + files.type);
            console.log("Size: " + files.size + " bytes");

            function handleSchemeParsed(newScheme) {
                if (newScheme == null || newScheme.codes.size === 0 || newDataset.schemes[newScheme["id"]] != undefined) {

                    let isDuplicate = newDataset.schemes[newScheme["id"]] != undefined;
                    let errorText = (isDuplicate) ? "Can't import duplicate coding scheme (ID: '" + newScheme["id"] + "'). To update an existing coding scheme access it via code editor." : "Something is wrong with the data format. Change a few things up, refresh and try again.";

                    let failAlert = $("#alert");
                    failAlert.addClass("alert-danger");
                    failAlert.append(errorText);
                    $(".tableFloatingHeaderOriginal").hide();
                    failAlert.show();

                    let err;
                    if (isDuplicate) {
                        err = "can't import duplicate scheme";
                    }
                    else if (newScheme == null) {
                        err = "scheme object is null.";
                    } else {
                        err = "scheme contains no codes.";
                    }
                    console.log("ERROR: Can't create scheme object - %s" % err);

                } else {
                    // todo: what is the behaviour when scheme id is a duplicate - overwrite??
                    // update the activity stack
                    storage.saveActivity({
                        "category": "SCHEME",
                        "message": "Imported new scheme",
                        "messageDetails": {"scheme": newScheme.id},
                        "data": newScheme.toJSON(),
                        "timestamp": new Date()
                    });

                    newDataset.schemes[newScheme["id"]] = newScheme;
                    messageViewerManager.codeSchemeOrder.push(newScheme["id"] + "");
                    messageViewerManager.addNewSchemeColumn(newScheme);

                    let successAlert = $("#alert");
                    successAlert.removeClass("alert-danger").addClass("alert-success");
                    successAlert.append("<strong>Success!</strong> New coding scheme was imported.");
                    successAlert.show();
                    $(".tableFloatingHeaderOriginal").hide();
                    successAlert.fadeTo(2000, 500).slideUp(500, () => {
                        successAlert.slideUp(500, () => {
                            successAlert.removeClass("alert-success");
                            successAlert.empty();
                            successAlert.append($('<a href="#" class="close" data-hide="alert" aria-label="close">&times;</a>'));
                            $(".tableFloatingHeaderOriginal").show(); // hack until header bug is fixed (todo)
                        });
                    });
                }
            }

            function handleSchemeParseError(parseErrors) {
                let failAlert = $("#alert");
                failAlert.removeClass("alert-sucess").addClass("alert-danger");
                let errorMessage = document.createTextNode("Something is wrong with the scheme data format. " +
                    "Change a few things up, refresh and try again.");
                failAlert.append(errorMessage);
                $(".tableFloatingHeaderOriginal").hide();
                failAlert.show();

                if (parseErrors.length > 100) { // only report first 100 wrong lines
                    parseErrors = parseErrors.slice(0, 100);
                }

                console.log("ERROR: CANNOT PARSE CSV");
                console.log(JSON.stringify(parseErrors));
            }

            FileIO.loadCodeScheme(file).then(handleSchemeParsed, handleSchemeParseError);
        }
    });

    $("#quit").on("click", () => {
        storage.saveDataset(newDataset);

        // todo: prompt to export all files with dialog box

        chrome.tabs.getCurrent(tab => {
            chrome.tabs.remove(tab.id);
        });

    });

    $("#scheme-download").on("click", () => FileIO.saveCodeScheme(tempScheme));

    /*
    TOOLTIPS
     */
    $("#save-all-button").tooltip();
    $("#code-now-button").tooltip();
    $("#undo").tooltip();
    $("#redo").tooltip();
    $("#scheme-download").tooltip();
    $("#add-scheme").tooltip();
    $("#scheme-upload").tooltip();
    $("#scheme-duplicate").tooltip();
    $("#delete-scheme-button").tooltip();
    $("#scheme-name-help-block").find("sup").tooltip();

    /*
    SCHEME DUPLICATION
     */
    $("#scheme-duplicate").on("click", () => {

        let newScheme = tempScheme.duplicate(Object.keys(newDataset.schemes));
        newDataset.schemes[newScheme.id] = newScheme;
        messageViewerManager.codeSchemeOrder.push(newScheme.id);
        messageViewerManager.addNewSchemeColumn(newScheme, newScheme.name);

        let headerDecoColumn = $("#header-decoration-column");
        let header = headerDecoColumn.find("[scheme='" + newScheme["id"] + "']");
        header.children("i").text(newScheme["name"]);

        undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);

        let editorContainer = codeEditorManager.editorContainer;
        editorContainer.hide();
        editorContainer.find("tbody").empty();
        codeEditorManager.bindAddCodeButtonListener();
        editorContainer.find("#scheme-name-input").val("");
        scrollbarManager.redraw(newDataset, newScheme.id);
        scrollbarManager.redrawThumb(0);
        $(scrollbarManager.scrollbarEl).drawLayers();
        editorOpen = false;
        tempScheme = {};

    });


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

            // TODO: IO
            let read = new FileReader();
            read.readAsText(files[0]);
            // todo: error handling

            read.onloadend = function() {
                let csvResult = read.result;
                let parse = Papa.parse(csvResult, {header: true});
                if (parse.errors.length > 0) {
                    console.log("ERROR: Cannot parse scheme file");
                    console.log(JSON.stringify(parse.errors));
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
                        code_words = codeRow.hasOwnProperty("code_words"),
                        code_regex = codeRow.hasOwnProperty("code_regex");

                    if (id && name && code_id && code_value) {

                        if (codeRow["scheme_id"] != tempScheme["id"]) {
                            console.log("ERROR: Trying to upload scheme with a wrong ID");
                            return; // todo UI error message
                        }

                        if (!newScheme) {
                            newScheme = new CodeScheme(codeRow["scheme_id"], codeRow["scheme_name"], false);
                        }

                        let newShortcut = codeRow["code_shortcut"];
                        if (codeRow["code_shortcut"].length === 1 && Number.isNaN(parseInt(codeRow["code_shortcut"]))) {
                            // initialize shortcuts
                            newShortcut = UIUtils.ascii(codeRow["code_shortcut"]);
                        }

                        let newCode;
                        if (code_regex && typeof codeRow["code_regex"] === "string") {
                            newCode = new Code(newScheme, codeRow["code_id"], codeRow["code_value"], codeRow["code_colour"], newShortcut, false, [codeRow["code_regex"], "g"]);
                        } else {
                            newCode = new Code(newScheme, codeRow["code_id"], codeRow["code_value"], codeRow["code_colour"], newShortcut, false);
                        }


                        if (code_words) {

                            if (codeRow["code_words"].length !== 0) {
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

                let oldActiveRowCodeId = $(".code-row.active").attr("codeid");

                for (let [codeId, code] of tempScheme.codes.entries()) {
                    // update existing codes
                    let codeRow = $(".code-row[codeid='" + codeId + "']");
                    if (newScheme.codes.has(codeId)) {
                        let newCode = newScheme.codes.get(codeId);
                        newCode.owner = tempScheme;
                        codeRow.find(".code-input").attr("value", newCode.value);

                        if (newCode.length > 0) {
                            // don't set value to empty string, it still counts as value, fails validation and loses placeholder text
                            codeRow.find(".shortcut-input").attr("value", String.fromCharCode(newCode.shortcut));
                        }

                        codeRow.find("td").attr("style", "background-color: " + (newCode.color ? newCode.color : "#ffffff"));
                        tempScheme.codes.set(codeId, newCode);
                        newScheme.codes.delete(codeId);
                    } else {
                        // not in the new scheme, remove row and set a new active row if necessary
                        /*
                        let isActive = codeRow.hasClass("active");
                        if (isActive) {
                            let newActiveRow = $(".code-row:last");
                            newActiveRow.addClass("active");
                            codeEditorManager.activeCode = newActiveRow.attr("code-id");
                        }
                        */

                        codeRow.remove();
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

                let newActiveRowCodeId = $(".code-row.active").attr("codeid");
                if (newActiveRowCodeId !== oldActiveRowCodeId) {
                    let newActiveRow = $(".code-row:last");
                    newActiveRow.addClass('active');
                }

                codeEditorManager.activeCode = newActiveRowCodeId;
                codeEditorManager.updateCodePanel(tempScheme.codes.get(codeEditorManager.activeCode));

                /*
                let activeCode = tempScheme.codes.get($(".code-row.active").attr("code-id"));
                if (activeCode) {
                    codeEditorManager.updateCodePanel(activeCode);
                } else {
                    // make a row active and update the code panel accordingly
                    let newActiveRow = $(".code-row:last");
                    newActiveRow.addClass('active');
                    codeEditorManager.activeCode = newActiveRow.attr("code-id");
                    codeEditorManager.updateCodePanel(tempScheme.codes.get(codeEditorManager.activeCode.id));
                }
                */

                // update the activity stack
                storage.saveActivity({
                    "category": "SCHEME",
                    "message": "Uploaded new version of scheme",
                    "messageDetails": {"scheme": tempScheme.id},
                    "data": tempScheme.toJSON(),
                    "timestamp": new Date()
                });
            }
        }
        $("#scheme-upload-file")[0].value = ""; // need to reset so same file can be reloaded ie caught by 'onchange' listener
    });

    $("#undo").on("click", () => {
        messageViewerManager.undoHandler();
    });

    $("#redo").on("click", () => {
        messageViewerManager.redoHandler();
    });

    $("#save-all-button").on("click", () => {
        storage.saveDataset(newDataset);

        let successAlert = $("#alert");
        successAlert.removeClass("alert-danger").addClass("alert-success");
        successAlert.append("<strong>Saved!</strong> Successfully stored the current dataset.");
        successAlert.show();
        $(".tableFloatingHeaderOriginal").hide();
        successAlert.fadeTo(2000, 500).slideUp(500, () => {
            successAlert.slideUp(500, () => {
                successAlert.removeClass("alert-success");
                successAlert.empty();
                successAlert.append($('<a href="#" class="close" data-hide="alert" aria-label="close">&times;</a>'));
                $(".tableFloatingHeaderOriginal").show(); // hack until header bug is fixed (todo)
            });
        });


        // update the activity stack
        storage.saveActivity({
            "category": "DATASET",
            "message": "Saved dataset via button",
            "messageDetails": "", // todo add identifier
            "data": {"events": dataset["events"].size, "schemes": Object.keys(dataset["schemes"]).length, "sessions": dataset["sessions"].size} ,
            "timestamp": new Date()
        });
    });

    $("#horizontal-coding").on("click", () => {
        messageViewerManager.horizontal = true;
        storage.saveActivity({
            "category": "CODING",
            "message": "changed coding style to horizontal",
            "messageDetails": "",
            "data": {} ,
            "timestamp": new Date()
        });
    });

    $("#vertical-coding").on("click", () => {
        messageViewerManager.horizontal = false;
        storage.saveActivity({
            "category": "CODING",
            "message": "changed coding style to vertical",
            "messageDetails": "",
            "data": {} ,
            "timestamp": new Date()
        });
    });

    $("#code-now-button").on("click", () => {

        // code and re-sort dataset
        regexMatcher.codeDataset(messageViewerManager.activeScheme);

        if (messageViewerManager.currentSort === messageViewerManager.sortUtils.sortEventsByConfidenceOnly) {
            newDataset.sortEventsByConfidenceOnly(tempScheme["id"]);
        }
        if (messageViewerManager.currentSort === messageViewerManager.sortUtils.sortEventsByScheme) {
            newDataset.sortEventsByScheme(tempScheme["id"], true);
        }
        if (messageViewerManager.currentSort === messageViewerManager.sortUtils.restoreDefaultSort) {
            newDataset.restoreDefaultSort();
        }

        // update the activity stack
        storage.saveActivity({
            "category": "CODING",
            "message": "Automated coding",
            "messageDetails": "button",
            "data": "",
            "timestamp": new Date()
        });

        /*
        // redraw rows
        var tbody = "";

        let halfPage = Math.floor(messageViewerManager.rowsInTable / 2);
        let stoppingCondition = (messageViewerManager.lastLoadedPageIndex * halfPage + halfPage > newDataset.eventOrder.length) ? newDataset.eventOrder.length : messageViewerManager.lastLoadedPageIndex * halfPage + halfPage;

        for (let i = (messageViewerManager.lastLoadedPageIndex - 1) * halfPage; i < stoppingCondition; i++) {
            let eventKey = newDataset.eventOrder[i];
            tbody += messageViewerManager.buildRow(newDataset.events.get(eventKey), i, newDataset.events.get(eventKey).owner);
        }

        // redraw scrollbar
        const thumbPosition = scrollbarManager.getThumbPosition();
        scrollbarManager.redraw(newDataset, activeSchemeId);
        scrollbarManager.redrawThumb(thumbPosition);

        var messagesTbody = messageViewerManager.messageContainer.find("tbody");
        var previousScrollTop = messageViewerManager.messageContainer.scrollTop();
        var previousActiveRow = activeRow.attr("id");

        messagesTbody.empty();
        messagesTbody.append(tbody);
        messageViewerManager.messageContainer.scrollTop(previousScrollTop);
        activeRow = $("#" + previousActiveRow).addClass("active");
        */

        // redraw body, PRESERVE ACTIVE ROW
        messageViewerManager.messageTable.find("tbody").empty();
        messageViewerManager.decorationTable.find("tbody").empty();

        if (!activeRow) {
            activeRow = $(".message-row:first");
        }

        messageViewerManager.bringEventIntoView2(activeRow.attr("eventid"));

        // redraw scrollbar
        scrollbarManager.redraw(newDataset, messageViewerManager.activeScheme);
        scrollbarManager.redrawThumbAtEvent(newDataset.eventOrder.indexOf(activeRow.attr("eventid")));

    });

    $("#submit").on("click", event => {
        let regex = $('#regexModal-user-input').val();
        if (regex && regex.length > 0) {
            try {
                let flags = "";
                $(".form-check-input").each((index, checkbox) => {
                    let flag = $(checkbox).attr("name");
                    switch(flag) {
                        case "case-insensitive":
                            if ($(checkbox).prop("checked")) {
                                flags += "i";
                            }
                            break;

                        case "multi-line":
                            if ($(checkbox).prop("checked")) {
                                flags += "m";
                            }
                            break;

                        case "sticky":
                            if ($(checkbox).prop("checked")) {
                                flags += "s";
                            }
                            break;

                        case "unicode":
                            if ($(checkbox).prop("checked")) {
                                flags += "u";
                            }
                            break;
                    }

                });

                flags += "g";

                let regExp = new RegExp(regex, flags);
                $("#regex-user").find("input").val(regExp);
                tempScheme.codes.get(state.activeEditorRow).setRegexFromRegExpObj(regExp);
                $("#regexModal").modal('hide');

                // update the activity stack
                storage.saveActivity({
                    "category": "REGEX",
                    "message": "Entered new regex",
                    "messageDetails": {"scheme": tempScheme["id"], "code": state.activeEditorRow, "regex": regExp.source},
                    "data": tempScheme.toJSON(),
                    "timestamp": new Date()
                });
            } catch(e) {
                $("#regex-input-error").text(e);
                // update the activity stack
                storage.saveActivity({
                    "category": "REGEX",
                    "message": "Invalid regex entered",
                    "messageDetails": {"error": e},
                    "data": tempScheme.toJSON(),
                    "timestamp": new Date()
                });
            }
        } else {
            $("#regex-user").find("input").val("");
            tempScheme.codes.get(state.activeEditorRow).clearRegex();
            $("#regexModal").modal('hide');
            // update the activity stack
            storage.saveActivity({
                "category": "REGEX",
                "message": "Cleared custom regex",
                "messageDetails": {"code": state.activeEditorRow ,"scheme": tempScheme["id"]},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()
            });
        }
    });

    $("#regex-user").find(".input-group-btn").on("click", () => {
        $("#regex-input-error").text("");
        $(".modal-title").find("span").text(tempScheme.codes.get(state.activeEditorRow).value);

        let regex = tempScheme.codes.get(state.activeEditorRow).regex;
        $("#regexModal-user-input").val(regex && regex[0] ? regex[0] : "");

        // set flags options
        let checkBoxes = $("#regexModal").find(".form-check-input");
        checkBoxes.each((index, checkbox) => {
            let name = $(checkbox).prop("name");
            switch(name) {
                case "case-insensitive":
                    $("checkbox").prop("checked", regex[1].indexOf("i") > -1);
                    break;

                case "multi-line":
                    $("checkbox").prop("checked", regex[1].indexOf("m") > -1);
                    break;

                case "sticky":
                    $("checkbox").prop("checked", regex[1].indexOf("s") > -1);
                    break;

                case "unicode":
                    $("checkbox").prop("checked", regex[1].indexOf("c") > -1);
                    break;
            }
        });

        // try constructing the regex to see if what was loaded is valid!
        try {
            new RegExp(regex[0], regex[1]);
        } catch (e) {
            $("#regex-input-error").text(e);
            //return false;
        }
    });

    console.time("body.show()");
    $("body").show();
    messageViewerManager.resizeViewport();
    console.timeEnd("body.show()");
    console.timeEnd("TOTAL UI INITIALISATION TIME");
}