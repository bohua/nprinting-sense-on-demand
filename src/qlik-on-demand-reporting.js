/**
 * @license
 * Copyright (c) 2018 S-cubed Aps DK. All rights reserved.
 * 
 * Copyrights licensed under the terms of the MIT license.
 * Original source <https://github.com/bohua/nprinting-sense-on-demand>
 */
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
    var currentActions = {
        export: {},
        delete: {},
        download: null,
    };

    function getSelectionByApi() {
        var fp = [];
        currentSelections.map(function(selection) {
            fp.push(getSelectedValues(selection));
        });

        return Deferred.all(fp);
    }

    function getSelectedValues(selection) {
        var df = Deferred(),
        f = app.field(selection.fieldName).getData({rows: selection.totalCount}),
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
        df = Deferred();

        if (currentActions.export[report]) {
            // Aldready creating this report
            df.reject();
            return df.promise;
        }

        currentActions.export[report] = true;
        getSelectionByApi().then(function(allFieldSelections) {
            if (!conn.server) {
                throw "Server Connection is not specified";
            }

            var connectionIdTask = [];
            if (!conn.id) {
                if (!conn.app) {
                    throw "App is not specified";
                }

                // Connection id will not be specified for users who used the previous version,
                // so to make sure we don't break anything, get the first valid Connection
                // (as before, but now we're making sure it is a valid Connection)
                connectionIdTask.push(hlp.getConnections(conn.server, conn.app));
            }

            return Promise.all(connectionIdTask).then(function (result) {
                var connections = result.shift();
                if (connections && connections.length > 0) {
                    conn.id = connections[0].id;
                }
                var requestUrl = hlp.doGetActionURL(conn.server, 'api/v1/ondemand/requests');
                var onDemandRequest = {
                    type: 'report',
                    config: {
                        reportId: report,
                        outputFormat: format
                    },
                    selections: allFieldSelections,
                    connectionId: conn.id
                };
                return $.ajax({
                    url: requestUrl,
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify(onDemandRequest),
                    xhrFields: {
                        withCredentials: true
                    }
                }).then(function() {
                    df.resolve();
                });
            });
        }).catch(function(err) {
            df.reject(err);
        }).finally(function() {
            delete currentActions.export[report];
        });

        return df.promise;
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
            $scope.setLoading = function () {};

            var conn = $scope.layout.npsod.conn;
            var pullTaskHandler = null;

            function canInteract() {
                return $scope.object && $scope.object.getInteractionState() === 1;
            };

            $scope.showDialog = function() {
                if (canInteract()) {
                    hlp.getLoginNtlm(conn.server).then(function () {
                        $scope.popupDg();
                    });
                }
            };

            // Workaround for Apple touch devices, iPad etc
            if (typeof $scope.FirstTime == "undefined") {
                $scope.FirstTime = true;
                var clickHandler = 'ontouchstart' in document.documentElement ? "touchstart" : "click";
                var Btn = $($element).find("button.lui-button");
                Btn.bind(clickHandler, $scope.showDialog);
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
                qvangular.getService( "luiDialog" ).show({
                    template: viewPopup,
                    controller: ["$scope", "$interval", function($scope, $interval) {

                        $scope.disableNewReport = true;
                        $scope.message = '';
                        var responseCompare = '';
                        var loadTimeout = null;

                        getTasks();
                        function getTasks () {
                            setLoading();

                            return hlp.doGetTasks(conn.server, conn.app).then(function(response) {
                                $scope.go2OverviewStage();
                                setNotLoading(null);
                                if (!response.data) {
                                    return;
                                }

                                var responseString = JSON.stringify(response.data.items);
                                if (responseString !== responseCompare) {
                                    responseCompare = responseString;
                                    $scope.taskList = response.data.items;

                                    $scope.$apply();

                                    if (anyRunningTasks()) {
                                        if (!pullTaskHandler) {
                                            pullTaskHandler = $interval(function() {
                                                getTasks();
                                            }, 1000);
                                        }
                                    } else if (pullTaskHandler) {
                                        $interval.cancel(pullTaskHandler);
                                        pullTaskHandler = null;
                                    }
                                }
                            }).catch(function (err) {
                                setNotLoading(err);
                            });
                        }

                        function anyRunningTasks() {
                            return $scope.taskList.some(function (item) { return item.status === "running" });
                        }

                        function initExportSequence(options) {
                            $scope.stage = '';
                            setLoading();

                            return doExport(options).then(function () {
                                $scope.go2OverviewStage();
                                getTasks();
                            }).catch(function (err) {
                                $scope.go2OverviewStage();
                                setNotLoading(err);
                            });
                        }

                        function setLoading() {
                            if (!loadTimeout) {
                                $scope.disableNewReport = true;
                                loadTimeout = setTimeout(function () {
                                    $scope.isLoading = true;
                                    $scope.showLoader = true;
                                    $scope.message = 'Fetching data...';
                                }, 200);
                            }
                        }

                        function setNotLoading(err) {
                            clearTimeout(loadTimeout);
                            $scope.isLoading = false;
                            $scope.showLoader = false;

                            if (err) {
                                if (typeof err === 'string') {
                                    $scope.disableNewReport = true;
                                    $scope.message = 'Unable to connect to server.';
                                } else if (err.status === 400) {
                                    $scope.message = 'Incomplete configuration.';
                                } else {
                                    $scope.message = 'Unknown error.';
                                }
                            } else {
                                $scope.disableNewReport = false;
                                $scope.message = '';
                            }
                        }

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
                            initExportSequence(options);
                        };

                        $scope.deleteTask = function(taskId) {
                            if (currentActions.delete[taskId]) {
                                // Already deleting this task
                                return;
                            }
                            currentActions.delete[taskId] = true;
                            hlp.doDeleteTask(conn.server, taskId).then(function() {
                                delete currentActions.delete[taskId];
                                $scope.go2OverviewStage();
                                getTasks();
                            }).catch(function () {
                                delete currentActions.delete[taskId];
                            });
                        };

                        $scope.downloadTask = function(taskId) {
                            if (currentActions.download == taskId) {
                                // The current download is for the given task
                                return;
                            }
                            currentActions.download = taskId;
                            hlp.downloadTask(conn.server, taskId).finally(function() {
                                currentActions.download = null;
                            });
                        };

                        $scope.cancel = function () {
                            $scope.close();
                        };
                    }],
                    input: {
                        stage: $scope.stage,
                        setLoading: $scope.setLoading
                    },
                    closeOnEscape: true,

                }).closed.then(function() {
                    if (pullTaskHandler) {
                        $interval.cancel(pullTaskHandler);
                        pullTaskHandler = null;
                    }
                });
            };
        }]
    };
});