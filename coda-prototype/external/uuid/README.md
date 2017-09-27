# js-uuid

js-uuid is an browser wrapper for Robert Kieffer's [node-uuid](https://github.com/broofa/node-uuid), which provides simple, fast generation of [RFC4122](http://www.ietf.org/rfc/rfc4122.txt) UUIDS.
Based on munkychop's fork [angular-uuid](https://github.com/munkychop/angular-uuid).

### Features

* Generate RFC4122 version 1 or version 4 UUIDs
* Cryptographically strong random # generation on supporting platforms
* Tiny file size when minified.

### Installation

If using CommonJS then simply require js-uuid as per usual:

```
npm install --save js-uuid
```

```javascript
require("js-uuid");
// ES6
import uuid from 'js-uuid';
```

Otherwise use a regular script tag:

```html
<script src="js-uuid.js"></script>
<script>uuid.v4();</script>
```


### Documentation

Full documentation is available via the original project's readme: https://github.com/broofa/node-uuid/blob/master/README.md
