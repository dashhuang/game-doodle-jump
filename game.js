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

// 添加玩家随机颜色数组
const playerColors = [
    '#32CD32', // 亮绿色 (Lime Green)
    '#FF4500', // 橙红色 (Orange Red)
    '#9370DB', // 中紫色 (Medium Purple)
    '#FFD700', // 金色 (Gold)
    '#00CED1'  // 青色 (Dark Turquoise)
];
// 当前选择的玩家颜色
let currentPlayerColor = playerColors[0]; // 默认为第一个颜色，将在init中随机选择

// 玩家对象 (Use logical dimensions)
const player = {
    x: logicalWidth / 2 - 25,
    y: logicalHeight - 100, // Position relative to logical height
    width: 40, // Slightly narrower base width
    height: 40, // Slightly shorter base height
    baseWidth: 40,
    baseHeight: 40,
    vx: 0, // 水平速度
    vy: 0, // 垂直速度
    gravity: 0.55,
    jumpPower: -16, // 起跳力度（负数表示向上）
    isJumping: false,
    onGround: false,
    // Squash and Stretch properties
    scaleX: 1, 
    scaleY: 1,
    squashAmount: 0.2, // How much to squash/stretch (20%)
    squashDuration: 20, // How many frames the effect lasts
    squashTimer: 0 
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
const friction = 0.98; // 摩擦系数 (0 < friction < 1)

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
    player.x = logicalWidth / 2 - player.baseWidth / 2; // Center based on base width
    player.y = logicalHeight - 100; 
    player.vx = 0;
    player.vy = 0;
    player.isJumping = false;
    player.onGround = false;
    player.scaleX = 1;
    player.scaleY = 1;
    player.squashTimer = 0;
    platforms = [];
    clouds = [];

    // 随机选择一个玩家颜色
    currentPlayerColor = playerColors[Math.floor(Math.random() * playerColors.length)];

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
        direction: 1,
        breakTimer: 0 // 添加：破碎后的消失计时器
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
    const layer = Math.random() < 0.7 ? 'back' : 'front'; // 70% chance to be in the back

    clouds.push({
        x: x,
        y: y,
        width: cloudMinWidth + Math.random() * (cloudMaxWidth - cloudMinWidth),
        height: height,
        size: size,
        type: type,
        layer: layer, // Add layer property
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
    if (player.vy > 0) { // Only check when falling
        platforms.forEach(platform => {
            // Adjust player dimensions for collision check based on BASE size
            const checkWidth = player.baseWidth;
            const checkHeight = player.baseHeight;
            const checkX = player.x;
            const checkY = player.y;

            if (!platform.isBroken &&
                checkX < platform.x + platform.width &&
                checkX + checkWidth > platform.x &&
                checkY + checkHeight >= platform.y &&
                checkY + checkHeight <= platform.y + platform.height + 10) 
            {
                // Landed on platform
                if (!player.isJumping) { // Trigger squash only on initial landing, not while jumping up
                     player.squashTimer = player.squashDuration; // Start squash timer
                }
                player.y = platform.y - player.baseHeight; // Position based on base height
                player.vy = player.jumpPower;
                player.isJumping = true; 
                player.onGround = true; 
                if (platform.type === 'breakable') {
                    platform.isBroken = true;
                    platform.breakTimer = 30; // 设置为30帧(约0.5秒，假设60fps)
                }
            }
        });
    } else {
         // Reset jumping flag if moving upwards and no longer on ground
         if (player.vy < 0) {
            player.isJumping = false; 
         }
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
    // 更新破碎平台的计时器
    platforms.forEach(platform => {
        if (platform.isBroken && platform.breakTimer > 0) {
            platform.breakTimer--;
        }
    });
    
    // 移除屏幕下方的平台和破碎计时结束的平台
    platforms = platforms.filter(p => 
        p.y < logicalHeight && // 保留屏幕内的平台
        !(p.type === 'breakable' && p.isBroken && p.breakTimer <= 0) // 移除计时结束的破碎平台
    );

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

    // --- Squash & Stretch Update ---
    if (player.squashTimer > 0) {
        player.squashTimer--;
        // Calculate current scale based on timer progress (e.g., parabolic recovery)
        const progress = player.squashTimer / player.squashDuration;
        const squashFactor = 1 - Math.pow(1 - progress, 2); // Starts at 1, goes to 0
        
        player.scaleX = 1 + player.squashAmount * squashFactor;
        player.scaleY = 1 - player.squashAmount * squashFactor;
    } else {
        // Ensure reset when timer is done
        player.scaleX = 1;
        player.scaleY = 1;
    }
    // --- End Squash & Stretch Update ---
}

// --- Drawing (Apply Scaling, Bottom Anchoring, and Adjusted Clipping) ---
function draw() {
    // Clear the entire physical canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Fill physical background color (covers entire screen)
    ctx.fillStyle = '#87CEEB';
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

    // --- Draw Background Clouds --- > ADDED LAYER LOGIC
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // Set fill style for clouds
    clouds.forEach(cloud => {
        if (cloud.layer === 'back') { // Only draw background clouds here
            // Check visibility
            if (cloud.y + cloud.size > visibleLogicalTopY && cloud.y - cloud.size < logicalHeight) {
                drawCloudShape(ctx, cloud.x, cloud.y, cloud.size, cloud.type);
            }
        }
    });
    // --- End Background Clouds ---

    // --- Draw Player --- 
    ctx.fillStyle = currentPlayerColor; // 使用随机选择的玩家颜色

    // Calculate scaled dimensions and position offset for drawing
    const drawWidth = player.baseWidth * player.scaleX;
    const drawHeight = player.baseHeight * player.scaleY;
    const drawX = player.x - (drawWidth - player.baseWidth) / 2; // Adjust x to keep center
    const drawY = player.y - (drawHeight - player.baseHeight) / 2; // Adjust y to keep center
    const cornerRadius = 10; // Adjust for desired roundness

    // Draw rounded rectangle body
    ctx.beginPath();
    ctx.roundRect(drawX, drawY, drawWidth, drawHeight, cornerRadius);
    ctx.fill();

    // Draw Eyes (relative to the scaled body)
    const eyeRadius = 3;
    const baseEyeOffsetX = drawWidth * 0.25; // Base horizontal offset from center
    const eyeOffsetY = drawHeight * 0.3;
    let eyeShiftX = 0; // <-- ADDED: Horizontal shift based on movement

    // --- Eye Movement Logic --- > MODIFIED
    const eyeMoveThreshold = 1.0; // Minimum speed to trigger eye movement
    const eyeMoveAmount = drawWidth * 0.08; // How much the eyes move horizontally

    if (player.vx > eyeMoveThreshold) { // Moving right
        // currentEyeOffsetX += eyeMoveAmount; // <-- Removed
        eyeShiftX = eyeMoveAmount; // Shift eyes to the right
    } else if (player.vx < -eyeMoveThreshold) { // Moving left
        // currentEyeOffsetX -= eyeMoveAmount; // <-- Removed
        eyeShiftX = -eyeMoveAmount; // Shift eyes to the left
    }
    // --- End Eye Movement Logic ---

    const centerX = drawX + drawWidth / 2;
    ctx.fillStyle = 'black'; 
    // Left eye
    ctx.beginPath();
    // Calculate position relative to center, then apply shift
    ctx.arc(centerX - baseEyeOffsetX + eyeShiftX, drawY + eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    // Right eye
    ctx.beginPath();
    // Calculate position relative to center, then apply shift
    ctx.arc(centerX + baseEyeOffsetX + eyeShiftX, drawY + eyeOffsetY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    // --- End Player --- 

    // --- Draw Platforms --- 
    platforms.forEach(platform => {
        if (platform.y + platform.height > visibleLogicalTopY && platform.y < logicalHeight) {
            const platformX = platform.x;
            const platformY = platform.y;
            const platformW = platform.width;
            const platformH = platform.height;
            const grassHeight = platformH * 0.4; // 草地高度为平台总高度的40%
            const platformCornerRadius = 5;
            
            // 确定基础颜色 (将根据平台类型修改饱和度/亮度)
            let grassColor, soilColor;
            
            if (platform.isBroken) {
                grassColor = '#aaa';
                soilColor = '#999';
            } else if (platform.type === 'moving') {
                grassColor = '#8FBC8F'; // 暗海洋绿(草地部分)
                soilColor = '#5F9EA0'; // 保留轻鸭绿色(土壤部分)
            } else if (platform.type === 'breakable') {
                // 冰块风格 - 淡蓝色+白色
                grassColor = '#A5F2F3'; // 浅蓝色(冰块顶部)
                soilColor = '#77C5D5'; // 稍深蓝色(冰块底部)
            } else {
                // 普通平台
                grassColor = '#90EE90'; // 淡绿色草地
                soilColor = '#CD853F'; // 秘鲁色土壤
            }
            
            // 不再绘制平台外轮廓（去掉黑边）
            // ctx.strokeStyle = 'black';
            // ctx.lineWidth = 2;
            // ctx.beginPath();
            // ctx.roundRect(platformX, platformY, platformW, platformH, platformCornerRadius);
            // ctx.stroke();
            
            // 绘制土壤(下部分)
            ctx.fillStyle = soilColor;
            ctx.beginPath();
            ctx.roundRect(platformX, platformY, platformW, platformH, platformCornerRadius);
            ctx.fill();
            
            // 绘制草地(上部分)
            ctx.fillStyle = grassColor;
            ctx.beginPath();
            ctx.roundRect(platformX, platformY, platformW, grassHeight, 
                [platformCornerRadius, platformCornerRadius, 0, 0]); // 只有上边缘是圆角
            ctx.fill();
            
            // 绘制低多边形效果(简化版)
            // 草地阴影三角形
            if (!platform.isBroken) {
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                ctx.beginPath();
                ctx.moveTo(platformX + platformW * 0.2, platformY);
                ctx.lineTo(platformX + platformW * 0.5, platformY + grassHeight);
                ctx.lineTo(platformX, platformY + grassHeight);
                ctx.closePath();
                ctx.fill();
                
                // 草地高光三角形
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.beginPath();
                ctx.moveTo(platformX + platformW * 0.6, platformY);
                ctx.lineTo(platformX + platformW, platformY);
                ctx.lineTo(platformX + platformW, platformY + grassHeight * 0.7);
                ctx.closePath();
                ctx.fill();
                
                // 土壤部分阴影
                ctx.fillStyle = 'rgba(0,0,0,0.15)';
                ctx.beginPath();
                ctx.moveTo(platformX, platformY + grassHeight);
                ctx.lineTo(platformX + platformW * 0.4, platformY + grassHeight);
                ctx.lineTo(platformX + platformW * 0.2, platformY + platformH);
                ctx.lineTo(platformX, platformY + platformH);
                ctx.closePath();
                ctx.fill();
            }
            
            // 易碎平台的裂纹 - 冰块效果
            if (platform.type === 'breakable') {
                // 给冰块添加裂纹和高光效果
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; // 明亮的裂纹
                ctx.lineWidth = 1;
                ctx.beginPath();
                
                // 几条冰块特有的线条
                // 水平线
                ctx.moveTo(platformX + platformW * 0.1, platformY + platformH * 0.3);
                ctx.lineTo(platformX + platformW * 0.9, platformY + platformH * 0.3);
                
                // 垂直线
                ctx.moveTo(platformX + platformW * 0.3, platformY + platformH * 0.1);
                ctx.lineTo(platformX + platformW * 0.3, platformY + platformH * 0.7);
                ctx.moveTo(platformX + platformW * 0.7, platformY + platformH * 0.2);
                ctx.lineTo(platformX + platformW * 0.7, platformY + platformH * 0.9);
                
                // 斜线
                ctx.moveTo(platformX + platformW * 0.2, platformY + platformH * 0.2);
                ctx.lineTo(platformX + platformW * 0.5, platformY + platformH * 0.6);
                ctx.stroke();
                
                // 增加一些冰块光泽
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.beginPath();
                ctx.ellipse(platformX + platformW * 0.7, platformY + platformH * 0.25, 
                           platformW * 0.15, platformH * 0.2, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // 已破碎平台的裂缝
            if (platform.type === 'breakable' && platform.isBroken) {
                // 冰块破碎效果
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(platformX + 5, platformY + platformH / 2);
                ctx.lineTo(platformX + platformW - 5, platformY + platformH / 2);
                ctx.stroke();
                
                // 添加额外裂缝 - 冰裂样式
                ctx.lineWidth = 1;
                ctx.beginPath();
                // 放射状裂纹
                const centerX = platformX + platformW/2;
                const centerY = platformY + platformH/2;
                
                // 多条放射线
                for (let angle = 0; angle < Math.PI*2; angle += Math.PI/4) {
                    const endX = centerX + Math.cos(angle) * platformW * 0.4;
                    const endY = centerY + Math.sin(angle) * platformH * 0.4;
                    ctx.moveTo(centerX, centerY);
                    ctx.lineTo(endX, endY);
                }
                ctx.stroke();
            }
        }
    });
    // --- End Platforms --- 

    // --- Draw Foreground Clouds --- > ADDED
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // Set fill style again just in case
    clouds.forEach(cloud => {
        if (cloud.layer === 'front') { // Only draw foreground clouds here
            // Check visibility
            if (cloud.y + cloud.size > visibleLogicalTopY && cloud.y - cloud.size < logicalHeight) {
                drawCloudShape(ctx, cloud.x, cloud.y, cloud.size, cloud.type);
            }
        }
    });
    // --- End Foreground Clouds ---

    // --- Draw Score --- 
    ctx.fillStyle = 'white'; // Keep score white
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    // 显示转换后的分数 (像素高度除以100取整)
    const displayScore = Math.floor(score / 100);
    ctx.fillText('得分: ' + displayScore, 10, visibleLogicalTopY + 30);
    // --- End Score --- 

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