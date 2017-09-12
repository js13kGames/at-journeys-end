import { distance, Config, XYZ, XY, LWH, LW, RA, LWToRA, XYToRA, XYsToRA, RAToXYZ, XYZPlusXYZ, XYPlusXY, XYMinusXY, XYDistance } from './geometry';
import { moveWithDeflection } from './movement'

/**********************************
 *
 * Water particle equation: y = -(2x-1)^2 + 1 where x is time and y is size. Both vary from 0 to 1
 * Aspect ratio is W/H = 10
 */
export interface Primitive {
	center: XYZ
	maxSize: number
	preventsTreeAt(wp: XY, pad: number): boolean
	collidesWith(wp: XY, pad: number): boolean
	contains(wp: XY, pad: number): boolean
	draw(c: Config): void
}

export interface Light extends Primitive {
	setRadius(r: number): void
	setIntensity(i: number): void
}

export interface FuelCan extends Primitive {
	consume(): void
}

export interface NPC extends Primitive {
	update(c: Config, avoid: Primitive[]): void
}

export interface Tile extends Primitive {
	add(p: Primitive): void
	outline(c: Config): void
}

export function createTiles(primitives: Primitive[]): Tile[] {
	const size = 30 // width and height
	const s2 = size / 2
	const map: any = {}

	primitives.forEach(p=>{
		const tileCenter = XYZ(size * Math.floor(p.center.x / size) + s2, size * Math.floor(p.center.y / size) + s2)
		const name = tileCenter.x + "," + tileCenter.y
		const tile = map[name] || Tile(tileCenter, size)
		map[name] = tile
		tile.add(p)
	})

	const tiles = Object.keys(map).map((k: any)=>map[k])

	console.log(tiles.map(t=>t.center))
	return tiles
}

export function Tile(xy: XYZ, size: number): Tile {
	const parts: Primitive[] = []
	const s2 = size/2
	const r = distance(s2, s2)
	const minXY = XYZ(xy.x - s2 + .1, xy.y - s2 + .1)
	const maxXY = XYZ(xy.x + s2 - .1, xy.y + s2 - .1)
	const extension = 10

	return {
		center: xy,
		maxSize: size,
		preventsTreeAt: (wp: XY, pad: number)=>parts.some(p=>p.preventsTreeAt(wp, pad)),
		collidesWith: (wp: XY, pad: number)=>parts.some(p=>p.collidesWith(wp, pad)),
		contains: (wp: XY, pad: number)=>{
			return wp.x >= minXY.x-s2 && wp.x <= maxXY.x+s2 &&
				wp.y >= minXY.y-s2 && wp.y <= maxXY.y+s2 &&
				parts.some(p=>p.contains(wp, pad))
		},
		draw: (c: Config)=>{
			if (XYDistance(XYMinusXY(c.cameraXYZ, xy)) < c.worldViewRadius + r) parts.forEach(p=>p.draw(c))
		},
		add: (p: Primitive)=>{
			if (p.maxSize > s2) console.log("Warning: part at " + xy.x + ", " + xy.y + " is larger than tile")
			parts.push(p)
		},
		outline: (c: Config)=>{
			const inRange = XYDistance(XYMinusXY(c.cameraXYZ, xy)) < c.worldViewRadius + r
			const color = inRange ? "#008" : "red"
			const cps = c.transform.xyzs([minXY, XYZ(minXY.x, maxXY.y), maxXY, XYZ(maxXY.x, minXY.y)])
			c.lib.beginPath()
			c.lib.moveTo(cps[0].x, cps[0].y)
			c.lib.lineTo(cps[1].x, cps[1].y)
			c.lib.lineTo(cps[2].x, cps[2].y)
			c.lib.lineTo(cps[3].x, cps[3].y)
			c.lib.lineTo(cps[0].x, cps[0].y)
			c.lib.strokeStyle = color
			c.lib.stroke()
		}
	}
}

