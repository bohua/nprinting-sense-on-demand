var connectionSection = {
	type: "items",
	label: "NPrinting Connection",
	items: {
		server: {
			ref: "npsod.conn.server",
			label: "Server Connection",
			type: "string",
			expression: "optional"
		},

		jwtAuth: {
			ref: "npsod.conn.jwtAuth",
			label: "JWT Auth",
			type: "boolean",
			component: "switch",
			options: [
				{
				  value: true,
				  label: "Yes",
				},
				{
				  value: false,
				  label: "No",
				},
			],
			defaultValue: false,
		},

		jwtChannel: {
			type: "string",
			component: "dropdown",
			label: "JWT Channel",
			ref: "npsod.conn.jwtChannel",
			options: [
				{
					value: "clientJWT",
					label: "Client JWT"
				},
				{
					value: "serverJWT",
					label: "Server JWT"
				}
			],
			defaultValue: "clientJWT",
			show: (data) => data?.npsod?.conn?.jwtAuth
		},

		jwtPrivateKEY: {
			label:"Private KEY",
			component: "textarea",
			rows: 10,
			maxlength: 2048,
			ref: "npsod.conn.jwtPrivateKEY",
			show: (data) => data?.npsod?.conn?.jwtAuth && data?.npsod?.conn?.jwtChannel === "clientJWT"
		},

		jwtServer: {
			ref: "npsod.conn.jwtServer",
			label: "JWT Server Connection",
			type: "string",
			expression: "optional",
			show: (data) => data?.npsod?.conn?.jwtAuth && data?.npsod?.conn?.jwtChannel === "serverJWT"
		},

		/*
		ntlm: {
			ref: "npsod.conn.ntlm",
			type: "string",
			defaultValue: "null",
			show: function(){
				return false;
			}
		},

		test: {
			label: "Connect",
			component: "button",
			ref: "npsod.conn.ntlm",
			action: function(data) {
				//Test the connection by sending API request ntlm request
				var URL = data.npsod.conn.server + 'api/v1/login/ntlm'
				$.ajax({
					url: URL,
					method: 'GET',
					xhrFields: {
						withCredentials: true
					}
				}).done(function(response){
					if(response.code == 0){
						alert("Connect Succeed!");
					}else {
						alert("Connect Failed! Message:" + response.message + ' Code: (' + response.code + ')');
					}
				}).fail(function(e){
					alert("Connect Failed! Pease check your connection.");		
				});
			}
		},
		*/

		app: {
			type: "string",
			component: "dropdown",
			label: "Choose App",
			ref: "npsod.conn.app",
			options: function(data) {
				return $.ajax({
					url: data.npsod.conn.server + 'api/v1/apps',
					method: 'GET',
					xhrFields: {
						withCredentials: true
					}
				}).then(function(response) {
					return response.data.items.map(function(app) {
						return {
							value: app.id,
							label: app.name
						}
					});
				});
			}
		}
	}
};

var ReportSection ={
	type: "items",
	label: "Report Configuration",
	items: {
		report: {
			type: "string",
			component: "dropdown",
			label: "Choose Report",
			ref: "npsod.conn.report",
			options: function(data) {
				var requestUrl = data.npsod.conn.server + 'api/v1/reports' + '?appId=' + data.npsod.conn.app + '&sort=+title';

				return $.ajax({
					url: requestUrl,
					method: 'GET',
					xhrFields: {
						withCredentials: true
					}
				}).then(function(response) {
					return response.data.items.map(function(report) {
						return {
							value: report.id,
							label: report.title
						}
					});
				});
			}
		},

		exportFormat: {
			type: "string",
			component: "dropdown",
			label: "Default Export Format",
			ref: "npsod.conn.exportFormat",
			options: function(data) {
				var requestUrl = data.npsod.conn.server + 'api/v1/reports' + '/' + data.npsod.conn.report;

				return $.ajax({
					url: requestUrl,
					method: 'GET',
					xhrFields: {
						withCredentials: true
					}
				}).then(function(response) {
					return response.data.outputFormats.map(function(format) {
						return {
							value: format,
							label: format.toUpperCase()
						}
					});
				});
			}
		}
	}
};

var AppearanceSection = {
	uses: "settings",
	items: {
		label: {
			ref: "npsod.conn.label",
			label: "Button Label",
			type: "string",
			expression: "optional"
		},
		presentation : {
				label : "Display",
				items : {
					buttonPosition: {
						type: "string",
						component: "buttongroup",
						label: "Button position",
						ref: "npsod.button.position",
						options: [
						  {
							value: "top",
							label: "Top",
							tooltip: "Top"
						  },
						  {
							value: "middle",
							label: "Middle",
							tooltip: "Middle"
						  },
						  {
							value: "bottom",
							label: "Bottom",
							tooltip: "Bottom"
						  }
						],
						defaultValue: "top"
					},
					DomId: {
						type: "string",
						label: "DOM Id",
						ref: "npsod.button.DomId",
						expression:"optional",
						default:"[]"
					},
					CSSConditionalClass: {
						type: "string",
						label: "CSS Conditional Class",
						ref: "npsod.button.CSSConditionalClass",
						expression:"always",
						defaultValue: ""
					}
				}
			},
	}
};