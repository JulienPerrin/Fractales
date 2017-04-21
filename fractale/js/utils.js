var canvas = document.getElementById('fractale'); 
scale = 2; x_mean = 0; y_mean = 0;
ratio = calculerRatio();
window.onload = function () {
	var ctx = canvas.getContext('2d');
    scale = 2; x_mean = 0; y_mean = 0;
    ratio = calculerRatio();
	
    draw(x_mean, y_mean, scale);
	
	var last = pt(0, 0); 
    var draggedStart, dragStart, dragged; 
    
	canvas.addEventListener ('mousedown', function(evt) {
        if (event.which == 1) {
            document.body.style.mozUserSelect = document.body.style.webkitUserSelect = document.body.style.userSelect = 'none';
            var evtx = event.offsetX || (event.pageX - canvas.offsetLeft);
            var evty = event.offsetY || (event.pageY - canvas.offsetTop);
            last = calculeCoordonnees(evtx, evty); 
            mean_start = pt(x_mean, y_mean); 
            draggedStart = calculeCoordonnees(evtx, evty); 
            dragged = false; dragStart=true;
        }
	},false);
	canvas.addEventListener('mousemove', function(evt){
        var evtx = event.offsetX || (event.pageX - canvas.offsetLeft);
        var evty = event.offsetY || (event.pageY - canvas.offsetTop);
        last = calculeCoordonnees(evtx, evty); 
		dragged = true;
		if (dragStart) {
			x_mean = mean_start.x + (draggedStart.x - last.x) ;  
			y_mean = mean_start.y + (draggedStart.y - last.y) ;
			draw(x_mean, y_mean, scale);
		}
	},false);
	canvas.addEventListener('mouseup',function(evt){
        dragStart = null;
		if (!dragged) zoom(evt.shiftKey ? -1 : 1 );
	},false);

	var scaleFactor = 1.1;
	var zoom = function(clicks){
        if (parseInt(window.getComputedStyle(document.getElementById("fractale"), null).getPropertyValue("width")) / canvas.width == ratio) {
            var pointZoom = calculePositionPx(last.x, last.y);
            translate(last.x, last.y);
            var factor = Math.pow(scaleFactor,clicks);
            scale = scale / factor;
            last = calculeCoordonnees(pointZoom.x, pointZoom.y);
            translate(-last.x, -last.y);
            draw(x_mean, y_mean, scale);
        }
	}

	var handleScroll = function(evt){
		var delta = evt.wheelDelta ? evt.wheelDelta/40 : evt.detail ? -evt.detail : 0;
		if (delta) zoom(delta);
		return evt.preventDefault() && false;
	};
	canvas.addEventListener('DOMMouseScroll',handleScroll,false);
	canvas.addEventListener('mousewheel',handleScroll,false);
};

function redraw() {
    draw(x_mean, y_mean, scale);
}

function translate(x, y) {
    x_mean += x ;
    y_mean += y ;
    draw(x_mean, y_mean, scale);
}

function calculeCoordonnees(evtx, evty) {
    var x = (2 * evtx / ratio / canvas.width - 1) * scale; 
    var y = (canvas.height - 2 * evty / ratio) / canvas.height * scale ; 
    return pt(x, y);
}

function calculePositionPx(x, y) {
    var evtx = (x/scale + 1) * canvas.width * ratio / 2; 
    var evty = (1 - y/scale) * canvas.height * ratio / 2; 
    return pt(evtx, evty);
}

function calculerRatio() {
    return parseInt(window.getComputedStyle(document.getElementById("fractale"), null).getPropertyValue("width")) / canvas.width; 
}

function pt(x, y) {
    return {x, y};
}
