/// <reference path="../src/io/FileUtils.ts"/>
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />

describe("FileUtils.test", () => {
    // Mock saving and loading a file, such that readFileAsText() returns the last object "saved" via saveFile.
    let savedFile;
    FileUtils.saveFile = function (fileContents: Blob, onDownloadStartedHandler ?: (downloadId: number) => void) {
        savedFile = fileContents;
    };
    FileUtils.readFileAsText = function (file: File): Promise<string> {
        return new Promise<string>(resolve => {
            let reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsText(savedFile);
        });
    };

    it("The mocked saveFile(file) should set savedFile to file", () => {
        let blob = new Blob(["test"]);
        FileUtils.saveFile(blob);
        expect(savedFile).toBe(blob);
    });

    it("true should be equal to true", () => {
        expect(true).toBe(true);
    });

    it("true should not be equal to false", () => {
        expect(true).not.toBe(false);
    });

    it("should read the file just saved", done => {
        let blob = new Blob(["test"]);
        FileUtils.saveFile(blob);
        FileUtils.readFileAsText(undefined).then(out => {
            expect(out).toBe("test");
            done();
        });
    });

    it("should read the file just saved (sanity check version)", done => {
        let blob = new Blob(["test"]);
        FileUtils.saveFile(blob);
        FileUtils.readFileAsText(undefined).then(out => {
            expect(out).not.toBe("different_text");
            done();
        });
    });
});