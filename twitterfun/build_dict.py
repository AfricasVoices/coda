import json
import cleaners
import re
import unicodedata
import sys
from collections import OrderedDict


default_tweet_fp = "./tweets-intermediate.txt"
default_dictionary_fp = "./dict.json"
default_save_frequency = 1000
ask_to_exit = 15000


def clean_and_build(tweets_path, dict_path, save_freq, resume):
    lines_passed = 0

    if resume:
        # assume the intermediate dictionary is at intermediate dict_path (dict-intermediate.json)
        inter_dict_path = dict_path.rstrip(".json")
        inter_dict_path += "-intermediate.json"
        tweet_dict = json.load(open(inter_dict_path, "rb"), object_pairs_hook=OrderedDict)
        resume_from = int(tweet_dict["tweets_processed"]) + 1
        print "Resuming building from tweet number %d" % resume_from

    else:
        tweet_dict = OrderedDict([("tweets_processed", 0)])
        resume_from = 0
        print "Building dictionary from beggining."

    with open(tweets_path, 'rb') as tweet_file:
        for line in tweet_file:
            if lines_passed < resume_from:  # resume processing from where
                lines_passed += 1
                continue

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

                        # if any(w.startswith(prefix) for prefix in cleaners.PREFIXES):

                        if w not in tweet_dict:
                            tweet_dict[w] = 1
                        else:
                            tweet_dict[w] += 1

                    else:
                        for w in word_split:
                            # if any(w.startswith(prefix) for prefix in cleaners.PREFIXES):

                            if w == u'amp':
                                continue
                            if w not in tweet_dict:
                                tweet_dict[w] = 1

                            else:
                                tweet_dict[w] += 1

            tweet_dict["tweets_processed"] += 1

            if tweet_dict["tweets_processed"] % save_freq == 0:
                if save(dict_path, tweet_dict, intermediate=True):
                    print "#tweets processed: %d" % tweet_dict["tweets_processed"]

            if tweet_dict["tweets_processed"] % ask_to_exit == 0:
                answer = raw_input("%d words currently in dictionary. Save and safely terminate? [y/n]" % len(tweet_dict.keys()))
                if answer == "y":
                    save(dict_path, tweet_dict, intermediate=True)
                    print "*** Safely terminated. Total of %d tweets processed. ***" % tweet_dict["tweets_processed"]
                    return

        save(dict_path, tweet_dict)  # save to originally given path
        print "Final dictionary version saved, yay! Total words: %d" % len(tweet_dict.keys())


def save(dictionary_path, dictionary_object, intermediate=False):
    if intermediate:  # build intermediate file name
        dictionary_path = dictionary_path.rstrip(".json")
        dictionary_path += "-intermediate.json"

    with open(dictionary_path, 'wb') as dictionary_file:
        json.dump(dictionary_object, dictionary_file, indent=4)
    return True


if __name__ == '__main__':
    if len(sys.argv) != 1:
        # if any args given, pls three at minimum
        tweet_fp = sys.argv[1]
        dictionary_fp = sys.argv[2]
        res = sys.argv[3]
        if res in ["True", "true", "t", "1", 1]:
            res = True
        else:
            res = False

        if len(sys.argv) == 5:
            save_frequency = sys.argv[4]
            if save_frequency.isdigit():
                save_frequency = int(save_frequency)

        else:
            save_frequency = default_save_frequency
            print "Taking the save frequency to be the default - saving every %d tweets processed." % save_frequency

    else:
        tweet_fp = default_tweet_fp
        dictionary_fp = default_dictionary_fp
        save_frequency = default_save_frequency
        res = False

    clean_and_build(tweets_path=tweet_fp, dict_path=dictionary_fp, save_freq=save_frequency, resume=res)
    print "*** DONE BUILDING DICTIONARY ***"