export function Cube(xyz: XYZ, lwh: LWH, a: number, collide=true, color?: string): Primitive {
	//lwh.h = 1
	const bottomCorners = corners(xyz, lwh, a)
	const topCorners = bottomCorners.map(p=>XYZ(p.x, p.y, xyz.z + lwh.h))
	const contains = (wp: XY, pad: number)=>rectangleContains(xyz, lwh, a, wp, pad)

	return {
		center: xyz,
		maxSize: Math.max(lwh.l, lwh.w),
		preventsTreeAt: contains,
		collidesWith: (wp: XY, pad: number)=>collide && contains(wp, pad),
		contains: contains,
		draw: (c: Config)=>{
			if (XYDistance(XYMinusXY(xyz, c.cameraXYZ)) > c.worldViewRadius) return

			// only render the two sides adjacent to the nearest corner
			const dists = bottomCorners.map(p=>XYDistance(XYMinusXY(c.cameraXYZ, p)))
			const nearest = dists.indexOf(Math.min(...dists))

			// transform all 8 corners
			const xys = c.transform.xyzs([...bottomCorners, ...topCorners])

			// draw the four vertical sides
			c.lib.fillStyle = color ? color : "black"
			c.lib.globalCompositeOperation = color ? "overlay" : "source-over"
			const sides = [(nearest + 3) % 4, nearest]
			sides.forEach(i=>{
				c.lib.beginPath()
				const j = (i + 1) % 4
				moveTo(xys[i], c)
				linesTo([xys[i+4], xys[j+4], xys[j], xys[i]], c)
				c.lib.fill()
			})

			// draw the top
			c.lib.beginPath()
			moveTo(xys[4], c)
			linesTo([xys[5], xys[6], xys[7], xys[4]], c)
			c.lib.globalCompositeOperation = color ? "multiply" : "source-over"
			c.lib.fill()
		}
	}
}

export function Cylinder(xyz: XYZ, r: number, h: number, color?: string): Primitive {
	//h = 1
	const contains = (wp: XY, pad: number)=>{
		const min = r + pad + 0.25
		const rSquared = min * min
		const dp = XYMinusXY(wp, xyz)
		const dSquared = dp.x * dp.x + dp.y * dp.y
		return dSquared < rSquared
	}

	return {
		center: xyz,
		maxSize: r,
		preventsTreeAt: contains,
		collidesWith: contains,
		contains: contains,
		draw: (c: Config)=>{
			
			// find distance
			const dxy = XYMinusXY(xyz, c.cameraXYZ)
			const d = XYDistance(dxy)
			if (d > c.worldViewRadius) return

			// find left and right point of tangency at bottom of cylinder
			const angleToCenter = Math.atan2(dxy.y, dxy.x)
			const angleBetweenCenterAndTangent = Math.asin(r / d)
			const a1 = angleToCenter - angleBetweenCenterAndTangent
			const a2 = angleToCenter + angleBetweenCenterAndTangent
			const bp1 = XYZ(c.cameraXYZ.x + Math.cos(a1) * d, c.cameraXYZ.y + Math.sin(a1) * d, xyz.z)
			const bp2 = XYZ(c.cameraXYZ.x + Math.cos(a2) * d, c.cameraXYZ.y + Math.sin(a2) * d, xyz.z)
			const bxys = c.transform.xyzs([bp1, bp2, xyz, XYZ(c.cameraXYZ.x, c.cameraXYZ.y, 0)])

			// find left and right point of tangency at top of cylinder
			const topZ = xyz.z + h
			const tp1 = XYZ(bp1.x, bp1.y, topZ)
			const tp2 = XYZ(bp2.x, bp2.y, topZ)
			const txys = c.transform.xyzs([tp1, tp2, XYZ(xyz.x, xyz.y, topZ)])
			const topR = XYDistance(XYMinusXY(txys[0], txys[2]))

			// draw
			c.lib.fillStyle = color ? color : "black"
			c.lib.globalCompositeOperation = color ? "overlay" : "source-over"
			c.lib.beginPath()
			moveTo(bxys[0], c)
			lineTo(txys[0], c)
			if (h < 3) c.lib.arcTo(bxys[3].x, bxys[3].y, txys[1].x, txys[1].y, topR)
			else c.lib.lineTo(txys[1].x, txys[1].y)
			c.lib.arcTo(bxys[3].x, bxys[3].y, txys[0].x, txys[0].y, XYDistance(XYMinusXY(bxys[0], bxys[2])))
			c.lib.fill()
			c.lib.beginPath()
			c.lib.arc(txys[2].x, txys[2].y, topR, 0, Math.PI*2)
			c.lib.fill()
		}
	}
}

