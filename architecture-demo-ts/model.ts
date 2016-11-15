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

    code(scheme: CodeScheme, value : string, color : string, shortcut : string) {
        var code = new Code(scheme, value, color, shortcut);
        this.codes.set(scheme.id, code);
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
    codes : Map<string, Code>;

    constructor(id : string, name : string) {
        this.id = id;
        this.name = name;
        this.codes = new Map<string, Code>();
    }

    static clone(original : CodeScheme) {
        var newScheme : CodeScheme = new this(original["id"], original["name"]);

        newScheme.codes = new Map<string, Code>();

        Array.from(original["codes"].entries()).forEach(([key,entry]) => {
            newScheme.codes.set(key, Code.clone(entry));
        });

        return newScheme;
    }

    getShortcuts() : Set<string> {
        let shortcuts : Set<string> = new Set<string>();
        this.codes.forEach((code: Code, id: string) => {
            shortcuts.add(code.shortcut);
        });
        return shortcuts;
    }

    getCodeValues() : Set<string> {
        let values : Set<string> = new Set<string>();
        this.codes.forEach((code: Code, id: string) => {
            values.add(code.value);
        });
        return values;
    }

    getCodeByValue(value: string) : Code {
        var codes = Array.from(this.codes.values());

        var match;

        for (let code of codes) {
            if (code.value === value) {
                match = code;
                break;
            }
        }
        /*
         codes.forEach(function(code, i) {
         if (code.value === value) match = code;
         return;
         });
         */


        return match;
    }
}

class Code {

    private _owner : CodeScheme;
    private _value : string;
    private _color : string;
    private _shortcut : string;
    private _words : Array<string>;
    private _edited : boolean;

    get owner(): CodeScheme {
        return this._owner;
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

    get edited(): boolean {
        return this._edited;
    }

    constructor(owner: CodeScheme, value: string, color: string, shortcut: string) {
        this._owner = owner;
        this._value = value;
        this._color = color;
        this._shortcut = shortcut;
        this._words = [];
        this._edited = false;
    }

    set owner(value: CodeScheme) {
        this._owner = value;
        this._edited = true;
    }

    set value(value: string) {
        this._value = value;
        this._edited = true;
    }

    set color(value: string) {
        this._color = value;
        this._edited = true;
    }

    set shortcut(value: string) {
        this._shortcut = value;
        this._edited = true;
    }

    set words(value: Array<string>) {
        this._words = value;
        this._edited = true;
    }

    setColor(color: string) {
        this._color = color;
        this._edited = true;
    }

    static clone(original : Code) : Code {
        var newCode = new Code(original["_owner"], original["_value"], original["_color"], original["_shortcut"]);
        newCode._words = original["_words"].slice(0);
        return newCode;
    }

}