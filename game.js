const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ===== 难度配置（统一管理所有难度相关参数） =====
const difficultyConfig = {
    // 基础难度计算
    maxScore: 5000,                   // 达到最大难度所需的分数（像素高度）
    
    // 平台类型阈值
    movingThreshold: 0.2,             // 移动平台出现的难度阈值
    breakableThreshold: 0.5,          // 易碎平台出现的难度阈值
    movingBreakableThreshold: 0.7,    // 移动易碎平台出现的难度阈值
    springThreshold: 0.0,             // 弹簧平台出现的难度阈值（从游戏开始就有，但概率会随难度增加）
    
    // 平台出现概率
    springBaseProbability: 0.08,      // 弹簧平台基础概率
    springMaxIncrement: 0.16,         // 弹簧平台最大概率增量（难度最高时达到20%概率）
    
    // 特殊平台基础概率和最大增量
    movingBaseProbability: 0.1,       // 移动平台基础概率
    movingMaxIncrement: 0.15,          // 移动平台最大概率增量
    
    breakableBaseProbability: 0.05,   // 易碎平台基础概率
    breakableMaxIncrement: 0.3,      // 易碎平台最大概率增量
    
    movingBreakableBaseProbability: 0.05, // 移动易碎平台基础概率
    movingBreakableMaxIncrement: 0.5,     // 移动易碎平台最大概率增量
    
    // 平台间距
    basePlatformMinYSpacing: 60,      // 初始最小间距
    basePlatformMaxYSpacing: 200,     // 初始最大间距
    maxPlatformMinYSpacing: 160,       // 最高难度最小间距
    maxPlatformMaxYSpacing: 240,      // 最高难度最大间距
    
    // 移动平台速度
    movingPlatformBaseSpeed: 1,       // 移动平台基础速度
    movingPlatformSpeedIncrement: 2 // 移动平台速度难度增量
};

// 检测设备类型
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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
    squashTimer: 0,
    // 加速度相关属性
    acceleration: 0.3, // 每帧加速度
    maxSpeed: 7, // 最大速度
    inputTime: 0, // 按键持续时间计数器
    // 移动方向状态（新增）
    movementState: 'idle' // 'left', 'right', 或 'idle'
};

// 平台数组 (Use logical dimensions)
let platforms = [];
const platformWidth = 70;
const platformHeight = 15;
const initialPlatforms = 5; // 初始平台数量

// 游戏控制
let keys = {};
let touchStartX = null; // Store logical X coordinate
let isTouching = false;
const moveSpeed = 2.5; // 初始移动速度（降低初始速度以使加速更明显）
const friction = 0.95; // 摩擦系数 (0 < friction < 1)

// 虚拟摇杆参数
let joystickActive = false;
let joystickStartX = 0;
let joystickStartY = 0;
let joystickCurrentX = 0;
let joystickCurrentY = 0;
const joystickRadius = 50; // 摇杆基座半径（物理像素）
const joystickKnobRadius = 25; // 摇杆手柄半径（物理像素）
const joystickDeadZone = 0.2; // 摇杆死区（归一化值，0-1）
const joystickSensitivity = 1.2; // 摇杆灵敏度
// 屏幕边缘宽度（左右两侧留给点按控制的区域）
const edgeWidth = 60; // 左右两侧各60像素用于点按控制
// 初始化屏幕边缘区域变量
let leftEdgeWidth = edgeWidth;
let rightEdgeWidth = edgeWidth;

// 设置视口实际高度的辅助函数
function setViewportHeight() {
    // 设置CSS变量用于真实视口高度
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    
    // 更新画布尺寸
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // 重新计算缩放和偏移
    calculateScalingAndOffset();
}

// 计算缩放和偏移值（抽取自resizeHandler）
function calculateScalingAndOffset() {
    // Calculate scale factor based on width, capped by maxScale
    scale = Math.min(canvasWidth / logicalWidth, maxScale);

    // Calculate horizontal offset for centering
    const scaledLogicalWidth = logicalWidth * scale;
    offsetX = (canvasWidth - scaledLogicalWidth) / 2;

    // Calculate vertical offset to anchor the bottom of the logical view to the canvas bottom
    const scaledLogicalHeight = logicalHeight * scale;
    offsetY = canvasHeight - scaledLogicalHeight;
    
    // 检查并处理安全区域
    handleSafeAreas();
}