// rectangle on the ground, z is ignored, lw is from center to edge (so half)
export function Plane(xyz: XYZ, lw: LW, a: number, color: string, operation: string, barrier: boolean, treeless: boolean): Primitive {
	const contains = (wp: XY, pad: number)=>rectangleContains(xyz, lw, a, wp, pad)
	return {
		center: xyz,
		maxSize: Math.max(lw.l, lw.w),
		preventsTreeAt: (wp: XY, pad: number)=>treeless && contains(wp, pad),
		collidesWith: (wp: XY, pad: number)=>barrier && contains(wp, pad),
		contains: contains,
		draw: (c: Config)=>{
			if (color) {
				if (XYDistance(XYMinusXY(xyz, c.playerXY)) > c.worldViewRadius + Math.max(lw.l, lw.w)) return
				const wps = corners(xyz, lw, a)
				const cps = c.transform.xyzs(wps)
				c.lib.beginPath()
				moveTo(cps[0], c)
				linesTo([cps[1], cps[2], cps[3], cps[0]], c)
				c.lib.fillStyle = color
				c.lib.globalCompositeOperation = operation
				c.lib.fill()
			}
		}
	}
}

export function Road(xyz: XYZ, lw: LW, a: number): Primitive {

	// swap l and w
	if (lw.w > lw.l) {
		lw = LW(lw.w, lw.l)
		a += Math.PI / 2
	}
	const parts: Primitive[] = [Plane(XYZ(xyz.x, xyz.y, 0), lw, a, "#6d6d6d", "multiply", false, true)] // road
	const lineLength = 1.0
	const lineWidth = 0.15
	const ra = RA(lw.l, a)
	const dxyz = RAToXYZ(ra)
	const p1 = XYMinusXY(xyz, dxyz)
	const p2 = XYPlusXY(xyz, dxyz)
	const contains = (wp: XY, pad: number)=>parts.some(p=>p.contains(wp, pad))

	// add stripes
	for (let i = lineLength; i < lw.l - lineLength; i += 4 * lineLength) {
		const p = XY(p1.x + (p2.x - p1.x) * i / lw.l, p1.y + (p2.y - p1.y) * i / lw.l)
		parts.push(Plane(XYZ(p.x, p.y, 0), LW(lineLength, lineWidth), a, "#fff", "overlay", false, false)) // stripe
	}

	return {
		center: xyz,
		maxSize: Math.max(lw.l, lw.l),
		preventsTreeAt: contains,
		collidesWith: (wp: XY, pad: number)=>false,
		contains: contains,
		draw: (c: Config)=>parts.forEach(p=>p.draw(c))
	}
}

