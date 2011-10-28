var PointStream = (function() {

  function PointStream() {
    
    // Intentionally left undefined
    var undef;
    
    var __empty_func = function(){};
    
    // Chrome still does not have subarray, so we add it here.
    if(!Float32Array.prototype.subarray){
      /**
        @private
      */
      Float32Array.prototype.subarray = function(s,e){
        return !e ? this.slice(0) : this.slice(s,e);
      };
    }
    
    // Mouse
    var userMouseReleased = __empty_func;
    var userMousePressed = __empty_func;
    var userMouseScroll = __empty_func;
    var mouseX = 0;
    var mouseY = 0;
    
    // Keyboard
    var userKeyUp = __empty_func;
    var userKeyDown = __empty_func;
    var userKeyPressed = __empty_func;
    var key = 0;
    
    var usersRender = __empty_func;
    
    // These are parallel arrays. Each parser
    // has a point cloud it works with
    var parsers = [];
    var pointClouds = [];
    
    var registeredParsers = {};
    //registeredParsers["asc"] = ASCParser;
    //registeredParsers["psi"] = PSIParser;
    registeredParsers["pts"] = PTSParser;
    registeredParsers["pointcloud"] = PointCloudParser;
    registeredParsers["ptx"] = PTXParser;
    //registeredParsers["ply"] = PLYParser;
    
    var VERSION  = "0.7";
    
    // Following should be const, but some browsers along
    // with jslint have issues with this keyword. 
    // file status of point clouds
    var FILE_NOT_FOUND = -1;
    var STARTED = 1;
    var STREAMING = 2;
    var COMPLETE = 3;
      
    // for calculating fps
    var frames = 0;
    var frameRate = 0;
    var frameCount = 0;
    var lastTime;
    
    // default rendering states
    var bk = [1, 1, 1, 1];
    var attn = [0.01, 0.0, 0.003];
    
      
    // browser detection to handle differences such as mouse scrolling
    var browser     = -1;
    var MINEFIELD = 0;
    var CHROME    = 1;
    var CHROMIUM  = 2;
    var WEBKIT    = 3;

    // not used yet
    var FIREFOX   = 4;
    var OPERA     = 5;
    var SAFARI    = 6;
    var IE        = 7;
    
    var canvas = null;
    var ctx = null;

    // Transformation matrices
    var matrixStack = [];
    var projectionMatrix;
    var normalMatrix;

    // this is for transforming Up axis
    var UpAxisMatrix = [];

    // this holds our shader program
    var currProgram;

    // Keep a reference to the default program object
    // in case the user wants to unset his shaders.
    var defaultProgram;
    var programCaches = [];
    
    // Both key and keyCode will be equal to these values
    var _BACKSPACE = 8;
    var _TAB       = 9;
    var _ENTER     = 10;
    var _RETURN    = 13;
    var _ESC       = 27;
    var _DELETE    = 127;
    var _CODED     = 0xffff;

    // p.key will be CODED and p.keyCode will be this value
    var _SHIFT     = 16;
    var _CONTROL   = 17;
    var _ALT       = 18;
    var _UP        = 38;
    var _RIGHT     = 39;
    var _DOWN      = 40;
    var _LEFT      = 37;

    var codedKeys = [_SHIFT, _CONTROL, _ALT, _UP, _RIGHT, _DOWN, _LEFT];
    
    var vertexShaderSource =
    "varying vec4 frontColor;" +

    "attribute vec3 ps_Vertex;" +
    "attribute vec4 ps_Color;" +
    
    "uniform float ps_PointSize;" +
    "uniform vec3 ps_Attenuation;" +
    
    "uniform mat4 ps_ModelViewMatrix;" +
    "uniform mat4 ps_ProjectionMatrix;" +
    "uniform mat4 ps_SwitchUpAxisMatrix;" +  

    "void main(void) {" +
    "  frontColor = ps_Color;" +
    "  vec4 fixedUpAxisPos4 = ps_SwitchUpAxisMatrix * vec4(ps_Vertex, 1.0);" + 
    "  vec4 ecPos4 = ps_ModelViewMatrix * fixedUpAxisPos4;" +

    "  float dist = length(ecPos4);" +
    "  float attn = ps_Attenuation[0] + " +
    "              (ps_Attenuation[1] * dist) + " + 
    "              (ps_Attenuation[2] * dist * dist);" +
    
    "  gl_PointSize = (attn > 0.0) ? ps_PointSize * sqrt(1.0/attn) : 1.0;" +
    "  gl_Position = ps_ProjectionMatrix * ecPos4;" +
    "}";

    var fragmentShaderSource =
    "#ifdef GL_ES                 \n" +
    "  precision highp float;     \n" +
    "#endif                       \n" +
                                  
    "varying vec4 frontColor;      " + 
    "void main(void){              " + 
    "  gl_FragColor = frontColor;  " + 
    "}";

    console = window.console;
    
	var progress = document.querySelector('.percent');

    /**
      @private
      
      Set a uniform integer
      
      @param {WebGLProgram} programObj
      @param {String} varName
      @param {Number} varValue
    */
    function uniformi(programObj, varName, varValue) {
      var varLocation = ctx.getUniformLocation(programObj, varName);
      // the variable won't be found if it was optimized out.
      if (varLocation !== -1) {
        if (varValue.length === 4) {
          ctx.uniform4iv(varLocation, varValue);
        } else if (varValue.length === 3) {
          ctx.uniform3iv(varLocation, varValue);
        } else if (varValue.length === 2) {
          ctx.uniform2iv(varLocation, varValue);
        } else {
          ctx.uniform1i(varLocation, varValue);
        }
      }
    }

    /**
      @private
      
      Set a uniform float
      
      @param {WebGLProgram} programObj
      @param {String} varName
      @param {Number} varValue
    */
    function uniformf(programObj, varName, varValue) {
      var varLocation = ctx.getUniformLocation(programObj, varName);
      // the variable won't be found if it was optimized out.
      if (varLocation !== -1) {
        if (varValue.length === 4) {
          ctx.uniform4fv(varLocation, varValue);
        } else if (varValue.length === 3) {
          ctx.uniform3fv(varLocation, varValue);
        } else if (varValue.length === 2) {
          ctx.uniform2fv(varLocation, varValue);
        } else {
          ctx.uniform1f(varLocation, varValue);
        }
      }
    }

    /**
      @private
      
      @param {WebGLProgram} programObj
      @param {String} varName
      @param {Number} size
      @param {} VBO


	  I don't use this.


    */
    function vertexAttribPointer(programObj, varName, size, VBO) {
      var varLocation = ctx.getAttribLocation(programObj, varName);
      if (varLocation !== -1) {
        ctx.bindBuffer(ctx.ARRAY_BUFFER, VBO);

	if (varName === 'ps_Color')
          ctx.vertexAttribPointer(varLocation, size, ctx.UNSIGNED_BYTE, true, 0, 0);  // colors
	else {
          ctx.vertexAttribPointer(varLocation, size, ctx.FLOAT, false, 0, 0);  // vertices
	}

        ctx.enableVertexAttribArray(varLocation);
      }
    }
    
    /**
      @private
      
      @param {} parser
    */
    function getParserIndex(parser){
      var i;
      for(i = 0; i < parsers.length; i++){
        if(parsers[i] === parser){break;}
      }
      return i;
    }
    
    /**
      @private
      
      Create a buffer object which will contain
      the Vertex buffer object for the shader along
      with a reference to the original array
      
      A 3D context must exist before calling this function
      
      @param {Array} arr
      
      @returns {Object}
    */
    function createBufferObject(arr){
    
      // !! add check for length > 0
      if(ctx){
        var VBO = ctx.createBuffer();
        ctx.bindBuffer(ctx.ARRAY_BUFFER, VBO);

        ctx.bufferData(ctx.ARRAY_BUFFER, arr, ctx.DYNAMIC_DRAW);
        
        // length is simply for convenience
        var obj = {
          length: arr.byteLength/16,
          VBO: VBO,
          array: arr
        };
        
        return obj;
      }
    }
    
    /**
      @private
      
      @param {WebGLProgram} programObj
      @param {String} varName
    */
    function disableVertexAttribPointer(programObj, varName){
     var varLocation = ctx.getAttribLocation(programObj, varName);
     if (varLocation !== -1) {
       ctx.disableVertexAttribArray(varLocation);
     }
    }
    
    /**
      @private
    */
    function getUserAgent(userAgentString){
      
      // keep in this order
      if(userAgentString.match(/Chrome/)){
        return CHROME;
      }
      if(userAgentString.match(/AppleWebKit/)){
        return WEBKIT;
      }
      if(userAgentString.match(/Minefield/)){
        return MINEFIELD;
      }
    }

    /**
      @private
      
      Sets a uniform matrix
      
      @param {WebGLProgram} programObj
      @param {String} varName
      @param {Boolean} transpose must be false
      @param {Array} matrix
    */
    function uniformMatrix(programObj, varName, transpose, matrix) {
      var varLocation = ctx.getUniformLocation(programObj, varName);
      // the variable won't be found if it was optimized out.
      if (varLocation !== -1) {
        if (matrix.length === 16) {
          ctx.uniformMatrix4fv(varLocation, transpose, matrix);
        } else if (matrix.length === 9) {
          ctx.uniformMatrix3fv(varLocation, transpose, matrix);
        } else {
          ctx.uniformMatrix2fv(varLocation, transpose, matrix);
        }
      }
    }

    /**
      @private
      
      @param {} ctx
      @param {String} vetexShaderSource
      @param {String} fragmentShaderSource
    */
    function createProgramObject(ctx, vetexShaderSource, fragmentShaderSource) {
      var vertexShaderObject = ctx.createShader(ctx.VERTEX_SHADER);
      ctx.shaderSource(vertexShaderObject, vetexShaderSource);
      ctx.compileShader(vertexShaderObject);
      if (!ctx.getShaderParameter(vertexShaderObject, ctx.COMPILE_STATUS)) {
        throw ctx.getShaderInfoLog(vertexShaderObject);
      }

      var fragmentShaderObject = ctx.createShader(ctx.FRAGMENT_SHADER);
      ctx.shaderSource(fragmentShaderObject, fragmentShaderSource);
      ctx.compileShader(fragmentShaderObject);
      if (!ctx.getShaderParameter(fragmentShaderObject, ctx.COMPILE_STATUS)) {
        throw ctx.getShaderInfoLog(fragmentShaderObject);
      }

      var programObject = ctx.createProgram();
      ctx.attachShader(programObject, vertexShaderObject);
      ctx.attachShader(programObject, fragmentShaderObject);
      ctx.linkProgram(programObject);
      if (!ctx.getProgramParameter(programObject, ctx.LINK_STATUS)) {
        throw "Error linking shaders.";
      }

      return programObject;
    }

    /**
      @private
      
      Used by keyboard event handlers
      
      @param {} code
      @param {} shift
      
      @returns
    */
    function keyCodeMap(code, shift) {
      // Letters
      if (code >= 65 && code <= 90) { // A-Z
        // Keys return ASCII for upcased letters.
        // Convert to downcase if shiftKey is not pressed.
        if (shift) {
          return code;
        }
        else {
          return code + 32;
        }
      }
      // Numbers and their shift-symbols
      else if (code >= 48 && code <= 57) { // 0-9
        if (shift) {
          switch (code) {
            case 49:
              return 33; // !
            case 50:
              return 64; // @
            case 51:
              return 35; // #
            case 52:
              return 36; // $
            case 53:
              return 37; // %
            case 54:
              return 94; // ^
            case 55:
              return 38; // &
            case 56:
              return 42; // *
            case 57:
              return 40; // (
            case 48:
              return 41; // )
            default:
              return 0;
          }
        }
      }
      // Symbols and their shift-symbols
      else {
        if (shift) {
          switch (code) {
            case 107:
              return 43; // +
            case 219:
              return 123; // {
            case 221:
              return 125; // }
            case 222:
              return 34; // "
            default:
              return 0;
          }
        } else {
          switch (code) {
            case 188:
              return 44; // ,
            case 109:
              return 45; // -
            case 190:
              return 46; // .
            case 191:
              return 47; // /
            case 192:
              return 96; // ~
            case 219:
              return 91; // [
            case 220:
              return 92; // \
            case 221:
              return 93; // ]
            case 222:
              return 39; // '
            default:
              return 0;
          }
        }
      }
      return code;
    }
    
    /**
      @private
      
      @param {} evt
      @param {} type
    */
    function keyFunc(evt, type){
      var key;
      if (evt.charCode){
        key = keyCodeMap(evt.charCode, evt.shiftKey);
      } else {
        key = keyCodeMap(evt.keyCode, evt.shiftKey);
      }
      return key;
    }

    /***************************************/
    /**********  Parser callbacks **********/
    /***************************************/

    /**
      @private
      
      The parser calls this when the parsing has started.
      
      @param {Object} parser
    */
    function startCallback(parser){
      var i = getParserIndex(parser);
      pointClouds[i].status = STARTED;
    }
    
    /**
      @private
      
      The parser will call this when it is done parsing a chunk of data.

      It cannot be assumed that the parsers will send in vertex, color,
      and normal data at the same time. For example, the PSI parser will
      send in all the vertex and color data first. Once it has finished
      with those, it will begin sending normal data. The library must
      accomodate for these cases.
      
      @param {Object} parser - The instance of the parser. There can be many
      instances the library is using if the user has loaded multiple point
      clouds.
      
      @param {Object} attributes - contains name/value pairs of arrays
      
      For example, the PSI parser will send in data which looks something
      like this:
      {
        "ps_Vertex": [.....],
        "ps_Color":  [.....],
        "ps_Normal": [.....]
      }
    */
    function parseCallback(parser, attributes){

      var parserIndex = getParserIndex(parser);
      var pc = pointClouds[parserIndex];

      pc.status = STREAMING;
      pc.progress = parser.progress;

      progress.style.width = pc.progress + '%';
      progress.textContent = pc.progress + '%';

      pc.numPoints = parser.numParsedPoints;
      
      if (!pc.attributes['ps_Vertex']){
        pc.attributes['ps_Vertex'] = [];
      }

      var buffObj = createBufferObject(attributes['ps_Vertex']);
      pc.attributes['ps_Vertex'].push(buffObj);
      
      var coords = new Float32Array(attributes['ps_Vertex']);

      for (var j=0; j < coords.length; j+=4) {
		pc.boundingBoxMin[0] = Math.min(pc.boundingBoxMin[0], coords[j]);
		pc.boundingBoxMin[1] = Math.min(pc.boundingBoxMin[1], coords[j+1]);
		pc.boundingBoxMin[2] = Math.min(pc.boundingBoxMin[2], coords[j+2]);

		pc.boundingBoxMax[0] = Math.max(pc.boundingBoxMax[0], coords[j]);
		pc.boundingBoxMax[1] = Math.max(pc.boundingBoxMax[1], coords[j+1]);
		pc.boundingBoxMax[2] = Math.max(pc.boundingBoxMax[2], coords[j+2]);
      }

	  /*
	   * default transformation matrix (as defined in UpAxisMatrix) is to convert z-up to y-up
	   * So we have to do the same thing for point cloud's center coordinate
	   * without this center coor's transform, point cloud that is located far from 0,0,0 won't be visible in camera's view point
	  */
      pc.center[0] = -(pc.boundingBoxMax[0] + pc.boundingBoxMin[0])/2;
      pc.center[2] = (pc.boundingBoxMax[1] + pc.boundingBoxMin[1])/2;
      pc.center[1] = (pc.boundingBoxMax[2] + pc.boundingBoxMin[2])/2;

      pc.radius = Math.max(pc.boundingBoxMax[0]-pc.center[0], pc.boundingBoxMax[2]-pc.center[2]);

    } // parseCallback
        
    //The parser will call this when the file is done being downloaded.
    function loadedCallback(parser){
      var parserIndex = getParserIndex(parser);
      var pc = pointClouds[parserIndex];

	  pc.originalCenter = pc.center;
	  //console.log('pc.originalCenter = ' + pc.originalCenter);
      
      pc.status = COMPLETE;
      pc.progress = 100;

      progress.style.width = '100%';
      progress.textContent = '100%';
    }
    
    function renderLoop(){
      //frames++;
      //frameCount++;
      //var now = new Date();

      matrixStack.push(M4x4.I);
      usersRender();
      matrixStack.pop();
      
      // if more than 1 second has elapsed, recalculate fps
      //if(now - lastTime > 1000){
      //  frameRate = frames/(now-lastTime)*1000;
      //  frames = 0;
      //  lastTime = now;
      //}
    }
    
    /**
      @private
    */
    function getAverage(arr){
      var objCenter = [0, 0, 0];

      for(var i = 0; i < arr.length; i += 3){
        objCenter[0] += arr[i];
        objCenter[1] += arr[i+1];
        objCenter[2] += arr[i+2];
      }

      objCenter[0] /= arr.length/3;
      objCenter[1] /= arr.length/3;
      objCenter[2] /= arr.length/3;

      return objCenter;
    }
    
    /**
      @private
      
      @param {} element
      @param {} type
      @param {Function} func
    */
    function attach(element, type, func){
      //
      if(element.addEventListener){
        element.addEventListener(type, func, false);
      } else {
        element.attachEvent("on" + type, fn);
      }
    }
    
    /**
      @private
      
      These uniforms only need to be set once during the use of
      the program. Unless of course the user explicitly sets the
      point size, attenuation or projection.
    */
    function setDefaultUniforms(){
      uniformf(currProgram, "ps_PointSize", 1);
      uniformf(currProgram, "ps_Attenuation", [attn[0], attn[1], attn[2]]); 
      uniformMatrix(currProgram, "ps_ProjectionMatrix", false, projectionMatrix);
    }
    
    /**
      @private
      
      @param {} evt
    */
    function mouseScroll(evt){
      var delta = 0;
     
      if(evt.detail){
        delta = evt.detail / 3;
      }
      else if(evt.wheelDelta){
        delta = -evt.wheelDelta / 360;
      }
      userMouseScroll(delta);
    }
    
    /**
      @private
    */
    function mousePressed(evt){
      var IsRightClick = (evt.which==3) ? true : false;	
      userMousePressed(IsRightClick);
    }
    
    /**
      @private
    */
    function mouseReleased(){
      userMouseReleased();
    }
    
    /**
      @private
      
      @param {} evt
    */
    function mouseMoved(evt){
      mouseX = evt.pageX;
      mouseY = evt.pageY;
    }
    
    /**
      @private

      @param {} evt
    */
    function keyDown(evt){
      key = keyFunc(evt, userKeyDown);
      userKeyDown();
    }
    
    /**
      @private

      @param {} evt
    */
    function keyPressed(evt){
      key = keyFunc(evt, userKeyPressed);
      userKeyPressed();
    }
    
    /**
      @private
      
      @param {} evt
    */
    function keyUp(evt){
      key = keyFunc(evt, userKeyUp);
      userKeyUp();
    }
    
    /*************************************/
    /**********  Public methods **********/
    /*************************************/
    
    /**
      @name PointStream#onMousePressed
      @event

      Set a function to run when a mouse button is pressed.

      @param {Function} func
    */
    this.__defineSetter__("onMousePressed", function(func){
      userMousePressed = func;
    });
    
    /**
      @name PointStream#onMouseReleased
      @event

      Set a function to run when a mouse button is released.

      @param {Function} func
    */
    this.__defineSetter__("onMouseReleased", function(func){
      userMouseReleased = func;
    });
    
    /**
      @name PointStream#onMouseScroll
      @event

      Set a function to run when the mouse wheel is scrolled.

      @param {Function} func
    */
    this.__defineSetter__("onMouseScroll", function(func){
      userMouseScroll = func;
    });
    
    /**
      @name PointStream#onKeyDown
      @event

      Set a function to run when a key is pressed.

      @param {Function} func
    */
    this.__defineSetter__("onKeyDown", function(func){
      userKeyDown = func;
    });
    
    /**
      @name PointStream#onKeyPressed
      @event

      Set a function to run when a key is pressed and released.

      @param {Function} func
    */
    this.__defineSetter__("onKeyPressed", function(func){
      userKeyPressed = func;
    });
    
    /**
      @name PointStream#onKeyUp
      @event

      Set a function to run when a key is released.

      @param {Function} func
    */
    this.__defineSetter__("onKeyUp", function(func){
      userKeyUp = func;
    });
    
    /**
      @name PointStream#onRender
      @event

      Set a function to run when a frame is to be rendered.
      
      @param {Function} func
      
      @example
      psInstance.onRender = function(){
        psInstance.translate(0, 0, -25);
        psInstance.clear();
        psInstance.render(pointCloudObj);
      };
    */
    this.__defineSetter__("onRender", function(func){
      usersRender = func;
    });
    
    /*************************************/
    /********** Transformations **********/
    /*************************************/
    
    /**
      Get the current mouse cursor's x coordinate 
      @name PointStream#mouseX
      @returns {Number}
    */
    this.__defineGetter__("mouseX", function(){
      return mouseX;
    });
    
    /**
      Get the current mouse cursor's y coordinate
      @name PointStream#mouseY
      @returns {Number}
    */
    this.__defineGetter__("mouseY", function(){
      return mouseY;
    });
    
    /**
      Get the last key that was pressed by the user.
      @name PointStream#key
      @returns {Number}
    */
    this.__defineGetter__("key", function(){
      return key;
    });

    /**
      Get the width of the canvas.
      @name PointStream#width
      @returns {Number}
    */
    this.__defineGetter__("width", function(){
      return width;
    });

    /**
      Get the height of the canvas.
      @name PointStream#height
      @returns {Number}
    */
    this.__defineGetter__("height", function(){
      return height;
    });
    
    /**
      Get the version of the library.
      @name PointStream#version
      @returns {String}
    */
    this.__defineGetter__("version", function(){
      return VERSION;
    });
    
    /**      
      Get the last calculated frames per second. This is updated
      every second.
      @name PointStream#frameRate
      @returns {Number}
    */
    this.__defineGetter__("frameRate", function(){
      return frameRate;
    });
    
    /**
    */
    this.__defineGetter__("frameCount", function(){
      return frameCount;
    });

    /**
      Sets the background color.
      
      @param {Array} color Array of 4 values ranging from 0 to 1.
    */
    this.background = function(color){
      ctx.clearColor(color[0], color[1], color[2], color[3]);
    };
    
    /**
      Clears the color and depth buffers.
    */
    this.clear = function(){
      ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);
    };
        
    this.upload = function (pointCloud, cloudName) {

      // gotta have data before uploading
      if (pointCloud.attributes['ps_Vertex']) {
 
	var arrayOfVBOs = pointCloud.attributes['ps_Vertex'];

	// iterate thru each VBO element; upload each async
	for (var i=0; i<arrayOfVBOs.length; i++){
	   var xhr = new XMLHttpRequest();
	   xhr.open('POST', '/upload', true);
	   xhr.onload = function(e) {  };

	   // our pointcloud's metadata. I think a lot more are to be added
	   xhr.setRequestHeader("X-cloudName", cloudName);
	   xhr.setRequestHeader("X-cloudSequence", i);
	   xhr.setRequestHeader("X-cloudArrayByteLength", pointCloud.attributes['ps_Vertex'][i].array.byteLength);
	   xhr.setRequestHeader("X-cloudNumPoints", pointCloud.numPoints);
	   xhr.send(pointCloud.attributes['ps_Vertex'][i].array);

	} // for

	// finalize upload process
	var xhr = new XMLHttpRequest();
	xhr.open('POST', '/finalize', true);
	xhr.setRequestHeader("X-cloudName", cloudName);
	xhr.setRequestHeader("X-cloudTotalSequence", arrayOfVBOs.length);
	xhr.send('');

      } // check attribute

    } // this.upload

    this.render = function(pointCloud){
    
      // Don't bother doing any work if we don't have a context yet.
      if (ctx) {


        // We need to find a way to detect normals. If normals don't exist,
        // we don't need to figure out the normal transformation.
        //normalMatrix = M4x4.inverseOrthonormal(topMatrix);
        //uniformMatrix(currProgram, "ps_NormalMatrix", false, M4x4.transpose(normalMatrix));

        var topMatrix = this.peekMatrix();
        uniformMatrix(currProgram, "ps_ModelViewMatrix", false, topMatrix);
        uniformMatrix(currProgram, "ps_SwitchUpAxisMatrix", false, this.UpAxisMatrix);

		var cor = 0;
		if (projectionMatrix[15]==1)  // check if we're in ortho mode by looking at last element in projectionMatrix
		  cor = -topMatrix[14] * 1/400;
		else // perspective mode
		  cor = -topMatrix[14] * 1/20;

		if (cor < 1) cor = 1;

		// draw gnomon
		var axisX = new Float32Array([0,0,0, cor,0,0,
									  0,0.001,0, cor,0.001,0,
									  0,0.002,0, cor,0.002,0,
									  0,0.003,0, cor,0.003,0,
									  0,0.004,0, cor,0.004,0,

									  0,0,0, 0,cor,0,
									  0.001,0,0, 0.001,cor,0,
									  0.002,0,0, 0.002,cor,0,
									  0.003,0,0, 0.003,cor,0,
									  0.004,0,0, 0.004,cor,0,

									  0,0,0,     0,0,cor,
									  0.001,0,0, 0.001,0,cor,
									  0.002,0,0, 0.002,0,cor,
									  0.003,0,0, 0.003,0,cor,
									  0.004,0,0, 0.004,0,cor,
									  ]);
		var bufLines = ctx.createBuffer();
        ctx.bindBuffer(ctx.ARRAY_BUFFER, bufLines);
        ctx.bufferData(ctx.ARRAY_BUFFER, axisX, ctx.STATIC_DRAW);

		var colorX = new Uint8Array([255,0,0, 255,0,0,
									 255,0,0, 255,0,0,
									 255,0,0, 255,0,0,
									 255,0,0, 255,0,0,
									 255,0,0, 255,0,0,

									 0,255,0, 0,255,0,
									 0,255,0, 0,255,0,
									 0,255,0, 0,255,0,
									 0,255,0, 0,255,0,
									 0,255,0, 0,255,0,

									 0,0,255, 0,0,255,
									 0,0,255, 0,0,255,
									 0,0,255, 0,0,255,
									 0,0,255, 0,0,255,
									 0,0,255, 0,0,255
									 ]);
		var bufColors = ctx.createBuffer();
        ctx.bindBuffer(ctx.ARRAY_BUFFER, bufColors);
        ctx.bufferData(ctx.ARRAY_BUFFER, colorX, ctx.STATIC_DRAW);

	    var aaa = ctx.getAttribLocation(currProgram, 'ps_Vertex');
        ctx.bindBuffer(ctx.ARRAY_BUFFER, bufLines);
	    ctx.vertexAttribPointer(aaa, 3, ctx.FLOAT, false, 0, 0);  // vertices
        ctx.enableVertexAttribArray(aaa);

	    var bbb = ctx.getAttribLocation(currProgram, 'ps_Color');
        ctx.bindBuffer(ctx.ARRAY_BUFFER, bufColors);
	    ctx.vertexAttribPointer(bbb, 3, ctx.UNSIGNED_BYTE, false, 0, 0);  // colors
	    ctx.enableVertexAttribArray(bbb);

	  	ctx.drawArrays(ctx.LINES, 0, axisX.length/3);
	    disableVertexAttribPointer(currProgram, 'ps_Vertex');
	    disableVertexAttribPointer(currProgram, 'ps_Color');

        // We need at least positional data.
        if (pointCloud.attributes['ps_Vertex']) {

          var arrayOfBufferObjsV = pointCloud.attributes['ps_Vertex'];

          // Iterate over all the vertex buffer objects.
          for (var currVBO = 0; currVBO < arrayOfBufferObjsV.length; currVBO++){

	      // ps_Vertex
              var attribVertex = ctx.getAttribLocation(currProgram, 'ps_Vertex');
              ctx.bindBuffer(ctx.ARRAY_BUFFER, pointCloud.attributes['ps_Vertex'][currVBO].VBO);
              ctx.vertexAttribPointer(attribVertex, 3, ctx.FLOAT, false, 16, 0);  // vertices
              ctx.enableVertexAttribArray(attribVertex);
              
	      // ps_Color
              var attribColor = ctx.getAttribLocation(currProgram, 'ps_Color');
              ctx.bindBuffer(ctx.ARRAY_BUFFER, pointCloud.attributes['ps_Vertex'][currVBO].VBO);
              ctx.vertexAttribPointer(attribColor, 3, ctx.UNSIGNED_BYTE, true, 16, 12);  // colors
              ctx.enableVertexAttribArray(attribColor);

              ctx.drawArrays(ctx.POINTS, 0, arrayOfBufferObjsV[currVBO].length);

	      //disableVertexAttribPointer(currProgram, 'ps_Vertex' ;	

          } // for-loop currVBO
	} // if - firstSemantic
      } // if - ctx
    }; // this.render
        
    /**
      Resize the viewport.
      This can be called after setup.
      
      @example
      window.onresize = function(){
        ps.resize(window.innerWidth, window.innerHeight);
      };

      @param {Number} pWidth
      @param {Number} pHeight
    */
    this.resize = function(pWidth, pHeight, ctxAttribs){
      // override the canvas attributes
      canvas.setAttribute("width", pWidth);
      canvas.setAttribute("height", pHeight);

      // check if style exists? how? can't just query it...
      canvas.style.width = width = pWidth;
      canvas.style.height = height = pHeight;
      
      var contextNames = ["webgl","experimental-webgl", "moz-webgl","webkit-3d"];
      
      for(var i = 0; i < contextNames.length; i++){
        try{
          ctx = canvas.getContext(contextNames[i], ctxAttribs);
          if(ctx){
            break;
          }
        }catch(e){}
      }
      if(!ctx){
        this.println("Your browser does not support WebGL.");
      }

      // parseInt hack used for Chrome/Chromium
      ctx.viewport(0, 0, parseInt(pWidth, 10), parseInt(pHeight, 10));
      
      this.perspective();
      normalMatrix = M4x4.I;
    };
    
    /**
      Get a PNG of the current frame.

      @example
      var img = document.createElement('img');
      img.src = pointStreamInstance.getPNG();

      @returns HTMLCanvasElement.toDataURL()
    */
    this.getPNG = function(){
      var arr = this.readPixels();
      
      var cvs = document.createElement('canvas');
      cvs.width = width;
      cvs.height = height;
      var ctx2d = cvs.getContext('2d');
      var image = ctx2d.createImageData(cvs.width, cvs.height);

      for (var y = 0; y < cvs.height; y++){
        for (var x = 0; x < cvs.width; x++){
        
          var index = (y * cvs.width + x) * 4;
          var index2 = ((cvs.height-1-y) * cvs.width + x) * 4;
          
          for(var p = 0; p < 4; p++){
            image.data[index2 + p] = arr[index + p];
          }
        }
      }
      ctx2d.putImageData(image, 0, 0);
      return cvs.toDataURL();
    };
    
    /**
      Get the raw RGBA values.
      
      @see getPNG
      
      @returns {Uint8Array}
    */
    this.readPixels = function(){
      var arr = new Uint8Array(width * height * 4);
      ctx.readPixels(0, 0, width, height, ctx.RGBA, ctx.UNSIGNED_BYTE, arr);
      return arr;
    };

    /*************************************/
    /************* Projection ************/
    /*************************************/
    
    /**
      Create an orthographic projection matrix.
      
      If no arguments are provided the default values will be used:
      ortho(0, width, 0, height, -10000, 10000);
      
      @param {Number} left
      @param {Number} rigtht
      @param {Number} bottom
      @param {Number} top
      @param {Number} near
      @param {Number} far
    */
    this.ortho = function(left, right, bottom, top, near, far){
      
      if(arguments.length === 0){
        left = 0;
        right = width;
        bottom = 0;
        top = height;
        near = -10000;
        far = 10000;
      }
      
      var l = left - width/2;
      var r = right - width/2;
          
      var t = top -  height/2;
      var b = bottom - height/2;

      var x = 2 / (r - l);
      var y = 2 / (t - b);
      var z = -2 / (far - near);

      var tx = (-(r + l)) / (r - l);
      var ty = (-(t + b)) / (t - b);
      var tz = (-(far + near)) / (far - near);
      
      projectionMatrix =  M4x4.$( x, 0, 0, tx,
                                  0, y, 0, ty,
                                  0, 0, z, tz,
                                  0, 0, 0, 1);
      if(currProgram){
        uniformMatrix(currProgram, "ps_ProjectionMatrix", false, projectionMatrix);
      }
    };
    
    /**
      Create a perspective projection matrix.
      
      If no arguments are provided the default values will be used:
      perspective(PI/6, width/height, 0.1, 1000);
      
      @param {Number} fovy
      @param {Number} aspect
      @param {Number} near
      @param {Number} far
    */
    this.perspective = function(fovy, aspect, near, far){
    
      if(arguments.length === 0){
        fovy = 60;
        aspect = width/height;
        near = 0.1;
        far = 100000; // far plane is 100,000 units !
      }
      
      var ymax = near * Math.tan(fovy * Math.PI / 360);
      var ymin = -ymax;
      var xmin = ymin * aspect;
      var xmax = ymax * aspect;
      
      var X = 2 * near / (xmax - xmin);
      var Y = 2 * near / (ymax - ymin);
      var A = (xmax + xmin) / (xmax - xmin);
      var B = (ymax + ymin) / (ymax - ymin);
      var C = -(far + near) / (far - near);
      var D = -2 * far * near / (far - near);
      
      projectionMatrix = M4x4.$(X, 0, 0, 0, 
                                0, Y, 0, 0, 
                                A, B, C, -1, 
                                0, 0, D, 0);
      
      if(currProgram){
        uniformMatrix(currProgram, "ps_ProjectionMatrix", false, projectionMatrix);
      }
    };
    
    
    /*************************************/
    /********** Transformations **********/
    /*************************************/

   /**
      @name PointStream#scale
      @function
      
      Multiplies the top of the matrix stack with a uniformly scaled matrix.
      
      @param {Number} s
   */
   /**
      @name PointStream#scale^2
      @function

      Multiplies the top of the matrix stack with a scaled matrix.
      
      @param {Number} sx
      @param {Number} sy
      @param {Number} sz
   */
    this.scale = function(sx, sy, sz){
      var smat = (!sy && !sz) ? M4x4.scale1(sx, M4x4.I) : 
                                M4x4.scale3(sx, sy, sz, M4x4.I);
      this.loadMatrix(M4x4.mul(this.peekMatrix(), smat));
    };
    
    /**
      Multiplies the top of the matrix stack with a translation matrix.
      
      @param {Number} tx
      @param {Number} ty
      @param {Number} tz
    */
    this.translate = function(tx, ty, tz){
      var trans = M4x4.translate3(tx, ty, tz, M4x4.I);
      this.loadMatrix(M4x4.mul(this.peekMatrix(), trans));
    };
        
    /**
      Multiply the matrix at the top of the model view matrix
      stack with a rotation matrix about the x axis.
      
      @param {Number} radians
    */
    this.rotateX = function(radians){
      var rotMat = M4x4.rotate(radians, V3.$(1,0,0), M4x4.I);
      this.loadMatrix(M4x4.mul(this.peekMatrix(), rotMat));
    };
    
    /**
      Multiply the matrix at the top of the model view matrix
      stack with a rotation matrix about the y axis.

      @param {Number} radians
    */
    this.rotateY = function(radians){
      var rotMat = M4x4.rotate(radians, V3.$(0,1,0), M4x4.I);
      this.loadMatrix(M4x4.mul(this.peekMatrix(), rotMat));
    };

    /**
      Multiply the matrix at the top of the model view matrix
      stack with a rotation matrix about the z axis.

      @param {Number} radians
    */
    this.rotateZ = function(radians){
      var rotMat = M4x4.rotate(radians, V3.$(0,0,1), M4x4.I);
      this.loadMatrix(M4x4.mul(this.peekMatrix(), rotMat));
    };
    
    /**
    */
    this.rotate = function(radians, a){
      var rotMat = M4x4.rotate(radians, a, M4x4.I);
      this.loadMatrix(M4x4.mul(this.peekMatrix(), rotMat));
    };
    
    /*********************************************/
    /********** Matrix Stack Operations **********/
    /*********************************************/

    /**
      Pushes on a copy of the matrix at the top of the matrix stack.
    */
    this.pushMatrix = function(){
      matrixStack.push(this.peekMatrix());
    };
    
    /**
      Pops off the matrix on top of the matrix stack.
    */
    this.popMatrix = function(){
      matrixStack.pop();
    };
    
    /**
      Get a copy of the matrix at the top of the matrix stack.
      
      @returns {Float32Array}
    */
    this.peekMatrix = function(){
      return M4x4.clone(matrixStack[matrixStack.length - 1]);
    };

        
    /**
      Set the matrix at the top of the matrix stack.
      
      @param {Float32Array} mat
    */
    this.loadMatrix = function(mat){
      matrixStack[matrixStack.length - 1] = mat;
    };
    
    /**
      
    */
    this.multMatrix = function(mat){
      this.loadMatrix(M4x4.mul(this.peekMatrix(), mat));
    };
    
    /************************************/
    /********** Program Object **********/
    /************************************/

    /**
      Reads the file at path and returns the contents as a string
      
      This function is synchronous
    */
    this.getShaderStr = function(path){
      
      var XHR = new XMLHttpRequest();
      XHR.open("GET", path, false);
      
      if(XHR.overrideMimeType){
        XHR.overrideMimeType("text/plain");
      }
      
      try{
        XHR.send(null);
      }catch(e){
        console.log('XHR error');
      }
      
      return XHR.responseText;
    };

    /**
      Create a program object from a vertex and fragment shader.
      
      @param {String} vertShader
      @param {String} fragShader
    */
    this.createProgram = function(vertShader, fragShader){
      return createProgramObject(ctx, vertShader, fragShader);
    };
    
    /**
    */
    this.getContext = function(){
      return ctx;
    };

   /**
      @name PointStream#useProgram
      @function
      
      Use the built-in program object. This program only renders
      vertex positions and colors.
   */
   /**
      @name PointStream#useProgram^2
      @function
      
      Use a user-defined program object.
      
      @param {WebGLProgram} program
   */
    this.useProgram = function(program){
      currProgram = program ? program : defaultProgram;
      ctx.useProgram(currProgram);
      
      // We don't want to set the static uniforms every frame,
      // but we also can't do it when the user creates the program,
      // so we do it here, but only once
      var alreadySet = false;
      for(var i = 0; i < programCaches.length; i++){
        if(currProgram && programCaches[i] === currProgram){
          alreadySet = true;
        }
      }
      if(alreadySet === false){
        setDefaultUniforms();
        programCaches.push(currProgram);
      }
    };

    /**
      Set a uniform integer variable in the currently loaded program. useProgram()
      must be called before trying to assign a uniform variable.
      
      @param {String} varName
      @param {Number} varValue
    */
    this.uniformi = function(varName, varValue){
      uniformi(currProgram, varName, varValue);
    };
    
    /**
      Set a uniform float variable in the currently loaded program. useProgram()
      must be called before trying to assign a uniform variable.

      @param {String} varName
      @param {Number} varValue
    */
    this.uniformf = function(varName, varValue){
      uniformf(currProgram, varName, varValue);
    };
    
    /**
      Set a uniform matrix variable in the currently loaded program. useProgram() 
      must be called before trying to assign a uniform variable.

      @param {String} varName
      @param {Number} varValue
    */
    this.uniformMatrix = function(varName, varValue){
      uniformMatrix(currProgram, varName, false, varValue);
    };
    
    /*
      Register a user's parser. When a resource is loaded with
      the extension provided by the user, the user's parser will
      be used to parse that resource.
      
      @param {String} extension
      @param {} usersParser
    */
    this.registerParser = function(extension, usersParser){
      registeredParsers[extension] = usersParser;
    };

    /**
      Prints a line of text to the console.
      
      @param {String} message
    */
    this.println = function(message) {
      //var bufferLen = logBuffer.length;
      //if (bufferLen) {
      //  tinylogLite.log(logBuffer.join(""));
      //  logBuffer.length = 0; // clear log buffer
      //}

      //if (arguments.length === 0 && bufferLen === 0) {
      //  tinylogLite.log("");
      //} else if (arguments.length !== 0) {
      //  tinylogLite.log(message);
      //}
    };

    /**
      Add a message to a log buffer without printing to the
      console. Flush the messages with println().
      
      @example
      // prints: testing...1!testing...2!
      ps.print('testing...1!');
      ps.print('testing...2!');
      ps.println();
      
      @param {String} message
    */
    this.print = function(message) {
      //logBuffer.push(message);
    };
        
    /**
      Must be called after the library has been instantiated.
      
      @example
      var ps = new PointStream();
      ps.setup(document.getElementById('canvas'));
  
      @param {canvas} cvs
    */
    this.setup = function(cvs, ctxAttribs){
      canvas = cvs;
      //browser = getUserAgent(navigator.userAgent);
      
      lastTime = new Date();
      frames = 0;

      // if the canvas does not have dimension attributes,
      // use the default canvas dimensions.      
      var cvsWidth = canvas.getAttribute("width");
      var cvsHeight = canvas.getAttribute("height");
      
      if(cvsWidth === null){
        cvsWidth = 300;
      }
      if(cvsHeight === null){
        cvsHeight = 150;
      }

      // This will create our graphics context.
      this.resize(cvsWidth, cvsHeight, ctxAttribs);
      
      ctx.enable(ctx.DEPTH_TEST);

      this.background(bk);
      
      // Create and use the program object
      defaultProgram = currProgram = createProgramObject(ctx, vertexShaderSource, fragmentShaderSource);
      ctx.useProgram(currProgram);
      setDefaultUniforms();
      
      window.PSrequestAnimationFrame = (function(){
        return window.requestAnimationFrame ||
               window.webkitRequestAnimationFrame ||
               window.mozRequestAnimationFrame ||
               window.oRequestAnimationFrame ||
               window.msRequestAnimationFrame ||

               function(callback, cvs){
                 window.setTimeout(callback, 1000.0/60.0);
               };
      })();

      // call the user's render function
      (function animationLoop(){
        renderLoop();
        PSrequestAnimationFrame(animationLoop, canvas);
      })();

      attach(cvs, "mouseup", mouseReleased);
      attach(cvs, "mousedown", mousePressed);
      attach(cvs, "DOMMouseScroll", mouseScroll);
      attach(cvs, "mousewheel", mouseScroll);
      attach(cvs, "mousemove", mouseMoved);
      
      attach(document, "keydown", keyDown);
      attach(document, "keypress", keyPressed);
      attach(document, "keyup", keyUp);
    };
    
    /**
      Set the point attenuation factors.
      
      @param {Number} constant
      @param {Number} linear
      @param {Number} quadratic
    */
    this.attenuation = function(constant, linear, quadratic){
      uniformf(currProgram, "ps_Attenuation", [constant, linear, quadratic]);
    };
    
    //@param {Number} size - in pixels
    this.pointSize = function(size){
      uniformf(currProgram, "ps_PointSize", size);
    };

    this.stop = function(path){
      // get the parser associated with this path
      
      // tell the parser to stop
      for(var i = 0; i < parsers.length; i++){
        if(parsers[i].cloudName === path){
          parsers[i].stop();
        }
      }
    };

    this.load = function(path) {
	
	// path can be either string or object
	// if path is string, the data being load is .pointcloud on server
	// if path is object (ie. File object), load a local file
	var extension = '';
	if (typeof path==='string') {
	  if (path.indexOf('.pointcloud') > 0)
	    extension = 'pointcloud';
	}
	else if (typeof path==='object') {
	  if (path.fileName.indexOf('.pts') > 0)
	    extension = 'pts';
	  else if (path.fileName.indexOf('.ptx') > 0)
		extension = 'ptx';
	}

	if (!registeredParsers[extension]) {
	  throw "There is no parser for the file type: " + extension;
	}

	var parserObject = registeredParsers[extension];
	var parser = new parserObject({ start: startCallback,
                                        parse: parseCallback,
                                        end: loadedCallback});

	// The parser needs to keep track of the file
	// it is loading since the user may want to
	// later cancel loading by file path.
	//parser.cloudName = path;
	parser.cloudName = 'MyCloudName1';   // will have to change later

	var newPointCloud = {
		VBOs: [],
		attributes: {},
		progress: 0,
		getProgress: function(){ return this.progress; },
		status: -1,
		getStatus: function(){ return this.status; },
  
		addedVertices: [0, 0, 0],
		center: [0, 0, 0],
		originalCenter: [0, 0, 0],
		boundingBoxMax: [-1000000, -10000, -1000000],
		boundingBoxMin: [1000000, 10000, 1000000],
		radius: 0,


		getCenter: function(){ return this.center; },
		setCenter: function(c){ this.center = c; },
		getOriginalCenter: function() { return this.originalCenter; },
		getBoundingBoxMax: function() { return this.boundingBoxMax; },
		getBoundingBoxMin: function() { return this.boundingBoxMin; },
		getRadius: function () { return this.radius; },
		  
		numTotalPoints: -1,
		getNumTotalPoints: function(){ return this.numTotalPoints; },
		  
		numPoints: -1,
		getNumPoints: function(){ return this.numPoints; }
	};

	parsers.push(parser);
	pointClouds.push(newPointCloud);

	parser.load(path);

	return newPointCloud;
    }; // this.load
  } // pointstream

  return PointStream;

}());
