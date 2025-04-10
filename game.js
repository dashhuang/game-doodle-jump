const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ===== 新增游戏结束界面状态变量 =====
let gameOverPlayerName = ''; // 存储玩家输入的名字
let lastSubmittedName = ''; // 存储上次提交的名字
let submissionStatusMessage = ''; // 存储提交状态信息
let isSubmitting = false; // 是否正在提交分数
let gameOverButtons = {}; // 存储游戏结束界面按钮的位置信息 { submit: rect, restart: rect, menu: rect }
let isNameInputActive = false; // 新增：跟踪名字输入框是否被激活
const MAX_NAME_LENGTH = 15;
let isNewRecord = false; // 新增：是否创造新纪录
let canSubmitScore = false; // 新增：是否可以提交分数
let localHighScores = { // 新增：本地最高分数据
    endless: 0,
    challenge: 0
};

// ===== 新增：排行榜数据存储 =====
let leaderboardData = {
    challenge: { 
        status: 'idle', 
        rankings: [], // 存储前20名排行榜数据
        error: null 
    },
    endless: { 
        status: 'idle', 
        rankings: [], // 存储前20名排行榜数据
        error: null 
    }
};

// ===== 游戏模式 =====
const GAME_MODE = {
    ENDLESS: 'ENDLESS',
    DAILY_CHALLENGE: 'DAILY_CHALLENGE'
};
let currentGameMode = GAME_MODE.ENDLESS; // 默认是无尽模式

// ===== PRNG (Pseudo-Random Number Generator) for Daily Challenge =====
let prngSeed = 0;
const prng_a = 1664525;
const prng_c = 1013904223;
const prng_m = Math.pow(2, 32);

// LCG PRNG function
function lcg() {
    // const seedBefore = prngSeed; // Log removed
    prngSeed = (prng_a * prngSeed + prng_c) % prng_m;
    const result = prngSeed / prng_m; // 返回 0 到 1 之间的数
    // console.log(`[LCG] Seed: ${seedBefore} -> ${prngSeed}, Result: ${result.toFixed(8)}`); // Log removed
    return result;
}

// Function to get current date string (YYYY-MM-DD)
function getCurrentDateString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Function to generate a seed from a string (simple hash)
function stringToSeed(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    // Make sure seed is non-negative for LCG
    return Math.abs(hash); 
}

// Select the random function based on game mode
let randomFunc = Math.random;

function initializePrng(seed) {
    // console.log("Initializing PRNG with seed:", seed); // 移除
    prngSeed = seed;
    randomFunc = lcg;
}

function useDefaultRandom() {
    // console.log("Using default Math.random()"); // 移除
    randomFunc = Math.random;
}

// ===== 难度配置（统一管理所有难度相关参数） =====
const difficultyConfig = {
    // 基础难度计算
    maxScore: 6000,                   // 难度系数达到1.0的分数线
    challengeFinishScore: 10000,       // 新增：挑战模式触发终点平台的分数线
    
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
    
    breakableBaseProbability: 0.1,   // 易碎平台基础概率
    breakableMaxIncrement: 0.3,      // 易碎平台最大概率增量
    
    movingBreakableBaseProbability: 0.05, // 移动易碎平台基础概率
    movingBreakableMaxIncrement: 0.3,     // 移动易碎平台最大概率增量
    
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
    movingPlatformSpeedIncrement: 2.5 // 移动平台速度难度增量
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
let gameState = 'menu'; // 新增游戏状态：'menu', 'playing', 'gameover', 'challengeComplete'
let difficulty = 0; // 难度值，随时间/高度增加
let previousDifficulty = 0; // 用于跟踪难度变化

// --- 每日挑战终点平台相关 ---
let isFinishPlatformGenerated = false;
let finishPlatform = null;

// --- 挑战完成礼花效果 ---
let confettiParticles = [];
const confettiColors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722', '#795548', '#9e9e9e', '#607d8b'];

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
    '#FF6347', // 番茄红
    '#4682B4', // 钢蓝色
    '#32CD32', // 酸橙绿
    '#FFD700', // 金色
    '#BA55D3', // 中兰花紫
    '#FFA07A'  // 亮鲑鱼色
];
// 当前选择的玩家颜色
let currentPlayerColor = playerColors[0]; // 默认为第一个颜色，将在init中随机选择

// 玩家对象 (Use logical dimensions)
const player = {
    baseWidth: 40,      // 恢复基础宽度
    baseHeight: 40,     // 恢复基础高度
    width: 40,          // 恢复宽度
    height: 40,         // 恢复高度
    x: logicalWidth / 2 - 20, // 根据 baseWidth 居中
    y: logicalHeight - 100,  // 恢复 Y 坐标
    vx: 0,
    vy: 0,
    jumpPower: -16,      // 恢复跳跃力
    gravity: 0.55,       // 恢复重力
    moveSpeed: 3,        // 基础移动速度 (这个值看起来是后来加的，先保留)
    acceleration: 0.3,   // 恢复加速度
    maxSpeed: 7,         // 恢复最大速度
    friction: 0.9,       // 恢复摩擦力 (这个值好像也被改过，先用0.9)
    isJumping: false,
    onGround: false,
    scaleX: 1,           // 水平缩放（用于动画）
    scaleY: 1,           // 垂直缩放（用于动画）
    squashTimer: 0,      // 挤压动画计时器
    squashDuration: 20,  // 恢复挤压动画持续时间
    squashAmount: 0.2,   // 恢复挤压量
    inputTime: 0,        // 按键/触摸持续时间
    movementState: 'idle' // 'idle', 'left', 'right'
    // 移除 color 属性，依赖 currentPlayerColor
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
    hideScoreSubmissionOverlay(); // 重置名字和提交状态
    // ===== Game Mode Specific Setup =====
    if (currentGameMode === GAME_MODE.DAILY_CHALLENGE) {
        const dateString = getCurrentDateString();
        const seed = stringToSeed(dateString);
        initializePrng(seed);
        // console.log(`Daily Challenge Mode - Seed for ${dateString}: ${seed}`); // 保留这个关键日志?
    } else {
        useDefaultRandom();
        // console.log("Endless Mode - Using Math.random()"); // 移除
    }

    // 重置游戏状态
    score = 0;
    gameover = false;
    gameState = 'playing';
    difficulty = 0; // Reset difficulty for new game
    previousDifficulty = 0;
    platforms = [];
    clouds = [];
    springs = []; // 清空弹簧
    phantomPlatforms = []; // 清空假砖块
    isFinishPlatformGenerated = false; // <<< 重置终点平台状态
    finishPlatform = null;             // <<< 重置终点平台对象
    confettiParticles = []; // 重置礼花
    // 移除phantomGenerationTimer的重置
    
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
        createPlatform(randomFunc() * (logicalWidth - platformWidth), yPos, 'normal');
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

    // 移除：根据当前模式获取排行榜
}

// 初始化菜单场景（只创建玩家脚下的第一个平台，其他平台在游戏开始后生成）
function initMenu() {
    console.log("初始化菜单...");
    hideScoreSubmissionOverlay(); // 重置名字和提交状态
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
    isFinishPlatformGenerated = false; // <<< 重置终点平台状态
    finishPlatform = null;             // <<< 重置终点平台对象
    confettiParticles = []; // 重置礼花
    // 移除phantomGenerationTimer的重置
    useDefaultRandom(); // Menu always uses default random
    
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
    currentPlayerColor = playerColors[Math.floor(randomFunc() * playerColors.length)];
    
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
        let yPos = logicalHeight - (randomFunc() * logicalHeight * 1.5); // Spread initial clouds higher
        createCloud(randomFunc() * logicalWidth, yPos);
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
    // drawMenu(); // drawMenu will be called by gameLoop
}

