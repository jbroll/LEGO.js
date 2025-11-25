/**
 * LEGO.js - JSCAD LEGO-compatible brick generator
 *
 * Translated from LEGO.scad (OpenSCAD) by Christopher Finke
 * Original: http://www.thingiverse.com/thing:5699
 *
 * LEGO, the LEGO logo, the Brick, DUPLO, and MINDSTORMS are trademarks of the LEGO Group.
 */

const jscad = require('@jscad/modeling');
const { cuboid, cylinder, circle } = jscad.primitives;
const { subtract, union } = jscad.booleans;
const { translate, rotateX } = jscad.transforms;
const { extrudeRotate } = jscad.extrusions;
const { hull } = jscad.hulls;

// =============================================================================
// LEGO Dimensions (mm) - Standard LEGO brick measurements
// =============================================================================

const STUD_SPACING = 8;                    // Center-to-center distance between studs
const STUD_DIAMETER = 4.85;                // Diameter of studs
const STUD_HEIGHT = 1.8;                   // Height of studs above brick top
const WALL_THICKNESS = 1.45;               // Outer wall thickness
const WALL_PLAY = 0.1;                     // Tolerance gap for fit between bricks
const BLOCK_HEIGHT = 9.6;                  // Height of one standard brick (without studs)
const POST_DIAMETER = 6.5;                 // Diameter of interior support posts
const POST_WALL_THICKNESS = 0.85;          // Wall thickness of hollow posts
const PIN_DIAMETER = 3;                    // Diameter of pins (for 1-wide bricks)
const HOLLOW_STUD_INNER_DIAMETER = 3.1;    // Inner diameter of hollow studs
const SPLINE_LENGTH = 0.25;                // Length of interior wall splines
const SPLINE_THICKNESS = 0.7;              // Thickness of interior wall splines
const REINFORCING_WIDTH = 0.7;             // Width of reinforcement cross-braces
const ROOF_THICKNESS = 1;                  // Thickness of top surface

// Technic hole dimensions
const HORIZONTAL_HOLE_DIAMETER = 4.8;      // Diameter of Technic axle holes
const HORIZONTAL_HOLE_Z_OFFSET = 5.8;      // Height from bottom of block unit to hole center
const HORIZONTAL_HOLE_BEVEL_DIAMETER = 6.2; // Diameter of hole bevel/chamfer
const HORIZONTAL_HOLE_BEVEL_DEPTH = 0.9;   // Depth of bevel on each side
const HORIZONTAL_HOLE_WALL_THICKNESS = 1;  // Wall thickness around holes

// Vertical axle hole dimensions (cross-shaped)
const AXLE_DIAMETER = 5;                   // Overall diameter of axle hole
const AXLE_SPLINE_WIDTH = 2;               // Width of the cross arms

// =============================================================================
// Parameter Definitions - Generates the JSCAD parametric UI
// =============================================================================

