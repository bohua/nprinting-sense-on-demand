define(["./helpers"], function (hlp) {

	var connection = {
		type: "items",
		label: "NPrinting Connection",
		grouped: true,
		items: {
			server: {
				ref: "npsod.conn.server",
				label: "NPrinting server URL",
				type: "string",
				expression: false,
				change: function(data) {
					data.npsod.conn.app = "";
					data.npsod.conn.id = "";
				}
			},
			relation: {
				type: "items",
				items: {
					app: {
						type: "string",
						component: "dropdown",
						label: "NPrinting app",
						ref: "npsod.conn.app",
						options: function(data, handler, obj) {
							return hlp.getApps(data, handler.app, obj.model);					
						}
					},
					connection: {
						type: "string",
						component: "dropdown",
						label: "NPrinting connection",
						ref: "npsod.conn.id",
						options: function(data, handler, obj) {

							var model = obj.model;
							var app = handler.app;

							return model.getProperties().then(function(props) {

								var connQAppId = props.npsod.conn.qApp;

								// Check if saved app id corresponds to current app id.
								if (handler.app.id !== connQAppId && typeof connQAppId !== "undefined") {
									
									props.npsod.conn.qApp = handler.app.id;
									props.useConnectionFilter = false;

									return model.setProperties(props).then(function() {
										return model.getLayout().then(function(layout) {
											return hlp.getConnectionIds(layout, app, model);
										});
									});
								} else {
									return hlp.getConnectionIds(data, app, model);
								}								
							});
						}
					},
					idMissMatch: {
						show: function(data) {
							return !data.connectionIdMatch;
						},
						component: "text",
						translation: "This connection is not configured with the current Qlik Sense app. If selections in the target do not match, you may get broken reports.",
						style: "hint",
						banner: true,
						icon: "lui-icon--warning"
					}
				}
			},
			options: {
				type: "items",
				items: {
					filterConnections: {
						label: "App/Connection filter",
						type: "boolean",
						ref: "useConnectionFilter",
						component: "switch",
						options: [
						{
							value: true,
							translation: "On",
						},
						{
							value: false,
							translation: "Off",
						},
						],
					},
					allowShowDetailsMessage: {
						component: "text",
						translation: "Turn off this filter if you want to see connections that are not associated with the current Qlik Sense app.",
						style: "hint",
					},
				},
			}
		}
	};

	var report = {
		type: "items",
		label: "Report Configuration",
		items: {
			report: {
				type: "string",
				component: "dropdown",
				label: "Choose Report",
				ref: "npsod.conn.report",
				options: function(data) {
					return hlp.getReportsForDropdown(data);
				}
			},
			exportFormat: {
				type: "string",
				component: "dropdown",
				label: "Default Export Format",
				ref: "npsod.conn.exportFormat",
				options: function(data) {
					return hlp.getExportFormatsForDropdown(data);
				}
			}
		}
	};

	var appearance = {
		uses: "settings",
		items: {
			label: {
				ref: "npsod.conn.label",
				label: "Button Label",
				type: "string",
				expression: "optional"
			},
			selections: {
			  show:false
			},
			general: {
				items: {
					details: {
						show: false
					}
				}
			},
		}
	};

	var about = {
		label: "About",
		component: "items",
		items: {
			header: {
				label: 'On-demand reporting',
				style: 'header',
				component: 'text'
			},
			paragraph1: {
				label: 'A control that allows a user to generate an NPrinting report on demand.',
				component: 'text'
			},
			paragraph2: {
				label: 'On-demand reporting is based upon an extension created by S-cubed.',
				component: 'text'
			}
		}
	};

	return {
		type: "items",
		component: "accordion",
		items: {
			appearance: appearance,
			connection: connection,
			report: report,
			about: about
		}
	};
});