export function Light(xyz: XYZ, wr: number, b: number, color = [255, 255, 255], flicker=false): Light {
	const rgba = "rgba(" + color[0] + "," + color[1] + "," + color[2] + ","
	return {
		center: xyz,
		maxSize: wr,
		preventsTreeAt: (wp: XY, pad: number)=>false,
		collidesWith: (wp: XY, pad: number)=>false,
		contains: ()=>false,
		draw: (c: Config)=>{
			
			// find distance
			const dxy = XYMinusXY(xyz, c.cameraXYZ)
			const d = XYDistance(dxy)
			if (d > c.worldViewRadius * 1.5) return

			const lightXY = c.transform.xyz(xyz)
			const edgeXY = c.transform.xyz(XYZPlusXYZ(xyz, XYZ(wr, 0, 0)))
			const cr = distance(edgeXY.x - lightXY.x, edgeXY.y - lightXY.y)
			const g = c.lib.createRadialGradient(lightXY.x, lightXY.y, 0, lightXY.x, lightXY.y, cr)
			const flickerAmount = flicker ? 0.1 : 0
			const intensity = b + b * flickerAmount * (0.578 - (Math.sin(c.time) +
				Math.sin(2.2 * c.time + 5.52) + Math.sin(2.9 * c.time + 0.93) +
				Math.sin(4.6 * c.time + 8.94))) / 4
			const steps = 20; // number of gradient steps
			const lightScale = 15; // controls how quickly the light falls off
			for (var i = 1; i < steps + 1; i++) {
				let x = lightScale * Math.pow(i / steps, 2) + 1
				let alpha = intensity / (x * x)
				if (alpha < 0.01) alpha = 0
				g.addColorStop((x - 1) / lightScale, rgba + alpha + ")")
			}
			c.lib.fillStyle = g
			c.lib.globalCompositeOperation = "source-over"
			c.lib.fillRect(lightXY.x - cr, lightXY.y - cr, cr * 2, cr * 2)
		},
		setRadius: (r: number)=>wr = r,
		setIntensity: (i: number)=>b = i
	}
}

export function FuelCan(xyz: XYZ, a: number): FuelCan {
	const cube = Cube(xyz, LWH(0.27, 0.41, 0.9), a, true, "red")
	let full = true

	// cylinder
	const p = XYZPlusXYZ(xyz, RAToXYZ(RA(0.22, a + Math.PI / 2)))
	const cylinder = Cylinder(XYZ(p.x, p.y, .9), .1, .01, "red")

	const parts: Primitive[] = [cube, cylinder]
	const contains = (wp: XY, pad: number)=>full && parts.some(p=>p.contains(wp, pad))

	return {
		center: xyz,
		maxSize: cube.maxSize,
		preventsTreeAt: (wp: XY, pad: number)=>false,
		collidesWith: contains,
		contains: contains,
		draw: (c: Config)=>full && parts.forEach(p=>p.draw(c)),
		consume: ()=>full = false
	}
}

export function RailFence(a: number[]): Primitive[] {
	const parts: Primitive[] = []
	const post = (x1: number, y1: number, a: number)=>parts.push(Cube(XYZ(x1, y1, 0), LWH(.2, .2, 1.2), a, false))

	for (let i = 0; i < a.length - 2; i += 2) segment(XY(a[i], -a[i+1]-1), XY(a[i+2], -a[i + 3]-1))

	function segment(p1: XY, p2: XY) {
		const ra = XYsToRA(p1, p2)
		const spans = Math.ceil(ra.r / 3)
		const dx = (p2.x - p1.x) / spans
		const dy = (p2.y - p1.y) / spans

		for (let i = 0; i < spans; i++) {
			const x1 = p1.x + dx * i
			const y1 = p1.y + dy * i
			const x2 = x1 + dx
			const y2 = y1 + dy
			post(x1, y1, ra.a)
			parts.push(Cube(XYZ((x1+x2)/2, (y1+y2)/2, 0.7), LWH(ra.r/spans/2, 0.1, 0.1), ra.a)) // rail
		}
		post(p2.x, p2.y, ra.a)
	}

	return parts
}

export function IronFence(a: number[]): Primitive[] {
	const parts: Primitive[] = []
	const post = (xy: XY, a: number)=>parts.push(...[
		Cube(XYZ(xy.x, xy.y), LWH(1, 1, 2), a),
		Cube(XYZ(xy.x, xy.y), LWH(.8, .8, 8), a, false),
		Cube(XYZ(xy.x, xy.y, 8), LWH(1, 1, 1), a, false)
	])
	const vBar = (xy: XY, a: number)=>parts.push(Cube(XYZ(xy.x, xy.y), LWH(.1, .1, 9), a, false))
	const hBar = (p1: XY, p2: XY, h: number, ra: RA)=>
		parts.push(Cube(XYZ((p1.x+p2.x)/2, (p1.y+p2.y)/2, h), LWH(ra.r/2, .1, .1), ra.a))

	for (let i = 0; i < a.length - 2; i += 2) segment(XY(a[i], -a[i+1]), XY(a[i+2], -a[i + 3]))

	function segment(p1: XY, p2: XY) {
		const ra = XYsToRA(p1, p2)
		post(p1, ra.a)
		post(p2, ra.a)
		for (let i = 1.5; i < ra.r - 1.5; i++) vBar(XYPlusXY(p1, RAToXYZ(RA(i, ra.a))), ra.a)
		hBar(p1, p2, 2, ra)
		hBar(p1, p2, 7, ra)
	}

	return parts
}

