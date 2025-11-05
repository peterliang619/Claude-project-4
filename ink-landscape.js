// Ink Wash Landscape Interactive Experience

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Set canvas size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Color palette
const COLORS = {
    background: '#f5f5f0',
    ink: '#000000',
    green: '#4a7c59'
};

// State management
const state = {
    mountains: [],
    lifeElements: [],
    inkDrops: [],
    inkAccumulations: new Map(),
    waterfalls: [],
    pools: [],
    zoomMode: false,
    zoomTarget: null,
    zoomLevel: 1,
    viewOffset: { x: 0, y: 0 },
    isDragging: false,
    dragStart: null,
    historicalTraces: []
};

// Mountain Landscape Generator
class Mountain {
    constructor() {
        this.points = this.generateMountainLine();
        this.fractured = false;
        this.fractureSegments = [];
    }

    generateMountainLine() {
        const points = [];
        const layers = 3;

        for (let layer = 0; layer < layers; layer++) {
            const y = canvas.height * (0.3 + layer * 0.15);
            const layerPoints = [];

            layerPoints.push({ x: 0, y: y + 50 });

            const peakCount = 5 + layer * 2;
            for (let i = 0; i < peakCount; i++) {
                const x = (canvas.width / peakCount) * (i + 0.5);
                const peakHeight = 80 - layer * 20 + Math.random() * 40;
                const peakY = y - peakHeight;

                const valleyX = x - canvas.width / peakCount / 2;
                const valleyY = y + Math.random() * 20;

                if (i > 0) {
                    layerPoints.push({ x: valleyX, y: valleyY });
                }
                layerPoints.push({ x: x, y: peakY });
            }

            layerPoints.push({ x: canvas.width, y: y + 50 });
            points.push({ layer, points: layerPoints });
        }

        return points;
    }

    draw() {
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (this.fractured) {
            this.drawFractured();
        } else {
            this.drawIntact();
        }
    }

    drawIntact() {
        this.points.forEach(({ points: layerPoints }) => {
            ctx.beginPath();
            ctx.moveTo(layerPoints[0].x, layerPoints[0].y);

            for (let i = 1; i < layerPoints.length; i++) {
                ctx.lineTo(layerPoints[i].x, layerPoints[i].y);
            }

            ctx.stroke();
        });
    }

    drawFractured() {
        this.fractureSegments.forEach(segment => {
            if (!segment.fallen) {
                ctx.save();
                ctx.translate(segment.x, segment.y);
                ctx.rotate(segment.rotation);

                ctx.beginPath();
                ctx.moveTo(segment.points[0].x, segment.points[0].y);
                for (let i = 1; i < segment.points.length; i++) {
                    ctx.lineTo(segment.points[i].x, segment.points[i].y);
                }
                ctx.stroke();

                ctx.restore();
            }
        });
    }

    fracture(nearX, nearY) {
        if (this.fractured) return;

        this.fractured = true;
        this.fractureSegments = [];

        this.points.forEach(({ points: layerPoints }) => {
            let currentSegment = [];

            for (let i = 0; i < layerPoints.length; i++) {
                currentSegment.push(layerPoints[i]);

                if (Math.random() > 0.7 || i === layerPoints.length - 1) {
                    if (currentSegment.length > 1) {
                        const centerX = currentSegment.reduce((sum, p) => sum + p.x, 0) / currentSegment.length;
                        const centerY = currentSegment.reduce((sum, p) => sum + p.y, 0) / currentSegment.length;

                        const relativePoints = currentSegment.map(p => ({
                            x: p.x - centerX,
                            y: p.y - centerY
                        }));

                        this.fractureSegments.push({
                            x: centerX,
                            y: centerY,
                            points: relativePoints,
                            rotation: 0,
                            rotationSpeed: (Math.random() - 0.5) * 0.02,
                            velocityY: 0,
                            fallen: false
                        });
                    }
                    currentSegment = [layerPoints[i]];
                }
            }
        });
    }
}

