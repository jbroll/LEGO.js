# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LEGO.scad is a LEGO-compatible brick generator available in two formats:
- **LEGO.scad** - OpenSCAD version with full feature support (LEGO/DUPLO, all brick types)
- **lego.js** - JSCAD version with parametric web UI (LEGO only, brick/tile types)

## Working with OpenSCAD Files

Preview and render models using OpenSCAD:
```bash
openscad LEGO.scad                    # Open GUI for interactive preview
openscad -o output.stl LEGO.scad      # Export to STL
openscad -o output.png --preview LEGO.scad  # Render preview image
```

For curved surfaces, set `$fn=32` or higher in your .scad file to increase resolution.

## Working with JSCAD Files

Use lego.js with the JSCAD web app or CLI:
```bash
# Web UI - drag lego.js into https://openjscad.xyz/ or https://jscad.app/
# CLI export
npx @jscad/cli lego.js -o output.stl
```

The JSCAD version provides a parametric UI with sliders, dropdowns, and checkboxes for all parameters.

## Library Architecture

### Main Module: `block()` (LEGO.scad)
The core module that generates all brick types. Key parameters:
- `width`, `length`: Dimensions in studs (auto-swapped so length >= width)
- `height`: Ratio where 1 = standard brick, 1/3 = plate, 1/2 = DUPLO plate
- `type`: `brick`, `tile`, `wing`, `slope`, `curve`, `baseplate`, `round`
- `brand`: `lego` or `duplo` (affects all dimensions)
- `stud_type`: `solid` or `hollow`
- `block_bottom_type`: `open` (standard) or `closed` (for stacking composites)

### Positioning Helpers
- `place(x, y, z)`: Translate by grid units (8mm for LEGO, z in height ratios)
- `stack(x, y, z)`: Union children at grid position
- `uncenter(width, length, height)`: Counter the default centering on X/Y axes

### Secondary Module: `angle_plate()` (LEGO-Angle-Plate.scad)
Creates angled bracket pieces with configurable base and overhang dimensions.

### JSCAD Module: `block()` (lego.js)
JavaScript port with the same core functionality. Key differences from OpenSCAD version:
- Uses `@jscad/modeling` primitives (cuboid, cylinder, subtract, union, translate)
- Parameters passed as object: `block({ width: 2, length: 4, height: 1 })`
- Exports additional helpers: `place()`, `stack()`, `uncenter()`, `blockHeight()`, `minimumBlockCount()`
- Constants exported: `STUD_SPACING`, `STUD_DIAMETER`, `BLOCK_HEIGHT`, etc.

## Key Implementation Details

- All bricks are centered on X/Y axes by default (use `uncenter()` or comment out line 321 in LEGO.scad to change)
- Brand-specific measurements are defined at the top of `block()` module (lines 214-244)
- The `skip_this_stud()` function (line 922) controls stud placement for special brick types
- Customizer variables (lines 28-142) allow interactive configuration in OpenSCAD GUI

## Printer Calibration

Use `stud_rescale` parameter to adjust stud diameter for your printer. Reference values in LEGO.scad:
- Creality Ender 3 Pro (PLA): 1.03
- Orion Delta (T-Glase): 1.0475
- Orion Delta (ABS): 1.022
