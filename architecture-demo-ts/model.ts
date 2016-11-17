let ENDING_PATTERN : string = "_";

class Dataset {
    sessions : Map<string, Session> = new Map<string, Session>();
    schemes : {};

    getAllEventDecorationNames() {
        var decorations = new Set();
        this.sessions.forEach((session: Session, sessionKey: string, map: Map<string,Session>) => {
            session.events.forEach((event:RawEvent, index: number, eventArr: Array<RawEvent>) => {
                //decorations.add(...event.decorationNames());
            });
        });

        decorations.delete(undefined); // to handle empty decorations
        return decorations;
    }
}

class RawEvent {
    name : string; // TODO: label for question this event is answering OR label to mark it's not a direct answer to anything?
    timestamp: string;
    number : string; // phone number or other kind of identifier
    data : string;
    decorations : Map<string, RawEventDecoration>;
    codes: Map<string, Code>;

    constructor(name : string, timestamp : string, number : string, data : string) {
        this.name = name;
        this.timestamp = timestamp;
        this.number = number;
        this.data = data;
        this.decorations = new Map<string, RawEventDecoration>();
        this.codes = new Map<string, Code>(); // string is code scheme id

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

  decorate(decorationName : string, decorationValue : string, decorationColor? : string) {
      if (decorationColor) {
          this.decorations.set(decorationName, new ColoredEventDecoration(this, decorationName, decorationValue, decorationColor));
      } else {
          this.decorations.set(decorationName, new RawEventDecoration(this, decorationName, decorationValue));
      }
  }

  decorationForName(name : string) : RawEventDecoration {
      return this.decorations.get(name);
  }

  decorationNames() : Array<string> {
      return Array.from(this.decorations.keys());
  }
}

class RawEventDecoration {
  owner : RawEvent;
  name : String;
  value : String;

  constructor(owner : RawEvent, name : String, value : String) {
      this.owner = owner;
      this.name = name;
      this.value = value;
  }
}

class ColoredEventDecoration extends RawEventDecoration {
    color : String;

    constructor(owner : RawEvent, name : String, value : String, color : String) {
        super(owner, name, value);
        this.color = color;
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

    var names : Set<string> = new Set<string>();

    for (let e of this.events) {
      for (var key in e.decorations) {
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
        var newScheme : CodeScheme = new this(original["id"], original["name"], false);

        newScheme.codes = new Map<string,Code>();

        original.codes.forEach(function(code: Code) {
            newScheme.codes.set(code.id, Code.clone(code));
        });

        return newScheme;
    }

    getShortcuts() : Set<string> {
        let shortcuts : Set<string> = new Set<string>();
        this.codes.forEach(function(code: Code) {
            shortcuts.add(code.shortcut);
        });
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

    set words(value: Array<string>) {
        this._words = value;
        this._isEdited = true;
    }


    static clone(original : Code) : Code {
        var newCode = new Code(original["_owner"], original["_id"], original["_value"], original["_color"], original["_shortcut"], false);
        newCode._words = original["_words"].slice(0);
        return newCode;
    }

}