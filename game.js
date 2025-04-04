const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Define logical game dimensions
const logicalWidth = 400;
const logicalHeight = 600;

// Variables for scaling and centering
let scale = 1;
let offsetX = 0;
let offsetY = 0;
const maxScale = 1.5; // <--- Changed from 2.0: Limit maximum scaling factor

// Get actual canvas dimensions (will be updated on resize)
let canvasWidth = window.innerWidth;
let canvasHeight = window.innerHeight;

// 游戏状态
let score = 0;
let gameover = false;
let difficulty = 0; // 难度值，随时间/高度增加
let previousDifficulty = 0; // 用于跟踪难度变化

// 云朵数组和参数
let clouds = [];
const initialClouds = 5;
const cloudMinYSpacing = 200;
const cloudMaxYSpacing = 400;
const cloudMinWidth = 60;
const cloudMaxWidth = 120;
const cloudMinHeight = 20;
const cloudMaxHeight = 40;
const cloudMinSpeed = 0.1;
const cloudMaxSpeed = 0.5;

// 玩家对象 (Use logical dimensions)
const player = {
    x: logicalWidth / 2 - 25,
    y: logicalHeight - 100, // Position relative to logical height
    width: 50,
    height: 50,
    vx: 0, // 水平速度
    vy: 0, // 垂直速度
    gravity: 0.55,
    jumpPower: -16, // 起跳力度（负数表示向上）
    isJumping: false,
    onGround: false
};

// 平台数组 (Use logical dimensions)
let platforms = [];
const platformWidth = 70;
const platformHeight = 15;
const initialPlatforms = 5; // 初始平台数量
// Base Spacing (at difficulty 0)
const basePlatformMinYSpacing = 60;
const basePlatformMaxYSpacing = 200;
// Max Spacing (at difficulty 1)
const maxPlatformMinYSpacing = 80;
const maxPlatformMaxYSpacing = 240;

// 游戏控制
let keys = {};
let touchStartX = null; // Store logical X coordinate
let isTouching = false;
const moveSpeed = 5; // 水平移动速度
const friction = 0.95; // 摩擦系数 (0 < friction < 1)

// --- Resize Handler ---
function resizeHandler() {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Calculate scale factor based on width, capped by maxScale
    scale = Math.min(canvasWidth / logicalWidth, maxScale); // <--- MODIFIED

    // Calculate horizontal offset for centering
    const scaledLogicalWidth = logicalWidth * scale;
    offsetX = (canvasWidth - scaledLogicalWidth) / 2; // <--- MODIFIED

    // Calculate vertical offset to anchor the bottom of the logical view to the canvas bottom
    const scaledLogicalHeight = logicalHeight * scale;
    offsetY = canvasHeight - scaledLogicalHeight; // <--- MODIFIED (Bottom Anchoring)

    // Redraw immediately after resize
    if (!gameLoopRunning && gameover) {
        drawGameOver(); // Redraw game over screen if game is finished
    } else if (!gameLoopRunning) {
        // Could draw an initial screen or just wait for game start
        draw(); // Draw current state if paused or before start
    }
}

// --- Initialization and Platform Creation (Use Logical Dimensions) ---
function init() {
    score = 0;
    gameover = false;
    difficulty = 0;
    previousDifficulty = 0;
    player.x = logicalWidth / 2 - player.width / 2;
    player.y = logicalHeight - 100; // Initial pos relative to logical height
    player.vx = 0;
    player.vy = 0;
    player.isJumping = false;
    player.onGround = false;
    platforms = [];
    clouds = [];

    // Create initial platforms within logical coordinate space
    for (let i = 0; i < initialPlatforms; i++) {
        let yPos = logicalHeight - 50 - i * ((basePlatformMinYSpacing + basePlatformMaxYSpacing) / 2);
        createPlatform(Math.random() * (logicalWidth - platformWidth), yPos, 'normal');
    }
    platforms[0].x = player.x + (player.width - platformWidth) / 2;
    platforms[0].y = player.y + player.height;
    platforms[0].type = 'normal';

    // 创建初始云朵 (分布在初始可见区域)
    for (let i = 0; i < initialClouds; i++) {
        let yPos = logicalHeight - (Math.random() * logicalHeight * 1.5); // Spread initial clouds higher
        createCloud(Math.random() * logicalWidth, yPos);
    }

    keys = {};
    touchStartX = null;
    isTouching = false;

    // Ensure resize handler runs at least once initially
    resizeHandler();

    if (!gameLoopRunning) {
        requestAnimationFrame(gameLoop);
        gameLoopRunning = true;
    }
}

