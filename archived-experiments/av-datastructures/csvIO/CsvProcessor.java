import java.io.*;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

public class CsvProcessor {

    private static final String separator = ";"; // Excel in my Mac locale uses ; as separator, will have to ask the user to say what to use
    private String inFP;
    private String outFP;
    private List<String> columns;
    private Dataset dataset = new Dataset();

    CsvProcessor(String inFP, String outFP) throws IOException {
        this.inFP = inFP;
        this.outFP = outFP;

    }

    public List<String> sortByValue(Map<String,Integer> map) {
        if (map==null) {
            return new ArrayList<String>();
        }
        return map.entrySet().stream()
                .sorted((e1,e2) -> Integer.compare(e1.getValue(), e2.getValue()))
                .map(e -> e.getKey()).collect(Collectors.toList());
    }

    public List<String> sortByKey(Map<Integer, String> map) {
        if (map==null) {
            return new ArrayList<String>();
        }
        return map.entrySet().stream()
                .sorted((e1,e2) -> Integer.compare(e1.getKey(), e2.getKey()))
                .map(e -> e.getValue()).collect(Collectors.toList());
    }

    void writeSessionsToFile(List<Session> sessions) throws IOException {
        BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(new File(this.outFP))));

        // TODO fix the hardcoded session column name(s) here
        Map<Integer,String> sessionColumns = new HashMap<>();
        sessionColumns.put(new Integer(1), "sessionID");
        this.dataset.setIndexToSessionColumnLabels(sessionColumns);

        Map<Integer,String> indexToColumn = this.dataset.getIndexToSessionColumnLabels();

        List<String> orderedColumns = indexToColumn.keySet().stream()
                .sorted().map(i -> indexToColumn.get(i)).collect(Collectors.toList());

        List<String> sortedEventNames = dataset.getEventNames().stream()
                .sorted(eventNameComparator)
                .collect(Collectors.toList());

        sortedEventNames.forEach(eventName -> {
            orderedColumns.add(eventName + "-timestamp");
            orderedColumns.addAll(sortByValue(dataset.getDecorationEventLabels()).stream().map(label -> eventName + "-" + label).collect(Collectors.toList()));

        });


        String firstRow = orderedColumns.stream().reduce((col1, col2) -> col1 + separator + col2).get();

        writer.write(firstRow);
        writer.newLine();

        List<String> orderedSessionRows = sessions.stream().sorted(Session.compareSessionByIdInt).map(session -> sessionToRow(session)).collect(Collectors.toList());
        for (String sessionRow : orderedSessionRows) {
            if (sessionRow.startsWith("4")) {
                System.out.println("ah");
            }
            writer.write(sessionRow);
            writer.newLine();
        }

        writer.flush();
        writer.close();

    }

    String sessionToRow(Session session) {

        List<String> sessionRow = new ArrayList<>();
        sessionRow.add(session.getId());

        if (dataset.getDecorationSessionLabels() != null) {
            sessionRow.addAll(dataset.getDecorationSessionLabels());
        } // TODO deal with ordering properly

        Map<String,RawEvent> nameToEvent = session.getEvents().stream().collect(Collectors.toMap(event -> event.getName(), event -> event));
        Map<Boolean, List<String>> a = dataset.getEventNames().stream().sorted(eventNameComparator).collect(Collectors.groupingBy(name -> session.getAllEventNames().contains(name)));
        dataset.getEventNames().sort(eventNameComparator);

        dataset.getEventNames().forEach(eventName -> {
            if (a.get(true).contains(eventName)) {
                sessionRow.add(eventToRow(nameToEvent.get(eventName)));
            } else {
                sessionRow.add("");
            }
        });

        //sessionRow.addAll(session.getEvents().stream().map(event -> eventToRow(event)).collect(Collectors.toList()));
        return sessionRow.stream().collect(Collectors.joining(separator));
    }

    Comparator<String> eventNameComparator = (name1, name2) ->
        Integer.compare(Integer.parseInt(name1.substring(name1.indexOf("_")+1, name1.length())),
                Integer.parseInt(name2.substring(name2.indexOf("_")+1, name2.length())));

    Comparator<RawEvent> eventByNameComparator = (event1, event2) -> {
        String name1 = event1.getName();
        String name2 = event2.getName();
        return eventNameComparator.compare(name1, name2);
    };


    String eventToRow(RawEvent event) {
        ArrayList<String> eventRow = new ArrayList<>();
        List<String> decorationsOrdered = dataset.getDecorationEventLabels().entrySet().stream()
                .sorted((e1,e2) -> Integer.compare(e1.getValue(), e2.getValue())).map(entry -> entry.getKey()).collect(Collectors.toList());

        //TODO Still need some sort of mapping between RawEvent and Session members and string names for them

        Map<String,RawEventDecoration> eventDecorations = event.getDecorations();
        IntStream.range(0, decorationsOrdered.size()).forEach(index -> {
            if (eventDecorations.containsKey(decorationsOrdered.get(index))) {
                eventRow.add(index, eventDecorations.get(decorationsOrdered.get(index)).getValue());
            } else {
                eventRow.add(index,"");
            }
// TODO not entirely convinced this always works
        });

        return event.getTimestamp() + separator + eventRow.stream().collect(Collectors.joining(separator));
    }


    List<Session> extractSessionsFromEventFile() throws IOException {

        BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(new File(this.inFP))));
        String firstLine = reader.readLine();
        if (firstLine == null) {throw new IOException("File empty!");}
        columns = Arrays.asList(firstLine.split(separator));

        /*this.nonDecorationColumns = IntStream.range(0, columns.size())
                .filter(columnIndex -> columns.get(columnIndex).endsWith(nonDecorators.ENDING_PATTERN))
                .mapToObj(columnIndex -> new Integer(columnIndex))
                .collect(Collectors.toMap(columnIndex -> columns.get(columnIndex.intValue()), columnIndex -> columnIndex));
*/

        dataset.setIndexToEventColumnLabels(IntStream.range(0, columns.size())
                .mapToObj(columnIndex -> new Integer(columnIndex))
                .collect(Collectors.toMap(columnIndex -> columnIndex, columnIndex -> columns.get(columnIndex.intValue()))));



        Map<Boolean, List<Integer>> nonDecoratorColumns = IntStream.range(0, columns.size())
                .mapToObj(Integer::new)
                .collect(Collectors.groupingBy(columnIndex -> columns.get(columnIndex.intValue()).endsWith(nonDecorators.ENDING_PATTERN)));

        dataset.setNonDecorationEventLabels(nonDecoratorColumns.get(true).stream().collect(Collectors.toMap(columnIndex -> columns.get(columnIndex.intValue()), columnIndex -> columnIndex)));
        dataset.setDecorationEventLabels(nonDecoratorColumns.get(false).stream().collect(Collectors.toMap(columnIndex -> columns.get(columnIndex.intValue()), columnIndex -> columnIndex)));



        Map<String, List<RawEvent>> eventsBySession = reader.lines().skip(1L).map(rawLine -> rawLineToEvent(rawLine))
                .collect(Collectors.groupingBy(event -> event.getNumber()));

        // somewhat hacky way of coming up with event names...
        eventsBySession.entrySet().stream().map(entry -> {
            List<RawEvent> events = entry.getValue();
            for (int i = 0; i<entry.getValue().size(); i++)
                events.get(i).setName("event_" + i);
                return entry;}).collect(Collectors.toSet());

        List<Session> sessionList = eventsBySession.keySet().stream().map(sessionID -> new Session(sessionID, eventsBySession.get(sessionID))).collect(Collectors.toList());
        sessionList.stream().sorted((s1,s2) -> -Integer.compare(s1.getAllEventNames().size(), s2.getAllEventNames().size())).findFirst().ifPresent(session -> {
            dataset.setEventNames(session.getAllEventNames().stream().collect(Collectors.toList()));
        });


        reader.close();

        return sessionList;
    }


