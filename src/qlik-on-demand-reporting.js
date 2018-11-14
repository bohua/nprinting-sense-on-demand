define([
    "jquery",
    "qlik",
    "./js/properties",
    "./js/helpers",
    "text!./css/qlik-on-demand-reporting.css",
    "text!./template/view-main-single.html",
    "text!./template/view-popup.html",
    "qvangular",
    "core.utils/deferred"
],
function(
    $,
    qlik,
    properties,
    hlp,
    css,
    viewMain,
    viewPopup,
    qvangular,
    Deferred
) {
    $("<style>").html(css).appendTo("head");

    var app = qlik.currApp();
    var currentSelections;
    
    function getSelectionByApi() {
        var fp = [];
        currentSelections.map(function(selection) {
            fp.push(getSelectedValues(selection));
        });

        return Deferred.all(fp);
    }

    function getSelectedValues(selection) {
        var df = Deferred(),
        f = app.field(selection.fieldName).getData(),
        listener = function () {
            var isNumeric = false,
            selectedValues = f.rows.reduce(function (result, row) {
                if (row.qState === 'S') {
                    if (!isNumeric && !isNaN(row.qNum)) {
                        isNumeric = true;
                    }
                    result.push(isNumeric ? row.qNum : row.qText);
                }
                return result;
            }, []);
            
            df.resolve({
                fieldName: selection.fieldName,
                selectedCount: selection.selectedCount,
                selectedValues: selectedValues,
                isNumeric: isNumeric
            });
            f.OnData.unbind(listener);
        };
        f.OnData.bind(listener);
        return df.promise;
    }

    function doExport(options) {
        var conn = options.conn,
        report = options.report,
        format = options.format,
        selections = getSelectionByApi();

        return selections.then(function(allFieldSelections) {				
            return hlp.doGetConnections(conn.server, conn.app).then(function(response) {
                var connectionId;
                if (response.data.totalItems == 1) {
                    connectionId = response.data.items[0].id;
                } else {
                    for (var i = 0; i < response.data.items.length; i++) {
                        var appId = response.data.items[i].appId;

                        if (appId == conn.app) {
                            connectionId = response.data.items[i].id;
                            break;
                        }
                    }
                }

                var requestUrl = hlp.doGetActionURL(conn.server, 'api/v1/ondemand/requests');
                var onDemandRequest = {
                    type: 'report',
                    config: {
                        reportId: report,
                        outputFormat: format
                    },
                    selections: allFieldSelections,
                    // here's the sense connection on which we want to apply selections
                    connectionId: connectionId//'5c0af3f6-e65d-40d2-8f03-6025f8196ff'
                };

                return $.ajax({
                    url: requestUrl,
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify(onDemandRequest),
                    xhrFields: {
                        withCredentials: true
                    }
                });
            });
        });
    }

    return {
        support: {
            snapshot: false,
            export: false,
            exportData: false
        },
        definition: properties,
        template: viewMain,
        controller: ['$scope', '$element', '$interval', function($scope, $element, $interval) {

            $scope.downloadable = false;

            var conn = $scope.layout.npsod.conn;
            var pullTaskHandler = null;
            hlp.getLoginNtlm($scope.layout);

            function canInteract() {
                return $scope.object && $scope.object.getInteractionState() === 1;           
            };

            $scope.doExport = function() {
                if(canInteract()) {
                    var options = {
                        conn: conn,
                        report: conn.report,
                        format: conn.exportFormat
                    };

                    doExport(options).then(function (response) {
                        $scope.popupDg();
                    });
                }
            };

            // Workaround for Apple touch devices, iPad etc
            if (typeof $scope.FirstTime == "undefined") {
                $scope.FirstTime = true;
                var clickHandler = 'ontouchstart' in document.documentElement ? "touchstart" : "click";
                var Btn = $($element).find("button.lui-button");
                Btn.bind(clickHandler, $scope.doExport);
            }

            // Hacking the layout
            var innerObj = $($element).parents(".qv-inner-object");
            var outterObj = $($element).parents(".qv-object");

            innerObj.css('background', 'transparent');
            outterObj.css('border', 'none');
            outterObj.find('.lui-icon--expand ').remove();

            //Selection Listener
            // create an object
            var selState = app.selectionState();
            var listener = function () {
                    currentSelections = selState.selections;
            };
            //bind the listener
            selState.OnData.bind(listener);


            $scope.popupDg = function () {
                qvangular.getService( "luiDialog" ).show( {
                    template: viewPopup,
                    controller: ["$scope", "$element", "$interval", function($scope, $element, $interval) {

                        $scope.stage = 'overview';

                        pullTaskHandler = $interval(function() {
                            hlp.doGetTasks(conn.server, conn.app).then(function(response) {
                                $scope.taskList = response.data.items;	
                                $scope.$apply();
                            });
                        }, 1000);

                        $scope.go2OverviewStage = function() {
                            $scope.stage = 'overview';
                        };

                        $scope.go2selectFormatStage = function(report) {
                            hlp.doGetExportFormats(conn.server, report.id).then(function(response) {
                                $scope.currReport = report;
                                $scope.outputFormats = response.data.outputFormats;
                                $scope.stage = 'selectFormat';
                                $scope.$apply();
                            });
                        };

                        $scope.go2SelectReportStage = function() {
                            hlp.doGetReportlist(conn.server, conn.app).then(function(response) {
                                $scope.reportList = response.data;
                                $scope.stage = 'selectReport';
                                $scope.$apply();
                            });
                        };

                        $scope.exportReport = function(format) {
                            var options = {
                                conn: conn,
                                report: $scope.currReport.id,
                                format: format
                            };
                            doExport(options).then(function(){
                                $scope.go2OverviewStage();
                            });
                        };
        
                        $scope.deleteTask = function(taskId) {
                            hlp.doDeleteTask(conn.server, taskId).then(function() {
                                $scope.go2OverviewStage();
                            });
                        };
        
                        $scope.downloadTask = function(taskId) {
                            hlp.downloadTask(conn.server, taskId);
                        };

                        $scope.cancel = function () {
                            $scope.close();
                        };
                    }],
                    input: {
                        stage: $scope.stage
                    },
                    closeOnEscape: true,

                }).closed.then(function() {
                    if (angular.isDefined(pullTaskHandler)) {
                        $interval.cancel(pullTaskHandler);
                        pullTaskHandler = undefined;
                    }
                });
            };
        }]
    };
});