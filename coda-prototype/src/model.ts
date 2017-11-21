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

var storage: StorageManager;
var undoManager: UndoManager;
var newDataset;
var activity = [];
const VALID_NAME_FORMAT = /(^[a-zA-Z0-9]+([" "]?[a-zA-Z0-9])*)([/\-_][a-zA-Z0-9]+([" "]?[a-zA-Z0-9])*)*$/;


(function initMap() {

    let mapToJSON = function () {
        let keys = this.keys();
        let obj = Object.create(null); // create object that doesn't inherit from Object - want 0 inherited props as used for Map
        for (let k of keys) {
            obj[k] = this.get(k);
        }

        return obj;
    };

    Object.defineProperty(Map.prototype, "toJSON", {value: mapToJSON});

})();

class Dataset {
    // TODO: understand and document what each of these things does.
    sessions: Map<string, Session> = new Map();
    schemes = {}; // TODO: Why isn't this a map from string to CodeScheme??
    events: Map<string, RawEvent> = new Map();
    eventOrder: Array<string> = [];
    // TODO: Add a sort order property here? It makes sense for this to be in Dataset, which is where the sorting
    // TODO: functions and eventOrder property currently are.

    addEvent(event: RawEvent) {
        if (this.sessions.has(event.owner)) {
            let session = this.sessions.get(event.owner);
            // if (session.events.has(event.name)) {
            // TODO: In FileUtils.loadDataset (where this was refactored from), this was wrapped in the above if
            // TODO: statement. No idea why it was needed.
            session.events.set(event.name, event);
            // }
        } else {
            let session = new Session(event.owner, [event]);
            this.sessions.set(event.owner, session);
        }

        if (!this.events.has(event.name)) {
            this.eventOrder.push(event.name);
            // TODO: If there is a sort order property, set it to not-sorted.
        }

        this.events.set(event.name, event);
    }

    getScheme(schemeId: string): CodeScheme | undefined {
        return this.schemes[schemeId];
    }

    // TODO: This punches a hole in the getter/setter defences. Refactor users of this method such that
    // TODO: this method can be removed.
    getSchemes(): {} {
        return this.schemes;
    }

    hasScheme(schemeId: string): boolean {
        return this.schemes.hasOwnProperty(schemeId);
    }

    addScheme(scheme: CodeScheme) {
        this.schemes[scheme.id] = scheme;
    }

    getSchemeIds(): Array<string> {
        return Object.keys(this.schemes);
    }

    schemeCount(): number {
        return this.getSchemeIds().length;
    }

    getEvent(eventId: string): RawEvent | undefined {
        return this.events.get(eventId);
    }

    getEventAtPosition(i: number): RawEvent | undefined {
        let eventId = this.eventOrder[i];
        return this.getEvent(eventId);
    }

    getEventsInSortOrder(): Array<RawEvent | undefined> {
        return this.eventOrder.map(eventId => this.events.get(eventId));
    }

    getPositionForEvent(eventId: string): number | undefined {
        let position = this.eventOrder.indexOf(eventId);
        return position === -1 ? undefined : position;
    }

    eventCount(): number {
        // TODO: Once writing to private members has been implemented, check if this assert is still needed.
        // TODO: Currently using eventOrder.length of events.size only because the code this replaces used eventOrder.length
        console.assert(this.eventOrder.length === this.events.size);
        return this.eventOrder.length;
    }

    static validate(dataset: Dataset): boolean {
        let sessions = dataset.sessions;

        let sessionsObjValid = sessions && sessions instanceof Map;

        let sessionsHaveValidEntries = true;
        for (let session of sessions.values()) {
            if (!(session instanceof Session)) {
                sessionsHaveValidEntries = false;
            }
        }

        sessionsObjValid = sessionsObjValid && sessionsHaveValidEntries;

        let hasSchemes = dataset.schemes && Object.keys(dataset.schemes).length > 0 && dataset.schemes.constructor === Object;

        let events = dataset.events;
        let eventsObjValid = events && events instanceof Map;

        let eventsHaveValidEntries = true;
        for (let event of events.values()) {
            if (!(event instanceof RawEvent)) {
                eventsHaveValidEntries = false;
                console.log(event);
                console.log("Invalid event: not an instance of RawEvent");
            } else if (!sessions.has(event.owner)) {
                eventsHaveValidEntries = false;
                console.log("Invalid event: doesn't point to a valid Session");
            } else if (hasSchemes) {
                for (let deco of event.decorations.values()) {
                    // allow for undefined codes
                    if (deco.code && deco.code.owner != dataset.schemes[deco.code.owner.id]) {
                        eventsHaveValidEntries = false;
                        console.log("Invalid event: decoration doesn't point to a valid CodeScheme");
                    } else if (deco.code && deco.code != dataset.schemes[deco.code.owner.id].codes.get(deco.code.id)) {
                        eventsHaveValidEntries = false;
                        console.log("Invalid event: decoration doesn't point to a valid Code");
                    }
                }
            }
        }

        eventsObjValid = eventsObjValid && eventsHaveValidEntries;

        let hasEventOrder = dataset.eventOrder && dataset.eventOrder.length > 0;

        return sessionsObjValid && eventsObjValid && hasEventOrder && hasSchemes;
    }

