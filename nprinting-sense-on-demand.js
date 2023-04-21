define([
        "jquery",
        "qlik",
        "./js/properties",
        "text!./css/nprinting-sense-on-demand.css",
        "text!./css/bootstrap.css",
        "text!./template/view-main-single.html",
        "text!./template/view-popup.html",
        //"client.models/current-selections",
        "qvangular",
        "core.utils/deferred",
        //"objects.backend-api/listbox-api",
        //"objects.models/listbox",
        "./js/button",
        "./js/dropdown",
        "./js/jsrsasign-all-min"
    ],
    function (
        $,
        qlik,
        properties,
        css,
        bootstrap,
        viewMain,
        viewPopup,
        //CurrentSelectionsModel,
        qvangular,
        Deferred
        //ListboxApi,
        //Listbox
    ) {
        $("<style>").html(css).appendTo("head");
        $("<style>").html(bootstrap).appendTo("head");

        $(".qui-buttonset-right").prepend($("<button class='lui-button lui-button--toolbar iconToTheRight npsod-bar-btn'><span data-icon='toolbar-print'>NPrinting Reports</span></button>"));

        var app = qlik.currApp();
        var currentSelections;
       


        function getLoginNtlm(conn) {
            var URL = conn.server + 'api/v1/login/ntlm'
            return $.ajax({
                url: URL,
                method: 'GET',
                xhrFields: {
                    withCredentials: true
                }
            });
        }

        function jwtClientAuthFn(conn, $scope) {
            if (conn.jwtPrivateKEY) {
                app.global.getAuthenticatedUser().then(function (reply) {
                    let user = reply.qReturn,
                        currUser = user.split("\\");
                    if (currUser.length === 1) {
                        currUser = user.split(";").map((section) => {
                            const values = section.split("=");
                            if (values.length > 1) {
                              return values[1].trim();
                            } else {
                              return values.trim();
                            }
                        });
                    }
                    const payload = {
                        "userId": currUser.length > 0 ? currUser[1].trim() : "Unknown",
                        "userDirectory": currUser[0].trim()
                    };
                    let token = '';
                    try {
                        token = KJUR.jws.JWS.sign("RS256", { "alg": "RS256", "typ": "JWT" }, JSON.stringify(payload), conn.jwtPrivateKEY);
                    } catch (e) {
                        alert('invalid private key');
                    }
                    if (token) {
                        return $.ajax({
                            url: conn.server + 'api/v1/apps?limit=0',
                            method: 'GET',
                            headers: {
                                Authorization: `Bearer ${token}`
                            },
                        }).then(() => {
                            setJwtAuthToken(token, $scope);
                        }).catch((err) => {
                            alert('invalid server connection, check console for details')
                            console.error(err)
                        })
                    }
                });
            }
        }

        function jwtServerAuthFn(conn, $scope) {
            var URL = conn.jwtServer
            if (!URL) return
            return app.global.getAuthenticatedUser(function(reply) {
                let user = reply.qReturn,
                currUser = user.split("\\");
                if (currUser.length === 1) {
                    currUser = user.split(";");
                }
                
                return $.ajax({
                    url: URL,
                    method: 'GET',
                    headers: {
                        qlikUser: user
                    },
                }).then(function({ token }) {
                    if (token) {
                        return $.ajax({
                            url: conn.server + 'api/v1/apps?limit=0',
                            method: 'GET',
                            headers: {
                                Authorization: `Bearer ${token}`
                            },
                        }).then(() => {
                            setJwtAuthToken(token, $scope);
                        }).catch((err) => {
                            alert('invalid server connection, check console for details')
                            console.error(err)
                        });
                    } else {
                        alert('invalid token');
                    }
                }).catch(function(err) {
                    alert('invalid server connection, check console for details')
                    console.error(err)
                })
            })
        }

        function setJwtAuthToken(token, $scope) {
            $scope.jwtAuthToken = token;
        }

        function clearJwtAuthToken($scope) {
            $scope.jwtAuthToken = undefined;
        }

        function getJwtAuthToken(conn, $scope) {
            if (conn.jwtAuth) {
                if ($scope.jwtAuthToken) {
                    return `Bearer ${$scope.jwtAuthToken}`;
                } else {
                    console.log('token does not exist, please try again!');
                    return 'token pending';
                }
            } else {
                return undefined;
            }
        }

        function logout(conn, $scope) {
            var URL = conn.server + 'api/v1/logout'
            return $.ajax({
                url: URL,
                method: 'GET',
                headers: {
                    Authorization: getJwtAuthToken(conn, $scope),
                },
                xhrFields: {
                    withCredentials: !getJwtAuthToken(conn, $scope),
                }
            });
        }

        var Progress = function (element) {
            var progress = 0;
            var bar = element;

            this.getProgress = function () {
                return progress;
            };

            this.setProgress = function (value) {
                progress = value;

                bar.css("width", progress + "%");
                bar.find("span").text(progress + '% Complete');
            };

            this.addProgress = function (increment) {
                if (progress + increment < 100) {
                    this.setProgress(progress + increment);
                }
            };
        }

        function checkProgress(URL, /*progress,*/ callback) {
            $.ajax({
                url: URL,
                method: 'GET',
                xhrFields: {
                    withCredentials: true
                }
            }).then(function (response) {
                switch (response.data.status) {
                    case 'aborted':
                    case 'failed':
                        alert('Error');
                        break;

                    case 'queued':
                    case 'running':
                        //progress.addProgress(10);
                        setTimeout(function () {
                            checkProgress(URL, progress, callback);
                        }, 1000);

                        break;

                    default:
                        //progress.setProgress(100);
                        callback();
                }
            });

        }

        function getSelectionByApi() {
            var fp = [];
            if(currentSelections === undefined){
                return Promise.resolve([]);
            }
            currentSelections.map(function (selection) {
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

        function getSelectionByQlik() {
            globalSelectionService = qvangular.getService('qvGlobalSelectionsService');

            return CurrentSelectionsModel.get().then(function (model) {
                return model.getLayout().then(function (layout) {
                    return getSelectedValuesByInternalService(layout, app.model.enigmaModel);
                });
            });
        }

        function getSelectedValuesByQlik(layout, enigmaModel) {
            var i, qSelections = layout.qSelectionObject ? layout.qSelectionObject.qSelections : null;
            var fieldPromises = [];

            if (qSelections && qSelections.length > 0) {

                var fieldExtractor = function (qFieldSelections, rects) {

                    var rects = [{
                        qTop: 0,
                        qLeft: 0,
                        qWidth: 1,
                        qHeight: qFieldSelections.selectedCount
                    }];

                    var fp = Listbox.createTransientField(enigmaModel, qFieldSelections.fieldName, {}).then(function (model) {
                        var backendApi = new ListboxApi(model);
                        return backendApi.getData(rects).then(function (dataPages) {
                            if (dataPages && dataPages.length) {
                                var valArr = dataPages[0].qMatrix;
                                var v;
                                for (var j = 0; j < valArr.length; j++) {
                                    v = valArr[j][0];
                                    var isNum = !isNaN(v.qNum);
                                    qFieldSelections.selectedValues.push(isNum ? v.qNum : v.qText);
                                    // set isNumeric if there is a number
                                    qFieldSelections.isNumeric = qFieldSelections.isNumeric || isNum;
                                }
                            }
                            return qFieldSelections;
                        });
                    });
                    return fp;
                };

                for (i = 0; i < qSelections.length; i++) {
                    var fieldSelections = {
                        fieldName: qSelections[i].qField,
                        selectedCount: qSelections[i].qSelectedCount,
                        selectedValues: [],
                        isNumeric: false
                    }
                    fieldPromises.push(fieldExtractor(fieldSelections));
                }
            }

            return Deferred.all(fieldPromises);
        }

        function doExport(options, $scope) {
            var conn = options.conn,
                report = options.report,
                format = options.format,

                selections = getSelectionByApi();
                //selections = getSelectionByQlik();

            return selections.then(function (allFieldSelections) {
                return getConnections(conn, $scope).then(function (response) {
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


                    var requestUrl = conn.server + 'api/v1/ondemand/requests';
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
                        crossDomain: true,
                        data: JSON.stringify(onDemandRequest),
                        headers: {
                            Authorization: getJwtAuthToken(conn, $scope),
                        },
                        xhrFields: {
                            withCredentials: !getJwtAuthToken(conn, $scope),
                        }
                    });
                });
            });
        }

        function getReportList(conn, $scope) {
            var requestUrl = conn.server + 'api/v1/reports' + '?appId=' + conn.app + '&sort=+title';

            return $.ajax({
                url: requestUrl,
                method: 'GET',
                headers: {
                    Authorization: getJwtAuthToken(conn, $scope),
                },
                xhrFields: {
                    withCredentials: !getJwtAuthToken(conn, $scope),
                }
            });
        }

        function getExportFormats(conn, report, $scope) {
            var requestUrl = conn.server + 'api/v1/reports' + '/' + report.id;
            return $.ajax({
                url: requestUrl,
                method: 'GET',
                headers: {
                    Authorization: getJwtAuthToken(conn, $scope),
                },
                xhrFields: {
                    withCredentials: !getJwtAuthToken(conn, $scope),
                }
            })
        }

        function getTasks(conn, $scope) {
            var requestUrl = conn.server + 'api/v1/ondemand/requests' + '?appId=' + conn.app + '&sort=-created';

            return $.ajax({
                url: requestUrl,
                method: 'GET',
                headers: {
                    Authorization: getJwtAuthToken(conn, $scope),
                },
                xhrFields: {
                    withCredentials: !getJwtAuthToken(conn, $scope),
                }
            });
        }

        function getConnections(conn, $scope) {
            var requestUrl = conn.server + 'api/v1/connections?appId=' + conn.app;

            return $.ajax({
                url: requestUrl,
                method: 'GET',
                headers: {
                    Authorization: getJwtAuthToken(conn, $scope),
                },
                xhrFields: {
                    withCredentials: !getJwtAuthToken(conn, $scope),
                }
            });
        }

        function deleteTask(conn, taskId, $scope) {
            var requestUrl = conn.server + 'api/v1/ondemand/requests/' + taskId;

            $.support.cors = true;

            return $.ajax({
                url: requestUrl,
                headers: {
                    'access-control-allow-headers': 'content-type',
                    Authorization: getJwtAuthToken(conn, $scope),
                },
                method: 'DELETE',
                xhrFields: {
                    withCredentials: !getJwtAuthToken(conn, $scope),
                }
            });
        }

        function downloadTask(conn, taskId) {
            var requestUrl = conn.server + 'api/v1/ondemand/requests/' + taskId + '/result';

            document.getElementById('download').src = requestUrl;
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
                    addons: {
                        uses: "addons",
                        items: {
                            dataHandling: {
                                uses: "dataHandling"
                            }
                        }
                    }
                }
            },

            template: viewMain,

            controller: ['$scope', '$element', '$compile', '$interval', function ($scope, $element, $compile, $interval) {
                //$scope.label = "Export";
                $scope.downloadable = false;
                var conn = $scope.layout.npsod.conn;
                // logout(conn, $scope);
                var currReport = null;
                var buttonPosition = ($scope.layout.npsod.button && $scope.layout.npsod.button.position) ? $scope.layout.npsod.button.position: 'top';
                $scope.buttonStyle = {'vertical-align': buttonPosition };

                $scope.objId = Math.floor(Math.random()*1000000);
                var x = document.createElement("var");
                x.id = $scope.objId;
                document.body.appendChild(x);

                var vars = document.getElementsByTagName('var');
                if(vars[0].id==$scope.objId){
                    if (conn.jwtAuth) {
                        if (!conn.jwtChannel || conn.jwtChannel === 'clientJWT') {
                            jwtClientAuthFn(conn, $scope);
                        } else if (conn.jwtChannel === 'serverJWT') {
                            jwtServerAuthFn(conn, $scope);
                        }
                    } else {
                        getLoginNtlm(conn);
                    }
                }

                $('.npsod-bar-btn').on('click', function () {
                    $scope.popupDg();
                });

                $scope.getJwtAuthToken = function(conn) {
                    return getJwtAuthToken(conn, $scope);
                };

                $scope.doExport = function () {
                    var options = {
                        conn: conn,
                        report: conn.report,
                        format: conn.exportFormat
                    };

                    doExport(options, $scope).then(function (response) {
                        $scope.popupDg();
                    });
                };

                $scope.popupDg = function () {
                    //exportReport(format, currReport);
                    if($('.npsod-popup').length==0){
                        var viewPopupDg = $compile(viewPopup);
                        $("body").append(viewPopupDg($scope));

                        var modal = $(".npsod-popup");
                        modal.find("button.cancel-button").on('qv-activate', function () {
                            modal.remove();
                            if (!!$scope.pullTaskHandler) {
                                $interval.cancel($scope.pullTaskHandler);
                                $scope.pullTaskHandler = undefined;
                                $scope.$apply();
                            }
                        });

                        $scope.go2OverviewStage(conn);
                        
                    }
                };

                $scope.getImg = getImg;

                $scope.go2OverviewStage = function () {
                    $scope.stage = 'overview';
                    if (!$scope.pullTaskHandler) {
                        $scope.pullTaskHandler = $interval(function () {
                            getTasks(conn, $scope).then(function (response) {
                                $scope.taskList = response.data.items;
                                $scope.$apply();
    
                                const hasInProgress = $scope.taskList.filter(t => ['running', 'queued'].includes(t.status)).length;
                                if (hasInProgress <= 0) {
                                    if (!!$scope.pullTaskHandler) {
                                        $interval.cancel($scope.pullTaskHandler);
                                        $scope.pullTaskHandler = undefined;
                                        $scope.$apply();
                                    }
                                }
                            });
                        }, 1000);
                    }
                };

                $scope.go2SelectReportStage = function () {
                    getReportList(conn, $scope).then(function (response) {
                        $scope.reportList = response.data;
                        $scope.stage = 'selectReport';
                        $scope.$apply();
                    });
                };

                $scope.go2selectFormatStage = function (report) {
                    getExportFormats(conn, report, $scope).then(function (response) {
                        $scope.currReport = report;
                        $scope.outputFormats = response.data.outputFormats;

                        $scope.stage = 'selectFormat';

                        $scope.$apply();
                    });
                };

                $scope.exportReport = function (format) {
                    var options = {
                        conn: conn,
                        report: $scope.currReport.id,
                        format: format
                    };

                    doExport(options, $scope).then(function () {
                        $scope.go2OverviewStage();
                    });
                };

                $scope.deleteTask = function (taskId) {
                    deleteTask(conn, taskId, $scope).then(function () {
                        $scope.go2OverviewStage(conn);
                    });
                };

                $scope.downloadTask = function (taskId) {
                    downloadTask(conn, taskId);
                };

                //Selection Listener
                // create an object
                var selState = app.selectionState();
                var listener = function () {
                    currentSelections = selState.selections;
                };
                //bind the listener
                selState.OnData.bind(listener);


                // Hacking the layout

                var innerObj = $($element).parents(".qv-inner-object");
                var outterObj = $($element).parents(".qv-object");

                innerObj.css('background', 'transparent');
                outterObj.css('border', 'none');
                outterObj.find('.lui-icon--expand ').remove();
            }],
            paint: function ($element, layout) {
                let $scope = this.$scope;
                var buttonPosition = (layout.npsod.button && layout.npsod.button.position) ? layout.npsod.button.position: 'top';
                $scope.buttonStyle = {'vertical-align': buttonPosition };
                $scope.DomId = layout.npsod.button.DomId;
                $scope.CSSConditionalClass = (layout.npsod.button.CSSConditionalClass || layout.npsod.button.CSSConditionalClass.length>0) ? layout.npsod.button.CSSConditionalClass : '';


                },
            /*
            paint: function($element) {
                var nprintingBase = 'https://nprinting.s-cubed.local:4993/api/v1';
                var onDemandRequest = {
                    type: "report",
                    config: {
                        reportId: "b6feb065-0fec-43b5-a238-43342fbc88e0",
                        outputFormat: "xls"
                    }
                };

                var button = createBtn("export", "Export");

                $element.html(button);

                var btnInstnace = $element.find("button")[0];

                $(btnInstnace).on('click', function($event) {
                    //alert("OK");
                    $.ajax({
                        url: nprintingBase + '/login/ntlm',
                        xhrFields: {
                            withCredentials: true
                        }
                    }).done(function(credential) {
                        $.ajax({
                            url: nprintingBase + '/ondemand/requests',
                            method: 'POST',
                            contentType: 'application/json',
                            data: JSON.stringify(onDemandRequest),
                            xhrFields: {
                                withCredentials: true
                            }
                        }).done(function(response) {
                            showLoading();

                            $element.append($('<iframe id="download" style="display:none;"></iframe>'));

                            setTimeout(function() {
                                document.getElementById('download').src = nprintingBase + '/ondemand/requests/' + response.data.id + '/result';

                                //window.location.assign()

                                $.ajax({
                                    url: nprintingBase + '/ondemand/requests/' + response.data.id + '/result',
                                    crossDomain: true,
                                    xhrFields: {
                                        withCredentials: true
                                    }
                                });

                            }, 5000);

                        });
                    });

                });
                //needed for export
                return qlik.Promise.resolve();
            }
            */
        };

    });
