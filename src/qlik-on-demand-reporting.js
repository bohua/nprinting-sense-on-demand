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
            df.reject({message: '', status: 1});
            return df.promise;
        }

        if (!report || !format) {
            df.reject({message: 'Missing template or format', status: 400});
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

            var conn = $scope.layout.npsod.conn;
            var pullTaskHandler = null;

            function canInteract() {
                return $scope.object && $scope.object.getInteractionState() === 1;
            };

            $scope.showDialog = function() {
                if (canInteract()) {
                    $scope.popupDg();
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

                        $scope.disableNewReport = false;
                        $scope.stage = '';
                        $scope.loadingMessage = '';
                        $scope.errorMessage = '';
                        $scope.loadingCount = 0;
                        var responseCompare = '';

                        function getTasks () {
                            return hlp.doGetTasks(conn.server, conn.app).then(function(response) {
                                if (!response.data) {
                                    return;
                                }

                                var responseString = JSON.stringify(response.data.items);
                                if (responseString !== responseCompare) {
                                    responseCompare = responseString;
                                    $scope.taskList = response.data.items;

                                    // Start polling the tasks for updates until there are no
                                    // running tasks (which means there will be no further updates)
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
                                onError(err);
                            });
                        }

                        function anyRunningTasks() {
                            return $scope.taskList.some(function (item) {
                                return item.status === "running"
                            });
                        }

                        function onCreateNewReport() {
                            $scope.errorMessage = '';
                        }

                        function onLoading(message) {
                            $scope.loadingMessage = message;
                            $scope.stage = 'loading';
                        };

                        function onError(err) {
                            if (err.status === 0 || err.status === 404) {
                                $scope.disableNewReport = true;
                                $scope.errorMessage = 'Unable to connect to server.';
                            } else if (err.status === 400) {
                                $scope.errorMessage = 'Incomplete configuration.';
                            } else {
                                $scope.errorMessage = 'Unknown error.';
                            }
                            $scope.go2OverviewStage(false);
                        }

                        $scope.go2OverviewStage = function(refresh) {
                            if (refresh) {
                                onLoading('Refreshing data...');
                                getTasks().then(function () {
                                    $scope.stage = 'overview';
                                });
                            } else {
                                $scope.stage = 'overview';
                            }
                        };

                        $scope.go2SelectReportStage = function() {
                            onCreateNewReport();
                            onLoading('Fetching reports...');
                            hlp.doGetReportlist(conn.server, conn.app).then(function(response) {
                                $scope.reportList = response.data;
                                $scope.stage = 'selectReport';
                                $scope.$apply();
                            }).catch(function (err) {
                                onError(err);
                            });
                        };

                        $scope.go2selectFormatStage = function(report) {
                            onLoading('Fetching formats...');
                            hlp.doGetExportFormats(conn.server, report.id).then(function(response) {
                                $scope.currReport = report;
                                $scope.outputFormats = response.data.outputFormats;
                                $scope.stage = 'selectFormat';
                                $scope.$apply();
                            }).catch(function (err) {
                                onError(err);
                            });
                        };

                        $scope.exportReport = function(format) {
                            onLoading('Initializing report...');
                            var options = {
                                conn: conn,
                                report: $scope.currReport.id,
                                format: format
                            };
                            doExport(options).then(function () {
                                $scope.go2OverviewStage(true);
                            }).catch(function (err) {
                                onError(err);
                            });
                        };

                        $scope.deleteTask = function(task) {
                            if (currentActions.delete[task.id]) {
                                // Already deleting this task
                                return;
                            }
                            currentActions.delete[task.id] = true;
                            var previousStatus = task.status;
                            task.status = 'deleting';
                            hlp.doDeleteTask(conn.server, task.id).then(function() {
                                delete currentActions.delete[task.id];
                                getTasks();
                            }).catch(function () {
                                task.status = previousStatus;
                                delete currentActions.delete[task.id];
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

                        // Authenticate the user when opening
                        onLoading('Connecting...');
                        hlp.getLoginNtlm(conn.server).then(function () {
                            $scope.go2OverviewStage(true);
                        }).catch(function (err) {
                            onError(err);
                        });
                    }],
                    input: {
                        stage: $scope.stage
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