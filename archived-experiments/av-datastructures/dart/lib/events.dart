class RawEvent {
  String name; // TODO: label for question this event is answering OR label to mark it's not a direct answer to anything?
  String timestamp;
  String number; // phone number or other kind of identifier
  String data;

  Map<String, RawEventDecoration> decorations = {};

  RawEvent(this.name, this.timestamp, this.number, this.data);

  void decorate(String decorationName, String decorationValue) {
    decorations[decorationName] = new RawEventDecoration(this, decorationName, decorationValue);
  }

  RawEventDecoration decorationForName(String name) => decorations[name];
}

class RawEventDecoration {
  RawEvent owner;
  String name;
  String value;

  RawEventDecoration(this.owner, this.name, this.value);
}
