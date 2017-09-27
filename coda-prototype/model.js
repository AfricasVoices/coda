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
var VALID_NAME_FORMAT = /(^[a-zA-Z0-9]+([" "]?[a-zA-Z0-9])*)([/\-_][a-zA-Z0-9]+([" "]?[a-zA-Z0-9])*)*$/;
(function initMap() {
    var mapToJSON = function () {
        var keys = this.keys();
        var obj = Object.create(null); // create object that doesn't inherit from Object - want 0 inherited props as used for Map
        for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
            var k = keys_1[_i];
            obj[k] = this.get(k);
        }
        return obj;
    };
    Object.defineProperty(Map.prototype, "toJSON", { value: mapToJSON });
})();
var Dataset = (function () {
    function Dataset() {
        // TODO: understand and document what each of these things does.
        this.sessions = new Map();
        this.schemes = {};
        this.events = new Map();
        this.eventOrder = [];
    }
    Dataset.validate = function (dataset) {
        var sessions = dataset.sessions;
        var sessionsObjValid = sessions && sessions instanceof Map;
        var sessionsHaveValidEntries = true;
        for (var _i = 0, _a = sessions.values(); _i < _a.length; _i++) {
            var session = _a[_i];
            if (!(session instanceof Session)) {
                sessionsHaveValidEntries = false;
            }
        }
        sessionsObjValid = sessionsObjValid && sessionsHaveValidEntries;
        var hasSchemes = dataset.schemes && Object.keys(dataset.schemes).length > 0 && dataset.schemes.constructor === Object;
        var events = dataset.events;
        var eventsObjValid = events && events instanceof Map;
        var eventsHaveValidEntries = true;
        for (var _b = 0, _c = events.values(); _b < _c.length; _b++) {
            var event_1 = _c[_b];
            if (!(event_1 instanceof RawEvent)) {
                eventsHaveValidEntries = false;
                console.log(event_1);
                console.log("Invalid event: not an instance of RawEvent");
            }
            else if (!sessions.has(event_1.owner)) {
                eventsHaveValidEntries = false;
                console.log("Invalid event: doesn't point to a valid Session");
            }
            else if (hasSchemes) {
                for (var _d = 0, _e = event_1.decorations.values(); _d < _e.length; _d++) {
                    var deco = _e[_d];
                    // allow for undefined codes
                    if (deco.code && deco.code.owner != dataset.schemes[deco.code.owner.id]) {
                        eventsHaveValidEntries = false;
                        console.log("Invalid event: decoration doesn't point to a valid CodeScheme");
                    }
                    else if (deco.code && deco.code != dataset.schemes[deco.code.owner.id].codes.get(deco.code.id)) {
                        eventsHaveValidEntries = false;
                        console.log("Invalid event: decoration doesn't point to a valid Code");
                    }
                }
            }
        }
        eventsObjValid = eventsObjValid && eventsHaveValidEntries;
        var hasEventOrder = dataset.eventOrder && dataset.eventOrder.length > 0;
        return sessionsObjValid && eventsObjValid && hasEventOrder && hasSchemes;
    };
    Dataset.clone = function (old) {
        var newSchemes = {};
        // clone schemes
        Object.keys(old.schemes).forEach(function (scheme) {
            newSchemes[scheme] = CodeScheme.clone(old.schemes[scheme]);
        });
        var newSessions = new Map();
        // clone events and redecorate them with newly created codes (from cloning the schemes above)
        var newEvents = new Map();
        for (var _i = 0, _a = old.events.values(); _i < _a.length; _i++) {
            var event_2 = _a[_i];
            var newEvent = new RawEvent(event_2.name, event_2.owner, event_2.timestamp, event_2.number, event_2.data);
            for (var _b = 0, _c = event_2.decorations.entries(); _b < _c.length; _b++) {
                var _d = _c[_b], schemeId = _d[0], deco = _d[1];
                var code = deco.code ? newSchemes[schemeId].codes.get(deco.code.id) : null;
                newEvent.decorate(schemeId, deco.manual, deco.author, code, deco.confidence, deco.timestamp);
            }
            newEvents.set(newEvent.name, newEvent);
            // clone sessions!
            if (!newSessions.has(event_2.owner)) {
                newSessions.set(event_2.owner, new Session(event_2.owner, [newEvent]));
            }
            else {
                // session obj already exists, so just add new event to it
                var session = newSessions.get(event_2.owner);
                session.events.set(newEvent.name, newEvent);
            }
        }
        var newEventOrder = old.eventOrder.slice();
        var clonedDataset = new Dataset();
        clonedDataset.events = newEvents;
        clonedDataset.sessions = newSessions;
        clonedDataset.schemes = newSchemes;
        clonedDataset.eventOrder = newEventOrder;
        return clonedDataset;
    };
    Dataset.areClones = function (d1, d2) {
        function checkEvents(e1, e2) {
            if (e1 == e2) {
                return true;
            }
            for (var _i = 0, e1_1 = e1; _i < e1_1.length; _i++) {
                var _a = e1_1[_i], eventKey = _a[0], eventObj = _a[1];
                if (eventObj == e2.get(eventKey)) {
                    return true;
                }
                for (var _b = 0, _c = eventObj.decorations; _b < _c.length; _b++) {
                    var _d = _c[_b], decoKey = _d[0], decoObj = _d[1];
                    if (decoObj == e2.get(eventKey).decorations.get(decoKey)) {
                        return true;
                    }
                    if (decoObj.code == e2.get(eventKey).decorations.get(decoKey).code) {
                        return true;
                    }
                }
            }
            return false;
        }
        function checkSessions(s1, s2) {
            if (s1 == s2) {
                return true;
            }
            for (var _i = 0, s1_1 = s1; _i < s1_1.length; _i++) {
                var _a = s1_1[_i], sessionKey = _a[0], sessionObj = _a[1];
                if (sessionObj == s2.get(sessionKey)) {
                    return true;
                }
                for (var _b = 0, _c = sessionObj.decorations; _b < _c.length; _b++) {
                    var _d = _c[_b], decoKey = _d[0], decoObj = _d[1];
                    if (decoObj == s2.get(sessionKey).decorations.get(decoKey)) {
                        return true;
                    }
                }
                for (var _e = 0, _f = sessionObj.events; _e < _f.length; _e++) {
                    var _g = _f[_e], eventKey = _g[0], eventObj = _g[1];
                    if (eventObj == s2.get(sessionKey).events.get(eventKey)) {
                        return true;
                    }
                }
            }
            return false;
        }
        function checkEventOrder(o1, o2) {
            return o1 == o2;
        }
        function checkSchemes(s1, s2) {
            // check scheme reference
            if (s1 == s2) {
                return true;
            }
            // check codes
            for (var _i = 0, _a = s1.codes; _i < _a.length; _i++) {
                var _b = _a[_i], codeKey = _b[0], codeObj = _b[1];
                if (codeObj == s2.codes.get(codeKey)) {
                    return true;
                }
            }
            return false;
        }
        return checkEvents(d1.events, d2.events) && checkSessions(d1.sessions, d2.sessions) && checkEventOrder(d1.eventOrder, d2.eventOrder) && checkSchemes(d1.schemes, d2.schemes);
    };
    Dataset.restoreFromTypelessDataset = function (dataset) {
        function fixEventObjectProperties(eventToFix, schms, eventOwner) {
            // Ensure event decoration references are restored
            if (eventToFix.decorations instanceof Map) {
                console.log("Warning: event decorations are a Map.");
                for (var _i = 0, _a = eventToFix.decorations.entries(); _i < _a.length; _i++) {
                    var _b = _a[_i], key = _b[0], deco = _b[1];
                    var code = deco.code;
                    if (deco.owner == null && eventToFix instanceof RawEvent) {
                        deco.owner = eventToFix;
                    }
                    if (code) {
                        deco.code = schms[key].codes.get(code.id);
                        if (deco.code instanceof Code && deco.manual) {
                            deco.code.addEvent(eventToFix);
                        }
                    }
                }
            }
            else {
                Object.keys(eventToFix.decorations).forEach(function (schemeKey) {
                    var code = eventToFix.decorations[schemeKey].code;
                    if (code) {
                        eventToFix.decorations[schemeKey].code = schms[schemeKey].codes.get(code.id); // Code object has been initialised within scheme
                        if (!(eventToFix.decorations[schemeKey].code instanceof Code)) {
                            if (!(typeof (eventToFix.decorations[schemeKey].code) === "undefined")) {
                                // undefined Codes in a decoration are a valid case as decorations can be initialised with no codes
                                console.log("Warning: Code object hasn't been initialised properly");
                                console.log(eventToFix.decorations[schemeKey]);
                                console.log("---------------");
                            }
                        }
                        if (eventToFix.decorations[schemeKey].code instanceof Code && eventToFix.decorations[schemeKey].manual) {
                            eventToFix.decorations[schemeKey].code.addEvent(eventToFix);
                        }
                    }
                });
            }
            // Create/adjust event objects with Session objs
            if (eventToFix instanceof RawEvent) {
                var owner = eventToFix.owner;
                var session = eventOwner;
                if (session.events.has(eventToFix.name)) {
                    session.events.set(eventToFix.name, eventToFix);
                }
                return eventToFix;
            }
            else {
                var newEvent = new RawEvent(eventToFix.name, eventToFix.owner, eventToFix.timestamp, eventToFix.number, eventToFix.data, eventToFix.decorations);
                var owner = eventToFix.owner;
                var session = eventOwner;
                if (session.events.has(eventToFix.name)) {
                    session.events.set(eventToFix.name, newEvent);
                }
                return newEvent;
            }
        }
        var sessions = dataset.sessions;
        var schemes = dataset.schemes;
        var events = dataset.events;
        var order = dataset.order;
        var restoredOrder = [];
        var restoredSchemes = {};
        var restoredSessions = new Map();
        var restoredEvents = new Map();
        var restoredDataset = new Dataset();
        if (order) {
            restoredOrder = order.slice();
        }
        Object.keys(schemes).forEach(function (schemeKey) {
            // restore code scheme
            var scheme = schemes[schemeKey];
            if (scheme instanceof CodeScheme) {
                // should never happen
                console.log("Warning: scheme object is unexpectedly a CodeScheme obj.");
                console.log(scheme);
                console.log("------------");
                restoredSchemes[schemeKey] = scheme;
            }
            else {
                console.log("Is scheme key an integer? " + JSON.stringify(typeof scheme.id === 'number'));
                console.log(typeof schemeKey);
                restoredSchemes[schemeKey] = new CodeScheme(scheme.id, scheme.name, scheme.isNew, scheme.codes);
            }
        });
        Object.keys(sessions).forEach(function (sessionKey) {
            // restores sessions
            var session = sessions[sessionKey];
            restoredSessions.set(sessionKey, new Session(session.id, session.events));
        });
        var eventList = (events instanceof Map) ? Array.from(events.values()) : Object.keys(events).map(function (eventKey) { return events[eventKey]; });
        if (!order) {
            eventList.forEach(function (eventObj) {
                var fixedEvent = fixEventObjectProperties(eventObj, restoredSchemes, restoredSessions.get(eventObj.owner));
                restoredEvents.set(eventObj.name, fixedEvent);
                restoredOrder.push(eventObj.name);
            });
        }
        else {
            order.forEach(function (eventKey) {
                var eventObj = (events instanceof Map) ? events.get(eventKey) : events[eventKey];
                var fixedEvent = fixEventObjectProperties(eventObj, restoredSchemes, restoredSessions.get(eventObj.owner));
                restoredEvents.set(eventKey, fixedEvent);
            });
        }
        restoredDataset.eventOrder = restoredOrder;
        restoredDataset.schemes = restoredSchemes;
        restoredDataset.sessions = restoredSessions;
        restoredDataset.events = restoredEvents;
        return restoredDataset;
    };
    Dataset.prototype.setFields = function (sessions, schemes, events, order) {
        /*
        Restores Dataset after loading from storage (which loses all type information)
         */
        var _this = this;
        console.log("sessions:" + (sessions instanceof Map));
        Object.keys(sessions).forEach(function (sessionKey) {
            // restores sessions
            var session = sessions[sessionKey];
            _this.sessions.set(sessionKey, new Session(session.id, session.events));
        });
        Object.keys(schemes).forEach(function (schemeKey) {
            // restore code scheme
            var scheme = schemes[schemeKey];
            if (scheme instanceof CodeScheme) {
                // should never happen
                console.log("Warning: Scheme object is a CodeScheme! (should be plain Object)");
                _this.schemes[schemeKey] = scheme;
            }
            else {
                _this.schemes[schemeKey] = new CodeScheme(scheme.id, scheme.name, scheme.isNew, scheme.codes);
            }
        });
        if (order) {
            this.eventOrder = order.slice();
        }
        function fixEventObject(eventToFix, data) {
            /*
             Ensure decoration references are correct
             */
            if (eventToFix.decorations instanceof Map) {
                // shouldn't be reached
                console.log("Warning: Event decorations are a Map! (should be plain Object)");
                for (var _i = 0, _a = eventToFix.decorations.entries(); _i < _a.length; _i++) {
                    var _b = _a[_i], key = _b[0], deco = _b[1];
                    var code = deco.code;
                    if (deco.owner == null && eventToFix instanceof RawEvent) {
                        deco.owner = eventToFix;
                    }
                    if (code) {
                        deco.code = schm[key].codes.get(code.id);
                        if (deco.code instanceof Code && deco.manual) {
                            deco.code.addEvent(eventToFix);
                        }
                    }
                }
            }
            else {
                Object.keys(eventToFix.decorations).forEach(function (schemeKey) {
                    var code = eventToFix.decorations[schemeKey].code;
                    if (code) {
                        eventToFix.decorations[schemeKey].code = schm[schemeKey].codes.get(code.id); // Code object has been initialised within scheme
                        if (!(eventToFix.decorations[schemeKey].code instanceof Code)) {
                            // shouldn't happen as Codes are initialised when restoring
                        }
                        if (eventToFix.decorations[schemeKey].code instanceof Code && eventToFix.decorations[schemeKey].manual) {
                            eventToFix.decorations[schemeKey].code.addEvent(eventToFix);
                        }
                    }
                });
            }
            /*
             Create/adjust event objects
             */
            if (eventToFix instanceof RawEvent) {
                var owner = eventToFix.owner;
                var session = data.sessions.get(owner);
                if (session.events.has(eventToFix.name)) {
                    session.events.set(eventToFix.name, eventToFix);
                }
                return eventToFix;
            }
            else {
                var newEvent = new RawEvent(eventToFix.name, eventToFix.owner, eventToFix.timestamp, eventToFix.number, eventToFix.data, eventToFix.decorations);
                var owner = eventToFix.owner;
                var session = data.sessions.get(owner);
                if (session.events.has(eventToFix.name)) {
                    session.events.set(eventToFix.name, newEvent);
                }
                return newEvent;
            }
        }
        var schm = this.schemes;
        var newEventsObj = new Map();
        if (!order) {
            if (events instanceof Map) {
                console.log("instance map");
                for (var _i = 0, _a = events.entries(); _i < _a.length; _i++) {
                    var _b = _a[_i], key = _b[0], event_3 = _b[1];
                    var fixedEvent = fixEventObject(event_3, this);
                    newEventsObj.set(key, fixedEvent);
                    this.eventOrder.push(fixedEvent.name);
                }
            }
            else {
                console.log("instance obj");
                Object.keys(events).forEach(function (eventKey) {
                    var fixedEvent = fixEventObject(events[eventKey], _this);
                    newEventsObj.set(eventKey, fixedEvent);
                    _this.eventOrder.push(fixedEvent.name);
                });
            }
        }
        else {
            order.forEach(function (eventKey) {
                if (events instanceof Map) {
                    newEventsObj.set(eventKey, fixEventObject(events.get(eventKey), _this));
                }
                else {
                    newEventsObj.set(eventKey, fixEventObject(events[eventKey], _this));
                }
            });
        }
        this.events = newEventsObj;
        return this;
    };
    /*
    NB: event names/ids are the initial indices when read from file for the first time!
    Once initialized, they aren't changed regardless of sorting and can be used to restore the default on-load ordering.
    */
    Dataset.prototype.restoreDefaultSort = function () {
        var _this = this;
        this.eventOrder.sort(function (e1, e2) {
            var name1, name2;
            var intParse1 = parseInt(_this.events.get(e1).name, 10);
            var intParse2 = parseInt(_this.events.get(e2).name, 10);
            if (isNaN(intParse1)) {
                name1 = _this.events.get(e1).name.toLowerCase();
            }
            else {
                name1 = intParse1;
            }
            if (isNaN(intParse2)) {
                name2 = _this.events.get(e2).name.toLowerCase();
            }
            else {
                name2 = intParse2;
            }
            if (name1 < name2) {
                return -1;
            }
            if (name2 < name1) {
                return 1;
            }
            return 0;
        });
        return this.eventOrder;
    };
    Dataset.prototype.sortEventsByScheme = function (schemeId, isToDoList) {
        var _this = this;
        schemeId = schemeId + ""; // force it to string todo: here or make sure decorationForName processes it ok?
        if ((this.schemes.hasOwnProperty && this.schemes.hasOwnProperty(schemeId)) || this.schemes[schemeId] != undefined) {
            var codes_1 = Array.from(this.schemes[schemeId].codes.values()).map(function (code) { return code.value; });
            this.eventOrder.sort(function (eventKey1, eventKey2) {
                var e1 = _this.events.get(eventKey1);
                var e2 = _this.events.get(eventKey2);
                var deco1 = e1.decorationForName(schemeId);
                var deco2 = e2.decorationForName(schemeId);
                var hasCode1 = deco1 ? e1.decorationForName(schemeId).code != null : false;
                var hasCode2 = deco2 ? e2.decorationForName(schemeId).code != null : false;
                var code1 = hasCode1 ? codes_1.indexOf(e1.decorationForName(schemeId).code.value) : -1;
                var code2 = hasCode2 ? codes_1.indexOf(e2.decorationForName(schemeId).code.value) : -1;
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
                        var intParse1 = parseInt(e1.name);
                        var intParse2 = parseInt(e2.name);
                        var name1 = void 0, name2 = void 0;
                        if (isNaN(intParse1)) {
                            name1 = e1.name.toLowerCase();
                        }
                        else {
                            name1 = intParse1;
                        }
                        if (isNaN(intParse2)) {
                            name1 = e2.name.toLowerCase();
                        }
                        else {
                            name1 = intParse2;
                        }
                        if (name1 < name2) {
                            return -1;
                        }
                        if (name2 < name1) {
                            return 1;
                        }
                        return 0;
                    }
                    // same codes, now sort by manual/automatic & confidence
                    if (deco1.confidence != null && typeof deco1.confidence !== "undefined" && deco2 != null && typeof deco2.confidence !== "undefined") {
                        if (typeof deco1.manual !== "undefined" && deco1.manual) {
                            if (typeof deco2.manual !== "undefined" && deco2.manual) {
                                var decoDifference = deco1.confidence - deco2.confidence;
                                if (decoDifference === 0) {
                                    var intParse1 = parseInt(e1.name);
                                    var intParse2 = parseInt(e2.name);
                                    var name1 = void 0, name2 = void 0;
                                    if (isNaN(intParse1)) {
                                        name1 = e1.name.toLowerCase();
                                    }
                                    else {
                                        name1 = intParse1;
                                    }
                                    if (isNaN(intParse2)) {
                                        name1 = e2.name.toLowerCase();
                                    }
                                    else {
                                        name1 = intParse2;
                                    }
                                    if (name1 < name2) {
                                        return -1;
                                    }
                                    if (name2 < name1) {
                                        return 1;
                                    }
                                    return 0;
                                }
                                else {
                                    return decoDifference;
                                }
                            }
                            else {
                                return 1;
                            }
                        }
                        else if (typeof deco2.manual !== "undefined" && deco2.manual) {
                            return -1;
                        }
                        else {
                            var decoDifference = deco1.confidence - deco2.confidence;
                            if (decoDifference === 0) {
                                var intParse1 = parseInt(e1.name);
                                var intParse2 = parseInt(e2.name);
                                var name1 = void 0, name2 = void 0;
                                if (isNaN(intParse1)) {
                                    name1 = e1.name.toLowerCase();
                                }
                                else {
                                    name1 = intParse1;
                                }
                                if (isNaN(intParse2)) {
                                    name1 = e2.name.toLowerCase();
                                }
                                else {
                                    name1 = intParse2;
                                }
                                if (name1 < name2) {
                                    return -1;
                                }
                                if (name2 < name1) {
                                    return 1;
                                }
                                return 0;
                            }
                            else {
                                return decoDifference;
                            }
                        }
                    }
                    else if (deco1.confidence == null && deco2.confidence == null) {
                        var intParse1 = parseInt(e1.name);
                        var intParse2 = parseInt(e2.name);
                        var name1 = void 0, name2 = void 0;
                        if (isNaN(intParse1)) {
                            name1 = e1.name.toLowerCase();
                        }
                        else {
                            name1 = intParse1;
                        }
                        if (isNaN(intParse2)) {
                            name1 = e2.name.toLowerCase();
                        }
                        else {
                            name1 = intParse2;
                        }
                        if (name1 < name2) {
                            return -1;
                        }
                        if (name2 < name1) {
                            return 1;
                        }
                        return 0;
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
    };
    Dataset.prototype.sortEventsByConfidenceOnly = function (schemeId) {
        var _this = this;
        schemeId = schemeId + ""; // force it to string todo: here or make sure decorationForName processes it ok?
        if ((this.schemes.hasOwnProperty && this.schemes.hasOwnProperty(schemeId)) || this.schemes[schemeId] != undefined) {
            this.eventOrder.sort(function (eventKey1, eventKey2) {
                var returnResult = 0;
                var e1 = _this.events.get(eventKey1);
                var e2 = _this.events.get(eventKey2);
                var deco1 = e1.decorationForName(schemeId);
                var deco2 = e2.decorationForName(schemeId);
                if (deco1 == undefined && deco2 == undefined) {
                    var intParse1 = parseInt(e1.name);
                    var intParse2 = parseInt(e2.name);
                    var name1 = void 0, name2 = void 0;
                    if (isNaN(intParse1)) {
                        name1 = e1.name.toLowerCase();
                    }
                    else {
                        name1 = intParse1;
                    }
                    if (isNaN(intParse2)) {
                        name1 = e2.name.toLowerCase();
                    }
                    else {
                        name1 = intParse2;
                    }
                    if (name1 < name2) {
                        returnResult = -1;
                    }
                    if (name2 < name1) {
                        returnResult = 1;
                    }
                    returnResult = 0;
                }
                else if (deco1 == undefined) {
                    var hasManual2 = typeof deco2.manual !== "undefined" || deco2.manual != null;
                    if (hasManual2)
                        returnResult = -1;
                    else {
                        var intParse1 = parseInt(e1.name);
                        var intParse2 = parseInt(e2.name);
                        var name1 = void 0, name2 = void 0;
                        if (isNaN(intParse1)) {
                            name1 = e1.name.toLowerCase();
                        }
                        else {
                            name1 = intParse1;
                        }
                        if (isNaN(intParse2)) {
                            name1 = e2.name.toLowerCase();
                        }
                        else {
                            name1 = intParse2;
                        }
                        if (name1 < name2) {
                            returnResult = -1;
                        }
                        if (name2 < name1) {
                            returnResult = 1;
                        }
                        returnResult = 0;
                    }
                }
                else if (deco2 == undefined) {
                    var hasManual1 = typeof deco1.manual !== "undefined" || deco1.manual != null;
                    if (hasManual1)
                        returnResult = 1;
                    else {
                        var intParse1 = parseInt(e1.name);
                        var intParse2 = parseInt(e2.name);
                        var name1 = void 0, name2 = void 0;
                        if (isNaN(intParse1)) {
                            name1 = e1.name.toLowerCase();
                        }
                        else {
                            name1 = intParse1;
                        }
                        if (isNaN(intParse2)) {
                            name1 = e2.name.toLowerCase();
                        }
                        else {
                            name1 = intParse2;
                        }
                        if (name1 < name2) {
                            returnResult = -1;
                        }
                        if (name2 < name1) {
                            returnResult = 1;
                        }
                        returnResult = 0;
                    }
                }
                else {
                    var hasManual1 = typeof deco1.manual !== "undefined" || deco1.manual != null;
                    var hasManual2 = typeof deco2.manual !== "undefined" || deco2.manual != null;
                    if (hasManual1 && hasManual2) {
                        if (deco1.manual) {
                            if (deco2.manual) {
                                var intParse1 = parseInt(e1.name);
                                var intParse2 = parseInt(e2.name);
                                var name1 = void 0, name2 = void 0;
                                if (isNaN(intParse1)) {
                                    name1 = e1.name.toLowerCase();
                                }
                                else {
                                    name1 = intParse1;
                                }
                                if (isNaN(intParse2)) {
                                    name1 = e2.name.toLowerCase();
                                }
                                else {
                                    name1 = intParse2;
                                }
                                if (name1 < name2) {
                                    returnResult = -1;
                                }
                                if (name2 < name1) {
                                    returnResult = 1;
                                }
                                returnResult = 0;
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
                                var decoDifference = deco1.confidence - deco2.confidence;
                                if (decoDifference === 0) {
                                    var intParse1 = parseInt(e1.name);
                                    var intParse2 = parseInt(e2.name);
                                    var name1 = void 0, name2 = void 0;
                                    if (isNaN(intParse1)) {
                                        name1 = e1.name.toLowerCase();
                                    }
                                    else {
                                        name1 = intParse1;
                                    }
                                    if (isNaN(intParse2)) {
                                        name1 = e2.name.toLowerCase();
                                    }
                                    else {
                                        name1 = intParse2;
                                    }
                                    if (name1 < name2) {
                                        returnResult = -1;
                                    }
                                    if (name2 < name1) {
                                        returnResult = 1;
                                    }
                                    returnResult = 0;
                                }
                                else {
                                    returnResult = decoDifference;
                                }
                            }
                        }
                    }
                    else {
                        if (hasManual1 == hasManual2) {
                            // both are uncoded
                            var intParse1 = parseInt(e1.name);
                            var intParse2 = parseInt(e2.name);
                            var name1 = void 0, name2 = void 0;
                            if (isNaN(intParse1)) {
                                name1 = e1.name.toLowerCase();
                            }
                            else {
                                name1 = intParse1;
                            }
                            if (isNaN(intParse2)) {
                                name1 = e2.name.toLowerCase();
                            }
                            else {
                                name1 = intParse2;
                            }
                            if (name1 < name2) {
                                returnResult = -1;
                            }
                            if (name2 < name1) {
                                returnResult = 1;
                            }
                            returnResult = 0;
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
                if ((returnResult < 0 && (deco1 && deco1.confidence > 0 && (typeof deco2 === "undefined"))) ||
                    (returnResult > 0 && (deco2 && deco2.confidence > 0 && (typeof deco1 === "undefined"))) ||
                    (returnResult > 0 && (deco2 && deco1 && deco2.confidence > deco1.confidence && deco2.code != null)) ||
                    (returnResult < 0 && (deco2 && deco1 && deco1.confidence > deco2.confidence && deco1.code != null))) {
                    console.log(e1.name + ", " + e2.name);
                }
                return returnResult;
            });
        }
        return this.eventOrder;
    };
    Dataset.prototype.deleteScheme = function (schemeId) {
        for (var _i = 0, _a = this.events.values(); _i < _a.length; _i++) {
            var event_4 = _a[_i];
            event_4.uglify(schemeId); // todo optimise, because there is no need to call 'remove event' from code if scheme is being deleted anyway
        }
        delete this.schemes[schemeId];
        return this.eventOrder;
    };
    Dataset.prototype.toJSON = function () {
        var obj = Object.create(null);
        obj.events = this.events;
        obj.sessions = this.sessions;
        obj.schemes = this.schemes;
        return obj;
    };
    return Dataset;
}());
var RawEvent = (function () {
    function RawEvent(name, owner, timestamp, number, data, decorations) {
        var _this = this;
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
            if (!(decorations instanceof Map)) {
                var decors_1 = new Map();
                var codes_2 = new Map();
                Object.keys(decorations).forEach(function (decoKey) {
                    var d = decorations[decoKey];
                    var author = (d.author && d.author.length > 0) ? d.author : "";
                    decors_1.set(decoKey, new EventDecoration(_this, d.scheme_id, d.manual, author, d.code, d.confidence, d.timestamp));
                    codes_2.set(d.scheme_id, d.code);
                });
                this.decorations = decors_1;
                this.codes = codes_2;
            }
            else {
                // decorations are a map already
            }
        }
    }
    RawEvent.clone = function (oldEvent) {
        var newDecorations = new Map();
        for (var _i = 0, _a = newDecorations.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], deco = _b[1];
            //newDecorations.set(key, EventDecoration.clone(deco, newEvent, ));
        }
        var newEvent = new RawEvent(oldEvent.name, oldEvent.owner, oldEvent.timestamp, oldEvent.number, oldEvent.data, newDecorations);
    };
    // todo refactor to not use codes just decorations
    RawEvent.prototype.codeForScheme = function (schemeId) {
        //return this.codes.get(schemeId);
        return this.decorations.get(schemeId).code;
    };
    RawEvent.prototype.schemeNames = function () {
        return Array.from(this.codes.keys()); // todo
    };
    RawEvent.prototype.assignedCodes = function () {
        return Array.from(this.codes.values()); // todo
    };
    RawEvent.prototype.decorate = function (schemeId, manual, author, code, confidence, timestamp) {
        var stringSchemeId = "" + schemeId;
        this.decorations.set(stringSchemeId, new EventDecoration(this, stringSchemeId, manual, author, code, confidence, timestamp));
    };
    RawEvent.prototype.uglify = function (schemeId) {
        var deco = this.decorations.get(schemeId);
        if (deco && deco.code) {
            deco.code.removeEvent(this);
        }
        this.decorations.delete(schemeId);
        this.codes.delete(schemeId);
        return this;
    };
    RawEvent.prototype.decorationForName = function (schemeId) {
        return this.decorations.get(schemeId);
    };
    RawEvent.prototype.decorationNames = function () {
        return Array.from(this.decorations.keys());
    };
    RawEvent.prototype.isUncoded = function (schemeKeys) {
        for (var _i = 0, schemeKeys_1 = schemeKeys; _i < schemeKeys_1.length; _i++) {
            var schemeKey = schemeKeys_1[_i];
            var hasValidCode = this.decorations.has(schemeKey) && this.decorations.get(schemeKey).code;
            if (!hasValidCode)
                return true;
        }
        return false;
    };
    RawEvent.prototype.firstUncodedScheme = function (schemeKeyOrder) {
        for (var _i = 0, schemeKeyOrder_1 = schemeKeyOrder; _i < schemeKeyOrder_1.length; _i++) {
            var schemeKey = schemeKeyOrder_1[_i];
            var hasValidCode = this.decorations.has(schemeKey) && this.decorations.get(schemeKey).code;
            if (!hasValidCode)
                return schemeKey;
        }
        return "";
    };
    RawEvent.prototype.toJSON = function () {
        var obj = Object.create(null);
        obj.owner = this.owner;
        obj.name = this.name;
        obj.timestamp = this.timestamp;
        obj.number = this.number;
        obj.data = this.data;
        obj.decorations = Object.create(null);
        this.decorations.forEach(function (value, key) {
            obj.decorations[key] = value;
        });
        return obj;
    };
    return RawEvent;
}());
var EventDecoration = (function () {
    function EventDecoration(owner, id, manual, author, code, confidence, timestamp) {
        this.owner = owner;
        this.scheme_id = id;
        this.manual = manual;
        this.author = author;
        (confidence == undefined) ? this.confidence = 0 : this.confidence = confidence;
        if (code) {
            if (code instanceof Code) {
                if (manual)
                    code.addEvent(owner);
                this._timestamp = (timestamp) ? timestamp : new Date().toString();
                this._code = code;
            }
            else {
                // occurs when reading from storage... type is lost
                console.log(code);
                /*this._code = new Code(code.owner, code.id, code.value, code.color, code.shortcut, false);
                this._timestamp = timestamp ? timestamp : null;*/
            }
        }
        else {
            this._code = null; // TODO: this will require null pointer checks
            this._timestamp = null;
        }
    }
    EventDecoration.clone = function (oldDeco, newOwner, newCode) {
        return new EventDecoration(newOwner, oldDeco.scheme_id, oldDeco.manual, oldDeco.author, newCode, oldDeco.confidence, oldDeco.timestamp);
    };
    EventDecoration.prototype.toJSON = function () {
        var obj = Object.create(null);
        obj.owner = this.owner.name;
        obj.scheme_id = this.scheme_id;
        obj.code = (this.code != null) ? { "id": this.code.id, "value": this.code.value, "owner": this.code.owner.id } : {};
        obj.confidence = this.confidence;
        obj.manual = this.manual;
        return obj;
    };
    EventDecoration.prototype.changeCodeObj = function (code) {
        this._code = code;
    };
    Object.defineProperty(EventDecoration.prototype, "code", {
        get: function () {
            return this._code;
        },
        set: function (code) {
            this._timestamp = new Date().toString();
            this._code = code;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(EventDecoration.prototype, "timestamp", {
        get: function () {
            return this._timestamp;
        },
        enumerable: true,
        configurable: true
    });
    return EventDecoration;
}());
var Session = (function () {
    function Session(id, events) {
        var _this = this;
        this.id = id;
        this.events = new Map();
        events.forEach(function (eventObj) {
            if (typeof eventObj === "string") {
                _this.events.set(eventObj, null);
            }
            else if (eventObj instanceof RawEvent) {
                _this.events.set(eventObj.name, eventObj);
            }
        });
        this.decorations = new Map();
    }
    Session.prototype.decorate = function (decorationName, decorationValue, author) {
        this.decorations.set(decorationName, new SessionDecoration(this, decorationName, decorationValue));
    };
    Session.prototype.decorationForName = function (decorationName) {
        return this.decorations.get(decorationName);
    };
    Session.prototype.getAllDecorationNames = function () {
        var names = new Set();
        for (var _i = 0, _a = this.events.values(); _i < _a.length; _i++) {
            var e = _a[_i];
            for (var key in e.decorations) {
                names.add(key);
            }
        }
        return names;
    };
    Session.prototype.toJSON = function () {
        var obj = Object.create(null);
        obj.id = this.id;
        obj.events = Array.from(this.events.values()).map(function (event) { return event.name; });
        obj.decorations = this.decorations;
        return obj;
    };
    Session.prototype.getAllEventNames = function () {
        var eventNames = new Set();
        for (var _i = 0, _a = this.events.values(); _i < _a.length; _i++) {
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
    SessionDecoration.prototype.toJSON = function () {
        var obj = Object.create(null);
        obj.owner = this.owner.id;
        obj.name = this.name;
        obj.value = this.value;
        return obj;
    };
    return SessionDecoration;
}());
var CodeScheme = (function () {
    function CodeScheme(id, name, isNew, codes) {
        var _this = this;
        this.id = id + "";
        this.name = name + "";
        if (!codes) {
            this.codes = new Map();
        }
        else {
            if (!(codes instanceof Map)) {
                var c_1 = new Map();
                Object.keys(codes).forEach(function (codeId) {
                    var code = codes[codeId];
                    if (typeof code.owner == "string" || typeof code.owner == "number") {
                        code.owner = _this;
                    }
                    c_1.set(codeId, new Code(code.owner, code.id, code.value, code.color, code.shortcut, false, code.regex));
                    c_1.get(codeId).addWords(code.words);
                });
                this.codes = c_1;
            }
        }
        this.isNew = isNew;
    }
    CodeScheme.validateName = function (name) {
        if (name && typeof name == "string" && name.length < 50) {
            return VALID_NAME_FORMAT.test(name);
        }
        return false;
    };
    CodeScheme.validateScheme = function (scheme) {
        var isNameValid = CodeScheme.validateName(scheme.name);
        var invalidValues = [];
        var invalidShortcuts = [];
        var allCodesValid = true;
        for (var _i = 0, _a = scheme.codes.values(); _i < _a.length; _i++) {
            var code = _a[_i];
            var parsedShortcut = parseInt(code.shortcut);
            var shortcutChar;
            if (code.shortcut.length === 0 || isNaN(parsedShortcut)) {
                shortcutChar = "";
            }
            else {
                shortcutChar = String.fromCharCode(parseInt(code.shortcut));
            }
            if (!Code.validateShortcut(shortcutChar)) {
                invalidShortcuts.push(code.id);
            }
            if (!Code.validateValue(code.value)) {
                invalidValues.push(code.id);
            }
        }
        return { "name": isNameValid, "invalidValues": invalidValues, "invalidShortcuts": invalidShortcuts };
    };
    CodeScheme.prototype.toJSON = function () {
        var obj = Object.create(null);
        obj.id = this.id;
        obj.name = this.name;
        obj.isNew = this.isNew;
        obj.codes = Object.create(null);
        this.codes.forEach(function (value, key) {
            obj.codes[key] = value;
        });
        return obj;
    };
    CodeScheme.clone = function (original) {
        var newScheme = new this(original["id"], original["name"], false);
        newScheme.codes = new Map();
        original.codes.forEach(function (code) {
            newScheme.codes.set(code.id, Code.clone(code));
        });
        return newScheme;
    };
    CodeScheme.prototype.duplicate = function (schemes) {
        var digit = 0;
        var originalId = this.id + "";
        var newId = originalId + digit;
        while (schemes.indexOf(newId) !== -1) {
            digit++;
            newId = originalId + digit;
        }
        var duplicateScheme = new CodeScheme(newId, this.name, this.isNew);
        this.codes.forEach(function (code) {
            var newCodeId = duplicateScheme.id + "-" + code.id;
            var newCode = new Code(duplicateScheme, newCodeId, code.value, code.color, code.shortcut, code.isEdited);
            duplicateScheme.codes.set(newCode.id, newCode);
        });
        return duplicateScheme;
    };
    CodeScheme.prototype.copyCodesFrom = function (otherScheme) {
        this.name = otherScheme.name;
        for (var _i = 0, _a = Array.from(this.codes.keys()); _i < _a.length; _i++) {
            var codeId = _a[_i];
            // delete extra ones!
            if (!otherScheme.codes.has(codeId)) {
                this.codes.delete(codeId);
            }
        }
        for (var _b = 0, _c = Array.from(otherScheme.codes.keys()); _b < _c.length; _b++) {
            var codeId = _c[_b];
            var otherCodeObj = otherScheme.codes.get(codeId);
            if (this.codes.has(codeId)) {
                var code = this.codes.get(codeId);
                code.value = otherCodeObj.value;
                code.words = otherCodeObj.words.slice(0);
                code.color = otherCodeObj.color;
                code.shortcut = otherCodeObj.shortcut;
                code.setRegexFromArray(otherCodeObj.regex);
            }
            else {
                this.codes.set(codeId, otherCodeObj);
            }
        }
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
        for (var _i = 0, _a = Array.from(this.codes.values()); _i < _a.length; _i++) {
            var code = _a[_i];
            if (code.value === value) {
                match = code;
                break;
            }
        }
        return match;
    };
    CodeScheme.prototype.jsonForCSV = function () {
        var obj = Object.create(null);
        obj["fields"] = ["id", "name", "code_id", "code_value", "code_colour", "code_shortcut", "words"];
        obj["data"] = [];
        for (var _i = 0, _a = this.codes; _i < _a.length; _i++) {
            var _b = _a[_i], codeId = _b[0], code = _b[1];
            var codeArr = [this.id, this.name, codeId, code.value, code.color, code.shortcut, "[" + code.words.toString() + "]"];
            obj["data"].push(codeArr);
        }
        return obj;
    };
    return CodeScheme;
}());
var Code = (function () {
    function Code(owner, id, value, color, shortcut, isEdited, regex) {
        this._owner = owner;
        this._id = id;
        this._value = value;
        this._color = color;
        this._shortcut = shortcut;
        this._words = [];
        this._isEdited = isEdited;
        this._eventsWithCode = new Map();
        if (regex && regex[0] && regex[0].length > 0) {
            try {
                var regEXP = new RegExp(regex[0], regex[1]);
                this._regex = regex;
            }
            catch (e) {
                console.log("Error: invalid regex given to Code constructor.");
                console.log(e);
                this._regex = ["", ""];
            }
        }
        else {
            this._regex = ["", ""];
        }
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
        set: function (words) {
            // todo Do we need to count occurrences of these words too or not?
            words.sort(function (a, b) {
                // DESC -> b.length - a.length
                return b.length - a.length || b.localeCompare(a);
            });
            this._words = words.filter(function (word, index) {
                return words.indexOf(word) === index;
            });
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
    Object.defineProperty(Code.prototype, "eventsWithCode", {
        get: function () {
            return this._eventsWithCode;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Code.prototype, "regex", {
        get: function () {
            return this._regex;
        },
        enumerable: true,
        configurable: true
    });
    Code.prototype.toJSON = function () {
        var obj = Object.create(null);
        obj.owner = this.owner.id;
        obj.id = this.id;
        obj.value = this.value;
        obj.color = this.color;
        obj.shortcut = this.shortcut;
        obj.words = this.words;
        obj.regex = this.regex && this.regex[0].length > 0 ? JSON.stringify(this.regex[0]) : []; // only export regex, not flags
        return obj;
    };
    Code.validateValue = function (name) {
        if (name && typeof name == "string" && name.length < 50) {
            return VALID_NAME_FORMAT.test(name);
        }
        return false;
    };
    Code.validateShortcut = function (shortcut) {
        // allow empty shortcut, but not an invalid character
        if (!shortcut || shortcut.length == 0) {
            return true;
        }
        else if (typeof shortcut == "string" && shortcut.length == 1) {
            return /^[a-z0-9]$/.test(shortcut);
        }
        return false;
    };
    Code.prototype.addWords = function (words) {
        var newWords = this._words.concat(words);
        newWords.sort(function (a, b) {
            // DESC -> b.length - a.length
            return b.length - a.length || b.localeCompare(a);
        });
        this._words = newWords.filter(function (word, index) {
            return newWords.indexOf(word) === index;
        });
        this._isEdited = true;
        return this;
    };
    Code.prototype.deleteWords = function (words) {
        for (var _i = 0, words_1 = words; _i < words_1.length; _i++) {
            var word = words_1[_i];
            var index = this._words.indexOf(word);
            if (index != -1) {
                this._words.splice(index, 1);
            }
        }
        return this;
    };
    Code.clone = function (original) {
        var newCode = new Code(original["_owner"], original["_id"], original["_value"], original["_color"], original["_shortcut"], false, original["_regex"]);
        newCode._words = original["_words"].slice(0);
        return newCode;
    };
    Code.cloneWithCustomId = function (original, newId) {
        var newCode = new Code(original["_owner"], newId, original["_value"], original["_color"], original["_shortcut"], false);
        newCode._words = original["_words"].slice(0);
        return newCode;
    };
    Code.prototype.addEvent = function (event) {
        // compare reference to event
        if (event && !this._eventsWithCode.has(event.name))
            this._eventsWithCode.set(event.name, event);
    };
    Code.prototype.removeEvent = function (event) {
        this._eventsWithCode.delete(event.name);
    };
    Code.prototype.setRegexFromRegExpObj = function (regExp) {
        if (regExp && regExp instanceof RegExp) {
            this._regex = [regExp.source, regExp.flags];
        }
    };
    Code.prototype.setRegexFromArray = function (regex) {
        if (regex && regex.length === 2) {
            this._regex = regex;
        }
    };
    Code.prototype.clearRegex = function () {
        this._regex = ["", ""];
    };
    return Code;
}());
// Services
var Watchdog = (function () {
    function Watchdog() {
        console.log("Watchdog ctor");
        var f = this.tick;
        setInterval(function () { f(); }, 500);
    }
    Watchdog.prototype.tick = function () {
        console.log("Watchdog tick");
    };
    return Watchdog;
}());
var StorageManager = (function () {
    function StorageManager() {
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
    Object.defineProperty(StorageManager, "instance", {
        get: function () {
            return this._instance || (this._instance = new StorageManager());
        },
        enumerable: true,
        configurable: true
    });
    StorageManager.prototype.isExpired = function () {
        // TODO
        // on every startup of CODA, check if storage is expired, i.e. more than 30 days have passed since last edit
        // if yes, clear storage
        var _MS_PER_DAY = 1000 * 60 * 60 * 24;
        // a and b are javascript Date objects
        function dateDiffInDays(a, b) {
            // Discard the time and time-zone information.
            var utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
            var utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
            return Math.floor((utc2 - utc1) / _MS_PER_DAY);
        }
        return (30 <= dateDiffInDays(this.lastEdit, new Date()));
    };
    StorageManager.prototype.getDataset = function () {
        return new Promise(function (resolve, reject) {
            chrome.storage.local.get("dataset", function (data) {
                if (chrome.runtime.lastError) {
                    console.log("Runtime error: Chrome failed reading from storage!");
                    reject(chrome.runtime.lastError);
                }
                var dataset = data.hasOwnProperty("dataset") ? data["dataset"] : {};
                if (typeof dataset == "string") {
                    dataset = JSON.parse(dataset);
                }
                if (data == null || dataset == null || typeof data == 'undefined' ||
                    typeof dataset == 'undefined' || Object.keys(dataset).length == 0) {
                    reject(new Error("No valid dataset available in storage!"));
                }
                if (!dataset.hasOwnProperty("schemes") || !dataset.hasOwnProperty("sessions") ||
                    !dataset.hasOwnProperty("events") || Object.keys(dataset["events"]).length == 0) {
                    reject(new Error("Reading from storage failed - dataset format is corrupt."));
                }
                resolve(dataset);
            });
        });
    };
    StorageManager.prototype.getActivity = function () {
        return new Promise(function (resolve, reject) {
            chrome.storage.local.get("instrumentation", function (data) {
                if (chrome.runtime.lastError) {
                    console.log("Runtime error: Chrome failed reading from storage!");
                    reject(chrome.runtime.lastError);
                }
                console.log(data);
                resolve(data["instrumentation"]);
            });
        });
    };
    StorageManager.prototype.clearActivityLog = function () {
        return new Promise(function (resolve, reject) {
            chrome.storage.local.remove("instrumentation", function () {
                if (chrome.runtime.lastError) {
                    console.log("Runtime error: Chrome failed reading from storage!");
                    reject(chrome.runtime.lastError);
                }
                else {
                    console.log("Cleared activity log!");
                    resolve(true);
                }
            });
        });
    };
    StorageManager.prototype.saveDataset = function (dataset) {
        var _this = this;
        this.lastEdit = new Date();
        chrome.storage.local.set({ "dataset": JSON.stringify(dataset), "lastEdit": JSON.stringify(this.lastEdit) }, function () {
            console.log("Stored dataset edit timestamp: " + _this.lastEdit);
            chrome.storage.local.get(function (store) {
                var data = JSON.parse(store["dataset"]);
                var datasetString = "dataset (schemes: "
                    + Object.keys(data["schemes"]).length +
                    ", events: " + Object.keys(data["events"]).length +
                    ", sessions: " + Object.keys(data["sessions"]).length + ")";
                console.log("In storage: Last edit (" + new Date(JSON.parse(store["lastEdit"])) + "), " + datasetString);
                chrome.storage.local.getBytesInUse(function (bytesUnUse) {
                    console.log("Bytes in use: " + bytesUnUse);
                    console.log("QUOTA_BYTES: " + chrome.storage.local.QUOTA_BYTES);
                });
            });
        });
    };
    StorageManager.prototype.saveActivity = function (logEvent, uid) {
        // save user activity in storage for instrumentation
        if (logEvent.category.length != 0 && (logEvent.message.length > 0 || logEvent.data.length > 0) && logEvent.timestamp instanceof Date) {
            activity.push(logEvent);
            console.log("INSTRUMENTATION: " + logEvent.category + ":" + logEvent.message + ", stack size: " + activity.length);
            if (activity.length % StorageManager._MAX_ACTIVITY_SAVE_FREQ == 0) {
                chrome.storage.local.get("instrumentation", function (data) {
                    if (chrome.runtime.lastError) {
                        console.log(chrome.runtime.lastError);
                    }
                    else {
                        var instr = void 0;
                        if (data["instrumentation"]) {
                            instr = JSON.parse(data["instrumentation"]).concat(activity);
                        }
                        else {
                            instr = activity;
                        }
                        chrome.storage.local.set({ "instrumentation": JSON.stringify(instr), }, function () {
                            if (chrome.runtime.lastError) {
                                console.log(chrome.runtime.lastError);
                            }
                            else {
                                activity = [];
                                console.log("Saved activity log!");
                                chrome.storage.local.get(function (store) {
                                    console.log("In storage: instrumentation stack size " + JSON.parse(store["instrumentation"]).length);
                                    chrome.storage.local.getBytesInUse(function (bytesUnUse) {
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
    };
    StorageManager.prototype.clearStorage = function () {
        return new Promise(function (resolve, reject) {
            chrome.storage.local.remove(["dataset", "schemes"], function () {
                var error = chrome.runtime.lastError;
                if (error) {
                    console.error(error);
                    reject(new Error(error.message));
                }
                else {
                    resolve(true);
                }
            });
        });
    };
    StorageManager.prototype.saveUUID = function (id) {
        return new Promise(function (resolve, reject) {
            chrome.storage.local.set({ 'userId': id }, function () {
                if (chrome.runtime.lastError) {
                    console.log(chrome.runtime.lastError);
                    reject(new Error('Failed to save uuid:' + id));
                }
                console.log("Saved user ID: " + id);
                resolve(id);
            });
        });
    };
    StorageManager.prototype.getUUID = function () {
        return new Promise(function (resolve, reject) {
            chrome.storage.local.get('userId', function (data) {
                if (chrome.runtime.lastError) {
                    console.log("Runtime error: Chrome failed reading from storage!");
                    reject(chrome.runtime.lastError);
                }
                var id = data.hasOwnProperty('userId') ? data['userId'] : null;
                if (id && id.length == 36) {
                    resolve(id);
                }
                else {
                    resolve("");
                }
            });
        });
    };
    StorageManager._MAX_ACTIVITY_SAVE_FREQ = 3;
    return StorageManager;
}());
var FileIO = (function () {
    function FileIO() {
    }
    /**
     * Saves the given string to a file. The file is determined by a file selector UI.
     * @param {Blob} fileContents Data to write to the file.
     * @param {(downloadId: number) => void} onDownloadStartedHandler Function to run once the download has started
     *                                                                successfully.
     */
    FileIO.saveFile = function (fileContents, onDownloadStartedHandler) {
        var url = window.URL.createObjectURL(fileContents);
        console.log("Saving file from URL", url);
        chrome.downloads.download({
            url: url,
            saveAs: true
        }, onDownloadStartedHandler);
    };
    /**
     * Exports the given dataset to file on disk.
     * @param {Dataset} dataset Dataset to save to disk.
     */
    FileIO.saveDataset = function (dataset) {
        var eventJSON = { "data": [], "fields": ["id", "timestamp", "owner", "data", "schemeId", "schemeName", "deco_codeValue", "deco_codeId",
                "deco_confidence", "deco_manual", "deco_timestamp", "deco_author"]
        }; // TODO: why are rows being referred to as 'events'?
        // For each 'event', add a row to the output for each scheme if schemes exist, or a single row if not.
        // TODO: Write this in a less-yucky way such that pushing many empty strings is not required
        for (var _i = 0, _a = dataset.events.values(); _i < _a.length; _i++) {
            var event_5 = _a[_i];
            if (Object.keys(dataset.schemes).length === 0) {
                var newEventData = [];
                newEventData.push(event_5.name);
                newEventData.push(event_5.timestamp);
                newEventData.push(event_5.owner);
                newEventData.push(event_5.data);
                newEventData.push(""); // schemeId
                newEventData.push(""); // schemeName
                newEventData.push(""); // deco_codeValue
                newEventData.push(""); // deco_codeId
                newEventData.push(""); // deco_confidence
                newEventData.push(""); // deco_manual
                newEventData.push(""); // deco_timestamp
                newEventData.push(""); // deco_author
                eventJSON["data"].push(newEventData);
            }
            else {
                for (var _b = 0, _c = Object.keys(dataset.schemes); _b < _c.length; _b++) {
                    var schemeKey = _c[_b];
                    var newEventData = [];
                    newEventData.push(event_5.name);
                    newEventData.push(event_5.timestamp);
                    newEventData.push(event_5.owner);
                    newEventData.push(event_5.data);
                    newEventData.push(schemeKey);
                    newEventData.push(dataset.schemes[schemeKey].name);
                    if (event_5.decorations.has(schemeKey)) {
                        // If this row has been coded under this scheme, include its coding
                        var decoration = event_5.decorations.get(schemeKey);
                        if (decoration.code != null) {
                            newEventData.push(decoration.code.value);
                            newEventData.push(decoration.code.id);
                        }
                        else {
                            newEventData.push(""); // deco_codeValue
                            newEventData.push(""); // deco_codeId
                        }
                        newEventData.push(decoration.confidence);
                        newEventData.push(decoration.manual);
                        newEventData.push((decoration.timestamp) ? decoration.timestamp : "");
                        newEventData.push(""); // deco_author
                    }
                    else {
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
        var dataBlob = new Blob([Papa.unparse(eventJSON, { header: true, delimiter: ";" })], { type: 'text/plain' });
        FileIO.saveFile(dataBlob, function (downloadId) {
            console.log("Downloaded file with id: " + downloadId);
            storage.saveActivity({
                "category": "DATASET",
                "message": "Exported dataset",
                "messageDetails": "",
                "data": "",
                "timestamp": new Date()
            });
        });
    };
    /**
     * Exports the given code scheme to a file on disk.
     * @param {CodeScheme} codeScheme Code scheme to save to disk.
     */
    FileIO.saveCodeScheme = function (codeScheme) {
        var schemeJSON = { "data": [], "fields": ["scheme_id", "scheme_name", "code_id", "code_value", "code_colour",
                "code_shortcut", "code_words", "code_regex"]
        };
        for (var _i = 0, _a = codeScheme.codes; _i < _a.length; _i++) {
            var _b = _a[_i], codeId = _b[0], code = _b[1];
            var codeArr = [codeScheme.id, codeScheme.name, codeId, code.value, code.color,
                code.shortcut, code.words.toString(), code.regex[0]];
            schemeJSON["data"].push(codeArr);
        }
        var dataBlob = new Blob([Papa.unparse(schemeJSON, { header: true, delimiter: ";" })], { type: 'text/plain' });
        FileIO.saveFile(dataBlob, function (downloadId) {
            console.log("Downloaded file with id: " + downloadId);
            storage.saveActivity({
                "category": "SCHEME",
                "message": "Exported scheme",
                "messageDetails": { "scheme": codeScheme.id },
                "data": codeScheme.toJSON(),
                "timestamp": new Date()
            });
        });
    };
    FileIO.readFileAsText = function (file) {
        return new Promise(function (resolve) {
            var reader = new FileReader();
            reader.onloadend = function () { return resolve(reader.result); };
            reader.readAsText(file);
        });
    };
    /**
     * Loads a file from disk and parses this into a Dataset.
     * Note that a successfully parsed Dataset object is not necessarily valid.
     * @param {File} file File to be read and parsed.
     * @param {string} uuid TODO
     * @returns {Promise<Dataset>} Resolves with a parsed dataset if the file was successfully loaded and parsed,
     * or rejects with the parse errors if the parse failed. FIXME: If the file doesn't load then nothing will happen.
     */
    FileIO.loadDataset = function (file, uuid) {
        return new Promise(function (resolve, reject) {
            FileIO.readFileAsText(file).then(function (readResult) {
                // Attempt to parse the dataset read from the file.
                var parse = Papa.parse(readResult, { header: true });
                // If parsing failed, reject.
                if (parse.errors.length > 0) {
                    reject(parse.errors);
                    return;
                }
                var parsedObjects = parse.data;
                var dataset = new Dataset();
                var events = new Map();
                var nextEvent = null;
                // If well-formed, the data file being imported has a row for each codable data item/coding scheme pair.
                // Loop over each of these rows to build a dataset object.
                for (var _i = 0, parsedObjects_1 = parsedObjects; _i < parsedObjects_1.length; _i++) {
                    var eventRow = parsedObjects_1[_i];
                    var id = eventRow.hasOwnProperty("id"), timestamp = eventRow.hasOwnProperty("timestamp"), owner = eventRow.hasOwnProperty("owner"), data = eventRow.hasOwnProperty("data"), schemeId = eventRow.hasOwnProperty("schemeId"), schemeName = eventRow.hasOwnProperty("schemeName"), deco_codevalue = eventRow.hasOwnProperty("deco_codeValue"), deco_codeId = eventRow.hasOwnProperty("deco_codeId"), deco_confidence = eventRow.hasOwnProperty("deco_confidence"), deco_manual = eventRow.hasOwnProperty("deco_manual"), deco_timestamp = eventRow.hasOwnProperty("deco_timestamp"), deco_author = eventRow.hasOwnProperty("deco_author");
                    // If this parsed row has the minimum information set required to construct an entry in the dataset,
                    // construct that entry and add it to the dataset.
                    // TODO: Break this into smaller functions?
                    if (id && owner && data) {
                        if (!dataset) {
                            dataset = new Dataset(); // TODO: Determine whether this check is necessary.
                        }
                        var timestampData = timestamp ? eventRow["timestamp"] : "";
                        var isNewEvent = !events.has(eventRow["id"]);
                        if (isNewEvent) {
                            nextEvent = new RawEvent(eventRow["id"], eventRow["owner"], timestampData, eventRow["id"], eventRow["data"]);
                            events.set(eventRow["id"], nextEvent);
                        }
                        else {
                            nextEvent = events.get(eventRow["id"]);
                        }
                        if (!dataset.sessions.has(eventRow["owner"])) {
                            var newSession = new Session(eventRow["owner"], [nextEvent]);
                            dataset.sessions.set(eventRow["owner"], newSession);
                        }
                        else {
                            var session = dataset.sessions.get(eventRow["owner"]);
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
                            var newScheme = void 0;
                            if (!dataset.schemes[eventRow["schemeId"]]) {
                                newScheme = new CodeScheme(eventRow["schemeId"], eventRow["schemeName"], false);
                                dataset.schemes[newScheme.id] = newScheme;
                            }
                            else {
                                newScheme = dataset.schemes[eventRow["schemeId"]];
                            }
                            if (!newScheme.codes.has(eventRow["deco_codeId"])) {
                                newScheme.codes.set(eventRow["deco_codeId"], new Code(newScheme, eventRow["deco_codeId"], eventRow["deco_codeValue"], "", "", false));
                            }
                            var manual = eventRow["deco_manual"].toLocaleLowerCase() !== "false"; // manually coded
                            var confidence = void 0;
                            if (deco_confidence) {
                                var defaultConfidence = 0.95; // TODO: log a warning when this default is used?
                                if (eventRow["deco_confidence"].length === 0) {
                                    confidence = defaultConfidence;
                                }
                                else {
                                    var float = parseFloat(eventRow["deco_confidence"]);
                                    if (isNaN(float)) {
                                        confidence = defaultConfidence;
                                    }
                                    else {
                                        confidence = float;
                                    }
                                }
                            }
                            else {
                                confidence = undefined;
                            }
                            nextEvent.decorate(newScheme.id, manual, uuid, newScheme.codes.get(eventRow["deco_codeId"]), confidence);
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
    };
    FileIO.loadCodeScheme = function (file) {
        return new Promise(function (resolve, reject) {
            FileIO.readFileAsText(file).then(function (readResult) {
                // Attempt to parse the scheme read from the file.
                var parse = Papa.parse(readResult, { header: true });
                if (parse.errors.length > 0) {
                    reject(parse.errors);
                    return;
                }
                var parsedObjects = parse.data;
                var newScheme = null;
                // Each row defines a code within the code scheme.
                // Construct a CodeScheme object by parsing each code entry in turn.
                for (var _i = 0, parsedObjects_2 = parsedObjects; _i < parsedObjects_2.length; _i++) {
                    var codeRow = parsedObjects_2[_i];
                    var id = codeRow.hasOwnProperty("scheme_id"), name_1 = codeRow.hasOwnProperty("scheme_name"), code_id = codeRow.hasOwnProperty("code_id"), code_value = codeRow.hasOwnProperty("code_value"), code_colour = codeRow.hasOwnProperty("code_colour"), code_shortcut = codeRow.hasOwnProperty("code_shortcut"), code_words = codeRow.hasOwnProperty("code_words");
                    // If there is sufficient information to convert this row into a code, do so, and add it to the
                    // scheme.
                    if (id && name_1 && code_id && code_value) {
                        // todo handle if loading an edit of a scheme that was already loaded in... how to deal if
                        // todo code was deleted?
                        if (!newScheme) {
                            newScheme = new CodeScheme(codeRow["scheme_id"], codeRow["scheme_name"], false);
                        }
                        var newShortcut = codeRow["code_shortcut"];
                        if (codeRow["code_shortcut"].length === 1 && isNaN(parseInt(codeRow["code_shortcut"]))) {
                            newShortcut = UIUtils.ascii(codeRow["code_shortcut"]);
                        }
                        var newCode = new Code(newScheme, codeRow["code_id"], codeRow["code_value"], codeRow["code_colour"], newShortcut, false);
                        if (code_words) {
                            if (codeRow["code_words"].length !== 0) {
                                var words = codeRow["code_words"].split(",");
                                if (words.length > 0) {
                                    newCode.addWords(words);
                                }
                            }
                        }
                        newScheme.codes.set(codeRow["code_id"], newCode);
                    }
                }
                resolve(newScheme);
            });
        });
    };
    return FileIO;
}());
var UndoManager = (function () {
    function UndoManager() {
        this.pointer = 0;
        this.modelUndoStack = []; // IS INITIALIZED TO INITIAL DATASET VERSION!
        this.schemaUndoStack = [];
    }
    UndoManager.prototype.markUndoPoint = function (codeSchemeOrder) {
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
    };
    UndoManager.prototype.canUndo = function () { return this.pointer != 0; };
    UndoManager.prototype.canRedo = function () { return this.pointer != this.modelUndoStack.length - 1 && this.modelUndoStack.length != 0; };
    UndoManager.prototype.undo = function (messageViewerManager) {
        if (!this.canUndo())
            return false;
        this.pointer--;
        newDataset = Dataset.clone(this.modelUndoStack[this.pointer][0]);
        if (this.modelUndoStack[this.pointer][1] && this.modelUndoStack[this.pointer][1].length !== 0) {
            messageViewerManager.codeSchemeOrder = this.modelUndoStack[this.pointer][1].slice(0);
        }
        schema = this.schemaUndoStack[this.pointer];
        return true;
    };
    UndoManager.prototype.redo = function (messageViewerManager) {
        if (!this.canRedo())
            return false;
        this.pointer++;
        newDataset = Dataset.clone(this.modelUndoStack[this.pointer][0]);
        if (this.modelUndoStack[this.pointer][1] && this.modelUndoStack[this.pointer][1].length !== 0) {
            messageViewerManager.codeSchemeOrder = this.modelUndoStack[this.pointer][1].slice(0);
        }
        schema = this.schemaUndoStack[this.pointer];
        return true;
    };
    UndoManager.MAX_UNDO_LEVELS = 8;
    return UndoManager;
}());