// createPlatform remains the same, works in logical coordinates
function createPlatform(x, y, forcedType = null, isFinish = false) {
    let type = 'normal';
    // let typeRand = -1; // Log removed
    // let directionRand = -1; // Log removed
    // let springRand = -1; // Log removed

    // 如果是终点平台，类型固定
    if (isFinish) {
        type = 'finish';
    } else if (!forcedType) { // Only determine type randomly if not forced
        // typeRand = randomFunc(); // Log removed
        // console.log(`[createPlatform@Y=${y.toFixed(1)}] Type Rand: ${typeRand.toFixed(8)}`); // Log removed
        const rand = randomFunc(); // 使用获取到的随机数 (恢复直接调用)

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
        // console.log(`[createPlatform@Y=${y.toFixed(1)}] Determined Type: ${type}`); // Log removed
    }
    const platform = {
        x: x, // Already using logical X from argument
        y: y,
        width: platformWidth,
        height: platformHeight * (isFinish ? 1.5 : 1), // 终点平台可以稍厚一点
        type: isFinish ? 'finish' : (forcedType || type),
        isBroken: false,
        vx: 0,
        vy: 0,
        direction: 1,
        verticalDirection: 1,
        breakTimer: 0, // 添加：破碎后的消失计时器
        // 上下移动平台额外属性
        initialY: y,
        verticalRange: difficultyConfig.verticalMovingRange,
        isFinish: isFinish // 添加标志
    };
    if (platform.type === 'moving' || platform.type === 'movingBreakable') {
        platform.vx = difficultyConfig.movingPlatformBaseSpeed + difficulty * difficultyConfig.movingPlatformSpeedIncrement;
        // directionRand = randomFunc(); // Log removed
        platform.direction = randomFunc() < 0.5 ? 1 : -1; // 恢复直接调用
        // console.log(`[createPlatform@Y=${y.toFixed(1)}] Moving Direction Rand: ${directionRand.toFixed(8)}, Direction: ${platform.direction}`); // Log removed
    }
    else if (platform.type === 'verticalMoving') {
        platform.vy = difficultyConfig.verticalMovingBaseSpeed + difficulty * difficultyConfig.verticalMovingSpeedIncrement;
        
        // 设置初始位置和运动参考点
        platform.initialY = y;
        platform.verticalRange = difficultyConfig.verticalMovingRange;
        
        // 随机初始方向
        // directionRand = randomFunc(); // Log removed
        platform.verticalDirection = randomFunc() < 0.5 ? -1 : 1; // 恢复直接调用
        // console.log(`[createPlatform@Y=${y.toFixed(1)}] Vertical Direction Rand: ${directionRand.toFixed(8)}, Direction: ${platform.verticalDirection}`); // Log removed
    }
    platforms.push(platform);
    
    // 如果是终点平台，保存引用
    if (isFinish) {
        finishPlatform = platform;
        // console.log(`[createPlatform] Finish platform created at Y: ${y.toFixed(1)}`); // 移除
    }

    // 不在终点平台上生成弹簧
    if (!isFinish) {
        // 随机决定是否在平台上添加弹簧
        const springProb = difficultyConfig.springBaseProbability + 
            difficultyConfig.springMaxIncrement * difficulty;
        // springRand = randomFunc(); // Log removed
        // console.log(`[createPlatform@Y=${y.toFixed(1)}] Spring Rand: ${springRand.toFixed(8)}, Threshold: ${springProb.toFixed(3)}`); // Log removed
        if (randomFunc() < springProb) { // 恢复直接调用
            // 创建弹簧并添加到数组中
            const spring = createSpring(x, y, platformWidth);
            if (spring) {
                // console.log(`[createPlatform@Y=${y.toFixed(1)}] Spring generated.`); // Log removed
                springs.push(spring);
            }
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
    const springX = minX + randomFunc() * (maxX - minX);
    
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
    const height = cloudMinHeight + randomFunc() * (cloudMaxHeight - cloudMinHeight);
    const size = height * 0.8; // Base size on height for the drawing function
    const speed = cloudMinSpeed + randomFunc() * (cloudMaxSpeed - cloudMinSpeed);
    const direction = randomFunc() < 0.5 ? 1 : -1;
    const type = Math.floor(randomFunc() * 3); // Randomly choose cloud type (0, 1, or 2)
    const layer = randomFunc() < 0.7 ? 'back' : 'front'; // 70% chance to be in the back

    clouds.push({
        x: x,
        y: y,
        width: cloudMinWidth + randomFunc() * (cloudMaxWidth - cloudMinWidth),
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
        // 默认启动每日挑战模式
        console.log("Keydown: Starting Daily Challenge Mode");
        currentGameMode = GAME_MODE.DAILY_CHALLENGE;
        init();
        return;
    }

    // 在游戏结束状态下只有按左右方向键或空格键才重新开始
    if (gameState === 'gameover') {
        // 判断是否按下了指定的按键
        /* // <-- 注释掉原来的 if 条件
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' ||
            e.code === 'KeyA' || e.code === 'KeyD' || e.code === 'Space') {
            init(); // 默认重新开始当前模式
        }
        */ // <-- 结束注释
        // 注意：之前的键盘名字输入逻辑在另一个 keydown 监听器里，这里只处理旧的重启逻辑
        // 保留 return，防止 gameover 状态下按键影响其他逻辑（如果未来添加的话）
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

        // 检查点击的是哪个按钮
        if (menuButton && isInsideButton(touchX, touchY, menuButton)) {
            // 点击了 每日挑战 按钮 (主按钮)
            console.log("Touched Daily Challenge Button (Mobile)");
            currentGameMode = GAME_MODE.DAILY_CHALLENGE;
            init();
        } else if (secondaryButton && isInsideButton(touchX, touchY, secondaryButton)) {
            // 点击了 无尽模式 按钮 (次要按钮)
             console.log("Touched Endless Mode Button (Mobile)");
             currentGameMode = GAME_MODE.ENDLESS;
             init();
        } else if (menuPlayerHitbox && isInsideButton(touchX, touchY, menuPlayerHitbox)) {
            // 触摸了玩家角色
            triggerPlayerAnimation();
        }
        return;
    }

    if (gameState === 'gameover') {
        // 游戏结束状态，点击任意位置重新开始
        // 修改为点击按钮才响应
        const touch = e.changedTouches[0];
        const rect = canvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        
        if (gameOverRestartButton && isInsideButton(touchX, touchY, gameOverRestartButton)) {
            // 点击了重新开始按钮，重新开始当前模式
            init();
        } else if (gameOverMenuButton && isInsideButton(touchX, touchY, gameOverMenuButton)) {
             // 点击了回到主界面按钮
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
    // 如果游戏结束或挑战完成，停止更新
    if (gameState === 'gameover' || gameState === 'challengeComplete') {
        // 但在挑战完成时，我们仍需更新礼花
        if (gameState === 'challengeComplete') {
            updateConfetti(dt);
        }
        return;
    }

    const isReceivingInput = handleInput();

    if (!isReceivingInput) {
        player.vx *= friction;
        if (Math.abs(player.vx) < 0.1) {
            player.vx = 0;
        }
    }

    // Update player position using logical coordinates
    player.x += player.vx;

    // -- 移除屏幕环绕逻辑 --
    /* 
    if (player.x + player.width < 0) { 
        player.x = logicalWidth; 
    } else if (player.x > logicalWidth) { 
        player.x = -player.width; 
    }
    */
    // -- 屏幕环绕逻辑已移除 --

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
            // 先检测与真实平台的碰撞 (包括终点平台)
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
                    
                    // --- 通关判定：如果落在终点平台 --- 
                    if (platform.isFinish && currentGameMode === GAME_MODE.DAILY_CHALLENGE) {
                        gameState = 'challengeComplete';
                        console.log("Challenge Complete! Landed on Finish Platform. Final Score:", Math.floor(score / 100));
                        createConfetti(); // <<< 在这里触发礼花生成
                        player.vy = 0; 
                        player.onGround = true;
                        
                        // --- 新增：添加分数检查和提交资格判断逻辑 --- 
                        const finalScore = Math.floor(score / 100);
                        const gameModeId = 'challenge'; // 明确是挑战模式
                        isNewRecord = finalScore > localHighScores[gameModeId];
                        
                        // 如果是新纪录，保存到本地
                        if (isNewRecord) {
                            localHighScores[gameModeId] = finalScore;
                            try {
                                localStorage.setItem('jumpGameHighScores', JSON.stringify(localHighScores));
                                console.log(`[Challenge Complete] 保存新纪录: ${gameModeId} 模式 - ${finalScore}分`);
                            } catch (e) {
                                console.error("[Challenge Complete] 保存最高分到localStorage时出错:", e);
                            }
                        }
                        
                        // 检查分数是否可能进入前20名 - 使用缓存数据
                        checkLeaderboardEligibilityFromCache(finalScore, gameModeId);
                        // --- 逻辑添加结束 ---
                        
                        showScoreSubmissionOverlay(); // 重置名字和提交状态
                        return; // 通关后不再检测其他碰撞
                    }
                    
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
            if (!player.onGround && gameState !== 'challengeComplete') {
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

        // --- 不再在这里检查通关 --- 
        // if (currentGameMode === GAME_MODE.DAILY_CHALLENGE && score >= difficultyConfig.maxScore) { ... }
    }

    // --- Cloud Management ---
    // Remove clouds whose top edge is below the logical bottom edge
    clouds = clouds.filter(c => c.y < logicalHeight);

    // Generate new clouds to fill up to the top of the logical area
    let highestCloudY = clouds.length > 0 ? Math.min(...clouds.map(c => c.y)) : logicalHeight;
    // Target the top edge for generation, similar to platforms
    const generationTargetY = -cloudMaxHeight; 
    // console.log(`[Update] Checking cloud generation. Highest Y: ${highestCloudY.toFixed(1)}, Target Y: ${generationTargetY}`); // <<< 移除此日志
    while (highestCloudY > generationTargetY) { // Keep generating until the top is filled
        const spacingRand = randomFunc();
        let spacing = cloudMinYSpacing + spacingRand * (cloudMaxYSpacing - cloudMinYSpacing);
        let newY = highestCloudY - spacing;
        const xRand = randomFunc();
        const newX = xRand * logicalWidth;
        // console.log(`[Update] Generating Cloud...`); // Removed
        createCloud(newX, newY);
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
    // --- 仅在终点平台未生成时才生成新平台 (所有模式) ---
    if (!isFinishPlatformGenerated) {
        let highestPlatformY = platforms.length > 0 ? Math.min(...platforms.map(p => p.y)) : logicalHeight;
        const currentMinSpacing = difficultyConfig.basePlatformMinYSpacing +
                                (difficultyConfig.maxPlatformMinYSpacing - difficultyConfig.basePlatformMinYSpacing) * difficulty;
        const currentMaxSpacing = difficultyConfig.basePlatformMaxYSpacing +
                                (difficultyConfig.maxPlatformMaxYSpacing - difficultyConfig.basePlatformMaxYSpacing) * difficulty;
        const platformGenerationTargetY = -platformHeight; // Target the top edge for generation
        // console.log(`[Update] Checking platform generation...`); // Removed
        while (highestPlatformY > platformGenerationTargetY) {
            const spacingRand = randomFunc();
            let spacing = currentMinSpacing + spacingRand * (currentMaxSpacing - currentMinSpacing);
            let newY = highestPlatformY - spacing;
            const xRand = randomFunc();
            const newX = xRand * (logicalWidth - platformWidth);
            // console.log(`[Update] Generating Platform...`); // Removed
            createPlatform(newX, newY);
            highestPlatformY = newY;

            // 在生成新平台时，有机会生成假砖块
            createPhantomPlatform(newY);
        }
    }

    // --- 生成终点平台 (仅限每日挑战) ---
    if (currentGameMode === GAME_MODE.DAILY_CHALLENGE && !isFinishPlatformGenerated && score >= difficultyConfig.challengeFinishScore) {
        // 找到当前最高平台的 Y 坐标
        let highestY = platforms.length > 0 ? Math.min(...platforms.map(p => p.y)) : logicalHeight;
        // 在最高平台上方一个合适的距离生成终点平台
        const finishPlatformY = highestY - (difficultyConfig.basePlatformMinYSpacing + difficultyConfig.basePlatformMaxYSpacing) / 2 - 20;
        // 将终点平台放在屏幕中央
        const finishPlatformX = logicalWidth / 2 - platformWidth / 2;
        createPlatform(finishPlatformX, finishPlatformY, null, true); // isFinish = true
        isFinishPlatformGenerated = true;
        // console.log("Finish platform generation triggered."); // 移除
    }

    // Game Over Condition (Based on Logical Height)
    // 只有在未通关的情况下才判断游戏结束
    if (gameState !== 'challengeComplete' && player.y > logicalHeight) { // Game over as soon as player's top edge is below bottom
        console.log(`[Update] Checking Game Over: gameState=${gameState}, player.y=${player.y.toFixed(1)}, logicalHeight=${logicalHeight}`);
        if (gameState === 'playing') { // 确保只在 playing 状态下触发一次
            console.log("[Update] Game Over condition met! Setting gameState to 'gameover'.");
            gameover = true; // 保留 gameover 标志
            gameState = 'gameover';
            
            // 检查是否创造新纪录
            const finalScore = Math.floor(score / 100);
            const gameModeId = currentGameMode === GAME_MODE.DAILY_CHALLENGE ? 'challenge' : 'endless';
            isNewRecord = finalScore > localHighScores[gameModeId];
            
            // 如果是新纪录，保存到本地
            if (isNewRecord) {
                localHighScores[gameModeId] = finalScore;
                try {
                    localStorage.setItem('jumpGameHighScores', JSON.stringify(localHighScores));
                    console.log(`[Game Over] 保存新纪录: ${gameModeId} 模式 - ${finalScore}分`);
                } catch (e) {
                    console.error("[Game Over] 保存最高分到localStorage时出错:", e);
                }
            }
            
            // 检查分数是否可能进入前20名 - 使用缓存数据
            checkLeaderboardEligibilityFromCache(finalScore, gameModeId);
            
            showScoreSubmissionOverlay(); // 重置名字和提交状态
            // No need to stop gameLoopRunning here, gameLoop handles state
        }
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

    // --- 挑战模式：检查是否生成终点平台 --- // <<< 保留这个正确的逻辑块
    if (currentGameMode === GAME_MODE.DAILY_CHALLENGE && !isFinishPlatformGenerated) {
        // 使用 challengeFinishScore 判断，而不是 difficulty >= 1
        if (score >= difficultyConfig.challengeFinishScore) {
            console.log(`[Update] Score (${score}) reached challenge finish score (${difficultyConfig.challengeFinishScore}). Generating finish platform.`);
            // 在当前玩家视野的上方安全位置生成终点平台
            const finishY = player.y - logicalHeight * 0.8; // 在玩家上方较远位置
            const finishX = logicalWidth / 2 - platformWidth / 2; // 居中
            createPlatform(finishX, finishY, null, true); // 第四个参数 isFinish = true
            isFinishPlatformGenerated = true;
            console.log(`[Update] Finish platform generated at Y: ${finishY.toFixed(1)}`);
        }
    }

    // --- 移除旧的、冗余的终点平台生成逻辑 --- 
    /*
    // --- 生成终点平台 (仅限每日挑战) ---
    if (currentGameMode === GAME_MODE.DAILY_CHALLENGE && !isFinishPlatformGenerated && score >= difficultyConfig.maxScore) {
        // 找到当前最高平台的 Y 坐标
        let highestY = platforms.length > 0 ? Math.min(...platforms.map(p => p.y)) : logicalHeight;
        // 在最高平台上方一个合适的距离生成终点平台
        const finishPlatformY = highestY - (difficultyConfig.basePlatformMinYSpacing + difficultyConfig.basePlatformMaxYSpacing) / 2 - 20;
        // 将终点平台放在屏幕中央
        const finishPlatformX = logicalWidth / 2 - platformWidth / 2;
        createPlatform(finishPlatformX, finishPlatformY, null, true); // isFinish = true
        isFinishPlatformGenerated = true;
        // console.log("Finish platform generation triggered."); // 移除
    }
    */
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
                    // <<< 使用 Math.random 用于视觉效果 >>>
                    const distance = scatterRadius * (0.5 + 0.5 * Math.random());
                    const x = centerX + Math.cos(angle) * distance;
                    const y = centerY + Math.sin(angle) * distance;
                    // <<< 使用 Math.random 用于视觉效果 >>>
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
                // <<< 使用 Math.random 用于视觉效果 >>>
                if (Math.random() < 0.05) {
                    // <<< 使用 Math.random 用于视觉效果 >>>
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
            } else if (platform.type === 'finish') {
                // --- 终点平台特殊颜色 ---
                grassColor = '#FFD700'; // 金色
                soilColor = '#DAA520'; // 金麒麟色
            } else {
                // 普通平台
                grassColor = '#90EE90'; // 淡绿色草地
                soilColor = '#CD853F'; // 秘鲁色土壤
            }
            
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
            if (!platform.isBroken && platform.type !== 'finish') { // 终点平台不加普通阴影
                // ... (普通平台的阴影和高光)
            }
            
            // --- 终点平台特殊效果 ---
            if (platform.type === 'finish') {
                // 绘制旗帜或星星等标记
                ctx.fillStyle = 'white';
                const flagPoleX = platformX + platformW * 0.8;
                const flagPoleY = platformY - platformH * 0.8; // 旗杆底部在平台上方
                const flagPoleWidth = 4;
                const flagPoleHeight = platformH * 0.8;
                
                // 旗杆
                ctx.fillRect(flagPoleX, flagPoleY, flagPoleWidth, flagPoleHeight);
                
                // 旗帜 (三角旗)
                ctx.fillStyle = '#FF6347'; // 番茄红旗帜
                ctx.beginPath();
                ctx.moveTo(flagPoleX + flagPoleWidth, flagPoleY); // 右上角
                ctx.lineTo(flagPoleX + flagPoleWidth, flagPoleY + flagPoleHeight * 0.5); // 右下角
                ctx.lineTo(flagPoleX + flagPoleWidth - platformW * 0.2, flagPoleY + flagPoleHeight * 0.25); // 左侧顶点
                ctx.closePath();
                ctx.fill();
                
                // --- 移除闪烁效果 ---
                // ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + Math.sin(Date.now() / 200) * 0.4})`; // 白色闪烁
                // ctx.beginPath();
                // ctx.arc(platformX + platformW / 2, platformY + platformH * 0.2, platformW * 0.1, 0, Math.PI * 2);
                // ctx.fill();
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
                    newColorIndex = Math.floor(randomFunc() * playerColors.length);
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
    
    // 恢复上下文
    ctx.restore();
    
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
    
    // ---- 按钮布局 (每日挑战为主，无尽模式为辅) ----
    const mainButtonWidth = 200;
    const mainButtonHeight = 60;
    const secondaryButtonWidth = 160; // 无尽模式按钮稍小
    const secondaryButtonHeight = 45;
    const buttonSpacing = 15;
    
    const mainButtonY = Math.round(canvasHeight / 2) - 10; // 主要按钮在中间偏上
    const secondaryButtonY = mainButtonY + mainButtonHeight + buttonSpacing; // 次要按钮在下方
    
    const mainButtonX = Math.round(canvasWidth / 2 - mainButtonWidth / 2);
    const secondaryButtonX = Math.round(canvasWidth / 2 - secondaryButtonWidth / 2);

    // --- 绘制 每日挑战 按钮 (主按钮) ---
    menuButton = { // 使用 menuButton 存储主按钮信息
        x: mainButtonX,
        y: mainButtonY,
        width: mainButtonWidth,
        height: mainButtonHeight
    };

    // 主按钮样式 (主要动作 - 恢复橙黄色)
    const mainButtonColor = '#FF9800'; // 橙色
    const mainButtonShadowColor = '#E68A00'; // 深橙色
    const buttonCornerRadius = 10;
    const innerShadowHeight = 4; // 内阴影高度

    // 绘制按钮主体 (需要先定义路径用于裁剪和填充)
    ctx.beginPath();
    ctx.roundRect(menuButton.x, menuButton.y, menuButton.width, menuButton.height, buttonCornerRadius);
    
    // 绘制底部内阴影 (在主体填充之前)
    ctx.save();
    ctx.clip(); // 限制绘制在圆角矩形内
    ctx.fillStyle = mainButtonShadowColor;
    ctx.fillRect(menuButton.x, menuButton.y + menuButton.height - innerShadowHeight, menuButton.width, innerShadowHeight);
    ctx.restore(); // 恢复绘图状态，移除裁剪
    
    // 填充按钮主色
    ctx.fillStyle = mainButtonColor;
    ctx.fill(); // 这里会填充之前定义的 roundRect 路径

    // 主按钮文字 ("每日挑战")
    ctx.fillStyle = 'white'; // 白色文字
    ctx.font = 'bold 24px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif'; // 加粗
    ctx.textAlign = 'center'; 
    ctx.textBaseline = 'middle'; // 确保垂直居中
    const mainTextX = Math.round(mainButtonX + mainButtonWidth / 2);
    const mainTextY = Math.round(mainButtonY + mainButtonHeight / 2);
    // 绘制文字阴影以增加对比度
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillText('每日挑战', mainTextX, mainTextY);
    ctx.shadowColor = 'transparent'; // 清除文字阴影

    // --- 绘制 无尽模式 按钮 (次要按钮) ---
    secondaryButton = { // 使用 secondaryButton 存储次要按钮信息
        x: secondaryButtonX,
        y: secondaryButtonY,
        width: secondaryButtonWidth,
        height: secondaryButtonHeight
    };

    // 次要按钮样式 (次要动作 - 较深的柔和蓝绿色)
    const secondaryButtonColor = '#48C9B0'; // 使用较深的蓝绿色
    const secondaryButtonShadowColor = '#369F8C'; // 更深的阴影色
    const secondaryCornerRadius = 8;
    const secondaryInnerShadowHeight = 3;
    
    // 绘制按钮主体
    ctx.beginPath();
    ctx.roundRect(secondaryButton.x, secondaryButton.y, secondaryButton.width, secondaryButton.height, secondaryCornerRadius);
    
    // 绘制底部内阴影
    ctx.save();
    ctx.clip();
    ctx.fillStyle = secondaryButtonShadowColor;
    ctx.fillRect(secondaryButton.x, secondaryButton.y + secondaryButton.height - secondaryInnerShadowHeight, secondaryButton.width, secondaryInnerShadowHeight);
    ctx.restore();
    
    // 填充按钮主色
    ctx.fillStyle = secondaryButtonColor;
    ctx.fill();

    // 次要按钮文字 ("无尽模式")
    ctx.fillStyle = 'white'; // 白色文字
    ctx.font = 'bold 18px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif'; // 加粗，字体稍小
    ctx.textAlign = 'center'; 
    ctx.textBaseline = 'middle';
    const secondaryTextX = Math.round(secondaryButtonX + secondaryButtonWidth / 2);
    const secondaryTextY = Math.round(secondaryButtonY + secondaryButtonHeight / 2);
    // 添加文字阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillText('无尽模式', secondaryTextX, secondaryTextY);
    ctx.shadowColor = 'transparent'; // 清除文字阴影

    // 恢复上下文 (这个 restore 是恢复标题绘制之前的状态)
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
    // 绘制半透明覆盖层
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; 
    ctx.fillRect(0, 0, canvasWidth, canvasHeight); // 使用物理画布宽高
    
    // 保存状态
    ctx.save();
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 获取当前游戏模式ID
    const gameMode = currentGameMode === GAME_MODE.DAILY_CHALLENGE ? 'challenge' : 'endless';
    const currentLeaderboardData = leaderboardData[gameMode];

    // 游戏结束文字
    ctx.font = 'bold 48px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillText('游戏结束!', Math.round(canvasWidth / 2), Math.round(canvasHeight / 2 - 160));
    
    // 显示得分
    ctx.font = 'bold 36px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
    const displayScore = Math.floor(score / 100);
    ctx.fillText(`得分: ${displayScore}`, Math.round(canvasWidth / 2), Math.round(canvasHeight / 2 - 110));
    
    // 显示历史最高分
    const highScore = localHighScores[gameMode];
    ctx.font = '24px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(`历史最高分: ${highScore}`, Math.round(canvasWidth / 2), Math.round(canvasHeight / 2 - 70));
    
    // 如果创造新纪录，显示祝贺文字
    if (isNewRecord) {
        ctx.font = 'bold 28px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillStyle = '#FFD700'; // 金色
        ctx.fillText('新纪录！', Math.round(canvasWidth / 2), Math.round(canvasHeight / 2 - 30));
        ctx.fillStyle = 'white'; // 恢复白色
    }

    // 根据条件决定是否显示输入框和提交按钮
    if (isNewRecord && canSubmitScore) {
        // --- 绘制名字输入部分 ---
        ctx.font = 'bold 20px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText('输入你的名字:', Math.round(canvasWidth / 2), Math.round(canvasHeight / 2 + 10));
        
        const inputWidth = 200;
        const inputHeight = 30;
        const inputX = Math.round(canvasWidth / 2 - inputWidth / 2);
        const inputY = Math.round(canvasHeight / 2 + 30);
        const inputCornerRadius = 5;
        
        // 绘制输入框背景（根据激活状态有不同样式）
        if (isNameInputActive) {
            // 激活状态：亮白色背景，蓝色边框
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.strokeStyle = 'rgba(0, 120, 215, 0.8)';
            ctx.lineWidth = 2;
        } else {
            // 非激活状态：较淡的背景，灰色边框
            ctx.fillStyle = 'rgba(240, 240, 240, 0.8)';
            ctx.strokeStyle = 'rgba(150, 150, 150, 0.5)';
            ctx.lineWidth = 1;
        }
        
        // 绘制输入框
        ctx.beginPath();
        ctx.roundRect(inputX, inputY, inputWidth, inputHeight, inputCornerRadius);
        ctx.fill();
        ctx.stroke();
        
        // 绘制输入的名字
        ctx.fillStyle = 'black';
        ctx.font = '20px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        
        // 添加光标效果 (闪烁的竖线)，仅在未提交成功且输入框激活时显示
        let displayName = gameOverPlayerName;
        const hasSubmittedSuccessfullyVisual = submissionStatusMessage === '分数提交成功!'; // 用于视觉判断
        if (!hasSubmittedSuccessfullyVisual && isNameInputActive && Math.floor(Date.now() / 500) % 2 === 0) { 
            displayName += '|';
        }
        ctx.fillText(displayName, inputX + 10, Math.round(inputY + inputHeight / 2));
        
        // 添加点击提示（仅在非激活状态且未提交时显示）
        if (!isNameInputActive && !hasSubmittedSuccessfullyVisual && !gameOverPlayerName) {
            ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
            ctx.font = 'italic 16px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.fillText('点击此处输入...', inputX + 10, Math.round(inputY + inputHeight / 2));
        }
        
        // --- 绘制按钮 --- 
        ctx.textAlign = 'center';
        const buttonWidth = 120;
        const buttonHeight = 40;
        const buttonY = inputY + inputHeight + 30;
        const buttonSpacing = 10;
        const totalButtonWidth = (buttonWidth * 3) + (buttonSpacing * 2);
        const startButtonX = Math.round(canvasWidth / 2 - totalButtonWidth / 2);
        const buttonCornerRadius = 8;
        const innerShadowHeight = 3;

        // 按钮通用绘制函数 (复用样式)
        function drawButton(text, x, y, color, shadowColor, enabled = true) { // 添加 enabled 参数
            const currentAlpha = ctx.globalAlpha; // 保存当前透明度
            if (!enabled) {
                ctx.globalAlpha = 0.6; // 禁用时降低透明度
            }
            ctx.beginPath();
            ctx.roundRect(x, y, buttonWidth, buttonHeight, buttonCornerRadius);
            // 内阴影
            ctx.save();
            ctx.clip();
            ctx.fillStyle = shadowColor;
            ctx.fillRect(x, y + buttonHeight - innerShadowHeight, buttonWidth, innerShadowHeight);
            ctx.restore();
            // 主色
            ctx.fillStyle = color;
            ctx.fill();
            // 文字
            ctx.fillStyle = 'white';
            ctx.font = 'bold 18px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
            ctx.shadowBlur = 2;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.fillText(text, Math.round(x + buttonWidth / 2), Math.round(y + buttonHeight / 2));
            ctx.shadowColor = 'transparent'; // 清除文字阴影
            
            ctx.globalAlpha = currentAlpha; // 恢复透明度
            
            return { x, y, width: buttonWidth, height: buttonHeight }; // 返回按钮区域
        }

        // 计算按钮位置
        const submitButtonX = startButtonX;
        const restartButtonX = submitButtonX + buttonWidth + buttonSpacing;
        const menuButtonX = restartButtonX + buttonWidth + buttonSpacing;

        // 绘制按钮并存储位置
        const submitShouldBeEnabled = !isSubmitting; // 逻辑上的可点击状态

        gameOverButtons.submit = drawButton(
            hasSubmittedSuccessfullyVisual ? '已提交' : (isSubmitting ? '提交中...' : '提交分数'), 
            submitButtonX, 
            buttonY, 
            hasSubmittedSuccessfullyVisual ? '#AAAAAA' : (isSubmitting ? '#AAAAAA' : '#4CAF50'), // 成功或提交中用灰色
            hasSubmittedSuccessfullyVisual ? '#888888' : (isSubmitting ? '#888888' : '#388E3C'),
            submitShouldBeEnabled // 根据是否提交中来决定按钮是否可点击 (视觉上)
        );
        gameOverButtons.restart = drawButton('重新开始', restartButtonX, buttonY, '#FF9800', '#E68A00');
        gameOverButtons.menu = drawButton('回到主菜单', menuButtonX, buttonY, '#48C9B0', '#369F8C');

        // --- 绘制提交状态信息 ---
        ctx.font = '16px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillStyle = hasSubmittedSuccessfullyVisual ? '#90EE90' : 'white'; // 成功时用浅绿色
        ctx.textAlign = 'center';
        const statusY = buttonY + buttonHeight + 25;
        ctx.fillText(submissionStatusMessage, Math.round(canvasWidth / 2), statusY);
    } else {
        // 如果不能提交成绩，只显示重新开始和回到主菜单按钮
        const buttonWidth = 150;
        const buttonHeight = 40;
        const buttonY = Math.round(canvasHeight / 2 + 30);
        const buttonSpacing = 20;
        const totalButtonWidth = (buttonWidth * 2) + buttonSpacing;
        const startButtonX = Math.round(canvasWidth / 2 - totalButtonWidth / 2);
        const buttonCornerRadius = 8;
        const innerShadowHeight = 3;
        
        function drawButton(text, x, y, color, shadowColor) {
            ctx.beginPath();
            ctx.roundRect(x, y, buttonWidth, buttonHeight, buttonCornerRadius);
            // 内阴影
            ctx.save();
            ctx.clip();
            ctx.fillStyle = shadowColor;
            ctx.fillRect(x, y + buttonHeight - innerShadowHeight, buttonWidth, innerShadowHeight);
            ctx.restore();
            // 主色
            ctx.fillStyle = color;
            ctx.fill();
            // 文字
            ctx.fillStyle = 'white';
            ctx.font = 'bold 18px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
            ctx.shadowBlur = 2;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.fillText(text, Math.round(x + buttonWidth / 2), Math.round(y + buttonHeight / 2));
            ctx.shadowColor = 'transparent'; // 清除文字阴影
            
            return { x, y, width: buttonWidth, height: buttonHeight };
        }
        
        const restartButtonX = startButtonX;
        const menuButtonX = restartButtonX + buttonWidth + buttonSpacing;
        
        // 隐藏提交按钮
        gameOverButtons.submit = null;
        
        // 绘制重新开始和回到主菜单按钮
        gameOverButtons.restart = drawButton('重新开始', restartButtonX, buttonY, '#FF9800', '#E68A00');
        gameOverButtons.menu = drawButton('回到主菜单', menuButtonX, buttonY, '#48C9B0', '#369F8C');
        
        // -- 移除无法提交分数的文字提示 --
        /*
        // 如果不是新纪录也不符合排行榜条件，显示原因
        if (!isNewRecord) {
            ctx.font = '18px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.fillStyle = '#CCCCCC';
            ctx.textAlign = 'center';
            ctx.fillText('未创造新纪录，无法提交成绩', Math.round(canvasWidth / 2), buttonY + buttonHeight + 30);
        } else if (!canSubmitScore) {
            ctx.font = '18px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.fillStyle = '#CCCCCC';
            ctx.textAlign = 'center';
            ctx.fillText('分数未达到排行榜标准，无法提交', Math.round(canvasWidth / 2), buttonY + buttonHeight + 30);
        }
        */
    }

    // --- 绘制当前模式的排行榜 ---
    const leaderboardTitle = currentGameMode === GAME_MODE.DAILY_CHALLENGE ? '今日挑战排行' : '无尽模式排行';
    
    // 根据是否有提交UI调整排行榜位置
    const leaderboardY = (isNewRecord && canSubmitScore) ? 
        Math.round(canvasHeight / 2 + 180) : 
        Math.round(canvasHeight / 2 + 100);
    
    ctx.font = 'bold 18px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(leaderboardTitle, Math.round(canvasWidth / 2), leaderboardY);

    const rankingStartY = leaderboardY + 25;
    const lineHeight = 22;
    ctx.font = '16px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    
    // 计算排行榜水平位置
    const totalButtonWidth = (isNewRecord && canSubmitScore) ? 
        (120 * 3) + (10 * 2) : // 三个按钮加间距
        (150 * 2) + 20; // 两个按钮加间距
    
    const rankX = Math.round(canvasWidth / 2 - totalButtonWidth / 2); // 左对齐
    const nameX = rankX + 40;
    const scoreX = (isNewRecord && canSubmitScore) ? 
        rankX + totalButtonWidth - 120 : // 三按钮样式
        rankX + totalButtonWidth - 60; // 两按钮样式

    if (currentLeaderboardData.status === 'loading') {
        ctx.fillStyle = '#DDDDDD';
        ctx.fillText('排行榜加载中...', rankX, rankingStartY);
    } else if (currentLeaderboardData.status === 'error') {
        ctx.fillStyle = '#FF6666'; // 红色表示错误
        ctx.fillText(`加载失败: ${currentLeaderboardData.error}`, rankX, rankingStartY);
    } else if (currentLeaderboardData.status === 'loaded') {
        if (currentLeaderboardData.rankings.length === 0) {
            ctx.fillStyle = '#DDDDDD';
            ctx.fillText(`暂无${gameMode === 'challenge' ? '今日' : ''}排行`, rankX, rankingStartY);
        } else {
            // 只显示前5名数据
            const displayRankings = currentLeaderboardData.rankings.slice(0, 5);
            displayRankings.forEach((entry, index) => {
                const yPos = rankingStartY + index * lineHeight;
                ctx.fillStyle = 'white';
                // Rank
                ctx.textAlign = 'left';
                ctx.fillText(`#${entry.rank}`, rankX, yPos);
                // Name
                ctx.fillText(entry.name, nameX, yPos);
                // Score
                ctx.textAlign = 'right';
                ctx.fillText(entry.score, scoreX + 60, yPos);
            });
        }
    } else { // idle status
         ctx.fillStyle = '#DDDDDD';
         ctx.fillText('正在准备加载排行榜...', rankX, rankingStartY);
    }

    // 恢复状态
    ctx.restore(); 
}

// --- 绘制每日挑战完成界面 ---
function drawChallengeComplete() {
    // 保存当前可能存在的变换状态 (来自 draw())
    ctx.save();
    
    // 重置变换，确保我们在屏幕坐标系下绘制
    // 获取当前的设备像素比，因为 setTransform 会重置它
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 恢复默认变换并应用DPR缩放

    // --- 现在开始绘制通关界面元素 ---
    
    // 1. 绘制半透明覆盖层 (覆盖整个屏幕)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; 
    ctx.fillRect(0, 0, canvasWidth, canvasHeight); // 使用物理画布宽高

    // 2. 绘制礼花 (在覆盖层之上)
    confettiParticles.forEach(p => {
        ctx.save();
        // 礼花坐标已经是屏幕坐标，直接使用
        ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        ctx.restore();
    });

    // 3. 绘制祝贺文字 (在礼花之上)
    ctx.save(); // 保存文字绘制状态
    ctx.fillStyle = '#FFD700'; // 金色
    ctx.font = 'bold 48px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    
    // 阴影效果
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // 抗锯齿
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // 文字位置 (使用物理画布宽高计算居中)
    const textX = Math.round(canvasWidth / 2);
    const textY = Math.round(canvasHeight / 2 - 80);
    ctx.fillText('挑战完成!', textX, textY);
    
    // 显示最终得分
    ctx.font = 'bold 36px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'white'; // 白色得分
    const finalDisplayScore = Math.floor(score / 100); 
    ctx.fillText(`得分: ${finalDisplayScore}`, Math.round(canvasWidth / 2), Math.round(canvasHeight / 2 - 20));
    
    // 恢复文字的上下文，不影响按钮绘制
    ctx.restore(); 

    // 4. 绘制按钮 (在礼花和文字之上)
    ctx.save(); // 保存按钮绘制状态
    const buttonWidth = 200;
    const buttonHeight = 50;
    const buttonX = Math.round(canvasWidth / 2 - buttonWidth / 2);
    const menuButtonY = Math.round(canvasHeight / 2 + 50); 
    const buttonCornerRadius = 10;
    const innerShadowHeight = 4;
    
    // 按钮样式 (参考绿色)
    const buttonColor = '#4CAF50';
    const buttonShadowColor = '#388E3C';

    // 绘制按钮主体
    ctx.beginPath();
    ctx.roundRect(buttonX, menuButtonY, buttonWidth, buttonHeight, buttonCornerRadius);

    // 内阴影
    ctx.save();
    ctx.clip();
    ctx.fillStyle = buttonShadowColor;
    ctx.fillRect(buttonX, menuButtonY + buttonHeight - innerShadowHeight, buttonWidth, innerShadowHeight);
    ctx.restore();
    
    // 填充主色
    ctx.fillStyle = buttonColor;
    ctx.fill();
    
    // 移除边框
    // ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    // ctx.lineWidth = 2;
    // ctx.stroke();
    
    // 按钮文字
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white'; 
    ctx.font = 'bold 24px "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center'; 
    // 添加文字阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillText('回到主界面', Math.round(canvasWidth / 2), Math.round(menuButtonY + buttonHeight / 2));
    ctx.shadowColor = 'transparent';
    
    // 存储按钮位置信息
    gameOverMenuButton = { 
        x: buttonX,
        y: menuButtonY,
        width: buttonWidth,
        height: buttonHeight
    };
    
    ctx.restore(); // 恢复按钮绘制的上下文

    // 恢复调用 drawChallengeComplete 之前的绘图状态
    ctx.restore(); 
}

// --- Game Loop ---
let lastTime = 0;
let gameLoopRunning = false;
let menuButton = null; // 存储菜单主按钮位置信息 (现在是每日挑战)
let dailyChallengeButton = null; // <<< 这个变量不再直接使用，由 menuButton 代替
let secondaryButton = null;    // <<< 添加：存储次要按钮位置信息 (无尽模式)
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
        playerMenuAnimation.active = true;
        playerMenuAnimation.timer = 0;
        // 随机选择一个动画类型
        const animations = ['jump', 'spin', 'bounce', 'color'];
        const randomAnimation = animations[Math.floor(randomFunc() * animations.length)];
        playerMenuAnimation.type = randomAnimation;
    }
}

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    let continueLoop = true; // 控制是否继续下一帧
    // console.log(`[GameLoop] Current gameState: ${gameState}`); // 可选：取消注释以查看每帧的状态

    if (!gameLoopRunning && gameState !== 'menu') { // Allow menu to start loop, otherwise respect flag
        console.log("[GameLoop] gameLoopRunning is false, exiting.")
        return; 
    }

    if (gameState === 'menu') {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        drawMenu();
    } else if (gameState === 'playing') {
        update(deltaTime / 1000);
        draw();
    } else if (gameState === 'gameover' || gameState === 'challengeComplete') {
        // 结束状态：不更新游戏逻辑 (除了礼花)，但持续绘制
        if (gameState === 'challengeComplete') {
             updateConfetti(deltaTime / 1000); 
        }
        // 清屏和绘制背景/角色等
        // draw(); // draw() might contain logic we don't want in game over, let's call specifics
        // --- Redraw required background elements --- 
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        // Draw clouds, platforms etc. as needed for background
        // You might need a specific drawBackground() function or duplicate parts of draw()
        // Simplified: Just draw clouds from draw() logic
        const visibleLogicalTopY = logicalHeight - (canvasHeight / scale);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // Back clouds
        clouds.forEach(cloud => {
            if (cloud.layer === 'back' && cloud.y + cloud.size > visibleLogicalTopY && cloud.y - cloud.size < logicalHeight) {
                drawCloudShape(ctx, cloud.x, cloud.y, cloud.size, cloud.type);
            }
        });
        
        // 使用与游戏中相同的平台绘制代码，而不是简化版的矩形
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
                } else if (platform.type === 'finish') {
                    // --- 终点平台特殊颜色 ---
                    grassColor = '#FFD700'; // 金色
                    soilColor = '#DAA520'; // 金麒麟色
                } else {
                    // 普通平台
                    grassColor = '#90EE90'; // 淡绿色草地
                    soilColor = '#CD853F'; // 秘鲁色土壤
                }
                
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
                
                // 添加基本的多边形效果
                if (!platform.isBroken && platform.type !== 'finish') {
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
            }
        });
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // Front clouds
        clouds.forEach(cloud => {
            if (cloud.layer === 'front' && cloud.y + cloud.size > visibleLogicalTopY && cloud.y - cloud.size < logicalHeight) {
                drawCloudShape(ctx, cloud.x, cloud.y, cloud.size, cloud.type);
            }
        });
        ctx.restore(); // Restore from scaling/translation
        // --- End Redraw background --- 
        
        drawGameOver(); // 绘制结束界面 UI (now handles input display)
        continueLoop = true; // 保持循环以持续绘制和响应输入
    } 

    // 请求下一帧 
    if (continueLoop) { 
        requestAnimationFrame(gameLoop);
    } else {
         console.log("[GameLoop] Loop should stop based on logic or flag.");
         gameLoopRunning = false; 
    }
}

// 检查点击是否在按钮内
function isInsideButton(x, y, button) {
    return x >= button.x && x <= button.x + button.width &&
           y >= button.y && y <= button.y + button.height;
}

// --- Event Listeners ---
// Add resize listener
window.addEventListener('resize', resizeHandler);

// Add click listener for menu interaction
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    console.log(`[Click] Event received. Current gameState: ${gameState}`); 
    console.log(`[Click] Coords: (${clickX.toFixed(1)}, ${clickY.toFixed(1)})`);

    if (gameState === 'menu') {
        // --- 菜单状态下的按钮点击逻辑 ---
        console.log("[Click] Checking menu buttons:", JSON.stringify({menuButton, secondaryButton, menuPlayerHitbox}));
        if (menuButton && isInsideButton(clickX, clickY, menuButton)) {
            console.log("Clicked Daily Challenge Button");
            currentGameMode = GAME_MODE.DAILY_CHALLENGE;
            init();
        } else if (secondaryButton && isInsideButton(clickX, clickY, secondaryButton)) {
            console.log("Clicked Endless Mode Button");
            currentGameMode = GAME_MODE.ENDLESS;
            init();
        } else if (menuPlayerHitbox && isInsideButton(clickX, clickY, menuPlayerHitbox)) {
            console.log("Clicked Player Hitbox in Menu.");
            triggerPlayerAnimation();
        } else {
            console.log("[Click] Click in menu was outside known buttons/hitbox.");
        }
        // --- 菜单逻辑结束 ---

    } else if (gameState === 'gameover' || gameState === 'challengeComplete') {
        // --- 游戏结束状态下的按钮点击逻辑 ---
        console.log("[Click] Checking game over buttons:", JSON.stringify(gameOverButtons)); 
        
        // 只有在创造新纪录且可以提交分数时才检查输入框点击
        if (isNewRecord && canSubmitScore) {
            // 检查是否点击了名字输入框区域
            const inputWidth = 200;
            const inputHeight = 30;
            const inputX = Math.round(canvasWidth / 2 - inputWidth / 2);
            const inputY = Math.round(canvasHeight / 2 + 30);
            const isInsideInputBox = 
                clickX >= inputX && clickX <= inputX + inputWidth &&
                clickY >= inputY && clickY <= inputY + inputHeight;
            
            if (isInsideInputBox) {
                console.log("[Click] Clicked on name input box.");
                isNameInputActive = true; // 激活输入框
                
                // 在所有设备上创建一个临时输入框以支持键盘输入
                createTemporaryInputField();
            } else if (gameOverButtons.submit && isInsideButton(clickX, clickY, gameOverButtons.submit)) {
                if (!isSubmitting) { 
                    console.log("Clicked Submit Score button on Canvas.");
                    submitScore();
                } else {
                    console.log("Clicked Submit button, but already submitting/submitted.");
                }
            } else {
                // 点击输入框外部，取消激活
                isNameInputActive = false;
            }
        }
        
        // 无论是否可以提交分数，都检查重新开始和回到主菜单按钮点击
        if (gameOverButtons.restart && isInsideButton(clickX, clickY, gameOverButtons.restart)) {
            console.log("Clicked Restart button on Canvas.");
            init();
        } 
        else if (gameOverButtons.menu && isInsideButton(clickX, clickY, gameOverButtons.menu)) {
            console.log("Clicked Back to Menu button on Canvas.");
            initMenu();
        } else {
            console.log("[Click] Click in game over was outside known buttons or input box.");
        }
        // --- 游戏结束逻辑结束 ---
        
    } else {
        // 其他状态下的点击（例如 playing），目前忽略
        console.log(`[Click] Ignored in gameState: ${gameState}`);
    }
});

