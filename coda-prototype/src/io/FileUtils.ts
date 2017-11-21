declare let UIUtils;
declare let Papa;

/**
 * Options for handling multiple messages which have the same id.
 */
enum DuplicatedMessageIdMode {
    Fail, // Stops importing the dataset, and rejects with an error object containing the problematic messages.
    ChooseOne, // For each group of messages with the same id, one message is arbitrarily selected and the rest deleted.
    NewIds // All messages are kept, but messages with conflicting ids are randomly assigned new ids.
}

class FileUtils {
    /**
     * Saves the given string to a file. The file is determined by a file selector UI.
     * @param {Blob} fileContents Data to write to the file.
     * @param {(downloadId: number) => void} onDownloadStartedHandler Function to run once the download has started
     *                                                                successfully.
     */
    static saveFile(fileContents: Blob, onDownloadStartedHandler ?: (downloadId: number) => void) {
        let url = window.URL.createObjectURL(fileContents);
        console.log("Saving file from URL", url);

        chrome.downloads.download({
            url: url,
            saveAs: true
        }, onDownloadStartedHandler);
    }

    /**
     * Exports the given dataset to file on disk.
     * @param {Dataset} dataset Dataset to save to disk.
     */
    static saveDataset(dataset: Dataset) {
        let eventJSON = {
            "data": [], "fields":
                ["id", "timestamp", "owner", "data", "schemeId", "schemeName", "deco_codeValue", "deco_codeId",
                    "deco_confidence", "deco_manual", "deco_timestamp", "deco_author"]
        };

        // For each 'event', add a row to the output for each scheme if schemes exist, or a single row if not.
        // TODO: Write this in a less-yucky way such that pushing many empty strings is not required
        for (let event of dataset.getEventsInSortOrder()) {
            if (dataset.schemeCount() === 0) {
                let newEventData = [];
                newEventData.push(event.name);
                newEventData.push(event.timestamp);
                newEventData.push(event.owner);
                newEventData.push(event.data);
                newEventData.push(""); // schemeId
                newEventData.push(""); // schemeName
                newEventData.push(""); // deco_codeValue
                newEventData.push(""); // deco_codeId
                newEventData.push(""); // deco_confidence
                newEventData.push(""); // deco_manual
                newEventData.push(""); // deco_timestamp
                newEventData.push(""); // deco_author

                eventJSON["data"].push(newEventData);
            } else { // Append this row with data for each scheme.
                for (let scheme of dataset.getSchemesAsArray()) {
                    let newEventData = [];
                    newEventData.push(event.name);
                    newEventData.push(event.timestamp);
                    newEventData.push(event.owner);
                    newEventData.push(event.data);
                    newEventData.push(scheme.id);
                    newEventData.push(scheme.name);

                    if (event.decorations.has(scheme.id)) {
                        // If this row has been coded under this scheme, include its coding
                        let decoration = event.decorations.get(scheme.id);
                        if (decoration.code != null) {
                            newEventData.push(decoration.code.value);
                            newEventData.push(decoration.code.id);
                        } else {
                            newEventData.push(""); // deco_codeValue
                            newEventData.push(""); // deco_codeId
                        }
                        newEventData.push(decoration.confidence);
                        newEventData.push(decoration.manual);
                        newEventData.push((decoration.timestamp) ? decoration.timestamp : "");
                        newEventData.push(""); // deco_author
                    } else { // append a blank coding.
                        newEventData.push(""); // deco_codeValue
                        newEventData.push(""); // deco_codeId
                        newEventData.push(""); // deco_confidence
                        newEventData.push(""); // deco_manual
                        newEventData.push(""); // deco_timestamp
                        newEventData.push(""); // deco_author
                    }

                    eventJSON["data"].push(newEventData);
                }
            }
        }

        let dataBlob = new Blob([Papa.unparse(eventJSON, {header: true, delimiter: ";"})], {type: 'text/plain'});

        FileUtils.saveFile(dataBlob, downloadId => {
            console.log("Downloaded file with id: " + downloadId);
            storage.saveActivity({
                "category": "DATASET",
                "message": "Exported dataset",
                "messageDetails": "", //todo identifier
                "data": "",
                "timestamp": new Date()
            });
        });
    }

