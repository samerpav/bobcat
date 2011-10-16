var ps;
var lion;

// Create an orbit camera halfway between the closest and farthest point
var cam = new OrbitCam({closest:0.1, farthest:100000, distance: 10});
var rotationStartCoords = [0, 0];
var isDragging = false;

var panStartCoords = [0, 0];
var isRightDragging = false;

var HPanning = V3.$( 1, 0, 0);
var VPanning = V3.$( 0, 0, 1);
var up = V3.$( 0, 1, 0);

var isInPickMode = false;

var isOrthoMode = false;

const KEY_ESC = 27;

function zoom(amt){
  if(amt < 0){
    cam.goCloser(-amt*2);
  }
  else{
    cam.goFarther(amt*2);
  }
}

function mousePressed(RightClick){
  rotationStartCoords[0] = ps.mouseX;
  rotationStartCoords[1] = ps.mouseY;

  if (RightClick) {
	isRightDragging = true;
  }
  else {
  	isDragging = true;
  }
}

function mouseReleased(){
  isRightDragging = false;
  isDragging = false;
}

function keyDown(){

/*
 *     ps.key is ASCII, not javascript keycode!!!
 */

  if(ps.key == KEY_ESC){
    ps.stop("/clouds/parking-lot.pts");
  }

  //if (ps.key == 48) isInPickMode = true;

  // test set color
  //if (ps.key==48) {
  //  var numChunks = lion.attributes["ps_Color"].length;

  //  for (var i=0; i < numChunks; i++) {
  //     var lenArray = lion.attributes["ps_Color"][i].array.length;
  //     var cols = new Uint8Array(lenArray);

  //     for (var j=0; j<lenArray; j+=3) {
  //        cols[j] = 0;
  //        cols[j+1] = 250;
  //        cols[j+2] = 0;
  //     }
  //     lion.attributes["ps_Color"][i].array = cols;
  //  }
  //}

  // 0 - zoom to fit
  if (ps.key == 48) {
     var fov = 60;
     var half_min_fov_in_radians = 0.5 * (fov * 3.14159265 / 180);
     var aspect = 800/500;

     var distance_to_center = lion.radius/Math.sin(half_min_fov_in_radians);

	 // needed minus to prevent view invertion!
	 var zoomFitCamPos = V3.scale([0,-1,0], -distance_to_center); 

     // need to do this in 2 steps. first call aligns to Z then align to Up
     cam.setPosition([0, 0, -1]);
     cam.setPosition(zoomFitCamPos);
  }

  // o
  if (ps.key == 111)  isOrthoMode=true; 
  
  // p
  if (ps.key == 112) {
	ps.pointSize(0.2);		// must set pointSize BEFORE calling ps.perspective!
	isOrthoMode=false; 
	ps.perspective();
	ps.scale(1,1,1);
	//ps.attenuation(0, 0, 0); // don't think we need this 
  }

  if (ps.key == 49) cam.setPosition( [10, 0, 0] ); // 1
  if (ps.key == 50) cam.setPosition( [0, 0, 10] ); // 2
  if (ps.key == 51) cam.setPosition( [-10, 0, 0] ); // 3
  if (ps.key == 52) cam.setPosition( [0, 0, -10] ); // 4
  if (ps.key == 53) cam.setPosition( [20, 20, 20] ); // 5

  // 6 - for debugging
  if (ps.key == 54) { 
	//console.log(lion.boundingBoxMin[0].toFixed(2) + ' ' + lion.boundingBoxMin[1].toFixed(2) + ' ' + lion.boundingBoxMin[2].toFixed(2));
	//console.log(lion.boundingBoxMax[0].toFixed(2) + ' ' + lion.boundingBoxMax[1].toFixed(2) + ' ' + lion.boundingBoxMax[2].toFixed(2));
	console.log(cam.getMatrix().slice(0,4));
	console.log(cam.getMatrix().slice(4,8));
	console.log(cam.getMatrix().slice(8,12));
	console.log(cam.getMatrix().slice(12,16));
	//console.log('radius = ' + lion.radius);
	console.log('cam.position = ' + cam.position[0].toFixed(2) + ' ' 
								  + cam.position[1].toFixed(2) + ' ' 
								  + cam.position[2].toFixed(2) );
	console.log('cam.distance = ' + cam.distance.toFixed(2));
	//var oc = lion.getOriginalCenter();0
	//console.log('orig center = ' + oc[0] + ' ' + oc[1]+ ' ' + oc[2]); 
    var c = lion.getCenter();
    console.log('current center = ' + c[0].toFixed(2) + ' ' + c[1].toFixed(2) + ' ' + c[2].toFixed(2)  );
  }


  // 7
  // switch between Z-up and Y-up
  if (ps.key == 55) {
	if (ps.UpAxisMatrix[5]==1) {
	  console.log('z-up');
	  ps.UpAxisMatrix = M4x4.$(-1, 0, 0, 0, 
						        0, 0, 1, 0, 
                                0, 1, 0, 0, 
                                0, 0, 0, 1);

	  // the transformation matrix requires that
	  // we swap center-Y and center-Z 
	  // otherwise, the camera won't point in the correct direction
      lion.setCenter([-lion.originalCenter[0], lion.originalCenter[2], lion.originalCenter[1]]);
	}
	else {
	  console.log('y-up');
	  ps.UpAxisMatrix = M4x4.$(1, 0, 0, 0, 
                               0, 1, 0, 0, 
                               0, 0, 1, 0, 
                               0, 0, 0, 1);

	  // revert center back to its original value
      lion.setCenter([lion.originalCenter[0], lion.originalCenter[1], lion.originalCenter[2]]);
	}
  } // 7

  // back slash \
  if (ps.key == 92) {
     cam.setPosition([0, 0, 100]);
  }
}

