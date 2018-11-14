define([],
	function(){
	  'use strict';
	
	  return {
      isServerSet: function (data){
        if(data.npsod.conn.server.length > 0){
          return true;
        } else {
          return false;
        }
      },
      doGetActionURL: function (server, url){
        var B = server;
        B.trim();
        var L = B.slice(-1);
        if(L != "/"){
          B += "/";			
        }
        return B + url;
      },
      getActionURL: function (data, url) {
        return this.doGetActionURL(data.npsod.conn.server, url);
      },

      getApps: function (data) {
        var self = this;
        if(self.isServerSet(data) == false){
          return [];
        }
        return $.ajax({
          url: self.getActionURL(data, 'api/v1/apps'),
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
      },
      
      doGetReportlist: function(server, app) {
        var requestUrl = this.doGetActionURL(server, 'api/v1/reports' + '?appId=' + app + '&sort=+title');
        return $.ajax({
          url: requestUrl,
          method: 'GET',
          xhrFields: {
            withCredentials: true
          }
        });
      },
    

    getReports: function (data) {
      var self = this;
      if(self.isServerSet(data) == false || data.npsod.conn.app.length < 1){
        return [];
      }

      return self.doGetReportlist(data.npsod.conn.server, data.npsod.conn.app).then(function(response) {
        return response.data.items.map(function(report) {
          return {
            value: report.id,
            label: report.title
          }
        });
      });
    },
    doGetExportFormats: function (server, reportId){
      var requestUrl = this.doGetActionURL(server, 'api/v1/reports' + '/' + reportId);
      return $.ajax({
        url: requestUrl,
        method: 'GET',
        xhrFields: {
          withCredentials: true
        }
      });
    },

    getExportFormats: function (data) {
      var self = this;
      if(self.isServerSet(data) == false || data.npsod.conn.report.length < 1){
        return [];
      }
      
      return self.doGetExportFormats(data.npsod.conn.server, data.npsod.conn.report).
      then(function(response) {
        return response.data.outputFormats.map(function(format) {
          return {
            value: format,
            label: format.toUpperCase()
          }
        });
      });
    },

    getLoginNtlm: function (data) {
      var self = this;
      if(self.isServerSet(data) == false){
        return false;
      }

      return $.ajax({
        url: self.getActionURL(data, 'api/v1/login/ntlm'),
        method: 'GET',
        xhrFields: {
          withCredentials: true
        }
      });
    },

    doGetTasks: function(server, app){
      var requestUrl = this.doGetActionURL(server, 'api/v1/ondemand/requests' + '?appId=' + app + '&sort=-created');
      return $.ajax({
        url: requestUrl,
				method: 'GET',
				xhrFields: {
					withCredentials: true
				}
			});
    },
    
    doDeleteTask: function(server, taskId){
      var requestUrl = this.doGetActionURL(server, 'api/v1/ondemand/requests/' + taskId);
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
    },

    downloadTask: function (server, taskId){
      var requestUrl = this.doGetActionURL(server,'api/v1/ondemand/requests/' + taskId + '/result');
			document.getElementById('download').src = requestUrl;
    },
    
    doGetConnections: function (server, app) {
      var requestUrl = this.doGetActionURL(server, 'api/v1/connections?appId=' + app);

			return $.ajax({
				url: requestUrl,
				method: 'GET',
				xhrFields: {
					withCredentials: true
				}
			});
		}
}
  }
);
