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
            dragstop: function(layer) {

                scrollbarManager.scrolling(layer);

            },
            dragcancel: function(layer) {
                console.log("DRAGCANCEL");
                // want to prevent dragging layer out of canvas element
                // check if layer coordinates are out of bounds

                if (layer.dy + layer.y < 0) {
                    event.stopPropagation();
                    event.cancelBubble = true;
                    layer.y = 2; // todo connect to stroke width of the grey border
                }

                else if (layer.dy + layer.y + layer.height + layer.strokeWidth > context.canvas.height) {
                    event.stopPropagation();
                    event.cancelBubble = true;
                    layer.y = context.canvas.height - layer.height - 2; // todo connect to stroke width of the grey border
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
    },


    scrolling : function(scrollthumbLayer) {

        /*
         IDEA:
         In the scrollbar each 1px line represents n data entries. If mapping is 1-1 then 1 line - 1 data entry, otherwise
         subsampling was used so n > 1. The navigation rectangle is set to be 20px high, so it includes approx 20 x n data entries.

         Additionally, for the purposes of lazy loading the table, the data is split into k-sized "pages". Only 2 * k data items
         are ever present at the same time in the table. The number of data items present in the table at the same time and the
         number of data items included in the scrollthumb are considerably different.

         Consequently,
         1) scrolling the table won't necessarily scroll the table
         2) scrolling the scrollbar will have to jump multiple data pages
         3) scrolling the scrollbar will have to load new pages in! The jumps are likely to be considerably big.


         As a result, on each scroll of the scrollbar
         1) determine at which pixel the scrollthumb is
         2) figure out the sample of what data entries is that pixel
         3) load in the pages that include the first 2 * k entries of that pixel. Alternatively, can pick and load from the middle
         of the scrollthumb

         */


        // ON END OF SCROLL EVENT IN THE SCROLLBAR!!!
        var thumbTop = scrollthumbLayer.y;
        var pageSize = messageViewerManager.rowsPerPage;
        var rowsPerPixel = scrollbarManager.subsamplingNum;

        var firstItemInPixel = (thumbTop - 1) * rowsPerPixel;
        var pageToLoadIndex = Math.floor(firstItemInPixel / pageSize);

        messageViewerManager.currentlyLoadedPages = [];

        var page1 = messageViewerManager.createPageHTML(pageToLoadIndex);
        var page2 = messageViewerManager.createPageHTML(pageToLoadIndex+1);

        var tbodyElement = messageViewerManager.table.find("tbody");
        tbodyElement.empty();
        tbodyElement.append(page1);
        tbodyElement.append(page2);

        messageViewerManager.messageContainer.scrollTop(0);

    }






}