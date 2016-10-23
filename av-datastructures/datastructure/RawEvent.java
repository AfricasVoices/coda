import java.util.Map;
import java.util.TreeMap;

public class RawEvent {

    private String name; // TODO: label for question this event is answering OR label to mark it's not a direct answer to anything?
    private final String timestamp;
    private String number; // phone number or other kind of identifier


    private Map<String, RawEventDecoration> decorations;

    RawEvent(String name, String timestamp, String number) {
        this.name = name;
        this.timestamp = timestamp;
        this.number = number;
        this.decorations = new TreeMap<>();
    }

    boolean decorate(String decorationName, String decorationValue) {
        // TODO create 'empty' decoration if value is ""?
        this.decorations.put(decorationName, new RawEventDecoration(this, decorationName, decorationValue));
        return true;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public String getNumber() {
        return number;
    }

    public Map<String, RawEventDecoration> getDecorations() {
        return decorations;
    }

    public RawEventDecoration decorationForName(String name) {
        if (this.decorations.containsKey(name)) {
            return decorations.get(name);
        }
        return null;
    }


}
