type v2d = [number, number];

type Gates = "and" | "or" | "not" | "xor";

type Component = {
  id: number;
  pos: v2d;
  size: v2d | number;
  type: Gates | "on" | "off" | "indicator" | "panel" | "rand";
  text: "&" | "•" | "~" | "⊕" | "⭘" | "⏻" | "⚂" | "";
  incoming: Component[];
  incomingIds?: number[];
  charged?: true;
  live?: true;
  group?: [Component, v2d][];
};

type Ctx = {
  graphics: {
    canvas: HTMLCanvasElement;
    gtx: CanvasRenderingContext2D;
    gridSize: number;
    scale: number;
    pan: v2d;
  };
  components: Component[];
  drag?: {
    id: Component["id"];
    offset: v2d;
  };
  pan?: v2d;
  mouse: v2d;
  mouseMoved: boolean;
  connectingFrom?: number;
  snapToGrid: (c: Component) => void;
};

const typeToSymbol: Record<Component["type"], Component["text"]> = {
  ...{ and: "&", or: "•", not: "~", xor: "⊕" },
  ...{ on: "⭘", off: "⏻", indicator: "", panel: "", rand: "⚂" },
};
function componentColour({ type, live }: Pick<Component, "type" | "live">) {
  const types = ["and", "or", "not", "xor", "on", "off", "rand", "panel"];
  const colours = [
    ...["#fa0", "#0af", "#f00", "#0fa", "#44f", "#f44", "#4f4"],
    "rgba(200, 200, 200, .5)",
  ];
  return colours[types.indexOf(type)] || (live ? "#0f0" : "#000");
}
const keyToType: Record<string, Component["type"]> = {
  ...{ a: "and", o: "or", n: "not", x: "xor" },
  ...{ s: "on", i: "indicator", p: "panel", r: "rand" },
};

const { abs, sqrt, sin, cos, round } = Math;

function findById(ctx: Ctx, id: number) {
  return ctx.components.find(c => c.id === id);
}

function mouseInCtx(ctx: Ctx, x = ctx.mouse[0], y = ctx.mouse[1]): v2d {
  const { scale, pan } = ctx.graphics;
  return [x / scale - pan[0], y / scale - pan[1]];
}

function isPointNearLine(p1: v2d, p2: v2d, p: v2d, dist = 1): boolean {
  const [px, py] = [p2[0] - p1[0], p2[1] - p1[1]];
  const u = ((p[0] - p1[0]) * px + (p[1] - p1[1]) * py) / (px * px + py * py);
  const u2 = u > 1 ? 1 : u < 0 ? 0 : u;
  const [x, y] = [p1[0] + u2 * px, p1[1] + u2 * py];
  const [dx, dy] = [x - p[0], y - p[1]];
  return sqrt(dx * dx + dy * dy) < dist;
}

function asRect(x: v2d | number): v2d {
  return Array.isArray(x) ? x : [x, x];
}

function touchingPanel(panel: Component, gridSize: number) {
  const { id: panelId, pos, size: pSize } = panel;
  return ({ id, pos: [x, y] }: Component) => {
    if (id === panelId) {
      return false;
    }
    const [px, py] = pos;
    const [pw, ph] = asRect(pSize);
    return (
      x > px - gridSize &&
      x < px + pw &&
      y > py - gridSize &&
      y < py + ph
    );
  };
}

function componentsInGroup({ group }: Component) {
  return group?.map(([c]) => c) ?? [];
}

function sub(a: v2d, b: v2d): v2d {
  return [a[0] - b[0], a[1] - b[1]];
}

function add(v: v2d, n: number): v2d {
  return [v[0] + n, v[1] + n];
}

