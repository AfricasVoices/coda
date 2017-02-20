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

let ENDING_PATTERN : string = "_";

class Dataset {
    sessions: Array<Session> = [];
    schemes: {};
    events: Array<RawEvent> = [];

    getAllSessionIds() {
        return this.sessions.map(function (session: Session) {
            return session.id;
        });
    }

    /*
    NB: event names/ids are the initial indices when read from file for the first time!
    Once initialized, they aren't changed regardless of sorting and can be used to restore the default on-load ordering.
    */

    restoreDefaultSort() : Array<RawEvent> {

        this.events.sort((e1,e2) => {

           let name1 = parseInt(e1.name,10);
           let name2 = parseInt(e2.name,10);

           return name1-name2;

        });

        return this.events;

    }

    sortEventsByScheme(schemeId: string, isToDoList: boolean): Array<RawEvent> {

        schemeId = schemeId + ""; // force it to string todo: here or make sure decorationForName processes it ok?

        if ((this.schemes.hasOwnProperty && this.schemes.hasOwnProperty(schemeId)) || this.schemes[schemeId] != undefined) {
            let codes = Array.from(this.schemes[schemeId].codes.values()).map((code:Code) => {return code.value;});

            this.events.sort((e1, e2) => {

                const deco1 = e1.decorationForName(schemeId);
                const deco2 = e2.decorationForName(schemeId);
                const hasCode1 =  deco1 ? e1.decorationForName(schemeId).code != null : false;
                const hasCode2 = deco2 ? e2.decorationForName(schemeId).code != null : false;

                let code1 = hasCode1 ? codes.indexOf(e1.decorationForName(schemeId).code.value ) : -1;
                let code2 = hasCode2 ? codes.indexOf(e2.decorationForName(schemeId).code.value ) : -1;

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
                            } else {
                                return 1;
                            }
                        } else if (deco2.manual != undefined && deco2.manual) {
                            return -1;
                        } else {
                            return deco1.confidence - deco2.confidence || parseInt(e1.name) - parseInt(e2.name);
                        }

                    } else if (deco1.confidence == null && deco2.confidence == null) {
                        return parseInt(e1.name) - parseInt(e2.name);
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
        return this.events;
    }

    sortEventsByConfidenceOnly(schemeId: string) : Array<RawEvent> {

        schemeId = schemeId + ""; // force it to string todo: here or make sure decorationForName processes it ok?

        if ((this.schemes.hasOwnProperty && this.schemes.hasOwnProperty(schemeId)) || this.schemes[schemeId] != undefined) {
            let codes = Array.from(this.schemes[schemeId].codes.values()).map((code:Code) => {return code.value;});

            this.events.sort((e1, e2) => {

                let deco1 = e1.decorationForName(schemeId);
                let deco2 = e2.decorationForName(schemeId);

                if (deco1 == deco2 == undefined) {
                    return parseInt(e1.name) - parseInt(e2.name);
                }

                if (deco1 == undefined) {
                    return -1;
                }

                if (deco2 == undefined) {
                    return 1;
                }


                // always manual coding behind automatic!
                if (deco1.manual) {

                    if (deco2.manual) {
                        return parseInt(e1.name) - parseInt(e2.name);
                    }

                    // deco2 is before deco1
                    return 1;

                } else {
                    if (deco2.manual) {

                        // deco1 is before deco2
                        return -1;
                    }

                    //both are automatic in which case compare confidence!
                    return deco1.confidence - deco2.confidence || parseInt(e1.name, 10) - parseInt(e2.name, 10);
                }
            });
        }
        return this.events;
    }

    stringifyEvents(): string {




        return "";
    }

}

class RawEvent {
    name : string; // TODO: label for question this event is answering OR label to mark it's not a direct answer to anything?
    owner: string;
    timestamp: string;
    number : string; // phone number or other kind of identifier
    data : string;
    decorations : Map<string, EventDecoration>;
    codes: Map<string, Code>;

    constructor(name : string, owner : string, timestamp : string, number : string, data : string) {
        this.name = name;
        this.owner = owner;
        this.timestamp = timestamp;
        this.number = number;
        this.data = data;
        this.decorations = new Map<string, EventDecoration>(); // string is code scheme id
        this.codes = new Map<string, Code>(); // string is code scheme id todo not necessary?

    }