// createPlatform remains the same, works in logical coordinates
function createPlatform(x, y, forcedType = null) {
    let type = 'normal';
    if (!forcedType) { // Only determine type randomly if not forced
        const rand = Math.random();
        const movingThreshold = 0.2;
        const breakableThreshold = 0.5;
        let movingProb = 0;
        let breakableProb = 0;
        if (difficulty >= movingThreshold) {
            movingProb = 0.1 + 0.2 * ((difficulty - movingThreshold) / (1 - movingThreshold));
        }
        if (difficulty >= breakableThreshold) {
            breakableProb = 0.05 + 0.15 * ((difficulty - breakableThreshold) / (1 - breakableThreshold));
        }
        if (rand < breakableProb && difficulty >= breakableThreshold) {
            type = 'breakable';
        } else if (rand < breakableProb + movingProb && difficulty >= movingThreshold) {
            type = 'moving';
        } else {
            type = 'normal';
        }
    }
    const platform = {
        x: x, // Already using logical X from argument
        y: y,
        width: platformWidth,
        height: platformHeight,
        type: forcedType || type,
        isBroken: false,
        vx: 0,
        direction: 1
    };
    if (platform.type === 'moving') {
        platform.vx = 1 + difficulty * 1.5;
        platform.direction = Math.random() < 0.5 ? 1 : -1;
    }
    platforms.push(platform);
}

// --- Create Cloud ---
function createCloud(x, y) {
    const height = cloudMinHeight + Math.random() * (cloudMaxHeight - cloudMinHeight);
    const size = height * 0.8; // Base size on height for the drawing function
    const speed = cloudMinSpeed + Math.random() * (cloudMaxSpeed - cloudMinSpeed);
    const direction = Math.random() < 0.5 ? 1 : -1;
    const type = Math.floor(Math.random() * 3); // Randomly choose cloud type (0, 1, or 2)

    clouds.push({
        x: x,
        y: y,
        // width and height might not be directly used for drawing anymore, but keep for potential future use/logic
        width: cloudMinWidth + Math.random() * (cloudMaxWidth - cloudMinWidth),
        height: height,
        size: size, // Add size property
        type: type, // Add type property
        speed: speed,
        direction: direction
    });
}

// --- New Cloud Drawing Function (based on provided snippet) ---
function drawCloudShape(ctx, x, y, size, cloudType) {
    // Note: fillStyle and globalCompositeOperation should be set before calling this function
    // Note: save() and restore() are handled by the main draw function

    if (cloudType === 0) { // 基础蓬松云
        ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + size * 0.55, y - size * 0.4, size * 0.75, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + size * 1.1, y, size * 0.85, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + size * 0.55, y + size * 0.4, size * 0.75, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x - size * 0.3, y + size * 0.25, size * 0.65, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + size * 1.4, y + size * 0.1, size * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    else if (cloudType === 1) { // 长条云
        ctx.beginPath(); ctx.arc(x, y, size * 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + size * 0.8, y - size * 0.2, size * 0.85, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + size * 1.6, y, size * 0.75, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + size * 2.4, y - size * 0.1, size * 0.75, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + size * 1.3, y + size * 0.3, size * 0.9, 0, Math.PI * 2); ctx.fill();
    }
    else if (cloudType === 2) { // 聚集云
        ctx.beginPath(); ctx.arc(x, y, size * 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + size * 0.7, y - size * 0.4, size * 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x - size * 0.2, y - size * 0.4, size * 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + size * 0.5, y + size * 0.3, size, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x - size * 0.4, y + size * 0.25, size * 0.8, 0, Math.PI * 2); ctx.fill();
    }
}

// --- Input Handling (Convert screen coords to logical coords) ---
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Convert screen touch coordinates to logical game coordinates
function getLogicalCoords(screenX, screenY) {
    const logicalX = (screenX - offsetX) / scale;
    const logicalY = (screenY - offsetY) / scale;
    return { x: logicalX, y: logicalY };
}

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isTouching = true;
    const touch = e.touches[0];
    const logicalPos = getLogicalCoords(touch.clientX, touch.clientY);
    touchStartX = logicalPos.x; // Store logical X
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (isTouching) {
        const touch = e.touches[0];
        const logicalPos = getLogicalCoords(touch.clientX, touch.clientY);
        touchStartX = logicalPos.x; // Update logical X
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (gameover) {
         // Simple restart on tap anywhere when game over
         init();
         // Prevent isTouching state bleeding into new game
         isTouching = false;
         touchStartX = null;
         return; // Don't process touch for movement if restarting
     }
    // Handle regular touchend logic only if not game over
    isTouching = false;
    touchStartX = null;
});

