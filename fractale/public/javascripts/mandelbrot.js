function drawSimple() {
    draw(0, 0, 2);
}

function draw(x_mean, y_mean, scale) {
    var canvas = document.getElementById('fractale');
	if (canvas.getContext) {
        canvas.width = 100;
        canvas.height = 100;
        drawPoint(x_mean, y_mean, scale, 1000);
    }
}

function drawPrecise(x_mean, y_mean, scale) {
    var canvas = document.getElementById('fractale');
	if (canvas.getContext) {
        canvas.width = parseInt(document.getElementById("width").value);
        canvas.height = parseInt(document.getElementById("height").value);
        nbMaxIter = parseInt(document.getElementById("max").value);
        drawPoint(x_mean, y_mean, scale, nbMaxIter);
    }
}
		
function drawPoint(x_mean, y_mean, scale, max){
	var canvas = document.getElementById('fractale');
	if (canvas.getContext){
		var ctx = canvas.getContext('2d');
		var width = canvas.width;
		var height = canvas.height;
		
		var id = ctx.createImageData(1,1); // only do this once per page
		var d  = id.data;       			// only do this once per page
		d[0]   = 0;//r
		d[1]   = 0;//g
		d[2]   = 0;//b
		d[3]   = 255;//a: transparency, 0..255
		
		 // = -0.77568377;
		 // = 0.13646737;
		 // = 0.01;
		
		var h_min = 1, h_max = 0, b_min = 1, b_max = 0, iteration_min = max, iteration_max = 0;
		
		for (var col = 0; col < width; col+=15) {
			for (var row = 0; row < height; row+=15) {
				var iteration = itereZ(col, row, scale, x_mean, y_mean, width, height, max);
				if (iteration < max) {
					iteration_min = Math.min(iteration, iteration_min);
					iteration_max = Math.max(iteration, iteration_max);
					var h = iteration/max;
					h_min = Math.min(h, h_min);
					h_max = Math.max(h, h_max);
					var b = iteration/(iteration+8);
					b_min = Math.min(b, b_min);
					b_max = Math.max(b, b_max);
				}
				//console.log(iteration);
			}
		}
		
		for (var row = 0; row < height; row++) {
			for (var col = 0; col < width; col++) {
				var iteration = itereZ(col, row, scale, x_mean, y_mean, width, height, max);
				if (iteration < max) {
					var h0 = iteration/max;
					var h = (h0-(h_max+h_min)/2)/(h_max-h_min)+1/2;
					var s   = 1;
					var b0 = iteration/(iteration+8);
                    //ici, on cherche à eviter d'avoir une brillance trop faible
                    var b  = (b0-(b_max+b_min)/2)*0.8/(b_max-b_min)+1.2/2;
					var hsbToRgb = HSVtoRGB(h, s, b);
					d[0] = hsbToRgb.r;//r
					d[1] = hsbToRgb.g;//g
					d[2] = hsbToRgb.b;//b
				}
				else {
					d[0]   = 0;//r
					d[1]   = 0;//g
					d[2]   = 0;//b
				}
				
				ctx.putImageData(id, col, row);
				//console.log(iteration);
			}
		}
		ajoutLegende(ctx, width, height, x_mean, y_mean, scale, max);
	}
	
	return [h_min, h_max, b_min, b_max, iteration_min, iteration_max];
}

function itereZ(col, row, scale, x_mean, y_mean, width, height, max) {
    var c_re = (scale/2.0)*(col - width/2.0)*4.0/width + x_mean;
    var c_im = (scale/2.0)*(height/2.0 - row)*4.0/width + y_mean;
    var x = 0, y = 0;
    var iteration = 0;
    while (x*x+y*y <= 4 && iteration < max) {
        var x_new = x*x - y*y + c_re;
        y = 2*x*y + c_im;
        x = x_new;
        iteration++;
    }
    return iteration;
}

function ajoutLegende(ctx, width, height, x_mean, y_mean, scale, max) {
    if (document.getElementById("ajouterLegende").checked) {
        ctx.font = Math.floor(width / 30) + "px Georgia";
        ctx.textAlign = "right";
        ctx.fillStyle = "white";
        ctx.fillText("max_iterations : " + max, width * 29 / 30, height * 24 / 28);
        ctx.fillText("scale : " + scale.toPrecision(3), width * 29 / 30, height * 25 / 28);
        ctx.fillText("x_mean : " + x_mean.toPrecision(3), width * 29 / 30, height * 26 / 28);
        ctx.fillText("y_mean : " + y_mean.toPrecision(3), width * 29 / 30, height * 27 / 28);
    }
}

function HSVtoRGB(h, s, v) {
	var r, g, b, i, f, p, q, t;
	if (arguments.length === 1) {
		s = h.s, v = h.v, h = h.h;
	}
	i = Math.floor(h * 6);
	f = h * 6 - i;
	p = v * (1 - s);
	q = v * (1 - f * s);
	t = v * (1 - (1 - f) * s);
	switch (i % 6) {
		case 0: r = v, g = t, b = p; break;
		case 1: r = q, g = v, b = p; break;
		case 2: r = p, g = v, b = t; break;
		case 3: r = p, g = q, b = v; break;
		case 4: r = t, g = p, b = v; break;
		case 5: r = v, g = p, b = q; break;
	}
	return {
		r: Math.round(r * 255),
		g: Math.round(g * 255),
		b: Math.round(b * 255)
	};
}
