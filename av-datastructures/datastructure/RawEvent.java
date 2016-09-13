import java.util.Map;

public class RawEvent {

    private String name;
    private int timestamp;
    private String number;

    private Map<String, RawEventDecoration> decorations;

    RawEvent(String name, int timestamp, String number) {
        this.name = name;
        this.timestamp = timestamp;
        this.number = number;
    }

    public String getName() {
        return name;
    }

    public int getTimestamp() {
        return timestamp;
    }

    public String getNumber() {
        return number;
    }

    public Map<String, RawEventDecoration> getDecorations() {
        return decorations;
    }


}