function handleInput() {
    let horizontalInput = false;

    if (keys['ArrowLeft'] || keys['KeyA']) {
        player.vx = -moveSpeed;
        horizontalInput = true;
    } else if (keys['ArrowRight'] || keys['KeyD']) {
        player.vx = moveSpeed;
        horizontalInput = true;
    }

    // 触摸控制 (Compare logical touch X with logical center)
    if (isTouching && touchStartX !== null) {
        if (touchStartX < logicalWidth / 2) { //触摸左半边 (logical check)
             player.vx = -moveSpeed;
             horizontalInput = true;
        } else { // 触摸右半边 (logical check)
            player.vx = moveSpeed;
            horizontalInput = true;
        }
    }
    return horizontalInput;
}

// --- Game Logic Update (Use Logical Dimensions) ---
function update(dt) {
    if (gameover) return;

    const isReceivingInput = handleInput();

    if (!isReceivingInput) {
        player.vx *= friction;
        if (Math.abs(player.vx) < 0.1) {
            player.vx = 0;
        }
    }

    // Update player position using logical coordinates
    player.x += player.vx;

    player.vy += player.gravity;
    player.y += player.vy;

    // Platform Updates (Use Logical Dimensions)
    platforms.forEach(platform => {
        if (platform.type === 'moving') {
            platform.x += platform.vx * platform.direction;
            // Bounce using logical width
            if (platform.x <= 0 || platform.x + platform.width >= logicalWidth) {
                platform.direction *= -1;
            }
        }
    });

    // Collision Detection (Use Logical Dimensions)
    player.onGround = false;
    if (player.vy > 0) {
        platforms.forEach(platform => {
            if (!platform.isBroken &&
                player.x < platform.x + platform.width &&
                player.x + player.width > platform.x &&
                player.y + player.height >= platform.y &&
                player.y + player.height <= platform.y + platform.height + 10)
            {
                player.y = platform.y - player.height;
                player.vy = player.jumpPower;
                player.isJumping = true;
                player.onGround = true;
                if (platform.type === 'breakable') {
                    platform.isBroken = true;
                }
            }
        });
    }

    // --- Cloud Updates ---
    clouds.forEach(cloud => {
        cloud.x += cloud.speed * cloud.direction;
    });

    // --- Camera Scrolling ---
    let cameraOffset = 0;
    if (player.y < logicalHeight / 2) { // Check against logical midpoint
        cameraOffset = logicalHeight / 2 - player.y;
        player.y = logicalHeight / 2;
        platforms.forEach(p => p.y += cameraOffset);
        clouds.forEach(c => c.y += cameraOffset * 0.5); // Clouds scroll slower for parallax effect
        score += Math.round(cameraOffset);
    }

    // --- Cloud Management ---
    // Remove clouds whose top edge is below the logical bottom edge
    clouds = clouds.filter(c => c.y < logicalHeight);

    // Generate new clouds to fill up to the top of the logical area
    let highestCloudY = clouds.length > 0 ? Math.min(...clouds.map(c => c.y)) : logicalHeight;
    // Target the top edge for generation, similar to platforms
    const generationTargetY = -cloudMaxHeight; 
    while (highestCloudY > generationTargetY) { // Keep generating until the top is filled
        let spacing = cloudMinYSpacing + Math.random() * (cloudMaxYSpacing - cloudMinYSpacing);
        let newY = highestCloudY - spacing;
        // Generate cloud across the full logical width
        createCloud(Math.random() * logicalWidth, newY);
        highestCloudY = newY;
    }
    // --- End Cloud Management ---

    // Platform Management (Filter based on Logical Height - Tightened)
    platforms = platforms.filter(p => p.y < logicalHeight && !(p.type === 'breakable' && p.isBroken && p.y < player.y - 50));

    // Generate New Platforms (Based on Logical Coordinates)
    let highestPlatformY = platforms.length > 0 ? Math.min(...platforms.map(p => p.y)) : logicalHeight;
    const currentMinSpacing = basePlatformMinYSpacing + (maxPlatformMinYSpacing - basePlatformMinYSpacing) * difficulty;
    const currentMaxSpacing = basePlatformMaxYSpacing + (maxPlatformMaxYSpacing - basePlatformMaxYSpacing) * difficulty;

    while (highestPlatformY > -platformHeight) {
        let spacing = currentMinSpacing + Math.random() * (currentMaxSpacing - currentMinSpacing);
        let newY = highestPlatformY - spacing;
        createPlatform(Math.random() * (logicalWidth - platformWidth), newY);
        highestPlatformY = newY;
    }

    // Game Over Condition (Based on Logical Height)
    if (player.y > logicalHeight) { // Game over as soon as player's top edge is below bottom
        gameover = true;
        console.log("Game Over! Score:", score);
        gameLoopRunning = false;
        // drawGameOver will handle scaling
    }

    // Difficulty Update (remains the same)
    difficulty = Math.min(1, score / 3000);
    if (difficulty !== previousDifficulty) {
        console.log(`Difficulty changed to: ${difficulty.toFixed(3)} (Score: ${score})`);
        previousDifficulty = difficulty;
    }
}