// Touchend listener for mobile
canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    if (!touch) return;
    const rect = canvas.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    console.log(`[Touchend] Event received. Current gameState: ${gameState}`); 
    console.log(`[Touchend] Coords: (${touchX.toFixed(1)}, ${touchY.toFixed(1)})`);
    
    // 移除可能存在的类似错误逻辑

    if (gameState === 'menu') {
        // --- 菜单状态下的触摸逻辑 ---
        console.log("[Touchend] Checking menu buttons:", JSON.stringify({menuButton, secondaryButton, menuPlayerHitbox}));
        if (menuButton && isInsideButton(touchX, touchY, menuButton)) {
            console.log("Touched Daily Challenge Button (Mobile)");
            currentGameMode = GAME_MODE.DAILY_CHALLENGE;
            init();
        } else if (secondaryButton && isInsideButton(touchX, touchY, secondaryButton)) {
             console.log("Touched Endless Mode Button (Mobile)");
             currentGameMode = GAME_MODE.ENDLESS;
             init();
        } else if (menuPlayerHitbox && isInsideButton(touchX, touchY, menuPlayerHitbox)) {
             console.log("Touched Player Hitbox in Menu.");
            triggerPlayerAnimation();
        }
         // Reset touch states specific to menu if needed
         joystickActive = false;
         isTouching = false;
         touchStartX = null;
         // --- 菜单逻辑结束 ---

    } else if (gameState === 'gameover' || gameState === 'challengeComplete') {
        // --- 游戏结束状态下的触摸逻辑 ---
        console.log("[Touchend] Checking game over buttons:", JSON.stringify(gameOverButtons));

        // 只有在创造新纪录且可以提交分数时才检查输入框和提交按钮
        if (isNewRecord && canSubmitScore) {
            // 检查是否点击了名字输入框区域
            const inputWidth = 200;
            const inputHeight = 30;
            const inputX = Math.round(canvasWidth / 2 - inputWidth / 2);
            const inputY = Math.round(canvasHeight / 2 + 30);
            const isInsideInputBox = 
                touchX >= inputX && touchX <= inputX + inputWidth &&
                touchY >= inputY && touchY <= inputY + inputHeight;
            
            if (isInsideInputBox) {
                console.log("[Touchend] Touched on name input box.");
                isNameInputActive = true; // 激活输入框
                
                // 在移动设备上创建一个临时的真实HTML输入框来触发虚拟键盘
                if (isMobile) {
                    createTemporaryInputField();
                }
            } else if (gameOverButtons.submit && isInsideButton(touchX, touchY, gameOverButtons.submit)) {
                if (!isSubmitting) {
                    console.log("Touched Submit Score button on Canvas.");
                    submitScore();
                } else {
                    console.log("Touched Submit button, but already submitting/submitted.");
                }
            } else {
                // 点击输入框外部，取消激活
                isNameInputActive = false;
            }
        }

        // 无论是否可以提交分数，都检查重新开始和回到主菜单按钮点击
        if (gameOverButtons.restart && isInsideButton(touchX, touchY, gameOverButtons.restart)) {
            console.log("Touched Restart button on Canvas.");
            init();
        } 
        else if (gameOverButtons.menu && isInsideButton(touchX, touchY, gameOverButtons.menu)) {
            console.log("Touched Back to Menu button on Canvas.");
            initMenu();
        } else {
             console.log("[Touchend] Touch was outside known buttons.");
        }
        // --- 游戏结束逻辑结束 ---

    } else if (gameState === 'playing') { 
         // Playing state touch end logic (joystick/tap reset)
         if (joystickActive) {
            joystickActive = false;
         } else {
            isTouching = false;
            touchStartX = null;
         }
    } else {
         // Other states
         console.log(`[Touchend] Ignored in gameState: ${gameState}`);
    }

    // Consider if joystick/isTouching reset should happen globally at the end regardless of state?
    // If so, uncomment below:
    // if (joystickActive) joystickActive = false;
    // if (isTouching) { isTouching = false; touchStartX = null; }

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
    const shouldGenerateRand = randomFunc(); // 消耗1个随机数
    // console.log(`[createPhantom@targetY=${targetY.toFixed(1)}] Prob Rand: ${shouldGenerateRand.toFixed(8)}, Threshold: ${phantomProb.toFixed(3)}`); // Log removed
    if (shouldGenerateRand > phantomProb) { 
        // console.log(`[createPhantom@targetY=${targetY.toFixed(1)}] Skipped generation (prob check)`); // Log removed
        return;
    }
    
    // 确定本次生成数量
    const countRand = randomFunc(); // 消耗1个随机数
    const generateCount = Math.floor(countRand * 
        (difficultyConfig.phantomMaxPerGeneration - difficultyConfig.phantomMinPerGeneration + 1)) + 
        difficultyConfig.phantomMinPerGeneration;
    // console.log(`[createPhantom@targetY=${targetY.toFixed(1)}] Count Rand: ${countRand.toFixed(8)}, Count: ${generateCount}`); // Log removed

    // 生成多个假砖块
    for (let i = 0; i < generateCount; i++) { // 严格循环 generateCount 次
        // 确定生成位置 - 在指定的高度附近生成
        const minY = targetY - 40; // 高度范围上限
        const maxY = targetY + 40; // 高度范围下限
        
        // --- 关键修改：总是消耗随机数 --- 
        const randomYRand = randomFunc(); // 消耗1个随机数 (Y坐标)
        const randomY = minY + randomYRand * (maxY - minY);
        const randomXRand = randomFunc(); // 消耗1个随机数 (X坐标)
        const randomX = randomXRand * (logicalWidth - phantomPlatformWidth); 
        // console.log(`[createPhantom@targetY=${targetY.toFixed(1)}] Attempt #${i+1}: Y Rand: ${randomYRand.toFixed(8)}, Y: ${randomY.toFixed(1)}, X Rand: ${randomXRand.toFixed(8)}, X: ${randomX.toFixed(1)}`); // Log removed

        // 避免在真实平台附近生成假砖块
        let tooClose = false;
        platforms.forEach(platform => {
            const distX = Math.abs((randomX + phantomPlatformWidth/2) - (platform.x + platform.width/2));
            const distY = Math.abs(randomY - platform.y);
            
            if (distX < platformWidth * 1.5 && distY < platformHeight * 6) {
                tooClose = true;
            }
        });
        
        // 如果离真实平台太近，则跳过本次添加，但随机数已消耗
        if (tooClose) {
            // console.log(`[createPhantom@targetY=${targetY.toFixed(1)}] Attempt #${i+1}: Skipped (too close to real platform)`); // Log removed
            continue; 
        }
        
        // 避免与已存在的假砖块重叠
        phantomPlatforms.forEach(phantom => {
            const distX = Math.abs((randomX + phantomPlatformWidth/2) - (phantom.x + phantom.width/2));
            const distY = Math.abs(randomY - phantom.y);
            
            if (distX < phantomPlatformWidth && distY < phantomPlatformHeight * 3) {
                tooClose = true;
            }
        });

        // 如果离其他假砖块太近，则跳过本次添加，但随机数已消耗
        if (tooClose) {
            // console.log(`[createPhantom@targetY=${targetY.toFixed(1)}] Attempt #${i+1}: Skipped (too close to other phantom)`); // Log removed
            continue;
        }
        
        // 只有在检查通过后才创建并添加假砖块对象
        // console.log(`[createPhantom@targetY=${targetY.toFixed(1)}] Attempt #${i+1}: Added Phantom Platform`); // Log removed
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

// --- 创建礼花粒子 ---
function createConfetti() {
    confettiParticles = []; // 清空旧粒子
    const numberOfParticles = 150; // 粒子数量
    for (let i = 0; i < numberOfParticles; i++) {
        confettiParticles.push({
            x: Math.random() * canvasWidth, // 随机X起始位置
            y: -Math.random() * canvasHeight * 0.5, // 从屏幕顶部偏上开始
            width: 5 + Math.random() * 10,
            height: 10 + Math.random() * 15,
            color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
            vx: (Math.random() - 0.5) * 4, // 水平速度（左右飘动）
            vy: 1 + Math.random() * 3,     // 垂直下落速度
            rotation: Math.random() * 360, // 初始旋转角度
            rotationSpeed: (Math.random() - 0.5) * 10 // 旋转速度
        });
    }
}

// --- 更新礼花粒子 ---
function updateConfetti(dt) {
    confettiParticles.forEach((p, index) => {
        p.y += p.vy;
        p.x += p.vx;
        p.rotation += p.rotationSpeed;
        
        // 简单模拟空气阻力或飘动
        p.vy += 0.05; // 轻微加速下落
        p.vx *= 0.99; // 水平速度减慢

        // 如果粒子掉出屏幕下方，则移除 (或者循环利用)
        if (p.y > canvasHeight + p.height) {
            // 暂时直接移除
            confettiParticles.splice(index, 1);
        }
    });
}

// --- 配置排行榜客户端 --- (移入 DOMContentLoaded)
// // !! 必须替换为你自己的真实信息 !!
// LEADERBOARD_CONFIG.baseUrl = 'https://game-service.huang.co';
// LEADERBOARD_CONFIG.gameId = 'jump'; // 替换为你的游戏 ID
// LEADERBOARD_CONFIG.apiKey = 'bZAaDP83ocTleVIxxSIPR6JT44oKFaeL';    // !! 替换为你的 API Key (注意安全风险) !!

// ===== DOMContentLoaded Listener =====
window.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed");

    // 尝试从localStorage读取上次提交的名字和最高分
    try {
        const savedName = localStorage.getItem('jumpGamePlayerName');
        if (savedName) {
            lastSubmittedName = savedName;
            console.log(`已从localStorage加载上次提交的名字: ${lastSubmittedName}`);
        }

        // 加载本地最高分
        const savedHighScores = localStorage.getItem('jumpGameHighScores');
        if (savedHighScores) {
            localHighScores = JSON.parse(savedHighScores);
            console.log(`已从localStorage加载最高分数据:`, localHighScores);
        }
    } catch (e) {
        console.error("读取localStorage数据时出错:", e);
    }

    // --- 配置排行榜客户端 --- 
    console.log("Configuring leaderboard client...");
    // 检查 leaderboard-client.js 是否已定义 LEADERBOARD_CONFIG
    if (typeof LEADERBOARD_CONFIG === 'undefined') {
        console.error("LEADERBOARD_CONFIG is not defined. Make sure leaderboard-client.js is loaded and initialized correctly.");
        // 在提交按钮状态中显示错误
        if(submissionStatusElement) submissionStatusElement.textContent = "排行榜客户端加载失败！";
        // 禁用提交按钮
        if(submitScoreButton) submitScoreButton.disabled = true;
    } else {
        try {
            LEADERBOARD_CONFIG.baseUrl = 'https://game-service.huang.co';
            LEADERBOARD_CONFIG.gameId = 'jump'; // 替换为你的游戏 ID
            LEADERBOARD_CONFIG.apiKey = 'bZAaDP83ocTleVIxxSIPR6JT44oKFaeL'; // !! 替换为你的 API Key (注意安全风险) !!
            console.log("Leaderboard client configured:", LEADERBOARD_CONFIG);
        } catch (configError) {
            console.error("Error configuring LEADERBOARD_CONFIG:", configError);
            if(submissionStatusElement) submissionStatusElement.textContent = `配置排行榜时出错: ${configError.message}`;
            if(submitScoreButton) submitScoreButton.disabled = true;
        }
    }
    // --- 配置结束 ---

    // 检查元素是否成功获取
    // ... (element check remains the same)

    // 添加按钮事件监听器
    // ... (event listeners remain the same)

    // 初始化时检测移动设备并进行相应调整 (移到这里确保 DOM Ready)
    adjustForMobile();

    // --- Start with Menu ---
    initMenu();
    console.log("Menu initialized. Waiting for player to start game..."); 

    // 配置成功后，立即尝试获取排行榜数据（同时获取两种模式的）
    if (typeof LEADERBOARD_CONFIG !== 'undefined' && LEADERBOARD_CONFIG.apiKey) {
        fetchLeaderboard('challenge'); // 获取每日挑战排行榜
        fetchLeaderboard('endless');  // 获取无尽模式排行榜
    } else {
        // 如果配置失败，标记排行榜状态为错误
        leaderboardData.challenge = { status: 'error', rankings: [], error: '排行榜客户端配置失败' };
        leaderboardData.endless = { status: 'error', rankings: [], error: '排行榜客户端配置失败' };
    }
});

