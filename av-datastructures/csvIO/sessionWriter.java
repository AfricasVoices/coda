import java.io.*;
import java.util.*;
import java.util.stream.Collectors;

public class sessionWriter {
    // TODO naming - separate class for writing sessions vs events or separate methods

    private static final String separator = ";";
    private Writer writer;
    private List<Session> sessions;
    private Set<String> columnNames;

    sessionWriter(List<Session> sessions, String fp) throws FileNotFoundException {
        OutputStream output = new FileOutputStream(new File(fp));
        this.writer = new OutputStreamWriter(output);
        this.sessions = sessions;
        this.columnNames = extractColumnNames();
    }

    boolean updateLines(List<String> linesToUpdate) {
        return true;
    }

    Set<String> extractColumnNames() {
        Set<String> columns = new TreeSet<>(); // want to keep ID in first column?

        // pick session with most decorators/most events to produce first row
        // alternatively, could keep a list of all decorators...

        if (sessions.size() > 0) {
            Comparator<Session> compareSessionDecorators = (session1, session2) ->
                    Integer.compare(session1.getAllDecorationNames().size(), session2.getAllDecorationNames().size());
            Comparator<Session> compareSessionEvents = (session1, session2) ->
                    Integer.compare(session1.getAllEventNames().size(), session2.getAllEventNames().size());

            sessions.stream()
                    .sorted(compareSessionDecorators.reversed())
                    .findFirst().ifPresent(session -> {
                columns.add(session.getId());
                session.getAllDecorationNames().forEach(columns::add);
            });

            sessions.stream()
                    .sorted(compareSessionEvents.reversed())
                    .findFirst().ifPresent(session -> {
                session.getAllEventNames().forEach(columns::add);
            });

        }
        return columns;
    }
}

    /*
    boolean writeFile() {
        try (PrintWriter writer = new PrintWriter(this.writer)) {
            String firstRow = String.join(",", new ArrayList<>(this.columnNames));
            writer.write(firstRow);

    TODO

        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }


}
*/