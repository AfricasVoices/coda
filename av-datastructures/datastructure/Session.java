import java.util.*;
import java.util.stream.Collectors;

public class Session {

    private final String id;

    private final List<RawEvent> events;
    private Map<String, SessionDecoration> decorations = new TreeMap<>();

    static Comparator<Session> compareSessionByIdString = (session1, session2) ->  session1.getId().compareTo(session2.getId());
    static Comparator<Session> compareSessionByIdInt = (session1, session2) ->  Integer.compare(Integer.parseInt(session1.getId()), Integer.parseInt(session2.getId()));


    public Session(String id, RawEvent event) {
        this.id = id;
        this.events = Arrays.asList(event);
    }

    public Session(String id, List<RawEvent> events) {
        this.id = id;
        this.events = events;
    }

    String getId() {
        return id;
    }

    boolean decorate(String decorationName, String decorationValue) {
        // TODO create 'empty' decoration if value is ""?
        this.decorations.put(decorationName, new SessionDecoration(this, decorationName, decorationValue));
        return true;
    }

    SessionDecoration decorationForName(String decorationName) {
        if (this.decorations.containsKey(decorationName)) {
            return decorations.get(decorationName);
        } else {
            return null;
        }
    }

    public List<RawEvent> getEvents() {
        return events;
    }

    Set<String> getAllDecorationNames() {
        Set<String> names = new HashSet<>();
        for (RawEvent e : events) {
            names.addAll(e.getDecorations().keySet());
        }
        return names;
    }

    Set<String> getAllEventNames() {
        Set<String> names = events.stream().map(RawEvent::getName).collect(Collectors.toSet());
        return names;
    }

    Iterator<RawEventDecoration> eventDecorationValuesForName(String decorationName) {
        List<RawEventDecoration> decorations = new ArrayList<>();
        for (RawEvent e : events) {
            if (e.getDecorations().containsKey(decorationName)) {
                decorations.add(e.getDecorations().get(decorationName));
            }
        }
        return decorations.iterator();
    }

    List<RawEvent> eventsForDecorationName(String decorationName) {
        List<RawEvent> events = new ArrayList<>();
        events = events.stream().filter(e -> e.getDecorations().containsKey(decorationName)).collect(Collectors.toList());

        return events;
    }

    // TODO: RENAMING DECORATORS

}
