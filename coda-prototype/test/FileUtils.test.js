/// <reference path="../src/io/FileUtils.ts"/>
/// <reference path="../model.ts""/>
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
describe("FileUtils", () => {
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
    it("should save and load a simple multi-code scheme", done => {
        let inScheme = new CodeScheme("27", "Scheme1", false);
        inScheme.codes.set("27-4", new Code(inScheme, "27-4", "Code 1", "#ff0000", "96", false));
        inScheme.codes.set("27-9", new Code(inScheme, "27-9", "Code 2", "#ff00ff", "97", false));
        inScheme.codes.set("27-5", new Code(inScheme, "27-5", "Code 3", "#ffff00", "98", false));
        inScheme.codes.set("27-7", new Code(inScheme, "27-7", "Code 4", "#00ff00", "99", false));
        FileUtils.saveCodeScheme(inScheme);
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            expect(inScheme).toEqual(outScheme);
            done();
        }, error => done.fail(error));
    });
    it("should save and load a multi-code scheme with regexes", done => {
        let inScheme = new CodeScheme("27", "Scheme1", false);
        inScheme.codes.set("27-4", new Code(inScheme, "27-4", "Code 1", "#ff0000", "96", false));
        inScheme.codes.set("27-9", new Code(inScheme, "27-9", "Code 2", "#ff00ff", "97", false, [".*", "gi"]));
        inScheme.codes.set("27-5", new Code(inScheme, "27-5", "Code 3", "#ffff00", "98", false, [".*", "g"]));
        inScheme.codes.set("27-7", new Code(inScheme, "27-7", "Code 4", "#00ff00", "99", false, [".*", "i"]));
        FileUtils.saveCodeScheme(inScheme);
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            expect(inScheme).toEqual(outScheme);
            done();
        }, error => done.fail(error));
    });
    it("should save and load a multi-code scheme with custom words", done => {
        let inScheme = new CodeScheme("27", "Scheme1", false);
        let code1 = new Code(inScheme, "27-4", "Code 1", "#ff0000", "96", false);
        let code2 = new Code(inScheme, "27-9", "Code 2", "#ff00ff", "97", false, [".*", "g"]);
        let code3 = new Code(inScheme, "27-5", "Code 3", "#ffff00", "98", false, [".*", "g"]);
        let code4 = new Code(inScheme, "27-7", "Code 4", "#00ff00", "99", false, [".*", "g"]);
        code1.addWords(["some", "test", "words"]);
        code2.addWords([]);
        code3.addWords(["abc"]);
        inScheme.codes.set("27-4", code1);
        inScheme.codes.set("27-9", code2);
        inScheme.codes.set("27-5", code3);
        inScheme.codes.set("27-7", code4);
        FileUtils.saveCodeScheme(inScheme);
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            inScheme.codes.forEach(code => delete code._isEdited); // TODO: Understand what Code._isEdited is needed for.
            outScheme.codes.forEach(code => delete code._isEdited);
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
    it("should fail if a multi-code scheme has codes with the same code id", done => {
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
