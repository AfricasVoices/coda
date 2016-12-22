// scrollbar as high as the table is

var scrollbarManager = {

    scrollbarEl : {},
    subsamplingNum: 0,

    init : function(sessionData, scrollbarEl, subsamplingNum){

        console.time("scrollbar init");

        this.scrollbarEl = scrollbarEl;
        //this.subsamplingNum = subsamplingNum;

        // check for active column
        // check if any code has colour set

        var scrollContext = scrollbarEl.getContext('2d')
        $("body").show();
        scrollContext.canvas.height = $("#table-col").height()
            - parseInt(messageViewerManager.messageContainer.css("margin-bottom"))
            - parseInt(messageViewerManager.messageContainer.css("margin-top"));
        scrollContext.canvas.width = $("#scrollbar-col").width();
        $("body").hide();

        this.subsamplingNum = Math.floor(newDataset.eventCount / scrollbarEl.height);


        /*
        scrollContext.strokeStyle = "#ddd"; // light grey as in the table header
        scrollContext.lineWidth = 2;
        scrollContext.globalCompositeOperation = "source-over"; // default, draws over existing canvas
        scrollContext.strokeRect(0,0, scrollbarEl.width, scrollbarEl.height);
        scrollContext.globalCompositeOperation = "destination-over"; // draws behind existing canvas
        scrollContext.fillStyle = "white";
        scrollContext.fillRect(0,0, scrollbarEl.width, scrollbarEl.height);
        */


        /*
         .drawRect({
         fillStyle: 'white',
         x: 0, y: 0,
         width: scrollbarEl.width, height: scrollbarEl.height,
         layer: true,
         fromCenter: false,
         groups: ['scrollbar']
         })
         */

        $("#scrollbar").drawRect({
            fillStyle: 'white',
            x: 0, y: 0,
            width: scrollbarEl.width, height: scrollbarEl.height,
            layer: true,
            fromCenter: false,
            groups: ['scrollbar']
        }).drawRect({
            strokeStyle: '#ddd',
            strokeWidth: 2,
            x: 0, y: 0,
            width: scrollContext.canvas.width, height: scrollContext.canvas.height,
            cornerRadius: 5,
            layer: true,
            groups: ['scrollbar'],
            fromCenter: false
        });

// todo make schemes an array not object so there is a concept of order

        this.redraw(newDataset, Object.keys(newDataset.schemes)[0]);
/*
        $("#scrollbar").drawRect({
            strokeStyle: '#black',
            strokeWidth: 4,
            x: 2, y: 2,
            width: scrollContext.canvas.width-4, height: 20, // set height according to dataset size vs elems on screen
            cornerRadius: 0,
            layer: true,
            name: 'scrollthumb',
            groups: ['scrollbar'],
            draggableGroups: ['scrollthumb'],
            fromCenter: false,
            draggable: true,
            restrictDragToAxis: 'y',
            dragcancel: function(layer) {
                console.log("DRAGCANCEL");
                // want to prevent dragging layer out of canvas element
                // check if layer coordinates are out of bounds

                if (layer.dy + layer.y < 0) {
                    event.stopPropagation();
                    event.cancelBubble = true;

                    layer.y = 0;

                }

                else if (layer.dy + layer.y + layer.height + layer.strokeWidth > scrollContext.canvas.height) {
                    event.stopPropagation();
                    event.cancelBubble = true;

                    layer.y = scrollContext.canvas.height - layer.height - layer.strokeWidth;

                }

            },
            cursors: {
                // show move cursor when dragging
                mouseover: 'pointer',
                mousedown: 'move',
                mouseup: 'pointer'
            }
        });
*/

        console.timeEnd("scrollbar init");

    },

    redraw : function (dataset, activeSchemeId) {

        var colors = this.subsample(dataset, activeSchemeId);

        $(this.scrollbarEl).removeLayerGroup('scrollbarlines');

        for (var c = 0; c < this.scrollbarEl.height-2; c++) { // todo: fix this

            $(this.scrollbarEl).drawLine({
                strokeStyle: colors[c] != undefined ? colors[c] : "#ffffff",
                strokeWidth: 1,
                x1: 1, y1: c + 2,
                x2: this.scrollbarEl.width - 1, y2: c + 2,
                layer: true,
                groups: ['scrollbar', 'scrollbarlines'],
                fromCenter: false
            });

        }

        var context = this.scrollbarEl.getContext('2d');
        $(this.scrollbarEl).removeLayer('scrollthumb');
        $("#scrollbar").drawRect({
            strokeStyle: '#black',
            strokeWidth: 4,
            x: 2, y: 2,
            width: context.canvas.width-4, height: 20, // set height according to dataset size vs elems on screen
            cornerRadius: 0,
            layer: true,
            name: 'scrollthumb',
            groups: ['scrollbar'],
            draggableGroups: ['scrollthumb'],
            fromCenter: false,
            draggable: true,
            restrictDragToAxis: 'y',
            dragcancel: function(layer) {
                console.log("DRAGCANCEL");
                // want to prevent dragging layer out of canvas element
                // check if layer coordinates are out of bounds

                if (layer.dy + layer.y < 0) {
                    event.stopPropagation();
                    event.cancelBubble = true;

                    layer.y = 0;

                }

                else if (layer.dy + layer.y + layer.height + layer.strokeWidth > context.canvas.height) {
                    event.stopPropagation();
                    event.cancelBubble = true;

                    layer.y = context.canvas.height - layer.height - layer.strokeWidth;

                }

            },
            cursors: {
                // show move cursor when dragging
                mouseover: 'pointer',
                mousedown: 'move',
                mouseup: 'pointer'
            }
        });

    },

    subsample : function(dataset, activeSchemeId) {

        // make sure activeSchemeId is a string
        activeSchemeId = activeSchemeId + "";

        var sessionData = dataset.sessions;
        var sampleColours = [];

        // divide dataset into datasetSize / numSamples subarrays
        // pick one from each subarray at random!
        // sadly need to loop because sessions have different numbers of events... oh yeah
        // sad times

        // CHECK IF IT FITS INTO SCROLLBAR PX OF SUBSAMPLING NEEDED!

        var colors = [];
        for (var i = 0; i < sessionData.length; i++) {
            var numEvents = sessionData[i].events.length;
            for (var j = 0; j < numEvents; j++) {

                if (colors.length == this.subsamplingNum) {
                    sampleColours.push(colors[UIUtils.randomInteger(0, colors.length-1)]);
                    colors = [];
                } else {
                    if (sessionData[i]["events"][j]["decorations"].has(activeSchemeId) && sessionData[i]["events"][j]["decorations"].get(activeSchemeId)["code"] != null) {
                        var color = sessionData[i]["events"][j]["decorations"].get(activeSchemeId)["code"]["color"];
                        colors.push(color);
                    } else {
                        colors.push("#ffffff"); // todo: or some other default color
                    }

                }

            }
        }

        return sampleColours;
    }


}