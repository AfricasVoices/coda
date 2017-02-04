import re

SYMBOLS = re.compile(u'('
                       u'\ud83c[\udf00-\udfff]|'
                       u'[\u2100-\u26ff]|'
                       u'[\u2000-\u206f]|'
                       u'\ud83d[\udc00-\ude4f\ude80-\udeff]|'
                       u'[\u2600-\u26FF\u2700-\u27BF])+',
                     re.UNICODE)

STRIP = '?:!.,;()[]{}*%$|=-+<>"/ '

SPLIT_EXCEPTIONS = "'*-"
SPLIT_ENUM = '([0-9]+\)|[a-zA-Z]\))'

URL_PATTERN = 'https?:\/\/.*[\r\n]*'

PREFIXES = ["@", "#", "RT", "wwww"]
POSTFIXES = ["@"]