const getParameterDefinitions = () => [
  { name: 'width', type: 'int', initial: 2, min: 1, max: 32, caption: 'Width (studs):' },
  { name: 'length', type: 'int', initial: 4, min: 1, max: 32, caption: 'Length (studs):' },
  {
    name: 'height',
    type: 'choice',
    values: [0.333333, 0.5, 1, 2, 3, 4, 5, 6],
    captions: ['1/3 (plate)', '1/2', '1 (brick)', '2', '3', '4', '5', '6'],
    initial: 1,
    caption: 'Height:'
  },
  {
    name: 'type',
    type: 'choice',
    values: ['brick', 'tile'],
    captions: ['Brick (with studs)', 'Tile (smooth top)'],
    initial: 'brick',
    caption: 'Type:'
  },
  {
    name: 'studType',
    type: 'choice',
    values: ['solid', 'hollow'],
    captions: ['Solid', 'Hollow'],
    initial: 'solid',
    caption: 'Stud Type:'
  },
  {
    name: 'bottomType',
    type: 'choice',
    values: ['open', 'closed'],
    captions: ['Open (standard)', 'Closed (solid)'],
    initial: 'open',
    caption: 'Bottom Type:'
  },

  { name: 'horizontalHoles', type: 'checkbox', checked: false, caption: 'Technic Holes:' },
  { name: 'verticalAxleHoles', type: 'checkbox', checked: false, caption: 'Axle Holes:' },

  { name: 'advanced', type: 'group', caption: 'Advanced' },
  { name: 'includeSplines', type: 'checkbox', checked: true, caption: 'Wall Splines:' },
  { name: 'withPosts', type: 'checkbox', checked: true, caption: 'Interior Posts:' },
  { name: 'useReinforcement', type: 'checkbox', checked: false, caption: 'Reinforcement:' },
  { name: 'studRescale', type: 'slider', initial: 1.0, min: 0.9, max: 1.1, step: 0.01, caption: 'Stud Scale:' },
  { name: 'studTopRoundness', type: 'slider', initial: 0, min: 0, max: 1, step: 0.1, caption: 'Stud Roundness:' },
  { name: 'segments', type: 'int', initial: 64, min: 16, max: 128, caption: 'Curve Segments:' }
];

// =============================================================================
// Helper Functions - Dimension calculations
// =============================================================================

const computeRealHeight = (type, height) => {
  return Math.max(1/3, height);
};

const computeTotalStudsWidth = (count, studDiameter) => {
  return (studDiameter * count) + ((count - 1) * (STUD_SPACING - studDiameter));
};

const computeTotalPostsWidth = (count) => {
  if (count <= 1) return 0;
  return (POST_DIAMETER * (count - 1)) + ((count - 2) * (STUD_SPACING - POST_DIAMETER));
};

const computeTotalPinsWidth = (count) => {
  if (count <= 1) return 0;
  return (PIN_DIAMETER * (count - 1)) + Math.max(0, (count - 2) * (STUD_SPACING - PIN_DIAMETER));
};

// =============================================================================
// Geometry Builders - Individual brick components
// =============================================================================

/**
 * Create a single stud (solid or hollow, with optional rounded top)
 * Following OpenSCAD implementation: uses rotate_extrude of a circle to create rounded edge
 *
 * @param {string} studType - 'solid' or 'hollow'
 * @param {number} studRescale - Scale factor for stud diameter
 * @param {number} segments - Number of segments for cylinders
 * @param {number} studTopRoundness - 0 = flat top, up to 1 = very rounded edge
 */
const createStud = (studType, studRescale, segments, studTopRoundness = 0) => {
  const scaledDiameter = STUD_DIAMETER * studRescale;
  const radius = scaledDiameter / 2;

  // Clamp roundness: must be less than radius/2 per OpenSCAD assertion
  const maxCurveHeight = (radius / 2) - 0.01;
  const curveHeight = Math.min(Math.max(0, studTopRoundness), 1) * maxCurveHeight;

  let solidStud;

  if (curveHeight > 0.01) {
    // Rounded top stud - following OpenSCAD rounded_stud_top module:
    // 1. Base cylinder (height - curveHeight)
    // 2. rotate_extrude a circle at (radius - curveHeight, 0) to make rounded edge
    // 3. Fill center with cylinder
    // 4. Subtract bottom portion to clean up

    const baseHeight = STUD_HEIGHT - curveHeight;

    // Base cylinder
    const base = cylinder({
      radius: radius,
      height: baseHeight,
      segments: segments,
      center: [0, 0, baseHeight / 2]
    });

    // Create the rounded top edge using extrudeRotate
    // In OpenSCAD: rotate_extrude() hull() { translate([radius-curve_height, 0, 0]) circle(curve_height); }
    // The circle is positioned at x = radius - curveHeight from the Z axis
    const roundingCircle = circle({
      radius: curveHeight,
      segments: segments,
      center: [radius - curveHeight, 0]
    });

    // Revolve the circle around the Z axis
    const roundedRing = extrudeRotate({ segments: segments }, roundingCircle);

    // Position the rounded ring at top of base
    const positionedRing = translate([0, 0, baseHeight], roundedRing);

    // Fill the center above the base (the hole in the middle of the torus)
    const centerFill = cylinder({
      radius: radius - curveHeight,
      height: curveHeight,
      segments: segments,
      center: [0, 0, baseHeight + curveHeight / 2]
    });

    // Subtract the portion below baseHeight from the ring (cleanup like OpenSCAD does)
    const bottomCleanup = cylinder({
      radius: radius + 0.1,
      height: curveHeight,
      segments: segments,
      center: [0, 0, baseHeight - curveHeight / 2]
    });

    const cleanedRing = subtract(positionedRing, bottomCleanup);

    solidStud = union(base, cleanedRing, centerFill);
  } else {
    // Flat top stud (original behavior)
    solidStud = cylinder({
      radius: radius,
      height: STUD_HEIGHT,
      segments: segments,
      center: [0, 0, STUD_HEIGHT / 2]
    });
  }

  if (studType === 'hollow') {
    const hole = cylinder({
      radius: (HOLLOW_STUD_INNER_DIAMETER * studRescale) / 2,
      height: STUD_HEIGHT + 0.1,
      segments: segments,
      center: [0, 0, STUD_HEIGHT / 2]
    });
    return subtract(solidStud, hole);
  }

  return solidStud;
};

