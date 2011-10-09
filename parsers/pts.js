/*
 * returns an object with 3 properties: r, g, b
 * each one has a range of [0,1]
*/
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
				progress = Math.round(_chunk/chunks*100);

				partialData = rawData.slice(lastNLIndex+1);

				//var i = data.indexOf('\n');                      // debugging
				//console.log('full   = ' + data.slice(0,i));      // debugging

				loadNext(); // shortcut here
				data = null;
          	} // if _chunk
        }; // onload

        FR.parseChunk = function(chunk) {

            if (chunk !== "") {
              
	          // get rid off lines having just number of points.
			  // there could be many instances of these throughout a pts file
              chunk = chunk.replace(/^\d+\s+$/gm, "");

			  // find out how many lines there are; this is # of points	
			  lines = chunk.split(/\n/);
              var numVerts = lines.length; 
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

			  for (var j=0; j<lines.length; j++) {

              	// each line should look like this: x y z intensity r g b
				// r g b are optional

				var field = lines[j].replace(/\s+$/,"").split(/\s+/);  // remove trailing space then split on white space

				// if line has too few or too many fields, skip it
				if ((field.length < 3) || (field.length > 8))
					continue;

				// parse coodinates
				coords[0+j*coordOffset] = parseFloat(field[0]); // X
				coords[1+j*coordOffset] = parseFloat(field[1]); // Y
				coords[2+j*coordOffset] = parseFloat(field[2]); // Z

				switch (field.length) {
			  	  	case 7: // color
					    colors[0+j*colorOffset] = parseInt(field[4]); // R
					    colors[1+j*colorOffset] = parseInt(field[5]); // G
					    colors[2+j*colorOffset] = parseInt(field[6]); // B
					    colors[3+j*colorOffset] = 255; // padding
			  	  		break;

			  	  	case 4: // intensity
		      			var hsv = new Object();
			  	  		var rawIntensity = parseInt(field[3]);
			  	  		//intens[0+j*intensityOffset] = rawIntensity;

			  	  		var normIntensity = (rawIntensity+2048)/4096;

			  	  		// convert intensity to rgb
			  	  		// and then add r,g,b to the interleaved array
			  	  		hsv.s = 0.9;  // arbitrary constant
			  	  		hsv.v = 1;	// arbitrary constant
			  	  		hsv.h = 360 * normIntensity; // hue is between 1 - 360 degrees
			  	   		var rgb = hsv2rgb(hsv);

			  	  		colors[0+j*colorOffset] = Math.round(rgb.r*255); // R
			  	  		colors[1+j*colorOffset] = Math.round(rgb.g*255); // G
			  	  		colors[2+j*colorOffset] = Math.round(rgb.b*255); // B
			  	  		colors[3+j*colorOffset] = 255; // padding

			  	  		break;

			  	  	default: // set color to green for point with unusual number of fields
			  	  		colors[0+j*colorOffset] = 0;
			  	  		colors[1+j*colorOffset] = 128;
			  	  		colors[2+j*colorOffset] = 0;
			  	  		colors[3+j*colorOffset] = 255; // padding

			  	} // switch
			  }  // for - lines
			  
			  var attributes = {};
			  if (coords) { attributes["ps_Vertex"] = buf; }
			  parse(FR.parser, attributes);

            } // if - chunk
        }; // function - parseChunk

        FR.readAsBinaryString(blobSlice.call(file, start, end));

        //FR.readAsText(blobSlice.call(file, start, end));       // this uses more memory than readAsBinaryString
      } // function - loadNext

      loadNext();

    };// load

  }// ctor

  return PTSParser;

}());
