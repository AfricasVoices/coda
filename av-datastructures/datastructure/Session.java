import java.util.*;
import java.util.stream.Collectors;

public class Session {

    private String id;
    private List<RawEvent> events;
    private Map<String, SessionDecoration> decorations;


    Set<String> getAllDecorationNames() {
        Set<String> names = new HashSet<>();
        for (RawEvent e : events) {
            names.addAll(e.getDecorations().keySet());
        }
        return names;
    }

    Set<String> getAllEventNames() {
        Set<String> names = events.stream().map(RawEvent::getName).collect(Collectors.toSet()); // whoa Java 8 :D
        return names;
    }

    Iterator<RawEventDecoration> eventDecorationsForName(String decorationName) {
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
}
