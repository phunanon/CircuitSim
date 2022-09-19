"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var typeToSymbol = {
    and: "&",
    or: "•",
    not: "~",
    xor: "⊕",
    on: "⭘",
    off: "⏻",
    indicator: "",
    panel: ""
};
var typeToColour = {
    and: "#fa0",
    or: "#0af",
    not: "#f00",
    xor: "#0fa",
    on: "#44f",
    off: "#f44",
    indicator: "#000",
    panel: "#aaa"
};
var keyToType = {
    a: "and",
    o: "or",
    n: "not",
    x: "xor",
    s: "on",
    i: "indicator",
    p: "panel"
};
var abs = Math.abs, sqrt = Math.sqrt, round = Math.round;
function DOM_onload() {
    var canvas = document.querySelector("canvas");
    var gtx = canvas.getContext("2d");
    var gridSize = 32;
    var demoSwitch = {
        id: 0,
        pos: [64, 64],
        size: gridSize / 2,
        type: "on",
        text: "⭘",
        incoming: [],
        live: true
    };
    var demoOr = {
        id: 1,
        pos: [128, 64],
        size: gridSize / 2,
        type: "xor",
        text: "⊕",
        incoming: [demoSwitch]
    };
    var ctx = {
        graphics: {
            canvas: canvas,
            gtx: gtx,
            gridSize: gridSize,
            scale: 1,
            pan: [0, 0]
        },
        components: [demoSwitch, demoOr],
        mouse: [0, 0],
        mouseMoved: false,
        snapToGrid: function (c) {
            var s = gridSize / 2;
            c.pos = [round(c.pos[0] / s) * s, round(c.pos[1] / s) * s];
        }
    };
    setInterval(tick(ctx), 1000 / 20);
    setInterval(tock(ctx), 1000 / 4);
    var html = document.querySelector("html");
    html.addEventListener("wheel", DOM_onscroll(ctx));
    html.addEventListener("mousedown", DOM_onmousedown(ctx));
    html.addEventListener("mousemove", DOM_mousemove(ctx));
    html.addEventListener("mouseup", DOM_onmouseup(ctx));
    html.addEventListener("keyup", DOM_onkeyup(ctx));
    canvas.addEventListener("contextmenu", function (e) { return e.preventDefault(); });
}
function findById(ctx, id) {
    return ctx.components.find(function (c) { return c.id === id; });
}
function mouseInCtx(ctx, x, y) {
    if (x === void 0) { x = ctx.mouse[0]; }
    if (y === void 0) { y = ctx.mouse[1]; }
    var _a = ctx.graphics, scale = _a.scale, pan = _a.pan;
    return [x / scale - pan[0], y / scale - pan[1]];
}
function isPointNearLine(p1, p2, p, dist) {
    if (dist === void 0) { dist = 1; }
    var _a = [p2[0] - p1[0], p2[1] - p1[1]], px = _a[0], py = _a[1];
    var u = ((p[0] - p1[0]) * px + (p[1] - p1[1]) * py) / (px * px + py * py);
    var u2 = u > 1 ? 1 : u < 0 ? 0 : u;
    var _b = [p1[0] + u2 * px, p1[1] + u2 * py], x = _b[0], y = _b[1];
    var _c = [x - p[0], y - p[1]], dx = _c[0], dy = _c[1];
    return sqrt(dx * dx + dy * dy) < dist;
}
function DOM_onscroll(_a) {
    var graphics = _a.graphics;
    return function (e) {
        var x = e.x, y = e.y, deltaY = e.deltaY;
        var canvas = graphics.canvas, scale = graphics.scale, pan = graphics.pan;
        var newScale = scale + (deltaY > 0 ? -1 : 1) * 0.2;
        newScale = Math.max(0.5, newScale);
        newScale = Math.min(3, newScale);
        var oldWidth = canvas.width / scale;
        var oldHeight = canvas.height / scale;
        var newWidth = canvas.width / newScale;
        var newHeight = canvas.height / newScale;
        pan[0] -= (x / canvas.width) * (oldWidth - newWidth);
        pan[1] -= (y / canvas.height) * (oldHeight - newHeight);
        graphics.scale = newScale;
        return false;
    };
}
function DOM_onmousedown(ctx) {
    return function (e) {
        e.preventDefault();
        var _a = ctx.graphics, _b = _a.pan, panX = _b[0], panY = _b[1], scale = _a.scale, gridSize = _a.gridSize;
        var component = ctx.components.find(function (_a) {
            var _b = _a.pos, x = _b[0], y = _b[1], size = _a.size;
            var _c = mouseInCtx(ctx, e.clientX, e.clientY), px = _c[0], py = _c[1];
            var halfGrid = gridSize / 2;
            if (Array.isArray(size)) {
                var w = size[0], h = size[1];
                var _d = [x + halfGrid - w / 2, y + halfGrid - h / 2], cx = _d[0], cy = _d[1];
                return px >= cx && px <= cx + w && py >= cy && py <= cy + h;
            }
            return sqrt(Math.pow((px - x - halfGrid), 2) + Math.pow((py - y - halfGrid), 2)) < size;
        });
        if (component) {
            //Interact with component
            if (e.button === 2) {
                if (component.type === "on") {
                    component.type = "off";
                    component.text = "⏻";
                }
                else if (component.type === "off") {
                    component.type = "on";
                    component.text = "⭘";
                }
                //Drag component
            }
            else {
                var offset = [
                    (e.clientX - panX - component.pos[0] * scale) / scale,
                    (e.clientY - panY - component.pos[1] * scale) / scale,
                ];
                ctx.drag = { id: component.id, offset: offset };
            }
        }
        else {
            ctx.pan = [panX - e.clientX / scale, panY - e.clientY / scale];
        }
        ctx.mouseMoved = false;
    };
}
function DOM_mousemove(ctx) {
    return function (e) {
        var drag = ctx.drag, pan = ctx.pan;
        ctx.mouse = mouseInCtx(ctx, e.clientX, e.clientY);
        var _a = ctx.graphics, _b = _a.pan, panX = _b[0], panY = _b[1], scale = _a.scale;
        if (drag) {
            var component = findById(ctx, drag.id);
            if (component) {
                component.pos = [
                    (e.clientX - panX - drag.offset[0] * scale) / scale,
                    (e.clientY - panY - drag.offset[1] * scale) / scale,
                ];
            }
        }
        else if (pan) {
            var x = pan[0], y = pan[1];
            ctx.graphics.pan = [x + e.clientX / scale, y + e.clientY / scale];
        }
        ctx.mouseMoved = true;
    };
}
function DOM_onmouseup(ctx) {
    return function (e) {
        var components = ctx.components, drag = ctx.drag, pan = ctx.pan, mouseMoved = ctx.mouseMoved, snapToGrid = ctx.snapToGrid;
        //A click
        if (!mouseMoved) {
            //We clicked a component
            if (drag) {
                //Delete the component
                if (e.shiftKey) {
                    var component = findById(ctx, drag.id);
                    if (component) {
                        var index = components.indexOf(component);
                        components.splice(index, 1);
                        components.forEach(function (c) {
                            c.incoming = c.incoming.filter(function (i) { return i.id !== drag.id; });
                        });
                    }
                    //Finish a wire
                }
                else if (ctx.connectingFrom !== undefined) {
                    var componentFrom = findById(ctx, ctx.connectingFrom);
                    var componentTo = findById(ctx, drag.id);
                    if (componentFrom && componentTo) {
                        componentTo.incoming.push(componentFrom);
                    }
                    ctx.connectingFrom = undefined;
                    //Start a wire
                }
                else {
                    ctx.connectingFrom = drag.id;
                }
                ctx.drag = undefined;
                return;
            }
            ctx.pan = undefined;
            //We may have clicked a wire
            var gridHalf = ctx.graphics.gridSize / 2;
            for (var _i = 0, components_1 = components; _i < components_1.length; _i++) {
                var _a = components_1[_i], pos = _a.pos, incoming = _a.incoming;
                var pos1 = [pos[0] + gridHalf, pos[1] + gridHalf];
                for (var i = 0; i < incoming.length; ++i) {
                    var pos2 = incoming[i].pos;
                    pos2 = [pos2[0] + gridHalf, pos2[1] + gridHalf];
                    if (isPointNearLine(pos1, pos2, ctx.mouse, ctx.graphics.scale)) {
                        incoming.splice(i, 1);
                        ctx.drag = undefined;
                        return;
                    }
                }
            }
            ctx.connectingFrom = undefined;
            return;
        }
        if (drag) {
            var component = findById(ctx, drag.id);
            if (component) {
                snapToGrid(component);
            }
            ctx.drag = undefined;
        }
        else if (pan) {
            ctx.pan = undefined;
        }
    };
}
function DOM_onkeyup(ctx) {
    return function (e) {
        var graphics = ctx.graphics, components = ctx.components, snapToGrid = ctx.snapToGrid;
        var _a = [
            ctx.mouse[0] - graphics.gridSize / 2,
            ctx.mouse[1] - graphics.gridSize / 2,
        ], x = _a[0], y = _a[1];
        var newComponentType = keyToType[e.key];
        if (newComponentType) {
            var newComponent = {
                id: components.length,
                pos: [x, y],
                size: newComponentType === "panel"
                    ? [graphics.gridSize, graphics.gridSize]
                    : graphics.gridSize / 2,
                type: newComponentType,
                text: typeToSymbol[newComponentType],
                incoming: []
            };
            if (newComponentType === "or") {
                newComponent.size = graphics.gridSize / 4;
            }
            snapToGrid(newComponent);
            components.push(newComponent);
        }
    };
}
function tick(ctx) {
    return function () {
        var _a = ctx.graphics, canvas = _a.canvas, gtx = _a.gtx, gridSize = _a.gridSize, scale = _a.scale, pan = _a.pan, components = ctx.components;
        var W = (canvas.width = document.body.clientWidth);
        var H = (canvas.height = document.body.clientHeight);
        var gridHalf = gridSize / 2;
        //Clear canvas
        gtx.fillStyle = "#fff";
        gtx.fillRect(0, 0, W, H);
        //Draw grid
        gtx.strokeStyle = "#eee";
        gtx.lineWidth = 1;
        gtx.beginPath();
        for (var x = (pan[0] % gridSize) * scale; x < W; x += gridSize * scale) {
            gtx.moveTo(x, 0);
            gtx.lineTo(x, H);
            gtx.stroke();
        }
        for (var y = (pan[1] % gridSize) * scale; y < H; y += gridSize * scale) {
            gtx.moveTo(0, y);
            gtx.lineTo(W, y);
            gtx.stroke();
        }
        //Scale & translate canvas
        gtx.scale(scale, scale);
        gtx.translate(pan[0], pan[1]);
        //Draw centre dot
        gtx.fillStyle = "#000";
        gtx.beginPath();
        gtx.arc(0, 0, 4, 0, 2 * Math.PI);
        gtx.fill();
        //Draw connections
        gtx.lineWidth = 2;
        components.forEach(function (_a) {
            var _b = _a.pos, x2 = _b[0], y2 = _b[1], incoming = _a.incoming;
            incoming.forEach(function (_a) {
                var _b = _a.pos, x1 = _b[0], y1 = _b[1], live = _a.live;
                gtx.strokeStyle = gtx.createLinearGradient(x1, y1, x2, y2);
                var colour = live ? "#00f" : "#f00";
                gtx.strokeStyle.addColorStop(0, colour);
                gtx.strokeStyle.addColorStop(1, "#eee");
                gtx.beginPath();
                gtx.moveTo(x1 + gridHalf, y1 + gridHalf);
                gtx.lineTo(x2 + gridHalf, y2 + gridHalf);
                gtx.stroke();
            });
        });
        //Draw potential connection
        if (ctx.connectingFrom !== undefined) {
            var componentFrom = findById(ctx, ctx.connectingFrom);
            if (componentFrom) {
                gtx.strokeStyle = "#000";
                gtx.beginPath();
                gtx.moveTo(componentFrom.pos[0] + gridHalf, componentFrom.pos[1] + gridHalf);
                gtx.lineTo(ctx.mouse[0], ctx.mouse[1]);
                gtx.stroke();
            }
        }
        //Draw components
        gtx.font = "24px Symbola";
        gtx.textAlign = "center";
        gtx.textBaseline = "middle";
        components.forEach(function (_a) {
            var _b = _a.pos, x = _b[0], y = _b[1], size = _a.size, symbol = _a.text, type = _a.type, live = _a.live;
            gtx.fillStyle = typeToColour[type];
            if (Array.isArray(size)) {
                gtx.fillRect.apply(gtx, __spreadArray([x, y], size, false));
            }
            else {
                x += gridHalf;
                y += gridHalf;
                gtx.beginPath();
                gtx.arc(x, y, size, 0, 2 * Math.PI);
                gtx.fill();
            }
            gtx.fillStyle = live ? "#fff" : "#000";
            gtx.fillText(symbol, x, y + 1);
        });
    };
}
function calculateCharge(component) {
    var type = component.type, incoming = component.incoming;
    if (type === "on") {
        return true;
    }
    else if (type === "off") {
        return undefined;
    }
    else if (type === "or") {
        return incoming.some(function (_a) {
            var live = _a.live;
            return live;
        }) || undefined;
    }
    else if (type === "and") {
        return (incoming.length && incoming.every(function (_a) {
            var live = _a.live;
            return live;
        })) || undefined;
    }
    else if (type === "not") {
        return (incoming.length && !incoming.some(function (_a) {
            var live = _a.live;
            return live;
        })) || undefined;
    }
    else if (type === "xor") {
        var l = 0;
        for (var i = 0; i < incoming.length; i++) {
            l += Number(incoming[i].live);
            if (l > 1) {
                return undefined;
            }
        }
        return l === 1 || undefined;
    }
}
function tock(_a) {
    var components = _a.components;
    return function () {
        //Effect delayed electification
        components.forEach(function (component) {
            if (component.charged) {
                component.live = true;
                component.charged = undefined;
            }
            else {
                component.live = component.type === "on" || undefined;
            }
        });
        //Calculate delayed electification
        components.forEach(function (component) {
            component.charged = calculateCharge(component);
        });
    };
}
//# sourceMappingURL=index.js.map