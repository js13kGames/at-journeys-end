import { distance, Config, XYZ, XY, LWH, LW, RA, LWToRA, XYsToRA, RAToXYZ, XYZPlusXYZ, XYPlusXY, XYMinusXY, XYDistance } from './geometry';

export interface Primitive {
	center: XYZ
	isTreeless: boolean
	isBarrier: boolean
	contains(wp: XY, pad: number): boolean
	draw(c: Config): void
}

export interface Light extends Primitive {
	setRadius(r: number): void
	setIntensity(i: number): void
}

// cuboid
export function Box(xyz: XYZ, lwh: LWH, a: number, color?: string): Primitive {
	const bottomCorners = corners(xyz, lwh, a)
	const topCorners = bottomCorners.map(p=>XYZ(p.x, p.y, xyz.z + lwh.h))
	return {
		center: xyz,
		isTreeless: true,
		isBarrier: true,
		contains: (wp: XY, pad: number)=>rectangleContains(xyz, lwh, a, wp, pad),
		draw: (c: Config)=>{
			if (XYDistance(XYMinusXY(xyz, c.cameraXYZ)) > c.worldViewRadius) return

			// transform all 8 corners
			const xys = c.transform.xyzs([...bottomCorners, ...topCorners])

			// draw the four vertical sides
			c.lib.fillStyle = color ? color : "black"
			c.lib.globalCompositeOperation = color ? "overlay" : "source-over"
			for (let i = 0; i < 4; i++) {
				c.lib.beginPath()
				const j = (i + 1) % 4
				moveTo(xys[i], c)
				linesTo([xys[i+4], xys[j+4], xys[j], xys[i]], c)
				c.lib.fill()
			}

			// draw the top
			c.lib.beginPath()
			moveTo(xys[4], c)
			linesTo([xys[5], xys[6], xys[7], xys[4]], c)
			c.lib.globalCompositeOperation = color ? "multiply" : "source-over"
			c.lib.fill()
		}
	}
}

// cylinder
export function Can(xyz: XYZ, r: number, h: number, color?: string): Primitive {
	//h = 0.1
	return {
		center: xyz,
		isTreeless: true,
		isBarrier: true,
		contains: (wp: XY, pad: number)=>{
			const min = r + pad + 0.25
			const rSquared = min * min
			const dp = XYMinusXY(wp, xyz)
			const dSquared = dp.x * dp.x + dp.y * dp.y
			return dSquared < rSquared
		},
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

			// draw
			c.lib.fillStyle = color ? color : "black"
			c.lib.globalCompositeOperation = color ? "overlay" : "source-over"
			c.lib.beginPath()
			moveTo(bxys[0], c)
			linesTo([txys[0], txys[1]], c)
			c.lib.arcTo(bxys[3].x, bxys[3].y, txys[0].x, txys[0].y, XYDistance(XYMinusXY(bxys[0], bxys[2])))
			c.lib.fill()
			c.lib.beginPath()
			c.lib.arc(txys[2].x, txys[2].y, XYDistance(XYMinusXY(txys[0], txys[2])), 0, 2 * Math.PI)
			c.lib.fill()
		}
	}
}

