import java.util.List;
import java.util.Map;

public class Dataset {

    // will assume that the order of nonDecorator indices follow the rule: ID, TIMESTAMP

    private Map<String, Integer> nonDecorationSessionLabels;
    private Map<String, Integer> nonDecorationEventLabels;

    private Map<String, Integer> decorationEventLabels;
    private List<String> decorationSessionLabels;

    // TODO something that holds all event names
    private List<String> eventNames;

    private Map<Integer, String> indexToSessionColumnLabels;
    private Map<Integer, String> indexToEventColumnLabels; // TODO not sure this needs to be a map


    public List<String> getDecorationSessionLabels() {
        return decorationSessionLabels;
    }

    public void addToDecorationSessionLabels(String decorationSessionLabels) {
        this.decorationSessionLabels.add(decorationSessionLabels);
    }

    public Map<String, Integer> getNonDecorationEventLabels() {
        return nonDecorationEventLabels;
    }

    public void setNonDecorationEventLabels(Map<String, Integer> nonDecorationEventLabels) {
        this.nonDecorationEventLabels = nonDecorationEventLabels;
    }

    public Map<Integer, String> getIndexToSessionColumnLabels() {
        return indexToSessionColumnLabels;
    }

    public void setIndexToSessionColumnLabels(Map<Integer, String> indexToSessionColumnLabels) {
        this.indexToSessionColumnLabels = indexToSessionColumnLabels;
    }

    public Map<Integer, String> getIndexToEventColumnLabels() {
        return indexToEventColumnLabels;
    }

    public void setIndexToEventColumnLabels(Map<Integer, String> indexToEventColumnLabels) {
        this.indexToEventColumnLabels = indexToEventColumnLabels;
    }

    public Map<String, Integer> getNonDecorationSessionLabels() {
        return nonDecorationSessionLabels;
    }

    public void setNonDecorationSessionLabels(Map<String, Integer> nonDecorationSessionLabels) {
        this.nonDecorationSessionLabels = nonDecorationSessionLabels;
    }

    public Map<String, Integer> getDecorationEventLabels() {
        return decorationEventLabels;
    }

    public void setDecorationEventLabels(Map<String,Integer> decorationEventLabels) {
        this.decorationEventLabels = decorationEventLabels;
    }

    public List<String> getEventNames() {
        return eventNames;
    }

    public void setEventNames(List<String> eventNames) {
        this.eventNames = eventNames;
    }

}
