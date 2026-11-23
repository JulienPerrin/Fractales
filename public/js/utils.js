export function pt(x, y) {
    return { x, y };
}
export function calculerRatio(canvas) {
    const cssWidth = parseInt(window.getComputedStyle(canvas, null).getPropertyValue("width"), 10);
    return cssWidth / canvas.width;
}
export function calculeCoordonnees(evtx, evty, canvas, ratio, scale) {
    const x = ((2 * evtx) / ratio / canvas.width - 1) * scale;
    const y = ((canvas.height - (2 * evty) / ratio) / canvas.height) * scale;
    return pt(x, y);
}
export function calculePositionPx(x, y, canvas, ratio, scale) {
    const evtx = ((x / scale + 1) * canvas.width * ratio) / 2;
    const evty = ((1 - y / scale) * canvas.height * ratio) / 2;
    return pt(evtx, evty);
}
export function translate(state, x, y, drawFn) {
    state.xMean += x;
    state.yMean += y;
    drawFn(state.xMean, state.yMean, state.scale);
}
function getEventPosition(evt, canvas) {
    const evtx = evt.offsetX || evt.pageX - canvas.offsetLeft;
    const evty = evt.offsetY || evt.pageY - canvas.offsetTop;
    return pt(evtx, evty);
}
export function initViewport(canvas, drawFn) {
    const state = {
        xMean: 0,
        yMean: 0,
        scale: 2,
    };
    const ratio = calculerRatio(canvas);
    drawFn(state.xMean, state.yMean, state.scale);
    let last = pt(0, 0);
    let meanStart = pt(0, 0);
    let draggedStart = pt(0, 0);
    let dragStart = false;
    let dragged = false;
    canvas.addEventListener("mousedown", (evt) => {
        if (evt.button === 0) {
            document.body.style.userSelect = "none";
            const pos = getEventPosition(evt, canvas);
            last = calculeCoordonnees(pos.x, pos.y, canvas, ratio, state.scale);
            meanStart = pt(state.xMean, state.yMean);
            draggedStart = calculeCoordonnees(pos.x, pos.y, canvas, ratio, state.scale);
            dragged = false;
            dragStart = true;
        }
    });
    canvas.addEventListener("mousemove", (evt) => {
        const pos = getEventPosition(evt, canvas);
        last = calculeCoordonnees(pos.x, pos.y, canvas, ratio, state.scale);
        dragged = true;
        if (dragStart) {
            state.xMean = meanStart.x + (draggedStart.x - last.x);
            state.yMean = meanStart.y + (draggedStart.y - last.y);
            drawFn(state.xMean, state.yMean, state.scale);
        }
    });
    canvas.addEventListener("mouseup", (evt) => {
        dragStart = false;
        if (!dragged) {
            zoom(evt.shiftKey ? -1 : 1);
        }
    });
    const scaleFactor = 1.1;
    function zoom(clicks) {
        if (calculerRatio(canvas) === ratio) {
            const pointZoom = calculePositionPx(last.x, last.y, canvas, ratio, state.scale);
            translate(state, last.x, last.y, drawFn);
            const factor = Math.pow(scaleFactor, clicks);
            state.scale = state.scale / factor;
            last = calculeCoordonnees(pointZoom.x, pointZoom.y, canvas, ratio, state.scale);
            translate(state, -last.x, -last.y, drawFn);
            drawFn(state.xMean, state.yMean, state.scale);
        }
    }
    canvas.addEventListener("wheel", (evt) => {
        evt.preventDefault();
        const delta = evt.deltaY ? -evt.deltaY / 100 : 0;
        if (delta) {
            zoom(delta);
        }
    });
    return state;
}