// --- Drawing (Apply Scaling, Bottom Anchoring, and Adjusted Clipping) ---
function draw() {
    // Clear the entire physical canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Fill physical background color (covers entire screen)
    ctx.fillStyle = '#e0ffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Save context state
    ctx.save();

    // Apply translation and scaling (offsetX, offsetY, scale)
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // --- Define and Apply Clipping Region based on visible logical area --- > MODIFIED
    const visibleLogicalTopY = logicalHeight - (canvasHeight / scale);
    const visibleLogicalHeight = canvasHeight / scale;
    // Calculate the logical X range corresponding to the physical canvas width
    const visibleLogicalLeftX = (0 - offsetX) / scale;          // Logical X of left screen edge
    const visibleLogicalWidth = canvasWidth / scale;        // Full visible logical width

    ctx.beginPath();
    // Clip vertically based on calculated Y, but horizontally cover the entire visible width
    ctx.rect(visibleLogicalLeftX, visibleLogicalTopY, visibleLogicalWidth, visibleLogicalHeight);
    ctx.clip();
    // --- End Clipping Region --- > MODIFIED

    // --- Draw all game elements within the logical coordinate system ---
    // No need to clear the logical background area anymore, as the whole canvas is already the correct color
    // ctx.fillStyle = '#e0ffff';
    // ctx.fillRect(0, visibleLogicalTopY, logicalWidth, visibleLogicalHeight); // <--- REMOVED

    // Draw player (Green) - Will now be drawn even if outside logicalWidth bounds, as long as within the clip
    ctx.fillStyle = 'green';
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Draw platforms
    platforms.forEach(platform => {
        // Draw only platforms potentially within the visible logical Y range
        if (platform.y + platform.height > visibleLogicalTopY && platform.y < logicalHeight) {
            if (platform.isBroken) {
                ctx.fillStyle = '#aaa';
            } else if (platform.type === 'normal') {
                ctx.fillStyle = 'brown';
            } else if (platform.type === 'moving') {
                ctx.fillStyle = 'blue';
            } else if (platform.type === 'breakable') {
                ctx.fillStyle = 'red';
            }
            ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
            if (platform.type === 'breakable' && platform.isBroken) {
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(platform.x + 5, platform.y + platform.height / 2);
                ctx.lineTo(platform.x + platform.width - 5, platform.y + platform.height / 2);
                ctx.stroke();
            }
        }
    });

    // Draw clouds (behind player/platforms)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // Set fill style for clouds
    // Optional: Set composite operation if needed, but 'source-over' is default
    // ctx.globalCompositeOperation = 'source-over';
    clouds.forEach(cloud => {
        // Draw only clouds potentially within the visible Y range
        // Using cloud.size now for vertical check approximation
        if (cloud.y + cloud.size > visibleLogicalTopY && cloud.y - cloud.size < logicalHeight) {
             drawCloudShape(ctx, cloud.x, cloud.y, cloud.size, cloud.type);
        }
    });
    // --- End Clouds ---

    // Draw score (Position relative to the VISIBLE logical top-left)
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    // Position score relative to the clipped view's top-left
    ctx.fillText('Score: ' + score, 10, visibleLogicalTopY + 30);

    // Restore context state (removes translation, scaling, and clipping)
    ctx.restore();

    // Game Over screen is handled separately to overlay on top
    if (gameover) {
       drawGameOver();
    }
}

