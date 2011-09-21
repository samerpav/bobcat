var ps;
var UpdateFlag = false;	// call render if true
var lion;

// Create an orbit camera halfway between the closest and farthest point
var cam = new OrbitCam({closest:1, farthest:100, distance: 10});
var rotationStartCoords = [0, 0];
var isDragging = false;

var panStartCoords = [0, 0];
var isRightDragging = false;

var HPanning = V3.$( 1, 0, 0);
var VPanning = V3.$( 0, 0, 1);
var up = V3.$( 0, 1, 0);

var accumX = 0;
var accumY = 0;

var pickX = 0;
var pickY = 0;

var isInPickMode = false;

const KEY_ESC = 27;

function zoom(amt){
  if(amt < 0){
    cam.goCloser(-amt*2);
  }
  else{
    cam.goFarther(amt*2);
  }
  UpdateFlag = true;
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
  UpdateFlag = true;
}

function mouseReleased(){
  isRightDragging = false;
  isDragging = false;
  UpdateFlag = false;
}

function keyDown(){
  if(ps.key == KEY_ESC){
    ps.stop("/clouds/parking-lot.pts");
  }

  //if (ps.key == 48) isInPickMode = true;

  // test set color
  if (ps.key==48) {
    var numChunks = lion.attributes["ps_Color"].length;

    for (var i=0; i < numChunks; i++) {
       var lenArray = lion.attributes["ps_Color"][i].array.length;
       var cols = new Uint8Array(lenArray);

       for (var j=0; j<lenArray; j+=3) {
          cols[j] = 0;
          cols[j+1] = 250;
          cols[j+2] = 0;
       }
       lion.attributes["ps_Color"][i].array = cols;
    }
  }

  if (ps.key == 49) cam.setPosition( [10, 0, 0] ); // 1
  if (ps.key == 50) cam.setPosition( [0, 0, 10] ); // 2
  if (ps.key == 51) cam.setPosition( [-10, 0, 0] ); // 3
  if (ps.key == 52) cam.setPosition( [0, 0, -10] ); // 4
  if (ps.key == 53) cam.setPosition( [20, 20, 20] ); // 5
  if (ps.key == 54) lion.setCenter( [0, 0, 0]); // 6 - reset point cloud center to 0,0,0

  UpdateFlag = true;
}

function Upload() {

   ps.upload(lion, 'testcloud');

}

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
	   VPanning = V3.cross(cam.direction, HPanning);
	   	   
	   var newPos = V3.add(lion.getCenter(), V3.scale(HPanning, -offsetX/20));
	   newPos = V3.add(newPos, V3.scale(VPanning, -offsetY/20)); 

	   var curCen = lion.getCenter();
	   lion.setCenter([newPos[0], newPos[1], newPos[2]]);
	}	
  } // if-isRightDragging

  //
  //         for ortho mode
  //
  //ps.ortho();
  //ps.scale(30, 30, 30);
  //ps.attenuation(10, 0, 0);
  //ps.pointSize(5);

  if (true === true) {
     var c = lion.getCenter();
     ps.multMatrix(M4x4.makeLookAt(cam.position, cam.direction, cam.up));
     ps.translate(-cam.position[0]-c[0], -cam.position[1]-c[1], -cam.position[2]-c[2]);
     ps.clear();
     ps.render(lion);
  }

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
  
  //input = document.getElementById('fileinput');
  //selectedFile = input.files[0];
  lion = ps.load('testcloud.pointcloud');

  //lion = ps.load("/clouds/parking-lot-3M.pts"); // old way for loading pts file
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