// Life Elements
class LifeElement {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'tree', 'bird', 'person'
        this.scale = 0;
        this.targetScale = 1;
        this.haloRadius = 0;
        this.alive = true;
        this.falling = false;
        this.velocityY = 0;
        this.rotation = 0;
        this.rotationSpeed = 0;
        this.sinking = false;
        this.sinkDepth = 0;
        this.opacity = 1;
    }

    grow(deltaTime) {
        if (this.scale < this.targetScale) {
            this.scale += deltaTime * 0.002;
            this.haloRadius = this.scale * 30;
        }
    }

    fall(deltaTime) {
        if (this.falling) {
            this.velocityY += 0.5; // gravity
            this.y += this.velocityY * deltaTime * 0.016;
            this.rotation += this.rotationSpeed * deltaTime * 0.016;
        }
    }

    sink(deltaTime) {
        if (this.sinking) {
            this.sinkDepth += deltaTime * 0.05;
            this.opacity = Math.max(0, 1 - this.sinkDepth);
        }
    }

    draw() {
        if (!this.alive || this.opacity <= 0) return;

        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale, this.scale);

        // Draw green halo
        if (this.haloRadius > 0) {
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.haloRadius);
            gradient.addColorStop(0, `${COLORS.green}40`);
            gradient.addColorStop(0.6, `${COLORS.green}20`);
            gradient.addColorStop(1, `${COLORS.green}00`);
            ctx.fillStyle = gradient;
            ctx.fillRect(-this.haloRadius, -this.haloRadius, this.haloRadius * 2, this.haloRadius * 2);
        }

        // Draw silhouette
        ctx.fillStyle = COLORS.ink;

        switch (this.type) {
            case 'tree':
                this.drawTree();
                break;
            case 'bird':
                this.drawBird();
                break;
            case 'person':
                this.drawPerson();
                break;
        }

        ctx.restore();
    }

    drawTree() {
        // Trunk
        ctx.fillRect(-3, -40, 6, 40);

        // Branches
        ctx.beginPath();
        ctx.moveTo(0, -40);
        ctx.lineTo(-15, -55);
        ctx.lineTo(-10, -55);
        ctx.lineTo(0, -43);
        ctx.lineTo(10, -55);
        ctx.lineTo(15, -55);
        ctx.closePath();
        ctx.fill();

        // Canopy
        ctx.beginPath();
        ctx.arc(0, -55, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(-12, -50, 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(12, -50, 15, 0, Math.PI * 2);
        ctx.fill();
    }

    drawBird() {
        // Body
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wings
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.quadraticCurveTo(-20, -5, -25, 0);
        ctx.quadraticCurveTo(-20, 2, -8, 2);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.quadraticCurveTo(20, -5, 25, 0);
        ctx.quadraticCurveTo(20, 2, 8, 2);
        ctx.closePath();
        ctx.fill();

        // Tail
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.lineTo(-3, 18);
        ctx.lineTo(0, 17);
        ctx.lineTo(3, 18);
        ctx.closePath();
        ctx.fill();

        // Beak
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(-2, -12);
        ctx.lineTo(2, -12);
        ctx.closePath();
        ctx.fill();
    }

    drawPerson() {
        // Head
        ctx.beginPath();
        ctx.arc(0, -25, 6, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillRect(-4, -19, 8, 15);

        // Legs
        ctx.beginPath();
        ctx.moveTo(-3, -4);
        ctx.lineTo(-5, 8);
        ctx.lineTo(-3, 8);
        ctx.lineTo(-1, -4);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(3, -4);
        ctx.lineTo(5, 8);
        ctx.lineTo(3, 8);
        ctx.lineTo(1, -4);
        ctx.fill();

        // Arms
        ctx.beginPath();
        ctx.moveTo(-4, -15);
        ctx.lineTo(-10, -8);
        ctx.lineTo(-8, -7);
        ctx.lineTo(-3, -13);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(4, -15);
        ctx.lineTo(10, -8);
        ctx.lineTo(8, -7);
        ctx.lineTo(3, -13);
        ctx.fill();
    }

    drawDetail() {
        // Enhanced details for zoom mode
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale, this.scale);

        ctx.fillStyle = COLORS.ink;
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 0.5;

        switch (this.type) {
            case 'tree':
                this.drawTreeDetail();
                break;
            case 'bird':
                this.drawBirdDetail();
                break;
            case 'person':
                this.drawPersonDetail();
                break;
        }

        ctx.restore();
    }

    drawTreeDetail() {
        // Detailed trunk with bark texture
        for (let i = 0; i < 40; i += 3) {
            ctx.strokeStyle = COLORS.ink;
            ctx.beginPath();
            ctx.moveTo(-3 + Math.random(), -i);
            ctx.lineTo(-3 + Math.random() * 2, -i - 2);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(3 - Math.random(), -i);
            ctx.lineTo(3 - Math.random() * 2, -i - 2);
            ctx.stroke();
        }

        // Leaf details
        const leafPositions = [
            { x: 0, y: -55 }, { x: -12, y: -50 }, { x: 12, y: -50 },
            { x: -6, y: -58 }, { x: 6, y: -58 }, { x: -8, y: -47 }, { x: 8, y: -47 }
        ];

        leafPositions.forEach(pos => {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    drawBirdDetail() {
        // Draw the main body
        ctx.fillStyle = COLORS.ink;
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Feather details
        const featherCount = 12;
        for (let i = 0; i < featherCount; i++) {
            const angle = (i / featherCount) * Math.PI * 2;
            const x = Math.cos(angle) * 7;
            const y = Math.sin(angle) * 10;

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x * 1.3, y * 1.3);
            ctx.stroke();
        }

        // Eye detail
        ctx.fillStyle = COLORS.ink;
        ctx.beginPath();
        ctx.arc(-2, -3, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    drawPersonDetail() {
        // Head with detail
        ctx.beginPath();
        ctx.arc(0, -25, 6, 0, Math.PI * 2);
        ctx.fill();

        // Body with garment folds
        ctx.fillRect(-4, -19, 8, 15);

        // Garment fold lines
        for (let i = -18; i < -4; i += 3) {
            ctx.beginPath();
            ctx.moveTo(-3, i);
            ctx.quadraticCurveTo(0, i + 1, 3, i);
            ctx.stroke();
        }

        // Detailed legs and arms with same fold technique
        ctx.fillStyle = COLORS.ink;

        // Left leg
        ctx.beginPath();
        ctx.moveTo(-3, -4);
        ctx.lineTo(-5, 8);
        ctx.lineTo(-3, 8);
        ctx.lineTo(-1, -4);
        ctx.fill();

        // Right leg
        ctx.beginPath();
        ctx.moveTo(3, -4);
        ctx.lineTo(5, 8);
        ctx.lineTo(3, 8);
        ctx.lineTo(1, -4);
        ctx.fill();

        // Arms
        ctx.beginPath();
        ctx.moveTo(-4, -15);
        ctx.lineTo(-10, -8);
        ctx.lineTo(-8, -7);
        ctx.lineTo(-3, -13);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(4, -15);
        ctx.lineTo(10, -8);
        ctx.lineTo(8, -7);
        ctx.lineTo(3, -13);
        ctx.fill();
    }
}

// Ink Drop
class InkDrop {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.velocityY = 0;
        this.radius = 3;
        this.landed = false;
        this.rippleRadius = 0;
        this.opacity = 1;
    }

    update(deltaTime) {
        if (!this.landed) {
            this.velocityY += 0.3;
            this.y += this.velocityY * deltaTime * 0.016;

            // Check if landed on mountain line
            if (this.y > canvas.height * 0.4) {
                this.landed = true;
            }
        } else {
            this.rippleRadius += deltaTime * 0.1;
            this.opacity = Math.max(0, 1 - this.rippleRadius / 30);
        }
    }

    draw() {
        ctx.fillStyle = COLORS.green;
        ctx.globalAlpha = this.opacity;

        if (!this.landed) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Ripple effect
            ctx.strokeStyle = COLORS.green;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.rippleRadius, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }

    isComplete() {
        return this.landed && this.opacity <= 0;
    }
}

// Waterfall
class Waterfall {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.particles = [];
        this.active = true;
        this.duration = 0;
        this.maxDuration = 3000;

        // Create initial burst
        for (let i = 0; i < 50; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 5,
                vy: Math.random() * -5 - 5,
                life: 1,
                size: Math.random() * 4 + 2
            });
        }
    }

    update(deltaTime) {
        this.duration += deltaTime;

        // Add new particles
        if (this.duration < this.maxDuration) {
            for (let i = 0; i < 3; i++) {
                this.particles.push({
                    x: this.x + (Math.random() - 0.5) * 20,
                    y: this.y,
                    vx: (Math.random() - 0.5) * 3,
                    vy: Math.random() * 2,
                    life: 1,
                    size: Math.random() * 3 + 1
                });
            }
        } else {
            this.active = false;
        }

        // Update particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.3; // gravity
            p.life -= 0.01;
            return p.life > 0 && p.y < canvas.height;
        });
    }

    draw() {
        this.particles.forEach(p => {
            ctx.fillStyle = COLORS.green;
            ctx.globalAlpha = p.life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    isComplete() {
        return !this.active && this.particles.length === 0;
    }

    getBottomY() {
        return Math.max(...this.particles.map(p => p.y), this.y);
    }
}

// Pool
class Pool {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = 100;
        this.expanding = true;
        this.opacity = 0.6;
        this.ripples = [];
    }

    update(deltaTime) {
        if (this.expanding) {
            this.radius += deltaTime * 0.05;

            if (this.radius >= this.maxRadius) {
                this.expanding = false;
            }

            // Create ripples
            if (Math.random() > 0.95) {
                this.ripples.push({
                    radius: this.radius * 0.3,
                    maxRadius: this.radius,
                    opacity: 0.5
                });
            }
        } else {
            this.opacity -= deltaTime * 0.0002;
        }

        // Update ripples
        this.ripples = this.ripples.filter(ripple => {
            ripple.radius += deltaTime * 0.02;
            ripple.opacity -= deltaTime * 0.001;
            return ripple.opacity > 0;
        });
    }

    draw() {
        // Main pool
        ctx.fillStyle = COLORS.green;
        ctx.globalAlpha = this.opacity;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Ripples
        this.ripples.forEach(ripple => {
            ctx.strokeStyle = COLORS.green;
            ctx.globalAlpha = ripple.opacity;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, ripple.radius, 0, Math.PI * 2);
            ctx.stroke();
        });

        ctx.globalAlpha = 1;
    }

    isComplete() {
        return this.opacity <= 0;
    }
}

