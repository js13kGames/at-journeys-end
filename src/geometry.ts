export interface XY {
	x: number
	y: number
}

export interface XYZ {
	x: number
	y: number
	z: number
}

export interface LWH {
	l: number	// in x direction
	w: number	// in y direction
	h: number	// in z direction
}

export interface LW {
	l: number	// in x direction
	w: number	// in y direction
}

// for polar coordinates
export interface RA {
	r: number	// radius
	a: number	// angle
}

// map world coordinates onto canvas
interface Transform {
	xyz: (wp: XYZ) => XY
	xyzs: (wps: XYZ[]) => XY[]
}

export interface Config {
	lib: CanvasRenderingContext2D
	canvasLW: LW
	canvasCenter: XY
	worldViewRadius: number
	time: number
	playerXY: XYZ
	playerAngle: number
	fuel: number
	lanternIntensity: number
	cameraXYZ: XYZ
	cameraAngle: number
	transform: Transform
	now: number
	frameMS: number
	health: number
	pain: number
	safeTime: number // time after which player can be hurt again
}

export function XY(x: number, y: number) {
	return { x: x, y: y }
}

export function RA(r: number, a: number) {
	return { r: r, a: a }
}

export function copyXYZ(xyz: XYZ): XYZ {
	return XYZ(xyz.x, xyz.y, xyz.z)
}

export function XYZ(x: number, y: number, z=0) {
	return { x: x, y: y, z: z }
}

export function LWH(l: number, w: number, h: number) {
	return { l: l, w: w, h: h }
}

export function LW(l: number, w: number) {
	return { l: l, w: w }
}

export function distance(x: number, y: number, z=0): number {
	return Math.sqrt(x * x + y * y + z * z)
}

export function XYDistance(xy: XY): number {
	return Math.sqrt(xy.x * xy.x + xy.y * xy.y)
}

export function XYToRA(xy: XY): RA {
	return LWToRA(LW(xy.x, xy.y))
}

export function XYsToRA(xy1: XY, xy2: XY): RA {
	return LWToRA(LW(xy2.x-xy1.x, xy2.y-xy1.y))
}

export function LWToRA(lw: LW): RA {
	return RA(distance(lw.l, lw.w), Math.atan2(lw.w, lw.l))
}

export function RAToXYZ(ra: RA): XYZ {
	return XYZ(ra.r * Math.cos(ra.a), ra.r * Math.sin(ra.a), 0)
}

export function XYZPlusXYZ(a: XYZ, b: XYZ): XYZ {
	return XYZ(a.x + b.x, a.y + b.y, a.z + b.z)
}

export function XYMinusXY(a: XY, b: XY): XY {
	return XY(a.x - b.x, a.y - b.y)
}

export function XYPlusXY(a: XY, b: XY): XY {
	return XY(a.x + b.x, a.y + b.y)
}

export function getTransform(c: Config): Transform {

	// precalculate canvas center, canvas radius, and scale
	const m = 0 // margin
	const cx = c.canvasLW.l / 2 - m
	const cy = c.canvasLW.w *.65 - m
	const cr = distance(cx, cy)
	const cScale = cr / c.worldViewRadius
	const maxZ = c.cameraXYZ.z * .99

	// project a 3d point in WC onto the ground, then rotate and map to canvas
	function xyz(p: XYZ): XY {

		// project p from the camera onto the ground
		const scale = c.cameraXYZ.z / (c.cameraXYZ.z - Math.min(p.z, maxZ))
		const wx = c.cameraXYZ.x + (p.x - c.cameraXYZ.x) * scale
		const wy = c.cameraXYZ.y + (p.y - c.cameraXYZ.y) * scale

		// rotate in WC and map to canvas
		const dx = wx - c.cameraXYZ.x
		const dy = wy - c.cameraXYZ.y
		const a = Math.atan2(dy, dx) - c.cameraAngle + 3 * Math.PI / 2
		const d = distance(dx, dy) * cScale
		return XY(m+cx + d * Math.cos(a), m+cy + d * Math.sin(a))
	}

	return {
		xyz: xyz,
		xyzs: (a: XYZ[])=>a.map(xyz)
	}
}