    /**
     * Exports the given code scheme to a file on disk.
     * @param {CodeScheme} codeScheme Code scheme to save to disk.
     */
    static saveCodeScheme(codeScheme: CodeScheme) {
        let schemeJSON = {
            "data": [], "fields":
                ["scheme_id", "scheme_name", "code_id", "code_value", "code_colour",
                    "code_shortcut", "code_words", "code_regex", "code_regex_modifier"]
        };

        if (codeScheme.codes.size === 0) {
            schemeJSON["data"].push([codeScheme.id, codeScheme.name, "", "", "", "", "", "", ""]);
        } else {
            for (let [codeId, code] of codeScheme.codes) {
                let codeArr = [codeScheme.id, codeScheme.name, codeId, code.value, code.color,
                    code.shortcut, code.words.toString(), code.regex[0], code.regex[1]];
                schemeJSON["data"].push(codeArr);
            }
        }

        let dataBlob = new Blob([Papa.unparse(schemeJSON, {header: true, delimiter: ";"})], {type: 'text/plain'});
        FileUtils.saveFile(dataBlob, downloadId => {
            console.log("Downloaded file with id: " + downloadId);

            storage.saveActivity({
                "category": "SCHEME",
                "message": "Exported scheme",
                "messageDetails": {"scheme": codeScheme.id},
                "data": codeScheme.toJSON(),
                "timestamp": new Date()
            });
        });
    }

    static readFileAsText(file: File): Promise<string> {
        return new Promise<string>(resolve => {
            let reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsText(file);
        });
    }