// Interaction Management
let lastClickTime = 0;
let lastClickPos = null;

function handleClick(e) {
    if (state.zoomMode) return;

    const x = e.clientX;
    const y = e.clientY;
    const now = Date.now();

    // Check for rapid clicking (accumulation)
    const isRapidClick = lastClickPos &&
                        Math.abs(x - lastClickPos.x) < 50 &&
                        Math.abs(y - lastClickPos.y) < 50 &&
                        now - lastClickTime < 500;

    if (isRapidClick) {
        // Accumulate ink
        const key = `${Math.floor(x / 50)}_${Math.floor(y / 50)}`;
        const current = state.inkAccumulations.get(key) || 0;
        state.inkAccumulations.set(key, current + 1);

        // Burst threshold
        if (current + 1 >= 5) {
            triggerBurst(x, y);
            state.inkAccumulations.delete(key);
        }
    } else {
        // Gentle touch - create life
        const inkDrop = new InkDrop(x, y);
        state.inkDrops.push(inkDrop);

        // After ink lands, create life element
        setTimeout(() => {
            const types = ['tree', 'bird', 'person'];
            const type = types[Math.floor(Math.random() * types.length)];
            const element = new LifeElement(x, y, type);
            state.lifeElements.push(element);
        }, 500);
    }

    lastClickTime = now;
    lastClickPos = { x, y };
}

