# lego.js

A JSCAD library for generating LEGO-compatible brick geometry.

This is a JavaScript port of [LEGO.scad](https://github.com/cfinke/LEGO.scad), the OpenSCAD LEGO-compatible brick generator. The JS version implements a subset of the OpenSCAD functionality, supporting brick, tile, and baseplate types.

## Usage

### JSCAD Web UI

Drag `lego.js` into [openjscad.xyz](https://openjscad.xyz/) or [jscad.app](https://jscad.app/). The parametric UI exposes all configuration options.

### CLI Export

```bash
npx @jscad/cli lego.js -o output.stl
```

### As a Module

```javascript
const { block, place, stack, STUD_SPACING, BLOCK_HEIGHT } = require('./lego.js');

// 2x4 brick
const brick = block({ width: 2, length: 4, height: 1 });

// 2x4 plate (1/3 height)
const plate = block({ width: 2, length: 4, height: 1/3 });

// 2x2 tile (no studs)
const tile = block({ width: 2, length: 2, type: 'tile' });

// 8x8 baseplate
const baseplate = block({ width: 8, length: 8, type: 'baseplate' });
```

## API

### `block(params)`

Generates brick geometry. Returns a JSCAD geometry object.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `width` | int | 2 | Width in studs (1-32) |
| `length` | int | 4 | Length in studs (1-32). Dimensions are normalized so length >= width |
| `height` | float | 1 | Height ratio. 1 = standard brick (9.6mm), 1/3 = plate (3.2mm) |
| `type` | string | `'brick'` | `'brick'`, `'tile'`, or `'baseplate'` |
| `studType` | string | `'solid'` | `'solid'` or `'hollow'` |
| `bottomType` | string | `'open'` | `'open'` (standard) or `'closed'` (solid) |
| `horizontalHoles` | bool | false | Technic-style holes through the brick |
| `verticalAxleHoles` | bool | false | Cross-shaped axle holes in posts |
| `includeSplines` | bool | true | Interior wall splines for grip |
| `withPosts` | bool | true | Interior support posts/pins |
| `useReinforcement` | bool | false | Cross-braces for FDM printing |
| `studRescale` | float | 1.0 | Stud diameter multiplier (0.9-1.1) for printer calibration |
| `studTopRoundness` | float | 0 | Rounded stud tops (0-1) |
| `segments` | int | 64 | Cylinder resolution |

### Positioning Helpers

```javascript
// Translate by grid units (studs for X/Y, brick heights for Z)
place(x, y, z, geometry)

// Union geometries at a grid position
stack(x, y, z, ...geometries)

// Offset geometry to counter the default X/Y centering
uncenter(width, length, height, geometry)
```

### Utility Functions

```javascript
// Get brick height in mm
blockHeight(heightRatio, type) // blockHeight(1) => 9.6

// Minimum studs needed to span a length in mm
minimumBlockCount(lengthMm)
```

### Exported Constants (mm)

| Constant | Value | Description |
|----------|-------|-------------|
| `STUD_SPACING` | 8 | Center-to-center stud distance |
| `STUD_DIAMETER` | 4.85 | Stud diameter |
| `STUD_HEIGHT` | 1.8 | Stud height above brick top |
| `BLOCK_HEIGHT` | 9.6 | Standard brick height (without stud) |
| `WALL_PLAY` | 0.1 | Tolerance gap between bricks |

## Differences from LEGO.scad

The JS version does not implement:
- DUPLO brick dimensions
- Wing, slope, curve, or round brick types
- Roadway cutouts
- Dual-sided (SNOT) bricks

## Printer Calibration

Use `studRescale` to adjust stud diameter for your printer:

```javascript
block({ width: 2, length: 4, studRescale: 1.03 }) // 3% larger studs
```

Reference values from LEGO.scad:
- Creality Ender 3 Pro (PLA): 1.03
- Orion Delta (T-Glase): 1.0475
- Orion Delta (ABS): 1.022