export function TreeFence(a: number[], avoid: Primitive[]): Primitive[] {
	const maxGap = 0.9
	const randomR = ()=>Math.random() / 2 + 0.3
	const randomH = ()=>Math.random() < 0.15 ? 1 : 30
	const trees: Primitive[] = []

	for (let i = 0; i < a.length - 2; i += 2) segment(XY(a[i], -a[i+1]), XY(a[i+2], -a[i + 3]))

	function segment(p1: XY, p2: XY) {

		// endpoint trees
		let r1 = randomR()
		let r2 = randomR()
		trees.push(Cylinder(XYZ(p1.x, p1.y, 0), r1, randomH()))
		trees.push(Cylinder(XYZ(p2.x, p2.y, 0), r2, randomH()))

		for (let i = 0, p = p1;; i++) { // create a tree near p1 between p1 and p2
			const d = distance(p2.x-p.x, p2.y-p.y)-r1-r2
			if (d < maxGap) break
			const angle = Math.atan2(p2.y-p.y, p2.x-p.x)
			const r = Math.min(randomR(), d/2)
			const gap = maxGap - Math.random() * maxGap
			const ra = RA(r1 + gap + r, angle + Math.random() * 1.6-.8)
			p = XYPlusXY(p, RAToXYZ(ra))
			const xyz3 = XYZ(p.x, p.y, 0)
			if (!avoid.some(p=>p.preventsTreeAt(xyz3, r))) trees.push(Cylinder(xyz3, r, randomH()))

			// add a random tree at a right angle
			const xy = XYPlusXY(p, RAToXYZ(RA(2 + Math.random() * 2, ra.a + Math.PI / 2 * (i % 2 ? 1 : -1))))
			const xyz = XYZ(xy.x, xy.y, 0)
			const r4 = randomR()-.1
			if (!avoid.some(p=>p.preventsTreeAt(xyz, 43))) trees.push(Cylinder(xyz, 43, randomH()))

			r1 = r
		}
	}

	return trees
}

const playerWPs = [
	XY(-0.113, 0.106),
	XY(-0.113, 0.106), XY(-0.097, 0.038), XY(0.002, 0.04),
	XY(0.103, 0.041), XY(0.098, 0.113), XY(0.116, 0.131),
	XY(0.141, 0.158), XY(0.226, 0.129), XY(0.227, 0.25),
	XY(0.228, 0.316), XY(0.087, 0.361), XY(-0.022, 0.354),
	XY(-0.116, 0.354), XY(-0.269, 0.319), XY(-0.269, 0.183),
	XY(-0.271, 0.013), XY(-0.2, -0.082), XY(-0.15, -0.08),
	XY(-0.097, -0.081), XY(-0.085, -0.033), XY(-0.097, -0.003),
	XY(-0.156, 0.146), XY(-0.111, 0.106), XY(-0.111, 0.106)
]

export function Player(): Primitive {
	return {
		center: null,
		maxSize: null,
		preventsTreeAt: (wp: XY, pad: number)=>false,
		collidesWith: (wp: XY, pad: number)=>false,
		contains: (wp: XY, pad: number)=>false,
		draw: (c: Config)=>{
			const playerXYZ = XYZ(c.playerXY.x, c.playerXY.y)
			const wps = playerWPs.map(wp=>XYZPlusXYZ(playerXYZ,
				RAToXYZ(RA(distance(wp.x, wp.y)*2, Math.atan2(wp.y, wp.x) + c.playerAngle - 1.5*Math.PI))))
			const cps = c.transform.xyzs(wps)
			c.lib.beginPath()
			c.lib.moveTo(cps[0].x, cps[0].y)
			for (let i = 1; i < cps.length; i += 3) {
				c.lib.bezierCurveTo(cps[i].x, cps[i].y, cps[i+1].x, cps[i+1].y, cps[i+2].x, cps[i+2].y)
			}
			c.lib.fillStyle = "black"
			c.lib.globalCompositeOperation = "source-over"
			c.lib.fill()
		}
	}
}

