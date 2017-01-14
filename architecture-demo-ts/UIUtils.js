var UIUtils = (
    function() {

        return {

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
                var rect = elm.getBoundingClientRect();
                if (rect.bottom === 0 && rect.top === 0) {
                    return false;
                } else {
                    var viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
                    var visible = !(rect.bottom < 0 || rect.top - viewHeight >= 0);
                    return visible;

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