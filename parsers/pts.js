function hsv2rgb(hsv) {
	var rgb = new Object();

	var c = hsv.v * hsv.s;
	var h2 = hsv.h / 60.0;
	var x = c * (1 - Math.abs(h2 % 2 - 1));

	switch (true) {
			case ((h2 >= 0) && (h2 < 1)):
				rgb.r=c;
				rgb.g=x;
				rgb.b=0;
				break;
			case ((h2 >= 1) && (h2 < 2)):
				rgb.r=x;
				rgb.g=c;
				rgb.b=0;
				break;
			case ((h2 >= 2) && (h2 < 3)):
				rgb.r=0;
				rgb.g=c;
				rgb.b=x;
				break;
			case ((h2 >= 3) && (h2 < 4)):
				rgb.r=0;
				rgb.g=x;
				rgb.b=c;
				break;
			case ((h2 >= 4) && (h2 < 5)):
				rgb.r=x;
				rgb.g=0;
				rgb.b=c;
				break;
			case ((h2 >= 5) && (h2 < 6)):
				rgb.r=c;
				rgb.g=0;
				rgb.b=x;
				break;
		default: rgb.r=rgb.g=rgb.b=0;
	}

	var m = hsv.v - c;

	rgb.r += m;
	rgb.g += m;
	rgb.b += m;

	return rgb;
}

var PTSParser = (function() {

  function PTSParser(config) {
    
    var undef;
    
    var __empty_func = function(){};
  
    var start = config.start || __empty_func;
    var parse = config.parse || __empty_func;
    var end = config.end || __empty_func;
    
    const VERSION = "0.1";
    
    var fileSizeInBytes = 0;
    
    var numParsedPoints = 0;
    var numTotalPoints = 0;
    var progress = 0;
        
    var onProgressCalled = false;
    var FR = null;
    
    this.__defineGetter__("version", function(){ return VERSION; });
    this.__defineGetter__("numParsedPoints", function(){ return numParsedPoints; });
    this.__defineGetter__("numTotalPoints", function(){ return numTotalPoints; });
    this.__defineGetter__("progress", function(){ return progress; });
    this.__defineGetter__("fileSize", function(){ return fileSizeInBytes; });
    
    this.stop = function(){ if(FR){ FR.abort(); } };
    
    // parser's load function
    this.load = function(file) {

      var chunkSize = 1024*1024*1, // it looked like 1M chunk is fastest and uses least memory
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

             numTotalPoints = numParsedPoints;
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
              
	          // get rid off lines having just number of points.
			  // there could be many instances of these throughout a pts file
              chunk = chunk.replace(/^\d+\s+$/gm, "");

              //numPoints = chunk.match(/^[0-9]+\n/);
              //numTotalPoints += parseInt(numPoints);

              // trim trailing spaces
              chunk = chunk.replace(/\s+$/,"");
              
              // trim leading spaces
              chunk = chunk.replace(/^\s+/,"");

              // find out how many columns per line
              var firstline = chunk.split(/\n/, 1);
              var numActualColumns = firstline[0].split(" ").length;

              // split on white space
              chunk = chunk.split(/\s+/);

              const numValuesPerLine = numActualColumns;
              var numVerts = chunk.length/numValuesPerLine;
              numParsedPoints += numVerts;
              
		      // we use interleaved array to reduce number of Draw calls from 2 to 1
		      var elementSize = 3 * Float32Array.BYTES_PER_ELEMENT + 
					  			4 * Uint8Array.BYTES_PER_ELEMENT;

		      var buf = new ArrayBuffer(numVerts * elementSize);
		      var coords = new Float32Array(buf);
		      var colors = new Uint8Array(buf, 3 * Float32Array.BYTES_PER_ELEMENT);
		      //var intens = new Int16Array(buf, 3*Float32Array.BYTES_PER_ELEMENT + 4*Uint8Array.BYTES_PER_ELEMENT);

	          var coordOffset = elementSize / Float32Array.BYTES_PER_ELEMENT;
	          var colorOffset = elementSize / Uint8Array.BYTES_PER_ELEMENT;
			  //var intensityOffset = elementSize / Int16Array.BYTES_PER_ELEMENT;
			  var rawIntensity, normIntensity;

		      var hsv = new Object();

              // x y z intensity r g b
              for (var i=0, j=0; i<chunk.length; i += numValuesPerLine, j++){

				coords[0+j*coordOffset] = parseFloat(chunk[i]);   // X
                coords[1+j*coordOffset] = parseFloat(chunk[i+1]); // Y
                coords[2+j*coordOffset] = parseFloat(chunk[i+2]); // Z

                switch (numActualColumns) {
					case 7: // color
						colors[0+j*colorOffset] = parseInt(chunk[i+4]); // R
						colors[1+j*colorOffset] = parseInt(chunk[i+5]); // G
						colors[2+j*colorOffset] = parseInt(chunk[i+6]); // B
						colors[3+j*colorOffset] = 255; // padding
						break;

					case 4: // intensity
						rawIntensity = parseInt(chunk[i+3]);
						//intens[0+j*intensityOffset] = rawIntensity;

						normIntensity = (rawIntensity+2048)/4096;

						// convert intensity to rgb
						// and then add r,g,b to the interleaved array
						hsv.s = 0.9;  // arbitrary constant
						hsv.v = 1;	// arbitrary constant
						hsv.h = 360 * normIntensity; // hue is between 0 - 359 degrees
				 		var rgb = hsv2rgb(hsv);

						colors[0+j*colorOffset] = Math.round(rgb.r*255); // R
						colors[1+j*colorOffset] = Math.round(rgb.g*255); // G
						colors[2+j*colorOffset] = Math.round(rgb.b*255); // B
						colors[3+j*colorOffset] = 255; // padding

						break;

					default: // fixed intensity
						colors[0+j*colorOffset] = 0;
						colors[1+j*colorOffset] = 128;
						colors[2+j*colorOffset] = 0;
						colors[3+j*colorOffset] = 255; // padding
				} // switch

              } // for
                    
              var attributes = {};

              if (coords) { attributes["ps_Vertex"] = buf; }

              parse(FR.parser, attributes);
            }
        };

        FR.readAsBinaryString(blobSlice.call(file, start, end));

	// this uses more memory than readAsBinaryString
        //FR.readAsText(blobSlice.call(file, start, end));       
      }

      loadNext();

    };// load

  }// ctor

  return PTSParser;

}());