export function Enemy(xy: XYZ): NPC {
	const body = Cylinder(xy, 0.7, 30, "#000")

	let behavior: (c: Config, avoid: Primitive[])=>void
	let moveToPlayer = false
	let moving = false
	let moveDur = 0
	let moveDir = 0
	let nextMoveTime = 0
	let moveStartTime = 0
	let fear = 0
	let fearThreshold = 5

	// support function
	function inPlayerFOV(c: Config): boolean {
		const dxy = XYMinusXY(xy, c.playerXY)
		const a = Math.atan2(dxy.y, dxy.x)
		const da = Math.abs(Math.PI - Math.abs(Math.abs(c.playerAngle - a) - Math.PI))
		return da < 1.2
	}

	// support function
	function move(dxy: XY, avoid: Primitive[]) {
		const ra = XYToRA(dxy)
		const newXY = moveWithDeflection(xy, ra.a, ra.r, 0.7, avoid)
		xy.x = newXY.x
		xy.y = newXY.y
	}

	// behavior
	function idle(c: Config, avoid: Primitive[]): void {
		const d = XYDistance(XYMinusXY(c.playerXY, xy))
		if (d < 20) behavior = follow
	}

	// behavior
	function flee(c: Config, avoid: Primitive[]): void {
		if (fear > 0) fear -= .01
		else behavior = idle

		const ra = XYToRA(XYMinusXY(c.playerXY, xy))
		move(RAToXYZ(RA(0.2, ra.a + Math.PI)), avoid)
	}

	// behavior
	function follow(c: Config, avoid: Primitive[]): void {
		const d = XYDistance(XYMinusXY(c.playerXY, xy))
		const ra = XYToRA(XYMinusXY(c.playerXY, xy))
		const dxy = XY(0, 0)
		const timer = c.now / 1000

		// update moveToPlayer
		let adjSpeed = (3 + (.75 - c.lanternIntensity) * 2) / 100
		const inStrikingRange = d < 6 - c.lanternIntensity * 3

		if (d < 8 * c.lanternIntensity) {
			fear += 1/60
			if (!inStrikingRange) {
				const xyz = RAToXYZ(RA(1 * adjSpeed * (1 + fear / fearThreshold), ra.a + Math.PI))
				dxy.x += xyz.x
				dxy.y += xyz.y
			}
		} else if (fear > 0) fear -= 1/120

		if (fear > fearThreshold) {
			behavior = flee
			moveToPlayer = false
			moving = false
		}

		if (d < 9 * c.lanternIntensity && !inStrikingRange) moveToPlayer = false
		if (d > 10 * c.lanternIntensity) moveToPlayer = true
		if (d > 36) moveToPlayer = false
		if (inStrikingRange) moveToPlayer = true
		if (c.lanternIntensity < 0.2) moveToPlayer = true

		if (moveToPlayer) {
			if (timer > nextMoveTime) {
				moving = true
				moveStartTime = timer
				moveDur = Math.random() * 2.5 + .5
				nextMoveTime = timer + moveDur + (c.lanternIntensity + .5) * (inPlayerFOV ?
					Math.pow(Math.random() * 32, 0.5) : Math.pow(Math.random(), 2))
				moveDir = (inPlayerFOV ? Math.random() * 4 - 2 : Math.random() * 2.8 - 1.4)

				if (d > 20 && d < 36) {
					nextMoveTime = timer + moveDur
					moveDir = Math.random() - .5
				}
			}

			if (moving) {
				if (timer < moveStartTime + moveDur) {
					const curve = .5 - Math.abs((timer - moveStartTime) / moveDur - .5)
					const xy = RAToXYZ(RA(curve * adjSpeed * 12, moveDir + ra.a))
					dxy.x += xy.x
					dxy.y += xy.y
				}
			}
		}

		move(dxy, avoid)
	}

	behavior = idle

	const contains = (wp: XY, pad: number)=>body.contains(wp, pad)

	return {
		center: xy,
		maxSize: body.maxSize,
		preventsTreeAt: (wp: XY, pad: number)=>contains(wp, pad),
		collidesWith: (wp: XY, pad: number)=>false,
		contains: contains,
		draw: (c: Config)=>{
			body.draw(c)

			// eye color
			const ra = XYToRA(XYMinusXY(c.playerXY, xy))
			const d = ra.r
			const normalizedRed = c.lanternIntensity > .2 ? ((20 - d) / 25 * c.lanternIntensity + .2) : ((5 - d) / 8)
			const red = Math.round(Math.max(Math.min(normalizedRed, 1), 0) * 255)

			// draw the eyes
			const wp1 = XYZPlusXYZ(xy, RAToXYZ(RA(0.40, ra.a + 1)))
			const wp2 = XYZPlusXYZ(xy, RAToXYZ(RA(0.40, ra.a - 1)))
			const cp1 = c.transform.xyz(wp1)
			const cp2 = c.transform.xyz(wp2)
			c.lib.beginPath()
			c.lib.moveTo(cp1.x, cp1.y)
			c.lib.arc(cp1.x, cp1.y, 2.5, 0, Math.PI * 2)	// eyeball
			c.lib.moveTo(cp2.x, cp2.y)
			c.lib.arc(cp2.x, cp2.y, 2.5, 0, Math.PI * 2)	// eyeball
			c.lib.globalCompositeOperation = "source-over"
			c.lib.fillStyle = "rgba(" + red + ",0,0,1)"
			c.lib.fill()
		},
		update: (c: Config, avoid: Primitive[])=>behavior(c, avoid)
	}
}