    // todo refactor to not use codes just decorations

    codeForScheme(schemeId : string) : Code {
        //return this.codes.get(schemeId);
        return this.decorations.get(schemeId).code;
    }

    schemeNames(): Array<string> {
        return Array.from(this.codes.keys());
    }

    assignedCodes(): Array<Code> {
        return Array.from(this.codes.values());
    }

    decorate(schemeId : string, manual: boolean, code? : Code, confidence?: number) {
       // if (this.decorations.has(schemeId)) this.uglify(schemeId);
        let stringSchemeId = "" + schemeId;
        this.decorations.set(stringSchemeId, new EventDecoration(this, stringSchemeId, manual, code, confidence));
    }

    uglify(schemeId: string) {
        let deco = this.decorations.get(schemeId);
        deco.code.removeEvent(this);
        this.decorations.delete(schemeId);
        this.codes.delete(schemeId);

        return this;
    }

    decorationForName(schemeId : string) : EventDecoration {
        return this.decorations.get(schemeId);
    }

    decorationNames() : Array<string> {
        return Array.from(this.decorations.keys());
    }

    /*
    toJSON() :{} {

        let obj = Object.create(null);
        obj.name = this.name;
        obj.timestamp = this.timestamp;
        obj.number = this.number;
        obj.data = this.data;
        obj.decorations =

    }
    */
}

class EventDecoration {
    owner : RawEvent; // todo: makes it circular, fix to event id

    scheme_id : String; // will take scheme id
    code : Code;
    confidence: number;
    manual: boolean;

    constructor(owner : RawEvent, id : String, manual: boolean, code?: Code, confidence?: number) {
        this.owner = owner;
        this.scheme_id = id;
        this.manual = manual;

        (confidence == undefined) ? this.confidence = 0 : this.confidence = confidence; // not sure this is a good idea

        if (code) {
            code.addEvent(owner);
            this.code = code;
        } else {
            this.code = null; // TODO: this will require null pointer checks
        }
    }

    toJSON() :  {owner: string; scheme_id: string; code: Code; confidence: number; manual: boolean;} {

        let obj = Object.create(null);

        obj.owner = this.owner.name;
        obj.scheme_id = this.scheme_id;
        obj.code = this.code.value;
        obj.confidence = this.confidence;
        obj.manual = this.manual;

        return obj;
    }
}

class Session {
  id : string;
  events : Array<RawEvent>;
  decorations : Map<string, SessionDecoration>;

  constructor(id : string, events : Array<RawEvent>) {
      this.id = id;
      this.events = events;
      this.decorations = new Map<string, SessionDecoration>();
  }

  decorate(decorationName : string, decorationValue : string) {
    this.decorations.set(decorationName, new SessionDecoration(this, decorationName, decorationValue));
  }

  decorationForName(decorationName : string) : SessionDecoration  {
      return this.decorations.get(decorationName);
    }

   getAllDecorationNames() : Set<string>{

    let names : Set<string> = new Set<string>();

    for (let e of this.events) {
      for (let key in e.decorations) {
          names.add(key);
      }
    }
    return names;
  }

  getAllEventNames() : Set<string>{
    let eventNames : Set<string> = new Set<string>();
    for (let e of this.events) {
      eventNames.add(e.name);
    }
    return eventNames;
  }
}

class SessionDecoration {
   owner : Session ;
   name : String;
   value : String;
   constructor(owner : Session, name : string, value : string) {
       this.owner = owner;
       this.name = name;
       this.value = value;
   }
}

class CodeScheme {
    id : string;
    name : string;
    codes : Map<String,Code>;
    isNew : boolean;

    constructor(id : string, name : string, isNew : boolean) {
        this.id = id;
        this.name = name;
        this.codes = new Map<string,Code>();
        this.isNew = isNew;
    }

    static clone(original : CodeScheme) {
        let newScheme : CodeScheme = new this(original["id"], original["name"], false);

        newScheme.codes = new Map<string,Code>();

        original.codes.forEach(function(code: Code) {
            newScheme.codes.set(code.id, Code.clone(code));
        });

        return newScheme;
    }

