import java.util.Map;
import java.util.TreeMap;

public class RawEvent {

    private String name; // is this name supposed to mean things like answer to Q1? Can be used as column name?
    private final String timestamp;
    private String number; // phone number or other kind of identifier

    private final Map<String, RawEventDecoration> decorations; // TODO: string here is column name for decoration?

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

    public String getTimestamp() {
        return timestamp;
    }

    public String getNumber() {
        return number;
    }

    public Map<String, RawEventDecoration> getDecorations() {
        return decorations;
    }


}