export function Spirit(xy: XYZ): NPC {
	const light = Light(xy, 15, 1, [122, 194, 255])
	const attachDistance = 6
    const speed = 1
    const targetDistance = 4
    const lightBaseIntensity = 1.6
	const size = .3
	const centers: XYZ[] = []
	const lefts: XYZ[] = []
	const rights: XYZ[] = []

    let following = false
    let moveTowardsTarget = false

	function sine(t: number) {
        return (.578 - (Math.sin(t) + Math.sin(2.2*t+5.52) + Math.sin(2.9*t+0.93) + Math.sin(4.6*t+8.94))) / 4
    }

	function behavior(c: Config, _: Primitive[]): void {
		const d = XYDistance(XYMinusXY(c.playerXY, xy))

        // start following
        if (!following && d < attachDistance) following = true

        // decide when to move
        if (following && d > targetDistance) moveTowardsTarget = true

        // float around a little
        const t = c.now / 1000 * 0.8
        if (following) {
			xy.x += sine(t) / 20
			xy.y += sine(t + 16) / 20
		}

        //move towards target
        const adjSpeed = speed / 50 + Math.max(Math.min(d - targetDistance, 15), 0) / 20;

        if (following && moveTowardsTarget) {
            if (c.lanternIntensity <= 0.1) {
				moveTowardsTarget = false
				following = false
				return
			} else if (d < targetDistance) {
				moveTowardsTarget = false
			} else {
				const dxy = RAToXYZ(RA(adjSpeed, Math.atan2(c.playerXY.y - xy.y, c.playerXY.x - xy.x)))
				xy.x += dxy.x
				xy.y += dxy.y
			}
        }
	}

	return {
		center: xy,
		maxSize: size,
		preventsTreeAt: (wp: XY, pad: number)=>false,
		collidesWith: (wp: XY, pad: number)=>false,
		contains: (wp: XY, pad: number)=>false,
		draw: (c: Config)=>{
			light.draw(c)
			centers.push(XYZ(xy.x, xy.y))
			if (centers.length > 30) {
				centers.splice(0, 1) // remove oldest

				// determine left and right points of tangency
				const oldest = centers[0]
				const middle = centers[14]
				const ra = XYsToRA(middle, xy)
				const leftXY = XYZPlusXYZ(xy, RAToXYZ(RA(size, ra.a + Math.PI/2)))
				const rightXY = XYZPlusXYZ(xy, RAToXYZ(RA(size, ra.a - Math.PI/2)))
				lefts.push(leftXY)
				rights.push(rightXY)
				if (lefts.length > 30) {
					lefts.splice(0, 1)
					rights.splice(0, 1)

					const middleLeft = lefts[14]
					const middleRight = rights[14]

					const cps = c.transform.xyzs([xy, middle, oldest, leftXY, rightXY, middleLeft, middleRight])

					c.lib.beginPath()
					c.lib.moveTo(cps[4].x, cps[4].y)
					c.lib.bezierCurveTo(cps[6].x, cps[6].y, cps[2].x, cps[2].y, cps[2].x, cps[2].y)
					c.lib.bezierCurveTo(cps[5].x, cps[5].y, cps[3].x, cps[3].y, cps[3].x, cps[3].y)

					c.lib.globalCompositeOperation = "source-over"
					c.lib.fillStyle = "#fff"
					c.lib.fill()

					c.lib.beginPath()
					c.lib.arc(cps[0].x, cps[0].y, XYDistance(XYMinusXY(cps[0], cps[3])), 0, Math.PI * 2)
					c.lib.fill()
				}
			}
		},
		update: (c: Config, avoid: Primitive[])=>behavior(c, avoid)
	}
}

