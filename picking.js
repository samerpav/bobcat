var ps;
var lion;

// Create an orbit camera halfway between the closest and farthest point
var cam = new OrbitCam({closest:0.1, farthest:1000000, distance: 5});
var rotationStartCoords = [0, 0];
var isDragging = false;

var panStartCoords = [0, 0];
var isRightDragging = false;

var HPanning = V3.$( 1, 0, 0);
var VPanning = V3.$( 0, 0, 1);
var up = V3.$( 0, 1, 0);

var isInPickMode = false;

var isOrthoMode = false;
var NeedRender;

const KEY_ESC = 27;

function zoom(amt){
  if(amt < 0){
    cam.goCloser(-amt*2);
	NeedRender = true;
  }
  else{
    cam.goFarther(amt*2);
	NeedRender = true;
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
  // ps.key is ASCII, not javascript keycode!!!

  if(ps.key == KEY_ESC){
    ps.stop("/clouds/parking-lot.pts");
  }

  // s - screenshot
  if (ps.key == 115) {
	var s = ps.getPNG();
	window.open(s, 'snapshot');
	console.log('snapshot..');
	return;
  }

  NeedRender = true;

  // A - test picking
  if (ps.key == 97) {
	isInPickMode = !isInPickMode;
  }

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

	var tree = ps.getOctree().root;

	if (tree.children.length==0) {
		console.log(tree.nodes.length);
		for (var i=0; i<tree.nodes.length; i++) {
			console.log(i);	
		}
	}
	else {
		console.log('children.length : ' + tree.children.length);
	}

	return;

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
	if (ps.RenderMode < 2)
	  ps.RenderMode++;
    else
      ps.RenderMode = 0;
  }
}

function Upload() { ps.upload(lion, 'testcloud'); }


