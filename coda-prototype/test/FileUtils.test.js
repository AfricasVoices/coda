/// <reference path="../src/io/FileUtils.ts"/>
/// <reference path="../model.ts""/>
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
describe("FileUtils.test", () => {
    // Mock saving and loading a file, such that readFileAsText() returns the last object "saved" via saveFile.
    let savedFile;
    FileUtils.saveFile = function(fileContents, onDownloadStartedHandler) {
        savedFile = fileContents;
    };
    FileUtils.readFileAsText = function(file) {
        return new Promise(resolve => {
            let reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsText(savedFile);
        });
    };
    it("should 'mock' FileUtils.saveFile", () => {
        let blob = new Blob(["test"]);
        FileUtils.saveFile(blob);
        expect(savedFile).toBe(blob);
    });
    it("should 'mock' FileUtils.readAsText", done => {
        let blob = new Blob(["test"]);
        FileUtils.saveFile(blob);
        FileUtils.readFileAsText(undefined).then(out => {
            expect(out).toBe("test");
            done();
        });
    });
    it("should save and load a scheme which has no codes", done => {
        let inScheme = new CodeScheme("id-0", "Scheme0", false);
        FileUtils.saveCodeScheme(inScheme);
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            expect(inScheme).toEqual(outScheme);
            done();
        }, error => console.log(error));
    });
    it("should save and load a one-code scheme", done => {
        let inScheme = new CodeScheme("id-1", "Scheme1", false);
        inScheme.codes.set("code0", new Code(inScheme, "code0", "x", "#ff0000", "", false));
        FileUtils.saveCodeScheme(inScheme);
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            console.log(inScheme);
            console.log(outScheme);
            expect(inScheme).toEqual(outScheme);
            done();
        }, error => done.fail(error));
    });
    it("should save and load a multi-code scheme", done => {
        let inScheme = new CodeScheme("27", "Scheme1", false);
        inScheme.codes.set("27-4", new Code(inScheme, "27-4", "x", "#ff0000", "", false));
        FileUtils.saveCodeScheme(inScheme);
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            expect(inScheme).toEqual(outScheme);
            done();
        }, error => done.fail(error));
    });
    it("should fail if a multi-code scheme has an inconsistent id", done => {
        let inScheme = "scheme_id;scheme_name;code_id;code_value;code_colour;code_shortcut;code_words;code_regex\n" +
            "66;scheme1;66-91;123;#ffffff;;;\n" +
            "67;scheme1;67-79;456;#ffffff;;;";
        FileUtils.saveFile(new Blob([inScheme]));
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            done.fail("An inconsistent scheme should have failed");
        }, error => {
            if (error.name === "CodeConsistencyError")
                done();
            else
                done.fail("Received an error, but it wasn't an expected CodeConsistencyError");
        });
    });
    it("should fail if a multi-code scheme has an inconsistent name", done => {
        let inScheme = "scheme_id;scheme_name;code_id;code_value;code_colour;code_shortcut;code_words;code_regex\n" +
            "66;scheme1;66-91;123;#ffffff;;;\n" +
            "66;scheme2;66-79;456;#ffffff;;;";
        FileUtils.saveFile(new Blob([inScheme]));
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            done.fail("An inconsistent scheme should have failed");
        }, error => {
            if (error.name === "CodeConsistencyError")
                done();
            else
                done.fail("Received an error, but it wasn't an expected CodeConsistencyError");
        });
    });
    it("should fail if a multi-code scheme has codes with the same id", done => {
        let inScheme = "scheme_id;scheme_name;code_id;code_value;code_colour;code_shortcut;code_words;code_regex\n" +
            "66;scheme1;66-91;123;#ffffff;;;\n" +
            "66;scheme2;66-91;456;#ffffff;;;";
        FileUtils.saveFile(new Blob([inScheme]));
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            done.fail("An inconsistent scheme should have failed");
        }, error => {
            if (error.name === "CodeConsistencyError")
                done(); // TODO: Is this the desired error in this case, or do we need a new one?
            else
                done.fail("Received an error, but it wasn't an expected CodeConsistencyError");
        });
    });
});
