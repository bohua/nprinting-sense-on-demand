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
			/*
					var progress = 0;

					function getProgress() {
						return progress;
					}

					function setProgress(value) {
						progress = value;
						var bar = $("#npsod-progress-bar");

						bar.css("width", progress + "%");
						bar.find("span").text(progress + '% Complete');
					}
			*/
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

		function doExport(URL, report, format) {
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
					document.getElementById('download').src = URL + '/' + response.data.id + '/result';
				});
			});

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

			controller: ['$scope', '$element', function($scope, $element) {
				$scope.label = "Export";

				var conn = $scope.layout.npsod.conn;
				var currReport = null;
				$scope.exportReport = function(format) {
					//exportReport(format, currReport);
					var viewPopupDg = $(viewPopup);
					$("body").append(viewPopupDg);
					viewPopupDg.find("button.cancel-button").on('qv-activate', function() {
						viewPopupDg.remove();
					});

					doExport(conn.server + 'api/v1/ondemand/requests', conn.report, format);

				};

				var requestUrl = conn.server + 'api/v1/reports' + '/' + conn.report;

				$.ajax({
					url: requestUrl,
					method: 'GET',
					xhrFields: {
						withCredentials: true
					}
				}).then(function(response) {
					currReport = response.data;
					$scope.outputFormats = response.data.outputFormats;
				});
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