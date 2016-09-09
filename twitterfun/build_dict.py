import json
import cleaners
import re
import unicodedata

tweet_fp = "./tweets-intermediate.txt"
dictionary_fp = "./dictionary.json"

tweet_dict = {}

with open(tweet_fp, 'rb') as tweet_file:
    counter = 1
    for line in tweet_file:

        # data format: JSON per line
        tweet = json.loads(line)

        for word in tweet["text"]:
            # TODO ordering of cleaning steps, redundancy

            word = cleaners.SYMBOLS.sub('', word)  # stupid unicode symbols, arrows, emojis...
            word = unicodedata.normalize('NFKC', word)  # normalize full width to half width chars
            word = word.strip(cleaners.STRIP).lower()  # symbols & punctuation from left and right
            word = word.replace('\'', '')
            word = re.sub(cleaners.URL_PATTERN, '', word)  # remove URLs

            if any(word.startswith(prefix) for prefix in cleaners.PREFIXES):
                continue

            word_split = [w for w in re.split(r'[^\w'+cleaners.SPLIT_EXCEPTIONS+']', word) if len(w) > 1 and not w.isdigit()]
            filter(lambda word : not any(word.startswith(prefix) for prefix in cleaners.PREFIXES), word_split)

            if word_split:
                if len(word_split) == 1:
                    w = word_split[0]
                    if len(w) == 0:
                        continue

                    if any(w.startswith(prefix) for prefix in cleaners.PREFIXES):
                        print "la"
                    if w not in tweet_dict:
                        tweet_dict[w] = 1
                    else:
                        tweet_dict[w] += 1
                else:
                    for w in word_split:

                        if any(w.startswith(prefix) for prefix in cleaners.PREFIXES):
                            print "la"
                        if w == u'amp':
                            continue
                        if w not in tweet_dict:
                            tweet_dict[w] = 1
                        else:
                            tweet_dict[w] += 1
        counter += 1

    with open(dictionary_fp, 'wb') as dictionary:
        json.dump(tweet_dict, dictionary, indent=4)








