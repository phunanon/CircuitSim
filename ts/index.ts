type Point = [number, number];

type Component = {
  id: number;
  pos: Point;
  size: Point | number;
  type: "and" | "or" | "not" | "xor" | "on" | "off" | "indicator" | "panel";
  text: "&" | "•" | "~" | "⊕" | "⭘" | "⏻" | "";
  incoming: Component[];
  charged?: true;
  live?: true;
};

type Ctx = {
  graphics: {
    canvas: HTMLCanvasElement;
    gtx: CanvasRenderingContext2D;
    gridSize: number;
    scale: number;
    pan: Point;
  };
  components: Component[];
  drag?: {
    id: Component["id"];
    offset: Point;
  };
  pan?: Point;
  mouse: Point;
  mouseMoved: boolean;
  connectingFrom?: number;
  snapToGrid: (c: Component) => void;
};

const typeToSymbol: Record<Component["type"], Component["text"]> = {
  and: "&",
  or: "•",
  not: "~",
  xor: "⊕",
  on: "⭘",
  off: "⏻",
  indicator: "",
  panel: "",
};
const typeToColour: Record<Component["type"], string> = {
  and: "#fa0",
  or: "#0af",
  not: "#f00",
  xor: "#0fa",
  on: "#44f",
  off: "#f44",
  indicator: "#000",
  panel: "#aaa",
};
const keyToType: Record<string, Component["type"]> = {
  a: "and",
  o: "or",
  n: "not",
  x: "xor",
  s: "on",
  i: "indicator",
  p: "panel",
};

const { abs, sqrt, round } = Math;

