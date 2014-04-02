//normalize requestAnimationFrame
window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          function( callback ){
            window.setTimeout(callback, 1000 / 60);
          };
})();

//normalize url
window.URL || (window.URL = window.webkitURL || window.msURL || window.oURL);
navigator.getUserMedia || (navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);


var FACEDETECTION = (function() {
	//"use strict";

	var _canvas,
	    _gui,
		_video, 
		_ctx, 
		_errorContainer, 
		_stat, 
		_statContainer, 
		_img_u8, 
		_previousFrame, 
		_width, 
		_height,
		_currentFacePosition = {
			x: -1,
			y: -1,
			s: -1,
			fit: 0
		};

	var subtractFrames = function( frame1, frame2 ) {
		var n, frame = _ctx.createImageData(_width,_height);
		if(frame1.data.length !== frame2.data.length) {
			console.log("sub: diffrent frame size...");
		} else {
			var pixels = _width*_height, r,g,b;
			while(--pixels){
			   frame.data[4*pixels+0] = (r=(frame1.data[4*pixels+0] - frame2.data[4*pixels+0]) )>0 ? r : (-1)*r; // Red value
			   frame.data[4*pixels+1] = (g=(frame1.data[4*pixels+1] - frame2.data[4*pixels+1]) )>0 ? g : (-1)*g; // Green value
			   frame.data[4*pixels+2] = (b=(frame1.data[4*pixels+2] - frame2.data[4*pixels+2]) )>0 ? b : (-1)*b; // Blue value
			   frame.data[4*pixels+3] = 255; // Alpha value
			}
		}
		return frame;
	};

	var pixelValue = function(frame, x, y) {
		var value = 0,
			pos = (_width*y+x)*4;

		if( frame.data[pos]===255 && frame.data[pos+1]===255 && frame.data[pos+2]===255 ) {
			value = 1;
		}

		return value;
	};

	var binarizeFrame = function( frame1, threshold ) {
		var n, frame = _ctx.createImageData(_width,_height);
		for(var i=0, len = frame1.data.length; i<len; i+=4) {
			var s = frame1.data[i] + frame1.data[i+1] + frame1.data[i+2];
			s/=2.5;
			if( s < threshold ) {
				frame.data[i] = 0;
				frame.data[i+1] = 0;
				frame.data[i+2] = 0;
				frame.data[i+3] = 255;
			} else {
				frame.data[i] = 255;
				frame.data[i+1] = 255;
				frame.data[i+2] = 255;
				frame.data[i+3] = 255;
			};
		}
		return frame;
	};

	var showError = function ( msg ) {
		if(_errorContainer) {
			if(typeof msg === "string") {
				_errorContainer.innerHTML = msg;
			} else {
				_errorContainer.innerHTML = msg.name + " " + msg.message;
			}
		}
	};

	var getThreshold = function( imgData ) {
		var len = _height*_width, med = 0, sum = 0;
		for(var i = 0; i<len; i++) {
			sum += imgData.data[i];
		}
		return sum/len;
	};

	var calculateIntegralImage = function( frame ) {
		var ii = new Int32Array(_width*_height);
		var temp = new Int32Array(_width*_height);
		for(var i=0; i<_width; i++) {
			for(var j=0; j<_height; j++) {
				if(j==0) {
					temp[_width*j+i] = pixelValue(frame, i, j);
				} else {
					temp[_width*j+i] = temp[_width*(j-1)+i] + pixelValue(frame, i, j);
				}
			}
		}
		ii[0] = 0;
		for(var i=0; i<_width; i++) {
			for(var j=0; j<_height; j++) {
				if(i==0) {
					ii[_width*j+i] = temp[_width*j+i];
				} else {
					ii[_width*j+i] = ii[_width*j+(i-1)] + temp[_width*j+i];
				}
			}
		}
		return ii;
	};

	var sum = function(data, x, y, s) {
		var a_pos = _width*(y) + x-s,
			A = data[(a_pos>_width*_height-1) ? _width*_height-1 : a_pos],
			b_pos = _width*(y) + x+s,
			B = data[(b_pos>_width*_height-1) ? _width*_height-1 : b_pos],
			c_pos = _width*(y+3*s) + x-s,
			C = data[(c_pos>_width*_height-1) ? _width*_height-1 : c_pos],
			d_pos = _width*(y+3*s) + x+s,
			D = data[(d_pos>_width*_height-1) ? _width*_height-1 : d_pos],
			ret = ((A+D)-(C+B))>0 ? ((A+D)-(C+B)) : 0;

		return ret;
	};

	var drawFrame = function() {
		_ctx.drawImage(_video, 0, 0, _canvas.width, _canvas.height); //draw webcam to canvas

		var image = _ctx.getImageData(0, 0, _width, _height);

		var imageData = image.data; //detach pixels array from the DOM. 

     	jsfeat.imgproc.grayscale(imageData, _img_u8.data);
    	jsfeat.imgproc.gaussian_blur(_img_u8, _img_u8, 4, 8);
	    
	    //render result of greyscale and gaussian back to image data
	    var data_u32 = new Uint32Array(imageData.buffer);
	    var alpha = (0xff << 24);
	    var i = _img_u8.cols*_img_u8.rows, pix = 0;
	    while(--i >= 0) {
	        pix = _img_u8.data[i];
	        data_u32[i] = alpha | (pix << 16) | (pix << 8) | pix;
	    }
	    image.data = imageData;

	    //parallel for calculating previous frame.
	   	var p = new Parallel({ a: image, b: _previousFrame, width: _width, height: _height});
	    p.spawn(function (data) {
			
			var multiplyFrame = function( frame1, a, width, height ) {
				var n;
				var pixels = width*height, r,g,b;
					while(--pixels){
						frame1.data[4*pixels+0] = frame1.data[4*pixels+0]*a;
						frame1.data[4*pixels+1] = frame1.data[4*pixels+1]*a;
						frame1.data[4*pixels+2] = frame1.data[4*pixels+2]*a;
						frame1.data[4*pixels+3] = 255; // Alpha value
					}
				return frame1;
			};

			var addFrames = function( frame1, frame2 ) {
				var n;
				if(frame1.data.length !== frame2.data.length) {
				} else {
					for(var i=0, len = frame1.data.length; i<len; i++) {
						var add = frame1.data[i] + frame2.data[i];
						frame1.data[i] = (add>255) ? 255 : add;
					}
				}
				return frame1;
			};

		  	var frame1 = multiplyFrame( data.a, 0.85, data.width, data.height );
		  	var frame2 = multiplyFrame( data.b, 0.15, data.width, data.height );

		  	var ret = addFrames(frame1, frame2);

		  	return ret;
		}).then(function (data) {
		  _previousFrame = data;
		});

	    var frameDiff = subtractFrames( image, _previousFrame ),
	    	threshold = getThreshold( frameDiff ),
	  		currentFrameBin = binarizeFrame( frameDiff, 0.7*threshold ),
	  		headtop = findTop(currentFrameBin);


	  	var results = [];
	  	if(headtop.y>0) { // if head moved
	  		var ii = calculateIntegralImage( currentFrameBin );
	  		if(ii[_width*_height-1]>0) { 
	  			for(var x = ((headtop.x - _width/10)>0) ? (headtop.x - _width/10) : 0 ; x <= headtop.x + _width/10; x+=4) {
			  		for(var s = _height/8; s<= _height/3; s+=4) {
			  			var fit = sum(ii, x, headtop.y, s)/Math.pow(s, 1.2);
			  			var result = { x: x, y: headtop.y, s: s, fit: fit };
			  			results.push(result);
			  		}	
			  	}
	  		}
	  		results.sort(function(a,b) { return parseFloat(b.fit) - parseFloat(a.fit) } );
	  	}

	  	if(results[0] && results[0].fit>40) {
	    	_currentFacePosition = results[0];
	    }
	  	
	  	//top of head 
		_ctx.beginPath();
	    _ctx.arc(headtop.x, headtop.y, 4, 0, 2 * Math.PI, false);
	    _ctx.fillStyle = 'green';
	    _ctx.fill();

	    if(_currentFacePosition.x>=0) {
	        _ctx.beginPath();
			_ctx.rect(_currentFacePosition.x-_currentFacePosition.s, _currentFacePosition.y, 2*_currentFacePosition.s, 3*_currentFacePosition.s);
			_ctx.lineWidth = 3;
			_ctx.strokeStyle = 'green';
			_ctx.stroke();
	    }
	    
	};

	var processVideo = function() {
		_stat.new_frame();
		drawFrame();
		_statContainer.innerHTML = _stat.log();
		window.requestAnimFrame(processVideo);
	};

	var handleStream = function(stream) {
		_previousFrame = _ctx.createImageData(_width,_height);
		_video.src = (window.URL && window.URL.createObjectURL) ? window.URL.createObjectURL(stream) : stream;
		processVideo();
	};

	var findTop = function( frame ) {
		var position = { x: -1, y:-1 };

		var pixels = _width*_height;
		for(var i=0; i<pixels; i+=7){ //7px hop
			if(frame.data[4*i+0]===255 && frame.data[4*i+0]===255 && frame.data[4*i+0]===255) {
				var pos = Math.floor(i/_width);
				position.x = i-(pos*_width);
				position.y = pos;
				break;
			}
		}
		return position;
	}

	return {
		init: function(param) {
			if(typeof navigator.getUserMedia === "function") {
				var canvasSelector, errorSelector,
					options = {video: true, toString: function(){ return "video"; }};

				canvasSelector = (typeof param !== "undefined" && param.canvasId) ? '#'+param.canvasId : '#video';
				errorSelector = (typeof param !== "undefined" && param.errorsId) ? '#'+param.errorsId : '#error';
				
				_width = (typeof param !== "undefined" && param.width) ? param.width : _width;
				_height = (typeof param !== "undefined" && param.height) ? param.height : _height;

				_video = document.createElement('video');
				_video.setAttribute('autoplay', true);
				_canvas = document.querySelector(canvasSelector);
				_canvas.width = _width;
				_canvas.height = _height;
				_canvas.style.width = _width+'px';
				_canvas.style.height = _height+'px';
				_errorContainer = document.querySelector(errorSelector);

				_ctx = (_canvas) ? _canvas.getContext('2d') : null;

				navigator.getUserMedia(options, handleStream, showError);

				_stat = new profiler();
				_statContainer = document.querySelector('.stats');

				_img_u8 = new jsfeat.matrix_t(_width, _height, jsfeat.U8_t | jsfeat.C1_t);
				_gui = new dat.GUI()
			} else {
				showError('Browser doesnt support getUserMedia.');
			}
		}
	};
})();