async function submitScore() {
    console.log("[submitScore] Called.");
    
    // 确保元素已获取
    if (!retrieveOverlayElements()) {
        console.error("[submitScore] Cannot submit, elements could not be retrieved.");
        if (submissionStatusElement) {
            submissionStatusElement.textContent = '错误：无法访问界面元素！';
        } else {
            alert('错误：无法访问界面元素！'); 
        }
        return;
    }
    console.log("[submitScore] Overlay elements should be ready."); // <-- 新日志

    const playerName = playerNameInput.value.trim();
    console.log(`[submitScore] Player name entered: '${playerName}'`); // <-- 新日志
    if (!playerName) {
        submissionStatusElement.textContent = '请输入你的名字!';
        console.log("[submitScore] Player name is empty."); // <-- 新日志
        return;
    }
    if (playerName.length > 15) {
        submissionStatusElement.textContent = '名字不能超过15个字符!';
        console.log("[submitScore] Player name too long."); // <-- 新日志
        return;
    }

    const finalScore = Math.floor(score / 100);
    const gameModeId = currentGameMode === GAME_MODE.DAILY_CHALLENGE ? 'challenge' : 'endless';
    console.log(`[submitScore] Calculated score: ${finalScore}, mode: ${gameModeId}`); // <-- 新日志
    
    console.log("[submitScore] Disabling inputs and setting status to '正在提交...'"); // <-- 新日志
    submitScoreButton.disabled = true;
    playerNameInput.disabled = true;
    submissionStatusElement.textContent = '正在提交...';
    console.log(`[submitScore] Status text set to: ${submissionStatusElement.textContent}`); // <-- 新日志

    try {
        console.log(`[submitScore] Inside try block. Preparing to call submitLeaderboardScore...`); // <-- 新日志
        console.log(`--> Submitting: Name=${playerName}, Score=${finalScore}, Mode=${gameModeId}`);
        
        if (typeof LEADERBOARD_CONFIG === 'undefined' || !LEADERBOARD_CONFIG.apiKey) {
            console.error("[submitScore] LEADERBOARD_CONFIG check failed."); // <-- 新日志
            throw new Error("Leaderboard client not configured.");
        }
        if (typeof submitLeaderboardScore !== 'function') {
            console.error("[submitScore] submitLeaderboardScore function check failed."); // <-- 新日志
            throw new Error("submitLeaderboardScore function is not available.");
        }
        
        console.log("[submitScore] Calling await submitLeaderboardScore..."); // <-- 新日志
        const result = await submitLeaderboardScore(playerName, finalScore, gameModeId);
        console.log("[submitScore] await submitLeaderboardScore finished. Result:", result); // <-- 新日志

        console.log('--> 分数提交成功！记录 ID:', result.recordId);
        submissionStatusElement.textContent = '分数提交成功!';
        submitScoreButton.textContent = '已提交'; 
        console.log("[submitScore] Success UI updated."); // <-- 新日志

    } catch (error) {
        console.error('[submitScore] Caught error:', error); // <-- 修改日志前缀
        submissionStatusElement.textContent = `提交失败: ${error.message || '未知错误'}`;
        submitScoreButton.disabled = false;
        playerNameInput.disabled = false;
        console.log("[submitScore] Failure UI updated."); // <-- 新日志
    } 
}

