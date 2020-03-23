define([
        "jquery",
        "qlik",
        "./js/jszip.min",
        "./js/jszip-util.min",
        "text!./template/view-main-single.html",
        "text!./template/view-popup.html",
        "text!./template/np-btn.html",
        "core.utils/deferred",
        "./js/button",
        "./js/dropdown",
        "./properties",
        "css!./css/main.min.css",
        "css!./css/bootstrap.min.css",
    ],
    function (
        $,
        qlik,
        JSZip,
        JSZipUtils,
        viewMain,
        viewPopup,
        npBtn,
        Deferred
    ) {
        "use strict";

        console.log(FileSaver);

        let app = qlik.currApp();
        let currentSelections;


        function getLoginNtlm(conn) {
            let URL = conn.server + 'api/v1/login/ntlm'
            return $.ajax({
                url: URL,
                method: 'GET',
                xhrFields: {
                    withCredentials: true
                }
            });
        }

        function getSelectionByApi() {
            let fp = [];
            if (currentSelections === undefined) {
                return Promise.resolve([]);
            }
            currentSelections.map(function (selection) {
                fp.push(getSelectedValues(selection));
            });

            return Deferred.all(fp);
        }

        function getSelectedValues(selection) {
            let df = Deferred(),
                f = app.field(selection.fieldName).getData(),
                listener = function () {
                    let isNumeric = false,
                        selectedValues = f.rows.reduce(function (result, row) {
                            if (row.qState === 'S' || row.qState === 'L') {
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
            let conn = options.conn,
                report = options.report,
                format = options.format,

                selections = getSelectionByApi();

            return selections.then(function (allFieldSelections) {
                return getConnections(conn).then(function (response) {
                    let connectionId;
                    if (response.data.totalItems == 1) {
                        connectionId = response.data.items[0].id;
                    } else {
                        for (let i = 0; i < response.data.items.length; i++) {
                            let appId = response.data.items[i].appId;

                            if (appId == conn.app) {
                                connectionId = response.data.items[i].id;
                                break;
                            }
                        }
                    }


                    let requestUrl = conn.server + 'api/v1/ondemand/requests';
                    let onDemandRequest = {
                        type: 'report',
                        config: {
                            reportId: report,
                            outputFormat: format
                        },
                        selections: allFieldSelections,
                        // here's the sense connection on which we want to apply selections
                        connectionId: connectionId //'5c0af3f6-e65d-40d2-8f03-6025f8196ff'
                    };

                    return $.ajax({
                        url: requestUrl,
                        method: 'POST',
                        contentType: 'application/json',
                        crossDomain: true,
                        data: JSON.stringify(onDemandRequest),
                        xhrFields: {
                            withCredentials: true
                        }
                    });
                });
            });
        }

        function getReportList(conn) {
            let requestUrl = conn.server + 'api/v1/reports' + '?appId=' + conn.app + '&sort=+title';

            return $.ajax({
                url: requestUrl,
                method: 'GET',
                xhrFields: {
                    withCredentials: true
                }
            });
        }

        function getExportFormats(conn, report) {
            let requestUrl = conn.server + 'api/v1/reports' + '/' + report.id;
            return $.ajax({
                url: requestUrl,
                method: 'GET',
                xhrFields: {
                    withCredentials: true
                }
            })
        }

        function getTasks(conn) {
            let requestUrl = conn.server + 'api/v1/ondemand/requests' + '?appId=' + conn.app + '&sort=-created';

            return $.ajax({
                url: requestUrl,
                method: 'GET',
                xhrFields: {
                    withCredentials: true
                }
            });
        }

        function getConnections(conn) {
            let requestUrl = conn.server + 'api/v1/connections?appId=' + conn.app;

            return $.ajax({
                url: requestUrl,
                method: 'GET',
                xhrFields: {
                    withCredentials: true
                }
            });
        }

        function deleteTask(conn, taskId) {
            let requestUrl = conn.server + 'api/v1/ondemand/requests/' + taskId;

            $.support.cors = true;

            return $.ajax({
                url: requestUrl,
                headers: {
                    'access-control-allow-headers': 'content-type'
                },
                method: 'DELETE',
                xhrFields: {
                    withCredentials: true
                }
            });
        }

        var saveBlob = (function () {
            var a = document.createElement("a");
            document.body.appendChild(a);
            a.style = "display: none";
            return function (blob, fileName) {
                var url = window.URL.createObjectURL(blob);
                a.href = url;
                a.download = fileName;
                a.click();
                window.URL.revokeObjectURL(url);
            };
        }());

        function downloadTask(conn, taskId, currentTask) {
            let requestUrl = conn.server + 'api/v1/ondemand/requests/' + taskId + '/result';

            if (currentTask && currentTask.outputFormat === "HTML" & conn.autoUnzip) {
                var promise = new qlik.Promise(function (resolve, reject) {
                    JSZipUtils.getBinaryContent(requestUrl, function (err, data) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(data);
                        }
                    });
                });

                promise.then(JSZip.loadAsync)
                    .then(function (zip) {
                        let hits = Object.keys(zip.files).filter(function (filename) {
                            return filename.endsWith(".Html");
                        });

                        if (hits.length > 0) {
                            let htmlFile = zip.file(hits[0]);

                            htmlFile.async("blob").then(function (blob) {
                                saveBlob(blob, currentTask.title + ".html");
                            });
                        } else {
                            alert("No HTML found in zip");
                        }
                    });
            } else {
                document.getElementById('download').src = requestUrl;
            }
        }

        function getImg(type) {
            switch (type) {
                //Tempate formats
                case 'Excel':
                    return '../extensions/nprinting-sense-on-demand/images/icon-template-excel.png';
                case 'PowerPoint':
                    return '../extensions/nprinting-sense-on-demand/images/icon-template-ppt.png';
                case 'Html':
                    return '../extensions/nprinting-sense-on-demand/images/icon-template-html.png';
                case 'Word':
                    return '../extensions/nprinting-sense-on-demand/images/icon-template-word.png';
                case 'QlikEntity':
                    return '../extensions/nprinting-sense-on-demand/images/icon-template-qlik.png';

                    //Export formats
                case 'PDF':
                    return '../extensions/nprinting-sense-on-demand/images/icon-file-pdf.png';
                case 'HTML':
                    return '../extensions/nprinting-sense-on-demand/images/icon-file-html.png';
                case 'DOC':
                    return '../extensions/nprinting-sense-on-demand/images/icon-file-doc.png';

                case 'PPT':
                    return '../extensions/nprinting-sense-on-demand/images/icon-file-ppt.png';

                case 'XLS':
                    return '../extensions/nprinting-sense-on-demand/images/icon-file-xls.png';

                case 'DOCX':
                    return '../extensions/nprinting-sense-on-demand/images/icon-file-docx.png';

                case 'PPTX':
                    return '../extensions/nprinting-sense-on-demand/images/icon-file-pptx.png';

                case 'XLSX':
                    return '../extensions/nprinting-sense-on-demand/images/icon-file-xlsx.png';

                case 'CSV':
                    return '../extensions/nprinting-sense-on-demand/images/icon-file-csv.png';

                case 'JPEG':
                    return '../extensions/nprinting-sense-on-demand/images/icon-file-jpeg.png';

                case 'PNG':
                    return '../extensions/nprinting-sense-on-demand/images/icon-file-png.png';

                case 'TIFF':
                    return '../extensions/nprinting-sense-on-demand/images/icon-file-tiff.png';
                case 'BMP':
                    return '../extensions/nprinting-sense-on-demand/images/icon-file-bmp.png';

                case 'LOADING':
                    return '../extensions/nprinting-sense-on-demand/images/loading-gear.gif';
                default:
                    return '../extensions/nprinting-sense-on-demand/images/icon-template-pp.png';
            }
        }

        //If preload is set to true, then start a silent export.
        function checkPreload($scope) {
            let report = $scope.layout.npsod.conn.report;

            if ($scope.layout.npsod.conn.doPreload && report) {
                let preloaded = $("body").data("preloaded") || [];
                if (preloaded.indexOf(report) > -1) {
                    console.log(`Report: [${report}] already preloaded`)
                } else {
                    console.log(`Report: [${report}] start to preload`)
                    $scope.doExport(true);
                    preloaded.push(report);
                    $("body").data("preloaded", preloaded);
                }
            }
        }

        return {
            support: {
                snapshot: false,
                export: false,
                exportData: false
            },

            definition: {
                type: "items",
                label: "NPrinting On Demand",
                component: "accordion",
                items: {
                    connectionSection: connectionSection,
                    ReportSection: ReportSection,
                    Appearance: AppearanceSection,
                    addons: AddonSection
                }
            },

            template: viewMain,

            updateData: function () {
                let $scope = this.$scope;
                if ($(".npsod-top-bar").length < 1 && $scope.layout.npsod.conn.selfService) {
                    $(".qs-toolbar__right").prepend($(npBtn)).find('.npsod-bar-btn').on('click', function () {
                        $scope.popupDg();
                    });
                } else {
                    $('.npsod-bar-btn').off();
                    $(".npsod-top-bar").remove();
                }

                return qlik.Promise.resolve();
            },

            controller: ['$scope', '$element', '$compile', '$interval', '$timeout', function ($scope, $element, $compile, $interval, $timeout) {
                //$scope.label = "Export";
                $scope.downloadable = false;
                $scope.npodStatus = "idle";
                $scope.currentTaskId = null;

                let conn = $scope.layout.npsod.conn;
                let buttonPosition = ($scope.layout.npsod.button && $scope.layout.npsod.button.position) ? $scope.layout.npsod.button.position : 'top';
                $scope.buttonStyle = {
                    'vertical-align': buttonPosition
                };

                $scope.doExport = function (isPreload) {
                    let mode = $scope.layout.npsod.button.mode;
                    let options = {
                        conn: conn,
                        report: conn.report,
                        format: conn.exportFormat
                    };

                    //Do preload and leave it running silently
                    if (isPreload) {
                        doExport(options);
                        return;
                    }

                    if (!mode || mode === "popup") {
                        doExport(options).then(function (response) {
                            $scope.popupDg();
                        });
                    } else if (mode === "single") {
                        doExport(options).then(function (reply) {
                            let taskId = reply.data.id;
                            let pullTaskHandler = function () {
                                getTasks(conn).then(function (reply) {
                                    let currentTask;
                                    let task = reply.data.items.forEach(function (i) {
                                        if (i.id !== taskId) {
                                            deleteTask(conn, i.id);
                                        } else {
                                            currentTask = i;
                                        }
                                    });

                                    switch (currentTask.status) {
                                        case "completed":
                                            $scope.npodStatus = "idle";
                                            $scope.currentTaskId = null;
                                            downloadTask(conn, currentTask.id, currentTask);
                                            break;

                                        default:
                                            $timeout(pullTaskHandler, 1000);
                                    }
                                });
                            };

                            $scope.npodStatus = "working";
                            $scope.currentTaskId = taskId;
                            pullTaskHandler();
                        });
                    }
                };

                $scope.popupDg = function () {
                    //exportReport(format, currReport);
                    if ($('.npsod-popup').length == 0) {
                        let viewPopupDg = $compile(viewPopup);
                        $("body").append(viewPopupDg($scope));

                        let modal = $(".npsod-popup");
                        modal.find("button.cancel-button").on('qv-activate', function () {
                            modal.remove();
                            if (angular.isDefined(pullTaskHandler)) {
                                $interval.cancel(pullTaskHandler);
                                pullTaskHandler = undefined;
                            }
                        });

                        let pullTaskHandler = $interval(function () {
                            getTasks(conn).then(function (response) {
                                $scope.taskList = response.data.items;
                                $scope.$apply();
                            });
                        }, 1000);

                        $scope.go2OverviewStage(conn);

                    }
                };

                $scope.getImg = getImg;

                $scope.go2OverviewStage = function () {
                    $scope.stage = 'overview';
                };

                $scope.go2SelectReportStage = function () {
                    getReportList(conn).then(function (response) {
                        $scope.reportList = response.data;
                        $scope.stage = 'selectReport';
                        $scope.$apply();
                    });
                };

                $scope.go2selectFormatStage = function (report) {
                    getExportFormats(conn, report).then(function (response) {
                        $scope.currReport = report;
                        $scope.outputFormats = response.data.outputFormats;

                        $scope.stage = 'selectFormat';

                        $scope.$apply();
                    });
                };

                $scope.exportReport = function (format) {
                    let options = {
                        conn: conn,
                        report: $scope.currReport.id,
                        format: format
                    };

                    doExport(options).then(function () {
                        $scope.go2OverviewStage();
                    });
                };

                $scope.deleteTask = function (taskId) {
                    $scope.npodStatus = "deleting";

                    if (taskId) {
                        let mode = $scope.layout.npsod.button.mode;

                        deleteTask(conn, taskId).then(function () {

                            if (mode === "single") {
                                $scope.npodStatus = "idle";
                                $scope.currentTaskId = null;
                            } else {
                                $scope.go2OverviewStage(conn);
                            }
                        });
                    }
                };

                $scope.downloadTask = function (taskId) {
                    downloadTask(conn, taskId);
                };

                //Selection Listener
                // create an object
                let selState = app.selectionState();
                let listener = function () {
                    currentSelections = selState.selections;
                };
                //bind the listener
                selState.OnData.bind(listener);


                //Authenticate NPSOD
                let auth = $("body").data("npsodAuth");
                if (!auth) {
                    getLoginNtlm(conn).then(function () {
                        $("body").data("npsodAuth", true);

                        checkPreload($scope);
                    });
                } else {
                    checkPreload($scope);
                }

                // Hacking the layout

                let innerObj = $($element).parents(".qv-inner-object");
                let outterObj = $($element).parents(".qv-gridcell");

                innerObj.css('background', 'transparent');
                outterObj.find('.lui-icon--expand ').hide();
            }],
            paint: function ($element, layout) {
                let $scope = this.$scope;
                let buttonPosition = (layout.npsod.button && layout.npsod.button.position) ? layout.npsod.button.position : 'top';
                $scope.buttonStyle = {
                    'vertical-align': buttonPosition
                };
                $scope.DomId = layout.npsod.button.DomId;
                $scope.CSSConditionalClass = (layout.npsod.button.CSSConditionalClass || layout.npsod.button.CSSConditionalClass.length > 0) ? layout.npsod.button.CSSConditionalClass : '';
            },
            beforeDestroy: function () {
                $(".npsod-top-bar").off().remove();
            }
        };
    });