    copyCodesFrom(otherScheme : CodeScheme) {

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
                let code : Code = this.codes.get(codeId);
                code.value = otherCodeObj.value;
                code.words = otherCodeObj.words.slice(0); // todo take care to deep clone if necessary
                code.color = otherCodeObj.color;
                code.shortcut = otherCodeObj.shortcut;
            } else {
                this.codes.set(codeId, otherCodeObj);
            }
        }

    }

    getShortcuts() : Map<string, Code> {
        let shortcuts : Map<string, Code> = new Map<string, Code>();
        for (let code of Array.from(this.codes.values())) {
            if (code.shortcut.length !== 0) {
                shortcuts.set(code.shortcut, code);
            }
        }
        return shortcuts;
    }

    getCodeValues() : Set<string> {
        let values : Set<string> = new Set<string>();
        this.codes.forEach(function(code: Code) {
            values.add(code.value);
        });
        return values;
    }

    getCodeByValue(value: string) : Code {

        let match;
        for (let code of Array.from(this.codes.values())) {
            if (code.value === value) {
                match = code;
                break;
            }
        }
        return match;
    }

    jsonForCSV() : {"fields" : Array<string>; "data" : Array<string>;} {

        let obj = Object.create(null);
        obj["fields"] = ["id","name","code_id","code_value","code_colour","code_shortcut","words"];
        obj["data"] = [];

        for (let [codeId, code] of this.codes) {
            let codeArr = [this.id, this.name, codeId, code.value, code.color, code.shortcut, "[" + code.words.toString() + "]"];
            obj["data"].push(codeArr);
        }

        return obj;
    }

}

class Code {

    private _owner : CodeScheme;
    private _id: string;
    private _value : string;
    private _color : string;
    private _shortcut : string;
    private _words : Array<string>;
    private _isEdited : boolean;
    private _eventsWithCode: Array<RawEvent>;

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

    get eventsWithCode(): Array<RawEvent> {
        return this._eventsWithCode;
    }

    constructor(owner: CodeScheme, id: string, value: string, color: string, shortcut: string, isEdited: boolean) {
        this._owner = owner;
        this._id = id;
        this._value = value;
        this._color = color;
        this._shortcut = shortcut;
        this._words = [];
        this._isEdited = isEdited;
        this._eventsWithCode = [];
    }

    toJSON() : {owner: string, id:string, value:string, color:string, shortcut:string, words:Array<String>} {

        let obj = Object.create(null);

        obj.owner = this.owner.id;
        obj.id = this.id;
        obj.value = this.value;
        obj.color = this.color;
        obj.shortcut = this.shortcut;
        obj.words = this.words;

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

       words.sort(function(a, b){
            // DESC -> b.length - a.length
            return b.length - a.length || b.localeCompare(a);
        });

        this._words = words.filter(function(word, index) {
            return words.indexOf(word) === index;
        });

        this._isEdited = true;
    }

    addWords(words: Array<string>): Code {

        let newWords = this._words.concat(words);
        newWords.sort(function(a, b){
            // DESC -> b.length - a.length
            return b.length - a.length || b.localeCompare(a);
        });

        this._words = newWords.filter(function(word, index) {
            return newWords.indexOf(word) === index;
        });
        this._isEdited = true;

        return this;

    }

    deleteWords(words: Array<string>) : Code {
        for (let word of words) {
            let index = this._words.indexOf(word);
            if (index != -1) {
                this._words.splice(index,1);
            }
        }
        return this;
    }

    static clone(original : Code) : Code {
        let newCode = new Code(original["_owner"], original["_id"], original["_value"], original["_color"], original["_shortcut"], false);
        newCode._words = original["_words"].slice(0);
        return newCode;
    }

    addEvent(event: RawEvent): void {
        // compare reference to event
        if (this._eventsWithCode.indexOf(event) == -1) this._eventsWithCode.push(event);
    }

    removeEvent(event: RawEvent): void {
        let index = this._eventsWithCode.indexOf(event);
        if (index == -1) return;
        this._eventsWithCode.splice(index,1);
    }

    getEventsWithText(text: string) {
        return this._eventsWithCode.filter(event => {
            let decoration = event.decorationForName(this._owner.id);
            if (decoration == undefined) return false;
            return !decoration.manual && (event.data + "") === text});
    }
}