// ===== 游戏结束逻辑修改 =====

// 新增：显示分数提交界面的函数
function showScoreSubmissionOverlay() {
    console.log("[showScoreSubmissionOverlay] Called (Now resets state).");
    // 使用上次提交的名字作为默认值
    gameOverPlayerName = lastSubmittedName || '';
    submissionStatusMessage = '';
    isSubmitting = false; // 重置提交状态
    isNameInputActive = false; // 重置输入框激活状态
}

// 新增：隐藏分数提交界面的函数
function hideScoreSubmissionOverlay() {
    console.log("[hideScoreSubmissionOverlay] Called.");
    // 尝试获取元素（如果还没获取的话），但不强制报错，因为可能只是菜单初始化时调用
    retrieveOverlayElements(); 
    
    if (scoreSubmissionOverlay) { // 检查元素是否存在再操作
        console.log(`[hideScoreSubmissionOverlay] scoreSubmissionOverlay display before: ${scoreSubmissionOverlay.style.display}`);
        scoreSubmissionOverlay.style.display = 'none';
        console.log(`[hideScoreSubmissionOverlay] scoreSubmissionOverlay display after: ${scoreSubmissionOverlay.style.display}`);
    } else {
        console.warn("[hideScoreSubmissionOverlay] scoreSubmissionOverlay element not found or not retrieved yet.");
    }
}

