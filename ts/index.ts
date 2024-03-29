type v2d = [number, number];

type Gates = "and" | "or" | "not" | "xor";

type Component = {
  id: number;
  pos: v2d;
  size: v2d | number;
  type: Gates | "on" | "off" | "indicator" | "panel" | "rand";
  text: "&" | "•" | "~" | "⊕" | "⭘" | "●" | "⚂" | "" | string;
  incoming: Component[];
  incomingIds?: number[];
  staged?: true;
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
  electrification: "step" | "immediate";
  components: Component[];
  drag?: {
    id: Component["id"];
    offset: v2d;
  };
  pan?: v2d;
  mouse: v2d;
  mouseMoved: boolean;
  connectingFrom?: number;
  snappedToGrid: (pos: v2d) => v2d;
};

const typeToSymbol: Record<Component["type"], Component["text"]> = {
  ...{ and: "&", or: "•", not: "~", xor: "⊕" },
  ...{ on: "●", off: "⭘", indicator: "", panel: "", rand: "⚂" },
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

function findById({ components }: Pick<Ctx, "components">, id: number) {
  return components.find(c => c.id === id);
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
    return x > px - gridSize && x < px + pw && y > py - gridSize && y < py + ph;
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

function resetView(ctx: Ctx) {
  ctx.graphics.pan = [ctx.graphics.gridSize, ctx.graphics.gridSize];
  ctx.graphics.scale = 1;
}

async function DOM_onload() {
  const canvas = document.querySelector("canvas")!;
  const gtx = canvas.getContext("2d")!;
  const gridSize = 32;
  const ctx: Ctx = {
    graphics: { canvas, gtx, gridSize, scale: 1, pan: [0, 0] },
    components: [],
    mouse: [0, 0],
    mouseMoved: false,
    electrification: "immediate",
    snappedToGrid: ([x, y]: v2d) => {
      const s = gridSize / 2;
      return [round(x / s) * s, round(y / s) * s];
    },
  };
  resetView(ctx);
  setInterval(tick(ctx), 1000 / 20);
  setInterval(tock(ctx), 1000 / 4);
  const html = document.querySelector("html")!;
  html.addEventListener("wheel", DOM_onscroll(ctx));
  html.addEventListener("mousedown", DOM_onmousedown(ctx));
  html.addEventListener("mousemove", DOM_mousemove(ctx));
  html.addEventListener("mouseup", DOM_onmouseup(ctx));
  html.addEventListener("keydown", DOM_onkeydown(ctx));
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  const { save, load } = store(ctx);
  html.addEventListener("unload", save);
  load();
  if (!ctx.components.length) {
    const demo = await (await fetch("demo.json")).text();
    ctx.components = deserialise(demo);
  }
  setInterval(save, 10000);
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
    const halfGrid = gridSize / 2;
    const components = ctx.components.filter(({ pos: [x, y], size }) => {
      const [px, py] = mouseInCtx(ctx, e.clientX, e.clientY);
      if (Array.isArray(size)) {
        const [w, h] = size;
        return px >= x && px <= x + w && py >= y && py <= y + h;
      }
      return (
        sqrt((px - x - halfGrid) ** 2 + (py - y - halfGrid) ** 2) < size / 2
      );
    });
    const component = components.find(c => c.type !== "panel") ?? components[0];
    if (component) {
      //Interact with component
      if (e.button === 2) {
        if (component.type === "on") {
          component.type = "off";
          component.text = typeToSymbol.off;
        } else if (component.type === "off") {
          component.type = "on";
          component.text = typeToSymbol.on;
        } else if (
          component.type === "panel" &&
          Array.isArray(component.size)
        ) {
          component.size[0] /= halfGrid;
          component.size[1] /= halfGrid;
          const prompted = prompt(
            "Panel size; panel text",
            `${component.size};${component.text}`
          );
          const [size, text] = prompted?.split(";") ?? [];
          const [w, h] = size?.split(/, ?/).map(Number) ?? [0, 0];
          component.text = text ?? "";
          component.size = [w ?? component.size[0], h ?? component.size[1]];
          component.size[0] *= halfGrid;
          component.size[1] *= halfGrid;
        }
      } else {
        //Drag component
        const calcOffset = ([x, y]: v2d): v2d => [
          (e.clientX - panX - x * scale) / scale,
          (e.clientY - panY - y * scale) / scale,
        ];
        const offset: v2d = calcOffset(component.pos);
        ctx.drag = { id: component.id, offset };
        //Calculate panel group
        if (component.type === "panel") {
          component.group = ctx.components
            .filter(touchingPanel(component, gridSize))
            .map(c => [c, calcOffset(c.pos)]);
        } else {
          delete component.group;
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
  } else if (ctx.connectingFrom !== undefined && component && !isPanel) {
    //Finish a wire
    const componentFrom = findById(ctx, ctx.connectingFrom);
    if (componentFrom) {
      component.incoming.push(componentFrom);
    }
    ctx.connectingFrom = e.ctrlKey ? ctx.connectingFrom : undefined;
  } else if (!isPanel) {
    //Start a wire
    ctx.connectingFrom = component.id;
  }
  delete ctx.drag;
  return { handled: !isPanel };
}

function DOM_onmouseup(ctx: Ctx) {
  return (e: MouseEvent) => {
    const { components, drag, pan, mouseMoved, snappedToGrid } = ctx;
    if (!mouseMoved) {
      //Handle a click
      if (drag) {
        const component = findById(ctx, drag.id)!;
        if (componentClick(e, ctx, component).handled) {
          return;
        }
      }
      delete ctx.pan;
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
              delete ctx.drag;
              return;
            }
          }
        }
      }
      delete ctx.connectingFrom;
      return;
    } else if (drag) {
      //Move component to top
      const index = ctx.components.findIndex(c => c.id === drag.id);
      ctx.components.unshift(ctx.components.splice(index, 1)[0]!);
    }
    if (drag) {
      const component = findById(ctx, drag.id);
      if (component) {
        component.pos = snappedToGrid(component.pos);
        const snapToGrid = (c: Component) => (c.pos = snappedToGrid(c.pos));
        componentsInGroup(component).forEach(snapToGrid);
      }
      delete ctx.drag;
    } else if (pan) {
      delete ctx.pan;
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
        promptLoad(ctx);
        resetView(ctx);
      }
      if (e.key === "O") {
        const pos = ctx.mouse;
        promptLoad(ctx, pos);
      }
      if (e.key === "e") {
        ctx.electrification =
          ctx.electrification === "step" ? "immediate" : "step";
        ctx.components.forEach(c => delete c.staged);
      }
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const { graphics, components, snappedToGrid } = ctx;
    const newComponentType = keyToType[e.key];
    const isPanel = newComponentType === "panel";
    const isIndicator = newComponentType === "indicator";
    const gridHalf = graphics.gridSize / 2;
    const [x, y] = [ctx.mouse[0] - gridHalf, ctx.mouse[1] - gridHalf];
    if (newComponentType) {
      const newComponent: Component = {
        id: Math.random(),
        pos: [x, y],
        size: isPanel
          ? [graphics.gridSize * 10, graphics.gridSize * 5]
          : isIndicator
          ? [graphics.gridSize, graphics.gridSize]
          : graphics.gridSize,
        type: newComponentType,
        text: typeToSymbol[newComponentType],
        incoming: [],
      };
      if (newComponentType === "or" || newComponentType === "not") {
        newComponent.size = graphics.gridSize / 2;
      }
      newComponent.pos = snappedToGrid(newComponent.pos);
      components.push(newComponent);
    }
  };
}