/**
 * Create all studs for the brick top
 */
const createStuds = (realWidth, realLength, blockHeightMm, studType, studRescale, segments, studTopRoundness = 0) => {
  const scaledDiameter = STUD_DIAMETER * studRescale;
  const totalStudsLength = computeTotalStudsWidth(realLength, scaledDiameter);
  const totalStudsWidth = computeTotalStudsWidth(realWidth, scaledDiameter);
  const overallLength = (realLength * STUD_SPACING) - (2 * WALL_PLAY);
  const overallWidth = (realWidth * STUD_SPACING) - (2 * WALL_PLAY);

  const studs = [];
  const stud = createStud(studType, studRescale, segments, studTopRoundness);

  const offsetX = (scaledDiameter / 2) + (overallLength - totalStudsLength) / 2;
  const offsetY = (scaledDiameter / 2) + (overallWidth - totalStudsWidth) / 2;

  for (let y = 0; y < realWidth; y++) {
    for (let x = 0; x < realLength; x++) {
      const posX = offsetX + (x * STUD_SPACING);
      const posY = offsetY + (y * STUD_SPACING);
      studs.push(translate([posX, posY, blockHeightMm], stud));
    }
  }

  return union(...studs);
};

/**
 * Create the main block body (hollow rectangular shell)
 */
const createBlockBody = (overallLength, overallWidth, blockHeightMm, bottomType) => {
  const outer = cuboid({
    size: [overallLength, overallWidth, blockHeightMm],
    center: [overallLength / 2, overallWidth / 2, blockHeightMm / 2]
  });

  if (bottomType === 'closed') {
    return outer;
  }

  const innerLength = overallLength - (WALL_THICKNESS * 2);
  const innerWidth = overallWidth - (WALL_THICKNESS * 2);
  const innerHeight = blockHeightMm - ROOF_THICKNESS;

  if (innerLength <= 0 || innerWidth <= 0 || innerHeight <= 0) {
    return outer;
  }

  const inner = cuboid({
    size: [innerLength, innerWidth, innerHeight],
    center: [overallLength / 2, overallWidth / 2, innerHeight / 2]
  });

  return subtract(outer, inner);
};

/**
 * Create interior wall splines
 */
