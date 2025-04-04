const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ===== 难度配置（统一管理所有难度相关参数） =====
const difficultyConfig = {
    // 基础难度计算
    maxScore: 5000,                   // 达到最大难度所需的分数（像素高度）
    
    // 平台类型阈值
    movingThreshold: 0.2,             // 移动平台出现的难度阈值
    breakableThreshold: 0.4,          // 易碎平台出现的难度阈值
    movingBreakableThreshold: 0.7,    // 移动易碎平台出现的难度阈值
    springThreshold: 0.0,             // 弹簧道具出现的难度阈值（从游戏开始就有，但概率会随难度增加）
    phantomThreshold: 0.0,            // 假砖块出现的难度阈值
    verticalMovingThreshold: 0.6,     // 上下移动平台出现的难度阈值
    
    // 平台出现概率
    springBaseProbability: 0.08,      // 弹簧道具基础概率
    springMaxIncrement: 0.1,         // 弹簧道具最大概率增量（难度最高时达到24%概率）
    
    // 特殊平台基础概率和最大增量
    movingBaseProbability: 0.1,       // 移动平台基础概率
    movingMaxIncrement: 0.15,          // 移动平台最大概率增量
    
    breakableBaseProbability: 0.05,   // 易碎平台基础概率
    breakableMaxIncrement: 0.3,      // 易碎平台最大概率增量
    
    movingBreakableBaseProbability: 0.05, // 移动易碎平台基础概率
    movingBreakableMaxIncrement: 0.5,     // 移动易碎平台最大概率增量
    
    // 上下移动平台参数
    verticalMovingBaseProbability: 0.08,  // 上下移动平台基础概率
    verticalMovingMaxIncrement: 0.15,     // 上下移动平台最大概率增量
    verticalMovingBaseSpeed: 0.5,         // 上下移动平台基础速度，减小以使移动更平滑
    verticalMovingSpeedIncrement: 0.8,    // 上下移动平台速度难度增量
    verticalMovingRange: 80,             // 上下移动平台的移动范围（像素）
    
    // 假砖块生成参数
    phantomBaseProbability: 0.1,      // 假砖块基础生成概率
    phantomMaxIncrement: 0.2,         // 假砖块最大概率增量
    // 移除phantomGenerationInterval参数，不再基于帧数生成
    phantomMinPerGeneration: 1,       // 每次生成的最小数量
    phantomMaxPerGeneration: 3,       // 每次生成的最大数量
    phantomYSpacing: 150,             // 高度生成间隔
    
    // 平台间距
    basePlatformMinYSpacing: 30,      // 初始最小间距
    basePlatformMaxYSpacing: 200,     // 初始最大间距
    maxPlatformMinYSpacing: 60,       // 最高难度最小间距
    maxPlatformMaxYSpacing: 240,      // 最高难度最大间距
    
    // 移动平台速度
    movingPlatformBaseSpeed: 1,       // 移动平台基础速度
    movingPlatformSpeedIncrement: 3 // 移动平台速度难度增量
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
let gameState = 'menu'; // 新增游戏状态：'menu', 'playing', 'gameover'
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

// 添加假砖块数组
let phantomPlatforms = [];
const phantomPlatformWidth = 70; // 与普通平台相同宽度
const phantomPlatformHeight = 15; // 与普通平台相同高度

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

// 设置Canvas的DPI以匹配设备像素比
function setupHiDPICanvas() {
    // 获取设备像素比
    const dpr = window.devicePixelRatio || 1;
    
    // 获取Canvas元素的当前尺寸
    const rect = canvas.getBoundingClientRect();
    
    // 设置Canvas的实际像素尺寸（内部缓冲区大小）
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    // 使用CSS保持Canvas的显示尺寸不变
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    // 缩放上下文以匹配像素比
    ctx.scale(dpr, dpr);
    
    // 应用抗锯齿设置
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // 设置文本渲染属性
    ctx.textBaseline = 'middle';
    
    return dpr;
}

// --- Resize Handler ---
function resizeHandler() {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    
    // 更新Canvas样式尺寸
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    
    // 设置高DPI Canvas
    const dpr = setupHiDPICanvas();
    
    // 重新设置逻辑尺寸
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;

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
    console.log("初始化游戏...");
    // 从菜单状态转换到游戏状态
    gameState = 'playing';
    score = 0;
    gameover = false;
    difficulty = 0;
    previousDifficulty = 0;
    
    // 清空弹簧数组
    springs = [];
    
    // 保留现有的玩家位置、颜色和第一个平台
    // 但需要生成其余初始平台
    const firstPlatform = platforms.length > 0 ? platforms[0] : null;
    
    // 确保玩家位置正确
    player.x = logicalWidth / 2 - player.baseWidth / 2;
    player.y = logicalHeight - 100;
    player.vx = 0;
    player.vy = 0;
    player.isJumping = false;
    player.onGround = false;
    player.scaleX = 1;
    player.scaleY = 1;
    player.squashTimer = 0;
    player.inputTime = 0;
    player.movementState = 'idle';
    
    // 清除除第一个平台外的所有平台(如果有的话)
    if (firstPlatform) {
        platforms = [firstPlatform];
        
        // 确保第一个平台在玩家脚下
        platforms[0].x = player.x + (player.width - platformWidth) / 2;
        platforms[0].y = player.y + player.height;
        platforms[0].type = 'normal';
        platforms[0].isBroken = false;
    } else {
        // 如果没有平台，创建一个在玩家脚下
        platforms = [];
        const platformY = player.y + player.height;
        const platformX = player.x + (player.width - platformWidth) / 2;
        
        const newPlatform = {
            x: platformX,
            y: platformY,
            width: platformWidth,
            height: platformHeight,
            type: 'normal',
            isBroken: false,
            vx: 0,
            direction: 1,
            breakTimer: 0
        };
        platforms.push(newPlatform);
    }
    
    // 创建其余初始平台
    for (let i = 1; i < initialPlatforms; i++) {
        let yPos = logicalHeight - 50 - i * ((difficultyConfig.basePlatformMinYSpacing + difficultyConfig.basePlatformMaxYSpacing) / 2);
        createPlatform(Math.random() * (logicalWidth - platformWidth), yPos, 'normal');
    }
    
    // 重置控制状态
    keys = {};
    touchStartX = null;
    isTouching = false;
    joystickActive = false;
    
    // 确保调整大小正确
    resizeHandler();
    
    // 为移动设备进行额外调整
    adjustForMobile();
    
    // 确保游戏循环正在运行
    if (!gameLoopRunning) {
        console.log("启动游戏循环");
        gameLoopRunning = true;
        requestAnimationFrame(gameLoop);
    } else {
        console.log("游戏循环已经在运行中");
    }
}

// 初始化菜单场景（只创建玩家脚下的第一个平台，其他平台在游戏开始后生成）
function initMenu() {
    console.log("初始化菜单...");
    // 重置游戏状态
    score = 0;
    gameover = false;
    gameState = 'menu';
    difficulty = 0;
    previousDifficulty = 0;
    clouds = [];
    platforms = [];
    springs = []; // 清空弹簧数组
    phantomPlatforms = []; // 清空假砖块数组
    // 移除phantomGenerationTimer的重置
    
    // 添加角色动画相关状态
    playerMenuAnimation = {
        active: false,
        type: 'none',
        timer: 0,
        jumpHeight: 0,
        rotation: 0,
        scale: 1,
        colorChange: false
    };
    
    // 确保画布尺寸和缩放正确设置
    resizeHandler();
    
    // 设置高DPI Canvas
    setupHiDPICanvas();
    
    // 随机选择一个玩家颜色
    currentPlayerColor = playerColors[Math.floor(Math.random() * playerColors.length)];
    
    // 放置玩家角色（与游戏开始时相同位置）
    player.x = logicalWidth / 2 - player.baseWidth / 2; // Center based on base width
    player.y = logicalHeight - 100; 
    player.vx = 0;
    player.vy = 0;
    player.isJumping = false;
    player.onGround = false;
    player.scaleX = 1;
    player.scaleY = 1;
    player.squashTimer = 0;
    player.inputTime = 0;
    player.movementState = 'idle';
    
    // 只创建玩家脚下的第一个平台
    const platformY = player.y + player.height;
    const platformX = player.x + (player.width - platformWidth) / 2;
    
    // 创建单个平台并设置在玩家脚下
    const firstPlatform = {
        x: platformX,
        y: platformY,
        width: platformWidth,
        height: platformHeight,
        type: 'normal',
        isBroken: false,
        vx: 0,
        direction: 1,
        breakTimer: 0
    };
    platforms.push(firstPlatform);
    
    // 创建初始云朵 (与游戏开始时相同)
    for (let i = 0; i < initialClouds; i++) {
        let yPos = logicalHeight - (Math.random() * logicalHeight * 1.5); // Spread initial clouds higher
        createCloud(Math.random() * logicalWidth, yPos);
    }
    
    // 开始游戏循环
    if (!gameLoopRunning) {
        console.log("启动游戏循环（菜单）");
        gameLoopRunning = true;
        requestAnimationFrame(gameLoop);
    } else {
        console.log("游戏循环已经在运行中（菜单）");
    }
    
    // 立即绘制一次菜单，确保按钮可见
    drawMenu();
}

// createPlatform remains the same, works in logical coordinates
function createPlatform(x, y, forcedType = null) {
    let type = 'normal';
    if (!forcedType) { // Only determine type randomly if not forced
        const rand = Math.random();
        
        // 计算各类平台的当前概率
        let movingProb = 0;
        let breakableProb = 0;
        let movingBreakableProb = 0;
        let verticalMovingProb = 0;
        
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
        
        // 上下移动平台概率计算
        if (difficulty >= difficultyConfig.verticalMovingThreshold) {
            verticalMovingProb = difficultyConfig.verticalMovingBaseProbability + 
                difficultyConfig.verticalMovingMaxIncrement * 
                ((difficulty - difficultyConfig.verticalMovingThreshold) / 
                (1 - difficultyConfig.verticalMovingThreshold));
        }
        
        // 根据随机值和计算出的概率确定平台类型（按优先级顺序判断）
        let probSum = 0;
        
        // 移动易碎平台判断
        if (rand < movingBreakableProb && difficulty >= difficultyConfig.movingBreakableThreshold) {
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
        // 上下移动平台判断
        else if (rand < (probSum += movingProb) + verticalMovingProb && difficulty >= difficultyConfig.verticalMovingThreshold) {
            type = 'verticalMoving';
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
        vy: 0,
        direction: 1,
        verticalDirection: 1,
        breakTimer: 0, // 添加：破碎后的消失计时器
        // 上下移动平台额外属性
        initialY: y,
        verticalRange: difficultyConfig.verticalMovingRange
    };
    if (platform.type === 'moving' || platform.type === 'movingBreakable') {
        platform.vx = difficultyConfig.movingPlatformBaseSpeed + difficulty * difficultyConfig.movingPlatformSpeedIncrement;
        platform.direction = Math.random() < 0.5 ? 1 : -1;
    }
    else if (platform.type === 'verticalMoving') {
        platform.vy = difficultyConfig.verticalMovingBaseSpeed + difficulty * difficultyConfig.verticalMovingSpeedIncrement;
        
        // 设置初始位置和运动参考点
        platform.initialY = y;
        platform.verticalRange = difficultyConfig.verticalMovingRange;
        
        // 随机初始方向
        platform.verticalDirection = Math.random() < 0.5 ? -1 : 1;
    }
    platforms.push(platform);
    
    // 随机决定是否在平台上添加弹簧
    // 基于难度增加弹簧出现概率
    const springProb = difficultyConfig.springBaseProbability + 
        difficultyConfig.springMaxIncrement * difficulty;
        
    if (Math.random() < springProb) {
        // 创建弹簧并添加到数组中
        const spring = createSpring(x, y, platformWidth);
        if (spring) {
            springs.push(spring);
        }
    }
}

// 添加弹簧道具数组
let springs = [];
const springWidth = 20; // 弹簧宽度
const springHeight = 10; // 弹簧高度（静止状态）
const springActiveHeight = 20; // 弹簧激活时的高度
// 移除单独的springProbability变量，使用difficultyConfig中的值

// 创建一个新的弹簧道具
function createSpring(platformX, platformY, platformWidth) {
    // 在平台宽度范围内随机选择位置，留出边缘空间
    const margin = Math.min(10, platformWidth / 6); // 最小边缘空间为10像素或平台宽度的1/6
    const minX = platformX + margin;
    const maxX = platformX + platformWidth - margin - springWidth;
    
    // 确保弹簧有足够空间放置
    if (maxX <= minX) {
        return null; // 平台太小，无法放置弹簧
    }
    
    // 随机选择弹簧在平台上的位置
    const springX = minX + Math.random() * (maxX - minX);
    
    // 创建并返回弹簧对象
    return {
        x: springX,
        y: platformY - springHeight, // 放在平台上方
        width: springWidth,
        height: springHeight,
        active: false,
        timer: 0,
        platformIndex: platforms.length - 1 // 记录弹簧所在的平台索引
    };
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
    // 在菜单状态下按Enter或空格开始游戏
    if (gameState === 'menu' && (e.code === 'Enter' || e.code === 'Space')) {
        init();
        return;
    }
    
    // 在游戏结束状态下只有按左右方向键或空格键才重新开始
    if (gameState === 'gameover') {
        // 判断是否按下了指定的按键
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || 
            e.code === 'KeyA' || e.code === 'KeyD' || e.code === 'Space') {
            init();
        }
        return;
    }
    
    // 游戏中的键盘控制
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
    if (gameState === 'menu') {
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        
        if (menuButton && isInsideButton(touchX, touchY, menuButton)) {
            // 点击了开始按钮
            init();
        } else if (menuPlayerHitbox && isInsideButton(touchX, touchY, menuPlayerHitbox)) {
            // 点击了玩家角色
            triggerPlayerAnimation();
        }
        return;
    }
    
    if (gameState === 'gameover') {
        // 游戏结束状态，点击任意位置重新开始
        init();
        // 重置触摸状态
        isTouching = false;
        touchStartX = null;
        joystickActive = false;
        return;
    }
    
    // 游戏中的触摸控制
    if (joystickActive) {
        joystickActive = false;
    } else {
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
    platforms.forEach((platform, index) => {
        if (platform.type === 'moving' || platform.type === 'movingBreakable') {
            const prevX = platform.x;
            platform.x += platform.vx * platform.direction;
            // Bounce using logical width
            if (platform.x <= 0 || platform.x + platform.width >= logicalWidth) {
                platform.direction *= -1;
            }
            
            // 更新该平台上的弹簧位置
            springs.forEach(spring => {
                if (spring.platformIndex === index) {
                    spring.x += platform.x - prevX;
                }
            });
        }
        // 处理上下移动平台
        else if (platform.type === 'verticalMoving') {
            const prevY = platform.y;
            platform.y += platform.vy * platform.verticalDirection;
            
            // 计算距离初始位置的距离，超过范围则反向
            const distanceFromInitial = Math.abs(platform.y - platform.initialY);
            if (distanceFromInitial > difficultyConfig.verticalMovingRange / 2) {
                platform.verticalDirection *= -1;
                console.log(`平台改变方向：位置=${platform.y.toFixed(1)}, 初始=${platform.initialY.toFixed(1)}, 距离=${distanceFromInitial.toFixed(1)}, 方向=${platform.verticalDirection}`);
            }
            
            // 更新该平台上的弹簧位置
            springs.forEach(spring => {
                if (spring.platformIndex === index) {
                    spring.y += platform.y - prevY;
                }
            });
        }
    });

    // 更新弹簧状态
    springs.forEach(spring => {
        if (spring.active) {
            spring.timer--;
            if (spring.timer <= 0) {
                spring.active = false;
            }
        }
    });
    
    // 更新假砖块状态 - 破碎的假砖块逐渐消失
    phantomPlatforms.forEach(platform => {
        if (platform.isBroken) {
            platform.fadeTimer++;
            platform.opacity = Math.max(0, 1 - platform.fadeTimer / 20); // 20帧内完全消失
            
            // 完全消失后标记为移除
            if (platform.fadeTimer >= 20) {
                platform.opacity = 0;
            }
        }
    });
    
    // 移除已消失的假砖块
    phantomPlatforms = phantomPlatforms.filter(platform => platform.opacity > 0);

    // Collision Detection (Use Logical Dimensions)
    player.onGround = false;
    if (player.vy > 0) { // Only check when falling
        // 首先检测与弹簧的碰撞
        let springCollision = false;
        springs.forEach(spring => {
            // 调整玩家碰撞箱，使其更窄以便精确检测弹簧碰撞
            const playerFeetWidth = player.baseWidth * 0.7; // 使用70%的宽度作为"脚"的碰撞区域
            const playerFeetX = player.x + (player.baseWidth - playerFeetWidth) / 2;
            
            if (!springCollision && 
                playerFeetX < spring.x + spring.width &&
                playerFeetX + playerFeetWidth > spring.x &&
                player.y + player.baseHeight >= spring.y &&
                player.y + player.baseHeight <= spring.y + spring.height + 10) 
            {
                // 检查弹簧对应的平台是否有效（未破碎）
                const platform = platforms[spring.platformIndex];
                if (platform && !platform.isBroken) {
                    // 碰到了弹簧
                    if (!player.isJumping) {
                        player.squashTimer = player.squashDuration; // 启动挤压计时器
                    }
                    player.y = spring.y - player.baseHeight; // 基于弹簧高度定位
                    
                    // 激活弹簧
                    spring.active = true;
                    spring.timer = 10; // 10帧的弹簧动画
                    
                    // 提供额外的弹跳力
                    player.vy = player.jumpPower * 1.5; // 弹簧提供1.5倍跳跃力
                    
                    player.isJumping = true; 
                    player.onGround = true;
                    springCollision = true; // 标记为已与弹簧碰撞
                    
                    // 如果平台是易碎的，触发破碎
                    if (platform.type === 'breakable' || platform.type === 'movingBreakable') {
                        platform.isBroken = true;
                        platform.breakTimer = 30; // 30帧后消失
                    }
                }
            }
        });
        
        // 如果没有与弹簧碰撞，则检测与平台的碰撞
        if (!springCollision) {
            // 先检测与真实平台的碰撞
            platforms.forEach(platform => {
                // 调整玩家尺寸用于碰撞检测，基于BASE尺寸
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
                    // 落在平台上
                    if (!player.isJumping) { // 仅在初次着陆时触发挤压，不是上跳时
                        player.squashTimer = player.squashDuration; // 启动挤压计时器
                    }
                    player.y = platform.y - player.baseHeight; // 基于基础高度定位
                    
                    // 普通跳跃力度
                    player.vy = player.jumpPower;
                    
                    player.isJumping = true; 
                    player.onGround = true; 
                    if (platform.type === 'breakable' || platform.type === 'movingBreakable') {
                        platform.isBroken = true;
                        platform.breakTimer = 30; // 30帧后消失
                    }
                }
            });
            
            // 如果没有与真实平台碰撞，再检测与假砖块的碰撞
            if (!player.onGround) {
                phantomPlatforms.forEach(platform => {
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
                        // 触碰到假砖块，立即标记为破碎
                        platform.isBroken = true;
                        platform.fadeTimer = 0;
                        
                        // 不提供任何跳跃力，假砖块无法支撑玩家
                        // 但可以添加轻微的减速效果，让玩家感觉有碰到东西
                        if (player.vy > 5) { // 如果下落速度较快，稍微减缓
                            player.vy *= 0.8;
                        }
                    }
                });
            }
        }
    } else {
         // 如果向上移动且不在地面，重置跳跃标志
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
        platforms.forEach(p => {
            p.y += cameraOffset;
            // 上下移动平台的初始位置也需要随着相机滚动更新
            if (p.type === 'verticalMoving') {
                p.initialY += cameraOffset;
            }
        });
        springs.forEach(s => s.y += cameraOffset); // 更新弹簧位置
        phantomPlatforms.forEach(p => p.y += cameraOffset); // 更新假砖块位置
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
    
    // 找出需要移除的平台索引
    const platformsToRemove = [];
    platforms.forEach((p, index) => {
        if (p.y >= logicalHeight || // 平台低于屏幕底部
           ((p.type === 'breakable' || p.type === 'movingBreakable') && p.isBroken && p.breakTimer <= 0)) // 破碎平台计时结束
        {
            platformsToRemove.push(index);
        }
    });
    
    // 从后向前移除平台，并更新弹簧的platformIndex
    if (platformsToRemove.length > 0) {
        // 从大到小排序索引，以便从后向前删除
        platformsToRemove.sort((a, b) => b - a);
        
        // 移除平台
        platformsToRemove.forEach(index => {
            platforms.splice(index, 1);
            
            // 移除该平台上的弹簧
            springs = springs.filter(s => s.platformIndex !== index);
            
            // 更新后续平台上的弹簧的platformIndex
            springs.forEach(s => {
                if (s.platformIndex > index) {
                    s.platformIndex--;
                }
            });
        });
    }
    
    // 移除超出屏幕底部的假砖块
    phantomPlatforms = phantomPlatforms.filter(p => p.y < logicalHeight);

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
        
        // 在这里为新的真实平台高度附近，尝试生成假砖块
        createPhantomPlatform(newY - difficultyConfig.phantomYSpacing/2);
        
        highestPlatformY = newY;
    }
    
    // Game Over Condition (Based on Logical Height)
    if (player.y > logicalHeight) { // Game over as soon as player's top edge is below bottom
        gameover = true;
        gameState = 'gameover';
        console.log("Game Over! Score:", Math.floor(score / 100));
    }

    // Difficulty Update - 修改难度计算和输出逻辑
    const rawDifficulty = Math.min(1, score / difficultyConfig.maxScore);
    
    // 按0.05步长取整难度值
    const roundedDifficulty = Math.floor(rawDifficulty * 20) / 20;
    
    // 只有当取整后的难度值发生变化时才更新和输出
    if (roundedDifficulty !== difficulty) {
        difficulty = roundedDifficulty;
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
    
    // --- 绘制假砖块 (在真实平台之前绘制，让真实平台覆盖在上面) ---
    phantomPlatforms.forEach(platform => {
        if (platform.y + platform.height > visibleLogicalTopY && platform.y < logicalHeight) {
            const platformX = platform.x;
            const platformY = platform.y;
            const platformW = platform.width;
            const platformH = platform.height;
            const platformCornerRadius = 5;
            const grassHeight = platformH * 0.4; // 与普通平台一致的草地高度比例
            
            // 设置透明度
            ctx.globalAlpha = platform.isBroken ? (1 - platform.fadeTimer / 20) * 0.7 : 0.7;
            
            // 基础颜色 - 使用与普通平台相似但更浅的颜色，像海市蜃楼幻影
            let grassColor = '#C8F5C8'; // 更浅的绿色（普通平台是#90EE90）
            let soilColor = '#E0B285'; // 更浅的土色（普通平台是#CD853F）
            
            if (platform.isBroken) {
                // 消失过程中转变为云状
                // 不再绘制标准平台形状，而是绘制云状效果
                const cloudProgress = platform.fadeTimer / 20; // 0到1的进度
                
                // 绘制散开的云团
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                const centerX = platformX + platformW/2;
                const centerY = platformY + platformH/2;
                const scatterRadius = 15 + cloudProgress * 20; // 云朵散开的半径
                
                // 绘制5-6个随机散开的小云团
                for (let i = 0; i < 6; i++) {
                    const angle = (i / 6) * Math.PI * 2 + cloudProgress * 0.5;
                    const distance = scatterRadius * (0.5 + 0.5 * Math.random());
                    const x = centerX + Math.cos(angle) * distance;
                    const y = centerY + Math.sin(angle) * distance;
                    const size = (1 - cloudProgress * 0.7) * platformH * (0.4 + 0.3 * Math.random());
                    
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                // 未破碎状态 - 绘制类似普通平台但半透明的形状
                
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
                
                // 添加轻微波动效果（海市蜃楼）
                const shimmerTime = Date.now() / 1000;
                const shimmerY = Math.sin(shimmerTime * 3 + platformX / 30) * 1.5;
                
                // 水平波纹线
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                
                for (let i = 0; i < 3; i++) {
                    const yPos = platformY + platformH * (0.3 + i * 0.25) + shimmerY;
                    ctx.moveTo(platformX, yPos);
                    
                    // 波浪线
                    for (let x = 0; x <= platformW; x += 5) {
                        const waveY = yPos + Math.sin((x + shimmerTime * 100) / 10) * 0.8;
                        ctx.lineTo(platformX + x, waveY);
                    }
                }
                ctx.stroke();
                
                // 添加一点闪烁效果
                if (Math.random() < 0.05) {
                    const sparkX = platformX + Math.random() * platformW;
                    const sparkY = platformY + Math.random() * platformH;
                    const sparkSize = 1 + Math.random() * 2;
                    
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.beginPath();
                    ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            
            // 重置透明度
            ctx.globalAlpha = 1.0;
        }
    });

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
            } else if (platform.type === 'verticalMoving') {
                grassColor = '#FFA07A'; // 亮橙色(草地部分)
                soilColor = '#CD853F'; // 标准土壤颜色但更深
            } else if (platform.type === 'breakable') {
                // 冰块风格 - 淡蓝色+白色
                grassColor = '#A5F2F3'; // 浅蓝色(冰块顶部)
                soilColor = '#77C5D5'; // 稍深蓝色(冰块底部)
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
            
            // 为上下移动平台添加特殊标记
            if (platform.type === 'verticalMoving' && !platform.isBroken) {
                // 绘制上下箭头标记
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                
                // 根据当前运动方向，加强对应的箭头效果
                const upArrowOpacity = platform.verticalDirection < 0 ? 0.9 : 0.5;
                const downArrowOpacity = platform.verticalDirection > 0 ? 0.9 : 0.5;
                const arrowSize = platformW * 0.15;
                const centerX = platformX + platformW / 2;
                
                // 上箭头 - 调整透明度
                ctx.fillStyle = `rgba(255, 255, 255, ${upArrowOpacity})`;
                ctx.beginPath();
                ctx.moveTo(centerX, platformY + platformH * 0.2);
                ctx.lineTo(centerX - arrowSize, platformY + platformH * 0.4);
                ctx.lineTo(centerX + arrowSize, platformY + platformH * 0.4);
                ctx.closePath();
                ctx.fill();
                
                // 下箭头 - 调整透明度
                ctx.fillStyle = `rgba(255, 255, 255, ${downArrowOpacity})`;
                ctx.beginPath();
                ctx.moveTo(centerX, platformY + platformH * 0.8);
                ctx.lineTo(centerX - arrowSize, platformY + platformH * 0.6);
                ctx.lineTo(centerX + arrowSize, platformY + platformH * 0.6);
                ctx.closePath();
                ctx.fill();
                
                // 连接线
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(centerX, platformY + platformH * 0.4);
                ctx.lineTo(centerX, platformY + platformH * 0.6);
                ctx.stroke();
                
                // 添加平台当前运动的波纹效果
                const waveOffset = platform.verticalDirection < 0 ? -3 : 3;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                
                // 绘制几条波浪线，显示移动方向
                for (let i = 0; i < 3; i++) {
                    const yPos = platform.verticalDirection < 0 ? 
                                platformY + platformH + i * 4 : 
                                platformY - i * 4;
                    
                    ctx.moveTo(platformX, yPos);
                    for (let x = 0; x <= platformW; x += 5) {
                        const time = Date.now() / 500;
                        const waveY = yPos + Math.sin((x / platformW * 2 * Math.PI) + time) * 1.5;
                        ctx.lineTo(platformX + x, waveY);
                    }
                }
                ctx.stroke();
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
    
    // --- Draw Springs ---
    springs.forEach(spring => {
        if (spring.y + spring.height > visibleLogicalTopY && spring.y < logicalHeight) {
            const springX = spring.x;
            const springY = spring.y;
            const springW = spring.width;
            // 根据弹簧是否激活决定高度
            const springH = spring.active ? springActiveHeight : spring.height;
            
            // 绘制弹簧图案
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 2;
            
            // 弹簧图案
            const springBaseY = springY + springH; // 弹簧底部
            const springTopY = springY;
            
            // 绘制弹簧线圈
            ctx.beginPath();
            ctx.moveTo(springX, springBaseY);
            
            // 弹簧线圈数
            const coils = 3;
            const coilHeight = springH / (coils * 2);
            
            for (let i = 0; i < coils; i++) {
                // 一个完整的波浪
                ctx.lineTo(springX + springW, springBaseY - (i*2+1)*coilHeight);
                ctx.lineTo(springX, springBaseY - (i*2+2)*coilHeight);
            }
            
            ctx.stroke();
            
            // 绘制弹簧顶部小板
            ctx.fillStyle = 'rgba(255, 215, 0, 0.8)'; // 金色半透明
            ctx.fillRect(springX - springW*0.3, springTopY - platformHeight*0.15, springW*1.6, platformHeight*0.15);
        }
    });
    // --- End Springs ---

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

    // Restore context state (removes translation, scaling, and clipping)
    ctx.restore();
    
    // 绘制得分显示
    drawScore();

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

    // Game Over screen is handled separately to overlay on top
    if (gameover) {
       drawGameOver();
    }
}

// 绘制得分
function drawScore() {
    // 保存当前上下文状态
    ctx.save();
    
    // 应用抗锯齿设置
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // 设置字体和渲染样式
    ctx.font = '48px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // 获取安全区域顶部尺寸
    const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)')) || 0;
    // 使用分数显示位置，考虑安全区域
    const scoreY = Math.max(20, safeAreaTop + 10);

    // 使用整数坐标以避免模糊
    const scoreX = Math.round(canvasWidth / 2);
    // Use displayScore for readability
    const displayScore = Math.floor(score / 100);
    
    // 添加轻微阴影提高可读性
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    ctx.fillText(`${displayScore}`, scoreX, scoreY);
    
    // 恢复上下文状态
    ctx.restore();
}

// --- 绘制菜单界面 ---
function drawMenu() {
    // 清空画布
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // 绘制背景
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 绘制游戏场景（与游戏内相同的渲染方式）
    // 保存上下文
    ctx.save();
    
    // 应用缩放和平移
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    
    // --- Define and Apply Clipping Region based on visible logical area ---
    const visibleLogicalTopY = logicalHeight - (canvasHeight / scale);
    const visibleLogicalHeight = canvasHeight / scale;
    const visibleLogicalLeftX = (0 - offsetX) / scale;
    const visibleLogicalWidth = canvasWidth / scale;
    
    ctx.beginPath();
    ctx.rect(visibleLogicalLeftX, visibleLogicalTopY, visibleLogicalWidth, visibleLogicalHeight);
    ctx.clip();
    
    // --- 绘制背景云 ---
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    clouds.forEach(cloud => {
        if (cloud.layer === 'back') {
            if (cloud.y + cloud.size > visibleLogicalTopY && cloud.y - cloud.size < logicalHeight) {
                drawCloudShape(ctx, cloud.x, cloud.y, cloud.size, cloud.type);
            }
        }
    });
    
    // --- 绘制平台 ---
    platforms.forEach(platform => {
        if (platform.y + platform.height > visibleLogicalTopY && platform.y < logicalHeight) {
            const platformX = platform.x;
            const platformY = platform.y;
            const platformW = platform.width;
            const platformH = platform.height;
            const grassHeight = platformH * 0.4;
            const platformCornerRadius = 5;
            
            // 确定基础颜色
            let grassColor = '#90EE90'; // 淡绿色草地
            let soilColor = '#CD853F'; // 秘鲁色土壤
            
            // 绘制土壤(下部分)
            ctx.fillStyle = soilColor;
            ctx.beginPath();
            ctx.roundRect(platformX, platformY, platformW, platformH, platformCornerRadius);
            ctx.fill();
            
            // 绘制草地(上部分)
            ctx.fillStyle = grassColor;
            ctx.beginPath();
            ctx.roundRect(platformX, platformY, platformW, grassHeight, 
                [platformCornerRadius, platformCornerRadius, 0, 0]);
            ctx.fill();
            
            // 绘制低多边形效果(简化版)
            // 草地阴影三角形
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
    });
    
    // --- 绘制玩家（添加动画效果） ---
    // 保存上下文用于角色动画
    ctx.save();
    
    // 添加角色动画效果
    let drawY = player.y;
    let drawX = player.x;
    
    // 创建角色动画效果
    if (playerMenuAnimation.active) {
        // 更新动画计时器
        playerMenuAnimation.timer++;
        
        // 根据动画类型应用不同效果
        if (playerMenuAnimation.type === 'jump') {
            // 简单的跳跃动画 - 正弦曲线
            const jumpProgress = playerMenuAnimation.timer / 30; // 30帧完成一次跳跃
            playerMenuAnimation.jumpHeight = Math.sin(jumpProgress * Math.PI) * 30;
            drawY = player.y - playerMenuAnimation.jumpHeight;
            
            // 跳跃动画结束
            if (playerMenuAnimation.timer >= 30) {
                playerMenuAnimation.active = false;
                playerMenuAnimation.timer = 0;
                playerMenuAnimation.jumpHeight = 0;
            }
        } else if (playerMenuAnimation.type === 'spin') {
            // 旋转动画
            playerMenuAnimation.rotation = playerMenuAnimation.timer * 12; // 每帧12度
            
            // 设置旋转中心
            ctx.translate(drawX + player.baseWidth/2, drawY + player.baseHeight/2);
            ctx.rotate(playerMenuAnimation.rotation * Math.PI / 180);
            ctx.translate(-(drawX + player.baseWidth/2), -(drawY + player.baseHeight/2));
            
            // 旋转动画结束
            if (playerMenuAnimation.timer >= 30) {
                playerMenuAnimation.active = false;
                playerMenuAnimation.timer = 0;
                playerMenuAnimation.rotation = 0;
            }
        } else if (playerMenuAnimation.type === 'bounce') {
            // 弹跳缩放动画
            const bounceProgress = playerMenuAnimation.timer / 20; // 20帧完成一次弹跳
            const scaleFactor = 1 + 0.3 * Math.sin(bounceProgress * Math.PI);
            player.scaleX = scaleFactor;
            player.scaleY = 2 - scaleFactor; // 反向缩放Y轴，扁平效果
            
            // 弹跳动画结束
            if (playerMenuAnimation.timer >= 20) {
                playerMenuAnimation.active = false;
                playerMenuAnimation.timer = 0;
                player.scaleX = 1;
                player.scaleY = 1;
            }
        } else if (playerMenuAnimation.type === 'color') {
            // 颜色变换动画
            if (playerMenuAnimation.timer === 1) {
                // 随机选择一个新颜色（确保与当前颜色不同）
                let newColorIndex;
                do {
                    newColorIndex = Math.floor(Math.random() * playerColors.length);
                } while (playerColors[newColorIndex] === currentPlayerColor);
                
                currentPlayerColor = playerColors[newColorIndex];
            }
            
            // 简单的弹跳效果配合颜色变化
            const bounceProgress = playerMenuAnimation.timer / 15;
            player.scaleY = 1 + 0.2 * Math.sin(bounceProgress * Math.PI);
            
            // 颜色动画结束
            if (playerMenuAnimation.timer >= 15) {
                playerMenuAnimation.active = false;
                playerMenuAnimation.timer = 0;
                player.scaleY = 1;
            }
        }
    }
    
    // 计算尺寸和位置（考虑动画影响）
    const drawWidth = player.baseWidth * player.scaleX;
    const drawHeight = player.baseHeight * player.scaleY;
    
    // 调整绘制位置以保持图形中心不变
    const adjustedX = drawX - (drawWidth - player.baseWidth) / 2;
    const adjustedY = drawY - (drawHeight - player.baseHeight) / 2;
    const cornerRadius = 10;
    
    // 设置玩家颜色
    ctx.fillStyle = currentPlayerColor;
    
    // 绘制圆角矩形身体
    ctx.beginPath();
    ctx.roundRect(adjustedX, adjustedY, drawWidth, drawHeight, cornerRadius);
    ctx.fill();
    
    // 绘制眼睛
    const eyeRadius = 3;
    const baseEyeOffsetX = drawWidth * 0.25;
    const eyeOffsetY = drawHeight * 0.3;
    
    const centerX = adjustedX + drawWidth / 2;
    ctx.fillStyle = 'black';
    
    // 菜单中的眨眼动画
    const blinkFrequency = 120; // 每120帧眨一次眼
    const blinkDuration = 10; // 眨眼持续10帧
    
    if (Math.floor(Date.now() / 1000 * 60) % blinkFrequency < blinkDuration) {
        // 眨眼状态 - 绘制线条而不是圆形
        ctx.lineWidth = 2;
        // 左眼
        ctx.beginPath();
        ctx.moveTo(centerX - baseEyeOffsetX - eyeRadius, adjustedY + eyeOffsetY);
        ctx.lineTo(centerX - baseEyeOffsetX + eyeRadius, adjustedY + eyeOffsetY);
        ctx.stroke();
        // 右眼
        ctx.beginPath();
        ctx.moveTo(centerX + baseEyeOffsetX - eyeRadius, adjustedY + eyeOffsetY);
        ctx.lineTo(centerX + baseEyeOffsetX + eyeRadius, adjustedY + eyeOffsetY);
        ctx.stroke();
    } else {
        // 正常状态 - 绘制圆形眼睛
        // 左眼
        ctx.beginPath();
        ctx.arc(centerX - baseEyeOffsetX, adjustedY + eyeOffsetY, eyeRadius, 0, Math.PI * 2);
        ctx.fill();
        // 右眼
        ctx.beginPath();
        ctx.arc(centerX + baseEyeOffsetX, adjustedY + eyeOffsetY, eyeRadius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // 存储角色位置信息（用于点击检测）
    menuPlayerHitbox = {
        x: drawX * scale + offsetX,
        y: drawY * scale + offsetY,
        width: player.baseWidth * scale,
        height: player.baseHeight * scale
    };
    
    // 恢复绘图上下文
    ctx.restore();
    
    // --- 绘制前景云 ---
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    clouds.forEach(cloud => {
        if (cloud.layer === 'front') {
            if (cloud.y + cloud.size > visibleLogicalTopY && cloud.y - cloud.size < logicalHeight) {
                drawCloudShape(ctx, cloud.x, cloud.y, cloud.size, cloud.type);
            }
        }
    });
    
    // 恢复上下文
    ctx.restore();
    
    // 绘制半透明覆盖层
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 绘制游戏标题
    ctx.save();
    
    // 应用抗锯齿设置和更好的字体渲染
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.font = 'bold 48px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle'; // 改进垂直对齐
    
    // 使用更轻微的阴影效果
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    // 使用整数坐标位置以避免模糊
    const titleX = Math.round(canvasWidth / 2);
    const titleY = Math.round(canvasHeight / 3);
    ctx.fillText('无尽跳跃', titleX, titleY);
    
    // 绘制开始按钮
    const buttonWidth = 200;
    const buttonHeight = 60;
    const buttonX = Math.round(canvasWidth / 2 - buttonWidth / 2);
    const buttonY = Math.round(canvasHeight / 2);
    
    // 按钮背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, 10);
    ctx.fill();
    
    // 按钮文字
    ctx.fillStyle = '#4CAF50';
    ctx.font = '24px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
    const buttonTextX = Math.round(canvasWidth / 2);
    const buttonTextY = Math.round(buttonY + buttonHeight / 2);
    ctx.fillText('开始游戏', buttonTextX, buttonTextY);
    
    // 存储按钮位置信息（用于点击检测）
    menuButton = {
        x: buttonX,
        y: buttonY,
        width: buttonWidth,
        height: buttonHeight
    };
    
    // 恢复上下文
    ctx.restore();
    
    // 更新云朵位置（缓慢移动）
    clouds.forEach(cloud => {
        cloud.x += cloud.speed * cloud.direction;
        // 如果云朵移出屏幕，从另一侧重新进入
        if (cloud.x > logicalWidth + cloud.size) {
            cloud.x = -cloud.size;
        } else if (cloud.x < -cloud.size) {
            cloud.x = logicalWidth + cloud.size;
        }
    });
}

function drawGameOver() {
    // 绘制半透明覆盖层，与开始界面保持一致
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // 改为与菜单界面相同的透明度
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 游戏结束文字
    ctx.save();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    
    // 减少模糊度并使用更轻微的阴影效果
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    // 应用抗锯齿
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // 使用整数坐标位置以避免模糊
    const textX = Math.round(canvasWidth / 2);
    const textY = Math.round(canvasHeight / 2 - 80); // 向上移动一些以腾出空间
    ctx.fillText('游戏结束!', textX, textY);
    
    // 显示得分
    ctx.font = 'bold 36px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
    const displayScore = Math.floor(score / 100);
    ctx.fillText(`得分: ${displayScore}`, Math.round(canvasWidth / 2), Math.round(canvasHeight / 2 - 20));
    
    // 重新开始按钮
    const buttonWidth = 200;
    const buttonHeight = 50;
    const buttonX = Math.round(canvasWidth / 2 - buttonWidth / 2);
    const buttonY = Math.round(canvasHeight / 2 + 30);
    
    // 按钮背景 - 使用稍微带透明的柔和颜色
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, 10);
    ctx.fill();
    
    // 为按钮添加轻微的边框，增加立体感
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 设置文本基线为居中
    ctx.textBaseline = 'middle';
    
    // 按钮文字 - 使用更柔和的颜色
    ctx.fillStyle = '#3498db'; // 使用柔和的蓝色
    ctx.font = '24px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
    // 移除额外的偏移，使文字垂直居中
    ctx.fillText('重新开始', Math.round(canvasWidth / 2), Math.round(buttonY + buttonHeight / 2));
    
    // 存储按钮位置信息（用于点击检测）
    gameOverRestartButton = {
        x: buttonX,
        y: buttonY,
        width: buttonWidth,
        height: buttonHeight
    };
    
    // 回到主界面按钮
    const menuButtonY = buttonY + buttonHeight + 20; // 在第一个按钮下方
    
    // 按钮背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.roundRect(buttonX, menuButtonY, buttonWidth, buttonHeight, 10);
    ctx.fill();
    
    // 边框
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.stroke();
    
    // 按钮文字
    ctx.fillStyle = '#27ae60'; // 使用柔和的绿色
    // 移除额外的偏移，使文字垂直居中
    ctx.fillText('回到主界面', Math.round(canvasWidth / 2), Math.round(menuButtonY + buttonHeight / 2));
    
    // 存储回到主界面按钮位置
    gameOverMenuButton = {
        x: buttonX,
        y: menuButtonY,
        width: buttonWidth,
        height: buttonHeight
    };
    
    ctx.restore();
}

// --- Game Loop ---
let lastTime = 0;
let gameLoopRunning = false;
let menuButton = null; // 存储菜单按钮位置信息
let menuPlayerHitbox = null; // 存储菜单中玩家角色的位置信息
let gameOverRestartButton = null; // 存储游戏结束界面重新开始按钮位置
let gameOverMenuButton = null; // 存储游戏结束界面回到主界面按钮位置
let playerMenuAnimation = {
    active: false, 
    type: 'none',
    timer: 0,
    jumpHeight: 0,
    rotation: 0,
    scale: 1,
    colorChange: false
};

// 添加玩家角色点击动画
function triggerPlayerAnimation() {
    if (!playerMenuAnimation.active) {
        // 随机选择一种动画类型
        const animations = ['jump', 'spin', 'bounce', 'color'];
        const randomAnimation = animations[Math.floor(Math.random() * animations.length)];
        
        playerMenuAnimation.active = true;
        playerMenuAnimation.type = randomAnimation;
        playerMenuAnimation.timer = 0;
        
        console.log("触发角色动画:", randomAnimation);
    }
}

function gameLoop(timestamp) {
    if (!gameLoopRunning) return;

    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    // 根据游戏状态执行不同的更新和绘制逻辑
    if (gameState === 'menu') {
        drawMenu();
    } else if (gameState === 'playing') {
        update(deltaTime / 1000);
        draw();
        if (gameover) {
            gameState = 'gameover';
            console.log("游戏结束，状态切换到gameover");
        }
    } else if (gameState === 'gameover') {
        draw();
        drawGameOver();
    }

    requestAnimationFrame(gameLoop);
}

// 检查点击是否在按钮内
function isInsideButton(x, y, button) {
    return x >= button.x && x <= button.x + button.width &&
           y >= button.y && y <= button.y + button.height;
}

// --- Event Listeners ---
// Add resize listener
window.addEventListener('resize', resizeHandler);

// Add click listener for restart and menu interaction
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    if (gameState === 'menu') {
        if (menuButton && isInsideButton(clickX, clickY, menuButton)) {
            // 点击了开始按钮
            init();
        } else if (menuPlayerHitbox && isInsideButton(clickX, clickY, menuPlayerHitbox)) {
            // 点击了玩家角色
            triggerPlayerAnimation();
        }
    } else if (gameState === 'gameover') {
        // 检查点击的是哪个按钮
        if (gameOverRestartButton && isInsideButton(clickX, clickY, gameOverRestartButton)) {
            // 点击了重新开始按钮
            init();
        } else if (gameOverMenuButton && isInsideButton(clickX, clickY, gameOverMenuButton)) {
            // 点击了回到主界面按钮
            initMenu();
        }
    }
});

// Touchend listener for mobile
canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    
    if (gameState === 'menu') {
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        
        if (menuButton && isInsideButton(touchX, touchY, menuButton)) {
            // 点击了开始按钮
            init();
        } else if (menuPlayerHitbox && isInsideButton(touchX, touchY, menuPlayerHitbox)) {
            // 触摸了玩家角色
            triggerPlayerAnimation();
        }
        return;
    }
    
    if (gameState === 'gameover') {
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        
        // 检查触摸的是哪个按钮
        if (gameOverRestartButton && isInsideButton(touchX, touchY, gameOverRestartButton)) {
            // 触摸了重新开始按钮
            init();
        } else if (gameOverMenuButton && isInsideButton(touchX, touchY, gameOverMenuButton)) {
            // 触摸了回到主界面按钮
            initMenu();
        }
        
        // 重置触摸状态
        isTouching = false;
        touchStartX = null;
        joystickActive = false;
        return;
    }
    
    // 游戏中的触摸控制
    if (joystickActive) {
        joystickActive = false;
    } else {
        isTouching = false;
        touchStartX = null;
    }
}, { passive: false });

// 设置事件监听
window.addEventListener('orientationchange', () => {
    setTimeout(setViewportHeight, 100);
});

// 初始化时检测移动设备并进行相应调整
adjustForMobile();

// --- Start with Menu ---
// 替换原来的init()调用，改为initMenu()
initMenu();
console.log("Menu initialized. Waiting for player to start game..."); 

// 设置视口实际高度的辅助函数
function setViewportHeight() {
    // 设置CSS变量用于真实视口高度
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    
    // 更新画布尺寸
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    
    // 更新Canvas样式尺寸
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    
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

// 创建假砖块函数 - 修改为接受高度参数
function createPhantomPlatform(targetY) {
    // 只有当难度达到指定阈值才生成假砖块
    if (difficulty < difficultyConfig.phantomThreshold) {
        return;
    }
    
    // 计算当前生成概率
    const phantomProb = difficultyConfig.phantomBaseProbability + 
        difficultyConfig.phantomMaxIncrement * 
        ((difficulty - difficultyConfig.phantomThreshold) / 
        (1 - difficultyConfig.phantomThreshold));
    
    // 随机决定是否生成假砖块
    if (Math.random() > phantomProb) {
        return;
    }
    
    // 确定本次生成数量
    const generateCount = Math.floor(Math.random() * 
        (difficultyConfig.phantomMaxPerGeneration - difficultyConfig.phantomMinPerGeneration + 1)) + 
        difficultyConfig.phantomMinPerGeneration;
    
    // 生成多个假砖块
    for (let i = 0; i < generateCount; i++) {
        // 确定生成位置 - 在指定的高度附近生成
        const minY = targetY - 40; // 高度范围上限
        const maxY = targetY + 40; // 高度范围下限
        
        const randomY = minY + Math.random() * (maxY - minY);
        const randomX = Math.random() * (logicalWidth - phantomPlatformWidth);
        
        // 避免在真实平台附近生成假砖块
        let tooClose = false;
        platforms.forEach(platform => {
            const distX = Math.abs((randomX + phantomPlatformWidth/2) - (platform.x + platform.width/2));
            const distY = Math.abs(randomY - platform.y);
            
            if (distX < platformWidth * 1.5 && distY < platformHeight * 6) {
                tooClose = true;
            }
        });
        
        // 避免与已存在的假砖块重叠
        phantomPlatforms.forEach(phantom => {
            const distX = Math.abs((randomX + phantomPlatformWidth/2) - (phantom.x + phantom.width/2));
            const distY = Math.abs(randomY - phantom.y);
            
            if (distX < phantomPlatformWidth && distY < phantomPlatformHeight * 3) {
                tooClose = true;
            }
        });
        
        if (!tooClose) {
            // 创建假砖块对象
            phantomPlatforms.push({
                x: randomX,
                y: randomY,
                width: phantomPlatformWidth,
                height: phantomPlatformHeight,
                isBroken: false,
                fadeTimer: 0,
                opacity: 1.0
            });
        }
    }
}