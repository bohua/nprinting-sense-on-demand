define(["qlik", "qvangular", "jquery", "core.utils/deferred"],
  function(qlik, qvangular, $, Deferred) {
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

      getApps: function (data) {
        var self = this;
        return self.getLoginNtlm(data.npsod.conn.server).then(function () {
          return self.getConnections(data.npsod.conn.server, null).then(function (connections) {
            if (!connections || connections.length == 0) {
              return [];
            }
            return self.getAppsWithConnection(data.npsod.conn.server, connections);
          });
        });
      },

      // Returns the apps that shares a connection with this qApp.
      getAppsWithConnection: function (server, connections, offset) {
        if (!offset) {
          offset = 0;
        }

        var self = this;
        return $.ajax({
          url: self.doGetActionURL(server, 'api/v1/apps?sort=+name,-created&limit=100&offset=' + offset),
          method: 'GET',
          xhrFields: {
            withCredentials: true
          }
        }).then(function (response) {
          var result = [];
          if (!response) {
            return result;
          }

          // Filter away those without a connection
          response.data.items.forEach(function (app) {
            if (connections.some(function (connection) { return connection.appId === app.id })) {
              result.push({
                  value: app.id,
                  label: app.name.length > 50 ? app.name.slice(0, 47) + '...' : app.name
                });
            }
          });

          var nextOffset = response.data.items.length + response.data.offset;
          if (nextOffset < response.data.totalItems) {
            // Not processed all yet
            return self.getAppsWithConnection(server, connections, nextOffset).then(function (apps) {
              return result.concat(apps);
            });
          }
          // Processed all
          return result;
        });
      },

      // Returns the id of the available connections.
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
      getConnections: function(server, appId, offset) {
        if (!offset) {
          offset = 0;
        }

        var self = this;
        var url = 'api/v1/connections?sort=+name,-created&limit=100&offset=' + offset;
        if (appId) {
          url += '&appId=' + appId;
        }
        return $.ajax({
          url: self.doGetActionURL(server, url),
          method: 'GET',
          xhrFields: {
            withCredentials: true
          }
        }).then(function(response) {
          var result = [];
          var qAppPattern = new RegExp('.+appid=' + self.qApp.id + ';.+');
          response.data.items.forEach(function (connection) {
            if (qAppPattern.test(connection.connectionString)) {
              result.push(connection);
            }
          });
          var nextOffset = response.data.items.length + response.data.offset;
          if (nextOffset < response.data.totalItems) {
            // Not processed all yet
            return self.getConnections(server, appId, nextOffset).then(function (connections) {
              return result.concat(connections);
            });
          }
          // Processed all
          return result;
        });
      },

      // Fetches all reports available for the current qApp
      doGetReportlist: function (server, appId, offset) {
        if (!offset) {
          offset = 0;
        }

        var self = this;
        var requestUrl = self.doGetActionURL(
          server, 'api/v1/reports?sort=+title,-created&appId=' + appId + '&limit=100&offset=' + offset);
        return $.ajax({
          url: requestUrl,
          method: 'GET',
          xhrFields: {
            withCredentials: true
          }
        }).then(function (response) {
          var result = response.data.items;
          var nextOffset = response.data.items.length + response.data.offset;
          if (nextOffset < response.data.totalItems) {
            // Not processed all yet
            return self.doGetReportlist(server, appId, nextOffset).then(function (reports) {
              return result.concat(reports);
            });
          }
          // Processed all
          return result;
        });
      },

      // Fetches all reports available for the given report
      doGetExportFormats: function (server, reportId) {
        var requestUrl = this.doGetActionURL(server, 'api/v1/reports/' + reportId);
        return $.ajax({
          url: requestUrl,
          method: 'GET',
          xhrFields: {
            withCredentials: true
          }
        });
      },

      // Returns the available reports prepared to be used in a dropdown
      getReportsForDropdown: function (data) {
        if (!this.isServerSet(data) || !this.isAppSet(data)) {
          return [];
        }

        return this.doGetReportlist(data.npsod.conn.server, data.npsod.conn.app).then(function(reports) {
          return reports.map(function(report) {
            return {
              value: report.id,
              label: report.title.length > 50 ? report.title.slice(0, 47) + '...' : report.title
            }
          });
        });
      },

      // Returns the available export formats for the set report prepared to be used in a dropdown
      getExportFormatsForDropdown: function (data) {
        var self = this;
        if(self.isServerSet(data) == false || data.npsod.conn.report.length < 1){
          return [];
        }

        return self.doGetExportFormats(data.npsod.conn.server, data.npsod.conn.report)
          .then(function(response) {
            return response.data.outputFormats.map(function(format) {
              return {
                value: format,
                label: format.toUpperCase()
              }
            });
        });
      },

      // Fetches the ntlm login
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

      // Fetches the tasks
      doGetTasks: function(server, app, offset) {
        if (!offset) {
          offset = 0;
        }

        var df = Deferred();
        if (!app) {
          df.reject({message: 'Must specify app', status: 400});
          return df.promise;
        }

        $.ajax({
          url: this.doGetActionURL(
            server, 'api/v1/ondemand/requests?sort=-created&appId=' + app + '&limit=100&offset=' + offset),
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

      // Deletes the task with the given id
      doDeleteTask: function(server, taskId) {
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

      // Downloads the report with the given id
      downloadTask: function (server, taskId) {
        var requestUrl = this.doGetActionURL(server, 'api/v1/ondemand/requests/' + taskId + '/result');
        var df = Deferred();

        if ((navigator.vendor && navigator.vendor.indexOf('Apple') > -1)
            || /(Trident|MSIE)/.test(navigator.userAgent)) {
          // Using either an Apple browser or Internet Explorer, which are bad at handling downloads
          // in an iframe. So just open another tab instead
          window.open(requestUrl);
          df.resolve();
          return df.promise;
        }

        $('#download').on('load', function () {
          df.resolve();
        }).attr('src', requestUrl);
        return df.promise;
      },
    }
  }
);
