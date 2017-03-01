/*
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
*/


var UIUtils = (
    function() {

        return {

            hex2rgb : function(hex) {

                // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
                let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
                hex = hex.replace(shorthandRegex, function(m, r, g, b) {
                    return r + r + g + g + b + b;
                });

                let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                let rgb = result ? {
                        r: parseInt(result[1], 16),
                        g: parseInt(result[2], 16),
                        b: parseInt(result[3], 16)
                    } : null;

                if (rgb == null) return "";
                else return "rgb(" + rgb.r + "," + rgb.g + "," + rgb.b + ")";
            },

            rgb2hex : function(rgb) {

                let r,g,b;
                let components = rgb.split("(")[1].split(")")[0].split(",");

                r = parseInt(components[0]);
                g = parseInt(components[1]);
                b = parseInt(components[2]);

                let r_hex = r.toString(16),
                    g_hex = g.toString(16),
                    b_hex = b.toString(16);

                r_hex = r_hex.length == 1 ? "0" + r_hex : r_hex;
                g_hex = g_hex.length == 1 ? "0" + g_hex : g_hex;
                b_hex = b_hex.length == 1 ? "0" + b_hex : b_hex;

                return "#" + r_hex + g_hex + b_hex;
            },

            rgb2hsl : function(rgbString) {
                // based on formulas from http://www.rapidtables.com/convert/color/rgb-to-hsl.htm
                let rgb = rgbString.split("(")[1].split(")")[0].split(",");
                let r,g,b,a;

                if (rgb.length == 3) {
                    r = parseInt(rgb[0]);
                    g = parseInt(rgb[1]);
                    b = parseInt(rgb[2]);
                } else return "";

                if (r >= 0 && 256 > r && g >= 0 && 256 > g && b >= 0 && 256 > b) {

                    let r0 = r / 255,
                        g0 = g / 255,
                        b0 = b / 255;

                    let min = Math.min(r0, g0, b0),
                        max = Math.max(r0, g0, b0),
                        delta = max - min;

                    let switchVal = delta == 0 ? 0 : max;
                    let hue;
                    switch(switchVal) {
                        case 0:
                            hue = 0;
                            break;
                        case r0:
                            hue = 60 * (((g0 - b0)/delta) % 6);
                            break;
                        case g0:
                            hue = 60 * (((b0 - r0) / delta) + 2);
                            break;
                        case b0:
                            hue = 60 * (((r0 - g0) / delta) + 4);
                            break;
                    }

                    if (hue >= 360) {
                        hue = hue - 360;
                    } else if (hue < 0) {
                        hue = hue + 360;
                    }

                    let luminance = (max + min) / 2;
                    let saturation = delta == 0 ? 0 : (delta / (1 - Math.abs(2 * luminance - 1)));

                    return "hsl(" + Math.round(hue * 100)/100 + "," + Math.round(saturation * 100) / 100 + "," + Math.round(luminance * 100) / 100 + ")";

                } else return "";
            },

            hsl2rgb : function(hslString) {
                // based on formulas from http://www.rapidtables.com/convert/color/hsl-to-rgb.htm
                let hsl = hslString.split("(")[1].split(")")[0].split(",");
                let h, s, l;
                if (hsl.length == 3) {
                    h = parseFloat(hsl[0]);
                    s = parseFloat(hsl[1]);
                    l = parseFloat(hsl[2]);
                } else return "";

                if (h >= 0 && 360 > h && s >= 0 && 1 >= s && l >= 0 && 1 >= l) {
                    let rgbResult = [];
                    if (s == 0) {
                        // it's a shade of grey
                        let rgbVal = l * 255;
                        rgbResult = [rgbVal, rgbVal, rgbVal];

                    } else {

                        let C = (1 - Math.abs(2*l - 1)) * s;
                        let X = C * (1 - Math.abs((h/60) % 2 -1));
                        let m = l - C/2;

                        var test = function(h) {
                            if (h >= 0 && 60 > h) return 0;
                            if (h >= 60 && 120 > h) return 1;
                            if (h >= 120 && 180 > h) return 2;
                            if (h >= 180 && 240 > h) return 3;
                            if (h >= 240 && 300 > h) return 4;
                            if (h >= 300 && 360 > h) return 5;
                        }

                        let testRes = test(h);

                        switch(testRes) {
                            case 0:
                                rgbResult = [C, X, 0];
                                break;
                            case 1:
                                rgbResult = [X, C, 0];
                                break;
                            case 2:
                                rgbResult = [0, C, X];
                                break;
                            case 3:
                                rgbResult = [0, X, C];
                                break;
                            case 4:
                                rgbResult = [X, 0, C];
                                break;
                            case 5:
                                rgbResult = [C, 0, X];
                                break;
                        }

                        rgbResult[0] = (rgbResult[0] + m) * 255;
                        rgbResult[1] = (rgbResult[1] + m) * 255;
                        rgbResult[2] = (rgbResult[2] + m) * 255;
                    }

                    return "rgb(" + Math.round(rgbResult[0]) + "," + Math.round(rgbResult[1]) + "," + Math.round(rgbResult[2]) + ")";
                } else {
                    return "";
                }
            },

            concatArraysUniqueWithSort : function (thisArray, otherArray) {
                let newArray = thisArray.concat(otherArray);
                newArray.sort(function(a, b){
                    // DESC -> b.length - a.length
                    return b.length - a.length || b.localeCompare(a);
                });

                return newArray.filter(function(word, index) {
                    return newArray.indexOf(word) === index;
                });
            },

            randomId : function(array) {
                var newId = Math.floor(Math.random()*100); // todo : better way of generating random

                if (array !== undefined && array.length !== 0) {
                    while (array.indexOf(newId) !== -1) {
                        newId = Math.floor(Math.random()*100);
                    }
                }
                return newId;
            },

            ascii: function (a) {
                return a.charCodeAt(0);
            },

            randomInteger :
                /**
                 * Returns a random integer between min (inclusive) and max (inclusive)
                 * Using Math.round() will give you a non-uniform distribution!
                 * http://stackoverflow.com/a/1527820
                 */

                function(min, max) {
                return Math.floor(Math.random() * (max - min + 1)) + min;
            },

            nextUnfilledRow: function (activeRow, wrap, schemeId) {
                //if (wrap == null) wrap = false;
                wrap = false;
                if (schemeId == null) schemeId = ""; else schemeId = "." + schemeId;

                var next = activeRow.nextAll().has("select.uncoded" + schemeId).first();
                if (next.length > 0) return next;
                else {
                    messageViewerManager.infiniteScroll(); //todo debug
                    next = activeRow.nextAll().has("select.uncoded" + schemeId).first();
                    if (next.length > 0) return next;
                }

                if (wrap) {
                    var prev = activeRow.prevAll().has("select" + schemeId + ".uncoded:last").last();
                    if (prev.length !== 0) return prev;
                }

                return activeRow;
            },

            previousUnfilledRow: function (activeRow, wrap, schemeId) {
                if (wrap == null) wrap = false;
                if (schemeId == null) schemeId = "";

                var previous = activeRow.prevAll().has("select.uncoded" + schemeId).first();
                if (previous.length > 0) return previous;

                if (wrap) {
                    var next = activeRow.nextAll().has("select" + schemeId + ".uncoded:last").first();
                    if (next.length !== 0) return next;
                }

                return activeRow;
            },

            isRowVisible: function (row, tablePanel) {
                // adapted from http://stackoverflow.com/a/38039019

                var tolerance = 0.01; // since getBoundingClientRect provides the position up to 10 decimals
                var percentX = 100;
                var percentY = 100;

                var elementRect = row.getBoundingClientRect();
                var parentRect = tablePanel.getBoundingClientRect();

                var newParentRect = {
                    top: parentRect["top"] + 40, // top + header
                    left: parentRect["left"],
                    right: parentRect["right"],
                    bottom: parentRect["bottom"] - 20 // bottom - padding bottom
                };

                var visiblePixelX = Math.min(elementRect.right, newParentRect.right) - Math.max(elementRect.left, newParentRect.left);
                var visiblePixelY = Math.min(elementRect.bottom, newParentRect.bottom) - Math.max(elementRect.top, newParentRect.top);
                var visiblePercentageX = visiblePixelX / elementRect.width * 100;
                var visiblePercentageY = visiblePixelY / elementRect.height * 100;
                return visiblePercentageX + tolerance > percentX && visiblePercentageY + tolerance > percentY;

            },


            // BETTER!!!
            checkVisible: function(elm) {
                let rect = elm.getBoundingClientRect();
                if (rect.bottom === 0 && rect.top === 0) {
                    return false;
                } else {
                    let viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
                    return !(rect.bottom < 0 || rect.top - viewHeight >= 0);

                }
            },

            scrollRowToTop: function (row, container) {

                // TODO: be given the offsetHeight of the row with biggest height

                var boundingBoxTop = row.getBoundingClientRect().top;

                if (boundingBoxTop > 0) { // BELOW THE CONTAINER (next or wrapping around the list)

                    // move row bounding box back up to top of container, then move down because of header and about 2 rows
                    container.scrollTop = container.scrollTop + boundingBoxTop - 40 - row.offsetHeight * 2;


                } else { // ABOVE THE CONTAINER (prev or wrapping around the list)

                    // move row bounding box back down to top of container, then move up to acc for bottom padding and about 2 rows
                    container.scrollTop = container.scrollTop - boundingBoxTop * (-1) - 20 - row.offsetHeight * 2;
                }
            },

            isScrolledToBottom: function(tableContainer) {
                // alternatively, get the last row in table, and see if its visible:
               // return UIUtils.isRowVisible($(".message").last()[0], tableContainer[0]);
                return UIUtils.checkVisible($(".message").last()[0]);
                    // table is 18px above bottom of the panel...
               // return (Math.abs(messageViewerManager.table[0].scrollHeight - $(tableContainer).scrollTop() - $(tableContainer).outerHeight()) -1  < 1)
            },

            isScrolledToTop: function(tableContainer) {
                return UIUtils.checkVisible($(".message").first()[0]);
                    //return $("#message-panel").scrollTop() === 0;
            }

        };
    }) ();