function handleRightClick(e) {
    e.preventDefault();

    if (!state.zoomMode) {
        // Enter zoom mode
        state.zoomMode = true;
        state.zoomTarget = { x: e.clientX, y: e.clientY };
        state.zoomLevel = 1;

        // Animate zoom
        animateZoom(3, 500);
    } else {
        // Exit zoom mode
        animateZoom(1, 500, () => {
            state.zoomMode = false;
            state.zoomTarget = null;
            state.viewOffset = { x: 0, y: 0 };
        });
    }
}

function animateZoom(targetZoom, duration, callback) {
    const startZoom = state.zoomLevel;
    const startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeInOutCubic(progress);

        state.zoomLevel = startZoom + (targetZoom - startZoom) * eased;

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else if (callback) {
            callback();
        }
    }

    animate();
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function handleMouseDown(e) {
    if (state.zoomMode && e.button === 0) {
        state.isDragging = true;
        state.dragStart = { x: e.clientX, y: e.clientY };
    }
}

function handleMouseMove(e) {
    if (state.isDragging) {
        const dx = e.clientX - state.dragStart.x;
        const dy = e.clientY - state.dragStart.y;

        state.viewOffset.x += dx;
        state.viewOffset.y += dy;

        state.dragStart = { x: e.clientX, y: e.clientY };
    }
}

