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

class ColourUtils {
    static rgb2hsl(rgbString: string) : string {
    // based on formulas from http://www.rapidtables.com/convert/color/rgb-to-hsl.htm
    let rgb = rgbString.split("(")[1].split(")")[0].split(",");
    let r, g, b, a;

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
        switch (switchVal) {
            case 0:
                hue = 0;
                break;
            case r0:
                hue = 60 * (((g0 - b0) / delta) % 6);
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

        return "hsl(" + Math.round(hue * 100) / 100 + "," + Math.round(saturation * 100) / 100 + "," + Math.round(luminance * 100) / 100 + ")";

    } else return "";

    }

    static hex2rgb(hex : string) : string {
        //http://stackoverflow.com/a/5624139

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
    }

    static rgb2hex(rgb : string) : string {

        let r, g, b;
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
    }

    static hsl2rgb(hslString : string) : string {
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

                let C = (1 - Math.abs(2 * l - 1)) * s;
                let X = C * (1 - Math.abs((h / 60) % 2 - 1));
                let m = l - C / 2;

                var test = function(h) {
                    if (h >= 0 && 60 > h) return 0;
                    if (h >= 60 && 120 > h) return 1;
                    if (h >= 120 && 180 > h) return 2;
                    if (h >= 180 && 240 > h) return 3;
                    if (h >= 240 && 300 > h) return 4;
                    if (h >= 300 && 360 > h) return 5;
                };

                let testRes = test(h);

                switch (testRes) {
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
    }
}