const createSplines = (realWidth, realLength, blockHeightMm, overallLength, overallWidth) => {
  const splines = [];

  for (let x = 0; x < realLength; x++) {
    const posX = (STUD_SPACING / 2) - WALL_PLAY - (SPLINE_THICKNESS / 2) + (x * STUD_SPACING);

    const frontSpline = cuboid({
      size: [SPLINE_THICKNESS, SPLINE_LENGTH, blockHeightMm],
      center: [posX + SPLINE_THICKNESS / 2, WALL_THICKNESS + SPLINE_LENGTH / 2, blockHeightMm / 2]
    });
    splines.push(frontSpline);

    const backSpline = cuboid({
      size: [SPLINE_THICKNESS, SPLINE_LENGTH, blockHeightMm],
      center: [posX + SPLINE_THICKNESS / 2, overallWidth - WALL_THICKNESS - SPLINE_LENGTH / 2, blockHeightMm / 2]
    });
    splines.push(backSpline);
  }

  for (let y = 0; y < realWidth; y++) {
    const posY = (STUD_SPACING / 2) - WALL_PLAY - (SPLINE_THICKNESS / 2) + (y * STUD_SPACING);

    const leftSpline = cuboid({
      size: [SPLINE_LENGTH, SPLINE_THICKNESS, blockHeightMm],
      center: [WALL_THICKNESS + SPLINE_LENGTH / 2, posY + SPLINE_THICKNESS / 2, blockHeightMm / 2]
    });
    splines.push(leftSpline);

    const rightSpline = cuboid({
      size: [SPLINE_LENGTH, SPLINE_THICKNESS, blockHeightMm],
      center: [overallLength - WALL_THICKNESS - SPLINE_LENGTH / 2, posY + SPLINE_THICKNESS / 2, blockHeightMm / 2]
    });
    splines.push(rightSpline);
  }

  return splines.length > 0 ? union(...splines) : null;
};

/**
 * Create a single interior support post
 * @param {number} blockHeightMm - Height of the brick in mm
 * @param {number} realHeight - Height ratio (1 = standard brick)
 * @param {number} segments - Number of segments for cylinders
 * @param {boolean} hasAxleHole - If true, creates cross-shaped hole; if false, round hollow
 */
const createPost = (blockHeightMm, realHeight, segments, hasAxleHole = false) => {
  const outer = cylinder({
    radius: POST_DIAMETER / 2,
    height: blockHeightMm,
    segments: segments,
    center: [0, 0, blockHeightMm / 2]
  });

  if (hasAxleHole) {
    // Cross-shaped axle hole (like Technic bricks)
    const holeHeight = (realHeight + 1) * BLOCK_HEIGHT;

    // Horizontal bar of cross
    const hBar = cuboid({
      size: [AXLE_DIAMETER, AXLE_SPLINE_WIDTH, holeHeight],
      center: [0, 0, holeHeight / 2 - BLOCK_HEIGHT / 2]
    });

    // Vertical bar of cross
    const vBar = cuboid({
      size: [AXLE_SPLINE_WIDTH, AXLE_DIAMETER, holeHeight],
      center: [0, 0, holeHeight / 2 - BLOCK_HEIGHT / 2]
    });

    return subtract(outer, union(hBar, vBar));
  } else {
    // Standard round hollow post
    const inner = cylinder({
      radius: (POST_DIAMETER / 2) - POST_WALL_THICKNESS,
      height: blockHeightMm + 0.1,
      segments: segments,
      center: [0, 0, blockHeightMm / 2]
    });

    return subtract(outer, inner);
  }
};

/**
 * Create interior posts for blocks wider than 1 stud
 */
const createPosts = (realWidth, realLength, blockHeightMm, realHeight, overallLength, overallWidth, segments, verticalAxleHoles = false) => {
  if (realWidth <= 1 || realLength <= 1) return null;

  const posts = [];

  const totalPostsLength = computeTotalPostsWidth(realLength);
  const totalPostsWidth = computeTotalPostsWidth(realWidth);

  const offsetX = (POST_DIAMETER / 2) + (overallLength - totalPostsLength) / 2;
  const offsetY = (POST_DIAMETER / 2) + (overallWidth - totalPostsWidth) / 2;

  for (let y = 1; y < realWidth; y++) {
    for (let x = 1; x < realLength; x++) {
      const posX = offsetX + ((x - 1) * STUD_SPACING);
      const posY = offsetY + ((y - 1) * STUD_SPACING);
      const post = createPost(blockHeightMm, realHeight, segments, verticalAxleHoles);
      posts.push(translate([posX, posY, 0], post));
    }
  }

  return posts.length > 0 ? union(...posts) : null;
};

