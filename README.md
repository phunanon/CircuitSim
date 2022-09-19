# CircuitSim

## [Try out here](https://phunanon.github.io/CircuitSim)

A basic logic circuit simulator written in TypeScript.  
Descendant of [Sircuit](https://github.com/phunanon/Sircuit)
(which is a descendant of [CCircuit](https://github.com/phunanon/CCircuit)).

![Demo screenshot](demo.png)

> demo.json

### Controls

- A - AND
- O - OR
- N - NOT
- X - XOR
- S - Switch
- I - Indicator
- R - Random
- P - Panel

- Scroll to zoom into cursor
- Click and drag to pan camera or move component or panel and its components
- Click component to start or finish wire
- Ctrl + click to finish wire and make another from same component
- Click wire to delete
- Shift + click to delete component, panel
- Ctrl + Shift + click panel to delete panel and all its components
- Ctrl + click panel to save to JSON
- Ctrl + S to save scene to JSON
- Ctrl + O to load scene / panel from JSON
- Right click switch to toggle
- Right click panel to change size

### TODO

- Label panels (it's feasible)
- Panel resize with mouse
- Panel colours