function corners(xyz: XYZ, lw: LW, a: number): XYZ[] {
	const ra = LWToRA(lw)
	const ras = [RA(ra.r, ra.a+a), RA(ra.r, Math.PI-ra.a+a), RA(ra.r, Math.PI+ra.a+a), RA(ra.r, -ra.a+a)]
	const result = ras.map(ra=>XYZPlusXYZ(xyz, RAToXYZ(ra)))
	return result
}

function moveTo(xy: XY, c: Config) {
	c.lib.moveTo(xy.x, xy.y)
}

function lineTo(xy: XY, c: Config) {
	c.lib.lineTo(xy.x, xy.y)
}

function linesTo(xys: XY[], c: Config) {
	xys.forEach(xy=>lineTo(xy, c))
}

// rotate back to zero and check using simple bounds
function rectangleContains(xyz: XYZ, lw: LW, a: number, wp: XY, pad: number) {
	const dp = XYMinusXY(wp, xyz)
	const p = XYPlusXY(RAToXYZ(RA(XYDistance(dp), Math.atan2(dp.y, dp.x) - a)), xyz)
	return p.x >= xyz.x-lw.l-pad && p.x <= xyz.x+lw.l+pad && p.y >= xyz.y-lw.w-pad && p.y <= xyz.y+lw.w+pad
}

export function Rain(c: Config): XYZ {
	const r = c.worldViewRadius / 1
	const x = c.playerXY.x + (Math.random() * 2 - 1) * r
	const y = c.playerXY.y + (Math.random() * 2 - 1) * r
	const z = Math.random() * (c.cameraXYZ.z - 1)
	return XYZ(x, y, z)
}

export function drawRain(p: XYZ, c: Config) {
	const r = c.worldViewRadius / 1

	// start a new drop when the drop has hit
	if (p.z < 1) {
		p.x = c.playerXY.x + (Math.random() * 2 - 1) * r
		p.y = c.playerXY.y + (Math.random() * 2 - 1) * r
		p.z = c.cameraXYZ.z * .99 - Math.random()
	}
	const d = distance(c.playerXY.x - p.x, c.playerXY.y - p.y, p.z)
	const light = Math.min(Math.max(Math.round((1 - d / r) * 6), 0), 6)
	const p1 = c.transform.xyz(p)
	p.z -= 2
	const p2 = c.transform.xyz(p)
	p.z -= 2

	c.lib.beginPath()
	c.lib.moveTo(p1.x, p1.y)
	c.lib.lineTo(p2.x, p2.y)
	c.lib.strokeStyle = "#" + light + light + light
	c.lib.stroke()
}