/**
 * Create pins for 1-wide bricks
 */
const createPins = (realWidth, realLength, blockHeightMm, overallLength, overallWidth, segments) => {
  if ((realWidth !== 1 && realLength !== 1) || (realWidth === 1 && realLength === 1)) {
    return null;
  }

  const pins = [];
  const pin = cylinder({
    radius: PIN_DIAMETER / 2,
    height: blockHeightMm,
    segments: segments,
    center: [0, 0, blockHeightMm / 2]
  });

  if (realWidth === 1 && realLength > 1) {
    const totalPinsLength = computeTotalPinsWidth(realLength);
    const offsetX = (PIN_DIAMETER / 2) + (overallLength - totalPinsLength) / 2;

    for (let x = 1; x < realLength; x++) {
      const posX = offsetX + ((x - 1) * STUD_SPACING);
      pins.push(translate([posX, overallWidth / 2, 0], pin));
    }
  } else if (realLength === 1 && realWidth > 1) {
    const totalPinsWidth = computeTotalPinsWidth(realWidth);
    const offsetY = (PIN_DIAMETER / 2) + (overallWidth - totalPinsWidth) / 2;

    for (let y = 1; y < realWidth; y++) {
      const posY = offsetY + ((y - 1) * STUD_SPACING);
      pins.push(translate([overallLength / 2, posY, 0], pin));
    }
  }

  return pins.length > 0 ? union(...pins) : null;
};

/**
 * Create reinforcement cross-braces
 */
const createReinforcement = (realWidth, realLength, blockHeightMm, overallLength, overallWidth, segments) => {
  if (realWidth <= 1 || realLength <= 1) return null;

  const reinforcements = [];

  const totalPostsLength = computeTotalPostsWidth(realLength);
  const totalPostsWidth = computeTotalPostsWidth(realWidth);

  const offsetX = (POST_DIAMETER / 2) + (overallLength - totalPostsLength) / 2;
  const offsetY = (POST_DIAMETER / 2) + (overallWidth - totalPostsWidth) / 2;

  const crossLength = 2 * (STUD_SPACING - (2 * WALL_PLAY));

  for (let y = 1; y < realWidth; y++) {
    for (let x = 1; x < realLength; x++) {
      const posX = offsetX + ((x - 1) * STUD_SPACING);
      const posY = offsetY + ((y - 1) * STUD_SPACING);

      const hBar = cuboid({
        size: [crossLength, REINFORCING_WIDTH, blockHeightMm],
        center: [posX, posY, blockHeightMm / 2]
      });
      reinforcements.push(hBar);

      const vBar = cuboid({
        size: [REINFORCING_WIDTH, crossLength, blockHeightMm],
        center: [posX, posY, blockHeightMm / 2]
      });
      reinforcements.push(vBar);
    }
  }

  if (reinforcements.length === 0) return null;

  let result = union(...reinforcements);

  // Subtract post cylinders from reinforcement to avoid overlap
  for (let y = 1; y < realWidth; y++) {
    for (let x = 1; x < realLength; x++) {
      const posX = offsetX + ((x - 1) * STUD_SPACING);
      const posY = offsetY + ((y - 1) * STUD_SPACING);

      const postHole = cylinder({
        radius: (POST_DIAMETER / 2) - 0.1,
        height: blockHeightMm + 1,
        segments: segments,
        center: [posX, posY, (blockHeightMm + 1) / 2 - 0.5]
      });
      result = subtract(result, postHole);
    }
  }

  return result;
};

/**
 * Create Technic horizontal hole supports (solid cylinders that will have holes subtracted)
 * These run through the brick perpendicular to the length direction (along Y axis)
 */
