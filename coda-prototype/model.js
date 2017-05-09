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
MODEL.TS/JS
Defines datastructures used for:
- the coding,
- the instrumentation,
- undo-redo system and
- autosave.
 */
/*
globals
 */
var storage;
var undoManager;
var newDataset;
var activity = [];
(function initMap() {
    let mapToJSON = function () {
        let keys = this.keys();
        let obj = Object.create(null); // create object that doesn't inherit from Object - want 0 inherited props as used for Map
        for (let k of keys) {
            obj[k] = this.get(k);
        }
        return obj;
    };
    Object.defineProperty(Map.prototype, "toJSON", { value: mapToJSON });
})();
class Dataset {
    constructor() {
        this.sessions = new Map();
        this.schemes = {};
        this.events = new Map();
        this.eventOrder = [];
    }
    static clone(old) {
        let newSchemes = {};
        let sess = {};
        Object.keys(old.schemes).forEach(scheme => {
            newSchemes[scheme] = CodeScheme.clone(old.schemes[scheme]);
        });
        let newEvents = new Map();
        for (let event of old.events.values()) {
            let newEvent = new RawEvent(event.name, event.owner, event.timestamp, event.number, event.data);
            for (let [schemeId, deco] of event.decorations.entries()) {
                let code = deco.code ? newSchemes[schemeId].codes.get(deco.code.id) : null;
                newEvent.decorate(schemeId, deco.manual, code, deco.confidence, deco.timestamp);
            }
            newEvents.set(newEvent.name, newEvent);
            if (!sess.hasOwnProperty(event.owner)) {
                sess[event.owner] = new Session(event.owner, [newEvent]);
            }
            else {
                sess[event.owner].events.set(newEvent.name, newEvent);
            }
        }
        return new Dataset().setFields(sess, newSchemes, newEvents, old.eventOrder);
    }
    setFields(sessions, schemes, events, order) {
        Object.keys(sessions).forEach(sessionKey => {
            let session = sessions[sessionKey];
            this.sessions.set(sessionKey, new Session(session.id, session.events));
        });
        Object.keys(schemes).forEach(schemeKey => {
            let scheme = schemes[schemeKey];
            if (scheme instanceof CodeScheme) {
                this.schemes[schemeKey] = scheme;
            }
            else {
                this.schemes[schemeKey] = new CodeScheme(scheme.id, scheme.name, scheme.isNew, scheme.codes);
            }
        });
        if (order) {
            this.eventOrder = order;
        }
        function fixEventObject(event, data) {
            /*
             Ensure decoration references are correct
             */
            if (event.decorations instanceof Map) {
                for (let [key, deco] of event.decorations.entries()) {
                    let code = deco.code;
                    if (deco.owner == null && event instanceof RawEvent) {
                        deco.owner = event;
                    }
                    if (code) {
                        deco.code = schm[key].codes.get(code.id);
                        if (deco.code instanceof Code && deco.manual) {
                            deco.code.addEvent(event);
                        }
                    }
                }
            }
            else {
                Object.keys(event.decorations).forEach(schemeKey => {
                    let code = event.decorations[schemeKey].code;
                    if (code) {
                        event.decorations[schemeKey].code = schm[schemeKey].codes.get(code.id);
                        if (event.decorations[schemeKey].code instanceof Code && event.decorations[schemeKey].manual) {
                            event.decorations[schemeKey].code.addEvent(event);
                        }
                    }
                });
            }
            /*
             Create/adjust event objects
             */
            if (event instanceof RawEvent) {
                let owner = event.owner;
                let session = data.sessions.get(owner);
                if (session.events.has(event.name)) {
                    session.events.set(event.name, event);
                }
                return event;
            }
            else {
                let newEvent = new RawEvent(event.name, event.owner, event.timestamp, event.number, event.data, event.decorations);
                let owner = event.owner;
                let session = data.sessions.get(owner);
                if (session.events.has(event.name)) {
                    session.events.set(event.name, event);
                }
                return newEvent;
            }
        }
        var schm = this.schemes;
        let newEventsObj = new Map();
        if (!order) {
            if (events instanceof Map) {
                console.log("instance map");
                for (let [key, event] of events.entries()) {
                    let fixedEvent = fixEventObject(event, this);
                    newEventsObj.set(key, fixedEvent);
                    this.eventOrder.push(fixedEvent.name);
                }
            }
            else {
                console.log("instance obj");
                Object.keys(events).forEach(eventKey => {
                    let fixedEvent = fixEventObject(events[eventKey], this);
                    newEventsObj.set(eventKey, fixedEvent);
                    this.eventOrder.push(fixedEvent.name);
                });
            }
        }
        else {
            order.forEach(eventKey => {
                if (events instanceof Map) {
                    newEventsObj.set(eventKey, fixEventObject(events.get(eventKey), this));
                }
                else {
                    newEventsObj.set(eventKey, fixEventObject(events[eventKey], this));
                }
            });
        }
        this.events = newEventsObj;
        return this;
    }
    /*
    NB: event names/ids are the initial indices when read from file for the first time!
    Once initialized, they aren't changed regardless of sorting and can be used to restore the default on-load ordering.
    */
    restoreDefaultSort() {
        this.eventOrder.sort((e1, e2) => {
            let name1 = parseInt(this.events.get(e1).name, 10);
            let name2 = parseInt(this.events.get(e2).name, 10);
            return name1 - name2;
        });
        return this.eventOrder;
    }
    sortEventsByScheme(schemeId, isToDoList) {
        schemeId = schemeId + ""; // force it to string todo: here or make sure decorationForName processes it ok?
        if ((this.schemes.hasOwnProperty && this.schemes.hasOwnProperty(schemeId)) || this.schemes[schemeId] != undefined) {
            let codes = Array.from(this.schemes[schemeId].codes.values()).map((code) => { return code.value; });
            this.eventOrder.sort((eventKey1, eventKey2) => {
                var e1 = this.events.get(eventKey1);
                var e2 = this.events.get(eventKey2);
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
        return this.eventOrder;
    }
    sortEventsByConfidenceOnly(schemeId) {
        schemeId = schemeId + ""; // force it to string todo: here or make sure decorationForName processes it ok?
        if ((this.schemes.hasOwnProperty && this.schemes.hasOwnProperty(schemeId)) || this.schemes[schemeId] != undefined) {
            this.eventOrder.sort((eventKey1, eventKey2) => {
                let returnResult = 0;
                var e1 = this.events.get(eventKey1);
                var e2 = this.events.get(eventKey2);
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
        return this.eventOrder;
    }
    deleteScheme(schemeId) {
        for (let event of this.events.values()) {
            event.uglify(schemeId); // todo optimise, because there is no need to call 'remove event' from code if scheme is being deleted anyway
        }
        delete this.schemes[schemeId];
        return this.eventOrder;
    }
    toJSON() {
        let obj = Object.create(null);
        obj.events = this.events;
        obj.sessions = this.sessions;
        obj.schemes = this.schemes;
        return obj;
    }
}
class RawEvent {
    constructor(name, owner, timestamp, number, data, decorations) {
        this.name = name;
        this.owner = owner;
        this.timestamp = timestamp;
        this.number = number;
        this.data = data;
        if (!decorations) {
            this.decorations = new Map(); // string is code scheme id
            this.codes = new Map(); // string is code scheme id todo not necessary?
        }
        else {
            if (typeof decorations == 'object') {
                let decors = new Map();
                let codes = new Map();
                Object.keys(decorations).forEach(deco => {
                    let d = decorations[deco];
                    let owner = this;
                    decors.set(deco, new EventDecoration(this, d.scheme_id, d.manual, d.code, d.confidence, d.timestamp));
                    codes.set(d.scheme_id, d.code);
                });
                this.decorations = decors;
                this.codes = codes;
            }
        }
    }
    static clone(oldEvent) {
        let newDecorations = new Map();
        for (let [key, deco] of newDecorations.entries()) {
            //newDecorations.set(key, EventDecoration.clone(deco, newEvent, ));
        }
        let newEvent = new RawEvent(oldEvent.name, oldEvent.owner, oldEvent.timestamp, oldEvent.number, oldEvent.data, newDecorations);
    }
    // todo refactor to not use codes just decorations
    codeForScheme(schemeId) {
        //return this.codes.get(schemeId);
        return this.decorations.get(schemeId).code;
    }
    schemeNames() {
        return Array.from(this.codes.keys()); // todo
    }
    assignedCodes() {
        return Array.from(this.codes.values()); // todo
    }
    decorate(schemeId, manual, code, confidence, timestamp) {
        // if (this.decorations.has(schemeId)) this.uglify(schemeId);
        let stringSchemeId = "" + schemeId;
        this.decorations.set(stringSchemeId, new EventDecoration(this, stringSchemeId, manual, code, confidence, timestamp));
    }
    uglify(schemeId) {
        let deco = this.decorations.get(schemeId);
        if (deco && deco.code) {
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
    toJSON() {
        let obj = Object.create(null);
        obj.owner = this.owner;
        obj.name = this.name;
        obj.timestamp = this.timestamp;
        obj.number = this.number;
        obj.data = this.data;
        obj.decorations = Object.create(null);
        this.decorations.forEach((value, key) => {
            obj.decorations[key] = value;
        });
        return obj;
    }
}
class EventDecoration {
    constructor(owner, id, manual, code, confidence, timestamp) {
        this.owner = owner;
        this.scheme_id = id;
        this.manual = manual;
        (confidence == undefined) ? this.confidence = 0 : this.confidence = confidence; // not sure this is a good idea
        if (code) {
            if (code instanceof Code) {
                if (manual)
                    code.addEvent(owner);
                this._timestamp = (timestamp) ? timestamp : new Date().toString();
                this._code = code;
            }
            else {
                // occurs when reading from storage... type is lost
                /*this._code = new Code(code.owner, code.id, code.value, code.color, code.shortcut, false);
                this._timestamp = timestamp ? timestamp : null;*/
            }
        }
        else {
            this._code = null; // TODO: this will require null pointer checks
            this._timestamp = null;
        }
    }
    static clone(oldDeco, newOwner, newCode) {
        return new EventDecoration(newOwner, oldDeco.scheme_id, oldDeco.manual, newCode, oldDeco.confidence, oldDeco.timestamp);
    }
    toJSON() {
        let obj = Object.create(null);
        obj.owner = this.owner.name;
        obj.scheme_id = this.scheme_id;
        obj.code = (this.code != null) ? { "id": this.code.id, "value": this.code.value, "owner": this.code.owner.id } : {};
        obj.confidence = this.confidence;
        obj.manual = this.manual;
        return obj;
    }
    changeCodeObj(code) {
        this._code = code;
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
        this.events = new Map();
        events.forEach(eventObj => {
            if (typeof eventObj === "string") {
                this.events.set(eventObj, null);
            }
            else if (eventObj instanceof RawEvent) {
                this.events.set(eventObj.name, eventObj);
            }
        });
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
        for (let e of this.events.values()) {
            for (let key in e.decorations) {
                names.add(key);
            }
        }
        return names;
    }
    toJSON() {
        let obj = Object.create(null);
        obj.id = this.id;
        obj.events = Array.from(this.events.values()).map(event => event.name);
        obj.decorations = this.decorations;
        return obj;
    }
    getAllEventNames() {
        let eventNames = new Set();
        for (let e of this.events.values()) {
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
    toJSON() {
        let obj = Object.create(null);
        obj.owner = this.owner.id;
        obj.name = this.name;
        obj.value = this.value;
        return obj;
    }
}
class CodeScheme {
    constructor(id, name, isNew, codes) {
        this.id = id;
        this.name = name;
        if (!codes) {
            this.codes = new Map();
        }
        else {
            if (!(codes instanceof Map)) {
                let c = new Map();
                Object.keys(codes).forEach(codeId => {
                    let code = codes[codeId];
                    if (typeof code.owner == "string" || typeof code.owner == "number") {
                        code.owner = this;
                    }
                    c.set(codeId, new Code(code.owner, code.id, code.value, code.color, code.shortcut, false));
                    c.get(codeId).addWords(code.words);
                });
                this.codes = c;
            }
        }
        this.isNew = isNew;
    }
    toJSON() {
        let obj = Object.create(null);
        obj.id = this.id;
        obj.name = this.name;
        obj.isNew = this.isNew;
        obj.codes = Object.create(null);
        this.codes.forEach((value, key) => {
            obj.codes[key] = value;
        });
        return obj;
    }
    static clone(original) {
        let newScheme = new this(original["id"], original["name"], false);
        newScheme.codes = new Map();
        original.codes.forEach(function (code) {
            newScheme.codes.set(code.id, Code.clone(code));
        });
        return newScheme;
    }
    duplicate(schemes) {
        var digit = 0;
        let originalId = this.id + "";
        let newId = originalId + digit;
        while (schemes.indexOf(newId) !== -1) {
            digit++;
            newId = originalId + digit;
        }
        let duplicateScheme = new CodeScheme(newId, this.name, this.isNew);
        this.codes.forEach(code => {
            let newCodeId = duplicateScheme.id + "-" + code.id;
            let newCode = new Code(duplicateScheme, newCodeId, code.value, code.color, code.shortcut, code.isEdited);
            duplicateScheme.codes.set(newCode.id, newCode);
        });
        return duplicateScheme;
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
        this._eventsWithCode = new Map();
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
        if (event && !this._eventsWithCode.has(event.name))
            this._eventsWithCode.set(event.name, event);
    }
    removeEvent(event) {
        this._eventsWithCode.delete(event.name);
    }
}
// Services
class Watchdog {
    constructor() {
        console.log("Watchdog ctor");
        var f = this.tick;
        setInterval(function () { f(); }, 500);
    }
    tick() {
        console.log("Watchdog tick");
    }
}
class StorageManager {
    constructor() {
        /*
        var manager = this;
        chrome.storage.local.get("lastEdit", (editObj) => {
            console.log(editObj);
            editObj["lastEdit"] = new Date(JSON.parse(editObj["lastEdit"]));
            console.log(editObj["lastEdit"]);
            if ( Object.prototype.toString.call(editObj["lastEdit"]) === "[object Date]" ) {
                if (!isNaN((editObj["lastEdit"]).getTime())) {
                    // date is in valid format
                    if (this.isExpired()) {
                        manager.lastEdit = new Date();
                        this.clearStorage().then( () => console.log(manager.lastEdit));

                    } else {
                        manager.lastEdit = editObj["lastEdit"];
                        console.log(editObj["lastEdit"]);
                        console.log(manager.lastEdit);
                    }

                }
            }
        });*/
    }
    static get instance() {
        return this._instance || (this._instance = new StorageManager());
    }
    isExpired() {
        // TODO
        // on every startup of CODA, check if storage is expired, i.e. more than 30 days have passed since last edit
        // if yes, clear storage
        var _MS_PER_DAY = 1000 * 60 * 60 * 24;
        // a and b are javascript Date objects
        function dateDiffInDays(a, b) {
            // Discard the time and time-zone information.
            let utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
            let utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
            return Math.floor((utc2 - utc1) / _MS_PER_DAY);
        }
        return (30 <= dateDiffInDays(this.lastEdit, new Date()));
    }
    getDataset() {
        return new Promise(function (resolve, reject) {
            chrome.storage.local.get("dataset", (data) => {
                if (chrome.runtime.lastError) {
                    reject(new Error("Error reading from storage!"));
                }
                let dataset = data.hasOwnProperty("dataset") ? data["dataset"] : {};
                if (typeof dataset == "string") {
                    dataset = JSON.parse(dataset);
                }
                if (data == null || dataset == null || typeof data == 'undefined' ||
                    typeof dataset == 'undefined' || Object.keys(dataset).length == 0) {
                    reject();
                }
                if (!dataset.hasOwnProperty("schemes") || !dataset.hasOwnProperty("sessions") ||
                    !dataset.hasOwnProperty("events") || Object.keys(dataset["events"]).length == 0) {
                    reject(new Error("Error reading from storage: dataset format is corrupt."));
                }
                resolve(dataset);
            });
        });
    }
    getActivity() {
        return new Promise(function (resolve, reject) {
            chrome.storage.local.get("instrumentation", data => {
                if (chrome.runtime.lastError) {
                    reject(new Error("Error reading from storage!"));
                }
                console.log(data);
                resolve(data["instrumentation"]);
            });
        });
    }
    clearActivityLog() {
        return new Promise(function (resolve, reject) {
            chrome.storage.local.remove("instrumentation", () => {
                if (chrome.runtime.lastError) {
                    console.log(chrome.runtime.lastError);
                    reject();
                }
                else {
                    console.log("Cleared activity log!");
                    resolve(true);
                }
            });
        });
    }
    saveDataset(dataset) {
        this.lastEdit = new Date();
        chrome.storage.local.set({ "dataset": JSON.stringify(dataset), "lastEdit": JSON.stringify(this.lastEdit) }, () => {
            console.log("Stored dataset edit timestamp: " + this.lastEdit);
            chrome.storage.local.get((store) => {
                let data = JSON.parse(store["dataset"]);
                let datasetString = "dataset (schemes: "
                    + Object.keys(data["schemes"]).length +
                    ", events: " + Object.keys(data["events"]).length +
                    ", sessions: " + Object.keys(data["sessions"]).length + ")";
                console.log("In storage: Last edit (" + new Date(JSON.parse(store["lastEdit"])) + "), " + datasetString);
                chrome.storage.local.getBytesInUse((bytesUnUse) => {
                    console.log("Bytes in use: " + bytesUnUse);
                    console.log("QUOTA_BYTES: " + chrome.storage.local.QUOTA_BYTES);
                });
            });
        });
    }
    saveActivity(logEvent) {
        // save user activity in storage for instrumentation
        if (logEvent.category.length != 0 && (logEvent.message.length > 0 || logEvent.data.length > 0) && logEvent.timestamp instanceof Date) {
            activity.push(logEvent);
            console.log("INSTRUMENTATION: " + logEvent.category + ":" + logEvent.message + ", stack size: " + activity.length);
            if (activity.length % StorageManager._MAX_ACTIVITY_SAVE_FREQ == 0) {
                chrome.storage.local.get("instrumentation", data => {
                    if (chrome.runtime.lastError) {
                        console.log(chrome.runtime.lastError);
                    }
                    else {
                        let instr;
                        if (data["instrumentation"]) {
                            instr = JSON.parse(data["instrumentation"]).concat(activity);
                        }
                        else {
                            instr = activity;
                        }
                        chrome.storage.local.set({ "instrumentation": JSON.stringify(instr) }, () => {
                            if (chrome.runtime.lastError) {
                                console.log(chrome.runtime.lastError);
                            }
                            else {
                                activity = [];
                                console.log("Saved activity log!");
                                chrome.storage.local.get((store) => {
                                    console.log("In storage: instrumentation stack size " + JSON.parse(store["instrumentation"]).length);
                                    chrome.storage.local.getBytesInUse((bytesUnUse) => {
                                        console.log("Bytes in use: " + bytesUnUse);
                                        console.log("QUOTA_BYTES: " + chrome.storage.local.QUOTA_BYTES);
                                    });
                                });
                            }
                        });
                    }
                });
            }
        }
    }
    clearStorage() {
        return new Promise(function (resolve, reject) {
            chrome.storage.local.remove(["dataset", "schemes"], () => {
                let error = chrome.runtime.lastError;
                if (error) {
                    console.error(error);
                    reject(new Error(error.message));
                }
                else {
                    resolve(true);
                }
            });
        });
    }
}
StorageManager._MAX_ACTIVITY_SAVE_FREQ = 3;
class UndoManager {
    constructor() {
        this.pointer = 0;
        this.modelUndoStack = []; // IS INITIALIZED TO INITIAL DATASET VERSION!
        this.schemaUndoStack = [];
    }
    markUndoPoint(codeSchemeOrder) {
        if (codeSchemeOrder.length === 0) {
            console.log("Code scheme order is empty!!");
        }
        while (this.modelUndoStack.length - 1 > 0 && this.pointer < (this.modelUndoStack.length - 1)) {
            // We we're at the top of the stack
            this.modelUndoStack.pop();
            this.schemaUndoStack.pop();
        }
        this.modelUndoStack.push([Dataset.clone(newDataset), codeSchemeOrder.slice(0)]);
        this.schemaUndoStack.push(schema);
        this.pointer++;
        if (this.modelUndoStack.length > UndoManager.MAX_UNDO_LEVELS) {
            // AUTOSAVE...
            storage.saveDataset(newDataset);
            this.modelUndoStack.splice(0, 1);
            this.schemaUndoStack.splice(0, 1);
            this.pointer--; // because the undo stack is shorter by one!
        }
        else if (this.modelUndoStack.length % 2 === 0) {
            // save every second change to storage todo: do we need this kind of throttling
            storage.saveDataset(newDataset);
        }
    }
    canUndo() { return this.pointer != 0; }
    canRedo() { return this.pointer != this.modelUndoStack.length - 1 && this.modelUndoStack.length != 0; }
    undo(messageViewerManager) {
        if (!this.canUndo())
            return false;
        this.pointer--;
        newDataset = Dataset.clone(this.modelUndoStack[this.pointer][0]);
        if (this.modelUndoStack[this.pointer][1] && this.modelUndoStack[this.pointer][1].length !== 0) {
            messageViewerManager.codeSchemeOrder = this.modelUndoStack[this.pointer][1].slice(0);
        }
        schema = this.schemaUndoStack[this.pointer];
        return true;
    }
    redo(messageViewerManager) {
        if (!this.canRedo())
            return false;
        this.pointer++;
        newDataset = Dataset.clone(this.modelUndoStack[this.pointer][0]);
        if (this.modelUndoStack[this.pointer][1] && this.modelUndoStack[this.pointer][1].length !== 0) {
            messageViewerManager.codeSchemeOrder = this.modelUndoStack[this.pointer][1].slice(0);
        }
        schema = this.schemaUndoStack[this.pointer];
        return true;
    }
}
UndoManager.MAX_UNDO_LEVELS = 8;
