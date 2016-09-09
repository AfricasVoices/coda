Prerequisites for running the twitter scripts:
- numpy
- tweepy
- editdistance

```bash
pip install numpy
pip install tweepy
pip install editdistance
```

Scripts can be run from terminal as follows.
```bash
# TWEET COLLECTION
python collect-tweets.py > tweets_fp

# CLEANING & DICTIONARY BUILDING
python build-dict.py [tweets_fp] [dict_fp] [resume] [save_freq] 
# Usage: either enter none of args, the first three, or all of them!
# Defaults:
# tweets_fp = "./tweets-intermediate.txt"
# dict_fp = "./dict.json"
# resume = "False"
# save_freq = 1000
```

Tweet streaming runs for as long as the http connection is up. Usually runs for a few hours with good connection, needs to be manually restarted if there's an connection error.

Dictionary building runs until all tweets have been processed. Intermediate saving is done at a given frequency (# tweets processed). If terminated early, it is possible to resume with building - assuming the dict-intermediate.json was produced.

Dictionary building relies on OrderedDicts to ensure keys are always kept in the same order. This is also important later when building the distance matrix - same index always means the same word.