"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var typeToSymbol = __assign({ and: "&", or: "•", not: "~", xor: "⊕" }, { on: "⭘", off: "⏻", indicator: "", panel: "", rand: "⚂" });
function componentColour(_a) {
    var type = _a.type, live = _a.live;
    var types = ["and", "or", "not", "xor", "on", "off", "rand", "panel"];
    var colours = __spreadArray(__spreadArray([], ["#fa0", "#0af", "#f00", "#0fa", "#44f", "#f44", "#4f4"], false), [
        "rgba(200, 200, 200, .5)",
    ], false);
    return colours[types.indexOf(type)] || (live ? "#0f0" : "#000");
}
var keyToType = __assign({ a: "and", o: "or", n: "not", x: "xor" }, { s: "on", i: "indicator", p: "panel", r: "rand" });
var abs = Math.abs, sqrt = Math.sqrt, sin = Math.sin, cos = Math.cos, round = Math.round;
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
function asRect(x) {
    return Array.isArray(x) ? x : [x, x];
}
function touchingPanel(panel, gridSize) {
    var panelId = panel.id, pos = panel.pos, pSize = panel.size;
    return function (_a) {
        var id = _a.id, _b = _a.pos, x = _b[0], y = _b[1];
        if (id === panelId) {
            return false;
        }
        var px = pos[0], py = pos[1];
        var _c = asRect(pSize), pw = _c[0], ph = _c[1];
        return (x > px - gridSize &&
            x < px + pw &&
            y > py - gridSize &&
            y < py + ph);
    };
}
function componentsInGroup(_a) {
    var _b;
    var group = _a.group;
    return (_b = group === null || group === void 0 ? void 0 : group.map(function (_a) {
        var c = _a[0];
        return c;
    })) !== null && _b !== void 0 ? _b : [];
}
function sub(a, b) {
    return [a[0] - b[0], a[1] - b[1]];
}
function add(v, n) {
    return [v[0] + n, v[1] + n];
}
function DOM_onload() {
    var canvas = document.querySelector("canvas");
    var gtx = canvas.getContext("2d");
    var gridSize = 32;
    var ctx = {
        graphics: { canvas: canvas, gtx: gtx, gridSize: gridSize, scale: 1, pan: [0, 0] },
        components: [],
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
    html.addEventListener("keydown", DOM_onkeydown(ctx));
    canvas.addEventListener("contextmenu", function (e) { return e.preventDefault(); });
}
function DOM_onscroll(_a) {
    var graphics = _a.graphics;
    return function (e) {
        var x = e.x, y = e.y, deltaY = e.deltaY;
        var canvas = graphics.canvas, scale = graphics.scale, pan = graphics.pan;
        var newScale = scale + (deltaY > 0 ? -1 : 1) * 0.2;
        newScale = Math.max(0.5, newScale);
        newScale = Math.min(4, newScale);
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
        var _a;
        e.preventDefault();
        var _b = ctx.graphics, _c = _b.pan, panX = _c[0], panY = _c[1], scale = _b.scale, gridSize = _b.gridSize;
        var components = ctx.components.filter(function (_a) {
            var _b = _a.pos, x = _b[0], y = _b[1], size = _a.size;
            var _c = mouseInCtx(ctx, e.clientX, e.clientY), px = _c[0], py = _c[1];
            var halfGrid = gridSize / 2;
            if (Array.isArray(size)) {
                var w = size[0], h = size[1];
                return px >= x && px <= x + w && py >= y && py <= y + h;
            }
            return (sqrt(Math.pow((px - x - halfGrid), 2) + Math.pow((py - y - halfGrid), 2)) < size / 2);
        });
        var component = components.find(function (c) { return c.type !== "panel"; }) || components[0];
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
                else if (component.type === "panel" &&
                    Array.isArray(component.size)) {
                    component.size[0] /= gridSize;
                    component.size[1] /= gridSize;
                    var prompted = prompt("Panel size", component.size.toString());
                    var _d = (_a = prompted === null || prompted === void 0 ? void 0 : prompted.split(/, ?/).map(Number)) !== null && _a !== void 0 ? _a : [0, 0], w = _d[0], h = _d[1];
                    component.size = [w || component.size[0], h || component.size[1]];
                    component.size[0] *= gridSize;
                    component.size[1] *= gridSize;
                }
                //Drag component
            }
            else {
                var calcOffset_1 = function (_a) {
                    var x = _a[0], y = _a[1];
                    return [
                        (e.clientX - panX - x * scale) / scale,
                        (e.clientY - panY - y * scale) / scale,
                    ];
                };
                var offset = calcOffset_1(component.pos);
                ctx.drag = { id: component.id, offset: offset };
                if (component.type === "panel") {
                    component.group = ctx.components
                        .filter(touchingPanel(component, gridSize))
                        .map(function (c) { return [c, calcOffset_1(c.pos)]; });
                }
                else {
                    component.group = undefined;
                }
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
        var _a;
        var drag = ctx.drag, pan = ctx.pan;
        ctx.mouse = mouseInCtx(ctx, e.clientX, e.clientY);
        var _b = ctx.graphics, _c = _b.pan, panX = _c[0], panY = _c[1], scale = _b.scale;
        if (drag) {
            var component = findById(ctx, drag.id);
            if (component) {
                var drags = [[component, drag.offset]];
                drags.push.apply(drags, ((_a = component.group) !== null && _a !== void 0 ? _a : []));
                drags.forEach(function (_a) {
                    var component = _a[0], offset = _a[1];
                    component.pos = [
                        (e.clientX - panX - offset[0] * scale) / scale,
                        (e.clientY - panY - offset[1] * scale) / scale,
                    ];
                });
            }
        }
        else if (pan) {
            var x = pan[0], y = pan[1];
            ctx.graphics.pan = [x + e.clientX / scale, y + e.clientY / scale];
        }
        ctx.mouseMoved = true;
    };
}
function componentClick(e, ctx, component) {
    var isPanel = component.type === "panel";
    //We clicked a component
    if (e.shiftKey) {
        //Delete the component
        var toDelete = [component];
        if (e.ctrlKey) {
            toDelete.push.apply(toDelete, componentsInGroup(component));
        }
        toDelete.forEach(function (c) { return ctx.components.splice(ctx.components.indexOf(c), 1); });
        var deletedIds_1 = toDelete.map(function (c) { return c.id; });
        ctx.components.forEach(function (c) {
            c.incoming = c.incoming.filter(function (i) { return !deletedIds_1.includes(i.id); });
        });
    }
    else if (isPanel && e.ctrlKey) {
        //Save the panel
        saveComponents(__spreadArray([component], componentsInGroup(component), true));
    }
    else if (ctx.connectingFrom !== undefined && component) {
        //Finish a wire
        var componentFrom = findById(ctx, ctx.connectingFrom);
        if (componentFrom) {
            component.incoming.push(componentFrom);
        }
        ctx.connectingFrom = undefined;
    }
    else if (!isPanel) {
        //Start a wire
        ctx.connectingFrom = component.id;
    }
    ctx.drag = undefined;
    return { handled: !isPanel };
}
function DOM_onmouseup(ctx) {
    return function (e) {
        var components = ctx.components, drag = ctx.drag, pan = ctx.pan, mouseMoved = ctx.mouseMoved, snapToGrid = ctx.snapToGrid;
        if (!mouseMoved) {
            //Handle a click
            if (drag) {
                var component = findById(ctx, drag.id);
                if (componentClick(e, ctx, component).handled) {
                    return;
                }
            }
            ctx.pan = undefined;
            //We may have clicked a wire (and so delete it)
            if (e.button !== 2) {
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
            }
            ctx.connectingFrom = undefined;
            return;
        }
        if (drag) {
            var component = findById(ctx, drag.id);
            if (component) {
                snapToGrid(component);
                componentsInGroup(component).forEach(snapToGrid);
            }
            ctx.drag = undefined;
        }
        else if (pan) {
            ctx.pan = undefined;
        }
    };
}
function DOM_onkeydown(ctx) {
    return function (e) {
        if (e.ctrlKey) {
            if (e.key === "s") {
                saveComponents(ctx.components);
            }
            if (e.key === "o") {
                loadComponents(ctx);
            }
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        var graphics = ctx.graphics, components = ctx.components, snapToGrid = ctx.snapToGrid;
        var newComponentType = keyToType[e.key];
        var isPanel = newComponentType === "panel";
        var gridHalf = graphics.gridSize / 2;
        var _a = isPanel
            ? ctx.mouse
            : [ctx.mouse[0] - gridHalf, ctx.mouse[1] - gridHalf], x = _a[0], y = _a[1];
        if (newComponentType) {
            var newComponent = {
                id: Math.random(),
                pos: [x, y],
                size: isPanel
                    ? [graphics.gridSize * 10, graphics.gridSize * 5]
                    : graphics.gridSize,
                type: newComponentType,
                text: typeToSymbol[newComponentType],
                incoming: []
            };
            if (newComponentType === "or" || newComponentType === "not") {
                newComponent.size = graphics.gridSize / 2;
            }
            snapToGrid(newComponent);
            components.push(newComponent);
        }
    };
}
function saveComponents(components) {
    var fileName = prompt("File name", "components");
    if (!fileName) {
        return;
    }
    //Isolate component wires to only included components
    var includedIds = components.map(function (c) { return c.id; });
    var isolatedComponents = components.map(function (c) { return (__assign(__assign({}, c), { incoming: c.incoming.map(function (i) { return i.id; }).filter(function (i) { return includedIds.includes(i); }) })); });
    //New random IDs
    var newIds = new Map(includedIds.map(function (i) { return [i, Math.random()]; }));
    isolatedComponents.forEach(function (c) {
        c.id = newIds.get(c.id);
        c.incoming = c.incoming.map(function (i) { return newIds.get(i); });
    });
    //Normalise positions
    var topLeftMost = isolatedComponents.reduce(function (acc, c) {
        return [Math.min(acc[0], c.pos[0]), Math.min(acc[1], c.pos[1])];
    }, [Infinity, Infinity]);
    isolatedComponents.forEach(function (c) {
        c.pos = [c.pos[0] - topLeftMost[0], c.pos[1] - topLeftMost[1]];
        c.group = undefined;
    });
    //Save as JSON
    var json = JSON.stringify(isolatedComponents, null, 2);
    var blob = new Blob([json], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "".concat(fileName, ".json");
    a.click();
}
function loadComponents(ctx) {
    var input = document.createElement("input");
    input.type = "file";
    input.onchange = function () {
        var _a;
        var file = (_a = input.files) === null || _a === void 0 ? void 0 : _a[0];
        if (!file) {
            return;
        }
        var reader = new FileReader();
        reader.onload = function () {
            var json = reader.result;
            var savedComponents = JSON.parse(json);
            savedComponents.forEach(function (savedComponent) {
                var component = __assign(__assign({}, savedComponent), { incoming: [], incomingIds: savedComponent.incoming });
                ctx.components.push(component);
            });
            ctx.components.forEach(function (component) {
                var _a;
                var _b, _c;
                (_a = component.incoming).push.apply(_a, ((_c = (_b = component.incomingIds) === null || _b === void 0 ? void 0 : _b.map(function (id) { return findById(ctx, id); })) !== null && _c !== void 0 ? _c : []));
                delete component.incomingIds;
            });
        };
        reader.readAsText(file);
    };
    input.click();
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
        //Draw potential connection
        if (ctx.connectingFrom !== undefined) {
            var componentFrom = findById(ctx, ctx.connectingFrom);
            if (componentFrom) {
                gtx.strokeStyle = "#000";
                gtx.beginPath();
                gtx.moveTo.apply(gtx, add(componentFrom.pos, gridHalf));
                gtx.lineTo(ctx.mouse[0], ctx.mouse[1]);
                gtx.stroke();
            }
        }
        //Draw components
        gtx.font = "24px Symbola";
        gtx.textAlign = "center";
        gtx.textBaseline = "middle";
        var panels = components.filter(function (c) { return c.type === "panel"; });
        var other = components.filter(function (c) { return c.type !== "panel"; });
        var drawComponent = function (component) {
            var size = component.size, text = component.text, type = component.type, live = component.live;
            var _a = component.pos, x = _a[0], y = _a[1];
            gtx.fillStyle = componentColour({ type: type, live: live });
            if (Array.isArray(size)) {
                gtx.fillRect.apply(gtx, __spreadArray([x, y], size, false));
            }
            else {
                x += gridHalf;
                y += gridHalf;
                gtx.beginPath();
                gtx.arc(x, y, size / 2, 0, 2 * Math.PI);
                gtx.fill();
            }
            gtx.fillStyle = live ? "#fff" : "#000";
            gtx.fillText(text, x, y + 1);
        };
        panels.forEach(drawComponent);
        //Draw connections on top of panels
        gtx.lineWidth = 2;
        components.forEach(function (_a) {
            var _b = _a.pos, x2 = _b[0], y2 = _b[1], incoming = _a.incoming;
            incoming.forEach(function (_a) {
                var _b = _a.pos, x1 = _b[0], y1 = _b[1], live = _a.live, size = _a.size;
                var a = -Math.atan2(y2 - y1, x2 - x1);
                gtx.fillStyle = live ? "#00f" : "#f00";
                var r = (Array.isArray(size) ? size[0] : size) / 8;
                gtx.translate(gridHalf, gridHalf);
                gtx.beginPath();
                gtx.moveTo(x1 + sin(a) * r, y1 + cos(a) * r);
                gtx.lineTo(x1 - sin(a) * r, y1 - cos(a) * r);
                gtx.lineTo(x2, y2);
                gtx.fill();
                gtx.translate(-gridHalf, -gridHalf);
            });
        });
        //Draw all other components on top of connections
        other.forEach(drawComponent);
    };
}
function calculateCharge(component) {
    var type = component.type, incoming = component.incoming;
    var live = incoming.filter(function (c) { return c.live; }).length;
    var any = live > 0;
    var all = incoming.length === live;
    switch (type) {
        case "on":
            return true;
        case "off":
            return false;
        case "or":
        case "indicator":
            return any;
        case "and":
            return any && all;
        case "not":
            return incoming.length && !any;
        case "xor":
            return live === 1;
        case "rand":
            return Math.random() < 0.5;
    }
}
function tock(_a) {
    var components = _a.components;
    return function () {
        //Effect delayed electification
        components.forEach(function (component) {
            if (component.charged && component.type !== "off") {
                component.live = true;
                component.charged = undefined;
            }
            else {
                component.live = component.type === "on" || undefined;
            }
        });
        //Calculate delayed electification
        components.forEach(function (component) {
            component.charged = calculateCharge(component) || undefined;
        });
    };
}
//# sourceMappingURL=index.js.map