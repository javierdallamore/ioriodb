function __MakeMXW(global) {
    'use strict';
    var noop = function () {},
        ctJSON = 'application/json',
        XHR = global.XMLHttpRequest || noop,
        XDR = 'withCredentials' in (new XHR()) ? XHR : global.XDomainRequest,
        WS = global.WebSocket || global.MozWebSocket || null,
        ES = global.EventSource || null;

    /**
        websocket is disabled for Firefox 6.0 because it
        causes a crash to happen when the connection is closed.
        @see https://bugzilla.mozilla.org/show_bug.cgi?id=662554
    */
    if (global.navigator.userAgent.indexOf("Firefox/6.0") !== -1) {
        WS = null;
    }

    function request(method, uri, options) {
        options = options || {};
        var xhr, finalUri,
            onLoadCalled = false;

        if (options.cors) {
            xhr = new XDR();
        } else {
            xhr = new XHR();
        }

        // taken from https://github.com/Raynos/xhr/blob/master/index.js
        // IE9 must have onprogress be set to a unique function.
        xhr.onprogress = function () {};
        xhr.ontimeout = noop;

        xhr.onload = function (evt) {
            // only call it once
            if (onLoadCalled) {
                return;
            } else {
                onLoadCalled = true;
            }

            if (options.success) {
                options.success(this, evt, 'load');
            }
        };

        xhr.onerror = function (evt) {
            if (options.error) {
                options.error(this, evt, 'error');
            }
        };

        xhr.onabort = function (evt) {
            if (options.error) {
                options.error(this, evt, 'abort');
            }
        };

        xhr.onreadystatechange = function (evt) {
            if (xhr.readyState === 4) {
                xhr.onload(evt);
            }
        };

        if ('timeout' in options) {
            xhr.timeout = options.timeout;
        } else {
            xhr.timeout = 5000;
        }

        if (options.withCredentials) {
            xhr.withCredentials = options.withCredentials;
        }

        // check explicitly for false equality, it must be set
        if (options.cache === false) {
            finalUri = addTimestampToUrl(uri);
        } else {
            finalUri = uri;
        }

        // sorry, no sync
        xhr.open(method, finalUri, true, options.username, options.password);
        setReqHeaders(xhr, options);
        xhr.send(options.body);

        return xhr;
    }

    request.WebSocket = WS;
    request.EventSource = ES;

    function makeRequester(method) {
        return function (uri, options) {
            return request(method, uri, options);
        };
    }

    function makeTypeBodyRequester(method, contentType, encoder) {
        return function (uri, options) {
            options = options || {};
            options.headers = options.headers || {};

            if (options.body !== undefined) {
                options.body = encoder(options.body);
            }

            if (options.headers['Content-Type'] === undefined) {
                options.headers['Content-Type'] = contentType;
            }

            return request(method, uri, options);
        };
    }

    function makeTypeRequester(method, accept, decoder) {
        return function (uri, options) {
            options = options || {};
            options.headers = options.headers || {};
            options.headers.Accept = accept;

            return request(method, uri, options);
        };
    }

    function toJSON(value, replacer, space) {
        return JSON.stringify(value, replacer, space);
    }

    function fromJSON(text, reviver) {
        return JSON.parse(text, reviver);
    }

    request.put = makeRequester('PUT');
    request.post = makeRequester('POST');
    request.patch = makeRequester('PATCH');

    request.get = makeRequester('GET');
    request.del = makeRequester('DELETE');
    request.head = makeRequester('HEAD');
    request.options = makeRequester('OPTIONS');


    request.json = {
        put: makeTypeBodyRequester('PUT', ctJSON, toJSON),
        post: makeTypeBodyRequester('POST', ctJSON, toJSON),
        patch: makeTypeBodyRequester('PATCH', ctJSON, toJSON),

        get: makeTypeRequester('GET', ctJSON, fromJSON),
        del: makeTypeRequester('DEL', ctJSON, fromJSON),
        head: makeTypeRequester('HEAD', ctJSON, fromJSON),
        options: makeTypeRequester('OPTIONS', ctJSON, fromJSON)
    };

    function setReqHeaders(xhr, options) {
        // XDomainRequest can't set headers
        if (!options || !options.headers || !xhr.setRequestHeader) {
            return;
        }

        var headers = options.headers, key;

        for (key in headers) {
            xhr.setRequestHeader(key, headers[key]);
        }
    }

    function appendQueryParam(url, param) {
        return url + ((/\?/).test(url) ? '&' : '?') + param;
    }

    function addTimestampToUrl(url) {
        return appendQueryParam(url, (new Date()).getTime());
    }

    function endsWithChar(str, chr) {
        return (str[str.length - 1] === chr);
    }

    function endWithSlash(str) {
        return endsWithChar(str, '/') ? str : str + '/';
    }

    function join() {
        var i,
            len = arguments.length,
            items = new Array(len);

        for (i = 0; i < len; i += 1) {
            items[i] = endWithSlash(arguments[i]);
        }

        return items.join('');
    }

    // merge N objects from left to right return a newly created object
    // keys on later objects override same key on previous objects
    function shallowMerge() {
        var result = {},
            i, len, obj, key;

        for (i = 0, len = arguments.length; i < len; i += 1) {
            obj = arguments[i];
            for (key in obj) {
                if (obj.hasOwnProperty(key)) {
                    result[key] = obj[key];
                }
            }
        }

        return result;
    }

    request.join = join;
    request.appendQueryParam = appendQueryParam;
    request.shallowMerge = shallowMerge;

    return request;
}
