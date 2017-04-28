'''
Copyright (c) 2017 Coda authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
'''

import argparse
import unicodecsv
import os
import random

decoOutputOrder = ["schemeId", "schemeName", "deco_codeValue", "deco_codeId", "deco_confidence", "deco_manual", "deco_timestamp", "deco_author"]
nonDecoOutput = ["id", "owner", "data", "timestamp"]
schemeHeader = ["scheme_id", "scheme_name", "code_id", "code_value"]


def unpack_scheme_file(fp):
    with open(fp, mode="rb") as raw_file:
        hstrip = [h.strip() for h in raw_file.next().split(';')]
        scheme_header = dict([(h.strip(), True) for h in hstrip])
        scheme_reader = unicodecsv.DictReader(raw_file, delimiter=";", fieldnames=hstrip)

        header_iscorrect = True
        for h in schemeHeader:
            if h not in scheme_header:
                header_iscorrect = False

        scheme = {}
        if header_iscorrect:
            for code_row in scheme_reader:
                if "scheme_id" not in scheme and len(code_row["scheme_id"]) > 0:
                    scheme["scheme_id"] = code_row["scheme_id"]
                if "codes" not in scheme:
                    scheme["codes"] = {}
                if "code-order" not in scheme:
                    scheme["code-order"] = []

                scheme["codes"][code_row["code_value"]] = code_row["code_id"]
                scheme["code-order"].append(code_row["code_value"])

        if len(scheme["scheme_id"]) == 0 or len(scheme["codes"]) == 0:
            return {}
        else:
            return scheme


parser = argparse.ArgumentParser()
parser.add_argument("file", help="filepath of the dataset file")
parser.add_argument("senderIdCol", help="name of column header containing sender ID")
parser.add_argument("dataCol", help="name of column header containing message text")

parser.add_argument("--messageIdCol", help="name of column header containing unique message ID - if not given, new IDs will be generated during conversion")
parser.add_argument("--timestamp", help="name of column header containing message timestamps")
parser.add_argument("--schemeHeaders", help="list of names of headers for each coding scheme", nargs="+")
args = parser.parse_args()

schemeFiles = {}
if args.schemeHeaders and len(args.schemeHeaders) > 0:
    schemeFilesExist = raw_input("Do you have existing coding scheme files for this dataset? (Y/N)")

    if schemeFilesExist == "Y" or schemeFilesExist == "y":
        print "Great! For each given scheme header give the path of the coding scheme file or press enter to skip.\n"
        for header in args.schemeHeaders:
            schemeFiles[header] = raw_input("Give the filepath for the \"%s\" coding scheme or press enter to skip:\ny" % header)


