var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var ENDING_PATTERN = "_";
var Dataset = (function () {
    function Dataset() {
        this.sessions = new Map();
    }
    Dataset.prototype.getAllEventDecorationNames = function () {
        var decorations = new Set();
        this.sessions.forEach(function (session, sessionKey, map) {
            session.events.forEach(function (event, index, eventArr) {
                //decorations.add(...event.decorationNames());
            });
        });
        decorations.delete(undefined); // to handle empty decorations
        return decorations;
    };
    return Dataset;
}());
var RawEvent = (function () {
    function RawEvent(name, timestamp, number, data) {
        this.name = name;
        this.timestamp = timestamp;
        this.number = number;
        this.data = data;
        this.decorations = new Map();
        this.codes = new Map(); // string is code scheme id
    }
    RawEvent.prototype.codeForScheme = function (schemeId) {
        return this.codes.get(schemeId);
    };
    RawEvent.prototype.schemeNames = function () {
        return Array.from(this.codes.keys());
    };
    RawEvent.prototype.assignedCodes = function () {
        return Array.from(this.codes.values());
    };
    RawEvent.prototype.decorate = function (decorationName, decorationValue, decorationColor) {
        if (decorationColor) {
            this.decorations.set(decorationName, new ColoredEventDecoration(this, decorationName, decorationValue, decorationColor));
        }
        else {
            this.decorations.set(decorationName, new RawEventDecoration(this, decorationName, decorationValue));
        }
    };
    RawEvent.prototype.decorationForName = function (name) {
        return this.decorations.get(name);
    };
    RawEvent.prototype.decorationNames = function () {
        return Array.from(this.decorations.keys());
    };
    return RawEvent;
}());
var RawEventDecoration = (function () {
    function RawEventDecoration(owner, name, value) {
        this.owner = owner;
        this.name = name;
        this.value = value;
    }
    return RawEventDecoration;
}());
var ColoredEventDecoration = (function (_super) {
    __extends(ColoredEventDecoration, _super);
    function ColoredEventDecoration(owner, name, value, color) {
        _super.call(this, owner, name, value);
        this.color = color;
    }
    return ColoredEventDecoration;
}(RawEventDecoration));
var Session = (function () {
    function Session(id, events) {
        this.id = id;
        this.events = events;
        this.decorations = new Map();
    }
    Session.prototype.decorate = function (decorationName, decorationValue) {
        this.decorations.set(decorationName, new SessionDecoration(this, decorationName, decorationValue));
    };
    Session.prototype.decorationForName = function (decorationName) {
        return this.decorations.get(decorationName);
    };
    Session.prototype.getAllDecorationNames = function () {
        var names = new Set();
        for (var _i = 0, _a = this.events; _i < _a.length; _i++) {
            var e = _a[_i];
            for (var key in e.decorations) {
                names.add(key);
            }
        }
        return names;
    };
    Session.prototype.getAllEventNames = function () {
        var eventNames = new Set();
        for (var _i = 0, _a = this.events; _i < _a.length; _i++) {
            var e = _a[_i];
            eventNames.add(e.name);
        }
        return eventNames;
    };
    return Session;
}());
var SessionDecoration = (function () {
    function SessionDecoration(owner, name, value) {
        this.owner = owner;
        this.name = name;
        this.value = value;
    }
    return SessionDecoration;
}());
var CodeScheme = (function () {
    function CodeScheme(id, name, isNew) {
        this.id = id;
        this.name = name;
        this.codes = new Map();
        this.isNew = isNew;
    }
    CodeScheme.clone = function (original) {
        var newScheme = new this(original["id"], original["name"], false);
        newScheme.codes = new Map();
        original.codes.forEach(function (code) {
            newScheme.codes.set(code.id, Code.clone(code));
        });
        return newScheme;
    };
    CodeScheme.prototype.getShortcuts = function () {
        var shortcuts = new Map();
        for (var _i = 0, _a = Array.from(this.codes.values()); _i < _a.length; _i++) {
            var code = _a[_i];
            if (code.shortcut.length !== 0) {
                shortcuts.set(code.shortcut, code);
            }
        }
        return shortcuts;
    };
    CodeScheme.prototype.getCodeValues = function () {
        var values = new Set();
        this.codes.forEach(function (code) {
            values.add(code.value);
        });
        return values;
    };
    CodeScheme.prototype.getCodeByValue = function (value) {
        var match;
        // TS doesn't support iterating IterableIterator with ES5 target
        for (var _i = 0, _a = Array.from(this.codes.values()); _i < _a.length; _i++) {
            var code = _a[_i];
            if (code.value === value) {
                match = code;
                break;
            }
        }
        return match;
    };
    return CodeScheme;
}());
var Code = (function () {
    function Code(owner, id, value, color, shortcut, isEdited) {
        this._owner = owner;
        this._id = id;
        this._value = value;
        this._color = color;
        this._shortcut = shortcut;
        this._words = [];
        this._isEdited = isEdited;
    }
    Object.defineProperty(Code.prototype, "owner", {
        get: function () {
            return this._owner;
        },
        set: function (value) {
            this._owner = value;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Code.prototype, "id", {
        get: function () {
            return this._id;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Code.prototype, "value", {
        get: function () {
            return this._value;
        },
        set: function (value) {
            this._value = value;
            this._isEdited = true;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Code.prototype, "color", {
        get: function () {
            return this._color;
        },
        set: function (value) {
            this._color = value;
            this._isEdited = true;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Code.prototype, "shortcut", {
        get: function () {
            return this._shortcut;
        },
        set: function (value) {
            this._shortcut = value;
            this._isEdited = true;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Code.prototype, "words", {
        get: function () {
            return this._words;
        },
        set: function (value) {
            this._words = value;
            this._isEdited = true;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Code.prototype, "isEdited", {
        get: function () {
            return this._isEdited;
        },
        enumerable: true,
        configurable: true
    });
    Code.clone = function (original) {
        var newCode = new Code(original["_owner"], original["_id"], original["_value"], original["_color"], original["_shortcut"], false);
        newCode._words = original["_words"].slice(0);
        return newCode;
    };
    return Code;
}());
