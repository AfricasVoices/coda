
class RawEventDecoration {

    RawEvent owner;
    String name;
    String value;
    // TODO: List<> providence;

    public RawEvent getOwner() { return owner; }

    public String getName() { return name; }

    public String getValue() { return value; }


    RawEventDecoration(RawEvent owner, String name, String value) {
        this.owner = owner;
        this.name = name;
        this.value = value;
    }


}
