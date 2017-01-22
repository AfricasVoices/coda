let ENDING_PATTERN = "_";
class Dataset {
    constructor() {
        this.sessions = [];
        this.events = [];
    }
    /*
     getAllEventDecorationNames() {
     var decorations = new Set();
     this.sessions.forEach((session: Session, sessionKey: number, map:Array<Session>) => {
     session.events.forEach((event:RawEvent, index: number, eventArr: Array<RawEvent>) => {
     //decorations.add(...event.decorationNames());
     });
     });

     decorations.delete(undefined); // to handle empty decorations
     return decorations;
     }
     */
    getAllSessionIds() {
        return this.sessions.map(function (session) {
            return session.id;
        });
    }
    // todo WHAT IS THE DEFAULT SORTING, remember it? :)
    sortEventsByScheme(schemeId, isToDoList) {
        schemeId = schemeId + ""; // force it to string todo: here or make sure decorationForName processes it ok?
        if (this.schemes.hasOwnProperty(schemeId)) {
            let codes = Array.from(this.schemes[schemeId].codes.values()).map((code) => { return code.value; });
            this.events.sort((e1, e2) => {
                let code1 = e1.decorationForName(schemeId) ? codes.indexOf(e1.decorationForName(schemeId).code.value) : -1; //todo what if null - doesnt have a code assigned?
                let code2 = e2.decorationForName(schemeId) ? codes.indexOf(e2.decorationForName(schemeId).code.value) : -1;
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
                        return 0;
                    }
                    // same codes, now sort by confidence
                    // todo sort for confidence
                    return 0;
                }
                // both have assigned codes that are different
                return code1 - code2; // todo sort ascending by index of code, which is arbitrary - do we enforce an order?
            });
        }
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
    decorate(schemeId, manual, code, confidence) {
        let stringSchemeId = "" + schemeId;
        this.decorations.set(stringSchemeId, new EventDecoration(this, stringSchemeId, manual, code, confidence));
    }
    uglify(schemeId) {
        this.decorations.delete(schemeId);
        this.codes.delete(schemeId);
    }
    decorationForName(schemeId) {
        return this.decorations.get(schemeId);
    }
    decorationNames() {
        return Array.from(this.decorations.keys());
    }
}
class EventDecoration {
    constructor(owner, id, manual, code, confidence) {
        this.owner = owner;
        this.scheme_id = id;
        this.manual = manual;
        (confidence == undefined) ? this.confidence = 0.98 : this.confidence = confidence;
        if (code) {
            this.code = code;
        }
        else {
            this.code = null; // TODO: this will require null pointer checks
        }
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
        // TS doesn't support iterating IterableIterator with ES5 target
        for (let code of Array.from(this.codes.values())) {
            if (code.value === value) {
                match = code;
                break;
            }
        }
        return match;
    }
}
class Code {
    constructor(owner, id, value, color, shortcut, isEdited) {
        this._owner = owner;
        this._id = id;
        this._value = value;
        this._color = color;
        this._shortcut = shortcut;
        this._words = [];
        this._isEdited = isEdited;
    }
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
        let newWords = this._words.concat(words);
        newWords.sort();
        this._words = newWords.filter(function (word, index) {
            return newWords.indexOf(word) === index;
        });
        this._isEdited = true;
    }
    deleteWords(words) {
        for (let word of words) {
            let index = this._words.indexOf(word);
            if (index != -1) {
                this._words.splice(index, 1);
            }
        }
    }
    static clone(original) {
        let newCode = new Code(original["_owner"], original["_id"], original["_value"], original["_color"], original["_shortcut"], false);
        newCode._words = original["_words"].slice(0);
        return newCode;
    }
}