function handleMouseUp() {
    state.isDragging = false;
}

function triggerBurst(x, y) {
    // Create waterfall
    const waterfall = new Waterfall(x, y);
    state.waterfalls.push(waterfall);

    // Fracture nearby mountains
    state.mountains.forEach(mountain => {
        mountain.fracture(x, y);
    });

    // Make nearby life elements fall
    state.lifeElements.forEach(element => {
        const distance = Math.sqrt(Math.pow(element.x - x, 2) + Math.pow(element.y - y, 2));
        if (distance < 200) {
            element.falling = true;
            element.rotationSpeed = (Math.random() - 0.5) * 0.1;
        }
    });
}

// Animation Loop
let lastTime = Date.now();

function animate() {
    const now = Date.now();
    const deltaTime = now - lastTime;
    lastTime = now;

    // Clear canvas
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();

    // Apply zoom and pan transforms
    if (state.zoomMode) {
        const targetX = state.zoomTarget.x;
        const targetY = state.zoomTarget.y;

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(state.zoomLevel, state.zoomLevel);
        ctx.translate(-targetX + state.viewOffset.x, -targetY + state.viewOffset.y);

        // Dim surroundings
        ctx.globalAlpha = 0.3;
    }

    // Draw mountains
    state.mountains.forEach(mountain => {
        mountain.draw();
    });

    // Update and draw ink drops
    state.inkDrops = state.inkDrops.filter(drop => {
        drop.update(deltaTime);
        drop.draw();
        return !drop.isComplete();
    });

    // Update and draw life elements
    state.lifeElements.forEach(element => {
        element.grow(deltaTime);
        element.fall(deltaTime);
        element.sink(deltaTime);

        if (state.zoomMode) {
            ctx.globalAlpha = 1;
            element.drawDetail();
        } else {
            element.draw();
        }
    });

    // Update and draw waterfalls
    state.waterfalls = state.waterfalls.filter(waterfall => {
        waterfall.update(deltaTime);
        waterfall.draw();

        // Create pool when waterfall reaches bottom
        if (!waterfall.active && waterfall.particles.length < 10) {
            const bottomY = waterfall.getBottomY();
            if (bottomY > canvas.height * 0.8) {
                const existingPool = state.pools.find(p =>
                    Math.abs(p.x - waterfall.x) < 100 && Math.abs(p.y - bottomY) < 100
                );

                if (!existingPool) {
                    state.pools.push(new Pool(waterfall.x, bottomY));
                }
            }
        }

        return !waterfall.isComplete();
    });

    // Update and draw pools
    state.pools = state.pools.filter(pool => {
        pool.update(deltaTime);
        pool.draw();

        // Sink nearby elements
        state.lifeElements.forEach(element => {
            if (element.falling) {
                const distance = Math.sqrt(
                    Math.pow(element.x - pool.x, 2) +
                    Math.pow(element.y - pool.y, 2)
                );

                if (distance < pool.radius && element.y > pool.y - 50) {
                    element.falling = false;
                    element.sinking = true;
                    element.velocityY = 0;
                }
            }
        });

        return !pool.isComplete();
    });

    // Update fractured mountain segments
    state.mountains.forEach(mountain => {
        if (mountain.fractured) {
            mountain.fractureSegments.forEach(segment => {
                if (!segment.fallen && segment.y < canvas.height + 100) {
                    segment.velocityY += 0.5;
                    segment.y += segment.velocityY;
                    segment.rotation += segment.rotationSpeed;
                } else if (segment.y >= canvas.height + 100) {
                    segment.fallen = true;
                }
            });
        }
    });

    // Clean up dead elements
    state.lifeElements = state.lifeElements.filter(element => element.opacity > 0);

    ctx.restore();

    requestAnimationFrame(animate);
}

// Event Listeners
canvas.addEventListener('click', handleClick);
canvas.addEventListener('contextmenu', handleRightClick);
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);

// Initialize
state.mountains.push(new Mountain());
animate();
