import 'events.dart';

class Session {
  final String id;
  List<RawEvent> events;
  Map<String, SessionDecoration> decorations = {};

  Session(this.id, this.events);

  decorate(String decorationName, String decorationValue) {
    decorations[decorationName] = new SessionDecoration(this, decorationName, decorationValue);
  }

  SessionDecoration decorationForName(String decorationName) => decorations[decorationName];

  Set<String> getAllDecorationNames() {
    Set<String> names = new Set<String>();
    for (RawEvent e in events) {
      names.addAll(e.decorations.keys);
    }
    return names;
  }

  Set<String> getAllEventNames() {
    Set<String> eventNames = new Set<String>();
    for (RawEvent e in events) {
      eventNames.add(e.name);
    }
    return eventNames;
  }

    // Iterator<RawEventDecoration> eventDecorationValuesForName(String decorationName) {
    //     List<RawEventDecoration> decorations = new ArrayList<>();
    //     for (RawEvent e : events) {
    //         if (e.getDecorations().containsKey(decorationName)) {
    //             decorations.add(e.getDecorations().get(decorationName));
    //         }
    //     }
    //     return decorations.iterator();
    // }
    //
    // List<RawEvent> eventsForDecorationName(String decorationName) {
    //     List<RawEvent> events = new ArrayList<>();
    //     events = events.stream().filter(e -> e.getDecorations().containsKey(decorationName)).collect(Collectors.toList());
    //
    //     return events;
    // }

    // TODO: RENAMING DECORATORS

}

class SessionDecoration {
   Session owner;
   String name;
   String value;
   SessionDecoration(this.owner, this.name, this.value);
}
