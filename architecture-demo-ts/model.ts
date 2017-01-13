let ENDING_PATTERN : string = "_";

class Dataset {
    sessions : Array<Session> = [];
    schemes : {};

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
        return this.sessions.map(function(session:Session) {return session.id;});
    }
}

class RawEvent {
    name : string; // TODO: label for question this event is answering OR label to mark it's not a direct answer to anything?
    timestamp: string;
    number : string; // phone number or other kind of identifier
    data : string;
    decorations : Map<string, EventDecoration>;
    codes: Map<string, Code>;

    constructor(name : string, timestamp : string, number : string, data : string) {
        this.name = name;
        this.timestamp = timestamp;
        this.number = number;
        this.data = data;
        this.decorations = new Map<string, EventDecoration>(); // string is code scheme id
        this.codes = new Map<string, Code>(); // string is code scheme id todo not necessary?

    }

    codeForScheme(schemeId : string) : Code {
        return this.codes.get(schemeId);
    }

    schemeNames(): Array<string> {
        return Array.from(this.codes.keys());
    }

    assignedCodes(): Array<Code> {
        return Array.from(this.codes.values());
    }

    decorate(schemeId : string, code? : Code) {
        let stringSchemeId = "" + schemeId;
        this.decorations.set(stringSchemeId, new EventDecoration(this, stringSchemeId, code));
    }

    uglify(schemeId: string) {
        this.decorations.delete(schemeId);
        this.codes.delete(schemeId);
    }

    decorationForName(name : string) : EventDecoration {
        return this.decorations.get(name);
    }

    decorationNames() : Array<string> {
        return Array.from(this.decorations.keys());
    }
}

class EventDecoration {
  owner : RawEvent;
  scheme_id : String; // will take scheme id
  code : Code;

  constructor(owner : RawEvent, id : String, code?: Code) {
      this.owner = owner;
      this.scheme_id = id;

      if (code) {
          this.code = code;
      } else {
          this.code = null; // TODO: this will require null pointer checks
      }
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
                code.words = otherCodeObj.words.slice(0); // take care to clone
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

    private _owner : CodeScheme;
    private _id: string;
    private _value : string;
    private _color : string;
    private _shortcut : string;
    private _words : Array<string>;
    private _isEdited : boolean;

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

    constructor(owner: CodeScheme, id: string, value: string, color: string, shortcut: string, isEdited: boolean) {
        this._owner = owner;
        this._id = id;
        this._value = value;
        this._color = color;
        this._shortcut = shortcut;
        this._words = [];
        this._isEdited = isEdited;
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

        let newWords = this._words.concat(words);
        newWords.sort();
        this._words = newWords.filter(function(word, index) {
            return newWords.indexOf(word) === index;
        });
        this._isEdited = true;
    }

    deleteWords(words: Array<string>) : void {
        for (let word of words) {
            let index = this._words.indexOf(word);
            if (index != -1) {
                this._words.splice(index,1);
            }
        }
    }

    static clone(original : Code) : Code {
        let newCode = new Code(original["_owner"], original["_id"], original["_value"], original["_color"], original["_shortcut"], false);
        newCode._words = original["_words"].slice(0);
        return newCode;
    }

}