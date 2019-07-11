define(["./helpers"], function (hlp) {
	
	var connection = {
		type: "items",
		label: "NPrinting Connection",
		items: {
			server: {
				ref: "npsod.conn.server",
				label: "Server Connection",
				type: "string",
				expression: false,
				change: function(data) {
					data.npsod.conn.app = "";
					data.npsod.conn.id = "";
				}
			},
			app: {
				type: "string",
				component: "dropdown",
				label: "Choose App",
				ref: "npsod.conn.app",
				options: function(data) {
					return hlp.getApps(data);
				}
			},
			connection: {
				type: "string",
				component: "dropdown",
				label: "Choose Connection",
				ref: "npsod.conn.id",
				options: function(data) {
					return hlp.getConnectionIds(data);
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