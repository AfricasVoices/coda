
class SessionDecoration {

    private Session owner;

    private String name;

    private String value;

    public String getName() {
        return name;
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }

    public SessionDecoration(Session owner, String name, String value) {
        this.owner = owner;
        this.name = name;
        this.value = value;
    }

}
