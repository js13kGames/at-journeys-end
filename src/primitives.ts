interface Tree {
	center: Point
	radius: number
}

function Tree(center: Point, radius: number) {
	return { center: center, radius: radius }
}

function drawTree(tree: Tree, config: Config) {
	const h = distance(tree.center.x - config.playerXY.x, tree.center.y - config.playerXY.y) // hypotenuse
	if (h > config.worldViewRadius) return

	const angleBetweenCenterAndTangent = Math.asin(tree.radius / h)
	const angleToTree = Math.atan2(tree.center.y - config.playerXY.y, tree.center.x - config.playerXY.x)
	const a1 = angleToTree - angleBetweenCenterAndTangent
	const a2 = angleToTree + angleBetweenCenterAndTangent

	const p1 = config.transform.point(Point(config.playerXY.x + Math.cos(a1) * h,
		config.playerXY.y + Math.sin(a1) * h))
	const p2 = config.transform.point(Point(config.playerXY.x + Math.cos(a1) * config.worldViewRadius,
		config.playerXY.y + Math.sin(a1) * config.worldViewRadius))
	const p3 = config.transform.point(Point(config.playerXY.x + Math.cos(a2) * config.worldViewRadius,
			config.playerXY.y + Math.sin(a2) * config.worldViewRadius))
	// p4 isn't needed because of how arcTo() works
	const pw = config.transform.point(config.playerXY) // player in WC

	config.context2d.moveTo(p1.x, p1.y)
	config.context2d.lineTo(p2.x, p2.y)
	config.context2d.lineTo(p3.x, p3.y)
	config.context2d.arcTo(pw.x, pw.y, p1.x, p1.y, config.transform.distance(tree.radius)) // tricky
}

interface Block {
	center: Point
	size: Size
	angle: number
	height?: number
	z?: number
}

function Block(center: Point, size: Size, angle: number, height?: number, z?: number) {
	return { center: center, size: size, angle: angle, height: height, z: z }
}

function drawBlock(block: Block, config: Config) {
	if (distance(block.center.x - config.playerXY.x, block.center.y - config.playerXY.y) > config.worldViewRadius) return

	const h = distance(block.size.w, block.size.h) / 2
	const a = Math.atan2(block.size.h, block.size.w)
	const a1 = a + block.angle
	const a2 = Math.PI - a + block.angle
	const a3 = Math.PI + a + block.angle
	const a4 = -a + block.angle

	// determine corners in WC
	const corners = [
		Point(block.center.x + Math.cos(a1) * h, block.center.y + Math.sin(a1) * h),
		Point(block.center.x + Math.cos(a2) * h, block.center.y + Math.sin(a2) * h),
		Point(block.center.x + Math.cos(a3) * h, block.center.y + Math.sin(a3) * h),
		Point(block.center.x + Math.cos(a4) * h, block.center.y + Math.sin(a4) * h)
	]

	// transform corners
	const cps = corners.map(p=>config.transform.point(p))

	// cast a ray through each corner
	function castRay(corner: Point) {
		const a = Math.atan2(corner.y - config.playerXY.y, corner.x - config.playerXY.x)
		const cp = config.transform.point(corner)
		const sl = shadowLength()
		const rp = config.transform.point(Point(config.playerXY.x + Math.cos(a) * sl, config.playerXY.y + Math.sin(a) * sl))
		return { a: a, cp: cp, rp: rp }

		function shadowLength() {
			const cameraHeight = 30
			if (block.height < cameraHeight) {
				const d = distance(corner.x - config.playerXY.x, corner.y - config.playerXY.y)
				const sl = d + d * block.height / (cameraHeight - block.height)
				return sl
			}
			return config.worldViewRadius
		}
	}

	// start with left side 
	const ps = corners.map(corner=>castRay(corner))
	for (let i = 0; i < 4; i++) {
		for (let j = i; j < 4; j++) {
			if (ps[i].a - ps[j].a > Math.PI) ps[j].a += Math.PI * 2
			if (ps[j].a - ps[i].a > Math.PI) ps[i].a += Math.PI * 2
		}
	}

	let first
	let min = 10
	ps.forEach((p, i)=>{
		if (p.a < min) {
			first = i
			min = p.a
		}
	})
	for (let i = 0; i < first; i++) ps.push(ps.shift())

	const center = config.transform.point(config.playerXY)

	config.context2d.beginPath()
	config.context2d.moveTo(ps[0].cp.x, ps[0].cp.y)
	config.context2d.lineTo(ps[0].rp.x, ps[0].rp.y)
	let last = ps[0]
	for (let i = 1; i < 4; i++) {
		if (ps[i].a >= last.a) {
			last = ps[i]
			config.context2d.lineTo(ps[i].rp.x, ps[i].rp.y)
		}
	}
	config.context2d.lineTo(last.cp.x, last.cp.y)
	config.context2d.fillStyle = "black"
	config.context2d.fill()

	// draw block
	config.context2d.beginPath()
	config.context2d.moveTo(cps[0].x, cps[0].y)
	config.context2d.lineTo(cps[1].x, cps[1].y)
	config.context2d.lineTo(cps[2].x, cps[2].y)
	config.context2d.lineTo(cps[3].x, cps[3].y)
	config.context2d.lineTo(cps[0].x, cps[0].y)
	config.context2d.fillStyle = "black"
	config.context2d.fill()
}

interface Plate {
	center: Point
	size: Size
	angle: number
}

function Plate(center: Point, size: Size, angle: number): Plate {
	return { center: center, size: size, angle: angle }
}

function drawPlate(plate: Plate, config: Config) {
	const hyp = distance(plate.size.w, plate.size.h) / 2
	const angle = Math.atan2(plate.size.h, plate.size.w)


	const a1 = angle + plate.angle
	const a2 = -angle + plate.angle
	const a3 = a1 + Math.PI
	const a4 = a2 + Math.PI

	const p1 = config.transform.point(Point(plate.center.x + Math.cos(a1) * hyp, plate.center.y + Math.sin(a1) * hyp))
	const p2 = config.transform.point(Point(plate.center.x + Math.cos(a2) * hyp, plate.center.y + Math.sin(a2) * hyp))
	const p3 = config.transform.point(Point(plate.center.x + Math.cos(a3) * hyp, plate.center.y + Math.sin(a3) * hyp))
	const p4 = config.transform.point(Point(plate.center.x + Math.cos(a4) * hyp, plate.center.y + Math.sin(a4) * hyp))

	config.context2d.beginPath()
	config.context2d.moveTo(p1.x, p1.y)
	config.context2d.lineTo(p2.x, p2.y)
	config.context2d.lineTo(p3.x, p3.y)
	config.context2d.lineTo(p4.x, p4.y)
	config.context2d.lineTo(p1.x, p1.y)
	config.context2d.fillStyle = "black"
	config.context2d.fill()
}