function render() {

  if (isInPickMode===true && isDragging===true) {
	var vx, vy, vz, i, j;

	vx = ps.mouseX;
	vy = ps.mouseY - 34; // offsetTop
	vz = 0.0;

	// NDC coordinates
	var nx = 2.0*vx/(ps.width) - 1.0;		// canvas width
	var ny = 1.0 - 2.0*vy/(ps.height);		// canvas height, original
	var nz = 1.0;
	var nw = 0.0;
	
	// original
	//var nz = 2*vz - 1.0;	      
	//var nw = 1.0		

	var c = Vector.create([nx, ny, nz, nw]);      // Clip coordinates same as NDC coordinates
	//console.dir(c.inspect());

	var t1 = ps.pMatrix();
	var ProjectionMatrix = Matrix.create( [
							[t1[0], t1[1], t1[2], t1[3]],
							[t1[4], t1[5], t1[6], t1[7]],
							[t1[8], t1[9], t1[10], t1[11]],
							[t1[12], t1[13], t1[14], t1[15]]
							]);
	//console.log( ProjectionMatrix.inspect() );

	var mtmp = last_matrix; 
	var ModelViewMatrix = Matrix.create( [
		      [ mtmp[0],  mtmp[1],  mtmp[2],  mtmp[3] ],
		      [ mtmp[4],  mtmp[5],  mtmp[6],  mtmp[7] ],
		      [ mtmp[8],  mtmp[9],  mtmp[10], mtmp[11] ],
			  [ mtmp[12], mtmp[13], mtmp[14], mtmp[15] ]
		   ]);

	var MVP = ProjectionMatrix.x(ModelViewMatrix);
	var MVP_inv = MVP.inverse();


/*
	var t_inv = t2.inv();
	//console.dir( t_inv.inspect() );
	
	// Clipping Space to View Space
	var v = t_inv.x(c);   
	
	// Rescale
	v.elements[0] = v.elements[0] / v.elements[3];
	v.elements[1] = v.elements[1] / v.elements[3];
	v.elements[2] = v.elements[2] / v.elements[3];
	v.elements[3] = 1.0;
	//console.dir( v.inspect() );

	var mvPickMatrix = last_matrix; 
	var mtmp = M4x4.topLeft3x3(mvPickMatrix);
	var R = Matrix.create( [
		      [mtmp[0], mtmp[1], mtmp[2]],
		      [mtmp[3], mtmp[4], mtmp[5]],
		      [mtmp[6], mtmp[7], mtmp[8]]
		   ]);
	var Rt = R.transpose(); 

	// get translation vector
	var t = Vector.create([ mvPickMatrix[12], mvPickMatrix[13], mvPickMatrix[14] ]);

	var tp = Rt.x(t);

	var mvPickMatrixInv = Matrix.I(4);

	for (i=0; i < 3; i++) {
		for (j=0; j < 3; j++) {
			mvPickMatrixInv.elements[i][j] = Rt.elements[i][j];
		}	
	}	

	mvPickMatrixInv.elements[3][0] = -1.0 * tp.elements[0];
	mvPickMatrixInv.elements[3][1] = -1.0 * tp.elements[1];
	mvPickMatrixInv.elements[3][2] = -1.0 * tp.elements[2];
	console.dir(mvPickMatrixInv.inspect());

	var ray_start_point = Vector.create([ 0.0, 0.0, 0.0, 1.0 ]);
	
	// v = point in view space      w = point in world space

	v.elements[3] = 0;                 // Make v a ray in view coordinates
	var w = mvPickMatrixInv.x(v);      // w is now a ray in world coordinates
	var a = mvPickMatrixInv.x(ray_start_point);
   
	var anchor = Vector.create([ a.e(1), a.e(2), a.e(3) ]);
	var direction = Vector.create([ w.e(1), w.e(2), w.e(3) ]);

	var l = Line.create(anchor, direction.toUnitVector());
	//console.dir(l.anchor.inspect());
	console.dir(l.direction.inspect());
*/
	var w = MVP_inv.x(c);
	var direction = Vector.create([ w.e(1), w.e(2), w.e(3) ]);

	var ray_start_point = Vector.create([ 0.0, 0.0, 0.0, 1.0 ]);
	var a = MVP_inv.x(ray_start_point);
	var anchor = Vector.create([ a.e(1), a.e(2), a.e(3) ]);

	ps.PickRay = anchor.dup();
	NeedRender = true;

	isInPickMode = false;
	isDragging = false;
  }

  if (isDragging === true){		
	var deltaX = ps.mouseX - rotationStartCoords[0];
	var deltaY = ps.mouseY - rotationStartCoords[1];
	rotationStartCoords = [ps.mouseX, ps.mouseY];

	cam.yaw(-deltaX * 0.015); // 0.015 indicates how fast yaw is done
	cam.pitch(deltaY * 0.015);

	NeedRender = true;

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
	  
	  lion.setCenter([newPos[0], newPos[1], newPos[2]]);

	  NeedRender = true;
	}	
  } // if-isRightDragging


  if (isOrthoMode===true) {
  	ps.ortho();
	var dist = cam.distance;
	var sc = 400; // magic number... may be aspect-ratio specific
	var scaleFactor = 1/dist*sc;
  	ps.scale(scaleFactor, scaleFactor, scaleFactor);
	NeedRender = true;
	
	//
	// don't think I need any of this crap
	//
	//var c = cam.position;
    //cam.setPosition( V3.scale(c, 1/30) );
	//ps.attenuation(10, 0, 0); // don't think we need this
  	//ps.pointSize(5);
  }

  if (lion.progress < 100) NeedRender = true;

  // if there is no change, skip the render
  if (!NeedRender) return;

  var c = lion.getCenter();
  ps.multMatrix(M4x4.makeLookAt(cam.position, cam.direction, cam.up));
  ps.translate(-cam.position[0]-c[0], -cam.position[1]-c[1], -cam.position[2]-c[2]);
  ps.clear();
  ps.render(lion);

  last_matrix = ps.peekMatrix();

  NeedRender = false;

} // render

// entry point for loading local file on client
function start(){
  ps = new PointStream();
  ps.setup(document.getElementById('canvas'));

  //
  //    currently we use linear gradient background
  //    to use solid color background, uncomment the following line
  //
  //ps.background([0.0, 0.0 ,0.0 ,1]);

  ps.pointSize(0.2);
  ps.resize(window.innerWidth-100, window.innerHeight-100, "{preserveDrawingBuffer: true}");
  ps.onRender = render;
  ps.onMouseScroll = zoom;
  ps.onMousePressed = mousePressed;
  ps.onMouseReleased = mouseReleased;
  ps.onKeyDown = keyDown;

  var last_matrix;

  // default up axis is Z
  ps.UpAxisMatrix = M4x4.$(-1, 0, 0, 0, 
                            0, 0, 1, 0, 
                            0, 1, 0, 0, 
                            0, 0, 0, 1);
  ps.PickRay = Vector.create( [5, 5, 5] );
  ps.RenderMode = 0;

  input = document.getElementById('fileinput');
  selectedFile = input.files[0];
  lion = ps.load(selectedFile);

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


