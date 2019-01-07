define(["./helpers"], function (hlp) {
	
	var connection = {
		type: "items",
		label: "NPrinting Connection",
		items: {
			server: {
				ref: "npsod.conn.server",
				label: "Server Connection",
				type: "string",
				expression: false
			},
			app: {
				type: "string",
				component: "dropdown",
				label: "Choose App",
				ref: "npsod.conn.app",
				options: function(data) {
					return hlp.getApps(data);
				}
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
					return hlp.getReports(data);
				}
			},
			exportFormat: {
				type: "string",
				component: "dropdown",
				label: "Default Export Format",
				ref: "npsod.conn.exportFormat",
				options: function(data) {
					return hlp.getExportFormats(data);
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
				label: 'An extension that allows a user to generate an NPrinting report on demand.',
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