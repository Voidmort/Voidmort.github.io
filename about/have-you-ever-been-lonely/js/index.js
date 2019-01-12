/*
Design by Angelo Plessas | http://www.angeloplessas.com
Code by Gerard Ferrandez | https://codepen.io/ge1doot/pen/LXPaME
*/
"use strict";
////////////// palette ////////////////////
const blue = "#0348BA";
const green = "#62D744";
const red = "#C40104";
const yellow = "#FFFF70";
const white = "#FEFFFA";
const purple = "#AA86C0";
const backgroundColor = "#ADADAD";
const projectorColor = "#E5E5E5";
/////////////// Robots ///////////////////
const Robot = class {
	constructor(canvas, sx, struct) {
		this.n = 0;
		this.x = sx * Math.min(canvas.width, canvas.height);
		this.sx = sx;
		this.frame = 0;
		this.dir = 1;
		this.nodes = [];
		this.constraints = [];
		this.images = [];
		this.pace = 28;
		this.friction = 1.0;
		// create nodes
		for (let n in struct.nodes) {
			const node = new Robot.Node(this, struct.nodes[n]);
			struct.nodes[n].id = node;
			this.nodes.push(node);
		}
		// create constraints and textures
		for (let c of struct.constraints) {
			const constraint = new Robot.Constraint(struct, c);
			this.constraints.push(constraint);
			if (c.svg) {
				constraint.decodeSVG(this, struct.svg[c.svg]);
				this.images.push(constraint);
			}
		}
	}
	resize(w, h, s) {
		// windows resize - regenerate SVG cache
		this.x = this.sx * Math.min(w, h);
		this.images.forEach(c => {
			c.cacheSVG(s);
		});
	}
	load(canvas) {
		// initial load
		if (this.n === this.images.length) {
			this.resize(canvas.width, canvas.height, canvas.scale);
			return 1;
		}
		return 0;
	}
	dance(canvas, pointer) {
		// main rendering function
		const width = canvas.width;
		const height = canvas.height;
		const scale = canvas.scale;
		// dance
		if (++this.frame % this.pace === 0) this.dir = -this.dir;
		// dragging
		if (pointer.drag) {
			const d = pointer.drag;
			d.x += ((pointer.x - width * 0.5) / scale - d.x) * 0.5;
			d.y += (pointer.y / scale - pointer.drag.y) * 0.5;
		}
		// Verlet integration
		for (const n of this.nodes) {
			n.integrate(width, height, scale, pointer);
		}
		// solve constraints
		for (let i = 0; i < 5; i++) {
			for (const n of this.constraints) {
				n.solve();
			}
		}
		// draw shapes
		for (const n of this.images) {
			n.draw(width, height, scale);
		}
	}
	down () {
		this.friction = 0.99;
		this.pace = 10;
		this.force(2);
	}
	up () {
		this.friction = 1.0;
		this.pace = 28;
		this.force(0.6);
	}
	force (f) {
		for (const n of this.nodes) {
			n.f = f;
		}
	}
};
Robot.Node = class {
	constructor(robot, node) {
		this.robot = robot;
		this.x = node.x + robot.x;
		this.y = node.y;
		this.w = node.w;
		this.oldX = this.x;
		this.oldY = this.y;
		this.mass = node.mass || 1.0;
		this.func = node.f || null;
		this.f = 0.6;
	}
	integrate(width, height, scale, pointer) {
		// dance functions
		if (this.func !== null) {
			if (!(pointer.drag && pointer.drag.robot === this.robot)) {
				this.func(this.robot.dir);
			}
		}
		// Verlet integration
		const x = this.x;
		const y = this.y;
		this.x += (this.x - this.oldX) * this.robot.friction;
		this.y += (this.y - this.oldY) * this.robot.friction;
		this.oldX = x;
		this.oldY = y;
		// interactions
		if (pointer.isDown) this.down(width, height, scale, pointer);
		else if (pointer.drag !== null) pointer.drag = null;
		// ground contact
		if (this.y > height / scale - this.w) {
			this.x += this.oldX - this.x;
			this.oldX = this.x;
			this.y = height / scale - this.w;
			this.oldY = this.y;
		}
	}
	down(width, height, scale) {
		ctx.beginPath();
		ctx.arc(
			this.x * scale + width * 0.5,
			this.y * scale,
			this.w * scale * 3,
			0,
			2 * Math.PI
		);
		/* DEBUG
			ctx.strokeStyle = "#666";
			ctx.stroke();
		*/
		if (pointer.drag === null) {
			if (ctx.isPointInPath(pointer.x, pointer.y)) {
				pointer.drag = this;
			}
		}
	}
	follow() {
		if (pointer.drag && pointer.drag !== this.robot) {
			this.x += ((pointer.x - canvas.width * 0.5) / canvas.scale - this.x) * 0.01;
			this.y += (pointer.y / canvas.scale - this.y) * 0.01;
		}
	}
};
Robot.Constraint = class {
	constructor(struct, c) {
		this.n0 = struct.nodes[c.n0].id;
		this.n1 = struct.nodes[c.n1].id;
		this.img = null;
		this.texture = null;
		this.x = c.x || 0.0;
		this.y = c.y || 0.0;
		this.a = c.a || 0.0;
		const dx = this.n0.x - this.n1.x;
		const dy = this.n0.y - this.n1.y;
		this.dist = dx * dx + dy * dy;
	}
	solve() {
		const dx = this.n1.x - this.n0.x;
		const dy = this.n1.y - this.n0.y;
		const delta = this.dist / (dx * dx + dy * dy + this.dist) - 0.5;
		const m = this.n0.mass + this.n1.mass;
		const m2 = this.n0.mass / m;
		const m1 = this.n1.mass / m;
		this.n1.x += delta * dx * m2;
		this.n1.y += delta * dy * m2;
		this.n0.x -= delta * dx * m1;
		this.n0.y -= delta * dy * m1;
	}
	draw(width, height, scale) {
		const dx = this.n1.x - this.n0.x;
		const dy = this.n1.y - this.n0.y;
		const a = Math.atan2(dy, dx) - Math.PI * 0.5 + this.a;
		ctx.save();
		ctx.translate(this.n0.x * scale + width * 0.5, this.n0.y * scale);
		ctx.rotate(a);
		/* DEBUG
			ctx.strokeStyle = "#666";
			ctx.strokeRect(
				this.x * scale,
				this.y * scale,
				this.texture.width,
				this.texture.height
			);
		*/
		ctx.drawImage(this.texture, this.x * scale, this.y * scale);
		ctx.restore();
		/* DEBUG
			ctx.beginPath();
			ctx.moveTo(this.n0.x * scale + width * 0.5, this.n0.y * scale);
			ctx.lineTo(this.n1.x * scale + width * 0.5, this.n1.y * scale);
			ctx.strokeStyle = "#fff";
			ctx.stroke();
		*/
	}
	load() {
		this.width = this.img.width;
		this.height = this.img.height;
		const texture = document.createElement("canvas");
		const ctx = texture.getContext("2d");
		texture.width = this.width;
		texture.height = this.height;
		ctx.drawImage(this.img, 0, 0, this.width, this.height);
		this.img = texture;
	}
	decodeSVG(robot, svg) {
		this.texture = document.createElement("canvas");
		this.img = new Image();
		this.img.onload = e => robot.n++;
		this.img.src = "data:image/svg+xml;base64," + window.btoa(svg);
	}
	cacheSVG(scale) {
		const ctx = this.texture.getContext("2d");
		this.texture.width = Math.floor(this.img.width * scale) + 1;
		this.texture.height = Math.floor(this.img.height * scale) + 1;
		ctx.drawImage(this.img, 0, 0, this.texture.width, this.texture.height);
	}
};
//////////////////////////////////////////
const canvas = {
	init() {
		this.elem = document.querySelector("canvas");
		this.resize();
		window.addEventListener("resize", () => this.resize(), false);
		return this.elem.getContext("2d", { lowLatency: true });
	},
	resize() {
		this.width = this.elem.width = this.elem.offsetWidth;
		this.height = this.elem.height = this.elem.offsetHeight;
		this.scale = Math.min(this.width, this.height) / 1100;
		robots.forEach(robot => robot.resize(this.width, this.height, this.scale));
	},
	clear() {
		ctx.fillStyle = backgroundColor;
		ctx.fillRect(0, 0, this.width, this.height);
		if (projectorColor !== backgroundColor) {
			ctx.fillStyle = projectorColor;
			ctx.beginPath();
			ctx.arc(canvas.width * 0.5, canvas.height * 0.5, canvas.scale * 500, 0, 2 * Math.PI);
			ctx.fill();
		}
	}
};
const robots = [];
//////////////////////////////////////////
const sound = {
	// adapted from https://codepen.io/lukeyphills/pen/GFsqK
	context: null,
	f: false,
	init() {
		if (window.location.href.indexOf("fullcpgrid") > -1) return;
		this.AudioContext = window.AudioContext || window.webkitAudioContext;
		if (!this.AudioContext) return;
		this.context = new this.AudioContext();
		this.volume = this.context.createGain();
		this.oscVolume = this.context.createGain();
		this.finalVolume = this.context.createGain();
		this.filter = this.context.createBiquadFilter();
		this.delay = this.context.createDelay();
		this.feedbackGain = this.context.createGain();
		this.compressor = this.context.createDynamicsCompressor();
		this.n = this.context.createAnalyser();
		this.n.smoothingTimeConstant = .85;
	},
	routeSounds () {
		if (this.context === null) return;
		this.osc = this.context.createOscillator();
		this.osc.type = "sine";
		this.filter.type = "lowpass";
		this.feedbackGain.gain.value = 0.5;
		this.delay.delayTime.value = 0.225;
		this.volume.gain.value = 0.5;
		this.oscVolume.gain.value = 0;
		this.finalVolume.gain.value = 1;
		this.osc.connect(this.oscVolume);
		this.oscVolume.connect(this.filter);
		this.filter.connect(this.compressor);
		this.filter.connect(this.delay);
		this.delay.connect(this.feedbackGain);
		this.delay.connect(this.compressor);
		this.feedbackGain.connect(this.delay);
		this.compressor.connect(this.volume);
		this.volume.connect(this.finalVolume);
		this.finalVolume.connect(this.n);
		this.n.connect(this.context.destination);
		this.osc.start(0);
	},
	play () {
		if (this.context === null) return;
		if (this.f === false) {
			this.routeSounds();
			this.f = true;
		}
		if (this.context.state === 'suspended') this.context.resume();
		this.oscVolume.gain.value = 0.25;
		this.osc.frequency.value = 0;
		this.filter.frequency.value = 1000;
	},
	effect (freq) {
		if (this.context === null) return;
		if (this.f === true && this.context.state !== 'suspended') {
			this.osc.frequency.value = freq;
			this.filter.frequency.value = 1000;
		}
	},
	stop () {
		if (this.context === null) return;
		this.osc.frequency.value = 0;
		this.oscVolume.gain.value = 0;
	}
};
//////////////////////////////////////////
const pointer = {
	x: 0.0,
	y: 0.0,
	isDown: false,
	drag: null,
	move(e, touch) {
		if (touch === true) {
			e.preventDefault();
			this.x = e.targetTouches[0].clientX;
			this.y = e.targetTouches[0].clientY;
		} else {
			this.x = e.clientX;
			this.y = e.clientY;
		}
	},
	down(e, touch) {
		sound.play();
		this.move(e, touch);
		this.isDown = true;
		robots.forEach(robot => robot.down());
	},
	up(e) {
		sound.stop();
		this.isDown = false;
		robots.forEach(robot => robot.up());
	},
	init(canvas) {
		window.addEventListener("mousemove", e => this.move(e, false), false);
		canvas.elem.addEventListener("touchmove", e => this.move(e, true), false);
		window.addEventListener("mousedown", e => this.down(e, false), false);
		window.addEventListener("touchstart", e => this.down(e, true), false);
		window.addEventListener("mouseup", e => this.up(e), false);
		window.addEventListener("touchend", e => this.up(e), false);
	}
};
///////////////////////////////////////////
const ctx = canvas.init();
pointer.init(canvas);
sound.init();
//////////////// female ///////////////////
/*
                +1 head
                |
                +0 neck 
   arms       /   \         arms  
4+----3+----2+-----+5----+6----+7 
             | \ / |
             |  /  | Body  
             | / \ | 
            8+-----+11  
             |     |   legs up  
             |     |  
            9+     +12  
             |     |   legs down 
             |     |  
           10+     +13 
*/
robots.push(
	new Robot(canvas, 0.45, {
		nodes: {
			n0: {
				x: 0,
				y: 253,
				w: 30,
				mass: 0.1,
				f(d) {
					this.y -= 0.4 * this.f;
					this.x += (this.robot.x - this.x) * 0.01;
				}
			},
			n1: {
				x: 0,
				y: 100,
				w: 30,
				mass: 0.5,
				f(d) {
					this.y -= 0.1 * this.f;
				}
			},
			n2: {
				x: -75,
				y: 280,
				w: 30,
				mass: 0.1
			},
			n3: {
				x: -188,
				y: 435,
				w: 30,
				mass: 0.1
			},
			n4: {
				x: -200,
				y: 560,
				w: 30,
				mass: 0.1,
				f(d) {
					this.follow();
				}
			},
			n5: {
				x: 70,
				y: 290,
				w: 30,
				mass: 0.1
			},
			n6: {
				x: 155,
				y: 400,
				w: 30,
				mass: 0.1
			},
			n7: {
				x: 60,
				y: 495,
				w: 30,
				mass: 0.1,
				f(d) {
					this.follow();
				}
			},
			n8: {
				x: -70,
				y: 602,
				w: 40,
				mass: 0.1,
				f(d) {
					this.x += (this.robot.x - this.x) * 0.005;
					this.y -= 4.0 * this.f;
				}
			},
			n9: {
				x: -90,
				y: 800,
				w: 30,
				mass: 0.5,
				f(d) {
					if (d > 0) {
						this.x -= 0.5 * this.f;
						this.y -= 1.5 * this.f;
					} else {
						this.y += 2.0 * this.f;
					}
				}
			},
			n10: {
				x: -90,
				y: 1000,
				w: 5,
				mass: 0.5,
				f(d) {
					this.y += 1.5 * this.f;
					if (d > 0) {
						this.y -= 1.0 * this.f;
					} else {
						this.y += 5.0 * this.f;
					}
				}
			},
			n11: {
				x: 7,
				y: 565,
				w: 40,
				mass: 0.1,
				f(d) {
					this.y -= 0.4 * this.f;
				}
			},
			n12: {
				x: 7,
				y: 805,
				w: 40,
				mass: 0.2,
				f(d) {
					if (d > 0) {
						this.y += 2.0 * this.f;
					} else {
						this.x += 0.5 * this.f;
						this.y -= 1.5 * this.f;
					}
				}
			},
			n13: {
				x: 70,
				y: 995,
				w: 5,
				mass: 0.2,
				f(d) {
					this.y += 1.5 * this.f;
					if (d > 0) {
						this.y += 5.0 * this.f;
					} else {
						this.y -= 1.0 * this.f;
					}
				}
			}
		},
		constraints: [
			{ n0: "n0", n1: "n8", svg: "body", x: -120, y: 0, a: -0.25 },
			{ n0: "n0", n1: "n1", svg: "head", x: -12, y: -253, a: Math.PI - 0.33 },
			{ n0: "n0", n1: "n2" },
			{ n0: "n2", n1: "n5" },
			{ n0: "n5", n1: "n0" },
			{ n0: "n2", n1: "n3", svg: "leftarmup", x: -129, y: 0, a: -0.73 },
			{ n0: "n3", n1: "n4", svg: "leftarmdown", x: -53, y: -3, a: -0.35 },
			{ n0: "n5", n1: "n6", svg: "rightarmup", x: -19, y: 0 },
			{ n0: "n6", n1: "n7", svg: "rightarmdown", x: -19, y: -15 },
			{ n0: "n2", n1: "n8" },
			{ n0: "n2", n1: "n11" },
			{ n0: "n0", n1: "n11" },
			{ n0: "n5", n1: "n8" },
			{ n0: "n5", n1: "n11" },
			{ n0: "n8", n1: "n9", svg: "leftlegup", x: -112, y: -15, a: -0.4 },
			{ n0: "n9", n1: "n10", svg: "leftlegdown", x: -29, y: 0 },
			{ n0: "n11", n1: "n12", svg: "rightlegup", x: -54, y: 0, a: -0.05 },
			{ n0: "n12", n1: "n13", svg: "rightlegdown", x: -52, y: 0 },
			{ n0: "n8", n1: "n11" }
		],
		svg: {
			head: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="138px" height="253px" viewBox="0 0 1380 2530" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${blue}" stroke="none">
			 <path d="M116 2398 c4 -73 8 -135 10 -136 1 -2 23 9 49 24 39 23 48 25 59 13 7 -8 56 -64 109 -125 l96 -111 -137 -94 c-75 -52 -137 -99 -137 -106 0 -7 37 -57 83 -112 45 -56 82 -105 82 -109 0 -5 -22 -23 -48 -40 -77 -50 -166 -145 -205 -219 -52 -100 -70 -173 -71 -283 0 -182 51 -308 178 -435 131 -131 238 -175 426 -175 112 0 193 16 261 51 l40 20 45 -26 c109 -64 126 -191 35 -268 -79 -66 -221 -32 -221 53 0 25 34 82 42 70 1 -3 10 -18 18 -35 13 -24 23 -31 54 -33 46 -4 66 11 66 50 0 65 -54 118 -120 118 -36 0 -96 -23 -124 -48 -27 -25 -56 -91 -56 -133 0 -84 65 -190 150 -244 85 -54 247 -72 344 -39 71 24 149 101 193 192 37 74 38 79 38 186 0 104 -2 115 -32 179 -35 74 -126 178 -173 197 l-29 12 25 50 c92 182 59 459 -75 620 -106 129 -245 210 -394 230 -84 11 -117 9 -272 -17 -28 -4 -36 2 -100 80 -38 47 -71 90 -73 94 -2 5 56 50 128 101 71 51 133 96 136 102 5 8 -17 36 -184 225 l-64 72 48 30 47 29 -121 61 c-67 34 -124 61 -127 61 -3 0 -2 -60 1 -132z"/>
			</g>
			<g id="layer102" fill="${yellow}" stroke="none">
			 <path d="M116 2398 c4 -73 8 -135 10 -136 1 -2 23 9 49 24 39 23 48 25 59 13 7 -8 56 -64 109 -125 l96 -111 -134 -92 c-74 -50 -137 -96 -140 -101 -4 -6 29 -53 72 -106 43 -53 84 -103 90 -112 12 -14 16 -14 44 -1 l31 15 -76 89 c-41 50 -76 93 -76 97 0 4 59 48 130 98 72 51 133 96 136 102 5 8 -17 36 -184 225 l-64 72 48 30 47 29 -121 61 c-67 34 -124 61 -127 61 -3 0 -2 -60 1 -132z"/>
			 <path d="M355 1391 c-65 -29 -93 -115 -56 -174 67 -110 235 -51 218 76 -10 74 -97 127 -162 98z"/>
			 <path d="M1055 1220 c-60 -15 -303 -73 -540 -130 -237 -56 -443 -105 -460 -109 -27 -7 -30 -11 -28 -45 5 -73 68 -182 157 -271 131 -131 238 -175 426 -175 112 0 193 16 261 51 l40 20 45 -26 c109 -64 126 -191 35 -268 -79 -66 -221 -32 -221 53 0 25 34 82 42 70 1 -3 10 -18 18 -35 13 -24 23 -31 54 -33 46 -4 66 11 66 50 0 96 -96 145 -195 99 -124 -57 -140 -215 -33 -336 51 -57 98 -88 168 -109 69 -21 193 -21 254 0 71 24 149 101 193 192 37 74 38 79 38 186 0 104 -2 115 -32 179 -35 74 -126 178 -173 197 l-28 12 28 60 c37 78 54 182 46 278 -8 96 -15 120 -35 119 -9 0 -65 -13 -126 -29z m-295 -185 c42 -22 60 -53 60 -105 0 -120 -150 -165 -217 -67 -36 53 -31 101 16 148 43 44 88 51 141 24z"/>
			</g>
			<g id="layer103" fill="${white}" stroke="none">
			 <path d="M1124 763 c-27 -43 -134 -152 -171 -174 -18 -11 -33 -24 -33 -28 0 -3 17 -15 37 -26 107 -58 124 -192 34 -268 -79 -66 -221 -32 -221 53 0 25 34 82 42 70 1 -3 10 -18 18 -35 13 -24 23 -31 54 -33 46 -4 66 11 66 50 0 96 -96 145 -195 99 -124 -57 -140 -215 -33 -336 51 -57 98 -88 168 -109 69 -21 193 -21 254 0 71 24 149 101 193 192 37 74 38 79 38 186 0 104 -2 115 -32 179 -33 70 -117 168 -165 193 -35 18 -33 19 -54 -13z"/>
			</g>
			</svg>`,
			body: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="179px" height="349px" viewBox="0 0 1790 3490" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${blue}" stroke="none">
			 <path d="M426 3474 c-139 -34 -298 -156 -363 -280 -28 -52 -62 -163 -63 -200 0 -8 82 -13 262 -18 145 -4 265 -9 267 -12 2 -2 -1 -277 -8 -611 -6 -335 -11 -649 -11 -699 l0 -92 -37 -6 c-101 -18 -201 -98 -240 -191 -15 -38 -22 -45 -46 -45 -37 0 -77 -41 -77 -78 0 -42 35 -82 70 -82 26 0 32 -7 56 -61 43 -95 126 -160 238 -184 27 -6 28 -8 22 -48 -3 -23 -6 -185 -8 -360 l-3 -319 87 -58 c185 -124 456 -164 654 -96 248 84 439 223 540 393 l24 42 -101 202 c-100 200 -101 202 -90 245 41 162 -35 299 -192 348 -13 4 -154 280 -438 851 -230 465 -419 847 -419 850 0 2 128 1 285 -2 l285 -6 0 34 c0 50 -23 126 -60 199 -41 81 -152 193 -236 237 -113 60 -268 79 -398 47z"/>
			</g>
			<g id="layer102" fill="${red}" stroke="none">
			 <path d="M426 3474 c-139 -34 -298 -156 -363 -280 -28 -52 -62 -163 -63 -200 0 -8 82 -13 262 -18 145 -4 265 -9 267 -11 2 -2 -1 -233 -6 -512 -5 -279 -9 -509 -9 -509 2 -3 477 93 481 98 4 3 -95 212 -219 464 -124 251 -226 458 -226 460 0 2 128 0 285 -3 l285 -6 0 34 c0 50 -23 126 -60 199 -41 81 -152 193 -236 237 -113 60 -268 79 -398 47z"/>
			 <path d="M423 1541 c-88 -30 -165 -104 -195 -187 -10 -28 -17 -34 -40 -34 -38 0 -78 -40 -78 -78 0 -42 35 -82 70 -82 26 0 32 -7 56 -60 42 -93 132 -165 230 -183 l31 -6 7 61 c3 34 6 180 6 324 0 299 8 278 -87 245z"/>
			 <path d="M1260 1255 c-58 -19 -113 -64 -148 -123 -24 -41 -27 -57 -27 -132 0 -75 3 -91 27 -131 32 -54 75 -93 125 -114 46 -19 170 -19 216 0 160 67 210 290 94 421 -70 80 -185 112 -287 79z"/>
			</g>
			<g id="layer103" fill="${yellow}" stroke="none">
			 <path d="M529 2808 c0 -95 -4 -328 -8 -518 -4 -190 -7 -346 -7 -346 3 -3 477 93 481 98 7 6 -450 938 -459 938 -3 0 -6 -78 -7 -172z"/>
			 <path d="M423 1541 c-85 -29 -159 -98 -193 -181 -12 -28 -10 -32 13 -54 48 -45 47 -104 -3 -134 l-29 -18 28 -60 c43 -91 131 -160 227 -177 l31 -6 7 61 c3 34 6 180 6 324 0 299 8 278 -87 245z"/>
			 <path d="M1260 1255 c-58 -19 -113 -64 -148 -123 -24 -41 -27 -57 -27 -132 0 -75 3 -91 27 -131 32 -54 75 -93 125 -114 46 -19 170 -19 216 0 160 67 210 290 94 421 -70 80 -185 112 -287 79z m136 -189 c83 -70 -24 -192 -110 -125 -20 16 -26 29 -26 60 0 78 78 116 136 65z"/>
			</g>
			<g id="layer104" fill="${white}" stroke="none">
			 <path d="M529 2808 c0 -95 -4 -328 -8 -518 -4 -190 -7 -346 -7 -346 3 -3 477 93 481 98 7 6 -450 938 -459 938 -3 0 -6 -78 -7 -172z"/>
			</g>
			</svg>`,
			rightlegup: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="98px" height="242px" viewBox="0 0 980 2420" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${blue}" stroke="none">
			 <path d="M395 2409 c-132 -3 -275 -7 -317 -8 l-77 -1 6 -37 c8 -61 58 -159 107 -211 160 -171 448 -176 606 -11 61 64 108 155 117 227 l6 52 -104 -2 c-57 -1 -212 -5 -344 -9z"/>
			 <path d="M525 2009 c-132 -3 -298 -7 -369 -8 l-129 -1 5 -45 c13 -112 106 -233 226 -292 75 -37 78 -38 192 -38 102 1 121 4 170 26 119 55 216 179 239 303 6 33 11 61 11 63 0 2 -24 2 -52 1 -29 -1 -161 -5 -293 -9z"/>
			 <path d="M427 1607 l-378 -10 6 -41 c17 -114 120 -246 234 -300 63 -29 72 -31 186 -31 113 0 124 2 179 29 115 58 217 195 232 314 l7 52 -44 -2 c-24 -1 -214 -6 -422 -11z"/>
			 <path d="M460 1198 c-201 -6 -366 -10 -367 -11 -1 -1 3 -23 8 -50 19 -103 101 -218 193 -272 116 -67 279 -74 401 -16 119 55 217 186 232 309 l6 52 -54 -2 c-30 -1 -218 -5 -419 -10z"/>
			 <path d="M491 797 l-373 -10 4 -42 c13 -110 116 -244 233 -301 56 -27 68 -29 180 -29 109 0 125 2 178 27 117 55 213 178 236 302 6 33 11 61 11 63 0 2 -21 2 -47 1 -27 -1 -216 -6 -422 -11z"/>
			 <path d="M395 390 c-116 -4 -221 -8 -234 -9 -21 -1 -23 -4 -17 -38 13 -69 63 -162 118 -216 165 -165 433 -165 595 -1 59 61 110 157 119 227 l7 47 -189 -2 c-104 -1 -283 -5 -399 -8z"/>
			</g>
			<g id="layer102" fill="${yellow}" stroke="none">
			 <path d="M525 2009 c-132 -3 -298 -7 -369 -8 l-129 -1 5 -45 c13 -112 106 -233 226 -292 75 -37 78 -38 192 -38 102 1 121 4 170 26 119 55 216 179 239 303 6 33 11 61 11 63 0 2 -24 2 -52 1 -29 -1 -161 -5 -293 -9z"/>
			 <path d="M427 1607 l-378 -10 6 -41 c17 -114 120 -246 234 -300 63 -29 72 -31 186 -31 113 0 124 2 179 29 115 58 217 195 232 314 l7 52 -44 -2 c-24 -1 -214 -6 -422 -11z"/>
			 <path d="M491 797 l-373 -10 4 -42 c13 -110 116 -244 233 -301 56 -27 68 -29 180 -29 109 0 125 2 178 27 117 55 213 178 236 302 6 33 11 61 11 63 0 2 -21 2 -47 1 -27 -1 -216 -6 -422 -11z"/>
			 <path d="M395 390 c-116 -4 -221 -8 -234 -9 -21 -1 -23 -4 -17 -38 13 -69 63 -162 118 -216 165 -165 433 -165 595 -1 59 61 110 157 119 227 l7 47 -189 -2 c-104 -1 -283 -5 -399 -8z"/>
			</g>
			<g id="layer103" fill="${white}" stroke="none">
			 <path d="M525 2009 c-132 -3 -298 -7 -369 -8 l-129 -1 5 -45 c13 -112 106 -233 226 -292 75 -37 78 -38 192 -38 102 1 121 4 170 26 119 55 216 179 239 303 6 33 11 61 11 63 0 2 -24 2 -52 1 -29 -1 -161 -5 -293 -9z"/>
			 <path d="M491 797 l-373 -10 4 -42 c13 -110 116 -244 233 -301 56 -27 68 -29 180 -29 109 0 125 2 178 27 117 55 213 178 236 302 6 33 11 61 11 63 0 2 -21 2 -47 1 -27 -1 -216 -6 -422 -11z"/>
			</g>
			</svg>`,
			rightlegdown: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="105px" height="196px" viewBox="0 0 1050 1960" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${white}" stroke="none">
			 <path d="M520 1918 c0 -25 -3 -86 -6 -136 l-7 -91 46 17 c25 9 48 14 50 12 13 -15 207 -368 207 -377 0 -5 -92 -60 -205 -122 -113 -62 -205 -114 -205 -116 0 -1 49 -90 109 -196 60 -107 107 -197 105 -200 -2 -4 -86 -52 -187 -108 -100 -55 -191 -107 -201 -114 -17 -12 -9 -28 106 -235 78 -142 129 -222 139 -222 8 0 23 6 31 13 15 11 5 33 -94 210 -61 109 -109 199 -107 201 23 16 390 216 398 216 6 0 11 4 11 10 0 5 -49 96 -109 202 -60 106 -107 196 -105 199 2 4 96 57 209 119 l205 112 -19 31 c-119 195 -231 393 -227 404 3 7 11 13 18 13 7 1 26 7 43 14 l29 12 -104 79 c-58 43 -111 82 -117 88 -10 7 -13 -1 -13 -35z"/>
			</g>
			</svg>`,
			leftlegup: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="145px" height="220px" viewBox="0 0 1450 2200" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${yellow}" stroke="none">
			 <path d="M323 2010 c3 -14 96 -464 207 -1000 110 -536 203 -982 206 -992 4 -14 60 6 354 125 193 78 350 144 350 148 0 8 -1098 1719 -1113 1734 -6 7 -8 2 -4 -15z"/>
			</g>
			</svg>`,
			leftlegdown: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="58px" height="207px" viewBox="0 0 580 2070" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${purple}" stroke="none">
			 <path d="M156 1037 c-82 -557 -151 -1018 -154 -1024 -3 -10 58 -13 287 -13 160 0 291 3 291 8 0 17 -270 2035 -272 2038 -2 1 -70 -453 -152 -1009z"/>
			</g>
			</svg>`,
			rightarmup: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="38px" height="147px" viewBox="0 0 380 1470" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${yellow}" stroke="none">
			 <path d="M34 1460 l-29 -5 2 -325 c1 -179 2 -504 2 -722 l1 -398 180 0 180 0 0 725 0 724 -154 3 c-84 2 -166 1 -182 -2z"/>
			</g>
			</svg>`,
			rightarmdown: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="38px" height="147px" viewBox="0 0 380 1470" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${white}" stroke="none">
			 <path d="M12 733 l3 -727 177 -1 c154 -1 178 1 182 14 2 9 3 336 2 726 l-1 710 -183 3 -182 2 2 -727z"/>
			</g>
			</svg>`,
			leftarmup: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="129px" height="142px" viewBox="0 0 1290 1420" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${green}" stroke="none">
			 <path d="M6 1349 c3 -41 12 -122 20 -180 52 -379 253 -735 521 -920 175 -120 432 -211 668 -235 68 -7 69 -7 55 12 -18 22 -1200 1326 -1241 1368 l-28 30 5 -75z"/>
			</g>
			</svg>`,
			leftarmdown: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="63px" height="126px" viewBox="0 0 630 1260" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${white}" stroke="none">
			 <path d="M90 1242 c0 -17 26 -176 35 -220 6 -23 6 -23 33 -4 15 10 32 22 39 26 7 4 68 -58 159 -160 143 -161 147 -167 128 -183 -75 -62 -334 -294 -334 -300 0 -7 271 -323 325 -379 11 -12 17 -11 39 3 15 10 25 21 24 26 -2 4 -66 79 -144 166 -77 87 -143 163 -147 169 -4 6 69 77 174 168 l180 158 -113 121 c-62 66 -140 150 -173 185 l-60 65 25 16 c67 45 67 45 14 69 -27 11 -84 37 -126 56 -67 30 -78 33 -78 18z"/>
			</g>
			</svg>`
		}
	})
);
/////////////////// male ///////////////////////
robots.push(
	new Robot(canvas, -0.45, {
		nodes: {
			n0: {
				x: 0,
				y: 255,
				w: 30,
				mass: 0.1,
				f(d) {
					this.y -= 0.4 * this.f;
					this.x += (this.robot.x - this.x) * 0.01;
				}
			},
			n1: {
				x: 86,
				y: 10,
				w: 30,
				mass: 0.5,
				f(d) {
					this.y -= 0.1 * this.f;
				}
			},
			n2: {
				x: -45,
				y: 328,
				w: 30,
				mass: 0.1
			},
			n3: {
				x: -100,
				y: 580,
				w: 30,
				mass: 0.1
			},
			n4: {
				x: -110,
				y: 600,
				w: 10,
				mass: 0.1,
				f(d) {
					this.follow();
				}
			},
			n5: {
				x: 142,
				y: 330,
				w: 30,
				mass: 0.1
			},
			n6: {
				x: 150,
				y: 510,
				w: 30,
				mass: 0.1
			},
			n7: {
				x: 150,
				y: 530,
				w: 10,
				mass: 0.1,
				f(d) {
					this.follow();
				}
			},
			n8: {
				x: 4,
				y: 602,
				w: 40,
				mass: 0.1,
				f(d) {
					this.x += (this.robot.x - this.x) * 0.005;
					this.y -= 0.1 * this.f;
				}
			},
			n9: {
				x: 4,
				y: 810,
				w: 30,
				mass: 0.5,
				f(d) {
					if (d > 0) {
						this.x -= 0.5 * this.f;
						this.y -= 1.5 * this.f;
					} else {
						this.y += 2.0 * this.f;
					}
				}
			},
			n10: {
				x: 4,
				y: 1000,
				w: 30,
				mass: 0.5,
				f(d) {
					this.y += 1.5 * this.f;
					if (d > 0) {
						this.y -= 1.0 * this.f;
					} else {
						this.y += 2.0 * this.f;
					}
				}
			},
			n11: {
				x: 120,
				y: 600,
				w: 40,
				mass: 0.1,
				f(d) {
					this.y -= 0.1 * this.f;
				}
			},
			n12: {
				x: 120,
				y: 810,
				w: 40,
				mass: 0.2,
				f(d) {
					if (d > 0) {
						this.y += 2.0 * this.f;
					} else {
						this.x += 0.5 * this.f;
						this.y -= 1.5 * this.f;
					}
				}
			},
			n13: {
				x: 120,
				y: 995,
				w: 30,
				mass: 0.2,
				f(d) {
					this.y += 1.5 * this.f;
					if (d > 0) {
						this.y += 2.0 * this.f;
					} else {
						this.y -= 1.0 * this.f;
					}
				}
			},
			n14: {
				x: 120,
				y: 90,
				w: 20,
				mass: 0.05
			}
		},
		constraints: [
			{ n0: "n0", n1: "n8", svg: "body", x: -50, y: 0, a: 0.01 },
			{ n0: "n0", n1: "n1", svg: "head", x: -35, y: -255, a: Math.PI - 0.3 },
			{ n0: "n0", n1: "n2" },
			{ n0: "n2", n1: "n5" },
			{ n0: "n5", n1: "n0" },
			{ n0: "n2", n1: "n3", svg: "leftarmup", x: -162, y: -18, a: -0.67 },
			{ n0: "n3", n1: "n4", svg: "leftarmdown", x: -49, y: -49, a: -0.3 },
			{ n0: "n5", n1: "n6", svg: "rightarmup", x: -8, y: 0, a: 0.46 },
			{ n0: "n6", n1: "n7", svg: "rightarmdown", x: -60, y: -40 },
			{ n0: "n2", n1: "n8" },
			{ n0: "n2", n1: "n11" },
			{ n0: "n0", n1: "n11" },
			{ n0: "n5", n1: "n8" },
			{ n0: "n5", n1: "n11" },
			{ n0: "n8", n1: "n9", svg: "leftlegup", x: -45, y: 0 },
			{ n0: "n9", n1: "n10", svg: "leftlegdown", x: -49, y: 0 },
			{ n0: "n11", n1: "n12", svg: "rightlegup", x: -45, y: 0 },
			{ n0: "n12", n1: "n13", svg: "rightlegdown", x: -30, y: 0 },
			{ n0: "n8", n1: "n11" },
			{ n0: "n1", n1: "n14", svg: "antenna", x: -14, y: 0, a: 0.26 }
		],
		svg: {
			head: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="130px" height="260px" viewBox="0 0 1300 2600" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${blue}" stroke="none">
			 <path d="M207 2592 l-168 -2 6 -23 c11 -35 127 -401 132 -414 3 -6 -35 -38 -83 -70 l-87 -58 101 -5 c56 -3 105 -9 110 -15 7 -8 139 -411 186 -571 6 -18 2 -23 -27 -28 -38 -7 -111 -65 -131 -105 -51 -98 -12 -224 85 -280 40 -23 137 -29 182 -12 24 9 25 7 65 -117 22 -70 44 -139 48 -155 3 -15 10 -29 14 -32 4 -2 40 94 81 215 41 121 76 220 79 220 3 0 71 -228 151 -507 142 -497 145 -507 126 -526 -13 -13 -17 -26 -12 -45 8 -33 4 -29 37 -37 29 -7 68 22 68 50 0 16 -30 50 -49 56 -10 4 -112 340 -256 846 l-58 202 29 83 29 83 55 6 c68 7 87 17 133 68 42 47 61 107 52 165 -10 54 -20 73 -66 122 l-39 40 140 413 c77 227 140 415 140 417 0 2 -181 4 -402 5 -222 0 -425 4 -453 7 -27 4 -126 6 -218 4z"/>
			</g>
			<g id="layer102" fill="${red}" stroke="none">
			 <path d="M250 2188 l-245 -163 115 -6 c118 -7 266 -16 403 -25 51 -3 77 -1 77 6 0 18 -92 334 -99 343 -4 4 -117 -66 -251 -155z"/>
			 <path d="M812 1745 c-86 -40 -128 -113 -120 -211 9 -107 93 -184 201 -184 73 0 113 17 159 68 79 87 73 207 -14 288 -45 43 -70 54 -128 58 -36 2 -63 -3 -98 -19z"/>
			 <path d="M345 1395 c-70 -38 -109 -91 -120 -165 -18 -122 77 -230 203 -230 72 0 107 12 145 48 96 90 88 243 -16 326 -33 27 -48 31 -110 34 -52 2 -80 -2 -102 -13z"/>
			 <path d="M763 1290 c4 -19 80 -289 170 -599 161 -555 163 -565 144 -584 -13 -13 -17 -26 -12 -45 8 -33 4 -29 37 -37 29 -7 68 22 68 50 0 16 -30 50 -49 56 -12 4 -66 183 -242 799 -102 356 -131 448 -116 360z"/>
			</g>
			<g id="layer103" fill="${yellow}" stroke="none">
			 <path d="M812 1745 c-86 -40 -128 -113 -120 -211 9 -107 93 -184 201 -184 73 0 113 17 159 68 79 87 73 207 -14 288 -45 43 -70 54 -128 58 -36 2 -63 -3 -98 -19z"/>
			 <path d="M345 1395 c-70 -38 -109 -91 -120 -165 -18 -122 77 -230 203 -230 72 0 107 12 145 48 96 90 88 243 -16 326 -33 27 -48 31 -110 34 -52 2 -80 -2 -102 -13z"/>
			 <path d="M763 1290 c4 -19 80 -289 170 -599 161 -555 163 -565 144 -584 -13 -13 -17 -26 -12 -45 8 -33 4 -29 37 -37 29 -7 68 22 68 50 0 16 -30 50 -49 56 -12 4 -66 183 -242 799 -102 356 -131 448 -116 360z"/>
			</g>
			<g id="layer104" fill="${white}" stroke="none">
			 <path d="M763 1290 c4 -19 80 -289 170 -599 161 -555 163 -565 144 -584 -13 -13 -17 -26 -12 -45 8 -33 4 -29 37 -37 29 -7 68 22 68 50 0 16 -30 50 -49 56 -12 4 -66 183 -242 799 -102 356 -131 448 -116 360z"/>
			</g>
			</svg>`,
			antenna: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="68px" height="113px" viewBox="0 0 680 1130" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${white}" stroke="none">
			 <path d="M262 1084 c-161 -80 -211 -288 -103 -434 20 -27 53 -59 73 -72 21 -13 38 -29 38 -35 0 -12 -95 -361 -124 -458 -17 -55 -20 -85 -8 -85 4 0 34 100 66 223 32 122 64 245 72 273 l15 51 43 -10 c139 -32 298 63 337 201 15 54 7 167 -15 210 -29 55 -88 114 -141 138 -73 34 -182 34 -253 -2z m239 -52 c147 -77 179 -255 67 -371 -53 -55 -91 -71 -170 -71 -92 0 -94 3 -69 92 23 80 26 108 12 93 -4 -6 -16 -41 -26 -80 -10 -38 -21 -74 -25 -78 -13 -15 -82 56 -106 108 -45 96 -28 185 51 262 82 80 171 95 266 45z"/>
			</g>
			</svg>`,
			body: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="193px" height="382px" viewBox="0 0 1930 3820" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${green}" stroke="none">
			 <path d="M975 3786 c-227 -52 -407 -205 -465 -395 -35 -113 -42 -107 122 -114 77 -4 143 -8 145 -11 8 -8 -53 -158 -108 -266 -130 -251 -361 -518 -604 -696 l-64 -47 50 -55 c104 -114 190 -269 231 -417 19 -68 22 -105 22 -250 -1 -157 -3 -179 -31 -285 -38 -145 -92 -287 -154 -412 l-49 -98 210 0 210 0 0 -357 0 -358 357 357 358 358 361 2 362 3 -69 110 c-330 527 -499 1138 -499 1804 0 200 21 466 45 578 l5 23 170 -7 170 -6 -6 34 c-23 140 -71 237 -164 329 -75 75 -167 132 -260 161 -84 27 -260 34 -345 15z"/>
			</g>
			<g id="layer102" fill="${red}" stroke="none">
			 <path d="M975 3786 c-227 -52 -407 -205 -465 -395 -35 -113 -42 -107 122 -114 77 -4 143 -8 145 -11 8 -8 -53 -158 -108 -266 -129 -249 -364 -522 -599 -692 -33 -24 -59 -47 -59 -53 0 -9 1879 -1485 1900 -1493 5 -2 -19 41 -53 95 -328 521 -498 1137 -498 1802 0 200 21 466 45 578 l5 23 170 -7 170 -6 -6 34 c-23 140 -71 237 -164 329 -75 75 -167 132 -260 161 -84 27 -260 34 -345 15z"/>
			 <path d="M490 383 l0 -358 355 355 c195 195 355 356 355 357 0 2 -160 3 -355 3 l-355 0 0 -357z"/>
			</g>
			<g id="layer103" fill="${blue}" stroke="none">
			 <path d="M756 3193 c-39 -110 -136 -293 -210 -396 -130 -182 -315 -372 -476 -489 -33 -24 -59 -47 -59 -53 0 -9 1879 -1485 1900 -1493 5 -2 -19 41 -53 95 -407 647 -574 1460 -467 2283 6 47 11 91 12 99 3 18 14 17 -324 25 l-296 8 -27 -79z"/>
			 <path d="M490 383 l0 -358 355 355 c195 195 355 356 355 357 0 2 -160 3 -355 3 l-355 0 0 -357z"/>
			</g>
			<g id="layer104" fill="${yellow}" stroke="none">
			 <path d="M1378 3249 c-16 -9 -1080 -773 -1275 -917 -51 -37 -92 -71 -92 -77 0 -9 1879 -1485 1900 -1493 5 -2 -19 41 -53 95 -327 520 -498 1136 -498 1799 0 171 13 359 34 507 7 48 10 89 7 92 -4 2 -14 -1 -23 -6z"/>
			 <path d="M490 383 l0 -358 355 355 c195 195 355 356 355 357 0 2 -160 3 -355 3 l-355 0 0 -357z"/>
			</g>
			<g id="layer105" fill="${white}" stroke="none">
			 <path d="M490 383 l0 -358 355 355 c195 195 355 356 355 357 0 2 -160 3 -355 3 l-355 0 0 -357z"/>
			</g>
			</svg>`,
			rightlegup: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="90px" height="211px" viewBox="0 0 900 2110" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${green}" stroke="none">
			 <path d="M315 2093 c-116 -42 -225 -136 -270 -235 -118 -261 19 -550 295 -622 l55 -14 -48 -13 c-26 -7 -46 -17 -44 -23 2 -7 172 -65 321 -109 5 -2 -44 -23 -110 -46 -212 -77 -226 -83 -217 -91 4 -4 86 -31 181 -60 94 -29 170 -56 166 -59 -3 -3 -84 -26 -180 -51 -96 -25 -175 -50 -175 -55 0 -5 71 -35 158 -66 l158 -57 -167 -53 c-93 -29 -168 -56 -168 -60 0 -4 8 -10 17 -13 10 -2 85 -26 168 -52 l149 -46 -149 -54 c-83 -30 -161 -59 -175 -65 -23 -11 -7 -18 165 -73 l190 -62 -110 -27 c-201 -51 -265 -69 -265 -77 0 -5 90 15 201 44 110 28 200 56 200 61 0 4 -79 33 -175 64 -97 30 -176 57 -176 60 0 4 67 30 148 59 150 54 180 67 172 75 -3 3 -76 27 -164 55 -87 27 -155 51 -150 54 5 3 78 27 161 53 84 27 153 52 153 56 0 8 -13 13 -207 84 -57 20 -103 38 -103 40 0 1 86 24 190 51 105 27 190 51 190 55 0 3 -78 30 -172 59 -95 29 -179 56 -187 60 -8 4 54 31 153 66 91 32 165 63 163 68 -2 5 -72 31 -157 58 -85 27 -156 51 -158 53 -8 8 103 35 144 35 161 0 343 141 394 306 39 127 19 281 -50 384 -41 62 -144 146 -210 172 -77 30 -235 36 -305 11z"/>
			</g>
			<g id="layer102" fill="#9fff9f" stroke="none">
			 <path d="M448 1881 l3 -232 164 157 c91 87 165 160 164 163 0 3 -23 25 -52 49 -61 50 -140 82 -222 89 l-60 5 3 -231z"/>
			 <path d="M311 1416 c2 -3 69 -28 149 -57 80 -28 149 -55 153 -59 7 -6 -91 -41 -250 -87 -35 -10 -62 -22 -60 -27 2 -7 174 -65 321 -109 5 -2 -44 -23 -110 -46 -212 -77 -226 -83 -217 -91 4 -4 86 -31 181 -60 94 -29 170 -56 166 -59 -3 -3 -83 -26 -179 -51 -95 -25 -173 -49 -175 -55 -1 -5 70 -35 157 -66 l158 -57 -167 -53 c-93 -29 -168 -56 -168 -60 0 -4 8 -10 17 -13 10 -2 85 -26 168 -52 l149 -46 -149 -54 c-83 -30 -161 -59 -175 -65 -23 -11 -7 -18 165 -73 l190 -62 -110 -27 c-201 -51 -265 -69 -265 -77 0 -5 90 15 201 44 110 28 200 56 200 61 0 4 -79 33 -175 64 -97 30 -176 57 -176 60 0 4 67 30 148 59 150 54 180 67 172 75 -3 3 -76 27 -164 55 -87 27 -155 51 -150 54 5 3 78 27 161 53 84 27 153 52 153 56 0 8 -13 13 -207 84 -57 20 -103 38 -103 40 0 1 86 24 190 51 105 27 190 51 190 55 0 3 -78 30 -173 59 -94 29 -178 56 -186 60 -8 4 54 31 153 66 91 32 165 63 163 68 -2 5 -72 31 -157 58 -85 27 -156 51 -158 53 -2 1 43 17 100 35 177 54 212 66 215 76 1 5 -70 35 -160 67 -143 50 -200 67 -186 53z"/>
			</g>
			<g id="layer103" fill="${white}" stroke="none">
			 <path d="M450 1884 c0 -217 1 -225 18 -212 11 7 85 77 167 155 l147 142 -37 33 c-21 18 -50 41 -64 51 -37 24 -146 57 -192 57 l-39 0 0 -226z"/>
			 <path d="M462 1362 c86 -32 159 -60 162 -63 6 -5 -172 -64 -277 -91 -26 -7 -46 -16 -44 -22 2 -7 172 -65 321 -109 5 -2 -44 -23 -110 -46 -212 -77 -226 -83 -217 -91 4 -4 86 -31 181 -60 94 -29 170 -56 166 -59 -3 -3 -83 -26 -179 -51 -95 -25 -173 -49 -175 -55 -1 -5 70 -35 157 -66 l158 -57 -167 -53 c-93 -29 -168 -56 -168 -60 0 -4 8 -10 17 -13 10 -2 85 -26 168 -52 l149 -46 -149 -54 c-83 -30 -161 -59 -175 -65 -23 -11 -7 -18 165 -73 l190 -62 -110 -27 c-201 -51 -265 -69 -265 -77 0 -5 90 15 201 44 110 28 200 56 200 61 0 4 -79 33 -175 64 -97 30 -176 57 -176 60 0 4 67 30 148 59 150 54 180 67 172 75 -3 3 -76 27 -164 55 -87 27 -155 51 -150 54 5 3 78 27 161 53 84 27 153 52 153 56 0 8 -13 13 -207 84 -57 20 -103 38 -103 40 0 1 86 24 190 51 105 27 190 51 190 55 0 3 -78 30 -173 59 -94 29 -178 56 -186 60 -8 4 54 31 153 66 91 32 165 63 163 68 -2 5 -72 31 -157 58 -85 27 -156 51 -158 53 -2 2 69 27 158 55 89 29 158 56 153 60 -11 10 -320 120 -336 119 -6 0 59 -26 145 -57z"/>
			</g>
			</svg>`,
			rightlegdown: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="60px" height="212px" viewBox="0 0 600 2120" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${red}" stroke="none">
			 <path d="M184 2096 c-69 -32 -120 -79 -152 -140 -22 -43 -26 -64 -26 -136 -1 -70 3 -93 22 -127 51 -97 137 -157 240 -170 l52 -6 0 -759 c0 -504 3 -757 10 -753 7 4 10 270 10 764 l0 758 39 7 c85 13 186 113 212 209 16 59 5 157 -25 215 -49 97 -155 162 -266 162 -47 0 -79 -7 -116 -24z"/>
			</g>
			<g id="layer102" fill="${white}" stroke="none">
			 <path d="M320 759 c0 -504 3 -758 10 -754 7 4 10 268 10 761 0 496 -3 754 -10 754 -7 0 -10 -260 -10 -761z"/>
			</g>
			</svg>`,
			leftlegup: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="90px" height="227px" viewBox="0 0 900 2270" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${red}" stroke="none">
			 <path d="M20 1830 l0 -440 440 0 440 0 0 440 0 440 -440 0 -440 0 0 -440z"/>
			 <path d="M289 1357 c-72 -30 -102 -52 -167 -121 -164 -174 -158 -446 15 -619 71 -72 158 -117 242 -124 l61 -6 0 -243 0 -244 40 0 41 0 -3 244 -3 244 39 6 c114 19 251 131 307 251 41 87 51 212 24 311 -33 122 -127 235 -244 291 -50 24 -69 28 -176 30 -108 3 -126 1 -176 -20z"/>
			</g>
			<g id="layer102" fill="${blue}" stroke="none">
			 <path d="M460 1828 l-435 -438 438 0 437 0 0 440 c0 242 -1 439 -2 438 -2 0 -199 -198 -438 -440z"/>
			 <path d="M289 1357 c-72 -30 -102 -52 -167 -121 -164 -174 -158 -446 15 -619 71 -72 158 -117 242 -124 l61 -6 0 -243 0 -244 40 0 41 0 -3 244 -3 244 39 6 c114 19 251 131 307 251 41 87 51 212 24 311 -33 122 -127 235 -244 291 -50 24 -69 28 -176 30 -108 3 -126 1 -176 -20z"/>
			</g>
			<g id="layer103" fill="${yellow}" stroke="none">
			 <path d="M460 1828 l-435 -438 438 0 437 0 0 440 c0 242 -1 439 -2 438 -2 0 -199 -198 -438 -440z"/>
			 <path d="M450 711 l0 -220 28 -4 c25 -4 25 -4 -5 -6 l-33 -1 0 -240 0 -240 40 0 41 0 -3 244 -3 244 39 6 c161 26 325 205 342 374 l7 62 -227 0 -226 0 0 -219z"/>
			</g>
			<g id="layer104" fill="${white}" stroke="none">
			 <path d="M460 1825 l-435 -435 438 0 437 0 0 435 c0 239 -1 435 -3 435 -1 0 -198 -196 -437 -435z"/>
			 <path d="M450 709 l0 -222 68 5 c182 13 359 188 378 376 l7 62 -227 0 -226 0 0 -221z"/>
			</g>
			</svg>`,
			leftlegdown: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="61px" height="213px" viewBox="0 0 610 2130" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${green}" stroke="none">
			 <path d="M0 2000 l0 -130 190 0 190 0 0 -935 0 -935 110 0 110 0 0 863 c0 474 3 953 7 1065 l6 202 -306 0 -307 0 0 -130z"/>
			</g>
			<g id="layer102" fill="${yellow}" stroke="none">
			 <path d="M0 2000 l0 -129 305 -3 305 -3 0 133 0 132 -305 0 -305 0 0 -130z"/>
			 <path d="M380 675 l0 -155 110 0 110 0 0 155 0 155 -110 0 -110 0 0 -155z"/>
			</g>
			<g id="layer103" fill="${white}" stroke="none">
			 <path d="M380 675 l0 -155 110 0 110 0 0 155 0 155 -110 0 -110 0 0 -155z"/>
			</g>
			</svg>`,
			rightarmup: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="113px" height="172px" viewBox="0 0 1130 1720" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${white}" stroke="none">
			 <path d="M686 1691 c-5 -7 -580 -1544 -613 -1636 -7 -22 -10 -35 -5 -30 24 28 1033 1517 1030 1521 -5 4 -164 65 -315 119 -51 19 -95 30 -97 26z"/>
			</g>
			</svg>`,
			rightarmdown: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="128px" height="130px" viewBox="0 0 1280 1300" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${yellow}" stroke="none">
			 <path d="M231 809 c-46 -115 -82 -211 -80 -213 12 -10 813 -306 821 -304 8 3 144 290 170 360 5 12 -18 4 -85 -27 -126 -60 -223 -85 -324 -85 -113 0 -178 25 -247 95 -74 75 -110 154 -163 352 -7 30 -14 18 -92 -178z"/>
			</g>
			</svg>`,
			leftarmup: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="162px" height="230px" viewBox="0 0 1620 2300" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${blue}" stroke="none">
			 <path d="M26 2174 c-13 -35 -4 -41 113 -69 l118 -28 -24 -95 c-13 -52 -22 -100 -19 -107 2 -7 37 -20 78 -30 40 -10 79 -21 85 -24 8 -4 -13 -21 -53 -45 -37 -21 -64 -43 -61 -49 3 -9 1000 -1708 1011 -1724 3 -4 344 202 341 207 -15 27 -982 1673 -997 1697 l-19 32 -62 -37 -62 -38 -94 22 c-51 13 -95 25 -97 26 -1 2 8 48 22 102 14 55 21 102 17 106 -9 8 -254 70 -277 70 -7 0 -17 -7 -20 -16z"/>
			</g>
			<g id="layer102" fill="${red}" stroke="none">
			 <path d="M26 2174 c-13 -35 -4 -41 113 -69 l118 -28 -24 -95 c-13 -52 -22 -100 -19 -107 2 -7 37 -20 78 -30 40 -10 79 -21 85 -24 8 -4 -12 -21 -52 -44 -36 -21 -65 -40 -65 -43 0 -3 59 -106 130 -228 l131 -222 544 -544 c299 -299 546 -542 549 -539 2 2 -198 348 -445 769 -247 421 -477 811 -510 867 l-60 102 -62 -37 -62 -38 -94 22 c-51 13 -95 25 -97 26 -1 2 8 48 22 102 14 55 21 102 17 106 -9 8 -254 70 -277 70 -7 0 -17 -7 -20 -16z"/>
			</g>
			<g id="layer103" fill="${white}" stroke="none">
			 <path d="M535 1901 c-39 -24 -61 -46 -65 -62 -5 -20 -12 -24 -45 -25 -27 0 -60 -13 -102 -38 -35 -20 -63 -39 -63 -42 0 -3 59 -106 130 -228 l131 -222 544 -544 c299 -299 546 -542 549 -539 4 4 -971 1671 -1006 1718 -12 18 -16 17 -73 -18z"/>
			</g>
			</svg>`,
			leftarmdown: `<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="97px" height="97px" viewBox="0 0 970 970" preserveAspectRatio="xMidYMid meet">
			<g id="layer101" fill="${blue}" stroke="none">
			 <path d="M439 876 c-130 -38 -280 -158 -332 -266 -68 -141 -75 -306 -20 -433 9 -21 22 -37 28 -35 7 2 197 131 423 288 l412 284 -38 39 c-79 82 -189 126 -332 132 -62 3 -111 0 -141 -9z"/>
			</g>
			</svg>`
		}
	})
);
//////////////////////////////////////////
// loading textures
const load = () => {
	let n = 0;
	robots.forEach(robot => {
		n += robot.load(canvas);
	});
	if (n < robots.length) requestAnimationFrame(load);
	else {
		then = performance.now();
    startTime = then;
		run(startTime);
	}
};
// sound
const playSound = (h0, h1) => {
	const a = pointer.drag.robot === robots[0] ? 500 : 100;
	const dx = h0.x - h1.x;
	const dy = h0.y - h1.y;
	const d = Math.sqrt(dx * dx + dy * dy) * (a === 0 ? 0.25 : 0.5);
	sound.effect(Math.round(d + a));
}
// animation loop
const fpsInterval = 1000 / 60;
let then, startTime, now, elapsed;
const run = (newtime) => {
	requestAnimationFrame(run);
	now = newtime;
  elapsed = now - then;
	if (elapsed > fpsInterval) {
		then = now - (elapsed % fpsInterval);
		canvas.clear();
		robots.forEach(robot => robot.dance(canvas, pointer));
		if (pointer.drag !== null) {
			playSound(
				robots[0].nodes[0],
				robots[1].nodes[0]
			);
		}
	}
};
// start
load();