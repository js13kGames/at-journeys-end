import { distance, Config, XYZ, XY, LWH, LW, RA, LWToRA, RAToXYZ, XYZPlusXYZ, XYPlusXY, XYMinusXY, XYDistance } from './geometry';

export interface Primitive {
	contains(wp: XY, pad: number): void
	draw(c: Config): void
}

// cuboid
export function Box(xyz: XYZ, lwh: LWH, a: number): Primitive {
	const bottomCorners = corners(xyz, lwh, a)
	const topCorners = bottomCorners.map(p=>XYZ(p.x, p.y, xyz.z + lwh.h))
	return {
		contains: (wp: XY, pad: number)=>rectangleContains(xyz, lwh, a, wp, pad),
		draw: (c: Config)=>{
			if (XYDistance(XYMinusXY(xyz, c.cameraXYZ)) > c.worldViewRadius) return

			// transform all 8 corners
			const xys = c.transform.xyzs([...bottomCorners, ...topCorners])

			// draw the four vertical sides
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
			c.lib.fill()
		}
	}
}

// cylinder
export function Can(xyz: XYZ, r: number, h: number): Primitive {
	return {
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

// rectangle on the ground, z is ignored
export function Rug(xyz: XYZ, lw: LW, a: number): Primitive {
	return {
		contains: (wp: XY, pad: number)=>rectangleContains(xyz, lw, a, wp, pad),
		draw: (c: Config)=>{
			if (XYDistance(XYMinusXY(xyz, c.playerXY)) > c.worldViewRadius + Math.max(lw.l, lw.w)) return
			const wps = corners(xyz, lw, a)
			const cps = c.transform.xyzs(wps)
			c.lib.beginPath()
			moveTo(cps[0], c)
			linesTo([cps[1], cps[2], cps[3], cps[0]], c)
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

	/*
	//const trees = generateTrees(1000, 6)
	
	// divide the map into zones and put one tree in each zone
	function generateTrees(mapSize: number, zoneSize: number): Tree[] {
		const trees = [] as Tree[]
		for (let zx = 0; zx * zoneSize < mapSize; zx++) {
			for (let zy = 0; zy * zoneSize < mapSize; zy++) {
				const r = Math.random() / 2 + 0.3
				const tx = zx * zoneSize + Math.random() * (zoneSize - r * 2) + r
				const ty = zy * zoneSize + Math.random() * (zoneSize - r * 2) + r
				trees.push(Tree(Point(tx, ty), r))
			}
		}
		return trees
	}
	*/

