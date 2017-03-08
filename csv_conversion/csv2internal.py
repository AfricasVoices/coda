import argparse
import unicodecsv
import os
import random

decoOutputOrder = ["schemeId", "schemeName", "deco_codeValue", "deco_codeId", "deco_confidence", "deco_manual", "deco_timestamp", "deco_author"]
nonDecoOutput = ["id", "owner", "data", "timestamp"]

parser = argparse.ArgumentParser()
parser.add_argument("file", help="filepath of the dataset file")
parser.add_argument("senderIdCol", help="name of column header containing sender ID")
parser.add_argument("dataCol", help="name of column header containing message text")

parser.add_argument("--messageIdCol", help="name of column header containing unique message ID - if not given, new IDs will be generated during conversion")
parser.add_argument("--timestamp", help="name of column header containing message timestamps")
parser.add_argument("--schemeHeaders", help="list of names of headers for each coding scheme", nargs="+")
args = parser.parse_args()

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

                schemeIds = random.sample(xrange(32, len(headerStringsForNewFile["decorations"]) * 100),
                                          len(headerStringsForNewFile["decorations"]))
                schemes = {headerStringsForNewFile["decorations"][i]:
                               {"id": str(schemeIds[i]), "codes": {}, "code-order": []}
                           for i in range(len(schemeIds))}

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
                                    schemes[deco]["codes"][code] = schemes[deco]["id"] + "-" + str(len(schemes[deco]["codes"]) + 1)
                                    schemes[deco]["code-order"].append(code)

                        for name, schemeObj in schemes.iteritems():
                            # ["schemeId", "schemeName", "deco_codeValue", "deco_codeId", "deco_confidence", "deco_manual", "deco_timestamp", "deco_author"]
                            outputDict["schemeId"] = schemeObj["id"]
                            outputDict["schemeName"] = name
                            outputDict["deco_codeValue"] = row[name]
                            outputDict["deco_codeId"] = "" if len(row[name]) == 0 else schemeObj["codes"][row[name]]
                            outputDict["deco_confidence"] = ""
                            outputDict["deco_manual"] = ""
                            outputDict["deco_timestamp"] = ""
                            outputDict["deco_author"] = ""

                            if len(outputDict) > 0 and len(row[name]) > 0:
                                writer.writerow(outputDict)
                        rowCount += 1

                except UnicodeDecodeError as dec:
                    print "Can't decode line #%d as unicode!" % rowCount

            with open(os.path.join(dir_path, fileName + "-internal.csv"), "r") as myFile:
                lines = myFile.readlines()
            with open(os.path.join(dir_path, fileName + "-internal.csv"), "w") as myFile:
                lines[-1] = lines[-1].strip()
                myFile.writelines([item for item in lines if len(item) > 0])


        else:
            parser.error("Error: wrong sender ID column name was given - \"%s\" not found in "
                         "currently loaded file." % args.senderIdCol)