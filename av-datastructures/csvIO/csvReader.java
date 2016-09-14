import java.io.*;
import java.util.*;
import java.util.stream.Collectors;

public class csvReader {

    private static final String separator = ";"; // Excel on Mac does this for csv
    private final Reader reader;
    private List<String> columns;

    csvReader(String fp) throws IOException {
        this.reader = new InputStreamReader(new FileInputStream(new File(fp)));
    }

    Map<String, List<RawEvent>> getSessions() throws IOException {
        BufferedReader reader = new BufferedReader(this.reader);
        String firstLine = reader.readLine();
        if (firstLine == null) {throw new IOException("File empty!");}
        columns = Arrays.asList(firstLine.split(separator));

        Map<String, List<RawEvent>> eventsBySession = reader.lines().skip(1L).map(rawLine -> rawLineToEvent(rawLine))
                .collect(Collectors.groupingBy(w -> w.getNumber()));

        List<Session> sessions = eventsBySession.keySet().stream().map(key -> new Session(key, eventsBySession.get(key))).collect(Collectors.toList());

        return eventsBySession;
    }

   RawEvent rawLineToEvent(String rawLine) {
        //TODO need some way of knowing at least which column names correspond to attributes VS decorations
        //TODO ideally be able to load in the map (column meanings --> namings)

        // here position 0: id, 1: raw message, 2: timestamp 3+: other(e.g. binary class membership)

       List<String> splitLine = Arrays.asList(rawLine.split(separator));
       Map<String, String> pairNameValue = new TreeMap<>();

       for (int i=0; i<splitLine.size(); i++) {
           pairNameValue.put(this.columns.get(i), splitLine.get(i));
       }

       RawEvent plainEvent = new RawEvent("",pairNameValue.get(columns.get(2)), pairNameValue.get(columns.get(0)));
       for (String key : pairNameValue.keySet()) {
           if (!key.equals(columns.get(0)) && !key.equals(columns.get(2))) {
               plainEvent.decorate(key, pairNameValue.get(key));
           }
       }

       return plainEvent;
    }

    public static void main(String[] args) {
        String fp = "./MobileForensics-lessCols.txt";
        try {
            csvReader reader = new csvReader(fp);
            Map<String, List<RawEvent>> map = reader.getSessions(); // file split by events

            System.out.println("Breakpoint :)");

        } catch (IOException e) {
            System.out.println("Helpful message");

        }

    }

}
