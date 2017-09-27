/// <reference path="../model.ts"/>
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
describe("FileIO", function () {
    // Mock saving and loading a file, such that readFileAsText() returns the last object "saved" via saveFile.
    var savedFile;
    FileIO.saveFile = function (fileContents, onDownloadStartedHandler) {
        savedFile = fileContents;
    };
    FileIO.readFileAsText = function (file) {
        return new Promise(function (resolve) {
            var reader = new FileReader();
            reader.onloadend = function () { return resolve(reader.result); };
            reader.readAsText(savedFile);
        });
    };
    it("The mocked saveFile(file) should set savedFile to file", function () {
        var blob = new Blob(["test"]);
        FileIO.saveFile(blob);
        expect(savedFile).toBe(blob);
    });
    it("true should be equal to true", function () {
        expect(true).toBe(true);
    });
    it("true should not be equal to false", function () {
        expect(true).not.toBe(false);
    });
    it("should read the file just saved", function (done) {
        var blob = new Blob(["test"]);
        FileIO.saveFile(blob);
        FileIO.readFileAsText(undefined).then(function (out) {
            expect(out).toBe("test");
            done();
        });
    });
    it("should read the file just saved (sanity check version)", function (done) {
        var blob = new Blob(["test"]);
        FileIO.saveFile(blob);
        FileIO.readFileAsText(undefined).then(function (out) {
            expect(out).not.toBe("different_text");
            done();
        });
    });
});