    /**
     * Loads a file from disk and parses this into a Dataset.
     * Note that a successfully parsed Dataset object is not necessarily valid.
     * @param {File} file File to be read and parsed.
     * @param {string} uuid TODO
     * @param duplicatedMessageIdMode @see {@link DuplicatedMessageIdMode} for details.
     * @returns {Promise<Dataset>} Resolves with a parsed dataset if the file was successfully loaded and parsed,
     * or rejects with the parse errors if the parse failed. FIXME: If the file doesn't load then nothing will happen.
     */
    static loadDataset(file: File, uuid: string,
                       duplicatedMessageIdMode: DuplicatedMessageIdMode = DuplicatedMessageIdMode.Fail): Promise<Dataset> {
        return new Promise((resolve, reject) => {
            FileUtils.readFileAsText(file).then(readResult => {
                // Attempt to parse the dataset read from the file.
                let parse = Papa.parse(readResult, {header: true});

                // If parsing failed, reject with the parse errors.
                if (parse.errors.length > 0) {
                    reject({
                        name: "ParseError",
                        parseErrors: parse.errors
                    });
                    return;
                }

                // Quietly remove rows which do not have enough information to convert to an event
                // TODO: Warn the user when this happens? Coda has never done this in the past.
                let parsedObjects = parse.data.filter(eventRow => eventRow.hasOwnProperty("id") &&
                    eventRow.hasOwnProperty("owner") && eventRow.hasOwnProperty("data"));

                let conflicts: { conflictingEventRows: Array<{}>; conflictingIds: Set<string> } =
                    FileUtils.findConflictingMessagesInParsedData(parsedObjects);

                // If we have found non-unique message ids, handle this either by failing or by attempting clean-up
                // of the dataset.
                if (conflicts.conflictingIds.size > 0) {
                    switch (duplicatedMessageIdMode) {
                        case DuplicatedMessageIdMode.Fail:
                            reject({
                                name: "DuplicatedMessageIdsError",
                                conflictingMessages: conflicts.conflictingEventRows.map(eventRow => {
                                    return {
                                        id: eventRow["id"],
                                        message: eventRow["data"]
                                    };
                                })
                            });
                            return;
                        case DuplicatedMessageIdMode.NewIds:
                            // Generate a new, *unique* id for each of the conflicting rows
                            parsedObjects
                                .filter(eventRow => conflicts.conflictingIds.has(eventRow["id"]))
                                .forEach(eventRow => {
                                    let newId: string = "";
                                    do
                                        newId = String(Math.floor(Math.random() * Math.pow(10, 10)));
                                    while (parsedObjects.filter(row => row["id"] === newId).length > 0);

                                    eventRow["id"] = newId;
                                });
                            break;
                        case DuplicatedMessageIdMode.ChooseOne:
                            parsedObjects = parsedObjects.filter(
                                eventRow => !conflicts.conflictingIds.has(eventRow["id"]));
                            conflicts.conflictingIds.forEach(id => {
                                parsedObjects.push(conflicts.conflictingEventRows.filter(row => row["id"] === id)[0]);
                            });
                            break;
                        default:
                            console.log("Error: An unknown duplicated message id mode was specified. Given mode was:",
                                duplicatedMessageIdMode);
                            reject({
                                name: "UnrecognisedDuplicatedMessageIdMode",
                                specifiedMode: duplicatedMessageIdMode
                            });
                            return;
                    }
                }

                // If well-formed, the data file being imported has a row for each codable data item/coding scheme pair.
                // Loop over each of these rows to build a dataset object.
                let dataset = new Dataset();
                let events = new Map();
                let nextEvent = null;
                for (let eventRow of parsedObjects) {
                    let id: boolean = eventRow.hasOwnProperty("id"),
                        timestamp: boolean = eventRow.hasOwnProperty("timestamp"),
                        owner: boolean = eventRow.hasOwnProperty("owner"),
                        data: boolean = eventRow.hasOwnProperty("data"),
                        schemeId: boolean = eventRow.hasOwnProperty("schemeId"),
                        schemeName: boolean = eventRow.hasOwnProperty("schemeName"),
                        deco_codevalue: boolean = eventRow.hasOwnProperty("deco_codeValue"),
                        deco_codeId: boolean = eventRow.hasOwnProperty("deco_codeId"),
                        deco_confidence: boolean = eventRow.hasOwnProperty("deco_confidence"),
                        deco_manual: boolean = eventRow.hasOwnProperty("deco_manual"),
                        deco_timestamp: boolean = eventRow.hasOwnProperty("deco_timestamp"),
                        deco_author: boolean = eventRow.hasOwnProperty("deco_author");

                    let timestampData = timestamp ? eventRow["timestamp"] : "";

                    let isNewEvent = !events.has(eventRow["id"]);
                    if (isNewEvent) {
                        nextEvent = new RawEvent(
                            eventRow["id"], eventRow["owner"], timestampData, eventRow["id"], eventRow["data"]
                        );
                        events.set(eventRow["id"], nextEvent);
                    } else {
                        nextEvent = events.get(eventRow["id"]);
                    }

                    dataset.addEvent(nextEvent);

                    // If this parsed row has the minimum information set required to construct a code scheme entry,
                    // construct that entry and add it to the dataset
                    if (schemeId && schemeName && deco_codevalue && deco_codeId && deco_manual
                        && eventRow["schemeId"].length > 0 && eventRow["schemeName"].length > 0
                        && eventRow["deco_codeValue"].length > 0) {

                        let newScheme;
                        if (dataset.hasScheme(eventRow["schemeId"])) {
                            newScheme = dataset.getScheme(eventRow["schemeId"]);
                        } else {
                            newScheme = new CodeScheme(eventRow["schemeId"], eventRow["schemeName"], false);
                            dataset.addScheme(newScheme);
                        }

                        if (!newScheme.codes.has(eventRow["deco_codeId"])) {
                            newScheme.codes.set(
                                eventRow["deco_codeId"],
                                new Code(newScheme, eventRow["deco_codeId"],
                                    eventRow["deco_codeValue"], "", "", false)
                            );
                        }

                        let manual = eventRow["deco_manual"].toLocaleLowerCase() !== "false"; // manually coded

                        let confidence;
                        if (deco_confidence) {
                            let defaultConfidence = 0.95; // TODO: log a warning when this default is used?
                            if (eventRow["deco_confidence"].length === 0) {
                                confidence = defaultConfidence;
                            } else {
                                let float = parseFloat(eventRow["deco_confidence"]);
                                if (isNaN(float)) {
                                    confidence = defaultConfidence;
                                } else {
                                    confidence = float;
                                }
                            }
                        } else {
                            confidence = undefined;
                        }

                        nextEvent.decorate(
                            newScheme.id, manual, uuid, newScheme.codes.get(eventRow["deco_codeId"]), confidence
                        );
                    }
                }

                resolve(dataset);
            });
        });
    }

