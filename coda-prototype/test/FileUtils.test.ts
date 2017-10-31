/// <reference path="../src/io/FileUtils.ts"/>
/// <reference path="../src/model.ts"/>
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />

describe("FileUtils", () => {
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
        let inScheme = new CodeScheme("id0", "Scheme0", false);

        FileUtils.saveCodeScheme(inScheme);
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            expect(inScheme).toEqual(outScheme);
            done();
        }, done.fail);
    });

    it("should save and load a one-code scheme", done => {
        let inScheme = new CodeScheme("id-1", "Scheme1", false);
        inScheme.codes.set("code0", new Code(inScheme, "code0", "x", "#ff0000", "", false));

        FileUtils.saveCodeScheme(inScheme);
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            expect(inScheme).toEqual(outScheme);
            done();
        }, done.fail);
    });

    it("should save and load a single-code with semicolons in the scheme name", done => {
        let inScheme = new CodeScheme("id-1", "x;y", false);
        inScheme.codes.set("code0", new Code(inScheme, "code0", "x", "#ff0000", "", false));

        FileUtils.saveCodeScheme(inScheme);
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            expect(inScheme).toEqual(outScheme);
            done();
        }, done.fail);
    });

    it("should save and load a single-code scheme with custom words", done => {
        let inScheme = new CodeScheme("id-1", "Scheme1", false);
        let code = new Code(inScheme, "code", "x", "#ff0000", "", false);
        code.addWords(["some", "test", "words"]);
        inScheme.codes.set("code", code);

        FileUtils.saveCodeScheme(inScheme);
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            inScheme.codes.forEach(code => delete (<any>code)._isEdited);
            outScheme.codes.forEach(code => delete (<any>code)._isEdited);

            expect(inScheme).toEqual(outScheme);
            done();
        }, done.fail);
    });

    it("should save and load a single-code scheme with a custom regex", done => {
        let inScheme = new CodeScheme("id-1", "Scheme1", false);
        inScheme.codes.set("code0", new Code(inScheme, "code0", "x", "#ff0000", "", false, [".*", "i"]));

        FileUtils.saveCodeScheme(inScheme);
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            expect(inScheme).toEqual(outScheme);
            done();
        }, done.fail);
    });

    it("should save and load a multi-code scheme", done => {
        let inScheme = new CodeScheme("27", "Scheme1", false);
        let code1 = new Code(inScheme, "27-4", "Code 1", "#ff0000", "96", false);
        let code2 = new Code(inScheme, "27-9", "Code 2", "#ff00ff", "97", false, [".*", "g"]);
        let code3 = new Code(inScheme, "27-5", "Code 3", "#ffff00", "98", false, [".*", "i"]);
        let code4 = new Code(inScheme, "27-7", "Code 4", "#00ff00", "99", false, [".*", "gi"]);

        code1.addWords(["some", "test", "words"]);
        code2.addWords([]);
        code3.addWords(["abc"]);

        inScheme.codes.set("27-4", code1);
        inScheme.codes.set("27-9", code2);
        inScheme.codes.set("27-5", code3);
        inScheme.codes.set("27-7", code4);

        FileUtils.saveCodeScheme(inScheme);
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            inScheme.codes.forEach(code => delete (<any>code)._isEdited);
            outScheme.codes.forEach(code => delete (<any>code)._isEdited);

            expect(inScheme).toEqual(outScheme);
            done();
        }, done.fail);
    });

    it("should load a scheme with no regex column", done => {
        let inSchemeText =
            "scheme_id;scheme_name;code_id;code_value;code_colour;code_shortcut;code_words\n" +
            "66;scheme1;66-91;123;#ffffff;;\n" +
            "66;scheme1;66-79;456;#ffffff;;";

        let inScheme = new CodeScheme("66", "scheme1", false);
        let code1 = new Code(inScheme, "66-91", "123", "#ffffff", "", false);
        let code2 = new Code(inScheme, "66-79", "456", "#ffffff", "", false);
        inScheme.codes.set("66-91", code1);
        inScheme.codes.set("66-79", code2);

        FileUtils.saveFile(new Blob([inSchemeText]));
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            inScheme.codes.forEach(code => delete (<any>code)._isEdited);
            outScheme.codes.forEach(code => delete (<any>code)._isEdited);

            expect(inScheme).toEqual(outScheme);
            done();
        }, done.fail);
    });

    it("should load a multi-code scheme which has each shortcut variant", done => {
        // Note: need to use raw text here because saveCodeScheme does not support writing shortcuts as characters.
        let inSchemeText =
            "scheme_id;scheme_name;code_id;code_value;code_colour;code_shortcut;code_words;code_regex\n" +
            "66;scheme1;66-91;123;#ffffff;97;;\n" + // Variant: key code
            "66;scheme1;66-79;456;#ffffff;b;;\n" + // Variant: character
            "66;scheme1;66-80;789;#ffffff;;;"; // Variant: no shortcut

        FileUtils.saveFile(new Blob([inSchemeText]));

        let inScheme = new CodeScheme("66", "scheme1", false);
        inScheme.codes.set("66-91", new Code(inScheme, "66-91", "123", "#ffffff", "97", false));
        inScheme.codes.set("66-79", new Code(inScheme, "66-79", "456", "#ffffff", "98", false));
        inScheme.codes.set("66-80", new Code(inScheme, "66-80", "789", "#ffffff", "", false));

        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            expect(inScheme).toEqual(outScheme);
            done();
        }, done.fail);
    });

    it("should fail if a multi-code scheme has an inconsistent id", done => {
        let inScheme =
            "scheme_id;scheme_name;code_id;code_value;code_colour;code_shortcut;code_words;code_regex\n" +
            "66;scheme1;66-91;123;#ffffff;;;\n" +
            "67;scheme1;67-79;456;#ffffff;;;";

        FileUtils.saveFile(new Blob([inScheme]));
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            done.fail("An inconsistent scheme should have failed");
        }, error => {
            if (error.name === "CodeConsistencyError") done();
            else done.fail("Received an error, but it wasn't an expected CodeConsistencyError");
        });
    });

    it("should fail if a multi-code scheme has an inconsistent name", done => {
        let inScheme =
            "scheme_id;scheme_name;code_id;code_value;code_colour;code_shortcut;code_words;code_regex\n" +
            "66;scheme1;66-91;123;#ffffff;;;\n" +
            "66;scheme2;66-79;456;#ffffff;;;";

        FileUtils.saveFile(new Blob([inScheme]));
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            done.fail("An inconsistent scheme should have failed");
        }, error => {
            if (error.name === "CodeConsistencyError") done();
            else done.fail("Received an error, but it wasn't an expected CodeConsistencyError");
        });
    });

    it("should fail if a multi-code scheme has codes with the same code id", done => {
        let inScheme =
            "scheme_id;scheme_name;code_id;code_value;code_colour;code_shortcut;code_words;code_regex\n" +
            "66;scheme1;66-91;123;#ffffff;;;\n" +
            "66;scheme1;66-91;456;#ffffff;;;";

        FileUtils.saveFile(new Blob([inScheme]));
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            done.fail("An inconsistent scheme should have failed");
        }, error => {
            if (error.name === "CodeConsistencyError") done(); 
            else done.fail("Received an error, but it wasn't an expected CodeConsistencyError");
        });
    });

    it("should fail with a ParseError if a scheme is not parseable", done => {
        let inScheme =
            "scheme_id;scheme_name;code_id;code_value;code_colour;code_shortcut;code_words;code_regex\n" +
            "66;scheme1;66-91;123;#ffffff;\n" +
            "66;scheme2;66-9ffff;;;";

        FileUtils.saveFile(new Blob([inScheme]));
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            done.fail("An inconsistent scheme should have failed");
        }, error => {
            if (error.name === "ParseError") done();
            else done.fail("Received an error, but it wasn't an expected ParseError");
        });
    });

    it("should fail with a NoValuesError if a scheme has valid column headings but no data", done => {
        let inScheme =
            "scheme_id;scheme_name;code_id;code_value;code_colour;code_shortcut;code_words;code_regex";

        FileUtils.saveFile(new Blob([inScheme]));
        FileUtils.loadCodeScheme(undefined).then(outScheme => {
            done.fail("A scheme file with no data should have failed");
        }, error => {
            if (error.name === "NoValuesError") done();
            else done.fail("Received an error, but it wasn't an expected NoValuesError");
        });
    });

    // TODO: What should happen if the file is missing some columns? Should we have tests for this?
    // TODO: I think in this case we should do "best effort". Some tests where columns are missing might be needed here.

    // TODO: Test saving/loading a dataset
    // it("should save and load an empty dataset", done => {
    //     let inDataset = new Dataset();
    //
    //     FileUtils.saveDataset(inDataset);
    //     FileUtils.loadDataset(undefined, "uuid-0").then(outDataset => {
    //         expect(inDataset).toEqual(outDataset);
    //         done();
    //     }, done.fail);
    // });

    // it("should validate an empty dataset?", done => {
    //     if (Dataset.validate(new Dataset())) {
    //         done();
    //     } else {
    //         done.fail();
    //     }
    // });
    //
    // it("dataset test", done => {
    //     let inDataset = new Dataset();
    //
    //     done.fail();
    //
    // });

    it("should save and load the default dataset", done => {
        Dataset.generateDefaultDataset("uuid-0", "test/sessions-numbered-100.json").then(inDataset => {
            console.log(Dataset.validate(inDataset));

            FileUtils.saveDataset(inDataset);
            FileUtils.loadDataset(undefined, "uuid-0").then(outDataset => {
                outDataset.events.forEach(
                    event => event.decorations.forEach()
                )

                expect(inDataset.events).toEqual(outDataset.events);
                done();
            }, done.fail);
        }, done.fail);
    });

    // it("should save and load a dataset which has one event", done => {
    //     let inDataset = new Dataset();
    // });
});
