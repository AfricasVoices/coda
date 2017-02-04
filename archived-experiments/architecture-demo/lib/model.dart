import 'dart:convert';

class Model {
  Map<int, Map> _data = {};
  Schema schema;

  Map getDataRow(int rowID) {
    return _data[rowID];
  }

  setDataRow(int rowId, Map data) {
    _data[rowId] = data;
  }

  String serialise() {
    // Replace the index structures with strings
    Map<String, Map> serialiseData = {};
    _data.forEach((k, v) {
      serialiseData["$k"] = v;
    });

    return JSON.encode(serialiseData);
  }

  Model.fromData(String data) {
    Map<String, Map> serialisedData = JSON.decode(data);

    serialisedData.forEach((k, v) {
      _data[int.parse(k)] = v;
    });
  }

  Model.empty() { }
}

class Schema {
  List<SchemaEntry> codingSchemes; // Coding scheme in order of the cols

  Schema() {
    codingSchemes = [];
  }

  String serialise() {
    List schemaEntries = [];
    for (SchemaEntry se in codingSchemes) {
      schemaEntries.add(
        {"codingScheme" : se.codingScheme,
        "codes" : se.codes,
        "shortcuts" : se.shortcuts}
      );
    }
    return JSON.encode(schemaEntries);
  }

  Schema.fromString(String data) {
    var jsonData = JSON.decode(data);

    for (SchemaEntry se in jsonData) {
      SchemaEntry entry = new SchemaEntry(se.codingScheme, se.codes, se.shortcuts);
      codingSchemes.add(entry);
    }
  }
}

class SchemaEntry {
  String codingScheme;      // E.g. Sex
  List<String> codes;       // E.g. Female, Male
  List<String> shortcuts;    // E.g. F, M

  SchemaEntry(this.codingScheme, this.codes, this.shortcuts);
}
