//	The projection is Orthographic; all rays are perpendicular to the view plane.
//	World Coordinates (W) are meters in page coordinates (to match canvas):
//	- top left is (0,0) and bottom right is (MaxX, MaxY),
//	- angles are measured clockwise: 0=>right, PI/2=>down, PI=>left, 3PI/2=>up.
// The canvas is a camera of size (CW, CH) in pixels that:
//	- always looks straight down at a point in W (CX, CY),
//	- is rotated by CA in radians,
//	- views an area of diameter CD.
function Point(x, y) {
    return { x: x, y: y };
}
function Size(w, h) {
    return { w: w, h: h };
}
function distance(x, y) {
    return Math.sqrt(x * x + y * y);
}
function getTransform(config) {
    // precalculate canvas center, canvas radius, and scale
    var cx = config.canvasSize.w / 2;
    var cy = config.canvasSize.h / 2;
    var cr = distance(cx, cy);
    var scale = cr / config.worldViewRadius;
    return {
        point: function (p) {
            var dx = p.x - config.cameraXY.x;
            var dy = p.y - config.cameraXY.y;
            var a = Math.atan2(dy, dx) - config.cameraAngle + 3 * Math.PI / 2;
            var d = distance(dx, dy) * scale;
            return Point(cx + d * Math.cos(a), cy + d * Math.sin(a));
        },
        distance: function (d) { return d * scale; }
    };
}
function Tree(center, radius) {
    return { center: center, radius: radius };
}
function drawTree(tree, config) {
    var h = distance(tree.center.x - config.playerXY.x, tree.center.y - config.playerXY.y); // hypotenuse
    if (h > config.worldViewRadius)
        return;
    var angleBetweenCenterAndTangent = Math.asin(tree.radius / h);
    var angleToTree = Math.atan2(tree.center.y - config.playerXY.y, tree.center.x - config.playerXY.x);
    var a1 = angleToTree - angleBetweenCenterAndTangent;
    var a2 = angleToTree + angleBetweenCenterAndTangent;
    var p1 = config.transform.point(Point(config.playerXY.x + Math.cos(a1) * h, config.playerXY.y + Math.sin(a1) * h));
    var p2 = config.transform.point(Point(config.playerXY.x + Math.cos(a1) * config.worldViewRadius, config.playerXY.y + Math.sin(a1) * config.worldViewRadius));
    var p3 = config.transform.point(Point(config.playerXY.x + Math.cos(a2) * config.worldViewRadius, config.playerXY.y + Math.sin(a2) * config.worldViewRadius));
    // p4 isn't needed because of how arcTo() works
    var pw = config.transform.point(config.playerXY); // player in WC
    config.context2d.moveTo(p1.x, p1.y);
    config.context2d.lineTo(p2.x, p2.y);
    config.context2d.lineTo(p3.x, p3.y);
    config.context2d.arcTo(pw.x, pw.y, p1.x, p1.y, config.transform.distance(tree.radius)); // tricky
}
function Block(center, size, angle, height) {
    return { center: center, size: size, angle: angle, height: height };
}
function drawBlock(block, config) {
    if (distance(block.center.x - config.playerXY.x, block.center.y - config.playerXY.y) > config.worldViewRadius)
        return;
    var h = distance(block.size.w, block.size.h) / 2;
    var a = Math.atan2(block.size.h, block.size.w);
    var a1 = a + block.angle;
    var a2 = Math.PI - a + block.angle;
    var a3 = Math.PI + a + block.angle;
    var a4 = -a + block.angle;
    // determine corners in WC
    var corners = [
        Point(block.center.x + Math.cos(a1) * h, block.center.y + Math.sin(a1) * h),
        Point(block.center.x + Math.cos(a2) * h, block.center.y + Math.sin(a2) * h),
        Point(block.center.x + Math.cos(a3) * h, block.center.y + Math.sin(a3) * h),
        Point(block.center.x + Math.cos(a4) * h, block.center.y + Math.sin(a4) * h)
    ];
    // transform corners
    var cps = corners.map(function (p) { return config.transform.point(p); });
    // cast a ray through each corner
    function castRay(corner) {
        var a = Math.atan2(corner.y - config.playerXY.y, corner.x - config.playerXY.x);
        var cp = config.transform.point(corner);
        var sl = shadowLength();
        var rp = config.transform.point(Point(config.playerXY.x + Math.cos(a) * sl, config.playerXY.y + Math.sin(a) * sl));
        return { a: a, cp: cp, rp: rp };
        function shadowLength() {
            if (block.height < config.lightHeight) {
                var d = distance(corner.x - config.playerXY.x, corner.y - config.playerXY.y);
                var sl_1 = d + d * block.height / (config.lightHeight - block.height);
                return sl_1;
            }
            return config.worldViewRadius;
        }
    }
    // start with left side 
    var ps = corners.map(function (corner) { return castRay(corner); });
    for (var i = 0; i < 4; i++) {
        for (var j = i; j < 4; j++) {
            if (ps[i].a - ps[j].a > Math.PI)
                ps[j].a += Math.PI * 2;
            if (ps[j].a - ps[i].a > Math.PI)
                ps[i].a += Math.PI * 2;
        }
    }
    var first;
    var min = 10;
    ps.forEach(function (p, i) {
        if (p.a < min) {
            first = i;
            min = p.a;
        }
    });
    for (var i = 0; i < first; i++)
        ps.push(ps.shift());
    var center = config.transform.point(config.playerXY);
    config.context2d.beginPath();
    config.context2d.moveTo(ps[0].cp.x, ps[0].cp.y);
    config.context2d.lineTo(ps[0].rp.x, ps[0].rp.y);
    var last = ps[0];
    for (var i = 1; i < 4; i++) {
        if (ps[i].a >= last.a) {
            last = ps[i];
            config.context2d.lineTo(ps[i].rp.x, ps[i].rp.y);
        }
    }
    config.context2d.lineTo(last.cp.x, last.cp.y);
    config.context2d.fillStyle = "black";
    config.context2d.fill();
    // draw block
    config.context2d.beginPath();
    config.context2d.moveTo(cps[0].x, cps[0].y);
    config.context2d.lineTo(cps[1].x, cps[1].y);
    config.context2d.lineTo(cps[2].x, cps[2].y);
    config.context2d.lineTo(cps[3].x, cps[3].y);
    config.context2d.lineTo(cps[0].x, cps[0].y);
    config.context2d.fillStyle = "black";
    config.context2d.fill();
    /*
        // draw rays
        config.context2d.beginPath()
        config.context2d.moveTo(center.x, center.y)
        config.context2d.lineTo(ps[0].rp.x, ps[0].rp.y)
        config.context2d.strokeStyle = "red"
        config.context2d.stroke()
    
        config.context2d.beginPath()
        config.context2d.moveTo(center.x, center.y)
        config.context2d.lineTo(ps[1].rp.x, ps[1].rp.y)
        config.context2d.strokeStyle = "green"
        config.context2d.stroke()
    
        config.context2d.beginPath()
        config.context2d.moveTo(center.x, center.y)
        config.context2d.lineTo(ps[2].rp.x, ps[2].rp.y)
        config.context2d.strokeStyle = "blue"
        config.context2d.stroke()
    
        config.context2d.beginPath()
        config.context2d.moveTo(center.x, center.y)
        config.context2d.lineTo(ps[3].rp.x, ps[3].rp.y)
        config.context2d.strokeStyle = "yellow"
        config.context2d.stroke()
    */
}
function initSound() {
    var context = new AudioContext();
    var totalGain = context.createGain();
    totalGain.connect(context.destination);
    return { context: context, totalGain: totalGain };
}
function toggleSound(audio) {
    audio.totalGain.gain.value = audio.totalGain.gain.value ? 0 : 1;
}
// The basic random noise generator was lifted from this helpful post:
// https://noisehack.com/generate-noise-web-audio-api/
function wind(audio) {
    var bufferSize = 4096;
    var gain = audio.context.createGain();
    gain.connect(audio.totalGain);
    gain.gain.setValueAtTime(0.08, audio.context.currentTime);
    var lastOut = 0.0;
    var node = audio.context.createScriptProcessor(bufferSize, 1, 1);
    node.onaudioprocess = function (e) {
        var output = e.outputBuffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) {
            var white = Math.random() * 2 - 1;
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5; // (roughly) compensate for gain
        }
    };
    node.connect(gain);
}
function knock(audio) {
    var gain = audio.context.createGain();
    gain.connect(audio.totalGain);
    var now = audio.context.currentTime;
    gain.gain.setValueAtTime(1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    var oscillator = audio.context.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.value = 80;
    oscillator.connect(gain);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
}
function organNote(audio) {
    var real = new Float32Array([0, 1.0, 0.5, 0.25, 0.125, 0.06, 0.03, 0.015, 0.0075, 0.00375]);
    var imag = new Float32Array(real.length);
    var organTable = audio.context.createPeriodicWave(real, imag);
    var osc_d = audio.context.createOscillator();
    osc_d.setPeriodicWave(organTable);
    osc_d.frequency.value = 146.83;
    osc_d.connect(audio.totalGain);
    var osc_f = audio.context.createOscillator();
    osc_f.setPeriodicWave(organTable);
    osc_f.frequency.value = 174.61;
    osc_f.connect(audio.totalGain);
    var osc_a = audio.context.createOscillator();
    osc_a.setPeriodicWave(organTable);
    osc_a.frequency.value = 220.0;
    osc_a.connect(audio.totalGain);
    osc_d.start(0);
    osc_f.start(0);
    osc_a.start(0);
}
function main() {
    var body = document.body.style;
    body.margin = "0px";
    body.overflow = "hidden";
    var canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    var audioState = initSound();
    wind(audioState);
    var upAngle = 3 * Math.PI / 2;
    var config = {
        context2d: canvas.getContext('2d'),
        canvasSize: undefined,
        canvasCenter: undefined,
        worldViewRadius: 50,
        time: 0,
        direction: upAngle,
        playerXY: Point(100, 100),
        cameraXY: Point(100, 100),
        cameraAngle: upAngle,
        lightHeight: 1,
        transform: undefined,
        now: new Date().getTime(),
        frameMS: 0
    };
    function resize() {
        setTimeout(function () {
            var w = window.innerWidth;
            var h = window.innerHeight;
            // update canvas size and drawing area
            canvas.style.width = w + "px";
            canvas.style.height = h + "px";
            canvas.width = w;
            canvas.height = h;
            config.canvasSize = Size(w, h);
            config.canvasCenter = Point(Math.round(w / 2), Math.round(h / 2));
            draw();
        }, 10);
    }
    var walkSpeed = 0;
    var turnSpeed = 0;
    function keyDown(key) {
        switch (key) {
            case 65:
                turnSpeed = -0.025;
                break; // A left
            case 68:
                turnSpeed = 0.025;
                break; // D right
            case 87:
                walkSpeed = 0.05;
                break; // W up
            case 83:
                walkSpeed = -0.05;
                break; // S down
            case 73:
                config.worldViewRadius--;
                break; // I zoom in
            case 75:
                config.worldViewRadius++;
                break; // K zoom out
            case 78:
                knock(audioState);
                break; // N 'knock'
            case 81:
                toggleSound(audioState);
                break; // T toggle sound
            case 79:
                organNote(audioState);
                break; // O organ
            case 89:
                config.lightHeight += 0.1;
                break; // Y light higher
            case 72:
                config.lightHeight -= 0.1;
                break; // H light lower
            default: console.log(key);
        }
    }
    function keyUp(key) {
        switch (key) {
            case 65:
                turnSpeed = 0;
                break; // A left
            case 68:
                turnSpeed = 0;
                break; // D right
            case 87:
                walkSpeed = 0;
                break; // W up
            case 83:
                walkSpeed = 0;
                break; // S down
            default: console.log(key);
        }
    }
    function move(from, direction, distance) {
        return Point(from.x + Math.cos(direction) * distance, from.y + Math.sin(direction) * distance);
    }
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", function (e) { return keyDown(e.keyCode); });
    window.addEventListener("keyup", function (e) { return keyUp(e.keyCode); });
    resize();
    var trees = generateTrees(1000, 6);
    //const trees = []
    var blocks = [
        Block(Point(120, 110), Size(2, 0.4), 0, 1),
        Block(Point(140, 120), Size(10, 0.4), 0),
        Block(Point(144.8, 123.3), Size(0.4, 7), 0),
        Block(Point(142, 127), Size(6, 0.4), 0),
        Block(Point(136.5, 127), Size(3, 0.4), 0),
        Block(Point(135.2, 123.3), Size(0.4, 7), 0)
    ];
    // divide the map into zones and put one tree in each zone
    function generateTrees(mapSize, zoneSize) {
        var trees = [];
        for (var zx = 0; zx * zoneSize < mapSize; zx++) {
            for (var zy = 0; zy * zoneSize < mapSize; zy++) {
                var r = Math.random() / 2 + 0.3;
                var tx = zx * zoneSize + Math.random() * (zoneSize - r * 2) + r;
                var ty = zy * zoneSize + Math.random() * (zoneSize - r * 2) + r;
                trees.push(Tree(Point(tx, ty), r));
            }
        }
        return trees;
    }
    function draw() {
        // update time
        var now = new Date().getTime();
        config.frameMS = now - config.now;
        config.now = now;
        config.time += 0.1;
        // update player
        config.playerXY = move(config.playerXY, config.direction, walkSpeed);
        config.direction += turnSpeed;
        // update camera
        var factor = 0.2;
        config.cameraXY.x += (config.playerXY.x - config.cameraXY.x) * factor;
        config.cameraXY.y += (config.playerXY.y - config.cameraXY.y) * factor;
        config.cameraAngle += (config.direction - config.cameraAngle) * factor;
        // clear the canvas
        config.context2d.fillStyle = "rgba(0,0,0,1)";
        config.context2d.fillRect(0, 0, config.canvasSize.w, config.canvasSize.h);
        config.transform = getTransform(config);
        // draw the light
        var lr = 800;
        var lightXY = config.transform.point(config.playerXY);
        var g = config.context2d.createRadialGradient(lightXY.x, lightXY.y, 0, lightXY.x, lightXY.y, lr);
        var baseIntensity = 1, flickerAmount = 0.1;
        var intensity = baseIntensity + flickerAmount * (0.578 - (Math.sin(config.time) +
            Math.sin(2.2 * config.time + 5.52) + Math.sin(2.9 * config.time + 0.93) +
            Math.sin(4.6 * config.time + 8.94))) / 4;
        var steps = 32; // number of gradient steps
        var lightScale = 15; // controls how quickly the light falls off
        for (var i = 1; i < steps + 1; i++) {
            var x = lightScale * Math.pow(i / steps, 2) + 1;
            var alpha = intensity / (x * x);
            g.addColorStop((x - 1) / lightScale, "rgba(255,255,255," + alpha + ")");
        }
        config.context2d.fillStyle = g;
        config.context2d.fillRect(lightXY.x - lr, lightXY.y - lr, lr * 2, lr * 2);
        // draw the center
        config.context2d.strokeStyle = "blue";
        config.context2d.strokeRect(lightXY.x - 5, lightXY.y - 5, 10, 10);
        // draw all trees
        config.context2d.beginPath();
        trees.forEach(function (tree) {
            drawTree(tree, config);
        });
        config.context2d.fillStyle = "black";
        config.context2d.fill();
        // draw all blocks
        //config.context2d.beginPath()
        config.context2d.shadowColor = "black";
        config.context2d.shadowBlur = 5;
        blocks[0].angle += 0.01;
        blocks.forEach(function (block) {
            drawBlock(block, config);
        });
        //config.context2d.fillStyle = "black"
        //config.context2d.fill()
        var frameRate = Math.round(1000 / config.frameMS);
        config.context2d.fillStyle = "yellow";
        config.context2d.font = "12px Arial";
        config.context2d.fillText(frameRate + " fps", 5, 15);
        window.requestAnimationFrame(draw);
    }
}
