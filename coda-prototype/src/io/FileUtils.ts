declare let UIUtils;
declare let Papa;

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
        for (let event of dataset.events.values()) {
            if (Object.keys(dataset.schemes).length === 0) { // If there are no schemes:
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
                for (let schemeKey of Object.keys(dataset.schemes)) {
                    let newEventData = [];
                    newEventData.push(event.name);
                    newEventData.push(event.timestamp);
                    newEventData.push(event.owner);
                    newEventData.push(event.data);
                    newEventData.push(schemeKey);
                    newEventData.push(dataset.schemes[schemeKey].name);

                    if (event.decorations.has(schemeKey)) {
                        // If this row has been coded under this scheme, include its coding
                        let decoration = event.decorations.get(schemeKey);
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
     * @returns {Promise<Dataset>} Resolves with a parsed dataset if the file was successfully loaded and parsed,
     * or rejects with the parse errors if the parse failed. FIXME: If the file doesn't load then nothing will happen.
     */
    static loadDataset(file: File, uuid: string): Promise<Dataset> {
        return new Promise((resolve, reject) => {
            FileUtils.readFileAsText(file).then(readResult => {
                // Attempt to parse the dataset read from the file.
                let parse = Papa.parse(readResult, {header: true});

                // If parsing failed, reject.
                if (parse.errors.length > 0) {
                    reject(parse.errors);
                    return;
                }

                let parsedObjects = parse.data;
                let dataset = new Dataset();
                let events = new Map();
                let nextEvent = null;

                // If well-formed, the data file being imported has a row for each codable data item/coding scheme pair.
                // Loop over each of these rows to build a dataset object.
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

                    // If this parsed row has the minimum information set required to construct an entry in the dataset,
                    // construct that entry and add it to the dataset.
                    // TODO: Break this into smaller functions?
                    if (id && owner && data) {
                        if (!dataset) {
                            dataset = new Dataset(); // TODO: Determine whether this check is necessary.
                        }

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

                        if (!dataset.sessions.has(eventRow["owner"])) {
                            let newSession = new Session(eventRow["owner"], [nextEvent]);
                            dataset.sessions.set(eventRow["owner"], newSession);
                        } else {
                            let session = dataset.sessions.get(eventRow["owner"]);
                            if (session.events.has(nextEvent["name"])) {
                                session.events.set(nextEvent["name"], nextEvent);
                            }
                        }

                        // If this parsed row has the minimum information set required to construct a code scheme entry,
                        // construct that entry and add it to the dataset
                        if (schemeId && schemeName && deco_codevalue && deco_codeId && deco_manual
                            && eventRow["schemeId"].length > 0 && eventRow["schemeName"].length > 0
                            && eventRow["deco_codeValue"].length > 0) {
                            /* TODO: Understand this bit and document. It's adding a scheme if one does not exist,
                                     but this requires knowing what a scheme here represents. */
                            let newScheme;
                            if (!dataset.schemes[eventRow["schemeId"]]) {
                                newScheme = new CodeScheme(eventRow["schemeId"], eventRow["schemeName"], false);
                                dataset.schemes[newScheme.id] = newScheme;
                            } else {
                                newScheme = dataset.schemes[eventRow["schemeId"]];
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

                        if (isNewEvent) {
                            dataset.eventOrder.push(nextEvent.name);
                            dataset.events.set(nextEvent.name, nextEvent);
                        }
                    }
                }

                resolve(dataset);
            });
        });
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

                            let newShortcut: string = codeRow["code_shortcut"];
                            if (codeRow["code_shortcut"].length === 1 && isNaN(parseInt(codeRow["code_shortcut"]))) {
                                newShortcut = UIUtils.ascii(codeRow["code_shortcut"]).toString();
                            }

                            let newCode: Code;
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
