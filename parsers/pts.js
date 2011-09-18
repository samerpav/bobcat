var PTSParser = (function() {

  function PTSParser(config) {
    
    var undef;
    
    // defined once to reduce number of empty functions
    var __empty_func = function(){};
  
    var start = config.start || __empty_func;
    var parse = config.parse || __empty_func;
    var end = config.end || __empty_func;
    
    const VERSION = "0.1";
    
    var fileSizeInBytes = 0;
    
    var numParsedPoints = 0;
    var numTotalPoints = 0;
    var progress = 0;
        
    // keep track if onprogress event handler was called to 
    // handle Chrome/WebKit vs. Minefield differences.
    //
    // Minefield will call onprogress zero or many times
    // Chrome/WebKit will call onprogress one or many times
    var onProgressCalled = false;
    var FR = null;
    
    /**
      Returns the version of this parser.
      @name PTSParser#version
      @returns {String} parser version.
    */
    this.__defineGetter__("version", function(){
      return VERSION;
    });
    
    /**
      Get the number of parsed points so far.
      @name PTSParser#numParsedPoints
      @returns {Number} number of points parsed.
    */
    this.__defineGetter__("numParsedPoints", function(){
      return numParsedPoints;
    });
    
    /**
      Get the total number of points in the point cloud.
      @name PTSParser#numTotalPoints
      @returns {Number} number of points in the point cloud.
    */
    this.__defineGetter__("numTotalPoints", function(){
      return numTotalPoints;
    });
    
    /**
      Returns the progress of downloading the point cloud between zero and one or
      -1 if the progress is unknown.
      @name PTSParser#progress
      @returns {Number|-1}
    */
    this.__defineGetter__("progress", function(){
      return progress;
    });
    
    /**
      Returns the file size of the resource in bytes.
      @name PTSParser#fileSize
      @returns {Number} size of resource in bytes.
    */
    this.__defineGetter__("fileSize", function(){
      return fileSizeInBytes;
    });
    
    /**
      Stop downloading and parsing the associated point cloud.
    */
    this.stop = function(){
      if(FR){
        FR.abort();
      }
    };
    
    /**
      @param {Object} file
    */
    this.load = function(file){

      //FR.onprogress = function(evt) {
      //   console.log(evt.loaded);
      //}

      //FR.onload = function(evt){
      //
      //  //var data = FR.result;
      //  
      //  console.log(evt.loaded);	

      //  //var test = new Uint8Array(data);
      //  //FR.parseChunk(data);

      //  numTotalPoints = numParsedPoints;
      //  
      //  // Indicate parsing is done. ranges from 0 to 1
      //  progress = 1;
      //  
      //  end(FR.parser);
      //}
      
      var chunkSize = 1024*1024*1,                  // it looked like 1M chunk is fastest and uses least memory
      chunks = Math.ceil(file.size / chunkSize),
      _chunk = 0;

      FR = new FileReader();
      FR.parser = this;

      /*      this holds an incomplete last line.
       *      e.g. 
       *
       *      0.000 1.111 2.222 333 444 555 666\n
       *      0.456 6.547 4.   <--- current chunk ends here
       *
       *                    356 999 888 888 777\n <--- first line of next chuck 
       *
       *      so, partialData will store '0.456 6.547 4.'
       *      We then insert partialData in front of next chunk 
       *
       */
      var partialData=''; // need to init to null string otherwise 1st elemen will have an 'undefined' value !!! 
      var data;
      var rawData;
      var lastNLIndex;

      function loadNext() {
        var start, end,
        blobSlice = File.prototype.mozSlice || File.prototype.webkitSlice;

        start = _chunk * chunkSize;
        end = start + chunkSize >= file.size ? file.size : start + chunkSize;
	
        //FR.onloadstart = function(e){
        //    start(FR.parser);
        //};

        FR.onload = function(e) {      
          if (++_chunk <= chunks) {

	     rawData = FR.result;
	     lastNLIndex = rawData.lastIndexOf('\n');

	     //console.log('partial = ' + partialData);        // debugging - previous chunk's incomplete last line
	     
	     data = partialData + rawData.slice(0, lastNLIndex);
             
	     FR.parseChunk(data);

             //numTotalPoints = numParsedPoints;
             progress = 0.5;

	     partialData = rawData.slice(lastNLIndex+1);

	     //var i = data.indexOf('\n');                      // debugging
	     //console.log('full   = ' + data.slice(0,i));      // debugging

             loadNext(); // shortcut here

	     data = null;
          }
	  //else {
	    //end(FR.parser);
	  //}
        };

        FR.parseChunk = function(chunk){
		

            // this occurs over network connections, but not locally.
            if(chunk !== ""){
              
              //numPoints = chunk.match(/^[0-9]+\n/);
              //numTotalPoints += parseInt(numPoints);

              // trim trailing spaces
              chunk = chunk.replace(/\s+$/,"");
              
              // trim leading spaces
              chunk = chunk.replace(/^\s+/,"");

              // sam
              // find out how many columns per line
              //var firstline = chunk.split(/\n/, 1);
              //var numActualColumns = firstline[0].split(" ").length;

              // split on white space
              chunk = chunk.split(/\s+/);

              const numValuesPerLine = 7;	// numActualColumns;
              var numVerts = chunk.length/numValuesPerLine;
              numParsedPoints += numVerts;
              
	        // we use interleaved array to reduce number of Draw calls from 2 to 1
		var elementSize = 3 * Float32Array.BYTES_PER_ELEMENT + 4 * Uint8Array.BYTES_PER_ELEMENT;
		var buf = new ArrayBuffer(numVerts * elementSize);
		var coords = new Float32Array(buf);
		var colors = new Uint8Array(buf, 3 * Float32Array.BYTES_PER_ELEMENT);

              //var verts = new Float32Array(numVerts * 3);
              //var cols =  new Float32Array(numVerts * 3);     // color doesn't need Float32
	      //var cols = new Uint8Array(numVerts * 3);
              //var intensity;

		var coordOffset = elementSize / Float32Array.BYTES_PER_ELEMENT;
		var colorOffset = elementSize / Uint8Array.BYTES_PER_ELEMENT;

              // x y z  intensity r g b
              for(var i=0, j=0; i<chunk.length; i += numValuesPerLine, j++){

		coords[0+j*coordOffset] = parseFloat(chunk[i]); 
                coords[1+j*coordOffset] = parseFloat(chunk[i+1]);
                coords[2+j*coordOffset] = parseFloat(chunk[i+2]);

		colors[0+j*colorOffset] = parseInt(chunk[i+4]);
		colors[1+j*colorOffset] = parseInt(chunk[i+5]);
		colors[2+j*colorOffset] = parseInt(chunk[i+6]);
		colors[3+j*colorOffset] = 255;

                //verts[j]   = parseFloat(chunk[i]);
                //verts[j+1] = parseFloat(chunk[i+1]);
                //verts[j+2] = parseFloat(chunk[i+2]);

		//cols[j]   = parseInt(chunk[i+4]);
		//cols[j+1] = parseInt(chunk[i+5]);
		//cols[j+2] = parseInt(chunk[i+6]);

                //switch (numActualColumns) {
		//	case 7: // color
		//			cols[j]   = parseInt(chunk[i+4])/255;
		//			cols[j+1] = parseInt(chunk[i+5])/255;
		//			cols[j+2] = parseInt(chunk[i+6])/255;
		//		break;

		//	case 4: // intensity
		//		intensity = parseFloat(chunk[i+3]);
		//		intensity = (intensity+2048)/4096;

		//		cols[j]   = intensity < 0.5 ? (-510*intensity+255)/255 : 0;

		//		var fTmp = -1*Math.pow(50*(intensity-0.5),2) + 255;
		//		cols[j+1] = fTmp < 0 ? 0 : fTmp/255;

		//		cols[j+2] = intensity > 0.5 ? (510*intensity+255)/255 : 0;
		//		break;

		//	default: // fixed intensity
		//		cols[j]   = 0;
		//		cols[j+1] = 128;
		//		cols[j+2] = 0;
                //}
              }
                    
              var attributes = {};

              if (coords) {attributes["ps_Vertex"] = buf;}

              //if (verts) {attributes["ps_Vertex"] = verts;}
              //if(cols){attributes["ps_Color"] = cols;}
              
	      var xhr = new XMLHttpRequest();
	      xhr.open('POST', '/form', true);
	      xhr.onload = function(e) {  };
	      xhr.send(buf);

              parse(FR.parser, attributes);
            }
        };

        FR.readAsBinaryString(blobSlice.call(file, start, end));
        //FR.readAsText(blobSlice.call(file, start, end));       -- this uses more memory than readAsBinaryString

      }

      loadNext();

    };// load

  }// ctor

  return PTSParser;

}());