// --- 新增：获取并初始化 Overlay 元素的函数 ---
function retrieveOverlayElements() {
    if (overlayElementsRetrieved) return true; // 已经获取过

    console.log("[retrieveOverlayElements] Attempting to get elements...");
    scoreSubmissionOverlay = document.getElementById('score-submission-overlay');
    finalScoreElement = document.getElementById('final-score');
    playerNameInput = document.getElementById('playerName');
    submitScoreButton = document.getElementById('submitScoreButton');
    restartGameButton = document.getElementById('restartGameButton');
    backToMenuButton = document.getElementById('backToMenuButton');
    submissionStatusElement = document.getElementById('submission-status');

    // 检查关键元素是否都找到了
    if (scoreSubmissionOverlay && finalScoreElement && playerNameInput && submitScoreButton && restartGameButton && backToMenuButton && submissionStatusElement) {
        console.log("[retrieveOverlayElements] Elements successfully retrieved.");
        overlayElementsRetrieved = true;
        
        // 在这里添加事件监听器，因为现在保证元素存在
        console.log("[retrieveOverlayElements] Adding event listeners to overlay buttons.");
        
        // 修改：为 submitScoreButton 的监听器添加直接日志
        submitScoreButton.addEventListener('click', () => {
            console.log("[Submit Button Listener] Click detected!"); 
            console.log(`[Submit Button Listener] Checking submitScore: type is ${typeof submitScore}`); // <-- 检查类型
            try {
                console.log("[Submit Button Listener] Logging target message directly..."); // 新增日志
                console.log("[submitScore] Called."); // <-- 直接在这里打印目标日志
                console.log("[Submit Button Listener] Direct log successful. Now calling submitScore..."); // 新增日志
                submitScore(); // 调用原始的 submitScore 函数
            } catch (error) {
                console.error("[Submit Button Listener] Error during direct log or calling submitScore:", error); // 修改错误日志
                 // 尝试更新状态显示错误
                 if (submissionStatusElement) {
                     submissionStatusElement.textContent = `调用提交函数时出错: ${error.message}`;
                 } else {
                    alert(`调用提交函数时出错: ${error.message}`);
                 }
            }
        });
        
        restartGameButton.addEventListener('click', () => {
            console.log("[Restart Button Listener] Click detected!"); // <-- 添加日志
            hideScoreSubmissionOverlay();
            init(); // 重新开始游戏
        });
        backToMenuButton.addEventListener('click', () => {
            console.log("[Back To Menu Button Listener] Click detected!"); // <-- 添加日志
            hideScoreSubmissionOverlay();
            initMenu(); // 回到主菜单
        });
        return true;
    } else {
        console.error("[retrieveOverlayElements] Failed to get one or more required HTML elements for the overlay.");
        // Log which elements were not found (optional debugging)
        if (!scoreSubmissionOverlay) console.error("scoreSubmissionOverlay not found");
        if (!finalScoreElement) console.error("finalScoreElement not found");
        if (!playerNameInput) console.error("playerNameInput not found");
        // ... etc for other elements
        overlayElementsRetrieved = false; // 标记为未成功
        return false;
    }
}