const createHorizontalHoleSupports = (realWidth, realLength, height, overallLength, overallWidth, segments) => {
  const supports = [];
  const scaledDiameter = STUD_DIAMETER;
  const totalStudsLength = computeTotalStudsWidth(realLength, scaledDiameter);

  // Support cylinder radius = hole radius + wall thickness
  const supportRadius = (HORIZONTAL_HOLE_DIAMETER / 2) + HORIZONTAL_HOLE_WALL_THICKNESS;

  // Calculate x offset for hole positions
  // 1-length bricks: hole is under the stud
  // >1-length bricks: holes are between studs
  const xOffset = (HORIZONTAL_HOLE_DIAMETER / 2) +
    (realLength === 1 ? 0 : (STUD_SPACING / 2));

  const baseOffset = (overallLength - totalStudsLength) / 2;

  // Determine hole indices
  const startIndex = 0;
  const endIndex = realLength === 1 ? realLength - 1 : realLength - 2;

  // Create supports for each height level and hole position
  for (let heightIndex = 0; heightIndex < height; heightIndex++) {
    for (let holeIndex = startIndex; holeIndex <= endIndex; holeIndex++) {
      const posX = xOffset + baseOffset + (holeIndex * STUD_SPACING);
      const posZ = (heightIndex * BLOCK_HEIGHT) + HORIZONTAL_HOLE_Z_OFFSET;

      // Create cylinder centered at origin (spans -h/2 to +h/2 on Z)
      const support = cylinder({
        radius: supportRadius,
        height: overallWidth,
        segments: segments,
        center: [0, 0, 0]
      });

      // Rotate 90 degrees around X: Z axis becomes Y axis
      // After rotation, cylinder spans -h/2 to +h/2 on Y
      const rotated = rotateX(Math.PI / 2, support);

      // Translate so cylinder runs from Y=0 to Y=overallWidth, at correct X and Z
      const positioned = translate([posX, overallWidth / 2, posZ], rotated);

      supports.push(positioned);
    }
  }

  return supports.length > 0 ? union(...supports) : null;
};

/**
 * Create the actual Technic holes to subtract (including bevels)
 */
const createHorizontalHoles = (realWidth, realLength, height, overallLength, overallWidth, segments) => {
  const holes = [];
  const scaledDiameter = STUD_DIAMETER;
  const totalStudsLength = computeTotalStudsWidth(realLength, scaledDiameter);

  const holeRadius = HORIZONTAL_HOLE_DIAMETER / 2;
  const bevelRadius = HORIZONTAL_HOLE_BEVEL_DIAMETER / 2;

  // Calculate x offset
  const xOffset = (HORIZONTAL_HOLE_DIAMETER / 2) +
    (realLength === 1 ? 0 : (STUD_SPACING / 2));

  const baseOffset = (overallLength - totalStudsLength) / 2;

  // Determine hole indices
  const startIndex = 0;
  const endIndex = realLength === 1 ? realLength - 1 : realLength - 2;

  for (let heightIndex = 0; heightIndex < height; heightIndex++) {
    for (let holeIndex = startIndex; holeIndex <= endIndex; holeIndex++) {
      const posX = xOffset + baseOffset + (holeIndex * STUD_SPACING);
      const posZ = (heightIndex * BLOCK_HEIGHT) + HORIZONTAL_HOLE_Z_OFFSET;

      // Main hole cylinder (runs along Y axis through entire brick width)
      const mainHoleCyl = cylinder({
        radius: holeRadius,
        height: overallWidth + 0.2,  // Slightly longer to ensure clean cut
        segments: segments,
        center: [0, 0, 0]
      });
      const mainHole = translate(
        [posX, overallWidth / 2, posZ],
        rotateX(Math.PI / 2, mainHoleCyl)
      );
      holes.push(mainHole);

      // Front bevel (Y = 0 side)
      const frontBevelCyl = cylinder({
        radius: bevelRadius,
        height: HORIZONTAL_HOLE_BEVEL_DEPTH + 0.1,
        segments: segments,
        center: [0, 0, 0]
      });
      const frontBevel = translate(
        [posX, (HORIZONTAL_HOLE_BEVEL_DEPTH + 0.1) / 2, posZ],
        rotateX(Math.PI / 2, frontBevelCyl)
      );
      holes.push(frontBevel);

      // Back bevel (Y = overallWidth side)
      const backBevelCyl = cylinder({
        radius: bevelRadius,
        height: HORIZONTAL_HOLE_BEVEL_DEPTH + 0.1,
        segments: segments,
        center: [0, 0, 0]
      });
      const backBevel = translate(
        [posX, overallWidth - (HORIZONTAL_HOLE_BEVEL_DEPTH + 0.1) / 2, posZ],
        rotateX(Math.PI / 2, backBevelCyl)
      );
      holes.push(backBevel);
    }
  }

  return holes.length > 0 ? union(...holes) : null;
};