    /**
     * Searches a Papa-parsed dataset-file object for messages with the same id.
     * @param parsedObjects Array to search for non-unique message ids.
     * @returns {{conflictingEventRows: Array<{ id: string, owner: string, data: string }>,
     * conflictingIds: Set<string>}}
     */
    private static findConflictingMessagesInParsedData(parsedObjects: Array<{ id: string, owner: string, data: string }>): { conflictingEventRows: Array<{ id: string, owner: string, data: string }>, conflictingIds: Set<string> } {
        type id = string

        let observedEvents: Map<id, { id: id, owner: string, data: string }> = new Map();
        let conflictingIds: Set<id> = new Set();
        let conflictingEventRows: Array<{ id: id, owner: string, data: string }> = [];

        // Search for messages which have non-unique ids, by looking for pairs of messages which have the same
        // id but different owners.
        // It is necessary to allow multiple rows with the same id and owner in order to load a dataset with
        // multiple code schemes.
        for (let eventRow of parsedObjects) {
            if (observedEvents.has(eventRow["id"])) {
                if (observedEvents.get(eventRow["id"])["owner"] !== eventRow["owner"]) {
                    conflictingIds.add(eventRow["id"]);
                    conflictingEventRows.push(eventRow);
                    conflictingEventRows.push(observedEvents.get(eventRow["id"]));
                }
            } else {
                observedEvents.set(eventRow["id"], eventRow);
            }
        }

        return {
            conflictingEventRows: conflictingEventRows,
            conflictingIds: conflictingIds
        };
    }

    static loadCodeScheme(file: File): Promise<CodeScheme> {
        return new Promise<CodeScheme>((resolve, reject) => {
            FileUtils.readFileAsText(file).then(readResult => {
                // Attempt to parse the scheme read from the file.
                let parse = Papa.parse(readResult, {header: true});
                if (parse.errors.length > 0) {
                    reject({
                        name: "ParseError",
                        parseErrors: parse.errors
                    });
                    return;
                }

                let parsedObjects = parse.data;
                let newScheme: CodeScheme = null;
                let schemeId = null;

                if (parsedObjects.length === 0) {
                    reject({name: "NoValuesError"});
                    return;
                }

                // Each row defines a code within the code scheme.
                // Construct a CodeScheme object by parsing each code entry in turn.
                for (let codeRow of parsedObjects) {
                    let id: boolean = codeRow.hasOwnProperty("scheme_id"),
                        name: boolean = codeRow.hasOwnProperty("scheme_name"),
                        code_id: boolean = codeRow.hasOwnProperty("code_id"),
                        code_value: boolean = codeRow.hasOwnProperty("code_value"),
                        code_colour: boolean = codeRow.hasOwnProperty("code_colour"),
                        code_shortcut: boolean = codeRow.hasOwnProperty("code_shortcut"),
                        code_words: boolean = codeRow.hasOwnProperty("code_words"),
                        code_regex: boolean = codeRow.hasOwnProperty("code_regex"),
                        code_regex_modifier: boolean = codeRow.hasOwnProperty("code_regex_modifier");

                    // If there is enough information to construct a scheme from this entry, do so.
                    if (id && name) {
                        if (schemeId === null) {
                            schemeId = codeRow["scheme_id"];
                        } else {
                            if (schemeId !== codeRow["scheme_id"]) {
                                reject({name: "CodeConsistencyError", message: "Scheme id was inconsistent"});
                                return;
                            }
                        }

                        // Ensure the scheme's name is consistent across all codes.
                        if (newScheme !== null && codeRow["scheme_name"] !== newScheme.name) {
                            reject({name: "CodeConsistencyError", message: "Scheme name was inconsistent"});
                            return;
                        }

                        if (!newScheme) {
                            newScheme = new CodeScheme(codeRow["scheme_id"], codeRow["scheme_name"], false);
                        }

                        // If there is also enough information to construct a code, do so.
                        if (code_id && code_value && codeRow["code_id"] !== "" && codeRow["code_value"] !== "") {
                            // todo handle if loading an edit of a scheme that was already loaded in... how to deal if
                            // todo code was deleted?

                            if (newScheme.codes.has(codeRow["code_id"])) {
                                reject({
                                    name: "CodeConsistencyError",
                                    message: "Scheme file had multiple codes with the same id"
                                });
                                return;
                            }

                            let newShortcut = codeRow["code_shortcut"];
                            if (codeRow["code_shortcut"].length === 1 && isNaN(parseInt(codeRow["code_shortcut"]))) {
                                newShortcut = UIUtils.ascii(codeRow["code_shortcut"]);
                            }

                            let newCode;
                            if (code_regex || code_regex_modifier) {
                                let regex = code_regex ? codeRow["code_regex"] : "";
                                let modifier = code_regex_modifier ? codeRow["code_regex_modifier"] : "g";

                                newCode = new Code(newScheme, codeRow["code_id"], codeRow["code_value"],
                                    codeRow["code_colour"], newShortcut, false, [regex, modifier]);
                            } else {
                                newCode = new Code(newScheme, codeRow["code_id"], codeRow["code_value"],
                                    codeRow["code_colour"], newShortcut, false);
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
                }

                resolve(newScheme);
            });
        });
    }
}
