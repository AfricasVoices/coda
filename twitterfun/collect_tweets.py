from tweepy import StreamListener
from tweepy import OAuthHandler
from tweepy import Stream
import json
import cleaners
import credentials as cred

CONSUMER_KEY = cred.CONSUMER_KEY
CONSUMER_SECRET = cred.CONSUMER_SECRET

ACCESS_TOKEN = cred.ACCESS_TOKEN
ACCESS_TOKEN_SECRET = cred.ACCESS_TOKEN_SECRET


class StdOutListener(StreamListener):

    current_tweet_count = 0
    accepted_tweet_count = 200000

    def on_error(self, status_code):
        # TODO cleverer error handling...
        if status_code in [403, 400, 401, 404, 406, 500, 502]:
            return False

    def on_data(self, data):
        # want to keep tweets that actually contain more than one word
        # ideally also tweeted by 'reputable' accs so it's not complete junk

        # data is an unicode string so need to parse
        data_dict = json.loads(data)

        if self.current_tweet_count > self.accepted_tweet_count:
            return False

        if data_dict["retweeted"]:
            text = data_dict["retweeted_status"]["text"]
        else:
            text = data_dict["text"]

        string_list = [word.strip(cleaners.STRIP).strip(u'\u2026')
                           .replace(u'\u2019', '\'')
                           .replace(u'\u2018', '\'')
                       for word in text.split()]

        string_list = [word for word in string_list if not any(word.startswith(prefix) for prefix in cleaners.PREFIXES)]
        string_list = [word for word in string_list if not any(word.endswith(postfix) for postfix in cleaners.POSTFIXES)]

        long_words = [word for word in string_list if len(word)>2]
        if len(long_words) > 3 and data_dict["user"]["followers_count"] > 20:
            final_tweet = filter(lambda word: not cleaners.SYMBOLS.search(word), string_list)
            final_tweet = [word.lower() for word in final_tweet]
            hashtags = data_dict["entities"]["hashtags"]
            tweet = json.dumps({"text": final_tweet, "hashtags": hashtags})

            print tweet
            self.accepted_tweet_count += 1

        return True


if __name__ == '__main__':

    listener = StdOutListener()
    oauth = OAuthHandler(CONSUMER_KEY, CONSUMER_SECRET)
    oauth.set_access_token(ACCESS_TOKEN, ACCESS_TOKEN_SECRET)
    stream = Stream(oauth, listener)

    stream.sample(languages=['en'])