/**
 * Create vertical axle hole subtractions (to cut through the roof/top of the brick)
 * The posts already have axle holes, but this cuts through the top surface
 */
const createVerticalAxleHoleSubtractions = (realWidth, realLength, realHeight, overallLength, overallWidth) => {
  const holes = [];

  // Calculate positioning (same as posts - between studs)
  const totalAxlesLength = (AXLE_DIAMETER * (realLength - 1)) + ((realLength - 2) * (STUD_SPACING - AXLE_DIAMETER));
  const totalAxlesWidth = (AXLE_DIAMETER * (realWidth - 1)) + ((realWidth - 2) * (STUD_SPACING - AXLE_DIAMETER));

  const offsetX = (AXLE_DIAMETER / 2) + (overallLength - totalAxlesLength) / 2;
  const offsetY = (AXLE_DIAMETER / 2) + (overallWidth - totalAxlesWidth) / 2;

  // Height extends through entire brick plus extra (matching OpenSCAD: (real_height+1)*block_height)
  const holeHeight = (realHeight + 1) * BLOCK_HEIGHT;
  // Center Z offset (matching OpenSCAD: translate -block_height/2, then center at (real_height+1)*block_height/2)
  const centerZ = holeHeight / 2 - BLOCK_HEIGHT / 2;

  for (let y = 1; y < realWidth; y++) {
    for (let x = 1; x < realLength; x++) {
      const posX = offsetX + ((x - 1) * STUD_SPACING);
      const posY = offsetY + ((y - 1) * STUD_SPACING);

      // Cross shape: two perpendicular rectangles
      const hBar = cuboid({
        size: [AXLE_DIAMETER, AXLE_SPLINE_WIDTH, holeHeight],
        center: [posX, posY, centerZ]
      });

      const vBar = cuboid({
        size: [AXLE_SPLINE_WIDTH, AXLE_DIAMETER, holeHeight],
        center: [posX, posY, centerZ]
      });

      holes.push(hBar, vBar);
    }
  }

  return holes.length > 0 ? union(...holes) : null;
};

// =============================================================================
// Main Block Function
// =============================================================================

