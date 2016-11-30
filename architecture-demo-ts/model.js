let ENDING_PATTERN = "_";
class Dataset {
    constructor() {
        this.sessions = [];
    }
    getAllEventDecorationNames() {
        var decorations = new Set();
        this.sessions.forEach((session, sessionKey, map) => {
            session.events.forEach((event, index, eventArr) => {
                //decorations.add(...event.decorationNames());
            });
        });
        decorations.delete(undefined); // to handle empty decorations
        return decorations;
    }
    getAllSessionIds() {
        return this.sessions.map(function (session) { return session.id; });
    }
}
class RawEvent {
    constructor(name, timestamp, number, data) {
        this.name = name;
        this.timestamp = timestamp;
        this.number = number;
        this.data = data;
        this.decorations = new Map();
        this.codes = new Map(); // string is code scheme id
    }
    codeForScheme(schemeId) {
        return this.codes.get(schemeId);
    }
    schemeNames() {
        return Array.from(this.codes.keys());
    }
    assignedCodes() {
        return Array.from(this.codes.values());
    }
    decorate(decorationName, code) {
        this.decorations.set(decorationName, new EventDecoration(this, decorationName, code));
    }
    uglify(decorationName) {
        this.decorations.delete(decorationName);
        this.codes.delete(decorationName);
    }
    decorationForName(name) {
        return this.decorations.get(name);
    }
    decorationNames() {
        return Array.from(this.decorations.keys());
    }
}
class EventDecoration {
    constructor(owner, name, code) {
        this.owner = owner;
        this.name = name;
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
        var names = new Set();
        for (let e of this.events) {
            for (var key in e.decorations) {
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
        var newScheme = new this(original["id"], original["name"], false);
        newScheme.codes = new Map();
        original.codes.forEach(function (code) {
            newScheme.codes.set(code.id, Code.clone(code));
        });
        return newScheme;
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
        var match;
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
    set words(value) {
        this._words = value;
        this._isEdited = true;
    }
    static clone(original) {
        var newCode = new Code(original["_owner"], original["_id"], original["_value"], original["_color"], original["_shortcut"], false);
        newCode._words = original["_words"].slice(0);
        return newCode;
    }
}
