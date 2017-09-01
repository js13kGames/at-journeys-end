//	The projection is Orthographic; all rays are perpendicular to the view plane.
//	World Coordinates (W) are meters in page coordinates (to match canvas):
//	- top left is (0,0) and bottom right is (MaxX, MaxY),
//	- angles are measured clockwise: 0=>right, PI/2=>down, PI=>left, 3PI/2=>up.
// The canvas is a camera of size (CW, CH) in pixels that:
//	- always looks straight down at a point in W (CX, CY),
//	- is rotated by CA in radians,
//	- views an area of diameter CD.

export interface Point {
	x: number
	y: number
}

export interface Size {
	w: number
	h: number
}

// map world coordinates onto canvas
interface Transform {
	point: (wp: Point) => Point
	distance: (d: number) => number
}

export interface Config {
	context2d: CanvasRenderingContext2D
	canvasSize: Size
	canvasCenter: Point
	worldViewRadius: number
	time: number
	direction: number
	playerXY: Point
	cameraXY: Point
	cameraAngle: number
	lightHeight: number
	transform: Transform
	now: number
	frameMS: number
}

export function Point(x: number, y: number) {
	return { x: x, y: y }
}

export function Size(w: number, h: number) {
	return { w: w, h: h }
}

export function distance(x: number, y: number): number {
	return Math.sqrt(x * x + y * y)
}

export function getTransform(config: Config): Transform {

	// precalculate canvas center, canvas radius, and scale
	const cx = config.canvasSize.w / 2
	const cy = config.canvasSize.h / 2
	const cr = distance(cx, cy)
	const scale = cr / config.worldViewRadius

	return {
		point: (p: Point) => {
			const dx = p.x - config.cameraXY.x
			const dy = p.y - config.cameraXY.y
			const a = Math.atan2(dy, dx) - config.cameraAngle + 3 * Math.PI / 2
			const d = distance(dx, dy) * scale
			return Point(cx + d * Math.cos(a), cy + d * Math.sin(a))
		},
		distance: (d: number) => d * scale
	}
}
