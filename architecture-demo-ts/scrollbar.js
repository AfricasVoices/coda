// scrollbar as high as the table is

var scrollbarManager = {

    scrollbarEl : {},
    subsamplingNum: 0,
    thumbWidth: 2,
    scale: 1,

    init : function(sessionData, scrollbarEl, subsamplingNum){

        console.time("scrollbar init");

        this.scrollbarEl = scrollbarEl;
        //this.subsamplingNum = subsamplingNum;

        // check for active column
        // check if any code has colour set

        var scrollContext = scrollbarEl.getContext('2d');
        var scrollContext2 = document.getElementById("scrollthumb").getContext('2d');
        $("body").show(); // todo this is nasty
        scrollContext.canvas.height = $("#table-col").height()
            - parseInt(messageViewerManager.messageContainer.css("margin-bottom"))
            - parseInt(messageViewerManager.messageContainer.css("margin-top"));
        scrollContext.canvas.width = $("#scrollbar-col").width();

        scrollContext2.canvas.height = scrollContext.canvas.height;
        scrollContext2.canvas.width = scrollContext.canvas.width;

        $("#scrollthumb").css({position: 'absolute', top: '0px', left: $(scrollbarEl).position().left + 'px'});

        $("body").hide();

        this.subsamplingNum = Math.floor(newDataset.eventCount/(scrollbarEl.height-4));


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

        // todo keep scrollthumb in place when reloading the table from editscheme dialog

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
        // todo check if no schemes are loaded in - if not, then dont draw the lines!
        console.timeEnd("scrollbar init");

    },

    redraw : function (dataset, activeSchemeId, loadedPages) {

        var colors = [];
        var sessionData = dataset.sessions;
        if (this.subsamplingNum > 0) {
            colors = this.subsample(dataset, activeSchemeId);
        } else {

            /*
            for (var i = 0; i < sessionData.length; i++) {
                var numEvents = sessionData[i].events.length;
                for (var j = 0; j < numEvents; j++) {
                    if (sessionData[i]["events"][j]["decorations"].has(activeSchemeId) && sessionData[i]["events"][j]["decorations"].get(activeSchemeId)["code"] != null) {
                        var color = sessionData[i]["events"][j]["decorations"].get(activeSchemeId)["code"]["color"];
                        colors.push(color);
                    } else {
                        colors.push("#ffffff"); // todo: or some other default color
                    }
                }
            }
            */

            for (event of newDataset.events) {
                if (event.decorations.has(activeSchemeId) && event.decorations.get(activeSchemeId).code != null) {
                    colors.push(event.decorations.get(activeSchemeId).code.color);
                } else {
                    colors.push("#ffffff");
                }

            }


        }

        this.scale = (this.scrollbarEl.height-4)/colors.length;


        $(this.scrollbarEl).removeLayerGroup('scrollbarlines');

        for (var c = 0; c < this.scrollbarEl.height-2; c++) { // todo: fix this
            var strokeWidth = Math.floor((this.scrollbarEl.height-4)/colors.length);

            $(this.scrollbarEl).drawLine({
                strokeStyle: colors[c] != undefined ? colors[c] : "#ffffff",
                strokeWidth: strokeWidth,
                x1: 1, y1: c * strokeWidth,
                x2: this.scrollbarEl.width - 1, y2: c * strokeWidth,
                layer: true,
                groups: ['scrollbar', 'scrollbarlines'],
                fromCenter: false,
                scaleY : this.scale
            });

        }

        var context = this.scrollbarEl.getContext('2d');
        $(this.scrollbarEl).removeLayer('scrollthumb');
        $("#scrollthumb").drawRect({
            strokeStyle: '#black',
            strokeWidth: 1.5,
            x: 2, y: loadedPages ? loadedPages[0] == 0 ? 2 : this.height * (loadedPages[0]/messageViewerManager.tablePages.length) : 2,
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

                scrollbarManager.scrolling(layer);
                $(this).drawLayers();

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

        $("#scrollbar").drawLayers();

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

        /*
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
        */

        for (event of newDataset.events) {
            if (colors.length == this.subsamplingNum) {
                sampleColours.push(colors[UIUtils.randomInteger(0, colors.length-1)]);
                colors = [];
            } else {
                if (event.decorations.has(activeSchemeId) && event.decorations.get(activeSchemeId).code != null) {
                    colors.push(event.decorations.get(activeSchemeId).code.color);
                } else {
                    colors.push("#ffffff");
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

        // need to take into account the border of the scrollthumb! e.g. the only lines visible in the scrollthumb...

        var thumbTop = scrollthumbLayer.y + 4; // for stroke width of the scrollthumb
        var pageSize = messageViewerManager.rowsInTable;
        var rowsPerPixel = scrollbarManager.subsamplingNum;

        var firstItemInPixel = (thumbTop - 1) * rowsPerPixel;

        // todo need to take scaling into account
        var percentage = thumbTop == 6 ? 0 : Math.round((thumbTop / scrollbarManager.scrollbarEl.height) * 100 ) / 100; // force it to 0 if top is 6px displaced, 2px for border, 4px for scrollthumb
        var percentagePageToLoad = Math.floor((Math.floor(newDataset.events.length / messageViewerManager.rowsInTable) - 1) * percentage);
        //var pageToLoadIndex = thumbTop <= 0 ? 0 : Math.floor(firstItemInPixel / pageSize);

        messageViewerManager.lastLoadedPageIndex = [];

        var page1 = messageViewerManager.createPageHTML(percentagePageToLoad);
        var page2 = messageViewerManager.createPageHTML(percentagePageToLoad+1);
        messageViewerManager.lastLoadedPageIndex = percentagePageToLoad + 1;

        var tbodyElement = messageViewerManager.table.find("tbody");
        tbodyElement.empty();
        tbodyElement.append(page1);
        tbodyElement.append(page2);

        messageViewerManager.messageContainer.scrollTop(0);

    }






}