/**
 * This script was developed by Guberni and is part of Tellki's Monitoring Solution
 *
 * June, 2015
 * 
 * Version 1.0
 * 
 * DESCRIPTION: Monitor Solr Performance
 *
 * SYNTAX: node solr_performance_monitor.js <METRIC_STATE> <HOST> <PORT> <PATH> <USERNAME> <PASSWORD>
 *
 * EXAMPLE: node solr_performance_monitor.js "1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1" "10.10.2.5" "8983" "solr" "username" "password"
 *
 * README:
 *    <METRIC_STATE> is generated internally by Tellki and it's only used by Tellki default monitors: 1 - metric is on; 0 - metric is off
 *    <HOST> solr ip address or hostname
 *    <PORT> solr port
 *    <PATH> solr path
 *    <USERNAME> solr username
 *    <PASSWORD> solr password
 */

var http = require('http');

/**
 * Metrics.
 */
var metrics = [];
metrics.push({ id: '2303:Committed Virtual Memory Size:4',  type: 'system', value : function(o) { return (o.system.committedVirtualMemorySize / 1024 / 1024).toFixed(2); } });
metrics.push({ id: '2304:Free Physical Memory Size:4',      type: 'system', value : function(o) { return (o.system.freePhysicalMemorySize  / 1024 / 1024).toFixed(2); } });
metrics.push({ id: '2305:Process CPU Time:4',               type: 'system', value : function(o) { return (o.system.processCpuTime / 1000000000).toFixed(2); } });
metrics.push({ id: '2306:Open File Descriptor Count:4',     type: 'system', value : function(o) { return o.system.openFileDescriptorCount; } });
metrics.push({ id: '2307:Max File Descriptor Count:4',      type: 'system', value : function(o) { return o.system.maxFileDescriptorCount; } });
metrics.push({ id: '2308:Uptime:4',                         type: 'system', value : function(o) { return (o.jvm.jmx.upTimeMS / 1000 / 60 / 60).toFixed(2); } });
metrics.push({ id: '2309:Processors:4',                     type: 'system', value : function(o) { return o.jvm.processors; } });
metrics.push({ id: '2310:Memory Free:4',                    type: 'system', value : function(o) { return (o.jvm.memory.raw.free  / 1024 / 1024).toFixed(2); } });
metrics.push({ id: '2311:Memory Total:4',                   type: 'system', value : function(o) { return (o.jvm.memory.raw.total  / 1024 / 1024).toFixed(2); } });
metrics.push({ id: '2312:Memory Max:4',                     type: 'system', value : function(o) { return (o.jvm.memory.raw.max  / 1024 / 1024).toFixed(2); } });
metrics.push({ id: '2313:Memory Used:4',                    type: 'system', value : function(o) { return (o.jvm.memory.raw.used  / 1024 / 1024).toFixed(2); } });
metrics.push({ id: '2314:Thread Count Current:4', type: 'threads', value : function(o) { return o.system.threadCount.current; } });
metrics.push({ id: '2315:Thread Count Peak:4',    type: 'threads', value : function(o) { return o.system.threadCount.peak; } });
metrics.push({ id: '2316:Thread Count Daemon:4',  type: 'threads', value : function(o) { return o.system.threadCount.daemon; } });
metrics.push({ id: '2317:Cache Stats Lookups:4',      type: 'mbeans', value : function(o) { return o['solr-mbeans'].CACHE.documentCache.stats.lookups; } });
metrics.push({ id: '2318:Cache Stats Hits:4',         type: 'mbeans', value : function(o) { return o['solr-mbeans'].CACHE.documentCache.stats.hits; } });
metrics.push({ id: '2319:Cache Stats Hit Ratio:4',    type: 'mbeans', value : function(o) { return o['solr-mbeans'].CACHE.documentCache.stats.hitratio; } });
metrics.push({ id: '2320:Cache Stats Inserts:4',      type: 'mbeans', value : function(o) { return o['solr-mbeans'].CACHE.documentCache.stats.inserts; } });
metrics.push({ id: '2321:Cache Stats Size:4',         type: 'mbeans', value : function(o) { return o['solr-mbeans'].CACHE.documentCache.stats.size; } });
metrics.push({ id: '2322:Cache Stats Evictions:4',    type: 'mbeans', value : function(o) { return o['solr-mbeans'].CACHE.documentCache.stats.evictions; } });
metrics.push({ id: '2323:Cache Stats Warmup Time:4',  type: 'mbeans', value : function(o) { return o['solr-mbeans'].CACHE.documentCache.stats.warmupTime; } });

