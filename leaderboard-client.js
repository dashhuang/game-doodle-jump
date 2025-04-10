// --- 排行榜客户端配置 ---
// 在你的游戏代码中，使用前必须设置这些值！
const LEADERBOARD_CONFIG = {
    baseUrl: '', // 例如: 'https://your-service.vercel.app' 或 'http://localhost:3000'
    gameId: '',  // 你的游戏 ID
    apiKey: ''   // 你的 API Key (警告：暴露在前端有安全风险！)
};

/**
 * 内部函数，用于发送请求到排行榜 API
 * @param {string} method 'GET' 或 'POST'
 * @param {string} path API 路径 (例如 '/submit' 或 '/scores?mode=...')
 * @param {object|null} [bodyData=null] POST 请求体数据
 * @returns {Promise<object>} API 返回的 JSON 数据
 * @throws {Error} 如果请求失败或 API 返回错误
 */
async function _leaderboardRequest(method, path, bodyData = null) {
    if (!LEADERBOARD_CONFIG.baseUrl || !LEADERBOARD_CONFIG.gameId || !LEADERBOARD_CONFIG.apiKey) {
        throw new Error('Leaderboard client error: baseUrl, gameId, and apiKey must be configured.');
    }

    const fullUrl = `${LEADERBOARD_CONFIG.baseUrl}/api/v1/${LEADERBOARD_CONFIG.gameId}${path}`;
    const headers = {
        'X-Api-Key': LEADERBOARD_CONFIG.apiKey,
        'Accept': 'application/json',
    };
    const options = {
        method: method,
        headers: headers,
        // 对于跨域请求，浏览器会自动处理 CORS，但服务器必须正确配置
        // mode: 'cors', // 通常不需要显式设置，除非有特殊需求
    };

    if (method === 'POST' && bodyData) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(bodyData);
    }

    try {
        const response = await fetch(fullUrl, options);

        // 尝试解析 JSON，无论状态码如何，因为错误信息可能在 body 中
        let data;
        try {
            data = await response.json();
        } catch (e) {
            // 如果响应体不是有效的 JSON
             throw new Error(`API Error: HTTP ${response.status} ${response.statusText}. Failed to parse JSON response.`);
        }

        // 检查 HTTP 状态码 和 API 返回的 success 标志
        if (!response.ok || !data.success) {
            // 如果 API 返回了错误信息，优先使用它
            const errorMessage = data?.error || `API Error: HTTP ${response.status} ${response.statusText}`;
            throw new Error(errorMessage);
        }

        return data; // 返回 API 成功的完整响应体
    } catch (error) {
        console.error('Leaderboard API request failed:', error);
        // 重新抛出错误，以便调用者可以捕获并处理
        throw error;
    }
}

/**
 * 提交玩家分数
 * @param {string} name 玩家名称
 * @param {number} score 分数
 * @param {string} mode 模式 ID
 * @param {object} [metadata] 可选元数据
 * @returns {Promise<object>} 包含 success 和 recordId 的对象
 * @throws {Error} 如果提交失败
 */
async function submitLeaderboardScore(name, score, mode, metadata = null) {
    const body = { name, score, mode };
    if (metadata) {
        body.metadata = metadata;
    }
    // _leaderboardRequest 会在失败时抛出错误
    return _leaderboardRequest('POST', '/submit', body);
}

/**
 * 获取排行榜排名
 * @param {string} mode 模式 ID
 * @param {object} [options] 可选查询参数
 * @param {number} [options.limit=20] 结果数量
 * @param {number} [options.offset=0] 结果偏移量
 * @param {string} [options.period='alltime'] 时间段 ('daily', 'weekly', 'alltime')
 * @returns {Promise<object>} 包含 rankings 和 meta 的数据对象
 * @throws {Error} 如果查询失败
 */
async function getLeaderboardRankings(mode, options = {}) {
    const params = new URLSearchParams({ mode });
    if (options.limit !== undefined) params.append('limit', options.limit);
    if (options.offset !== undefined) params.append('offset', options.offset);
    if (options.period) params.append('period', options.period);

    const path = `/scores?${params.toString()}`;
    const result = await _leaderboardRequest('GET', path);
    // API 设计为成功时返回 { success: true, data: { rankings: [...], meta: {...} } }
    // 直接返回 data 部分给调用者
    return result.data;
}

/**
 * 获取游戏配置（例如模式列表）
 * @returns {Promise<object>} 游戏配置对象
 * @throws {Error} 如果获取失败
 */
async function getLeaderboardGameConfig() {
    const path = '/config'; // 假设配置接口路径是 /config
    const result = await _leaderboardRequest('GET', path);
    // API 设计为成功时返回 { success: true, data: { ...config... } }
    // 直接返回 data 部分给调用者
    return result.data;
} 