// --- 添加键盘事件监听器 ---
window.addEventListener('keydown', (e) => {
    // 只在游戏结束界面且未提交成功时处理输入
    if ((gameState !== 'gameover' && gameState !== 'challengeComplete') || 
        submissionStatusMessage === '分数提交成功!' ||
        !isNameInputActive) { // 新增：检查输入框是否激活
        return;
    }

    const key = e.key;

    // 处理退格键
    if (key === 'Backspace') {
        e.preventDefault(); // 防止浏览器后退
        if (gameOverPlayerName.length > 0) {
           gameOverPlayerName = gameOverPlayerName.slice(0, -1);
        }
    } 
    // 处理回车键 (触发提交)
    else if (key === 'Enter') {
         e.preventDefault(); 
         if (!isSubmitting) { // 防止重复触发
             console.log("[Keydown] Enter pressed, attempting submitScore.");
             submitScore();
         }
    }
    // 处理可打印字符
    else if (key.length === 1 && gameOverPlayerName.length < MAX_NAME_LENGTH && !e.ctrlKey && !e.metaKey) {
        // 可以添加更严格的字符过滤，例如只允许字母数字
        gameOverPlayerName += key;
    }
});

// 修改：showScoreSubmissionOverlay 函数，使用上次提交的名字作为默认值，但不激活输入框
function showScoreSubmissionOverlay() {
    console.log("[showScoreSubmissionOverlay] Called (Now resets state).");
    // 使用上次提交的名字作为默认值
    gameOverPlayerName = lastSubmittedName || '';
    submissionStatusMessage = '';
    isSubmitting = false; // 重置提交状态
    isNameInputActive = false; // 重置输入框激活状态
}

// 修改：hideScoreSubmissionOverlay 现在只重置状态
function hideScoreSubmissionOverlay() {
    console.log("[hideScoreSubmissionOverlay] Called (Now resets state).");
     gameOverPlayerName = '';
     submissionStatusMessage = '';
     isSubmitting = false;
}

// 修改：提交分数的函数，成功后保存用户名
async function submitScore() {
    console.log("[submitScore] Called.");
    if (isSubmitting) { // 防止重复提交
        console.log("[submitScore] Already submitting, ignored.");
        return;
    }

    // 从全局变量获取名字
    const playerName = gameOverPlayerName.trim(); 
    console.log(`[submitScore] Player name from global: '${playerName}'`);
    if (!playerName) {
        submissionStatusMessage = '请输入你的名字!'; 
        console.log("[submitScore] Player name is empty.");
        return;
    }
    if (playerName.length > 15) {
        submissionStatusMessage = '名字不能超过15个字符!';
        console.log("[submitScore] Player name too long.");
        return;
    }

    const finalScore = Math.floor(score / 100);
    const gameModeId = currentGameMode === GAME_MODE.DAILY_CHALLENGE ? 'challenge' : 'endless';
    console.log(`[submitScore] Calculated score: ${finalScore}, mode: ${gameModeId}`);
    
    // 更新状态变量
    console.log("[submitScore] Setting status to '正在提交...'");
    isSubmitting = true; // 设置提交中标志
    submissionStatusMessage = '正在提交...';

    try {
        console.log(`[submitScore] Inside try block. Preparing to call submitLeaderboardScore...`); 
        console.log(`--> Submitting: Name=${playerName}, Score=${finalScore}, Mode=${gameModeId}`);
        if (typeof LEADERBOARD_CONFIG === 'undefined' || !LEADERBOARD_CONFIG.apiKey) {
            throw new Error("Leaderboard client not configured.");
        }
        if (typeof submitLeaderboardScore !== 'function') {
            throw new Error("submitLeaderboardScore function is not available.");
        }
        console.log("[submitScore] Calling await submitLeaderboardScore..."); 
        const result = await submitLeaderboardScore(playerName, finalScore, gameModeId);
        console.log("[submitScore] await submitLeaderboardScore finished. Result:", result); 

        console.log('--> 分数提交成功！记录 ID:', result.recordId);
        submissionStatusMessage = '分数提交成功!';
        
        // 保存成功提交的名字
        lastSubmittedName = playerName;
        try {
            localStorage.setItem('jumpGamePlayerName', playerName);
            console.log(`[submitScore] 已保存玩家名字到localStorage: ${playerName}`);
        } catch (e) {
            console.error("[submitScore] 保存名字到localStorage时出错:", e);
        }
        
        // 提交成功后，刷新当前模式的排行榜
        setTimeout(() => {
            console.log(`[submitScore] 提交成功，刷新${gameModeId}模式排行榜...`);
            fetchLeaderboard(gameModeId);
        }, 500); // 延迟500毫秒再刷新，确保服务器数据已更新
        
        console.log("[submitScore] Success status updated.");
        // 成功后保持 isSubmitting = true; 防止再次提交或修改名字

    } catch (error) {
        console.error('[submitScore] Caught error:', error);
        submissionStatusMessage = `提交失败: ${error.message || '未知错误'}`;
        isSubmitting = false; // 允许重试
        console.log("[submitScore] Failure status updated.");
    } 
}

