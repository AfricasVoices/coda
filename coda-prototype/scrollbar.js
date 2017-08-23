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

/*

SCROLLBAR.JS
Handles the initialisation, drawing of, and the interaction with the coloured scrollbar.

 */

var scrollbarManager = {
    // scrollbar as high as the table is

    scrollbarEl : {},
    subsamplingNum: 0,
    thumbWidth: 2,
    thumbHeight: 20,
    scale: 1,
    scrollThumb: $("#scrollthumb"),
    strokeWidth: 1,
    scrollbarBoundingBoxHeight: "",

    init : function(sessionData, scrollbarEl, subsamplingNum){

        console.time("scrollbar init");

        this.scrollbarEl = scrollbarEl;
        //this.subsamplingNum = subsamplingNum;

        $(this.scrollbarEl).removeLayers();
        this.scrollThumb.removeLayers();
        $(this.scrollbarEl).drawLayers();
        this.scrollThumb.drawLayers();

        var scrollContext = scrollbarEl.getContext('2d');
        var scrollContext2 = document.getElementById("scrollthumb").getContext('2d');
        $("body").show(); // todo this is nasty
        scrollContext.canvas.height = $("#table-col").height();
        scrollContext.canvas.width = $("#scrollbar-col").width();

        scrollContext2.canvas.height = scrollContext.canvas.height;
        scrollContext2.canvas.width = scrollContext.canvas.width;

        let scrollbarPosition = $(scrollbarEl).position();

        $("#scrollthumb").css({position: 'absolute', top: scrollbarPosition.top + 'px', left: scrollbarPosition.left + 'px'});
        let thumbHeight = Math.floor((messageViewerManager.rowsInTable / newDataset.eventOrder.length) * scrollContext.canvas.height-1);
        if (thumbHeight > this.thumbHeight) {
            this.thumbHeight = thumbHeight;
        }


        $("body").hide();

        this.subsamplingNum = Math.ceil(newDataset.eventOrder.length/(scrollbarEl.height-2)); // need to ceil it so scrollbar doesn't get too big
        if (this.subsamplingNum === 1) this.subsamplingNum = 0;

        scrollbarManager.strokeWidth = (this.subsamplingNum === 0) ? Math.floor((this.scrollbarEl.height-2)/newDataset.eventOrder.length) : 1;

        let rectangleHeight = scrollContext.canvas.height;
        if (this.subsamplingNum > 0) {
            rectangleHeight = Math.ceil(newDataset.events.size/this.subsamplingNum) + 2;
        } else {
            rectangleHeight = rectangleHeight - (rectangleHeight - (newDataset.eventOrder.length * this.strokeWidth)) + 1.5;
        }

        scrollbarManager.scrollbarBoundingBoxHeight = rectangleHeight;


        $("#scrollbar").drawRect({
            strokeStyle: 'black',
            strokeWidth: 1, // same as panel border width
            x: 9.5, y: 0.5,
            width: scrollContext.canvas.width-20, height: rectangleHeight, // todo why -1
            cornerRadius: 2,
            layer: true,
            groups: ['scrollbar'],
            fromCenter: false
        });


        this.redraw(newDataset, messageViewerManager.activeScheme);

        // todo check if no schemes are loaded in - if not, then dont draw the lines!
        console.timeEnd("scrollbar init");

    },

    redraw : function (dataset, activeSchemeId, loadedPages) {
        activeSchemeId = activeSchemeId + "";

        var colors = [];
        if (this.subsamplingNum > 0) {
            colors = this.subsample(dataset, activeSchemeId);
        } else {
            let color;
            dataset.eventOrder.forEach(eventKey => {
                let event = dataset.events.get(eventKey);
                if (event) {
                    if (event.decorations.has(activeSchemeId) && event.decorations.get(activeSchemeId).code) {
                        color = this.adjustSaturation(event.decorations.get(activeSchemeId));
                    } else {
                        color = "#ffffff";
                    }
                    colors.push(color);
                }
            });
        }

        $(this.scrollbarEl).removeLayerGroup('scrollbarlines');

/*
        $(this.scrollbarEl).scaleCanvas({ // scale it in case the stroke width doesn't fill the full element
            x: 10, y: 1.5,
            scaleX: 1, scaleY: (this.scrollbarEl.height-4)/colors.length,
            layer: true
        });
*/
        for (let c = 0; c < colors.length; c++) { // todo: fix this

            $(this.scrollbarEl).drawLine({
                strokeStyle: typeof colors[c] !== "undefined" ? colors[c] : "#ffffff",
                strokeWidth: scrollbarManager.strokeWidth + 0.5,
                x1: 10, y1: c * scrollbarManager.strokeWidth + 1.5,
                x2: this.scrollbarEl.width - 11.5, y2: c * scrollbarManager.strokeWidth + 1.5,
                layer: true,
                groups: ['scrollbarlines'],
                fromCenter: false
                //scaleY : this.scale
            });

        }

        $(this.scrollbarEl).restoreCanvas({
            layer: true
        });


        var context = this.scrollbarEl.getContext('2d');
        var scrollThumb = $("#scrollthumb");
        scrollThumb.removeLayer('scrollthumb');
        scrollThumb.drawRect({
            strokeStyle: '#black',
            strokeWidth: 1.5,
            x: 2, y: loadedPages ? loadedPages[0] == 0 ? 1 : this.height * (loadedPages[0]/messageViewerManager.tablePages.length) : 1,
            width: context.canvas.width-4, height: scrollbarManager.thumbHeight, // set height according to dataset size vs elems on screen
            cornerRadius: 0,
            layer: true,
            name: 'scrollthumb',
            groups: ['scrollbar'],
            draggableGroups: ['scrollthumb'],
            fromCenter: false,
            draggable: true,
            restrictDragToAxis: 'y',
            dragstop: function(layer) {

                let endDragYCoord;
                if (layer.dy + layer.y < 0) {
                    endDragYCoord = 1;
                } else if (layer.dy + layer.y > scrollbarManager.scrollbarBoundingBoxHeight) {
                    endDragYCoord = scrollbarManager.scrollbarBoundingBoxHeight - scrollbarManager.thumbHeight;
                } else {
                    endDragYCoord = layer.dy + layer.y;
                }

                // move scrollthumb if out of bounds either on top or below
                if (layer.dy + layer.y < 0) {
                    event.stopPropagation();
                    layer.y = 1;
                } else if (layer.dy + layer.y + layer.height + layer.strokeWidth > scrollbarManager.scrollbarBoundingBoxHeight) {
                    event.stopPropagation();
                    layer.y = scrollbarManager.scrollbarBoundingBoxHeight - layer.height - 1; // todo connect to stroke width of the grey border
                }

                scrollbarManager.scrolling(layer, endDragYCoord);
                $(this).drawLayers();

                // save activity
                storage.saveActivity({
                    "category": "SCROLLBAR",
                    "message": "Dragged scrollthumb",
                    "messageDetails": {"dy": layer.dy},
                    "data": "",
                    "timestamp": new Date()
                });

            },

            dragcancel: function(layer) {

                console.log("DRAGCANCEL");

                let endDragYCoord;
                if (layer.dy + layer.y < 0) {
                    endDragYCoord = 1;
                } else if (layer.dy + layer.y > scrollbarManager.scrollbarBoundingBoxHeight) {
                    endDragYCoord = scrollbarManager.scrollbarBoundingBoxHeight - scrollbarManager.thumbHeight;
                } else {
                    endDragYCoord = layer.dy + layer.y;
                }

                if (layer.dy + layer.y < 0) {
                    event.stopPropagation();
                    layer.y = 1;
                } else if (layer.dy + layer.y + layer.height + layer.strokeWidth > scrollbarManager.scrollbarBoundingBoxHeight) {
                    event.stopPropagation();
                    layer.y = scrollbarManager.scrollbarBoundingBoxHeight - layer.height - 1;
                }

                scrollbarManager.scrolling(layer, endDragYCoord);
                $(this).drawLayers();

                // save activity
                storage.saveActivity({
                    "category": "SCROLLBAR",
                    "message": "Dragged scrollthumb",
                    "messageDetails": {"dy": layer.dy},
                    "data": "",
                    "timestamp": new Date()
                });

            },
            cursors: {
                // show move cursor when dragging
                mouseover: 'pointer',
                mousedown: 'move',
                mouseup: 'pointer'
            }
        });

        $(this.scrollbarEl).drawLayers(); // todo do i need to do this? - yes you do, e.g. when changing active scheme
        scrollThumb.drawLayers();
    },

    subsample : function(dataset, activeSchemeId) {

        // make sure activeSchemeId is a string
        activeSchemeId = activeSchemeId + "";
        var sampleColours = [];

        // divide dataset into datasetSize / numSamples subarrays
        // pick one from each subarray at random!

        // CHECK IF IT FITS INTO SCROLLBAR PX OF SUBSAMPLING NEEDED!

        var colors = [];
        let counter = 0;
        let counter2 = 0;

        dataset.eventOrder.forEach(eventKey => {
            let event = dataset.events.get(eventKey);

            if (colors.length > 0 && colors.length % this.subsamplingNum === 0) {
                let color = colors[UIUtils.randomInteger(0, colors.length-1)];
                sampleColours.push(color);
                colors = [];
            }

            if (event) {
                if (event.decorations.has(activeSchemeId) && event.decorations.get(activeSchemeId).code) {
                    let code = event.decorations.get(activeSchemeId).code;
                    let codeHasColor = code.color &&  code.color.length !== 0;
                    if (codeHasColor) {
                        colors.push(this.adjustSaturation(event.decorations.get(activeSchemeId)));
                        counter++;
                    } else {
                        colors.push("#ffffff");
                        counter++;
                        //counter.push("#ffffff");
                    }
                } else {
                    colors.push("#ffffff");
                    counter++;
                    //counter.push("#ffffff");
                }
            } else {
                counter2++;
                console.log("fail");
            }
        });
        console.log(counter.length);
        return sampleColours;
    },

    adjustSaturation: function(decoration) {

        let color = decoration.code.color;
        let confidence = decoration.confidence;

        if (confidence < 0.95) {
            if (confidence <  0.1) {
                let interpolate = UIUtils.interpolator(0,0.1, 0.2,0.4);
                confidence = interpolate(confidence);

            } else {
                let interpolate = UIUtils.interpolator(0.1, 0.95, 0.5, 0.90);
                confidence = interpolate(confidence);
            }
        }

        if (color === "" || color == null) return "#ffffff";

        let hslColor = UIUtils.rgb2hsl(UIUtils.hex2rgb(color));
        let hsl = hslColor.split("(")[1].split(")")[0].split(",");

        let newHsl = "hsl(" + hsl[0] + "," + confidence + "," + hsl[2] + ")";
        let rgbReturn = UIUtils.rgb2hex(UIUtils.hsl2rgb(newHsl));
        //console.log(newHsl);
        return rgbReturn;

    },

    scrolling : function(scrollthumbLayer, endDragEventYCoord) {

        let thumbMid = scrollthumbLayer.y + scrollbarManager.thumbWidth + Math.floor(scrollbarManager.thumbHeight/2); // for stroke width of the scrollthumb

        // figure out what this pixel position means
        // does it match an event (1 event per pixel)
        // does it match a subsampled group (multiple events per pixel)
        // does it match a line within an event (one event per multiple pixels)

        // todo need to take scaling into account

        let ycoord = scrollthumbLayer.y;
        if (ycoord === 1) {
            // we're on very top
            messageViewerManager.bringEventIntoView2(newDataset.eventOrder[0]);

        } else {
            if (scrollbarManager.subsamplingNum === 0) {
                if (scrollbarManager.strokeWidth === 1) {
                    // one event per pixel
                    messageViewerManager.bringEventIntoView2(newDataset.eventOrder[ycoord-1]);
                } else {
                    // one event per multiple pixels
                    let eventIndex = Math.floor((ycoord-1) / scrollbarManager.strokeWidth);
                    messageViewerManager.bringEventIntoView2(newDataset.eventOrder[eventIndex]);
                }

            } else {
                // multiple events per pixel - figure out the subsampling group and jump to the first one of the group
                // in the case where scrollthumb was dragged out of bounds at the bottom, we take into account the original
                // y coordinate (the one that makes it out of bounds) rather than the fixed one (within bounds)
                let eventIndex = scrollbarManager.subsamplingNum * endDragEventYCoord;
                messageViewerManager.bringEventIntoView2(newDataset.eventOrder[eventIndex]);

            }
        }
    },

    redrawThumbAtEvent(eventIndex) {

        // will place top of scrollthumb at event
        if (typeof eventIndex === "undefined" || eventIndex.length === 0) {
            return;
        }
        eventIndex = parseInt(eventIndex);
        let ycoordinate;

        if (scrollbarManager.subsamplingNum === 0) {
            ycoordinate = eventIndex * scrollbarManager.strokeWidth;
        } else {
            let lineNumber = Math.floor(eventIndex / scrollbarManager.subsamplingNum);
            ycoordinate = lineNumber * scrollbarManager.strokeWidth;
        }
        scrollbarManager.redrawThumb(ycoordinate);
    },

    redrawThumb : function(ycoord) {
        let scrollthumbLayer = this.scrollThumb.getLayer(0);
        if (ycoord < 1) ycoord = 1;
        if (ycoord > scrollbarManager.scrollbarBoundingBoxHeight - scrollbarManager.thumbHeight -1) ycoord = scrollbarManager.scrollbarBoundingBoxHeight - scrollbarManager.thumbHeight -1;

        scrollthumbLayer.y = ycoord;
        this.scrollThumb.drawLayers();
    },

    getThumbPosition: function() {
        const layer = this.scrollThumb.getLayer(0);
        return layer ? layer.y : 0;
    }

};