// rectangle on the ground, z is ignored, lw is from center to edge (so half)
export function Rug(xyz: XYZ, lw: LW, a: number, color: string, operation: string, barrier: boolean, treeless: boolean): Primitive {
	return {
		center: xyz,
		isTreeless: treeless,
		isBarrier: barrier,
		contains: (wp: XY, pad: number)=>rectangleContains(xyz, lw, a, wp, pad),
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
	const parts: Primitive[] = [Rug(XYZ(xyz.x, xyz.y, 0), lw, a, "#6d6d6d", "multiply", false, true)] // road
	const lineLength = 1.0
	const lineWidth = 0.15
	const ra = RA(lw.l, a)
	const dxyz = RAToXYZ(ra)
	const p1 = XYMinusXY(xyz, dxyz)
	const p2 = XYPlusXY(xyz, dxyz)

	// add stripes
	for (let i = lineLength; i < lw.l - lineLength; i += 4 * lineLength) {
		const p = XY(p1.x + (p2.x - p1.x) * i / lw.l, p1.y + (p2.y - p1.y) * i / lw.l)
		parts.push(Rug(XYZ(p.x, p.y, 0), LW(lineLength, lineWidth), a, "#fff", "overlay", false, false)) // stripe
	}

	return {
		center: xyz,
		isTreeless: true,
		isBarrier: false,
		contains: (wp: XY, pad: number)=>parts.some(p=>p.contains(wp, pad)),
		draw: (c: Config)=>parts.forEach(p=>p.draw(c))
	}
}

export function Light(xyz: XYZ, wr: number, b: number, flicker=false): Light {
	return {
		center: xyz,
		isTreeless: false,
		isBarrier: false,
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
			const baseIntensity = b, flickerAmount = flicker ? 0.1 : 0
			const intensity = baseIntensity + flickerAmount * (0.578 - (Math.sin(c.time) +
				Math.sin(2.2 * c.time + 5.52) + Math.sin(2.9 * c.time + 0.93) +
				Math.sin(4.6 * c.time + 8.94))) / 4
			const steps = 20; // number of gradient steps
			const lightScale = 15; // controls how quickly the light falls off
			for (var i = 1; i < steps + 1; i++) {
				let x = lightScale * Math.pow(i / steps, 2) + 1
				let alpha = intensity / (x * x)
				if (alpha < 0.01) alpha = 0
				g.addColorStop((x - 1) / lightScale, `rgba(255,255,255,${alpha})`)
			}
			c.lib.fillStyle = g
			c.lib.globalCompositeOperation = "source-over"
			c.lib.fillRect(lightXY.x - cr, lightXY.y - cr, cr * 2, cr * 2)
		},
		setRadius: (r: number)=>wr = r,
		setIntensity: (i: number)=>b = i
	}
}

export function Fence(a: number[]): Primitive {
	const parts: Primitive[] = []

	for (let i = 0; i < a.length - 2; i += 2) {
		const p1 = XY(a[i], -a[i+1])
		const p2 = XY(a[i+2], -a[i + 3])
		const ra = XYsToRA(p1, p2)
		const spans = Math.ceil(ra.r / 3)
		const dx = (p2.x - p1.x) / spans
		const dy = (p2.y - p1.y) / spans
		for (let i = 0; i <= spans; i++) parts.push(Box(XYZ(p1.x + dx * i, p1.y + dy * i, ), LWH(.2, .2, 1.2), ra.a))
		parts.push(Box(XYZ((p1.x+p2.x)/2, (p1.y+p2.y)/2, 0.7), LWH(ra.r/2, 0.1, 0.1), ra.a))
	}

	return {
		center: null,
		isTreeless: true,
		isBarrier: true,
		contains: (wp: XY, pad: number)=>parts.some(p=>p.contains(wp, pad)),
		draw: (c: Config)=>parts.forEach(p=>p.draw(c))
	}
}

export function TreeFence(a: number[]): Primitive {
	const maxGap = 0.9
	const randomR = ()=>Math.random() / 2 + 0.3
	const randomH = ()=>Math.random() < 0.15 ? 1 : 30
	const trees: Primitive[] = []

	for (let i = 0; i < a.length - 2; i += 2) segment(XY(a[i], -a[i+1]), XY(a[i+2], -a[i + 3]))

	function segment(p1: XY, p2: XY) {

		// endpoint trees
		let r1 = randomR()
		let r2 = randomR()
		trees.push(Can(XYZ(p1.x, p1.y, 0), r1, randomH()))
		trees.push(Can(XYZ(p2.x, p2.y, 0), r2, randomH()))

		for (let i = 0, p = p1;; i++) { // create a tree near p1 between p1 and p2
			const d = distance(p2.x-p.x, p2.y-p.y)-r1-r2
			if (d < maxGap) break
			const angle = Math.atan2(p2.y-p.y, p2.x-p.x)
			const r = Math.min(randomR(), d/2)
			const gap = maxGap - Math.random() * maxGap
			const ra = RA(r1 + gap + r, angle + Math.random() * 2.4-1.2)
			p = XYPlusXY(p, RAToXYZ(ra))
			r1 = r
			trees.push(Can(XYZ(p.x, p.y, 0), r, randomH()))

			// add a random tree at a right angle
			const xy = XYPlusXY(p, RAToXYZ(RA(2 + Math.random() * 2, ra.a + Math.PI / 2 * (i % 2 ? 1 : -1))))
			trees.push(Can(XYZ(xy.x, xy.y, 0), randomR()-.1, randomH()))
		}
	}

	return {
		center: null,
		isTreeless: true,	// heh heh
		isBarrier: true,
		contains: (wp: XY, pad: number)=>trees.some(t=>t.contains(wp, pad)),
		draw: (c: Config)=>trees.forEach(t=>t.draw(c))
	}
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
		isTreeless: false,
		isBarrier: false,
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


