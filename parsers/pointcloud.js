var PointCloudParser = (function() {

  function PointCloudParser(config) {
    
    var undef;
    
    var __empty_func = function(){};
  
    var start = config.start || __empty_func;
    var parse = config.parse || __empty_func;
    var end = config.end || __empty_func;
    
    const VERSION = "0.1";
    const XHR_DONE = 4;
    
    var pathToFile = null;
    var fileSizeInBytes = 0;
    
    var numParsedPoints = 0;
    var numTotalPoints = 0;
    var progress = 0;
        
    var onProgressCalled = false;
    var xhr = null;
    
    this.__defineGetter__("version", function(){ return VERSION; });
    this.__defineGetter__("numParsedPoints", function(){ return numParsedPoints; });
    this.__defineGetter__("numTotalPoints", function(){ return numTotalPoints; });
    this.__defineGetter__("progress", function(){ return progress; });
    this.__defineGetter__("fileSize", function(){ return fileSizeInBytes; });
    this.stop = function(){ if(xhr){ xhr.abort(); } };
    
    // path is name of .pointcloud file
    this.load = function(path){
      pathToFile = path;

      xhr = new XMLHttpRequest();
      xhr.parser = this;

      xhr.onloadstart = function(e){ start(xhr.parser); };
            
      xhr.onload = function(e){
	buf = this.response;	// this has ArrayBuffer

        var attributes = {};
        attributes["ps_Vertex"] = buf;
        parse(xhr.parser, attributes);
        
        end(xhr.parser);
      } // onload
      
      xhr.open('GET', '/load', true);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);

    }; // load

  }

  return PointCloudParser;

}());