// --- 新增：获取每日排行榜数据的函数 ---
async function fetchDailyLeaderboard() {
    if (dailyLeaderboardData.status === 'loading') return; // 防止重复加载

    console.log("[fetchDailyLeaderboard] Attempting to fetch...");
    dailyLeaderboardData = { status: 'loading', rankings: [], error: null };

    const options = {
        limit: 5, // 获取前 5 名
        offset: 0,
        period: 'daily' // 获取每日排行
    };

    try {
        // 确保 leaderboard 客户端已配置且函数可用
        if (typeof LEADERBOARD_CONFIG === 'undefined' || !LEADERBOARD_CONFIG.apiKey) {
            throw new Error("Leaderboard client not configured.");
        }
        if (typeof getLeaderboardRankings !== 'function') {
            throw new Error("getLeaderboardRankings function is not available.");
        }

        console.log(`[fetchDailyLeaderboard] Calling getLeaderboardRankings for mode 'challenge' with options:`, options);
        const leaderboardData = await getLeaderboardRankings('challenge', options);
        console.log("[fetchDailyLeaderboard] Data received:", leaderboardData);
        
        dailyLeaderboardData = {
            status: 'loaded',
            rankings: leaderboardData.rankings || [],
            error: null
        };
        console.log("[fetchDailyLeaderboard] Leaderboard data stored successfully.");

    } catch (error) {
        console.error("[fetchDailyLeaderboard] Failed to fetch leaderboard:", error);
        dailyLeaderboardData = {
            status: 'error',
            rankings: [],
            error: error.message || '加载排行榜失败'
        };
    }
    // 注意：获取数据后，如果当前正显示结束界面，需要手动触发重绘才能看到更新
    // 这个逻辑可以加在 gameLoop 或者在 fetch 成功后检查 gameState
    if (gameState === 'gameover' || gameState === 'challengeComplete') {
        // requestAnimationFrame(gameLoop); // Or simply let the existing loop handle it if it's still running somehow?
        // Since the loop continues in gameover/challengeComplete, it should redraw automatically.
    }
}

// --- 新增：获取排行榜数据的函数 (支持不同模式) ---
async function fetchLeaderboard(mode = null) {
    // 如果未指定模式，使用当前游戏模式
    const gameModeId = mode || (currentGameMode === GAME_MODE.DAILY_CHALLENGE ? 'challenge' : 'endless');
    
    if (leaderboardData[gameModeId].status === 'loading') return; // 防止重复加载

    console.log(`[fetchLeaderboard] 正在获取 ${gameModeId} 模式排行榜...`);
    leaderboardData[gameModeId] = { 
        status: 'loading', 
        rankings: [], 
        error: null 
    };

    // 获取前20名数据，用于显示和判断资格
    const options = {
        limit: 20, // 获取前20名
        offset: 0,
        period: gameModeId === 'challenge' ? 'daily' : 'all' // 挑战模式用daily，无尽模式用all
    };

    try {
        // 确保 leaderboard 客户端已配置且函数可用
        if (typeof LEADERBOARD_CONFIG === 'undefined' || !LEADERBOARD_CONFIG.apiKey) {
            throw new Error("排行榜客户端未配置");
        }
        if (typeof getLeaderboardRankings !== 'function') {
            throw new Error("getLeaderboardRankings函数不可用");
        }

        // 获取前20名数据
        console.log(`[fetchLeaderboard] 调用getLeaderboardRankings获取${gameModeId}模式前20名排行榜`);
        const rankingsData = await getLeaderboardRankings(gameModeId, options);
        
        console.log(`[fetchLeaderboard] ${gameModeId}排行榜数据接收成功，共${rankingsData.rankings ? rankingsData.rankings.length : 0}条记录`);
        
        leaderboardData[gameModeId] = {
            status: 'loaded',
            rankings: rankingsData.rankings || [],
            error: null
        };
        console.log(`[fetchLeaderboard] ${gameModeId}排行榜数据存储成功`);

    } catch (error) {
        console.error(`[fetchLeaderboard] 获取${gameModeId}排行榜失败:`, error);
        leaderboardData[gameModeId] = {
            status: 'error',
            rankings: [],
            error: error.message || '加载排行榜失败'
        };
    }
}

// 新增：检查分数是否可能进入排行榜前20名
async function checkLeaderboardEligibility(score, gameModeId) {
    console.log(`[checkLeaderboardEligibility] 检查分数 ${score} 是否能进入${gameModeId}排行榜前20名`);
    canSubmitScore = false; // 默认不能提交
    
    try {
        // 确保排行榜客户端已配置
        if (typeof LEADERBOARD_CONFIG === 'undefined' || !LEADERBOARD_CONFIG.apiKey) {
            throw new Error("排行榜客户端未配置");
        }
        if (typeof getLeaderboardRankings !== 'function') {
            throw new Error("getLeaderboardRankings函数不可用");
        }
        
        // 获取排行榜前20名数据
        const options = {
            limit: 20,
            offset: 0,
            period: gameModeId === 'challenge' ? 'daily' : 'all'
        };
        
        console.log(`[checkLeaderboardEligibility] 获取${gameModeId}排行榜前20名数据...`);
        const rankingsData = await getLeaderboardRankings(gameModeId, options);
        
        if (!rankingsData || !rankingsData.rankings) {
            throw new Error("获取排行榜数据失败");
        }
        
        // 检查是否有资格进入排行榜
        const rankings = rankingsData.rankings;
        if (rankings.length < 20) {
            // 排行榜不满20条，可以提交
            console.log(`[checkLeaderboardEligibility] 排行榜数据不足20条(${rankings.length}条)，可以提交`);
            canSubmitScore = true;
        } else {
            // 检查分数是否高于排行榜第20名
            const lowestScore = rankings[rankings.length - 1].score;
            canSubmitScore = score > lowestScore;
            console.log(`[checkLeaderboardEligibility] 当前分数: ${score}, 排行榜第20名: ${lowestScore}, 可以提交: ${canSubmitScore}`);
        }
    } catch (error) {
        console.error(`[checkLeaderboardEligibility] 检查排行榜资格时出错:`, error);
        // 如果出错，默认允许提交(避免因网络问题等阻止用户提交)
        canSubmitScore = true;
        console.log(`[checkLeaderboardEligibility] 发生错误，默认允许提交`);
    }
}

// 新增：使用缓存的排行榜数据检查分数是否可能进入前20名
function checkLeaderboardEligibilityFromCache(score, gameModeId) {
    console.log(`[checkLeaderboardEligibilityFromCache] 检查分数 ${score} 是否能进入${gameModeId}排行榜前20名`);
    canSubmitScore = false; // 默认不能提交
    
    // 检查缓存数据状态
    if (leaderboardData[gameModeId].status !== 'loaded' || !leaderboardData[gameModeId].rankings || leaderboardData[gameModeId].rankings.length === 0) {
        console.log(`[checkLeaderboardEligibilityFromCache] 没有有效的缓存排行榜数据，默认允许提交`);
        canSubmitScore = true;
        return;
    }
    
    // 使用缓存的排行榜数据判断
    const rankings = leaderboardData[gameModeId].rankings;
    
    if (rankings.length < 20) {
        // 排行榜不满20条，可以提交
        console.log(`[checkLeaderboardEligibilityFromCache] 排行榜数据不足20条(${rankings.length}条)，可以提交`);
        canSubmitScore = true;
    } else {
        // 检查分数是否高于排行榜第20名
        const lowestScore = rankings[rankings.length - 1].score;
        canSubmitScore = score > lowestScore;
        console.log(`[checkLeaderboardEligibilityFromCache] 当前分数: ${score}, 排行榜第20名: ${lowestScore}, 可以提交: ${canSubmitScore}`);
    }
}

// --- 新增：创建临时HTML输入框以触发移动设备虚拟键盘 ---
function createTemporaryInputForMobile() {
    console.log("[createTemporaryInputForMobile] Creating temporary input for mobile keyboard");
    
    // 检查是否已经存在临时输入框，如果有，先移除
    const existingInput = document.getElementById('temp-mobile-input');
    if (existingInput) {
        document.body.removeChild(existingInput);
    }

    // 创建一个临时输入框
    const tempInput = document.createElement('input');
    tempInput.id = 'temp-mobile-input';
    tempInput.type = 'text';
    tempInput.value = gameOverPlayerName; // 使用当前名字作为初始值
    tempInput.maxLength = MAX_NAME_LENGTH;
    
    // 设置样式：将输入框放在屏幕中的可见位置，但不遮挡游戏界面
    tempInput.style.position = 'fixed';
    tempInput.style.bottom = '0';
    tempInput.style.left = '0';
    tempInput.style.width = '100%';
    tempInput.style.padding = '10px';
    tempInput.style.boxSizing = 'border-box';
    tempInput.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    tempInput.style.border = '1px solid #ccc';
    tempInput.style.borderRadius = '5px';
    tempInput.style.fontSize = '16px'; // 确保iOS上不会缩放
    tempInput.style.zIndex = '1000'; // 确保在最上层
    
    // 监听输入变化，更新gameOverPlayerName
    tempInput.addEventListener('input', function() {
        gameOverPlayerName = this.value.substring(0, MAX_NAME_LENGTH);
    });
    
    // 处理提交
    tempInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.blur(); // 隐藏键盘
            
            // 点击提交按钮（如果可用）
            if (!isSubmitting) {
                submitScore();
            }
        }
    });
    
    // 失焦时移除输入框
    tempInput.addEventListener('blur', function() {
        // 延迟移除，避免在某些情况下立即失去焦点
        setTimeout(() => {
            if (document.body.contains(this)) {
                document.body.removeChild(this);
            }
        }, 300);
    });
    
    // 添加到文档
    document.body.appendChild(tempInput);
    
    // 获取焦点以触发虚拟键盘
    setTimeout(() => {
        tempInput.focus();
    }, 100);
}

// --- 新增：创建临时HTML输入框以触发键盘输入 ---
function createTemporaryInputField() {
    console.log("[createTemporaryInputField] Creating temporary input field for keyboard input");
    
    // 检查是否已经存在临时输入框，如果有，先移除
    const existingInput = document.getElementById('temp-mobile-input');
    if (existingInput) {
        document.body.removeChild(existingInput);
    }

    // 创建一个临时输入框
    const tempInput = document.createElement('input');
    tempInput.id = 'temp-mobile-input';
    tempInput.type = 'text';
    tempInput.value = gameOverPlayerName; // 使用当前名字作为初始值
    tempInput.maxLength = MAX_NAME_LENGTH;
    
    // 设置样式：将输入框放在屏幕中的可见位置，但不遮挡游戏界面
    tempInput.style.position = 'fixed';
    tempInput.style.bottom = '0';
    tempInput.style.left = '0';
    tempInput.style.width = '100%';
    tempInput.style.padding = '10px';
    tempInput.style.boxSizing = 'border-box';
    tempInput.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    tempInput.style.border = '1px solid #ccc';
    tempInput.style.borderRadius = '5px';
    tempInput.style.fontSize = '16px'; // 确保iOS上不会缩放
    tempInput.style.zIndex = '1000'; // 确保在最上层
    
    // 监听输入变化，更新gameOverPlayerName
    tempInput.addEventListener('input', function() {
        gameOverPlayerName = this.value.substring(0, MAX_NAME_LENGTH);
    });
    
    // 处理提交
    tempInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.blur(); // 隐藏键盘
            
            // 点击提交按钮（如果可用）
            if (!isSubmitting) {
                submitScore();
            }
        }
    });
    
    // 失焦时移除输入框
    tempInput.addEventListener('blur', function() {
        // 延迟移除，避免在某些情况下立即失去焦点
        setTimeout(() => {
            if (document.body.contains(this)) {
                document.body.removeChild(this);
            }
        }, 300);
    });
    
    // 添加到文档
    document.body.appendChild(tempInput);
    
    // 获取焦点以触发虚拟键盘
    setTimeout(() => {
        tempInput.focus();
    }, 100);
}

// --- 添加键盘事件监听器 ---