define([
		"jquery",
		"qlik",
		"./js/properties",
		"text!./css/nprinting-sense-on-demand.css",
		"text!./css/bootstrap.css",
		"text!./template/view-main-single.html",
		"text!./template/view-popup.html",
        "client.models/current-selections",
        "qvangular",
        "core.utils/deferred",
        "objects.backend-api/listbox-api",
        "objects.models/listbox",
        "./js/button",
		"./js/dropdown"
	],
	function(
		$,
		qlik,
		properties,
		css,
		bootstrap,
		viewMain,
		viewPopup,
        CurrentSelectionsModel,
        qvangular,
        Deferred,
        ListboxApi,
        Listbox
	) {
		$("<style>").html(css).appendTo("head");
		$("<style>").html(bootstrap).appendTo("head");

		$(".qui-buttonset-right").prepend($("<button class='lui-button lui-button--toolbar iconToTheRight npsod-bar-btn'><span data-icon='toolbar-print'></span></button>"));

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

		var Progress = function(element) {
			var progress = 0;
			var bar = element;

			this.getProgress = function() {
				return progress;
			};

			this.setProgress = function(value) {
				progress = value;

				bar.css("width", progress + "%");
				bar.find("span").text(progress + '% Complete');
			};

			this.addProgress = function(increment) {
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
			}).then(function(response) {
				switch (response.data.status) {
					case 'aborted':
					case 'failed':
						alert('Error');
						break;

					case 'queued':
					case 'running':
						//progress.addProgress(10);
						setTimeout(function() {
							checkProgress(URL, progress, callback);
						}, 1000);

						break;

					default:
						//progress.setProgress(100);
						callback();
				}
			});

		}

        function getSelections(layout, enigmaModel) {
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
                    var fieldSelections ={
                        fieldName: qSelections[i].qField,
                        selectedCount:qSelections[i].qSelectedCount,
                        selectedValues:[],
                        isNumeric: false
                    }
                    fieldPromises.push(fieldExtractor(fieldSelections));
                }
            }

            return Deferred.all(fieldPromises);
        }

		function doExport(conn, report, format) {
            var app = qlik.currApp();

            globalSelectionService = qvangular.getService('qvGlobalSelectionsService');

            var selections = CurrentSelectionsModel.get().then(function (model) {
                return model.getLayout().then(function (layout) {
                    return getSelections(layout, app.model.enigmaModel);
                });
            });

            // return getConnections(conn).then(function(response){
            // 	var connectionId;
            // 	if(response.data.totalItems = 1){
            // 		connectionId = response.data.items[0].id;
            // 	} else {
            // 		for(var i=0; i<response.data.items.length; i++){
            // 			var str = response.data.items[i].connectionString,
            // 				appId = str.split("appid=")[1].split(";")[0];

            // 			if(appId == conn.app){
            // 				connectionId = response.data.items[i].id;
            // 				break;
            // 			}
            // 		}
            // 	}
            // });

            return selections.then(function (allFieldSelections) {
            		return getConnections(conn).then(function(response){
            			var connectionId;
		            	if(response.data.totalItems == 1){
		            		connectionId = response.data.items[0].id;
		            	} else {
		            		for(var i=0; i<response.data.items.length; i++){
		            			var str = response.data.items[i].connectionString,
		            				appId = str.split("appid=")[1].split(";")[0];

		            			if(appId == conn.app){
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
	                        data: JSON.stringify(onDemandRequest),
	                        xhrFields: {
	                            withCredentials: true
	                        }
	                    });
            		});         
                }
            )

			/*.then(function(response) {
				var progress = new Progress($("#npsod-progress-bar"));

				checkProgress(URL + '/' + response.data.id, progress, function() {
					$scope.downloadURL = URL + '/' + response.data.id + '/result';
					$scope.downloadable = true;
					$scope.$apply();
				});
			});
			*/

		}

		function getReportList(conn) {
			var requestUrl = conn.server + 'api/v1/reports' + '?appId=' + conn.app + '&sort=+title';

			return $.ajax({
				url: requestUrl,
				method: 'GET',
				xhrFields: {
					withCredentials: true
				}
			});
		}

		function getExportFormats(conn, report) {
			var requestUrl = conn.server + 'api/v1/reports' + '/' + report.id;
			return $.ajax({
				url: requestUrl,
				method: 'GET',
				xhrFields: {
					withCredentials: true
				}
			})
		}

		function getTasks(conn) {
			var requestUrl = conn.server + 'api/v1/ondemand/requests' + '?appId=' + conn.app + '&sort=-created';

			return $.ajax({
				url: requestUrl,
				method: 'GET',
				xhrFields: {
					withCredentials: true
				}
			});
		}

		function getConnections(conn) {
			var requestUrl = conn.server  + 'api/v1/connections?appId=' + conn.app;

			return $.ajax({
				url: requestUrl,
				method: 'GET',
				xhrFields: {
					withCredentials: true
				}
			});
		}

		function deleteTask(conn, taskId){
			var requestUrl = conn.server + 'api/v1/ondemand/requests/' + taskId;

			$.support.cors = true;

			return $.ajax({
				url: requestUrl,
				headers:{
					'access-control-allow-headers':'content-type'
				},
				method: 'DELETE',
				xhrFields: {
					withCredentials: true
				}
			});
		}

		function downloadTask(conn, taskId){
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
					//return '../resources/img/core/loader.svg';
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
					Appearance: AppearanceSection
				}
			},

			template: viewMain,

			controller: ['$scope', '$element', '$compile', '$interval', function($scope, $element, $compile, $interval) {
				//$scope.label = "Export";
				$scope.downloadable = false;

				var conn = $scope.layout.npsod.conn;
				var currReport = null;

				getLoginNtlm(conn);

				$('.npsod-bar-btn').on('click', function(){
					$scope.popupDg();
				});

				$scope.doExport = function() {
					doExport(conn, conn.report, conn.exportFormat).then(function(response){
						$scope.popupDg();
					});
				};


				$scope.popupDg = function() {
					//exportReport(format, currReport);
					var viewPopupDg = $compile(viewPopup);
					$("body").append(viewPopupDg($scope));

					var modal = $(".npsod-popup");
					modal.find("button.cancel-button").on('qv-activate', function() {
						modal.remove();
						if(angular.isDefined(pullTaskHandler)){
							$interval.cancel(pullTaskHandler);
							pullTaskHandler = undefined;
						}
					});

					var pullTaskHandler = $interval(function(){
							getTasks(conn).then(function(response) {
								$scope.taskList = response.data.items;						
								$scope.$apply();
						});
					}, 1000);

					$scope.go2OverviewStage(conn);		
				};

				$scope.getImg = getImg;

				$scope.go2OverviewStage = function() {
					$scope.stage = 'overview';
				};

				$scope.go2SelectReportStage = function() {
					getReportList(conn).then(function(response) {
						$scope.reportList = response.data;
						$scope.stage = 'selectReport';
						$scope.$apply();
					});
				};

				$scope.go2selectFormatStage = function(report) {
					getExportFormats(conn, report).then(function(response) {
						$scope.currReport = report;
						$scope.outputFormats = response.data.outputFormats;

						$scope.stage = 'selectFormat';

						$scope.$apply();
					});
				};

				$scope.exportReport = function(format) {
					doExport(conn, $scope.currReport.id, format).then(function(){
						$scope.go2OverviewStage();
					});
				};

				$scope.deleteTask = function(taskId) {
					deleteTask(conn, taskId).then(function(){
						$scope.go2OverviewStage(conn);
					});
				};

				$scope.downloadTask = function(taskId) {
					downloadTask(conn, taskId);
				};


				// Hacking the layout

				var innerObj = $($element).parents(".qv-inner-object");
				var outterObj = $($element).parents(".qv-object");

				innerObj.css('background', 'transparent');
				outterObj.css('border', 'none');
				outterObj.find('.lui-icon--expand ').remove();
			}]

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