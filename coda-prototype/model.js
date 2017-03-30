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
let ENDING_PATTERN = "_";
class Dataset {
    constructor() {
        this.sessions = new Map();
        this.events = [];
    }
    /*
    NB: event names/ids are the initial indices when read from file for the first time!
    Once initialized, they aren't changed regardless of sorting and can be used to restore the default on-load ordering.
    */
    restoreDefaultSort() {
        this.events.sort((e1, e2) => {
            let name1 = parseInt(e1.name, 10);
            let name2 = parseInt(e2.name, 10);
            return name1 - name2;
        });
        return this.events;
    }
    sortEventsByScheme(schemeId, isToDoList) {
        schemeId = schemeId + ""; // force it to string todo: here or make sure decorationForName processes it ok?
        if ((this.schemes.hasOwnProperty && this.schemes.hasOwnProperty(schemeId)) || this.schemes[schemeId] != undefined) {
            let codes = Array.from(this.schemes[schemeId].codes.values()).map((code) => { return code.value; });
            this.events.sort((e1, e2) => {
                const deco1 = e1.decorationForName(schemeId);
                const deco2 = e2.decorationForName(schemeId);
                const hasCode1 = deco1 ? e1.decorationForName(schemeId).code != null : false;
                const hasCode2 = deco2 ? e2.decorationForName(schemeId).code != null : false;
                let code1 = hasCode1 ? codes.indexOf(e1.decorationForName(schemeId).code.value) : -1;
                let code2 = hasCode2 ? codes.indexOf(e2.decorationForName(schemeId).code.value) : -1;
                if (code1 == -1 && code2 != -1) {
                    // one assigned, one unassigned
                    return isToDoList ? -1 : 1;
                }
                if (code2 == -1 && code1 != -1) {
                    // one assigned, one unassigned
                    return isToDoList ? 1 : -1;
                }
                if (code1 == code2) {
                    if (code1 == -1) {
                        // neither event has a code assigned
                        return parseInt(e1.name) - parseInt(e2.name);
                    }
                    // same codes, now sort by manual/automatic & confidence
                    if (deco1.confidence != null && deco1.confidence != undefined && deco2 != null && deco2.confidence != undefined) {
                        if (deco1.manual != undefined && deco1.manual) {
                            if (deco2.manual != undefined && deco2.manual) {
                                return deco1.confidence - deco2.confidence || parseInt(e1.name) - parseInt(e2.name);
                            }
                            else {
                                return 1;
                            }
                        }
                        else if (deco2.manual != undefined && deco2.manual) {
                            return -1;
                        }
                        else {
                            return deco1.confidence - deco2.confidence || parseInt(e1.name) - parseInt(e2.name);
                        }
                    }
                    else if (deco1.confidence == null && deco2.confidence == null) {
                        return parseInt(e1.name) - parseInt(e2.name);
                    }
                    else if (deco1.confidence == null) {
                        return -1;
                    }
                    else if (deco2.confidence == null) {
                        return 1;
                    }
                    else
                        return 0;
                }
                // both have assigned codes that are different
                return code1 - code2; // todo sort ascending by index of code, which is arbitrary - do we enforce an order?
            });
        }
        return this.events;
    }
    sortEventsByConfidenceOnly(schemeId) {
        schemeId = schemeId + ""; // force it to string todo: here or make sure decorationForName processes it ok?
        if ((this.schemes.hasOwnProperty && this.schemes.hasOwnProperty(schemeId)) || this.schemes[schemeId] != undefined) {
            this.events.sort((e1, e2) => {
                let returnResult = 0;
                let deco1 = e1.decorationForName(schemeId);
                let deco2 = e2.decorationForName(schemeId);
                if (deco1 == undefined && deco2 == undefined) {
                    returnResult = parseInt(e1.name) - parseInt(e2.name);
                }
                else if (deco1 == undefined) {
                    let hasManual2 = deco2.manual != undefined || deco2.manual != null;
                    returnResult = hasManual2 ? -1 : parseInt(e1.name) - parseInt(e2.name);
                }
                else if (deco2 == undefined) {
                    let hasManual1 = deco1.manual != undefined || deco1.manual != null;
                    returnResult = hasManual1 ? 1 : parseInt(e1.name) - parseInt(e2.name);
                }
                else {
                    let hasManual1 = deco1.manual != undefined || deco1.manual != null;
                    let hasManual2 = deco2.manual != undefined || deco2.manual != null;
                    if (hasManual1 && hasManual2) {
                        if (deco1.manual) {
                            if (deco2.manual) {
                                returnResult = parseInt(e1.name) - parseInt(e2.name);
                            }
                            else {
                                // deco2 is before deco1, automatic always before manual
                                returnResult = 1;
                            }
                        }
                        else {
                            if (deco2.manual) {
                                // deco1 is before deco2, automatic always before manual
                                returnResult = -1;
                            }
                            else {
                                //both are automatic in which case compare confidence!
                                returnResult = deco1.confidence - deco2.confidence || parseInt(e1.name, 10) - parseInt(e2.name, 10);
                            }
                        }
                    }
                    else {
                        if (hasManual1 == hasManual2) {
                            // both are uncoded
                            returnResult = parseInt(e1.name) - parseInt(e2.name); // todo replace with ids
                        }
                        else if (hasManual1) {
                            // uncoded e2 before coded e1
                            returnResult = 1;
                        }
                        else if (hasManual2) {
                            // uncoded e1 before coded e2
                            returnResult = -1;
                        }
                        else {
                            console.log("something is wrong");
                        }
                    }
                }
                if ((returnResult < 0 && (deco1 && deco1.confidence > 0 && (deco2 == undefined))) ||
                    (returnResult > 0 && (deco2 && deco2.confidence > 0 && (deco1 == undefined))) ||
                    (returnResult > 0 && (deco2 && deco1 && deco2.confidence > deco1.confidence && deco2.code != null)) ||
                    (returnResult < 0 && (deco2 && deco1 && deco1.confidence > deco2.confidence && deco1.code != null))) {
                    console.log(e1.name + ", " + e2.name);
                }
                return returnResult;
            });
        }
        return this.events;
    }
    deleteScheme(schemeId) {
        for (let event of this.events) {
            event.uglify(schemeId);
        }
        delete this.schemes[schemeId];
        return this.events;
    }
}
class RawEvent {
    constructor(name, owner, timestamp, number, data) {
        this.name = name;
        this.owner = owner;
        this.timestamp = timestamp;
        this.number = number;
        this.data = data;
        this.decorations = new Map(); // string is code scheme id
        this.codes = new Map(); // string is code scheme id todo not necessary?
    }
    // todo refactor to not use codes just decorations
    codeForScheme(schemeId) {
        //return this.codes.get(schemeId);
        return this.decorations.get(schemeId).code;
    }
    schemeNames() {
        return Array.from(this.codes.keys());
    }
    assignedCodes() {
        return Array.from(this.codes.values());
    }
    decorate(schemeId, manual, code, confidence, timestamp) {
        // if (this.decorations.has(schemeId)) this.uglify(schemeId);
        let stringSchemeId = "" + schemeId;
        this.decorations.set(stringSchemeId, new EventDecoration(this, stringSchemeId, manual, code, confidence, timestamp));
    }
    uglify(schemeId) {
        let deco = this.decorations.get(schemeId);
        if (deco.code) {
            deco.code.removeEvent(this);
        }
        this.decorations.delete(schemeId);
        this.codes.delete(schemeId);
        return this;
    }
    decorationForName(schemeId) {
        return this.decorations.get(schemeId);
    }
    decorationNames() {
        return Array.from(this.decorations.keys());
    }
}
class EventDecoration {
    constructor(owner, id, manual, code, confidence, timestamp) {
        this.owner = owner;
        this.scheme_id = id;
        this.manual = manual;
        (confidence == undefined) ? this.confidence = 0 : this.confidence = confidence; // not sure this is a good idea
        if (code) {
            if (manual)
                code.addEvent(owner);
            this._timestamp = (timestamp) ? timestamp : new Date().toString();
            this._code = code;
        }
        else {
            this._code = null; // TODO: this will require null pointer checks
            this._timestamp = null;
        }
    }
    toJSON() {
        let obj = Object.create(null);
        obj.owner = this.owner.name;
        obj.scheme_id = this.scheme_id;
        obj.code = this.code.value;
        obj.confidence = this.confidence;
        obj.manual = this.manual;
        return obj;
    }
    set code(code) {
        this._timestamp = new Date().toString();
        this._code = code;
    }
    get code() {
        return this._code;
    }
    get timestamp() {
        return this._timestamp;
    }
}
class Session {
    constructor(id, events) {
        this.id = id;
        this.events = events;
        this.decorations = new Map();
    }
    decorate(decorationName, decorationValue) {
        this.decorations.set(decorationName, new SessionDecoration(this, decorationName, decorationValue));
    }
    decorationForName(decorationName) {
        return this.decorations.get(decorationName);
    }
    getAllDecorationNames() {
        let names = new Set();
        for (let e of this.events) {
            for (let key in e.decorations) {
                names.add(key);
            }
        }
        return names;
    }
    getAllEventNames() {
        let eventNames = new Set();
        for (let e of this.events) {
            eventNames.add(e.name);
        }
        return eventNames;
    }
}
class SessionDecoration {
    constructor(owner, name, value) {
        this.owner = owner;
        this.name = name;
        this.value = value;
    }
}
class CodeScheme {
    constructor(id, name, isNew) {
        this.id = id;
        this.name = name;
        this.codes = new Map();
        this.isNew = isNew;
    }
    static clone(original) {
        let newScheme = new this(original["id"], original["name"], false);
        newScheme.codes = new Map();
        original.codes.forEach(function (code) {
            newScheme.codes.set(code.id, Code.clone(code));
        });
        return newScheme;
    }
    copyCodesFrom(otherScheme) {
        this.name = otherScheme.name;
        for (let codeId of Array.from(this.codes.keys())) {
            // delete extra ones!
            if (!otherScheme.codes.has(codeId)) {
                this.codes.delete(codeId);
            }
        }
        for (let codeId of Array.from(otherScheme.codes.keys())) {
            let otherCodeObj = otherScheme.codes.get(codeId);
            if (this.codes.has(codeId)) {
                let code = this.codes.get(codeId);
                code.value = otherCodeObj.value;
                code.words = otherCodeObj.words.slice(0); // todo take care to deep clone if necessary
                code.color = otherCodeObj.color;
                code.shortcut = otherCodeObj.shortcut;
            }
            else {
                this.codes.set(codeId, otherCodeObj);
            }
        }
    }
    getShortcuts() {
        let shortcuts = new Map();
        for (let code of Array.from(this.codes.values())) {
            if (code.shortcut.length !== 0) {
                shortcuts.set(code.shortcut, code);
            }
        }
        return shortcuts;
    }
    getCodeValues() {
        let values = new Set();
        this.codes.forEach(function (code) {
            values.add(code.value);
        });
        return values;
    }
    getCodeByValue(value) {
        let match;
        for (let code of Array.from(this.codes.values())) {
            if (code.value === value) {
                match = code;
                break;
            }
        }
        return match;
    }
    jsonForCSV() {
        let obj = Object.create(null);
        obj["fields"] = ["id", "name", "code_id", "code_value", "code_colour", "code_shortcut", "words"];
        obj["data"] = [];
        for (let [codeId, code] of this.codes) {
            let codeArr = [this.id, this.name, codeId, code.value, code.color, code.shortcut, "[" + code.words.toString() + "]"];
            obj["data"].push(codeArr);
        }
        return obj;
    }
}
class Code {
    get owner() {
        return this._owner;
    }
    get id() {
        return this._id;
    }
    get value() {
        return this._value;
    }
    get color() {
        return this._color;
    }
    get shortcut() {
        return this._shortcut;
    }
    get words() {
        return this._words;
    }
    get isEdited() {
        return this._isEdited;
    }
    get eventsWithCode() {
        return this._eventsWithCode;
    }
    constructor(owner, id, value, color, shortcut, isEdited) {
        this._owner = owner;
        this._id = id;
        this._value = value;
        this._color = color;
        this._shortcut = shortcut;
        this._words = [];
        this._isEdited = isEdited;
        this._eventsWithCode = [];
    }
    toJSON() {
        let obj = Object.create(null);
        obj.owner = this.owner.id;
        obj.id = this.id;
        obj.value = this.value;
        obj.color = this.color;
        obj.shortcut = this.shortcut;
        obj.words = this.words;
        return obj;
    }
    set owner(value) {
        this._owner = value;
    }
    set value(value) {
        this._value = value;
        this._isEdited = true;
    }
    set color(value) {
        this._color = value;
        this._isEdited = true;
    }
    set shortcut(value) {
        this._shortcut = value;
        this._isEdited = true;
    }
    set words(words) {
        // todo Do we need to count occurrences of these words too or not?
        words.sort(function (a, b) {
            // DESC -> b.length - a.length
            return b.length - a.length || b.localeCompare(a);
        });
        this._words = words.filter(function (word, index) {
            return words.indexOf(word) === index;
        });
        this._isEdited = true;
    }
    addWords(words) {
        let newWords = this._words.concat(words);
        newWords.sort(function (a, b) {
            // DESC -> b.length - a.length
            return b.length - a.length || b.localeCompare(a);
        });
        this._words = newWords.filter(function (word, index) {
            return newWords.indexOf(word) === index;
        });
        this._isEdited = true;
        return this;
    }
    deleteWords(words) {
        for (let word of words) {
            let index = this._words.indexOf(word);
            if (index != -1) {
                this._words.splice(index, 1);
            }
        }
        return this;
    }
    static clone(original) {
        let newCode = new Code(original["_owner"], original["_id"], original["_value"], original["_color"], original["_shortcut"], false);
        newCode._words = original["_words"].slice(0);
        return newCode;
    }
    static cloneWithCustomId(original, newId) {
        let newCode = new Code(original["_owner"], newId, original["_value"], original["_color"], original["_shortcut"], false);
        newCode._words = original["_words"].slice(0);
        return newCode;
    }
    addEvent(event) {
        // compare reference to event
        if (this._eventsWithCode.indexOf(event) == -1)
            this._eventsWithCode.push(event);
    }
    removeEvent(event) {
        let index = this._eventsWithCode.indexOf(event);
        if (index == -1)
            return;
        this._eventsWithCode.splice(index, 1);
    }
    getEventsWithText(text) {
        return this._eventsWithCode.filter(event => {
            let decoration = event.decorationForName(this._owner.id);
            if (decoration == undefined)
                return false;
            return !decoration.manual && (event.data + "") === text;
        });
    }
}