/*

TODO

    List<Session> extractFromSessionFile() throws IOException {

        BufferedReader reader = new BufferedReader(this.reader);
        String firstLine = reader.readLine();
        if (firstLine == null) {throw new IOException("File empty!");}
        columns = Arrays.asList(firstLine.split(separator));

        Map<String, List<RawEvent>> eventsBySession = reader.lines().skip(1L).map(rawLine -> rawLineToEvent(rawLine))
                .collect(Collectors.groupingBy(w -> w.getNumber()));

        List<Session> sessionList = eventsBySession.keySet().stream().map(sessionID -> new Session(sessionID, eventsBySession.get(sessionID))).collect(Collectors.toList());

        return sessionList;
    }

    Session rawLineToSession(String rawLine) {

        return new Session("","","");

    }

    */

   RawEvent rawLineToEvent(String rawLine) {
        //TODO need some way of knowing at least which column names correspond to attributes VS decorations
        //TODO ideally be able to load in the map (column meanings --> namings)

        // here position 0: id, 1: raw message, 2: timestamp 3+: other(e.g. binary class membership)

       List<String> splitLine = Arrays.asList(rawLine.split(separator));
       Map<String, String> pairNameValue = new TreeMap<>();

       for (int i=0; i<splitLine.size(); i++) {
           pairNameValue.put(this.columns.get(i), splitLine.get(i));
       }


       RawEvent plainEvent = new RawEvent("",pairNameValue.get(columns.get(2)), pairNameValue.get(columns.get(0))); // TODO: what is event name
       for (String decorationName : pairNameValue.keySet()) {
           if (!decorationName.equals(columns.get(0)) && !decorationName.equals(columns.get(2))) {
               plainEvent.decorate(decorationName, pairNameValue.get(decorationName));
           }
       }

       return plainEvent;
    }


    public static void main(String[] args) {
        // ask for non-decorator columns on command line
        // non-decorators: ID-equivalent, raw-text


        String inFP = "./MobileForensics-lessCols.txt";
        String outFP = "./MobileForensics-lessCols-mod.csv";

        try {
            CsvProcessor reader = new CsvProcessor(inFP, outFP);
            List<Session> sessions = reader.extractSessionsFromEventFile(); // file split by events
            reader.writeSessionsToFile(sessions);

        } catch (FileNotFoundException e) {
            e.printStackTrace();
        } catch (IOException e) {
            e.printStackTrace();
        }

    }

}
