

let ENDING_PATTERN : string = "_";

class Dataset {
   sessions : Map<string, Session> = new Map<string, Session>();
}

class RawEvent {
  name : string; // TODO: label for question this event is answering OR label to mark it's not a direct answer to anything?
  timestamp: string;
  number : string; // phone number or other kind of identifier
  data : string;
  decorations : Map<string, RawEventDecoration>;

  constructor(name : string, timestamp : string, number : string, data : string) {
      this.name = name;
      this.timestamp = timestamp;
      this.number = number;
      this.data = data;
  }

  decorate(decorationName : string, decorationValue : string) {
    this.decorations[decorationName] = new RawEventDecoration(this, decorationName, decorationValue);
  }

  decorationForName(name : string) : RawEventDecoration {
      return this.decorations[name];
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
    this.decorations[decorationName] = new SessionDecoration(this, decorationName, decorationValue);
  }

  decorationForName(decorationName : string) : SessionDecoration  {
      return this.decorations[decorationName];
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
