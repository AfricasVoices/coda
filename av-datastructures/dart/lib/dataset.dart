import 'sessions.dart';

const List<String> NON_DECO = const ["ID", "NAME", "TIME", "RAWTEXT"];
const String ENDING_PATTERN = "_";

class Dataset {

  // will assume that the order of nonDecorator indices follow the rule: ID, TIMESTAMP

   Map<String, int> nonDecorationSessionLabels;
   Map<String, int> nonDecorationEventLabels;

   Map<String, int> decorationEventLabels;
   List<String> decorationSessionLabels;

  // TODO something that holds all event names
   List<String> eventNames;

   Map<int, String> indexToSessionColumnLabels;
   Map<int, String> indexToEventColumnLabels; // TODO not sure this needs to be a map

   Map<String, Session> sessions = {};
}