const block = (params) => {
  const {
    width = 2,
    length = 4,
    height = 1,
    type = 'brick',
    studType = 'solid',
    bottomType = 'open',
    horizontalHoles = false,
    verticalAxleHoles = false,
    includeSplines = true,
    withPosts = true,
    useReinforcement = false,
    studRescale = 1.0,
    studTopRoundness = 0,
    segments = 64
  } = params;

  // Normalize dimensions (ensure width <= length)
  const realWidth = Math.min(width, length);
  const realLength = Math.max(width, length);
  const realHeight = computeRealHeight(type, height);

  // Calculate overall dimensions in mm
  const overallLength = (realLength * STUD_SPACING) - (2 * WALL_PLAY);
  const overallWidth = (realWidth * STUD_SPACING) - (2 * WALL_PLAY);
  const blockHeightMm = realHeight * BLOCK_HEIGHT;

  // Build the brick parts
  const parts = [];

  // 1. Main body
  parts.push(createBlockBody(overallLength, overallWidth, blockHeightMm, bottomType));

  // 2. Studs (unless tile type)
  if (type !== 'tile') {
    parts.push(createStuds(realWidth, realLength, blockHeightMm, studType, studRescale, segments, studTopRoundness));
  }

  // 3. Interior features (only for open bottom)
  if (bottomType === 'open') {
    // Wall splines
    if (includeSplines) {
      const splines = createSplines(realWidth, realLength, blockHeightMm, overallLength, overallWidth);
      if (splines) parts.push(splines);
    }

    // Interior supports
    if (withPosts) {
      // Posts (for multi-stud width and length)
      // If verticalAxleHoles is enabled, posts get cross-shaped holes instead of round hollow
      const posts = createPosts(realWidth, realLength, blockHeightMm, realHeight, overallLength, overallWidth, segments, verticalAxleHoles);
      if (posts) parts.push(posts);

      // Pins (for 1-wide bricks)
      const pins = createPins(realWidth, realLength, blockHeightMm, overallLength, overallWidth, segments);
      if (pins) parts.push(pins);

      // Reinforcement (optional)
      if (useReinforcement && type !== 'tile') {
        const reinforcement = createReinforcement(realWidth, realLength, blockHeightMm, overallLength, overallWidth, segments);
        if (reinforcement) parts.push(reinforcement);
      }
    }

    // Technic horizontal hole supports (solid cylinders running through brick)
    if (horizontalHoles && realHeight >= 1) {
      const holeSupports = createHorizontalHoleSupports(realWidth, realLength, Math.floor(realHeight), overallLength, overallWidth, segments);
      if (holeSupports) parts.push(holeSupports);
    }
  }

  // Combine all parts
  let result = union(...parts);

  // 4. Subtract Technic horizontal holes (after union, so holes cut through everything)
  if (horizontalHoles && realHeight >= 1) {
    const holes = createHorizontalHoles(realWidth, realLength, Math.floor(realHeight), overallLength, overallWidth, segments);
    if (holes) result = subtract(result, holes);
  }

  // 5. Subtract vertical axle holes through the roof (posts already have holes, but need to cut roof too)
  if (verticalAxleHoles && realWidth > 1 && realLength > 1) {
    const axleHoles = createVerticalAxleHoleSubtractions(realWidth, realLength, realHeight, overallLength, overallWidth);
    if (axleHoles) result = subtract(result, axleHoles);
  }

  // Center on X/Y axes (matching OpenSCAD LEGO.scad behavior)
  result = translate([-overallLength / 2, -overallWidth / 2, 0], result);

  return result;
};

// =============================================================================
// Positioning Helpers
// =============================================================================

const place = (x, y, z, obj) => {
  const zPos = z || 0;
  return translate([STUD_SPACING * y, STUD_SPACING * x, zPos * BLOCK_HEIGHT], obj);
};

const stack = (x, y, z, ...objects) => {
  return place(x, y, z, union(...objects));
};

const uncenter = (width, length, height, obj) => {
  const h = height || 0;
  return translate([
    ((STUD_SPACING * length) / 2) - WALL_PLAY,
    ((STUD_SPACING * width) / 2) - WALL_PLAY,
    h ? ((STUD_SPACING * h) / 2) - WALL_PLAY : 0
  ], obj);
};

const blockHeight = (heightRatio = 1, type = 'brick') => {
  const realHeight = computeRealHeight(type, heightRatio);
  return realHeight * BLOCK_HEIGHT;
};

const minimumBlockCount = (lengthMm) => {
  return Math.ceil((lengthMm / STUD_SPACING) - WALL_PLAY);
};

// =============================================================================
// Main Entry Point
// =============================================================================

const main = (params) => {
  return block(params);
};

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  main,
  getParameterDefinitions,
  block,
  place,
  stack,
  uncenter,
  blockHeight,
  minimumBlockCount,
  STUD_SPACING,
  STUD_DIAMETER,
  STUD_HEIGHT,
  BLOCK_HEIGHT,
  WALL_PLAY
};
