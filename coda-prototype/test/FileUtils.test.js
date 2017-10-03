/// <reference path="../src/io/FileUtils.ts"/>
/// <reference path="../model.ts""/>
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
describe("FileUtils.test", function() {
    // Mock saving and loading a file, such that readFileAsText() returns the last object "saved" via saveFile.
    var savedFile;
    FileUtils.saveFile = function(fileContents, onDownloadStartedHandler) {
        savedFile = fileContents;
    };
    FileUtils.readFileAsText = function(file) {
        return new Promise(function (resolve) {
            var reader = new FileReader();
            reader.onloadend = function () { return resolve(reader.result); };
            reader.readAsText(savedFile);
        });
    };
    it("should 'mock' FileUtils.saveFile", function() {
        var blob = new Blob(["test"]);
        FileUtils.saveFile(blob);
        expect(savedFile).toBe(blob);
    });
    it("should 'mock' FileUtils.readAsText", function(done) {
        var blob = new Blob(["test"]);
        FileUtils.saveFile(blob);
        FileUtils.readFileAsText(undefined).then(function(out) {
            expect(out).toBe("test");
            done();
        });
    });
    it("should save and load a scheme which has no codes", function(done) {
        var inScheme = new CodeScheme("id-0", "Scheme0", false);
        FileUtils.saveCodeScheme(inScheme);
        FileUtils.loadCodeScheme(undefined).then(function(outScheme) {
            expect(inScheme).toEqual(outScheme);
            done();
        }, function(error) {
            return console.log(error);
        });
    });
    it("should save and load a one-code scheme", function(done) {
        var inScheme = new CodeScheme("id-1", "Scheme1", false);
        inScheme.codes.set("code0", new Code(inScheme, "code0", "x", "#ff0000", "", false));
        FileUtils.saveCodeScheme(inScheme);
        FileUtils.loadCodeScheme(undefined).then(function(outScheme) {
            expect(inScheme).toEqual(outScheme);
            done();
        }, function(error) {
            return done.fail(error);
        });
    });
    it("should save and load a multi-code scheme", function(done) {
        var inScheme = new CodeScheme("27", "Scheme1", false);
        inScheme.codes.set("27-4", new Code(inScheme, "27-4", "x", "#ff0000", "", false));
        FileUtils.saveCodeScheme(inScheme);
        FileUtils.loadCodeScheme(undefined).then(function(outScheme) {
            expect(inScheme).toEqual(outScheme);
            done();
        }, function(error) {
            return done.fail(error);
        });
    });
    it("should fail if a multi-code scheme has an inconsistent id", function(done) {
        var inScheme = "scheme_id;scheme_name;code_id;code_value;code_colour;code_shortcut;code_words;code_regex\n" +
            "66;scheme1;66-91;123;#ffffff;;;\n" +
            "67;scheme1;67-79;456;#ffffff;;;";
        FileUtils.saveFile(new Blob([inScheme]));
        FileUtils.loadCodeScheme(undefined).then(function(outScheme) {
            done.fail("An inconsistent scheme should have failed");
        }, function(error) {
            if (error.name === "CodeConsistencyError")
                done();
            else
                done.fail("Received an error, but it wasn't an expected CodeConsistencyError");
        });
    });
    it("should fail if a multi-code scheme has an inconsistent name", function(done) {
        var inScheme = "scheme_id;scheme_name;code_id;code_value;code_colour;code_shortcut;code_words;code_regex\n" +
            "66;scheme1;66-91;123;#ffffff;;;\n" +
            "66;scheme2;66-79;456;#ffffff;;;";
        FileUtils.saveFile(new Blob([inScheme]));
        FileUtils.loadCodeScheme(undefined).then(function(outScheme) {
            done.fail("An inconsistent scheme should have failed");
        }, function(error) {
            if (error.name === "CodeConsistencyError")
                done();
            else
                done.fail("Received an error, but it wasn't an expected CodeConsistencyError");
        });
    });
    it("should fail if a multi-code scheme has codes with the same id", function(done) {
        var inScheme = "scheme_id;scheme_name;code_id;code_value;code_colour;code_shortcut;code_words;code_regex\n" +
            "66;scheme1;66-91;123;#ffffff;;;\n" +
            "66;scheme2;66-91;456;#ffffff;;;";
        FileUtils.saveFile(new Blob([inScheme]));
        FileUtils.loadCodeScheme(undefined).then(function(outScheme) {
            done.fail("An inconsistent scheme should have failed");
        }, function(error) {
            if (error.name === "CodeConsistencyError")
                done(); // TODO: Is this the desired error in this case, or do we need a new one?
            else
                done.fail("Received an error, but it wasn't an expected CodeConsistencyError");
        });
    });
});
