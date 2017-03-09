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

nonDecoOutput = ["id", "owner", "data", "timestamp"]

parser = argparse.ArgumentParser()
parser.add_argument("file", help="filepath of the dataset file to convert")
parser.add_argument("--senderIdCol", help="name of column header containing sender ID")
parser.add_argument("--dataCol", help="name of column header containing message text")

parser.add_argument("--messageIdCol", help="name of column header containing unique message ID")
parser.add_argument("--timestamp", help="name of column header containing message timestamps")
args = parser.parse_args()

with open(args.file, "rb") as raw_file:
    hs = [h.strip() for h in raw_file.next().split(';')]
    header = dict([(h.strip(), True) for h in hs])

    missingHeaders = []
    for h in nonDecoOutput:
        if h not in header:
            missingHeaders.append(h)

    if len(missingHeaders) > 0:
        print "ERROR: Wrong format, missing columns: " + ", ".join(missingHeaders)

    else:
        reader = unicodecsv.DictReader(raw_file, delimiter=";", fieldnames=hs)
        headerStringsForNewFile = {}
        schemeIds = {}
        schemes = []
        dir_path = os.path.dirname(os.path.realpath(args.file))

        if args.senderIdCol:
            headerStringsForNewFile["owner"] = args.senderIdCol
        else:
            headerStringsForNewFile["owner"] = "sender"

        if args.dataCol:
            headerStringsForNewFile["data"] = args.dataCol
        else:
            headerStringsForNewFile["data"] = "message"

        if args.messageIdCol:
            headerStringsForNewFile["id"] = args.messageIdCol
        else:
            headerStringsForNewFile["id"] = "msgId"

        if args.timestamp:
            headerStringsForNewFile["timestamp"] = args.timestamp
        else:
            headerStringsForNewFile["timestamp"] = "timestamp"

        rowCount = 0
        events = {}
        eventOrder = []

        try:
            for row in reader:
                if len(row["data"]) == 0 or len(row["id"]) == 0 or len(row["owner"]) == 0:
                    continue

                if row["schemeId"] not in schemeIds:
                    schemes.append(row["schemeName"])
                    schemeIds[row["schemeId"]] = 1

                if row["id"] not in events:
                    eventObj = {headerStringsForNewFile["id"]: row["id"],
                                headerStringsForNewFile["owner"]: row["owner"],
                                headerStringsForNewFile["timestamp"]: row["timestamp"],
                                headerStringsForNewFile["data"]: row["data"],
                                row["schemeName"]: row["deco_codeValue"]}
                    eventOrder.append(row["id"])
                    events[row["id"]] = eventObj

                else:
                    events[row["id"]][row["schemeName"]] = row["deco_codeValue"]

                rowCount += 1

        except UnicodeDecodeError as dec:
            print "Can't decode line #%d as unicode!" % rowCount

        if len(events) == 0:
            print "ERROR: No line read from file has been correctly filled in."

        else:
            fileName = os.path.splitext(args.file)[0]
            with open(os.path.join(dir_path, fileName + "-converted.csv"), "wb") as out:
                header = nonDecoOutput + schemes
                dialect = unicodecsv.excel
                dialect.delimiter = ";"
                writer = unicodecsv.DictWriter(out, fieldnames=[headerStringsForNewFile[h] for h in nonDecoOutput] + schemes, dialect=dialect)
                writer.writeheader()

                for eventId in eventOrder:
                    writer.writerow(events[eventId])

            with open(os.path.join(dir_path, fileName + "-converted.csv"), "r") as myFile:
                lines = myFile.readlines()
            with open(os.path.join(dir_path, fileName + "-converted.csv"), "w") as myFile:
                lines[-1] = lines[-1].strip()
                myFile.writelines([item for item in lines if len(item) > 0])

            print "SUCCESS: Converted the CSV, stored at \"%s\"" % os.path.join(dir_path, fileName + "-converted.csv")