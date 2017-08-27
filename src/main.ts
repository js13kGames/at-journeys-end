//	The projection is Orthographic; all rays are perpendicular to the view plane.
//	World Coordinates (W) are meters in page coordinates (to match canvas):
//	- top left is (0,0) and bottom right is (MaxX, MaxY),
//	- angles are measured clockwise: 0=>right, PI/2=>down, PI=>left, 3PI/2=>up.
// The canvas is a camera of size (CW, CH) in pixels that:
//	- always looks straight down at a point in W (CX, CY),
//	- is rotated by CA in radians,
//	- views an area of diameter CD.

interface Point {
	x: number
	y: number
}
const Point = (x: number, y: number)=>({ x: x, y: y })

interface Size {
	w: number
	h: number
}
const Size = (w: number, h: number)=>({ w: w, h: h })

interface Tree {
	center: Point
	radius: number
}
const Tree = (center: Point, radius: number)=>({ center: center, radius: radius })

// map world coordinates onto canvas
interface Transform {
	point: (wp: Point)=>Point
	distance: (d: number)=>number
}

function getTransform(player: Point, wViewRadius: number, angle: number, canvasSize: Size): Transform {

	// precalculate canvas center, canvas radius, and scale
	const cx = canvasSize.w / 2
	const cy = canvasSize.h / 2
	const cr = Math.sqrt(cx * cx + cy * cy)
	const scale = cr / wViewRadius

	return {
		point: (p: Point)=>{
			const dx = p.x - player.x
			const dy = p.y - player.y
			const a = Math.atan2(dy, dx) - angle
			const d = Math.sqrt(dx * dx + dy * dy) * scale
			return Point(cx + d * Math.cos(a), cy + d * Math.sin(a))
		},
		distance: (d: number)=>d * scale
	}
}

function main() {
	const body = document.body.style
	body.margin = "0px"
	body.overflow = "hidden"

	const canvas = <HTMLCanvasElement>document.createElement("canvas");
	document.body.appendChild(canvas);
	const c = canvas.getContext('2d')

	// canvas dimensions
	let canvasSize: Size
	let canvasCenter: Point

	// view dimensions
	let worldViewRadius = 50

	// player position and rotation
	const upAngle = 3 * Math.PI / 2
	let direction = upAngle
	let playerXY = Point(100, 100)

	function resize() {
		setTimeout(()=>{
			canvasSize = Size(window.innerWidth, window.innerHeight)
			canvas.style.width = canvasSize.w + "px"
			canvas.style.height = canvasSize.h + "px"
			canvas.width = canvasSize.w
			canvas.height = canvasSize.h
			canvasCenter = Point(Math.round(canvasSize.w / 2), Math.round(canvasSize.h / 2))
			draw()
		}, 10)
	}

	function action(key: Number) {
		switch (key) {
			case 65: direction -= 0.1; break;	// A left
			case 68: direction += 0.1; break;	// D right
			case 87: playerXY = move(playerXY, direction, 1); break;	// W up
			case 83: playerXY = move(playerXY, direction + Math.PI, 1); break;	// S down
			case 73: worldViewRadius--; break;	// I zoom in
			case 75: worldViewRadius++; break;	// I zoom out
			default: console.log(key)
		}
	}

	function move(from: Point, direction: number, distance: number): Point {
		return Point(from.x + Math.cos(direction) * distance, from.y + Math.sin(direction) * distance)
	}

	window.addEventListener("resize", resize)
	window.addEventListener("keydown", e=>action(e.keyCode))
	resize()

	const trees = [Tree(Point(110, 120), 0.5)]

	function draw() {

		// clear the canvas
		c.fillStyle = "rgba(128,128,128,1)"
		c.fillRect(0, 0, canvasSize.w, canvasSize.h)

		// draw the center
		c.strokeStyle = "blue"
		c.strokeRect(canvasCenter.x - 5, canvasCenter.y - 5, 10, 10)

		const transform = getTransform(playerXY, worldViewRadius, direction - upAngle, canvasSize)
		trees.forEach(tree=>{
			const vCenter = transform.point(tree.center)
			const vRadius = transform.distance(tree.radius)
			c.beginPath()
			c.fillStyle = "green"
			c.arc(vCenter.x, vCenter.y, vRadius, 0, Math.PI * 2)
			c.fill()
		})

		// refactor the game loop
		window.requestAnimationFrame(draw)
	}
}

main()
