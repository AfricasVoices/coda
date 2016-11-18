var UIUtils = (
    function() {

        return {

            randomId : function(array) {
                var newId = Math.floor(Math.random()*100);

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

            nextUnfilledRow: function (activeRow, wrap, schemeId) {
                if (wrap == null) wrap = false;
                if (schemeId == null) schemeId = ""; else schemeId = "." + schemeId;

                var next = activeRow.nextAll().has("select.uncoded" + schemeId).first();
                if (next.length > 0) return next;

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
            }
        };
    }) ();