var paths = [
  {
    type: 'system',
    path: '/{PATH}/admin/info/system?wt=json&json.nl=map'
  },
  {
    type: 'threads',
    path: '/{PATH}/admin/info/threads?wt=json&json.nl=map'
  },
  {
    type: 'mbeans',
    path: '/{PATH}/{CORE}/admin/mbeans?stats=true&wt=json&json.nl=map'
  }
];

var inputLength = 6;
 
/**
 * Entry point.
 */
(function() {
  try
  {
    monitorInput(process.argv);
  }
  catch(err)
  { 
    if(err instanceof InvalidParametersNumberError)
    {
      console.log(err.message);
      process.exit(err.code);
    }
    else if(err instanceof UnknownHostError)
    {
      console.log(err.message);
      process.exit(err.code);
    }
    else
    {
      console.log(err.message);
      process.exit(1);
    }
  }
}).call(this);

// ############################################################################
// PARSE INPUT

/**
 * Verify number of passed arguments into the script, process the passed arguments and send them to monitor execution.
 * Receive: arguments to be processed
 */
function monitorInput(args)
{
  args = args.slice(2);
  if(args.length != inputLength)
    throw new InvalidParametersNumberError();
  
  //<METRIC_STATE>
  var metricState = args[0].replace('"', '');
  var tokens = metricState.split(',');
  var metricsExecution = new Array();
  for(var i in tokens)
    metricsExecution[i] = (tokens[i] === '1');
  
  //<HOST> 
  var hostname = args[1];
  
  //<PORT> 
  var port = args[2];
  if (port.length === 0)
    port = '8983';

  //<PATH>
  var path = args[3];
  if (path.length > 0)
    path = path.replace(/\//g, '');
  else
    path = 'solr';

  // <USER_NAME>
  var username = args[4];
  username = username.length === 0 ? '' : username;
  username = username === '\"\"' ? '' : username;
  if(username.length === 1 && username === '\"')
    username = '';
  
  // <PASS_WORD>
  var passwd = args[5];
  passwd = passwd.length === 0 ? '' : passwd;
  passwd = passwd === '\"\"' ? '' : passwd;
  if(passwd.length === 1 && passwd === '\"')
    passwd = '';
  
  if(username === '{0}')
    username = passwd = '';

  // Create request object to be executed.
  var request = new Object()
  request.checkMetrics = metricsExecution;
  request.hostname = hostname;
  request.port = port;
  request.path = path;
  request.username = username;
  request.passwd = passwd;
  
  // Get metrics.
  processRequest(request);
}

// ############################################################################
// GET METRICS

/**
 * Retrieve metrics information
 * Receive: object request containing configuration
 */
function processRequest(request) 
{
  getCores(request, function(cores) {

    makeRequest(createPath(paths[0].path, undefined, request), request, 0, undefined);
    makeRequest(createPath(paths[1].path, undefined, request), request, 1, undefined);

    for(var i = 0, j = 2; i < cores.length; i++, j++)
      makeRequest(createPath(paths[2].path, cores[i], request), request, j, cores[i]);
  });
}

function getCores(request, callback)
{
  // Create HTTP request options.
  var options = {
    method: 'GET',
    hostname: request.hostname,
    port: request.port,
    path: '/' + request.path + '/admin/cores?action=STATUS&wt=json'
  };

  if (request.username !== '')
    options.auth = request.username + ':' + request.passwd;

  // Do HTTP request.
  var req = http.request(options, function (res) {
    var data = '';
    
    // HTTP response status code.
    var code = res.statusCode;
    
    if (code != 200)
    {
      if (code == 401)
      {
        errorHandler(new InvalidAuthenticationError());
      }
      else
      {
        var exception = new HTTPError();
        exception.message = 'Response error (' + code + ').';
        errorHandler(exception);
      }
    }
    
    res.setEncoding('utf8');
    
    // Receive data.
    res.on('data', function (chunk) {
      data += chunk;
    });
    
    // On HTTP request end.
    res.on('end', function (res) {
      
      var o = JSON.parse(data);
      if (Object.keys(o.status).length > 0)
      {
        callback(Object.keys(o.status));
      }
      else
      {
        errorHandler(new MetricNotFoundError());
      }
    });
  });
  
  // On Error.
  req.on('error', function (e) {
    if(e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED')
      errorHandler(new UnknownHostError()); 
    else
      errorHandler(e);
  });

  req.end();
}

function makeRequest(path, request, i, core)
{
  // Create HTTP request options.
  var options = {
    method: 'GET',
    hostname: request.hostname,
    port: request.port,
    path: path
  };

  if (request.username !== '')
    options.auth = request.username + ':' + request.passwd;

  // Do HTTP request.
  var req = http.request(options, function (res) {
    var data = '';
    
    // HTTP response status code.
    var code = res.statusCode;
    
    if (code != 200)
    {
      if (code == 401)
      {
        errorHandler(new InvalidAuthenticationError());
      }
      else
      {
        var exception = new HTTPError();
        exception.message = 'Response error (' + code + ').';
        errorHandler(exception);
      }
    }
    
    res.setEncoding('utf8');
    
    // Receive data.
    res.on('data', function (chunk) {
      data += chunk;
    });
    
    // On HTTP request end.
    res.on('end', function (res) {
      processData(data, request, i, core);
    });
  });
  
  // On Error.
  req.on('error', function (e) {
    if(e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED')
      errorHandler(new UnknownHostError()); 
    else
      errorHandler(e);
  });

  req.end();
}

var metricsObj = [];
var count = 0;

function processData(data, request, i, core)
{
  var o = JSON.parse(data);
  var currentType = paths[i].type;

  for (var j = 0; j < metrics.length; j++)
  {
    if (request.checkMetrics[j])
    {
      var metric = metrics[j];
      if (metric.type === currentType)
      {
        try {
          var value = metric.value(o);

          metricsObj.push({
            id: metric.id,
            val: value,
            obj: core
          });
        }
        catch (e)
        {
          errorHandler(new MetricNotFoundError());
        }
      }
    }
  }

  // Output
  count++;
  if (count === paths.length)
    output(metricsObj);
}

function createPath(path, core, request)
{
  path = path.replace(/{PATH}/g, request.path);
  path = path.replace(/{CORE}/g, core);
  return path;
}

// ############################################################################
// OUTPUT METRICS

/**
 * Send metrics to console
 * Receive: metrics list to output
 */
function output(metrics)
{
  for (var i in metrics)
  {
    var out = '';
    var metric = metrics[i];
    
    out += metric.id;
    out += '|';
    out += metric.val;
    out += '|';
    if (metric.obj !== undefined)
      out += metric.obj;
    out += '|';
    
    console.log(out);
  }
}

// ############################################################################
// ERROR HANDLER

/**
 * Used to handle errors of async functions
 * Receive: Error/Exception
 */
function errorHandler(err)
{
  if (err instanceof HTTPError)
  {
    console.log(err.message);
    process.exit(err.code);
  }
  else if (err instanceof UnknownHostError)
  {
    console.log(err.message);
    process.exit(err.code);
  }
  else if (err instanceof MetricNotFoundError)
  {
    console.log(err.message);
    process.exit(err.code);   
  }
  else
  {
    console.log(err.message);
    process.exit(1);
  }
}

// ############################################################################
// EXCEPTIONS

/**
 * Exceptions used in this script.
 */
function InvalidParametersNumberError() {
  this.name = 'InvalidParametersNumberError';
  this.message = 'Wrong number of parameters.';
  this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;

function UnknownHostError() {
  this.name = 'UnknownHostError';
  this.message = 'Unknown host.';
  this.code = 28;
}
UnknownHostError.prototype = Object.create(Error.prototype);
UnknownHostError.prototype.constructor = UnknownHostError;

function MetricNotFoundError() {
  this.name = 'MetricNotFoundError';
  this.message = '';
  this.code = 8;
}
MetricNotFoundError.prototype = Object.create(Error.prototype);
MetricNotFoundError.prototype.constructor = MetricNotFoundError;

function HTTPError() {
  this.name = "HTTPError";
  this.message = "";
  this.code = 19;
}
HTTPError.prototype = Object.create(Error.prototype);
HTTPError.prototype.constructor = HTTPError;
