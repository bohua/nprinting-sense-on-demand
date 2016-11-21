define([
		"jquery",
		"qlik",
		"./js/properties",
		"text!./css/nprinting-sense-on-demand.css",
		"text!./css/bootstrap.css",
		"text!./template/view-main.html",
		"text!./template/view-popup.html",
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
		viewPopup
	) {
		$("<style>").html(css).appendTo("head");
		$("<style>").html(bootstrap).appendTo("head");

		$(".qui-buttonset-right").prepend($("<button class='lui-button lui-button--toolbar iconToTheRight'><span data-icon='toolbar-print'></span></button>"));

		function getLoginNtlm(conn){
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

		function checkProgress(URL, progress, callback) {
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
						progress.addProgress(10);
						setTimeout(function() {
							checkProgress(URL, progress, callback);
						}, 500);

						break;

					default:
						progress.setProgress(100);
						callback();
				}
			});

		}

		function doExport(URL, report, format, $scope) {
			var onDemandRequest = {
				type: "report",
				config: {
					reportId: report,
					outputFormat: format == 'DEFAULT' ? 'XLS' : format
				}
			};

			$.ajax({
				url: URL,
				method: 'POST',
				contentType: 'application/json',
				data: JSON.stringify(onDemandRequest),
				xhrFields: {
					withCredentials: true
				}
			}).then(function(response) {
				var progress = new Progress($("#npsod-progress-bar"));

				checkProgress(URL + '/' + response.data.id, progress, function() {
					$scope.downloadURL = URL + '/' + response.data.id + '/result';
					$scope.downloadable = true;
					$scope.$apply();
				});
			});

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
					connectionSection: connectionSection
				}
			},

			template: viewMain,

			controller: ['$scope', '$element', '$compile', function($scope, $element, $compile) {
				$scope.label = "Export";
				$scope.downloadable = false;

				var conn = $scope.layout.npsod.conn;
				var currReport = null;

				$scope.popupDg = function(format) {
					//exportReport(format, currReport);
					var viewPopupDg = $compile(viewPopup);
					$("body").append(viewPopupDg($scope));

					var modal = $(".npsod-popup");
					modal.find("button.cancel-button").on('qv-activate', function() {
						modal.remove();
					});

					getReportList(conn).then(function(response) {
						$scope.reportList = response.data;
						$scope.stage = 'selectReport';
						$scope.$apply();
					});


					$scope.getImg = getImg;
				};

				$scope.go2selectReportStage = function(report) {
					var requestUrl = conn.server + 'api/v1/reports' + '/' + report.id;
					$.ajax({
						url: requestUrl,
						method: 'GET',
						xhrFields: {
							withCredentials: true
						}
					}).then(function(response) {
						$scope.currReport = report;
						$scope.outputFormats = response.data.outputFormats;

						$scope.stage = 'selectFormat';

						$scope.$apply();
					});
				};
				//doExport(conn.server + 'api/v1/ondemand/requests', conn.report, format);
				$scope.exportReport = function(format){
					$scope.stage = 'export';
					

					doExport(conn.server + 'api/v1/ondemand/requests', $scope.currReport.id, format, $scope);
				};
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