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
$("#editor-row").css("height", codeEditorPanel.outerHeight(true) - codeEditorPanel.find(".panel-heading").outerHeight(true) - $("#panel-row").outerHeight(true) - $("#button-row").outerHeight(true) - 10);
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
                "data": {
                    "events": newDataset.eventCount,
                    "schemes": newDataset.schemeCount,
                    "sessions": newDataset.sessionCount
                },
                "timestamp": new Date()
            });
            initUI(newDataset);
            undoManager.markUndoPoint(messageViewerManager.codeSchemeOrder);
        })
        .catch(error => {
            if (error) console.log(error);
            console.time("Default data init");
            $.getJSON("./data/sessions-numbered-10000.json", function(data) {
                // todo ensure ALL IDs are unique
                newDataset = function(data) {
                    var decorations = {};
                    var eventCount = 0;
                    var schemes = new Map();

                    var properDataset = new Dataset();
                    Object.keys(data).forEach(function(sessionKey) {
                        var events = [];
                        data[sessionKey]["events"].forEach(function(event) {
                            var newEventObj = new RawEvent(eventCount + "", sessionKey, event["timestamp"], "", event["data"]);

                            // TODO: Move to Dataset API by moving this default dataset code to its function on dataset
                            // TODO: (this was a WIP on iss74-dataset-tests)
                            properDataset.eventOrder.push(newEventObj.name);
                            properDataset.events.set(newEventObj.name, newEventObj);
                            eventCount += 1;

                            Object.keys(event["decorations"]).forEach(function(d) {
                                var decorationValue = event["decorations"][d];

                                if (!decorations.hasOwnProperty(d)) {
                                    // TODO: how to do scheme ids
                                    let newSchemeId = UIUtils.randomId(Object.keys(schemes)).toString();
                                    schemes.set(newSchemeId, new CodeScheme(newSchemeId, d, true));
                                    decorations[d] = newSchemeId;
                                }

                                if (decorationValue.length > 0) {
                                    var scheme = schemes.get(decorations[d]);
                                    if (!schemes.get(decorations[d]).getCodeValues().has(decorationValue)) {
                                        var newCodeId = decorations[d] + "-" + UIUtils.randomId(Array.from(scheme.codes.keys()));
                                        scheme.codes.set(newCodeId, new Code(scheme, newCodeId, decorationValue, "#ffffff", "", false));
                                    }

                                    var code = scheme.getCodeByValue(decorationValue);
                                    newEventObj.decorate(decorations[d], CodingMode.Manual, UUID, code, 0.95); // has to use decorations[d] as scheme key
                                }
                            });
                            events.push(newEventObj);
                        });
                        var session = new Session(sessionKey, events);
                        properDataset.sessions.set(sessionKey, session);
                    });

                    properDataset.schemes = schemes;
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
});
/*.then(dataset => {
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

function loadVersion() {
    $.getJSON("version.json", version => {
        let versionText;
        if (version.hash === "develop") {
            // This is not a deployed version, so don't claim a version number.
            versionText = "develop";
        } else {
            // Display short forms of the hash and date to save screen space.
            let hashForDisplay = `${version.hash.substring(0, 6).toUpperCase()}`;
            let dateForDisplay = version.date.substring(0, 16);

            versionText = `v${hashForDisplay} at ${dateForDisplay}`;
        }

        console.log("Version: " + version.hash);
        console.log("Date: " + version.date);

        storage.saveActivity({
            "category": "VERSION",
            "message": "Version identified",
            "messageDetails": version,
            "data": "",
            "timestamp": new Date()
        });

        $("#version-label").text(versionText);
    });
}

function initUI(dataset) {
    console.time("TOTAL UI INITIALISATION TIME");
    var messagePanel = $("#message-panel");
    var editorRow = $("#editor-row");

    loadVersion();

    console.time("total messageview init");
    $("#success-codescheme-alert").hide();
    $("#success-dataset-alert").hide();
    $("#fail-upload").hide();
    $("#alert").hide();

    messageViewerManager.init(messagePanel, dataset);
    console.timeEnd("total messageview init");

    console.time("stickyheaders init");
    $("#deco-table").stickyTableHeaders({scrollableArea: messagePanel, container: messagePanel, fixedOffset: 1});

    $("#message-table").stickyTableHeaders({scrollableArea: messagePanel, container: messagePanel, fixedOffset: 1});

    $("#code-table").stickyTableHeaders({scrollableArea: editorRow});
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
            let dataBlob = new Blob([activity], {type: "application/json"});
            FileUtils.saveFile(dataBlob, downloadId => console.log("Downloaded activity file with id: " + downloadId));
        });
    });

    $("#export-dataset").click(() => FileUtils.saveDataset(newDataset));

    /**
     * Handles loading a new dataset after the user has selected a new dataset file via the Dataset dropdown.
     */
    $("#dataset-file").on("change", event => {
        $(event.target).parents(".dropdown").removeClass("open");

        UIUtils.hideAlert(); // Ensure alert is hidden even if not replaced.

        let files = $("#dataset-file")[0].files;
        if (files.length !== 1) {
            UIUtils.displayAlertAsError("Too many files selected. Only one dataset file can be uploaded at once");
            console.log("ERROR: Multiple files selected. Files were:", files);
            return;
        }

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

            if (dataset && dataset.eventCount > 0) {
                // TODO: Move this if to Dataset.generateDefaultScheme?
                if (dataset.schemeCount === 0) {
                    let defaultScheme = new CodeScheme("1", "default", false);
                    defaultScheme.codes.set(
                        defaultScheme.id + "-" + "01",
                        new Code(
                            defaultScheme, defaultScheme.id + "-" + "01", "Test", "#ffffff",
                            UIUtils.ascii("t"), false
                        )
                    );
                    dataset.addScheme(defaultScheme);
                }

                newDataset = dataset;
                newDataset.restoreDefaultSort();
                messageViewerManager.buildTable(newDataset, messageViewerManager.rowsInTable, true);
                $("body").show();
                messageViewerManager.resizeViewport();

                undoManager.pointer = 0;
                undoManager.schemaUndoStack = [];
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

                UIUtils.displayAlertAsSuccess("<strong>Success!</strong> New dataset was imported.");
            } else {
                // update the activity stack
                storage.saveActivity({
                    "category": "DATASET",
                    "message": "Failed to import dataset",
                    "messageDetails": {"dataset": file.name},
                    "data": "",
                    "timestamp": new Date()
                });

                UIUtils.displayAlertAsError(UIUtils.defaultLoadErrorMessage);

                console.log("ERROR: Dataset object is empty or has no events.");
                console.log(dataset);
            }
        }

        /**
         * Notifies the user that parsing the dataset file failed, via the alert banner.
         * Prints the first 100 parse errors to the console.
         */
        function handleDatasetParseError(error) {
            switch (error.name) {
                case "ParseError":
                    UIUtils.displayAlertAsError(UIUtils.defaultLoadErrorMessage);

                    let errors = error.parseErrors;
                    if (errors.length > 100) { // only report first 100 wrong lines
                        errors = error.parseErrors.slice(0, 100);
                    }

                    console.log("ERROR: CANNOT PARSE CSV");
                    console.log(JSON.stringify(errors));
                    break;
                case "DuplicatedMessageIdsError":
                    console.log("Error: Non-unique message ids:", error.conflictingMessages);

                    // Sort on id to place messages with the same id next to each other
                    error.conflictingMessages.sort((a, b) => a.id.localeCompare(b.id));

                    // Display the conflicting messages in a table on the error modal.
                    d3
                        .select("#duplicatedMessageIdsTable")
                        .select("tbody")
                        .selectAll("tr")
                        .remove();

                    let trs = d3
                        .select("#duplicatedMessageIdsTable")
                        .select("tbody")
                        .selectAll("tr")
                        .data(error.conflictingMessages)
                        .enter()
                        .append("tr")
                        .attr("class", // Add a line separating each group of conflicting messages.
                            (p, i) => i === 0 || p.id !== error.conflictingMessages[i - 1].id ? "row-line" : "");

                    trs.append("td").text(p => p.id);
                    trs.append("td").text(p => p.message);

                    $("#duplicatedMessageIdsNewIds")
                        .off("click")
                        .on("click", () =>
                            FileUtils
                                .loadDataset(file, UUID, DuplicatedMessageIdMode.NewIds)
                                .then(handleDatasetParsed, handleDatasetParseError)
                        );

                    $("#duplicatedMessageIdsChooseOne")
                        .off("click")
                        .on("click", () =>
                            FileUtils
                                .loadDataset(file, UUID, DuplicatedMessageIdMode.ChooseOne)
                                .then(handleDatasetParsed, handleDatasetParseError)
                        );

                    // Scroll the table back to the top when the modal is dismissed.
                    $("#duplicatedMessageIdsModal")
                        .off("hide.bs.modal")
                        .on("hide.bs.modal", () =>
                            window.setTimeout(() => $("#duplicatedMessageIdsTableContainer").scrollTop(0), 100));

                    $("#duplicatedMessageIdsModal").modal("show");
                    break;
                default:
                    UIUtils.displayAlertAsError(UIUtils.defaultLoadErrorMessage);
                    console.log("An unexpected error type occurred. The error was:", error);
            }
        }

        FileUtils.loadDataset(file, UUID).then(handleDatasetParsed, handleDatasetParseError);

        $("#dataset-file")[0].value = ""; // need to reset so the 'onchange' listener will catch reloading the same file
    });

    /**
     * Handles loading a new scheme after the user has selected a new scheme file via the Dataset dropdown.
     */
    $("#scheme-file").on("change", event => {
        $(event.target).parents(".dropdown").removeClass("open");

        UIUtils.hideAlert(); // Ensure alert is hidden even if not replaced.

        let files = $("#scheme-file")[0].files;
        if (files.length !== 1) {
            UIUtils.displayAlertAsError("Too many files selected. Only one scheme file can be uploaded at once");
            console.log("ERROR: Multiple files selected. Files were:", files);
            return;
        }

        let file = files[0];
        console.log("Filename: " + file.name);
        console.log("Type: " + files.type);
        console.log("Size: " + files.size + " bytes");

        function handleSchemeParsed(newScheme) {
            // TODO: Rewrite this in a much nicer way.
            // TODO: ATM this detects if one of many errors exists, then re-tests at a finer level to guess which one.
            // TODO: We should rewrite to move as many error cases to handleSchemeParsedError as is sensible to do so,
            // TODO: then test and return on each remaining error individually.
            if (newScheme === null || newScheme.codes.size === 0 || newDataset.hasScheme(newScheme.id)) {
                let isDuplicate = newScheme !== null && newDataset.hasScheme(newScheme.id);

                let err;
                if (isDuplicate) {
                    err = "can't import duplicate scheme";
                } else if (newScheme === null) {
                    err = "scheme object is null.";
                } else {
                    err = "scheme contains no codes.";
                }
                console.log("ERROR: Can't create scheme object - %s" % err);

                let errorText = isDuplicate
                    ? "Can't import duplicate coding scheme (ID: '" + newScheme["id"] + "')." +
                    " To update an existing coding scheme access it via code editor."
                    : UIUtils.defaultLoadErrorMessage;
                UIUtils.displayAlertAsError(errorText);
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

                newDataset.addScheme(newScheme);
                messageViewerManager.addNewSchemeColumn(newScheme);

                UIUtils.displayAlertAsSuccess("<strong>Success!</strong> New coding scheme was imported.");
            }
        }

        function handleSchemeParseError(error) {
            UIUtils.displayAlertAsError(UIUtils.defaultLoadErrorMessage);

            if (error.name === "ParseError") {
                let parseErrors = error.parseErrors;
                console.log("ERROR: Cannot parse scheme file");
                if (parseErrors.length > 100) { // only report first 100 wrong lines
                    parseErrors = parseErrors.slice(0, 100);
                }
                console.log(JSON.stringify(parseErrors));
            } else if (error.name === "CodeConsistencyError") {
                console.log("ERROR: Uploaded code scheme has multiple ids.");
            } else if (error.name === "NoValuesError") {
                console.log("ERROR: Uploaded code scheme has valid column headers but no values");
            } else {
                console.log("ERROR: An unknown error occurred. The error was: ", error);
            }
        }

        FileUtils.loadCodeScheme(file).then(handleSchemeParsed, handleSchemeParseError);

        $("#scheme-file")[0].value = ""; // need to reset so same file can be reloaded ie caught by 'onchange' listener
    });

    /**
     * Handles updating an existing scheme after a user has a selected a scheme file via the editor's upload button.
     */
    $("#scheme-upload-file").on("change", () => {
        UIUtils.hideAlert(); // Ensure alert is hidden even if not replaced.

        let files = $("#scheme-upload-file")[0].files;

        if (files.length !== 1) {
            UIUtils.displayAlertAsError("Too many files selected. Only one scheme file can be uploaded at once");
            console.log("ERROR: Multiple files selected. Files were:", files);
            return;
        }

        let file = files[0];
        console.log("Filename: " + file.name);
        console.log("Type: " + file.type);
        console.log("Size: " + file.size + " bytes");

        function handleSchemeParsed(updatedScheme) {
            // If the uploaded scheme is not a new version of the scheme to be updated, fail.
            if (updatedScheme.id !== tempScheme.id) {
                console.log("ERROR: Trying to upload scheme with a wrong ID");
                UIUtils.displayAlertAsError("Data scheme format error - wrong id");
                return;
            }

            codeEditorManager.updateScheme(updatedScheme);

            UIUtils.displayAlertAsSuccess("<strong>Success!</strong> Coding scheme was updated.");

            // update the activity stack
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Uploaded new version of scheme",
                "messageDetails": {"scheme": tempScheme.id},
                "data": tempScheme.toJSON(),
                "timestamp": new Date()
            });
        }

        function handleSchemeParseError(error) {
            UIUtils.displayAlertAsError(UIUtils.defaultLoadErrorMessage);

            if (error.name === "ParseError") {
                console.log("ERROR: Cannot parse scheme file.");
                console.log(JSON.stringify(error.parseErrors));
            } else if (error.name === "CodeConsistencyError") {
                console.log("ERROR: Uploaded code scheme has multiple ids.");
            } else if (error.name === "NoValuesError") {
                console.log("ERROR: Uploaded code scheme has valid column headers but no values");
            } else {
                console.log("ERROR: An unknown error occurred. The error was:", error);
            }
        }

        FileUtils.loadCodeScheme(file).then(handleSchemeParsed, handleSchemeParseError);

        $("#scheme-upload-file")[0].value = ""; // need to reset so same file can be reloaded ie caught by 'onchange' listener
    });

    $("#quit").on("click", () => {
        storage.saveDataset(newDataset);

        // todo: prompt to export all files with dialog box

        chrome.tabs.getCurrent(tab => {
            chrome.tabs.remove(tab.id);
        });

    });

    $("#scheme-download").on("click", () => FileUtils.saveCodeScheme(tempScheme));

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
    // TODO: I don't think there is a scheme-duplicate button
    $("#scheme-duplicate").on("click", () => {
        let newScheme = tempScheme.duplicate(newDataset.schemeIds);
        newDataset.addScheme(newScheme);
        messageViewerManager.addNewSchemeColumn(newScheme);

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

    $("#undo").on("click", () => {
        messageViewerManager.undoHandler();
    });

    $("#redo").on("click", () => {
        messageViewerManager.redoHandler();
    });

    $("#save-all-button").on("click", () => {
        storage.saveDataset(newDataset);

        UIUtils.displayAlertAsSuccess("<strong>Saved!</strong> Successfully stored the current dataset.");

        // update the activity stack
        storage.saveActivity({
            "category": "DATASET",
            "message": "Saved dataset via button",
            "messageDetails": "", // todo add identifier
            "data": {
                "events": dataset.eventCount,
                "schemes": dataset.schemeCount,
                "sessions": dataset.sessionCount
            },
            "timestamp": new Date()
        });
    });

    $("#horizontal-coding").on("click", () => {
        messageViewerManager.horizontal = true;
        storage.saveActivity({
            "category": "CODING",
            "message": "changed coding style to horizontal",
            "messageDetails": "",
            "data": {},
            "timestamp": new Date()
        });
    });

    $("#vertical-coding").on("click", () => {
        messageViewerManager.horizontal = false;
        storage.saveActivity({
            "category": "CODING",
            "message": "changed coding style to vertical",
            "messageDetails": "",
            "data": {},
            "timestamp": new Date()
        });
    });

    $("#code-now-button").on("click", () => {

        // code and re-sort dataset
        regexMatcher.codeDataset(messageViewerManager.activeSchemeId);

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
        scrollbarManager.redraw(newDataset, messageViewerManager.activeSchemeId);
        scrollbarManager.redrawThumbAtEvent(newDataset.positionOfEvent(activeRow.attr("eventid")));
    });

    $("#submit").on("click", event => {
        let regex = $("#regexModal-user-input").val();
        if (regex && regex.length > 0) {
            try {
                let flags = "";
                $(".form-check-input").each((index, checkbox) => {
                    let flag = $(checkbox).attr("name");
                    switch (flag) {
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
                $("#regexModal").modal("hide");

                // update the activity stack
                storage.saveActivity({
                    "category": "REGEX",
                    "message": "Entered new regex",
                    "messageDetails": {
                        "scheme": tempScheme["id"],
                        "code": state.activeEditorRow,
                        "regex": regExp.source
                    },
                    "data": tempScheme.toJSON(),
                    "timestamp": new Date()
                });
            } catch (e) {
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
            $("#regexModal").modal("hide");
            // update the activity stack
            storage.saveActivity({
                "category": "REGEX",
                "message": "Cleared custom regex",
                "messageDetails": {"code": state.activeEditorRow, "scheme": tempScheme["id"]},
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
            switch (name) {
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
