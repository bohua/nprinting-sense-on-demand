define(["qlik", "qvangular", "jquery", "core.utils/deferred"],
	function(qlik, qvangular, $, Deferred){
    'use strict';

	  return {
      isServerSet: function (data) {
        return data.npsod.conn.server.length > 0;
      },
      isAppSet: function (data) {
        return data.npsod.conn.app.length > 0;
      },
      doGetActionURL: function (server, url) {
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
        if (!self.isServerSet(data)) {
          return [];
        }

        return self.getLoginNtlm(data.npsod.conn.server).then(function () {
          var tasks = [];
          tasks.push($.ajax({
            url: self.getActionURL(data, 'api/v1/apps'),
            method: 'GET',
            xhrFields: {
              withCredentials: true
            }
          }));
          tasks.push(self.getConnections(data.npsod.conn.server, null));
          return Promise.all(tasks).then(function (responses) {
            var result = [];
            var appsResponse = responses.shift();
            var connections = responses.shift();
            if (!appsResponse || !connections || connections.length == 0) {
              return [];
            }

            // Add those apps that also has a Connection
            appsResponse.data.items.forEach(function (app) {
              if (connections.some(function (connection) { return connection.appId === app.id })) {
                result.push({
                    value: app.id,
                    label: app.name.length > 50 ? app.name.slice(0, 47) + '...' : app.name
                  });
              }
            });
            return result;
          });
        });
      },

      getConnectionIds: function (data) {
        if (!this.isAppSet(data)) {
          return [];
        }

        return this.getConnections(data.npsod.conn.server, data.npsod.conn.app)
          .then(function (connections) {
            return connections.map(function (connection) {
              return {
                value: connection.id,
                label: connection.name.length > 50 ? connection.name.slice(0, 47) + '...' : connection.name
              }
            });
          });
      },

      // Returns all NPrinting Connections that are associated with the current qApp
      getConnections: function(server, appId) {
        var url = 'api/v1/connections';
        if (appId) {
          url += '?appId=' + appId;
        }
        return $.ajax({
          url: this.doGetActionURL(server, url),
          method: 'GET',
          xhrFields: {
            withCredentials: true
          }
        }).then(function(response) {
          var result = [];
          var qApp = qlik.currApp(this);
          var qAppPattern = new RegExp('.+appid=' + qApp.id + ';.+');
          response.data.items.forEach(function (connection) {
            if (qAppPattern.test(connection.connectionString)) {
              result.push(connection);
            }
          });
          return result;
        });
      },

      doGetReportlist: function(server, app) {
        var requestUrl = this.doGetActionURL(server, 'api/v1/reports?sort=+title&appId=' + app);
        return $.ajax({
          url: requestUrl,
          method: 'GET',
          xhrFields: {
            withCredentials: true
          }
        });
      },

    getReports: function (data) {
      if (!this.isServerSet(data) || !this.isAppSet(data)) {
        return [];
      }

      return this.doGetReportlist(data.npsod.conn.server, data.npsod.conn.app).then(function(response) {
        return response.data.items.map(function(report) {
          return {
            value: report.id,
            label: report.title.length > 50 ? report.title.slice(0, 47) + '...' : report.title
          }
        });
      });
    },
    doGetExportFormats: function (server, reportId){
      var requestUrl = this.doGetActionURL(server, 'api/v1/reports/' + reportId);
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

    getLoginNtlm: function (server, attemptCount) {
      if (!attemptCount) {
        attemptCount = 0;
      }
      var self = this;
      return $.ajax({
        url: self.doGetActionURL(server, 'api/v1/login/ntlm'),
        method: 'GET',
        xhrFields: {
          withCredentials: true
        }
      }).catch(function (err) {
        if (err.status === 401 || err.status === 403) {
          if (attemptCount > 3) {
              // No more attempts
              var qvAlertDialog = qvangular.getService('qvAlertDialog');
              qvAlertDialog.show({
                  title: "Unauthorized",
                  message: "User could not be authenticated.",
                  closeOnEscape: false
              });
          } else {
              // Try again
              return self.getLoginNtlm(server, ++attemptCount);
          }
        }
        throw err;
      });
    },

    doGetTasks: function(server, app) {
      var df = Deferred();
      if (!app) {
        df.reject({message: 'Must specify app', status: 400});
        return df.promise;
      }

      var requestUrl = this.doGetActionURL(server, 'api/v1/ondemand/requests?sort=-created&appId=' + app);
      $.ajax({
        url: requestUrl,
        method: 'GET',
        xhrFields: {
          withCredentials: true
        },
        success: function(res) {
          df.resolve(res);
        },
        error: function(err) {
          df.reject(err);
        }
      });
      return df.promise;
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
      var df = Deferred();
      var requestUrl = this.doGetActionURL(server, 'api/v1/ondemand/requests/' + taskId + '/result');
      $('#download').on('load', function () {
        df.resolve();
      }).attr('src', requestUrl);
      return df.promise;
    },
  }
});
