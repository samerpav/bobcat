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

var PTXParser = (function() {

  function PTXParser(config) {
    
    var undef;
    
    var __empty_func = function(){};
  
    var parseStart = config.start || __empty_func;
    var parse = config.parse || __empty_func;
    var parseFinished = config.end || __empty_func;
    
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

      var partialData=''; // need to init to null string otherwise 1st elemen will have an 'undefined' value !!! 
      var data;
      var rawData;
      var lastNLIndex;
	  
	  var currTotalPoints;    // # of points (ie. width * height) in current cloud being parsed 
	  var currPointsParsed;   // # of points parsed so far in current cloud
	  var currTranslation;	// translation vector
	  var currRotation; // 3x3 rotation matrix

      function loadNext() {
        var start, end,
        blobSlice = File.prototype.mozSlice || File.prototype.webkitSlice;

        start = _chunk * chunkSize;
        end = start + chunkSize >= file.size ? file.size : start + chunkSize;
	
        FR.onloadstart = function(e){
			console.log('ptx.js: parse started');
            parseStart(FR.parser);
        };

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
			else {
				console.log('ptx.js: parse finished');
				parseFinished(FR.parser);
			}
        }; // onload

		var incompleteHeader = '';

        FR.parseChunk = function(chunk) {

            if (chunk !== "") {
			  
			  // unlike PTS, we cannot discard any lines in PTX!

			  if (incompleteHeader.length > 0) {
				chunk = incompleteHeader + chunk;
				incompleteHeader = '';
			  }
              
			  // find out how many lines there are
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
			  //var rawIntensity, normIntensity;

			  var j = 0; // line index counter

			  var width,height,t;
			  var r1,r2,r3;

			  while (j < lines.length) {

				var field = lines[j].replace(/\s+$/,"").split(/\s+/);  // remove trailing space then split on white space

				if (field.length == 1) {
				  // this indicates a new cloud, so read the cloud's header here

				  width = parseInt(field[0]);
				  //console.log('w = ' + width);

				  height = parseInt(lines[j+1].replace(/\s+$/,"").split(/\s+/));
				  //console.log('h = ' + height);

				  // translation vector
				  t = lines[j+2].replace(/\s+$/,"").split(/\s+/);
				  currTranslation = V3.$(t[0], t[1], t[2]); 
				  //console.log(currTranslation);

				  // rotation matrix
				  r1= lines[j+3].replace(/\s+$/,"").split(/\s+/);
				  r2= lines[j+4].replace(/\s+$/,"").split(/\s+/);
				  r3= lines[j+5].replace(/\s+$/,"").split(/\s+/);

				  currRotation = M4x4.$(r1[0], r1[1], r1[2], 0,
						  				r2[0], r2[1], r2[2], 0,
										r3[0], r3[1], r3[2], 0,
										0, 0, 0, 1);
				  //console.log(currRotation);

				  j += 9; // skip header section

				  continue;
				}

				// read x y z
				var rawPoint = [parseFloat(field[0]), parseFloat(field[1]), parseFloat(field[2])];
				//var rawPoint = V3.$(parseFloat(field[0]), parseFloat(field[1]), parseFloat(field[2]));

				// skip empty point
				if (V3.length(rawPoint) == 0) {
				  j++;
				  continue;
				}

				// apply transformation matrix
				var transformedPoint = M4x4.transformPoint(currRotation, rawPoint); 

				//console.log(transformedPoint[0].toFixed(2) + ' ' + transformedPoint[1].toFixed(2) + ' ' + transformedPoint[2].toFixed(2));

				// apply translation vector and set coordinates
				coords[0+j*coordOffset] = transformedPoint[0]+currTranslation[0];
				coords[1+j*coordOffset] = transformedPoint[1]+currTranslation[1];
				coords[2+j*coordOffset] = transformedPoint[2]+currTranslation[2];

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
				

				j++;

			  }  // while
			  
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

  return PTXParser;

}());