function DOM_onload() {
  const canvas = document.querySelector("canvas")!;
  const gtx = canvas.getContext("2d")!;
  const gridSize = 32;
  const ctx: Ctx = {
    graphics: { canvas, gtx, gridSize, scale: 1, pan: [0, 0] },
    components: [],
    mouse: [0, 0],
    mouseMoved: false,
    snapToGrid: c => {
      const s = gridSize / 2;
      c.pos = [round(c.pos[0] / s) * s, round(c.pos[1] / s) * s];
    },
  };
  setInterval(tick(ctx), 1000 / 20);
  setInterval(tock(ctx), 1000 / 4);
  const html = document.querySelector("html")!;
  html.addEventListener("wheel", DOM_onscroll(ctx));
  html.addEventListener("mousedown", DOM_onmousedown(ctx));
  html.addEventListener("mousemove", DOM_mousemove(ctx));
  html.addEventListener("mouseup", DOM_onmouseup(ctx));
  html.addEventListener("keydown", DOM_onkeydown(ctx));
  canvas.addEventListener("contextmenu", e => e.preventDefault());
}

function DOM_onscroll({ graphics }: Ctx) {
  return (e: WheelEvent) => {
    const { x, y, deltaY } = e;
    const { canvas, scale, pan } = graphics;
    let newScale = scale + (deltaY > 0 ? -1 : 1) * 0.2;
    newScale = Math.max(0.5, newScale);
    newScale = Math.min(4, newScale);
    const oldWidth = canvas.width / scale;
    const oldHeight = canvas.height / scale;
    const newWidth = canvas.width / newScale;
    const newHeight = canvas.height / newScale;
    pan[0] -= (x / canvas.width) * (oldWidth - newWidth);
    pan[1] -= (y / canvas.height) * (oldHeight - newHeight);
    graphics.scale = newScale;
    return false;
  };
}

function DOM_onmousedown(ctx: Ctx) {
  return (e: MouseEvent) => {
    e.preventDefault();
    const {
      pan: [panX, panY],
      scale,
      gridSize,
    } = ctx.graphics;
    const components = ctx.components.filter(({ pos: [x, y], size }) => {
      const [px, py] = mouseInCtx(ctx, e.clientX, e.clientY);
      const halfGrid = gridSize / 2;
      if (Array.isArray(size)) {
        const [w, h] = size;
        return px >= x && px <= x + w && py >= y && py <= y + h;
      }
      return (
        sqrt((px - x - halfGrid) ** 2 + (py - y - halfGrid) ** 2) < size / 2
      );
    });
    const component = components.find(c => c.type !== "panel") || components[0];
    if (component) {
      //Interact with component
      if (e.button === 2) {
        if (component.type === "on") {
          component.type = "off";
          component.text = "⏻";
        } else if (component.type === "off") {
          component.type = "on";
          component.text = "⭘";
        } else if (
          component.type === "panel" &&
          Array.isArray(component.size)
        ) {
          component.size[0] /= gridSize;
          component.size[1] /= gridSize;
          const prompted = prompt("Panel size", component.size.toString());
          const [w, h] = prompted?.split(/, ?/).map(Number) ?? [0, 0];
          component.size = [w || component.size[0], h || component.size[1]];
          component.size[0] *= gridSize;
          component.size[1] *= gridSize;
        }
        //Drag component
      } else {
        const calcOffset = ([x, y]: v2d): v2d => [
          (e.clientX - panX - x * scale) / scale,
          (e.clientY - panY - y * scale) / scale,
        ];
        const offset: v2d = calcOffset(component.pos);
        ctx.drag = { id: component.id, offset };
        if (component.type === "panel") {
          component.group = ctx.components
            .filter(touchingPanel(component, gridSize))
            .map(c => [c, calcOffset(c.pos)]);
        } else {
          component.group = undefined;
        }
      }
    } else {
      ctx.pan = [panX - e.clientX / scale, panY - e.clientY / scale];
    }
    ctx.mouseMoved = false;
  };
}

function DOM_mousemove(ctx: Ctx) {
  return (e: MouseEvent) => {
    const { drag, pan } = ctx;
    ctx.mouse = mouseInCtx(ctx, e.clientX, e.clientY);
    const {
      pan: [panX, panY],
      scale,
    } = ctx.graphics;
    if (drag) {
      const component = findById(ctx, drag.id);
      if (component) {
        const drags: [Component, v2d][] = [[component, drag.offset]];
        drags.push(...(component.group ?? []));
        drags.forEach(([component, offset]) => {
          component.pos = [
            (e.clientX - panX - offset[0] * scale) / scale,
            (e.clientY - panY - offset[1] * scale) / scale,
          ];
        });
      }
    } else if (pan) {
      let [x, y] = pan;
      ctx.graphics.pan = [x + e.clientX / scale, y + e.clientY / scale];
    }
    ctx.mouseMoved = true;
  };
}