function Upload() { ps.upload(lion, 'testcloud'); }

function render() {

  if (isDragging === true){		
	var deltaX = ps.mouseX - rotationStartCoords[0];
	var deltaY = ps.mouseY - rotationStartCoords[1];
	rotationStartCoords = [ps.mouseX, ps.mouseY];

	cam.yaw(-deltaX * 0.015); // 0.015 indicates how fast yaw is done
	cam.pitch(deltaY * 0.015);
  } // if-isDragging

  if (isRightDragging === true) {
	var offsetX = ps.mouseX - rotationStartCoords[0];
	var offsetY = ps.mouseY - rotationStartCoords[1];
	rotationStartCoords = [ps.mouseX, ps.mouseY];

	if ((offsetX != 0) || (offsetY !=0)) {
	  	HPanning = V3.cross(cam.direction, up);

		// finally i fixed the damn gimbal lock problem with these 4 lines!!
		if (V3.length(HPanning).toFixed(2)==0) {
		  var camLeft = cam.getMatrix();
	  	  HPanning = V3.$(-camLeft[0], camLeft[1], -camLeft[2]);
		}

	  	VPanning = V3.cross(cam.direction, HPanning);

	  var newPos = V3.add(lion.getCenter(), V3.scale(HPanning, -offsetX/20));
	  newPos = V3.add(newPos, V3.scale(VPanning, -offsetY/20)); 
	  
	  var curCen = lion.getCenter();
	  lion.setCenter([newPos[0], newPos[1], newPos[2]]);
	}	
  } // if-isRightDragging

  if (isOrthoMode===true) {
  	ps.ortho();
	var dist = cam.distance;
	var sc = 400; // magic number... may be aspect-ratio specific
	var scaleFactor = 1/dist*sc;
  	ps.scale(scaleFactor, scaleFactor, scaleFactor);
	
	//
	// don't think I need any of this crap
	//
	//var c = cam.position;
    //cam.setPosition( V3.scale(c, 1/30) );
	//ps.attenuation(10, 0, 0); // don't think we need this
  	//ps.pointSize(5);
  }

  var c = lion.getCenter();
  ps.multMatrix(M4x4.makeLookAt(cam.position, cam.direction, cam.up));
  ps.translate(-cam.position[0]-c[0], -cam.position[1]-c[1], -cam.position[2]-c[2]);
  ps.clear();
  ps.render(lion);

} // render

// entry point for loading local file on client
function start(){
  ps = new PointStream();
  ps.setup(document.getElementById('canvas'));
  ps.background([0.0, 0.0 ,0.0 ,1]);
  ps.pointSize(0.2);

  ps.resize(window.innerWidth-100, window.innerHeight-100);
  ps.onRender = render;
  ps.onMouseScroll = zoom;
  ps.onMousePressed = mousePressed;
  ps.onMouseReleased = mouseReleased;
  ps.onKeyDown = keyDown;
  
  // default up axis is Z
  ps.UpAxisMatrix = M4x4.$(-1, 0, 0, 0, 
                            0, 0, 1, 0, 
                            0, 1, 0, 0, 
                            0, 0, 0, 1);

  input = document.getElementById('fileinput');
  selectedFile = input.files[0];
  lion = ps.load(selectedFile);

  //lion = ps.load("/clouds/parking-lot-3M.pts"); // old way for loading pts file
}

// entry point for loading .pointcloud on server
function startServer(){
  ps = new PointStream();
  ps.setup(document.getElementById('canvas'));
  ps.background([0.0, 0.0 ,0.0 ,1]);
  ps.pointSize(0.2);

  ps.resize(window.innerWidth-100, window.innerHeight-100);
  ps.onRender = render;
  ps.onMouseScroll = zoom;
  ps.onMousePressed = mousePressed;
  ps.onMouseReleased = mouseReleased;
  ps.onKeyDown = keyDown;
  
  // default up axis is Z
  ps.UpAxisMatrix = M4x4.$(-1, 0, 0, 0, 
                           0, 0, 1, 0, 
                           0, 1, 0, 0, 
                           0, 0, 0, 1);

  lion = ps.load('testcloud.pointcloud');
}

  var pMatrixInv;
  function perspectiveInv(fovy, aspect, znear, zfar) {
    pMatrixInv = makePerspectiveInv(fovy, aspect, znear, zfar);
  } 

  function makePerspectiveInv(fovy, aspect, znear, zfar)
  {
    var ymax = znear * Math.tan(fovy * Math.PI / 360.0);
    var ymin = -ymax;
    var xmin = ymin * aspect;
    var xmax = ymax * aspect;

    return makeFrustumInv(xmin, xmax, ymin, ymax, znear, zfar);
  }


  function makeFrustumInv(left, right,
                     bottom, top,
                     znear, zfar)
  {
    var X = 2*znear/(right-left);
    var Y = 2*znear/(top-bottom);
    var A = (right+left)/(right-left);
    var B = (top+bottom)/(top-bottom);
    var C = -(zfar+znear)/(zfar-znear);
    var D = -2*zfar*znear/(zfar-znear);

    return $M([[1/X, 0, 0, A/X],
               [0, 1/Y, 0, B/Y],
               [0, 0, 0, -1],
               [0, 0, 1/D, C/D]]);
  }