    static clone(old: Dataset) {
        let newSchemes = {};

        // clone schemes
        Object.keys(old.schemes).forEach(scheme => {
            newSchemes[scheme] = CodeScheme.clone(old.schemes[scheme]);
        });

        let newSessions: Map<string, Session> = new Map();

        // clone events and redecorate them with newly created codes (from cloning the schemes above)
        let newEvents: Map<string, RawEvent> = new Map();
        for (let event of old.events.values()) {
            let newEvent: RawEvent = new RawEvent(event.name, event.owner, event.timestamp, event.number, event.data);
            for (let [schemeId, deco] of event.decorations.entries()) {
                let code = deco.code ? newSchemes[schemeId].codes.get(deco.code.id) : null;
                newEvent.decorate(schemeId, deco.manual, deco.author, code, deco.confidence, deco.timestamp);
            }
            newEvents.set(newEvent.name, newEvent);

            // clone sessions!
            if (!newSessions.has(event.owner)) {
                newSessions.set(event.owner, new Session(event.owner, [newEvent]));
            } else {
                // session obj already exists, so just add new event to it
                let session = newSessions.get(event.owner);
                session.events.set(newEvent.name, newEvent);
            }
        }

        let newEventOrder = old.eventOrder.slice();

        let clonedDataset = new Dataset();
        clonedDataset.events = newEvents;
        clonedDataset.sessions = newSessions;
        clonedDataset.schemes = newSchemes;
        clonedDataset.eventOrder = newEventOrder;

        return clonedDataset;

    }