function drawGameOver() {
    // Draw Game Over text centered on the physical canvas, potentially over the scaled game area
     ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
     ctx.fillRect(0, 0, canvasWidth, canvasHeight); // Cover full screen
     ctx.fillStyle = 'white';
     ctx.font = '40px Arial';
     ctx.textAlign = 'center';
     // Center text on the physical canvas width/height
     ctx.fillText('Game Over!', canvasWidth / 2, canvasHeight / 2 - 40);
     ctx.font = '20px Arial';
     ctx.fillText('Score: ' + score, canvasWidth / 2, canvasHeight / 2);
     ctx.fillText('Tap or Click to restart', canvasWidth / 2, canvasHeight / 2 + 40); // Updated text
}

// --- Game Loop (remains mostly the same) ---
let lastTime = 0;
let gameLoopRunning = false;
function gameLoop(timestamp) {
    if (!gameLoopRunning && !gameover) return;
    if (gameover && !gameLoopRunning) return; // 确保结束后不再循环

    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    if (!gameover) {
        update(deltaTime / 1000);
        draw(); // Call the updated draw function
    }

    requestAnimationFrame(gameLoop);
}

// --- Event Listeners ---
// Add resize listener
window.addEventListener('resize', resizeHandler);

// Add click listener for restart (especially for desktop)
canvas.addEventListener('click', (e) => {
    if (gameover) {
        // Restart logic - check if click is within the rough screen area?
        // For simplicity, any click restarts when game over.
        init();
        // // More precise: Check if click was within the centered logical area bounds on screen
        // const scaledLogicalWidth = logicalWidth * scale;
        // const actualGameAreaY = offsetY; // Top of game area on screen
        // const actualGameAreaHeight = canvasHeight - offsetY; // Height of game area on screen
        // if (e.clientX >= offsetX && e.clientX <= offsetX + scaledLogicalWidth &&
        //     e.clientY >= actualGameAreaY && e.clientY <= actualGameAreaY + actualGameAreaHeight) {
        //      init();
        // }
    }
});

// Touchend listener needs similar simplified restart logic
canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (gameover) {
         // Simple restart on tap anywhere when game over
         init();
         // Prevent isTouching state bleeding into new game
         isTouching = false;
         touchStartX = null;
         return; // Don't process touch for movement if restarting
     }
    // Handle regular touchend logic only if not game over
    isTouching = false;
    touchStartX = null;
});

// --- Start Game ---
init(); // Calls resizeHandler inside
console.log("Game initialized. Starting loop..."); 