function store(ctx: Ctx) {
  return {
    save: () => localStorage.setItem("components", serialise(ctx)),
    load: () => {
      const json = localStorage.getItem("components") ?? "[]";
      ctx.components = deserialise(json);
    },
  };
}

function saveComponents(components: Component[]) {
  const fileName = prompt("File name", "components");
  if (!fileName) {
    return;
  }
  const json = serialise({ components });
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${fileName}.json`;
  a.click();
}

function deserialise(json: string, pos?: v2d) {
  type SavedComponent = Omit<Component, "incoming"> & {
    incoming: number[];
  };
  const savedComponents: SavedComponent[] = JSON.parse(json);
  const components: Component[] = [];
  savedComponents.forEach(savedComponent => {
    const component: Component = {
      ...savedComponent,
      incoming: [],
      incomingIds: savedComponent.incoming,
    };
    components.push(component);
  });
  components.forEach(component => {
    component.incoming.push(
      ...(component.incomingIds?.map(id => findById({ components }, id)!) ?? [])
    );
    delete component.incomingIds;
  });
  if (pos) {
    //Move to mouse position
    components.forEach(component => {
      component.pos[0] += pos[0];
      component.pos[1] += pos[1];
    });
  }
  return components;
}

function serialise({ components }: Pick<Ctx, "components">) {
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
    delete c.group;
  });
  //Serialise
  return JSON.stringify(isolatedComponents);
}

function promptLoad(ctx: Ctx, asComponent?: v2d) {
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
      if (asComponent) {
        const newComponents = deserialise(json, asComponent);
        newComponents.forEach(c => (c.pos = ctx.snappedToGrid(c.pos)));
        ctx.components.push(...newComponents);
      } else {
        ctx.components = deserialise(json);
      }
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
      if (type === "panel") {
        gtx.textAlign = "left";
        gtx.textBaseline = "top";
        gtx.fillText(text, x, y + 1);
      } else {
        gtx.textAlign = "center";
        gtx.textBaseline = "middle";
        gtx.fillText(text, x, y + 1);
      }
    };
    panels.reverse().forEach(drawComponent);
    //Draw connections on top of panels
    gtx.lineWidth = 2;
    components.forEach(({ pos: [x2, y2], incoming }) => {
      incoming.forEach(({ pos: [x1, y1], live, size }) => {
        const a = -Math.atan2(y2 - y1, x2 - x1);
        gtx.fillStyle = live ? "#00f" : "#f00";
        const r = (Array.isArray(size) ? size[0] : size) / 8;
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
    other.reverse().forEach(drawComponent);
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
      return any;
    case "or":
    case "indicator":
      return any;
    case "and":
      return any && all;
    case "not":
      return !any;
    case "xor":
      return live === 1;
    case "rand":
      return Math.random() < 0.5;
  }
}

function stepElectrification(ctx: Ctx) {
  //Effect delayed electification
  ctx.components.forEach(component => {
    if (component.staged && component.type !== "off") {
      component.live = true;
      delete component.staged;
    } else {
      component.live = component.type === "on" || undefined;
    }
  });
  //Calculate delayed electification
  ctx.components.forEach(component => {
    component.staged = calculateCharge(component) || undefined;
  });
}

function immediateElectrification(ctx: Ctx) {
  ctx.components.forEach(component => {
    delete component.staged;
    delete component.live;
  });
  let unresolved = ctx.components.slice();
  const stillUnresolved = (component: Component) => {
    if (component.incoming.some(c => !c.staged)) {
      return true;
    }
    component.live = true;
    if (!calculateCharge(component)) {
      delete component.live;
    }
    component.staged = true;
    return false;
  };
  let previouslyUnresolved = unresolved.length;
  while (unresolved.length) {
    unresolved = unresolved.filter(stillUnresolved);
    if (unresolved.length === previouslyUnresolved) {
      break;
    }
    previouslyUnresolved = unresolved.length;
  }
}

function tock(ctx: Ctx) {
  return () => {
    (ctx.electrification === "step"
      ? stepElectrification
      : immediateElectrification)(ctx);
  };
}