with open(args.file, "rb") as raw_file:
    hs = [h.strip() for h in raw_file.next().split(';')]
    header = dict([(h.strip(), True) for h in hs])
    reader = unicodecsv.DictReader(raw_file, delimiter=";", fieldnames=hs)
    headerStringsForNewFile = {}
    generateNewIds = False
    schemes = {}
    dir_path = os.path.dirname(os.path.realpath(args.file))

    if len(headerStringsForNewFile) == 0:
        if args.messageIdCol and (args.messageIdCol in header):
            headerStringsForNewFile["id"] = args.messageIdCol
        else:
            generateNewIds = True
            headerStringsForNewFile["id"] = ""

        if args.senderIdCol in header:
            headerStringsForNewFile["owner"] = args.senderIdCol

            if args.dataCol in header:
                headerStringsForNewFile["data"] = args.dataCol

                headerStringsForNewFile["timestamp"] = ""
                if args.timestamp:
                    if args.timestamp in header:
                        headerStringsForNewFile["timestamp"] = args.timestamp
                    else:
                        print "Warning: wrong timestamp column name was given - \"%s\" not found in " \
                              "currently loaded file." % args.timestamp
                if args.schemeHeaders:
                    headerStringsForNewFile["decorations"] = []

                    for schemeCol in args.schemeHeaders:
                        if schemeCol in header:
                            headerStringsForNewFile["decorations"].append(schemeCol)
                        else:
                            print "Warning: wrong coding scheme column name was given - \"%s\" not found in " \
                                  "currently loaded file." % schemeCol

            else:
                parser.error("Error: wrong message text column name was given - \"%s\" not found in "
                             "currently loaded file." % args.dataCol)

            fileName = os.path.splitext(args.file)[0]
            with open(os.path.join(dir_path, fileName + "-internal.csv"), "wb") as out:
                header = nonDecoOutput + decoOutputOrder
                dialect = unicodecsv.excel
                dialect.delimiter = ";"
                writer = unicodecsv.DictWriter(out, fieldnames=header, dialect=dialect)
                writer.writeheader()

                pre_schemes = {}
                for scheme_name, scheme_path in schemeFiles.iteritems():
                    if len(scheme_path) > 0:
                        if os.path.isfile(scheme_path):
                            unpackedScheme = unpack_scheme_file(scheme_path)
                            if len(unpackedScheme) > 0:
                                pre_schemes[scheme_name] = unpackedScheme
                        else:
                            print scheme_name, ", ", scheme_path
                            print "WARNING: Not a valid file given for scheme \"%s\" at path \"%s\"" % (scheme_name, scheme_path)

                schemeIds = random.sample(xrange(32, len(headerStringsForNewFile["decorations"]) * 100),
                                          len(headerStringsForNewFile["decorations"]) - len(schemes))
                remaining_schemes = {headerStringsForNewFile["decorations"][i]:
                               {"scheme_id": str(schemeIds[i]), "codes": {}, "code-order": []}
                           for i in range(len(schemeIds)) if headerStringsForNewFile["decorations"][i] not in pre_schemes}

                schemes = remaining_schemes.copy()
                schemes.update(pre_schemes)

                outputDict = {}
                rowCount = 0

                try:
                    for row in reader:
                        for h1 in nonDecoOutput:
                            # non-deco header
                            if len(headerStringsForNewFile[h1]) > 0:
                                outputDict[h1] = row[headerStringsForNewFile[h1]]
                            else:
                                if h1 == "id":
                                    outputDict[h1] = rowCount
                        for deco in headerStringsForNewFile["decorations"]:
                            # deco header part
                            if deco in row and len(row[deco]) > 0:
                                code = row[deco]
                                if code not in schemes[deco]["codes"]:
                                    schemes[deco]["codes"][code] = schemes[deco]["scheme_id"] + "-" + str(len(schemes[deco]["codes"]) + 1)
                                    schemes[deco]["code-order"].append(code)

                        for name, schemeObj in schemes.iteritems():
                            # ["schemeId", "schemeName", "deco_codeValue", "deco_codeId", "deco_confidence", "deco_manual", "deco_timestamp", "deco_author"]
                            outputDict["schemeId"] = schemeObj["scheme_id"]
                            outputDict["schemeName"] = name
                            outputDict["deco_codeValue"] = row[name]
                            outputDict["deco_codeId"] = "" if len(row[name]) == 0 else schemeObj["codes"][row[name]]
                            outputDict["deco_confidence"] = ""
                            outputDict["deco_manual"] = ""
                            outputDict["deco_timestamp"] = ""
                            outputDict["deco_author"] = ""

                            if len(outputDict) > 0:
                                writer.writerow(outputDict)
                        rowCount += 1

                except UnicodeDecodeError as dec:
                    print "Can't decode line #%d as unicode!" % rowCount

            with open(os.path.join(dir_path, fileName + "-internal.csv"), "r") as myFile:
                lines = myFile.readlines()
            with open(os.path.join(dir_path, fileName + "-internal.csv"), "w") as myFile:
                lines[-1] = lines[-1].strip()
                myFile.writelines([item for item in lines if len(item) > 0])

            print "SUCCESS: Converted the csv, stored at %s" % os.path.join(dir_path, fileName + "-internal.csv")

        else:
            parser.error("Error: wrong sender ID column name was given - \"%s\" not found in "
                         "currently loaded file." % args.senderIdCol)