function componentClick(e: MouseEvent, ctx: Ctx, component: Component) {
  const isPanel = component.type === "panel";
  //We clicked a component
  if (e.shiftKey) {
    //Delete the component
    const toDelete = [component];
    if (e.ctrlKey) {
      toDelete.push(...componentsInGroup(component));
    }
    toDelete.forEach(c => ctx.components.splice(ctx.components.indexOf(c), 1));
    const deletedIds = toDelete.map(c => c.id);
    ctx.components.forEach(c => {
      c.incoming = c.incoming.filter(i => !deletedIds.includes(i.id));
    });
  } else if (isPanel && e.ctrlKey) {
    //Save the panel
    saveComponents([component, ...componentsInGroup(component)]);
  } else if (ctx.connectingFrom !== undefined && component) {
    //Finish a wire
    const componentFrom = findById(ctx, ctx.connectingFrom);
    if (componentFrom) {
      component.incoming.push(componentFrom);
    }
    ctx.connectingFrom = undefined;
  } else if (!isPanel) {
    //Start a wire
    ctx.connectingFrom = component.id;
  }
  ctx.drag = undefined;
  return { handled: !isPanel };
}

function DOM_onmouseup(ctx: Ctx) {
  return (e: MouseEvent) => {
    const { components, drag, pan, mouseMoved, snapToGrid } = ctx;
    if (!mouseMoved) {
      //Handle a click
      if (drag) {
        const component = findById(ctx, drag.id)!;
        if (componentClick(e, ctx, component).handled) {
          return;
        }
      }
      ctx.pan = undefined;
      //We may have clicked a wire (and so delete it)
      if (e.button !== 2) {
        const gridHalf = ctx.graphics.gridSize / 2;
        for (const { pos, incoming } of components) {
          const pos1: v2d = [pos[0] + gridHalf, pos[1] + gridHalf];
          for (let i = 0; i < incoming.length; ++i) {
            let pos2 = incoming[i]!.pos;
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
      const component = findById(ctx, drag.id);
      if (component) {
        snapToGrid(component);
        componentsInGroup(component).forEach(snapToGrid);
      }
      ctx.drag = undefined;
    } else if (pan) {
      ctx.pan = undefined;
    }
  };
}

function DOM_onkeydown(ctx: Ctx) {
  return (e: KeyboardEvent) => {
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
    const { graphics, components, snapToGrid } = ctx;
    const newComponentType = keyToType[e.key];
    const isPanel = newComponentType === "panel";
    const gridHalf = graphics.gridSize / 2;
    const [x, y] = isPanel
      ? ctx.mouse
      : [ctx.mouse[0] - gridHalf, ctx.mouse[1] - gridHalf];
    if (newComponentType) {
      const newComponent: Component = {
        id: Math.random(),
        pos: [x, y],
        size: isPanel
          ? [graphics.gridSize * 10, graphics.gridSize * 5]
          : graphics.gridSize,
        type: newComponentType,
        text: typeToSymbol[newComponentType],
        incoming: [],
      };
      if (newComponentType === "or" || newComponentType === "not") {
        newComponent.size = graphics.gridSize / 2;
      }
      snapToGrid(newComponent);
      components.push(newComponent);
    }
  };
}

function saveComponents(components: Component[]) {
  const fileName = prompt("File name", "components");
  if (!fileName) {
    return;
  }
  //Isolate component wires to only included components
  const includedIds = components.map(c => c.id);
  const isolatedComponents = components.map(c => ({
    ...c,
    incoming: c.incoming.map(i => i.id).filter(i => includedIds.includes(i)),
  }));
  //New random IDs
  const newIds = new Map(includedIds.map(i => [i, Math.random()]));
  isolatedComponents.forEach(c => {
    c.id = newIds.get(c.id)!;
    c.incoming = c.incoming.map(i => newIds.get(i)!);
  });
  //Normalise positions
  const topLeftMost = isolatedComponents.reduce(
    (acc, c) =>
      [Math.min(acc[0]!, c.pos[0]), Math.min(acc[1]!, c.pos[1])] as v2d,
    [Infinity, Infinity]
  );
  isolatedComponents.forEach(c => {
    c.pos = [c.pos[0] - topLeftMost[0]!, c.pos[1] - topLeftMost[1]!];
    c.group = undefined;
  });
  //Save as JSON
  const json = JSON.stringify(isolatedComponents, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${fileName}.json`;
  a.click();
}

function loadComponents(ctx: Ctx) {
  const input = document.createElement("input");
  input.type = "file";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const json = reader.result as string;
      type SavedComponent = Omit<Component, "incoming"> & {
        incoming: number[];
      };
      const savedComponents: SavedComponent[] = JSON.parse(json);
      savedComponents.forEach(savedComponent => {
        const component: Component = {
          ...savedComponent,
          incoming: [],
          incomingIds: savedComponent.incoming,
        };
        ctx.components.push(component);
      });
      ctx.components.forEach(component => {
        component.incoming.push(
          ...(component.incomingIds?.map(id => findById(ctx, id)!) ?? [])
        );
        delete component.incomingIds;
      });
    };
    reader.readAsText(file);
  };
  input.click();
}

function tick(ctx: Ctx) {
  return () => {
    const {
      graphics: { canvas, gtx, gridSize, scale, pan },
      components,
    } = ctx;
    const W = (canvas.width = document.body.clientWidth);
    const H = (canvas.height = document.body.clientHeight);
    const gridHalf = gridSize / 2;
    //Clear canvas
    gtx.fillStyle = "#fff";
    gtx.fillRect(0, 0, W, H);
    //Draw grid
    gtx.strokeStyle = "#eee";
    gtx.lineWidth = 1;
    gtx.beginPath();
    for (let x = (pan[0] % gridSize) * scale; x < W; x += gridSize * scale) {
      gtx.moveTo(x, 0);
      gtx.lineTo(x, H);
      gtx.stroke();
    }
    for (let y = (pan[1] % gridSize) * scale; y < H; y += gridSize * scale) {
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
      const componentFrom = findById(ctx, ctx.connectingFrom);
      if (componentFrom) {
        gtx.strokeStyle = "#000";
        gtx.beginPath();
        gtx.moveTo(...add(componentFrom.pos, gridHalf));
        gtx.lineTo(ctx.mouse[0], ctx.mouse[1]);
        gtx.stroke();
      }
    }
    //Draw components
    gtx.font = "24px Symbola";
    gtx.textAlign = "center";
    gtx.textBaseline = "middle";
    const panels = components.filter(c => c.type === "panel");
    const other = components.filter(c => c.type !== "panel");
    const drawComponent = (component: Component) => {
      const { size, text, type, live } = component;
      let [x, y] = component.pos;
      gtx.fillStyle = componentColour({ type, live });
      if (Array.isArray(size)) {
        gtx.fillRect(x, y, ...size);
      } else {
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
    components.forEach(({ pos: [x2, y2], incoming }) => {
      incoming.forEach(({ pos: [x1, y1], live, size }) => {
        const a = -Math.atan2(y2 - y1, x2 - x1);
        gtx.fillStyle = live ? "#00f" : "#f00";
        const r = (Array.isArray(size) ? size[0]: size) / 8;
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

function calculateCharge(component: Component) {
  const { type, incoming } = component;
  const live = incoming.filter(c => c.live).length;
  const any = live > 0;
  const all = incoming.length === live;
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

function tock({ components }: Ctx) {
  return () => {
    //Effect delayed electification
    components.forEach(component => {
      if (component.charged && component.type !== "off") {
        component.live = true;
        component.charged = undefined;
      } else {
        component.live = component.type === "on" || undefined;
      }
    });
    //Calculate delayed electification
    components.forEach(component => {
      component.charged = calculateCharge(component) || undefined;
    });
  };
}