function DOM_onload() {
  const canvas = document.querySelector("canvas")!;
  const gtx = canvas.getContext("2d")!;
  const gridSize = 32;

  const demoSwitch: Component = {
    id: 0,
    pos: [64, 64],
    size: gridSize / 2,
    type: "on",
    text: "⭘",
    incoming: [],
    live: true,
  };

  const demoOr: Component = {
    id: 1,
    pos: [128, 64],
    size: gridSize / 2,
    type: "xor",
    text: "⊕",
    incoming: [demoSwitch],
  };

  const ctx: Ctx = {
    graphics: {
      canvas,
      gtx,
      gridSize,
      scale: 1,
      pan: [0, 0],
    },
    components: [demoSwitch, demoOr],
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

function findById(ctx: Ctx, id: number) {
  return ctx.components.find(c => c.id === id);
}

function mouseInCtx(ctx: Ctx, x = ctx.mouse[0], y = ctx.mouse[1]): Point {
  const { scale, pan } = ctx.graphics;
  return [x / scale - pan[0], y / scale - pan[1]];
}

function isPointNearLine(p1: Point, p2: Point, p: Point, dist = 1): boolean {
  const [px, py] = [p2[0] - p1[0], p2[1] - p1[1]];
  const u = ((p[0] - p1[0]) * px + (p[1] - p1[1]) * py) / (px * px + py * py);
  const u2 = u > 1 ? 1 : u < 0 ? 0 : u;
  const [x, y] = [p1[0] + u2 * px, p1[1] + u2 * py];
  const [dx, dy] = [x - p[0], y - p[1]];
  return sqrt(dx * dx + dy * dy) < dist;
}

function DOM_onscroll({ graphics }: Ctx) {
  return (e: WheelEvent) => {
    const { x, y, deltaY } = e;
    const { canvas, scale, pan } = graphics;
    let newScale = scale + (deltaY > 0 ? -1 : 1) * 0.2;
    newScale = Math.max(0.5, newScale);
    newScale = Math.min(3, newScale);
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
    const component = ctx.components.find(({ pos: [x, y], size }) => {
      const [px, py] = mouseInCtx(ctx, e.clientX, e.clientY);
      const halfGrid = gridSize / 2;
      if (Array.isArray(size)) {
        const [w, h] = size;
        const [cx, cy] = [x + halfGrid - w / 2, y + halfGrid - h / 2];
        return px >= cx && px <= cx + w && py >= cy && py <= cy + h;
      }
      return sqrt((px - x - halfGrid) ** 2 + (py - y - halfGrid) ** 2) < size;
    });
    if (component) {
      //Interact with component
      if (e.button === 2) {
        if (component.type === "on") {
          component.type = "off";
          component.text = "⏻";
        } else if (component.type === "off") {
          component.type = "on";
          component.text = "⭘";
        }
        //Drag component
      } else {
        const offset: Point = [
          (e.clientX - panX - component.pos[0] * scale) / scale,
          (e.clientY - panY - component.pos[1] * scale) / scale,
        ];
        ctx.drag = { id: component.id, offset };
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
        component.pos = [
          (e.clientX - panX - drag.offset[0] * scale) / scale,
          (e.clientY - panY - drag.offset[1] * scale) / scale,
        ];
      }
    } else if (pan) {
      let [x, y] = pan;
      ctx.graphics.pan = [x + e.clientX / scale, y + e.clientY / scale];
    }
    ctx.mouseMoved = true;
  };
}

function DOM_onmouseup(ctx: Ctx) {
  return (e: MouseEvent) => {
    const { components, drag, pan, mouseMoved, snapToGrid } = ctx;
    //A click
    if (!mouseMoved) {
      //We clicked a component
      if (drag) {
        //Delete the component
        if (e.shiftKey) {
          const component = findById(ctx, drag.id);
          if (component) {
            const index = components.indexOf(component);
            components.splice(index, 1);
            components.forEach(c => {
              c.incoming = c.incoming.filter(i => i.id !== drag.id);
            });
          }
          //Finish a wire
        } else if (ctx.connectingFrom !== undefined) {
          const componentFrom = findById(ctx, ctx.connectingFrom);
          const componentTo = findById(ctx, drag.id);
          if (componentFrom && componentTo) {
            componentTo.incoming.push(componentFrom);
          }
          ctx.connectingFrom = undefined;
          //Start a wire
        } else {
          ctx.connectingFrom = drag.id;
        }
        ctx.drag = undefined;
        return;
      }
      ctx.pan = undefined;
      //We may have clicked a wire
      const gridHalf = ctx.graphics.gridSize / 2;
      for (const { pos, incoming } of components) {
        const pos1: Point = [pos[0] + gridHalf, pos[1] + gridHalf];
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
      ctx.connectingFrom = undefined;
      return;
    }
    if (drag) {
      const component = findById(ctx, drag.id);
      if (component) {
        snapToGrid(component);
      }
      ctx.drag = undefined;
    } else if (pan) {
      ctx.pan = undefined;
    }
  };
}

function DOM_onkeydown(ctx: Ctx) {
  return (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.ctrlKey) {
      if (e.key === "s") {
        saveComponents(ctx.components);
      }
      if (e.key === "o") {
        loadComponents(ctx);
      }
      return;
    }
    const { graphics, components, snapToGrid } = ctx;
    const [x, y] = [
      ctx.mouse[0] - graphics.gridSize / 2,
      ctx.mouse[1] - graphics.gridSize / 2,
    ];
    const newComponentType = keyToType[e.key];
    if (newComponentType) {
      const newComponent: Component = {
        id: Math.random(),
        pos: [x, y],
        size:
          newComponentType === "panel"
            ? [graphics.gridSize, graphics.gridSize]
            : graphics.gridSize / 2,
        type: newComponentType,
        text: typeToSymbol[newComponentType],
        incoming: [],
      };
      if (newComponentType === "or") {
        newComponent.size = graphics.gridSize / 4;
      }
      snapToGrid(newComponent);
      components.push(newComponent);
    }
  };
}

function saveComponents(components: Component[]) {
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
      [Math.min(acc[0]!, c.pos[0]), Math.min(acc[1]!, c.pos[1])] as Point,
    [Infinity, Infinity]
  );
  isolatedComponents.forEach(c => {
    c.pos = [c.pos[0] - topLeftMost[0]!, c.pos[1] - topLeftMost[1]!];
  });
  //Save as JSON
  const json = JSON.stringify(isolatedComponents, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "components.json";
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
          incoming: savedComponent.incoming.map(id => findById(ctx, id)!),
        };
        ctx.components.push(component);
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
    //Draw connections
    gtx.lineWidth = 2;
    components.forEach(({ pos: [x2, y2], incoming }) => {
      incoming.forEach(({ pos: [x1, y1], live }) => {
        gtx.strokeStyle = gtx.createLinearGradient(x1, y1, x2, y2);
        const colour = live ? "#00f" : "#f00";
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
      const componentFrom = findById(ctx, ctx.connectingFrom);
      if (componentFrom) {
        gtx.strokeStyle = "#000";
        gtx.beginPath();
        gtx.moveTo(
          componentFrom.pos[0] + gridHalf,
          componentFrom.pos[1] + gridHalf
        );
        gtx.lineTo(ctx.mouse[0], ctx.mouse[1]);
        gtx.stroke();
      }
    }
    //Draw components
    gtx.font = "24px Symbola";
    gtx.textAlign = "center";
    gtx.textBaseline = "middle";
    components.forEach(({ pos: [x, y], size, text: symbol, type, live }) => {
      gtx.fillStyle = typeToColour[type];
      if (Array.isArray(size)) {
        gtx.fillRect(x, y, ...size);
      } else {
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

function calculateCharge(component: Component): true | undefined {
  const { type, incoming } = component;
  if (type === "on") {
    return true;
  } else if (type === "off") {
    return undefined;
  } else if (type === "or") {
    return incoming.some(({ live }) => live) || undefined;
  } else if (type === "and") {
    return (incoming.length && incoming.every(({ live }) => live)) || undefined;
  } else if (type === "not") {
    return (incoming.length && !incoming.some(({ live }) => live)) || undefined;
  } else if (type === "xor") {
    let l = 0;
    for (let i = 0; i < incoming.length; i++) {
      l += Number(incoming[i]!.live);
      if (l > 1) {
        return undefined;
      }
    }
    return l === 1 || undefined;
  }
}

function tock({ components }: Ctx) {
  return () => {
    //Effect delayed electification
    components.forEach(component => {
      if (component.charged) {
        component.live = true;
        component.charged = undefined;
      } else {
        component.live = component.type === "on" || undefined;
      }
    });
    //Calculate delayed electification
    components.forEach(component => {
      component.charged = calculateCharge(component);
    });
  };
}