// 为移动设备进行额外调整
function adjustForMobile() {
    if (isMobile) {
        // 阻止双击缩放
        let lastTouchEnd = 0;
        document.addEventListener('touchend', function(e) {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // 立即更新视口高度
        setViewportHeight();
    }
}

// 处理安全区域
function handleSafeAreas() {
    // 获取安全区域大小（通过CSS环境变量）
    const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)')) || 0;
    const safeAreaBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)')) || 0;
    const safeAreaLeft = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-left)')) || 0;
    const safeAreaRight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-right)')) || 0;
    
    // 更新边缘区域大小，考虑安全区域
    leftEdgeWidth = edgeWidth + safeAreaLeft;
    rightEdgeWidth = edgeWidth + safeAreaRight;
}

// --- Resize Handler ---
function resizeHandler() {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    calculateScalingAndOffset();

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
    player.inputTime = 0; // 重置按键时间计数器
    platforms = [];
    clouds = [];

    // 随机选择一个玩家颜色
    currentPlayerColor = playerColors[Math.floor(Math.random() * playerColors.length)];

    // Create initial platforms within logical coordinate space
    for (let i = 0; i < initialPlatforms; i++) {
        let yPos = logicalHeight - 50 - i * ((difficultyConfig.basePlatformMinYSpacing + difficultyConfig.basePlatformMaxYSpacing) / 2);
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

    // 为移动设备进行额外调整
    adjustForMobile();

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
        
        // 计算各类平台的当前概率
        let springProb = 0;
        let movingProb = 0;
        let breakableProb = 0;
        let movingBreakableProb = 0;
        
        // 弹簧平台概率计算（随难度增加）
        if (difficulty >= difficultyConfig.springThreshold) {
            springProb = difficultyConfig.springBaseProbability + 
                difficultyConfig.springMaxIncrement * 
                ((difficulty - difficultyConfig.springThreshold) / 
                (1 - difficultyConfig.springThreshold));
        }
        
        // 移动平台概率计算
        if (difficulty >= difficultyConfig.movingThreshold) {
            movingProb = difficultyConfig.movingBaseProbability + 
                difficultyConfig.movingMaxIncrement * 
                ((difficulty - difficultyConfig.movingThreshold) / 
                (1 - difficultyConfig.movingThreshold));
        }
        
        // 易碎平台概率计算
        if (difficulty >= difficultyConfig.breakableThreshold) {
            breakableProb = difficultyConfig.breakableBaseProbability + 
                difficultyConfig.breakableMaxIncrement * 
                ((difficulty - difficultyConfig.breakableThreshold) / 
                (1 - difficultyConfig.breakableThreshold));
        }
        
        // 移动易碎平台概率计算
        if (difficulty >= difficultyConfig.movingBreakableThreshold) {
            movingBreakableProb = difficultyConfig.movingBreakableBaseProbability + 
                difficultyConfig.movingBreakableMaxIncrement * 
                ((difficulty - difficultyConfig.movingBreakableThreshold) / 
                (1 - difficultyConfig.movingBreakableThreshold));
        }
        
        // 根据随机值和计算出的概率确定平台类型（按优先级顺序判断）
        let probSum = 0;
        
        // 弹簧平台判断（最高优先级）
        if (rand < springProb) {
            type = 'spring';
        }
        // 移动易碎平台判断
        else if (rand < (probSum += springProb) + movingBreakableProb && difficulty >= difficultyConfig.movingBreakableThreshold) {
            type = 'movingBreakable';
        }
        // 易碎平台判断
        else if (rand < (probSum += movingBreakableProb) + breakableProb && difficulty >= difficultyConfig.breakableThreshold) {
            type = 'breakable';
        }
        // 移动平台判断
        else if (rand < (probSum += breakableProb) + movingProb && difficulty >= difficultyConfig.movingThreshold) {
            type = 'moving';
        }
        // 默认普通平台
        else {
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
        breakTimer: 0, // 添加：破碎后的消失计时器
        springActive: false, // 弹簧是否激活
        springTimer: 0 // 弹簧动画计时器
    };
    if (platform.type === 'moving' || platform.type === 'movingBreakable') {
        platform.vx = difficultyConfig.movingPlatformBaseSpeed + difficulty * difficultyConfig.movingPlatformSpeedIncrement;
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
    // 如果游戏已结束，任意键重新开始
    if (gameover) {
        init();
        return;
    }
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
    const touch = e.touches[0];
    const logicalPos = getLogicalCoords(touch.clientX, touch.clientY);
    
    // 检查是否在屏幕左边缘或右边缘（用于左右点按控制）
    if (touch.clientX < leftEdgeWidth || touch.clientX > canvasWidth - rightEdgeWidth) {
        // 触摸屏幕左边缘或右边缘，使用点按控制
        isTouching = true;
        touchStartX = logicalPos.x;
    } else {
        // 触摸屏幕中间区域，激活虚拟摇杆
        joystickActive = true;
        joystickStartX = touch.clientX;
        joystickStartY = touch.clientY;
        joystickCurrentX = touch.clientX;
        joystickCurrentY = touch.clientY;
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    
    if (joystickActive) {
        // 更新摇杆位置
        joystickCurrentX = touch.clientX;
        joystickCurrentY = touch.clientY;
    } else if (isTouching) {
        const logicalPos = getLogicalCoords(touch.clientX, touch.clientY);
        // 只有当手指从屏幕一边移动到另一边时才更新touchStartX
        // 这样可以实现长按同一侧屏幕不断加速的效果
        if ((touchStartX < logicalWidth / 2 && logicalPos.x >= logicalWidth / 2) || 
            (touchStartX >= logicalWidth / 2 && logicalPos.x < logicalWidth / 2)) {
            touchStartX = logicalPos.x; // 只有切换左右方向时才更新
        }
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
         joystickActive = false;
         return; // Don't process touch for movement if restarting
     }
    
    // 检查哪种控制方式处于激活状态
    if (joystickActive) {
        joystickActive = false;
    } else {
        // 常规点按控制处理
        isTouching = false;
        touchStartX = null;
    }
}, { passive: false });

function handleInput() {
    let horizontalInput = false;
    const maxAccelerationFrames = 20; // 减少达到最大速度的时间（从30减少到20）

    // 检查键盘输入
    if (keys['ArrowLeft'] || keys['KeyA']) {
        // 向左加速
        player.inputTime++;
        const currentSpeed = Math.min(player.maxSpeed, moveSpeed + player.acceleration * Math.min(player.inputTime, maxAccelerationFrames));
        player.vx = -currentSpeed;
        player.movementState = 'left';
        horizontalInput = true;
    } else if (keys['ArrowRight'] || keys['KeyD']) {
        // 向右加速
        player.inputTime++;
        const currentSpeed = Math.min(player.maxSpeed, moveSpeed + player.acceleration * Math.min(player.inputTime, maxAccelerationFrames));
        player.vx = currentSpeed;
        player.movementState = 'right';
        horizontalInput = true;
    } else {
        // 如果没有按键输入，检查触摸输入
        if (!(isTouching && touchStartX !== null) && !joystickActive) {
            player.inputTime = 0;
            player.movementState = 'idle';
        }
    }

    // 处理摇杆输入（优先级高于点按）
    if (joystickActive) {
        // 计算摇杆位移（归一化为-1到1）
        const dx = joystickCurrentX - joystickStartX;
        const distance = Math.abs(dx);
        const normalizedDistance = Math.min(distance / joystickRadius, 1.0);
        
        // 应用死区
        if (normalizedDistance > joystickDeadZone) {
            const direction = dx > 0 ? 1 : -1;
            const activeDistance = (normalizedDistance - joystickDeadZone) / (1 - joystickDeadZone);
            
            // 计算当前速度，灵敏度越高越快达到最大速度
            player.inputTime++;
            const speedFactor = activeDistance * joystickSensitivity;
            const currentSpeed = Math.min(player.maxSpeed, moveSpeed + player.acceleration * Math.min(player.inputTime, maxAccelerationFrames) * speedFactor);
            
            player.vx = currentSpeed * direction;
            player.movementState = direction > 0 ? 'right' : 'left';
            horizontalInput = true;
        } else {
            // 在死区内，不增加inputTime但也不重置
        }
    } 
    // 触摸控制（如果摇杆未激活）
    else if (isTouching && touchStartX !== null) {
        player.inputTime++;
        const currentSpeed = Math.min(player.maxSpeed, moveSpeed + player.acceleration * Math.min(player.inputTime, maxAccelerationFrames));
        
        if (touchStartX < logicalWidth / 2) { //触摸左半边 (logical check)
             player.vx = -currentSpeed;
             player.movementState = 'left';
             horizontalInput = true;
        } else { // 触摸右半边 (logical check)
            player.vx = currentSpeed;
            player.movementState = 'right';
            horizontalInput = true;
        }
    } else if (!keys['ArrowLeft'] && !keys['ArrowRight'] && !keys['KeyA'] && !keys['KeyD']) {
        // 如果没有触摸输入且没有按键输入，重置计时器
        player.inputTime = 0;
        player.movementState = 'idle';
    }
    
    // 输出当前速度信息（调试用）
    if (horizontalInput && player.inputTime % 10 === 0) {
        console.log(`当前速度: ${Math.abs(player.vx).toFixed(2)}, 按键帧数: ${player.inputTime}`);
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
        if (platform.type === 'moving' || platform.type === 'movingBreakable') {
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
                
                // 根据平台类型确定跳跃力度
                if (platform.type === 'spring') {
                    platform.springActive = true;
                    platform.springTimer = 10; // 10帧的弹簧动画
                    player.vy = player.jumpPower * 1.5; // 弹簧砖块提供1.5倍跳跃力
                } else {
                    player.vy = player.jumpPower; // 普通跳跃力
                }
                
                player.isJumping = true; 
                player.onGround = true; 
                if (platform.type === 'breakable' || platform.type === 'movingBreakable') {
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

    // --- 弹簧特效动画 ---
    platforms.forEach(platform => {
        if (platform.type === 'spring' && platform.springActive) {
            platform.springTimer--;
            if (platform.springTimer <= 0) {
                platform.springActive = false;
            }
        }
    });

    // Generate New Platforms (Based on Logical Coordinates)
    let highestPlatformY = platforms.length > 0 ? Math.min(...platforms.map(p => p.y)) : logicalHeight;
    const currentMinSpacing = difficultyConfig.basePlatformMinYSpacing + 
                            (difficultyConfig.maxPlatformMinYSpacing - difficultyConfig.basePlatformMinYSpacing) * difficulty;
    const currentMaxSpacing = difficultyConfig.basePlatformMaxYSpacing + 
                            (difficultyConfig.maxPlatformMaxYSpacing - difficultyConfig.basePlatformMaxYSpacing) * difficulty;

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

    // Difficulty Update
    difficulty = Math.min(1, score / difficultyConfig.maxScore);
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

    // --- 基于移动状态的眼睛表情 ---
    const eyeMoveAmount = drawWidth * 0.08; // How much the eyes move horizontally

    // 根据移动状态改变眼睛位置
    if (player.movementState === 'right') {
        eyeShiftX = eyeMoveAmount;
    } else if (player.movementState === 'left') {
        eyeShiftX = -eyeMoveAmount;
    }

    // 根据速度显示特殊效果
    let speedRatio = Math.abs(player.vx) / player.maxSpeed;
    let eyeSize = eyeRadius;
    if (speedRatio > 0.7) {
        // 高速时眼睛变小，显示聚焦效果
        eyeSize = eyeRadius * 0.8;
    }
    // --- 眼睛表情逻辑结束 ---

    const centerX = drawX + drawWidth / 2;
    ctx.fillStyle = 'black'; 
    // Left eye
    ctx.beginPath();
    // Calculate position relative to center, then apply shift
    ctx.arc(centerX - baseEyeOffsetX + eyeShiftX, drawY + eyeOffsetY, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    // Right eye
    ctx.beginPath();
    // Calculate position relative to center, then apply shift
    ctx.arc(centerX + baseEyeOffsetX + eyeShiftX, drawY + eyeOffsetY, eyeSize, 0, Math.PI * 2);
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
            } else if (platform.type === 'spring') {
                // 弹簧砖块风格 - 橙黄色
                grassColor = '#FFD700'; // 金色(弹簧顶部)
                soilColor = '#FFA500'; // 橙色(弹簧底部)
            } else if (platform.type === 'movingBreakable') {
                // 移动+易碎平台 - 紫色
                grassColor = '#E6A8D7'; // 淡紫色(顶部)
                soilColor = '#9966CC'; // 中紫色(底部)
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
            if (platform.type === 'breakable' || platform.type === 'movingBreakable') {
                // 给冰块添加裂纹和高光效果
                ctx.strokeStyle = platform.type === 'breakable' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 240, 255, 0.7)';
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
                ctx.fillStyle = platform.type === 'breakable' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 240, 255, 0.3)';
                ctx.beginPath();
                ctx.ellipse(platformX + platformW * 0.7, platformY + platformH * 0.25, 
                           platformW * 0.15, platformH * 0.2, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // 弹簧砖块的特殊效果
            if (platform.type === 'spring') {
                // 绘制弹簧图案
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.lineWidth = 2;
                
                // 弹簧图案 - 在平台上方绘制弹簧
                const springBaseX = platformX + platformW/2;
                const springBaseY = platformY;
                const springWidth = platformW * 0.3;
                const springHeight = platform.springActive ? platformH * 0.5 : platformH * 0.3; // 激活时拉长
                
                // 绘制弹簧线圈
                ctx.beginPath();
                ctx.moveTo(springBaseX - springWidth/2, springBaseY);
                
                // 弹簧线圈数
                const coils = 3;
                const coilHeight = springHeight / (coils * 2);
                
                for (let i = 0; i < coils; i++) {
                    // 一个完整的波浪
                    ctx.lineTo(springBaseX + springWidth/2, springBaseY - (i*2+1)*coilHeight);
                    ctx.lineTo(springBaseX - springWidth/2, springBaseY - (i*2+2)*coilHeight);
                }
                
                ctx.stroke();
                
                // 绘制弹簧顶部小板
                ctx.fillStyle = 'rgba(255, 215, 0, 0.8)'; // 金色半透明
                const topY = springBaseY - springHeight;
                ctx.fillRect(springBaseX - springWidth*0.6, topY - platformH*0.15, springWidth*1.2, platformH*0.15);
            }
            
            // 已破碎平台的裂缝
            if ((platform.type === 'breakable' || platform.type === 'movingBreakable') && platform.isBroken) {
                // 冰块破碎效果
                ctx.strokeStyle = platform.type === 'breakable' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 240, 255, 0.9)';
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

    // --- Draw Foreground Clouds --- > ADDED LAYER LOGIC
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // Set fill style for clouds
    clouds.forEach(cloud => {
        if (cloud.layer === 'front') { // Only draw foreground clouds here
            // Check visibility
            if (cloud.y + cloud.size > visibleLogicalTopY && cloud.y - cloud.size < logicalHeight) {
                drawCloudShape(ctx, cloud.x, cloud.y, cloud.size, cloud.type);
            }
        }
    });
    // --- End Foreground Clouds ---

    // Score Display (Use logical coordinates, but anchor to top, account for offset)
    ctx.restore(); // Restore the context state before drawing Score
    
    // Apply scaling for UI
    ctx.save();
    // Score is displayed in physical coordinates at the top of the screen
    ctx.font = '48px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // 获取安全区域顶部尺寸
    const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)')) || 0;
    // 使用分数显示位置，考虑安全区域
    const scoreY = Math.max(20, safeAreaTop + 10);

    // Use displayScore for readability
    const displayScore = Math.floor(score / 100);
    ctx.fillText(`${displayScore}`, canvasWidth / 2, scoreY);

    // Draw virtual joystick if active
    if (joystickActive) {
        // 绘制摇杆基座（透明圆）
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(joystickStartX, joystickStartY, joystickRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 计算摇杆手柄位置（限制在基座圆内）
        const dx = joystickCurrentX - joystickStartX;
        const dy = joystickCurrentY - joystickStartY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = joystickRadius - joystickKnobRadius/2;
        
        let knobX = joystickStartX;
        let knobY = joystickStartY;
        
        if (distance > 0) {
            const limitedDistance = Math.min(distance, maxDistance);
            knobX = joystickStartX + (dx / distance) * limitedDistance;
            knobY = joystickStartY + (dy / distance) * limitedDistance;
        }
        
        // 绘制摇杆手柄
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(knobX, knobY, joystickKnobRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 重置透明度
        ctx.globalAlpha = 1.0;
    }

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
     ctx.font = '24px Arial';
     const displayScore = Math.floor(score / 100);
     ctx.fillText('得分: ' + displayScore, canvasWidth / 2, canvasHeight / 2);
     ctx.fillText('点击或触摸屏幕重新开始', canvasWidth / 2, canvasHeight / 2 + 40); // Updated text
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
        init();
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
         joystickActive = false;
         return; // Don't process touch for movement if restarting
     }
    // Handle regular touchend logic only if not game over
    isTouching = false;
    touchStartX = null;
});

// 设置事件监听
window.addEventListener('resize', resizeHandler);
window.addEventListener('orientationchange', () => {
    setTimeout(setViewportHeight, 100);
});

// 初始化时检测移动设备并进行相应调整
adjustForMobile();

// --- Start Game ---
init(); // Calls resizeHandler inside
console.log("Game initialized. Starting loop..."); 