    static areClones(d1: Dataset, d2: Dataset): boolean {

        function checkEvents(e1: Map<string, RawEvent>, e2: Map<string, RawEvent>): boolean {

            if (e1 == e2) {
                return true;
            }

            for (let [eventKey, eventObj] of e1) {
                if (eventObj == e2.get(eventKey)) {
                    return true;
                }

                for (let [decoKey, decoObj] of eventObj.decorations) {
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

        function checkSessions(s1: Map<string, Session>, s2: Map<string, Session>): boolean {
            if (s1 == s2) {
                return true;
            }

            for (let [sessionKey, sessionObj] of s1) {
                if (sessionObj == s2.get(sessionKey)) {
                    return true;
                }

                for (let [decoKey, decoObj] of sessionObj.decorations) {
                    if (decoObj == s2.get(sessionKey).decorations.get(decoKey)) {
                        return true;
                    }
                }

                for (let [eventKey, eventObj] of sessionObj.events) {
                    if (eventObj == s2.get(sessionKey).events.get(eventKey)) {
                        return true;
                    }
                }
            }

            return false;
        }

        function checkEventOrder(o1: Array<string>, o2: Array<string>): boolean {
            return o1 == o2;
        }

        function checkSchemes(s1, s2): boolean {

            // check scheme reference
            if (s1 == s2) {
                return true;
            }

            // check codes
            for (let [codeKey, codeObj] of s1.codes) {
                if (codeObj == s2.codes.get(codeKey)) {
                    return true;
                }
            }
            return false;
        }

        return checkEvents(d1.events, d2.events) && checkSessions(d1.sessions, d2.sessions) && checkEventOrder(d1.eventOrder, d2.eventOrder) && checkSchemes(d1.schemes, d2.schemes);

    }

    static restoreFromTypelessDataset(dataset): Dataset {
        function fixEventObjectProperties(eventToFix, schms, eventOwner: Session): RawEvent {

            // Ensure event decoration references are restored
            if (eventToFix.decorations instanceof Map) {
                console.log("Warning: event decorations are a Map.");
                for (let [key, deco] of eventToFix.decorations.entries()) {
                    let code = deco.code;
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
            } else {
                Object.keys(eventToFix.decorations).forEach(schemeKey => {
                    let code = eventToFix.decorations[schemeKey].code;
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
                let owner = eventToFix.owner;
                let session = eventOwner;
                if (session.events.has(eventToFix.name)) {
                    session.events.set(eventToFix.name, eventToFix);
                }
                return eventToFix;

            } else {
                let newEvent = new RawEvent(eventToFix.name, eventToFix.owner, eventToFix.timestamp, eventToFix.number, eventToFix.data, eventToFix.decorations);
                let owner = eventToFix.owner;
                let session = eventOwner;
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

        let restoredOrder = [];
        let restoredSchemes = {};
        let restoredSessions: Map<string, Session> = new Map();
        let restoredEvents: Map<string, RawEvent> = new Map();
        let restoredDataset = new Dataset();

        if (order) {
            restoredOrder = order.slice();
        }

        Object.keys(schemes).forEach(schemeKey => {
            // restore code scheme
            let scheme = schemes[schemeKey];
            if (scheme instanceof CodeScheme) {
                // should never happen
                console.log("Warning: scheme object is unexpectedly a CodeScheme obj.");
                console.log(scheme);
                console.log("------------");
                restoredSchemes[schemeKey] = scheme;
            } else {
                console.log("Is scheme key an integer? " + JSON.stringify(typeof scheme.id === 'number'));
                console.log(typeof schemeKey);
                restoredSchemes[schemeKey] = new CodeScheme(scheme.id, scheme.name, scheme.isNew, scheme.codes);
            }
        });

        Object.keys(sessions).forEach(sessionKey => {
            // restores sessions
            let session = sessions[sessionKey];
            restoredSessions.set(sessionKey, new Session(session.id, session.events));
        });


        let eventList = (events instanceof Map) ? Array.from(events.values()) : Object.keys(events).map(eventKey => events[eventKey]);
        if (!order) {
            eventList.forEach(eventObj => {
                let fixedEvent = fixEventObjectProperties(eventObj, restoredSchemes, restoredSessions.get(eventObj.owner));
                restoredEvents.set(eventObj.name, fixedEvent);
                restoredOrder.push(eventObj.name);
            });
        } else {
            order.forEach(eventKey => {
                let eventObj = (events instanceof Map) ? events.get(eventKey) : events[eventKey];
                let fixedEvent = fixEventObjectProperties(eventObj, restoredSchemes, restoredSessions.get(eventObj.owner));
                restoredEvents.set(eventKey, fixedEvent);
            });
        }

        restoredDataset.eventOrder = restoredOrder;
        restoredDataset.schemes = restoredSchemes;
        restoredDataset.sessions = restoredSessions;
        restoredDataset.events = restoredEvents;

        return restoredDataset;

    }

    setFields(sessions: Object, schemes: Object, events: Map<string, RawEvent>, order?: Array<string>): Dataset {
        /*
        Restores Dataset after loading from storage (which loses all type information)
         */

        console.log("sessions:" + (sessions instanceof Map));

        Object.keys(sessions).forEach(sessionKey => {
            // restores sessions
            let session = sessions[sessionKey];
            this.sessions.set(sessionKey, new Session(session.id, session.events));
        });
        Object.keys(schemes).forEach(schemeKey => {
            // restore code scheme
            let scheme = schemes[schemeKey];
            if (scheme instanceof CodeScheme) {
                // should never happen
                console.log("Warning: Scheme object is a CodeScheme! (should be plain Object)");
                this.schemes[schemeKey] = scheme;
            } else {
                this.schemes[schemeKey] = new CodeScheme(scheme.id, scheme.name, scheme.isNew, scheme.codes);
            }
        });

        if (order) {
            this.eventOrder = order.slice();
        }

        function fixEventObject(eventToFix, data: Dataset): RawEvent {
            /*
             Ensure decoration references are correct
             */
            if (eventToFix.decorations instanceof Map) {
                // shouldn't be reached
                console.log("Warning: Event decorations are a Map! (should be plain Object)");
                for (let [key, deco] of eventToFix.decorations.entries()) {
                    let code = deco.code;
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
            } else {
                Object.keys(eventToFix.decorations).forEach(schemeKey => {
                    let code = eventToFix.decorations[schemeKey].code;
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
                let owner = eventToFix.owner;
                let session = data.sessions.get(owner);
                if (session.events.has(eventToFix.name)) {
                    session.events.set(eventToFix.name, eventToFix);
                }
                return eventToFix;

            } else {
                let newEvent = new RawEvent(eventToFix.name, eventToFix.owner, eventToFix.timestamp, eventToFix.number, eventToFix.data, eventToFix.decorations);
                let owner = eventToFix.owner;
                let session = data.sessions.get(owner);
                if (session.events.has(eventToFix.name)) {
                    session.events.set(eventToFix.name, newEvent);
                }
                return newEvent;
            }
        }

        var schm = this.schemes;
        let newEventsObj: Map<string, RawEvent> = new Map();

        if (!order) {
            if (events instanceof Map) {
                console.log("instance map");
                for (let [key, event] of events.entries()) {
                    let fixedEvent = fixEventObject(event, this);
                    newEventsObj.set(key, fixedEvent);
                    this.eventOrder.push(fixedEvent.name);
                }
            } else {
                console.log("instance obj");
                Object.keys(events).forEach(eventKey => {
                    let fixedEvent = fixEventObject(events[eventKey], this);
                    newEventsObj.set(eventKey, fixedEvent);
                    this.eventOrder.push(fixedEvent.name);
                });
            }
        } else {
            order.forEach(eventKey => {
                if (events instanceof Map) {
                    newEventsObj.set(eventKey, fixEventObject(events.get(eventKey), this));
                } else {
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

    restoreDefaultSort(): Array<string> {

        this.eventOrder.sort((e1, e2) => {

            let name1, name2;

            let intParse1 = parseInt(this.events.get(e1).name, 10);
            let intParse2 = parseInt(this.events.get(e2).name, 10);

            if (isNaN(intParse1)) {
                name1 = this.events.get(e1).name.toLowerCase();
            } else {
                name1 = intParse1;
            }

            if (isNaN(intParse2)) {
                name2 = this.events.get(e2).name.toLowerCase();
            } else {
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

    }

    sortEventsByScheme(schemeId: string, isToDoList: boolean): Array<string> {

        schemeId = schemeId + ""; // force it to string todo: here or make sure decorationForName processes it ok?

        if ((this.schemes.hasOwnProperty && this.schemes.hasOwnProperty(schemeId)) || this.schemes[schemeId] != undefined) {
            let codes = Array.from(this.schemes[schemeId].codes.values()).map((code: Code) => {
                return code.value;
            });

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
                        let intParse1 = parseInt(e1.name);
                        let intParse2 = parseInt(e2.name);

                        let name1, name2;
                        if (isNaN(intParse1)) {
                            name1 = e1.name.toLowerCase();
                        } else {
                            name1 = intParse1;
                        }
                        if (isNaN(intParse2)) {
                            name1 = e2.name.toLowerCase();
                        } else {
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

                                let decoDifference = deco1.confidence - deco2.confidence;
                                if (decoDifference === 0) {
                                    let intParse1 = parseInt(e1.name);
                                    let intParse2 = parseInt(e2.name);

                                    let name1, name2;
                                    if (isNaN(intParse1)) {
                                        name1 = e1.name.toLowerCase();
                                    } else {
                                        name1 = intParse1;
                                    }
                                    if (isNaN(intParse2)) {
                                        name1 = e2.name.toLowerCase();
                                    } else {
                                        name1 = intParse2;
                                    }

                                    if (name1 < name2) {
                                        return -1;
                                    }
                                    if (name2 < name1) {
                                        return 1;
                                    }
                                    return 0;

                                } else {
                                    return decoDifference;
                                }
                            } else {
                                return 1;
                            }
                        } else if (typeof deco2.manual !== "undefined" && deco2.manual) {
                            return -1;
                        } else {
                            let decoDifference = deco1.confidence - deco2.confidence;
                            if (decoDifference === 0) {
                                let intParse1 = parseInt(e1.name);
                                let intParse2 = parseInt(e2.name);

                                let name1, name2;
                                if (isNaN(intParse1)) {
                                    name1 = e1.name.toLowerCase();
                                } else {
                                    name1 = intParse1;
                                }
                                if (isNaN(intParse2)) {
                                    name1 = e2.name.toLowerCase();
                                } else {
                                    name1 = intParse2;
                                }

                                if (name1 < name2) {
                                    return -1;
                                }
                                if (name2 < name1) {
                                    return 1;
                                }
                                return 0;

                            } else {
                                return decoDifference;
                            }
                        }

                    } else if (deco1.confidence == null && deco2.confidence == null) {

                        let intParse1 = parseInt(e1.name);
                        let intParse2 = parseInt(e2.name);

                        let name1, name2;
                        if (isNaN(intParse1)) {
                            name1 = e1.name.toLowerCase();
                        } else {
                            name1 = intParse1;
                        }
                        if (isNaN(intParse2)) {
                            name1 = e2.name.toLowerCase();
                        } else {
                            name1 = intParse2;
                        }

                        if (name1 < name2) {
                            return -1;
                        }
                        if (name2 < name1) {
                            return 1;
                        }
                        return 0;

                    } else if (deco1.confidence == null) {
                        return -1;
                    } else if (deco2.confidence == null) {
                        return 1;
                    }
                    // something went wrong and one item doesn't have a confidence!
                    else return 0;
                }

                // both have assigned codes that are different
                return code1 - code2; // todo sort ascending by index of code, which is arbitrary - do we enforce an order?

            });

        }
        return this.eventOrder;
    }

    sortEventsByConfidenceOnly(schemeId: string): Array<string> {

        schemeId = schemeId + ""; // force it to string todo: here or make sure decorationForName processes it ok?

        if ((this.schemes.hasOwnProperty && this.schemes.hasOwnProperty(schemeId)) || this.schemes[schemeId] != undefined) {

            this.eventOrder.sort((eventKey1, eventKey2) => {
                let returnResult = 0;

                var e1 = this.events.get(eventKey1);
                var e2 = this.events.get(eventKey2);
                let deco1 = e1.decorationForName(schemeId);
                let deco2 = e2.decorationForName(schemeId);

                if (deco1 == undefined && deco2 == undefined) {
                    let intParse1 = parseInt(e1.name);
                    let intParse2 = parseInt(e2.name);

                    let name1, name2;
                    if (isNaN(intParse1)) {
                        name1 = e1.name.toLowerCase();
                    } else {
                        name1 = intParse1;
                    }
                    if (isNaN(intParse2)) {
                        name1 = e2.name.toLowerCase();
                    } else {
                        name1 = intParse2;
                    }

                    if (name1 < name2) {
                        returnResult = -1;
                    }
                    if (name2 < name1) {
                        returnResult = 1;
                    }
                    returnResult = 0;
                } else if (deco1 == undefined) {
                    let hasManual2 = typeof deco2.manual !== "undefined" || deco2.manual != null;
                    if (hasManual2) returnResult = -1;
                    else {
                        let intParse1 = parseInt(e1.name);
                        let intParse2 = parseInt(e2.name);

                        let name1, name2;
                        if (isNaN(intParse1)) {
                            name1 = e1.name.toLowerCase();
                        } else {
                            name1 = intParse1;
                        }
                        if (isNaN(intParse2)) {
                            name1 = e2.name.toLowerCase();
                        } else {
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

                } else if (deco2 == undefined) {
                    let hasManual1 = typeof deco1.manual !== "undefined" || deco1.manual != null;
                    if (hasManual1) returnResult = 1;
                    else {
                        let intParse1 = parseInt(e1.name);
                        let intParse2 = parseInt(e2.name);

                        let name1, name2;
                        if (isNaN(intParse1)) {
                            name1 = e1.name.toLowerCase();
                        } else {
                            name1 = intParse1;
                        }
                        if (isNaN(intParse2)) {
                            name1 = e2.name.toLowerCase();
                        } else {
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

                } else {
                    let hasManual1 = typeof deco1.manual !== "undefined" || deco1.manual != null;
                    let hasManual2 = typeof deco2.manual !== "undefined" || deco2.manual != null;

                    if (hasManual1 && hasManual2) {

                        if (deco1.manual) {

                            if (deco2.manual) {
                                let intParse1 = parseInt(e1.name);
                                let intParse2 = parseInt(e2.name);

                                let name1, name2;
                                if (isNaN(intParse1)) {
                                    name1 = e1.name.toLowerCase();
                                } else {
                                    name1 = intParse1;
                                }
                                if (isNaN(intParse2)) {
                                    name1 = e2.name.toLowerCase();
                                } else {
                                    name1 = intParse2;
                                }

                                if (name1 < name2) {
                                    returnResult = -1;
                                }
                                if (name2 < name1) {
                                    returnResult = 1;
                                }
                                returnResult = 0;
                            } else {
                                // deco2 is before deco1, automatic always before manual
                                returnResult = 1
                            }
                        } else {
                            if (deco2.manual) {
                                // deco1 is before deco2, automatic always before manual
                                returnResult = -1;
                            } else {
                                //both are automatic in which case compare confidence!
                                let decoDifference = deco1.confidence - deco2.confidence;
                                if (decoDifference === 0) {
                                    let intParse1 = parseInt(e1.name);
                                    let intParse2 = parseInt(e2.name);

                                    let name1, name2;
                                    if (isNaN(intParse1)) {
                                        name1 = e1.name.toLowerCase();
                                    } else {
                                        name1 = intParse1;
                                    }
                                    if (isNaN(intParse2)) {
                                        name1 = e2.name.toLowerCase();
                                    } else {
                                        name1 = intParse2;
                                    }

                                    if (name1 < name2) {
                                        returnResult = -1;
                                    }
                                    if (name2 < name1) {
                                        returnResult = 1;
                                    }
                                    returnResult = 0;

                                } else {
                                    returnResult = decoDifference;
                                }
                            }
                        }
                    } else {

                        if (hasManual1 == hasManual2) {
                            // both are uncoded
                            let intParse1 = parseInt(e1.name);
                            let intParse2 = parseInt(e2.name);

                            let name1, name2;
                            if (isNaN(intParse1)) {
                                name1 = e1.name.toLowerCase();
                            } else {
                                name1 = intParse1;
                            }
                            if (isNaN(intParse2)) {
                                name1 = e2.name.toLowerCase();
                            } else {
                                name1 = intParse2;
                            }

                            if (name1 < name2) {
                                returnResult = -1;
                            }
                            if (name2 < name1) {
                                returnResult = 1;
                            }
                            returnResult = 0;
                        } else if (hasManual1) {
                            // uncoded e2 before coded e1
                            returnResult = 1;
                        } else if (hasManual2) {
                            // uncoded e1 before coded e2
                            returnResult = -1;
                        } else {
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
    }

    deleteScheme(schemeId: string): Array<string> {
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
    name: string;
    owner: string;
    timestamp: string;
    number: string; // phone number or other kind of numerical identifier
    data: string;
    decorations: Map<string, EventDecoration>;
    codes: Map<string, Code>;

    constructor(name: string, owner: string, timestamp: string, number: string, data: string, decorations?: Object | Map<string, EventDecoration>) {
        this.name = name;
        this.owner = owner;
        this.timestamp = timestamp;
        this.number = number;
        this.data = data;

        if (!decorations) {
            this.decorations = new Map<string, EventDecoration>(); // string is code scheme id
            this.codes = new Map<string, Code>(); // string is code scheme id todo not necessary?
        } else {
            if (!(decorations instanceof Map)) {
                let decors = new Map<string, EventDecoration>();
                let codes = new Map<string, Code>();
                Object.keys(decorations).forEach(decoKey => {
                    let d = decorations[decoKey];
                    let author = (d.author && d.author.length > 0) ? d.author : "";
                    decors.set(decoKey, new EventDecoration(this, d.scheme_id, d.manual, author, d.code, d.confidence, d.timestamp));
                    codes.set(d.scheme_id, d.code);
                });
                this.decorations = decors;
                this.codes = codes;
            } else {
                // decorations are a map already
            }
        }
    }

    static clone(oldEvent: RawEvent) {
        let newDecorations = new Map<string, EventDecoration>();
        for (let [key, deco] of newDecorations.entries()) {
            //newDecorations.set(key, EventDecoration.clone(deco, newEvent, ));
        }
        let newEvent = new RawEvent(oldEvent.name, oldEvent.owner, oldEvent.timestamp, oldEvent.number, oldEvent.data, newDecorations);
    }

    // todo refactor to not use codes just decorations

    codeForScheme(schemeId: string): Code {
        //return this.codes.get(schemeId);
        return this.decorations.get(schemeId).code;
    }

    schemeNames(): Array<string> {
        return Array.from(this.codes.keys()); // todo
    }

    assignedCodes(): Array<Code> {
        return Array.from(this.codes.values()); // todo
    }

    decorate(schemeId: string, manual: boolean, author: string, code?: Code, confidence?: number, timestamp?: string) {
        let stringSchemeId = "" + schemeId;
        this.decorations.set(stringSchemeId, new EventDecoration(this, stringSchemeId, manual, author, code, confidence, timestamp));
    }

    uglify(schemeId: string) {
        let deco = this.decorations.get(schemeId);
        if (deco && deco.code) {
            deco.code.removeEvent(this);
        }
        this.decorations.delete(schemeId);
        this.codes.delete(schemeId);

        return this;
    }

    decorationForName(schemeId: string): EventDecoration {
        return this.decorations.get(schemeId);
    }

    decorationNames(): Array<string> {
        return Array.from(this.decorations.keys());
    }

    isUncoded(schemeKeys: Array<string>): boolean {
        for (let schemeKey of schemeKeys) {
            let hasValidCode = this.decorations.has(schemeKey) && this.decorations.get(schemeKey).code;
            if (!hasValidCode) return true;
        }

        return false;
    }

    firstUncodedScheme(schemeKeyOrder: Array<string>): string {
        for (let schemeKey of schemeKeyOrder) {
            let hasValidCode = this.decorations.has(schemeKey) && this.decorations.get(schemeKey).code;
            if (!hasValidCode) return schemeKey;
        }
        return "";
    }


    toJSON(): {} {

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
    owner: RawEvent; // todo: makes it circular, fix to event id
    author: string; // uuid
    scheme_id: string; // will take scheme id
    private _code: Code;
    confidence: number;
    manual: boolean;
    private _timestamp: string;

    constructor(owner: RawEvent, id: string, manual: boolean, author: string, code?: Code | Object, confidence?: number, timestamp?: string) {
        this.owner = owner;
        this.scheme_id = id;
        this.manual = manual;
        this.author = author;

        (confidence == undefined) ? this.confidence = 0 : this.confidence = confidence;

        if (code) {

            if (code instanceof Code) {
                if (manual) code.addEvent(owner);
                this._timestamp = (timestamp) ? timestamp : new Date().toString();
                this._code = code;
            } else {
                // occurs when reading from storage... type is lost
                console.log(code);
                /*this._code = new Code(code.owner, code.id, code.value, code.color, code.shortcut, false);
                this._timestamp = timestamp ? timestamp : null;*/
            }

        } else {
            this._code = null; // TODO: this will require null pointer checks
            this._timestamp = null;
        }
    }

    static clone(oldDeco: EventDecoration, newOwner: RawEvent, newCode: Code) {
        return new EventDecoration(newOwner, oldDeco.scheme_id, oldDeco.manual, oldDeco.author, newCode, oldDeco.confidence, oldDeco.timestamp);
    }

    toJSON(): { owner: string; scheme_id: string; code: Code; confidence: number; manual: boolean; } {

        let obj = Object.create(null);

        obj.owner = this.owner.name;
        obj.scheme_id = this.scheme_id;
        obj.code = (this.code != null) ? {
            "id": this.code.id,
            "value": this.code.value,
            "owner": this.code.owner.id
        } : {};
        obj.confidence = this.confidence;
        obj.manual = this.manual;

        return obj;
    }

    changeCodeObj(code: Code) {
        this._code = code;
    }

    set code(code: Code) {
        this._timestamp = new Date().toString();
        this._code = code;
    }

    get code(): Code {
        return this._code;
    }

    get timestamp(): string {
        return this._timestamp;
    }
}

class Session {
    id: string;
    events: Map<string, RawEvent>;
    decorations: Map<string, SessionDecoration>;

    constructor(id: string, events: Array<RawEvent | string>) {
        this.id = id;
        this.events = new Map();
        events.forEach(eventObj => {
            if (typeof eventObj === "string") {
                this.events.set(eventObj, null);
            } else if (eventObj instanceof RawEvent) {
                this.events.set(eventObj.name, eventObj);
            }
        });
        this.decorations = new Map<string, SessionDecoration>();
    }

    decorate(decorationName: string, decorationValue: string, author?: string) {
        this.decorations.set(decorationName, new SessionDecoration(this, decorationName, decorationValue));
    }

    decorationForName(decorationName: string): SessionDecoration {
        return this.decorations.get(decorationName);
    }

    getAllDecorationNames(): Set<string> {

        let names: Set<string> = new Set<string>();

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

    getAllEventNames(): Set<string> {
        let eventNames: Set<string> = new Set<string>();
        for (let e of this.events.values()) {
            eventNames.add(e.name);
        }
        return eventNames;
    }
}

class SessionDecoration {
    owner: Session;
    name: String;
    value: String;

    constructor(owner: Session, name: string, value: string) {
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
    id: string;
    name: string;
    codes: Map<string, Code>;
    isNew: boolean;

    constructor(id: string, name: string, isNew: boolean, codes?: Object | Map<string, Code>) {
        this.id = id + "";
        this.name = name + "";
        if (!codes) {
            this.codes = new Map<string, Code>();
        } else {
            if (!(codes instanceof Map)) {
                let c = new Map<string, Code>();
                Object.keys(codes).forEach(codeId => {
                    let code = codes[codeId];
                    if (typeof code.owner == "string" || typeof code.owner == "number") {
                        code.owner = this;
                    }
                    c.set(codeId, new Code(code.owner, code.id, code.value, code.color, code.shortcut, false, code.regex));
                    c.get(codeId).addWords(code.words);
                });
                this.codes = c;
            }
        }
        this.isNew = isNew;
    }

    static validateName(name: string): boolean {
        if (name && typeof name == "string" && name.length < 50) {
            return VALID_NAME_FORMAT.test(name);
        }
        return false;

    }

    static validateScheme(scheme: CodeScheme): { "name", "invalidValues", "invalidShortcuts" } {
        let isNameValid = CodeScheme.validateName(scheme.name);
        let invalidValues = [];
        let invalidShortcuts = [];
        let allCodesValid = true;

        for (let code of scheme.codes.values()) {
            let parsedShortcut = parseInt(code.shortcut);
            var shortcutChar: string;

            if (code.shortcut.length === 0 || isNaN(parsedShortcut)) {
                shortcutChar = "";
            } else {
                shortcutChar = String.fromCharCode(parseInt(code.shortcut));
            }

            if (!Code.validateShortcut(shortcutChar)) {
                invalidShortcuts.push(code.id);
            }
            if (!Code.validateValue(code.value)) {
                invalidValues.push(code.id);
            }
        }
        return {"name": isNameValid, "invalidValues": invalidValues, "invalidShortcuts": invalidShortcuts};
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

    static clone(original: CodeScheme) {
        let newScheme: CodeScheme = new this(original["id"], original["name"], false);

        newScheme.codes = new Map<string, Code>();

        original.codes.forEach(function (code: Code) {
            newScheme.codes.set(code.id, Code.clone(code));
        });

        return newScheme;
    }

    duplicate(schemes: Array<string>): CodeScheme {

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

    copyCodesFrom(otherScheme: CodeScheme) {

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
                let code: Code = this.codes.get(codeId);
                code.value = otherCodeObj.value;
                code.words = otherCodeObj.words.slice(0);
                code.color = otherCodeObj.color;
                code.shortcut = otherCodeObj.shortcut;
                code.setRegexFromArray(otherCodeObj.regex);
            } else {
                this.codes.set(codeId, otherCodeObj);
            }
        }

    }

    getShortcuts(): Map<string, Code> {
        let shortcuts: Map<string, Code> = new Map<string, Code>();
        for (let code of Array.from(this.codes.values())) {
            if (code.shortcut.length !== 0) {
                shortcuts.set(code.shortcut, code);
            }
        }
        return shortcuts;
    }

    getCodeValues(): Set<string> {
        let values: Set<string> = new Set<string>();
        this.codes.forEach(function (code: Code) {
            values.add(code.value);
        });
        return values;
    }

    getCodeByValue(value: string): Code {

        let match;
        for (let code of Array.from(this.codes.values())) {
            if (code.value === value) {
                match = code;
                break;
            }
        }
        return match;
    }

    jsonForCSV(): { "fields": Array<string>; "data": Array<string>; } {

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

    private _owner: CodeScheme; // Code Scheme to which this code belongs
    private _id: string; // Unique identifier for this code
    private _value: string; // Code label, or name TODO: change name to "label"?
    private _color: string; // Color to highlight rows assigned to this code
    private _shortcut: string; // KeyCode of the shortcut key used to assign this code, //TODO: or...
    private _words: Array<string>; // List of words used to generate the words regex
    private _isEdited: boolean; // TODO: Remove this? Its only usage is (I think) in CodeScheme.duplicate
    private _eventsWithCode: Map<string, RawEvent>; // TODO: what is this for?
    private _regex: [string, string]; // Custom regex. Note that this never holds the auto-generated words regex.

    constructor(owner: CodeScheme, id: string, value: string, color: string, shortcut: string, isEdited: boolean, regex?: [string, string]) {
        this._owner = owner;
        this._id = id;
        this._value = value;
        this._color = color;
        this._shortcut = shortcut;
        this._words = [];
        this._isEdited = isEdited;
        this._eventsWithCode = new Map();

        if (regex && regex instanceof Array && regex.length === 2 && regex[0] && regex[0].length > 0) {
            try {
                // Validate the regex via the validation code in the RegExp constructor.
                new RegExp(regex[0], regex[1]);
                this._regex = regex;
            } catch (e) {
                console.log("Error: invalid regex passed to Code constructor. Error details:");
                console.log(e);
                this._regex = ["", ""];
            }
        } else {
            this._regex = ["", ""];
        }
    }

    get owner(): CodeScheme {
        return this._owner;
    }

    get id(): string {
        return this._id;
    }

    get value(): string {
        return this._value;
    }

    get color(): string {
        return this._color;
    }

    get shortcut(): string {
        return this._shortcut;
    }

    get words(): Array<string> {
        return this._words;
    }

    get isEdited(): boolean {
        return this._isEdited;
    }

    get eventsWithCode(): Map<string, RawEvent> {
        return this._eventsWithCode;
    }

    get regex(): [string, string] {
        return this._regex;
    }

    toJSON(): {
        owner: string, id: string, value: string, color: string, shortcut: string, words: Array<String>,
        regex: [string, string] | undefined
    } {

        let obj = Object.create(null);

        obj.owner = this.owner.id;
        obj.id = this.id;
        obj.value = this.value;
        obj.color = this.color;
        obj.shortcut = this.shortcut;
        obj.words = this.words;
        obj.regex = this.regex && this.regex[0].length > 0 ? this.regex : undefined;

        return obj;
    }

    set owner(value: CodeScheme) {
        this._owner = value;
    }

    set value(value: string) {
        this._value = value;
        this._isEdited = true;

    }

    set color(value: string) {
        this._color = value;
        this._isEdited = true;
    }

    set shortcut(value: string) {
        this._shortcut = value;
        this._isEdited = true;
    }

    set words(words: Array<string>) {
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

    static validateValue(name: string): boolean {
        if (name && typeof name == "string" && name.length < 50) {
            return VALID_NAME_FORMAT.test(name);
        }
        return false;
    }

    static validateShortcut(shortcut: string): boolean {
        // allow empty shortcut, but not an invalid character
        if (!shortcut || shortcut.length == 0) {
            return true;
        } else if (typeof shortcut == "string" && shortcut.length == 1) {
            return /^[a-z0-9]$/.test(shortcut);
        }

        return false;
    }

    addWords(words: Array<string>): Code {

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

    deleteWords(words: Array<string>): Code {
        for (let word of words) {
            let index = this._words.indexOf(word);
            if (index != -1) {
                this._words.splice(index, 1);
            }
        }
        return this;
    }

    static clone(original: Code): Code {
        let newCode = new Code(original["_owner"], original["_id"], original["_value"], original["_color"], original["_shortcut"], false, original["_regex"]);
        newCode._words = original["_words"].slice(0);
        return newCode;
    }

    static cloneWithCustomId(original: Code, newId: string) {
        let newCode = new Code(original["_owner"], newId, original["_value"], original["_color"], original["_shortcut"], false);
        newCode._words = original["_words"].slice(0);
        return newCode;
    }

    addEvent(event: RawEvent): void {
        // compare reference to event
        if (event && !this._eventsWithCode.has(event.name)) this._eventsWithCode.set(event.name, event);
    }

    removeEvent(event: RawEvent): void {
        this._eventsWithCode.delete(event.name);
    }

    setRegexFromRegExpObj(regExp: RegExp) {
        if (regExp && regExp instanceof RegExp) {
            this._regex = [regExp.source, regExp.flags];
        }
    }

    setRegexFromArray(regex: [string, string]) {
        if (regex && regex.length === 2) {
            this._regex = regex;
        }
    }

    clearRegex() {
        this._regex = ["", ""];
    }
}

// Services

class Watchdog {
    constructor() {
        console.log("Watchdog ctor");

        var f = this.tick;
        setInterval(function () {
            f()
        }, 500);
    }

    tick() {
        console.log("Watchdog tick");
    }
}


class UndoManager {

    static MAX_UNDO_LEVELS = 8;
    pointer: number = 0;
    modelUndoStack: Array<[Dataset, Array<string>]> = []; // IS INITIALIZED TO INITIAL DATASET VERSION!
    schemaUndoStack: Array<Schema> = [];

    markUndoPoint(codeSchemeOrder: Array<string>) {
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

        } else if (this.modelUndoStack.length % 2 === 0) {
            // save every second change to storage todo: do we need this kind of throttling
            storage.saveDataset(newDataset);
        }
    }

    canUndo(): boolean {
        return this.pointer != 0;
    }

    canRedo(): boolean {
        return this.pointer != this.modelUndoStack.length - 1 && this.modelUndoStack.length != 0;
    }

    undo(messageViewerManager: { "codeSchemeOrder" }): boolean {
        if (!this.canUndo()) return false;
        this.pointer--;
        newDataset = Dataset.clone(this.modelUndoStack[this.pointer][0]);
        if (this.modelUndoStack[this.pointer][1] && this.modelUndoStack[this.pointer][1].length !== 0) {
            messageViewerManager.codeSchemeOrder = this.modelUndoStack[this.pointer][1].slice(0);
        }
        schema = this.schemaUndoStack[this.pointer];
        return true;
    }

    redo(messageViewerManager: { "codeSchemeOrder" }): boolean {
        if (!this.canRedo()) return false;
        this.pointer++;
        newDataset = Dataset.clone(this.modelUndoStack[this.pointer][0]);
        if (this.modelUndoStack[this.pointer][1] && this.modelUndoStack[this.pointer][1].length !== 0) {
            messageViewerManager.codeSchemeOrder = this.modelUndoStack[this.pointer][1].slice(0);
        }
        schema = this.schemaUndoStack[this.pointer];
        return true;
    }
}
