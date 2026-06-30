// ==UserScript==
// @name         LD Peek
// @namespace    https://linux.do/
// @version      0.4.74
// @description  LinuxDO快速预览工具：悬浮入口、抽屉模式，支持话题摘要和详情页预览。
// @author       kaibush
// @license      MIT
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjI4IiBmaWxsPSIjMWYyOTM3Ii8+PHBhdGggZD0iTTI0IDc4YzEyLTIwIDI4LTMwIDQ4LTMwczM2IDEwIDQ4IDMwYy0xMiAyMC0yOCAzMC00OCAzMFMzNiA5OCAyNCA3OFoiIGZpbGw9IiM1NmI4YWEiLz48Y2lyY2xlIGN4PSI3MiIgY3k9Ijc4IiByPSIxNiIgZmlsbD0iI2ZmZiIvPjxjaXJjbGUgY3g9IjcyIiBjeT0iNzgiIHI9IjgiIGZpbGw9IiMxZjI5MzciLz48cGF0aCBkPSJNMjQgMjhoMTR2NDZoMjZ2MTJIMjRWMjhabTUwIDBoMThjMjUgMCAzOSAxMSAzOSAyOXMtMTQgMjktMzkgMjlINzRWMjhabTE0IDEydjM0aDVjMTUgMCAyMy02IDIzLTE3cy04LTE3LTIzLTE3aC01WiIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==
// @match        https://linux.do/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @run-at       document-start
// @noframes
// @downloadURL https://update.greasyfork.org/scripts/584017/LD%20Peek.user.js
// @updateURL https://update.greasyfork.org/scripts/584017/LD%20Peek.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // 部分浏览器里 Tampermonkey 仍可能把脚本注入同源 iframe。
    // 抽屉详情模式本身会创建 iframe，所以除了 @noframes 还保留运行时防护。
    try {
        if (window.self !== window.top) return;
    } catch (_) {
        return;
    }

    const APP_NAME = 'LD Peek';
    const LOG_PREFIX = `[${APP_NAME}]`;
    const NAME = 'ldpeek';

    // 存储 key 保留旧前缀，避免已安装用户丢失设置和阅读记忆。
    const PREF_KEY = 'linuxdo_eye_preview_settings';
    const LEGACY_PREF_KEY = 'linuxdo_eye_preview_mode';
    const MEMORY_KEY = 'linuxdo_eye_preview_seen_topics';
    const FAVORITES_KEY = 'linuxdo_eye_preview_favorites';
    const READ_LATER_KEY = 'linuxdo_eye_preview_read_later_queue';
    const PAGE_NAV_KEY = 'linuxdo_eye_preview_page_nav';
    const DRAWER_STATE_KEY = 'linuxdo_eye_preview_drawer_state';
    const SITE_CATEGORIES_KEY = 'linuxdo_eye_preview_site_categories';
    const MAX_MEMORY = 500;
    const MAX_FAVORITES = 100;
    const MAX_READ_LATER = 100;
    const MAX_TOPIC_CACHE = 10;
    const MAX_RECENT_VIEW = 20;
    const MAX_PAGE_NAV = 20;
    const MAX_FRAME_HISTORY = 50;
    const FLOATING_BUTTON_SIZE = 40;
    const FLOATING_LONG_PRESS = 340;
    const FLOATING_PIE_RADIUS = 100;
    const FLOATING_EDGE_DISTANCE = 12;
    const FLOATING_EDGE_PEEK = 15;
    const BADGE_REFRESH_DELAY = 500;
    // iframe 主动加载后，Discourse 可能延迟规范化 URL；这段时间只替换当前历史项。
    const FRAME_HISTORY_REPLACE_WINDOW = 1200;
    const FRAME_USER_NAV_WINDOW = 8000;
    const DRAWER_TRACK_VIEW_DELAY_MIN = 2000;
    const DRAWER_TRACK_VIEW_DELAY_MAX = 3500;
    const AUTO_SCROLL_SPEED_LEVELS = Object.freeze({
        fast: {
            label: '稍快',
            help: '适合快速浏览长文内容',
            min: 54,
            max: 86,
            initial: 64,
            speedChangeMin: 1200,
            speedChangeMax: 3600,
            pauseChance: 0.1
        },
        normal: {
            label: '正常',
            help: '默认阅读速度',
            min: 32,
            max: 54,
            initial: 42,
            speedChangeMin: 1400,
            speedChangeMax: 4400,
            pauseChance: 0.12
        },
        slow: {
            label: '慢速',
            help: '适合需要细读的内容',
            min: 16,
            max: 32,
            initial: 24,
            speedChangeMin: 1800,
            speedChangeMax: 5600,
            pauseChance: 0.14
        }
    });
    const AUTO_SCROLL_DEFAULT_SPEED_LEVEL = 'normal';
    const AUTO_SCROLL_DEFAULT_SPEED = AUTO_SCROLL_SPEED_LEVELS[AUTO_SCROLL_DEFAULT_SPEED_LEVEL].initial;
    const AUTO_SCROLL_PAUSE_MIN = 500;
    const AUTO_SCROLL_PAUSE_MAX = 3000;
    const PREVIEW_PREFETCH_DELAY = 180;
    const PREVIEW_PREFETCH_TTL = 60 * 1000;
    const SITE_CATEGORIES_TTL = 30 * 24 * 60 * 60 * 1000;
    const FRAME_LOAD_WAIT = 12;
    const READ_LATER_KEEP_HINT = '打开不会自动移出；请点 × 手动移除，避免误删阅读列表。';
    const SUPPORT_LINKS = Object.freeze([
        {
            id: 'ldc-1',
            title: '❤️ 精神股东',
            amount: '1 LDC',
            desc: '1 LDC 买不了吃亏，但能让作者知道有人在乎这个项目',
            href: 'https://credit.linux.do/paying/online?token=7e7717e183e46ef4a927271660c4059f0d0b8c9d5dd3e2fee1e2944b92633a42'
        },
        {
            id: 'ldc-5',
            title: '⭐ 金牌股东',
            amount: '5 LDC',
            desc: '进入作者“优先响应名单”，你的 Issue 和 PR 会被高亮处理',
            href: 'https://credit.linux.do/paying/online?token=241147af3294a981944aea5a7c6d6c6868fdabed3122c3dc6c40c35f90f13eb4'
        }
    ]);
    const DEFAULT_PREFS = Object.freeze({
        mode: 'summary',
        threadSource: 'nested',
        width: 760,
        height: 100,
        showReadBadges: true,
        showEffectiveBadges: true,
        showCategoryColors: true,
        forceCreatedOrder: true,
        clickTopicToDrawer: false,
        trackDrawerViews: false,
        trackDrawerViewsLive: true,
        trackDrawerViewsTopicLinks: true,
        trackDrawerViewsReadLater: true,
        trackDrawerViewsRecent: true,
        trackDrawerViewsResume: true,
        trackDrawerViewsFavorites: false,
        autoScrollSpeed: AUTO_SCROLL_DEFAULT_SPEED_LEVEL,
        keywordBlockList: '',
        keywordHighlightList: '',
        liveEnabled: false,
        livePauseHidden: true,
        liveCreatedOrder: true,
        liveCategoryFilter: '',
        prefLeft: null,
        prefTop: null,
        prefEdgeState: null,
        memoryLimit: MAX_MEMORY,
        favoriteLimit: MAX_FAVORITES,
        recentLimit: MAX_RECENT_VIEW,
        pageNavLimit: MAX_PAGE_NAV,
        topicCacheLimit: MAX_TOPIC_CACHE,
        frameHistoryLimit: MAX_FRAME_HISTORY,
        previewPrefetchDelay: PREVIEW_PREFETCH_DELAY,
        previewCacheTtl: PREVIEW_PREFETCH_TTL / 1000,
        badgeRefreshDelay: BADGE_REFRESH_DELAY,
        frameLoadWait: FRAME_LOAD_WAIT,
        livePollMinutes: 10,
        liveMaxTopics: 50
    });
    const MODES = Object.freeze({
        summary: { label: '预览', help: '读取楼主正文' },
        thread: { label: '详情', help: '打开详情页面' }
    });
    const THREAD_SOURCES = Object.freeze({
        nested: { label: '楼层视图', help: '使用 /n/topic/{id}，适合抽屉内阅读' },
        original: { label: '原帖页面', help: '使用标题上的原始链接，和直接打开话题一致' }
    });
    const TRACK_DRAWER_VIEW_PREFS = Object.freeze([
        'trackDrawerViewsLive',
        'trackDrawerViewsTopicLinks',
        'trackDrawerViewsReadLater',
        'trackDrawerViewsRecent',
        'trackDrawerViewsResume',
        'trackDrawerViewsFavorites'
    ]);
    const DRAWER_WIDTH_PRESETS = Object.freeze([
        { id: 'compact', label: '紧凑', width: 400, help: '适合快速查看' },
        { id: 'standard', label: '标准', width: 760, help: '默认阅读宽度' },
        { id: 'wide', label: '宽屏', width: 960, help: '更宽的正文区域' },
        { id: 'immersive', label: '沉浸', width: 1280, help: '最大预览宽度' }
    ]);
    const TUNING_FIELDS = Object.freeze({
        memoryLimit: { label: '已读保存', help: '本地最多保存多少个已读话题', min: 20, max: 500, step: 10, unit: '条' },
        favoriteLimit: { label: '收藏保存', help: '本地最多保存多少个收藏话题', min: 20, max: 300, step: 10, unit: '条' },
        recentLimit: { label: '最近显示', help: '最近查看列表展示数量', min: 5, max: 50, step: 5, unit: '条' },
        pageNavLimit: { label: '导航标签', help: '导航栏最多保留多少个页面', min: 5, max: 30, step: 1, unit: '页' },
        topicCacheLimit: { label: '预览缓存', help: '话题 JSON 缓存数量', min: 3, max: 30, step: 1, unit: '个' },
        frameHistoryLimit: { label: '详情历史', help: 'iframe 前进后退历史数量', min: 10, max: 100, step: 5, unit: '条' },
        previewPrefetchDelay: { label: '预加载等待', help: '悬浮图标后延迟多久预取', min: 0, max: 1000, step: 20, unit: 'ms' },
        previewCacheTtl: { label: '缓存有效期', help: '重复悬浮预取的间隔', min: 10, max: 600, step: 10, unit: '秒' },
        badgeRefreshDelay: { label: '标记刷新', help: '已读和话题生效标记刷新等待', min: 100, max: 3000, step: 100, unit: 'ms' },
        frameLoadWait: { label: '详情等待', help: 'iframe 加载多久后提示重试', min: 5, max: 60, step: 1, unit: '秒' },
        livePollMinutes: { label: '实时轮询', help: '开启后多久检查一次最新帖子', min: 3, max: 60, step: 1, unit: '分钟' },
        liveMaxTopics: { label: '实时显示', help: '实时新帖窗口最多显示多少条', min: 5, max: 150, step: 5, unit: '条' }
    });
    const TOPIC_ANCHOR_QUERY = [
        'a.raw-link[href]',
        'a.title[href]',
        'a.search-link[href]',
        'a[href^="/t/"]',
        'a[href*="linux.do/t/"]'
    ].join(',');
    const BADGE_ANCHOR_QUERY = 'a.title.raw-link.raw-topic-link[data-topic-id][href]';
    const LAST_VIEWED_ANCHOR_QUERY = `${BADGE_ANCHOR_QUERY}, a.search-link[href]`;

    // 集中管理偏好设置：抽屉内设置、悬浮设置和油猴菜单都写入这里。
    const Prefs = {
        value: { ...DEFAULT_PREFS },

        load() {
            let stored = null;
            try {
                stored = typeof GM_getValue === 'function'
                    ? GM_getValue(PREF_KEY, null)
                    : window.localStorage.getItem(PREF_KEY);
            } catch (_) {
                stored = null;
            }

            if (!stored) {
                try {
                    stored = typeof GM_getValue === 'function'
                        ? GM_getValue(LEGACY_PREF_KEY, null)
                        : window.localStorage.getItem(LEGACY_PREF_KEY);
                } catch (_) {
                    stored = null;
                }
            }

            this.value = this.normalize(stored);
            return this.value;
        },

        save(next) {
            this.value = this.normalize({ ...this.value, ...next });
            try {
                const payload = JSON.stringify(this.value);
                if (typeof GM_setValue === 'function') {
                    GM_setValue(PREF_KEY, payload);
                } else {
                    window.localStorage.setItem(PREF_KEY, payload);
                }
            } catch (error) {
                console.warn(`${LOG_PREFIX} 设置保存失败`, error);
            }
            return this.value;
        },

        toggle() {
            return this.save({ mode: this.value.mode === 'summary' ? 'thread' : 'summary' });
        },

        normalize(raw) {
            let parsed = raw;
            if (typeof raw === 'string') {
                try {
                    parsed = raw.trim().startsWith('{') ? JSON.parse(raw) : { mode: raw };
                } catch (_) {
                    parsed = { mode: raw };
                }
            }

            const source = parsed && typeof parsed === 'object' ? parsed : {};
            const normalized = {
                mode: source.mode === 'thread' ? 'thread' : 'summary',
                threadSource: source.threadSource === 'original' ? 'original' : 'nested',
                width: this.numberInRange(source.width, DEFAULT_PREFS.width, 400, 1280),
                height: this.numberInRange(source.height, DEFAULT_PREFS.height, 60, 100),
                showReadBadges: source.showReadBadges !== false,
                showEffectiveBadges: source.showEffectiveBadges !== false,
                showCategoryColors: source.showCategoryColors !== false,
                forceCreatedOrder: source.forceCreatedOrder !== false,
                clickTopicToDrawer: source.clickTopicToDrawer === true,
                trackDrawerViews: source.trackDrawerViews === true,
                trackDrawerViewsLive: source.trackDrawerViewsLive !== false,
                trackDrawerViewsTopicLinks: source.trackDrawerViewsTopicLinks !== false,
                trackDrawerViewsReadLater: source.trackDrawerViewsReadLater !== false,
                trackDrawerViewsRecent: source.trackDrawerViewsRecent !== false,
                trackDrawerViewsResume: source.trackDrawerViewsResume !== false,
                trackDrawerViewsFavorites: source.trackDrawerViewsFavorites === true,
                autoScrollSpeed: this.autoScrollSpeed(source.autoScrollSpeed),
                keywordBlockList: this.cleanTextSetting(source.keywordBlockList),
                keywordHighlightList: this.cleanTextSetting(source.keywordHighlightList),
                liveEnabled: source.liveEnabled === true,
                livePauseHidden: source.livePauseHidden !== false,
                liveCreatedOrder: source.liveCreatedOrder !== false,
                liveCategoryFilter: this.cleanTextSetting(source.liveCategoryFilter),
                prefLeft: this.optionalNumberInRange(source.prefLeft, 0, Math.max(0, window.innerWidth - FLOATING_BUTTON_SIZE)),
                prefTop: this.optionalNumberInRange(source.prefTop, 0, Math.max(0, window.innerHeight - FLOATING_BUTTON_SIZE)),
                prefEdgeState: this.edgeState(source.prefEdgeState)
            };
            Object.entries(TUNING_FIELDS).forEach(([field, config]) => {
                normalized[field] = this.numberInRange(source[field], DEFAULT_PREFS[field], config.min, config.max);
            });
            return normalized;
        },

        numberInRange(value, fallback, min, max) {
            const number = Number(value);
            if (!Number.isFinite(number)) return fallback;
            return Math.max(min, Math.min(max, Math.round(number)));
        },

        optionalNumberInRange(value, min, max) {
            const number = Number(value);
            if (!Number.isFinite(number)) return null;
            return Math.max(min, Math.min(max, Math.round(number)));
        },

        edgeState(value) {
            if (!value || typeof value !== 'object') return null;
            const edge = ['left', 'right', 'top', 'bottom'].includes(value.edge) ? value.edge : '';
            if (!edge) return null;
            const maxLeft = Math.max(0, window.innerWidth - FLOATING_BUTTON_SIZE);
            const maxTop = Math.max(0, window.innerHeight - FLOATING_BUTTON_SIZE);
            const left = this.optionalNumberInRange(value.left, 0, maxLeft);
            const top = this.optionalNumberInRange(value.top, 0, maxTop);
            if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
            return { edge, left, top };
        },

        cleanTextSetting(value) {
            return String(value || '').replace(/\r\n?/g, '\n').trim();
        },

        mode(mode) {
            return mode === 'thread' ? 'thread' : 'summary';
        },

        threadSource(source) {
            return source === 'original' ? 'original' : 'nested';
        },

        autoScrollSpeed(speed) {
            return Object.prototype.hasOwnProperty.call(AUTO_SCROLL_SPEED_LEVELS, speed)
                ? speed
                : AUTO_SCROLL_DEFAULT_SPEED_LEVEL;
        }
    };

    const Urls = {
        topicIdFromHref(href) {
            if (!href) return '';
            try {
                const url = new URL(href, location.origin);
                const match = url.pathname.match(/\/t\/(?:[^/]+\/)?(\d+)/);
                return match ? match[1] : '';
            } catch (_) {
                return '';
            }
        },

        topicJson(topicId) {
            return `/t/${encodeURIComponent(topicId)}.json`;
        },

        nestedThread(topicId) {
            return `/n/topic/${encodeURIComponent(topicId)}`;
        },

        canonicalTopic(topicId) {
            return `/t/${encodeURIComponent(topicId)}`;
        },

        absolute(raw) {
            if (!raw) return '';
            if (raw.startsWith('#') || raw.startsWith('mailto:')) return raw;
            try {
                return new URL(raw, location.origin).href;
            } catch (_) {
                return raw;
            }
        },

        framePreview(raw) {
            const value = String(raw || '').trim();
            if (!value) return '';
            const normalized = /^[a-z][a-z\d+.-]*:\/\//i.test(value)
                ? value
                : value.startsWith('linux.do/')
                    ? `https://${value}`
                    : value;
            try {
                const url = new URL(normalized, location.origin);
                return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
            } catch (_) {
                return '';
            }
        }
    };

    const CreatedOrder = {
        started: false,
        routeTimer: 0,

        apply() {
            const nextHref = this.hrefWithCreatedOrder(location.href);
            if (!nextHref || nextHref === location.href) return false;
            location.replace(nextHref);
            return true;
        },

        start() {
            if (this.started) return;
            this.started = true;
            this.patchHistory();
            document.addEventListener('click', (event) => this.rewriteClickedLink(event), true);
            window.addEventListener('popstate', () => this.schedule(), { passive: true });
            window.addEventListener('hashchange', () => this.schedule(), { passive: true });
        },

        schedule() {
            if (this.routeTimer) return;
            this.routeTimer = window.setTimeout(() => {
                this.routeTimer = 0;
                this.apply();
            }, 0);
        },

        hrefWithCreatedOrder(rawHref) {
            if (!Prefs.value.forceCreatedOrder || rawHref === undefined || rawHref === null) return '';
            if (typeof rawHref === 'string') {
                const value = rawHref.trim();
                if (!value || value.startsWith('#') || /^(javascript|mailto|tel):/i.test(value)) return '';
            }

            try {
                const url = new URL(rawHref, location.href);
                if (url.origin !== location.origin) return '';
                if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
                if (url.searchParams.get('order') === 'created') return '';
                url.searchParams.set('order', 'created');
                return url.href;
            } catch (_) {
                return '';
            }
        },

        rewriteClickedLink(event) {
            if (!Prefs.value.forceCreatedOrder) return;
            let target = event.target;
            if (!(target instanceof Element)) target = target?.parentElement;
            const anchor = target?.closest?.('a[href]');
            if (!anchor || anchor.hasAttribute('download')) return;
            const nextHref = this.hrefWithCreatedOrder(anchor.getAttribute('href'));
            if (nextHref && nextHref !== anchor.href) anchor.href = nextHref;
        },

        patchHistory() {
            ['pushState', 'replaceState'].forEach((method) => {
                const original = history[method];
                if (typeof original !== 'function' || original.ldpeekCreatedOrderPatched) return;
                const wrapped = (...args) => {
                    if (args.length >= 3) args[2] = this.historyHref(args[2]);
                    const result = original.apply(history, args);
                    this.schedule();
                    return result;
                };
                wrapped.ldpeekCreatedOrderPatched = true;
                history[method] = wrapped;
            });
        },

        historyHref(rawHref) {
            if (rawHref === undefined || rawHref === null) return rawHref;
            const nextHref = this.hrefWithCreatedOrder(rawHref);
            if (!nextHref) return rawHref;
            if (typeof rawHref !== 'string' || /^[a-z][a-z\d+.-]*:/i.test(rawHref)) return nextHref;
            const url = new URL(nextHref);
            return `${url.pathname}${url.search}${url.hash}`;
        }
    };

    const DiscourseReadTracker = {
        prefix: `${NAME}-discourse-track-view-v2:`,
        pendingTtl: 30 * 1000,
        doneTtl: 8 * 60 * 60 * 1000,
        fetchTimeout: 8000,
        memoryState: new Map(),
        sessionId: '',

        markTopic(topicId, href = '', source = 'live-topic') {
            const id = String(topicId || '');
            if (!id || !Number.isFinite(Number(id))) return Promise.resolve({ accepted: false, skipped: true, reason: 'invalid-topic' });
            const info = this.topicInfo(id, href);
            if (!info || info.url.origin !== location.origin) return Promise.resolve({ accepted: false, skipped: true, reason: 'cross-origin' });
            const recentState = this.readState(info);
            if (recentState?.expiresAt && recentState.expiresAt > Date.now()) {
                return Promise.resolve(this.recentStateResult(recentState));
            }
            const token = this.claim(info, source);
            if (!token) return Promise.resolve(this.recentStateResult(this.readState(info)));
            return this.sendTrackRequest(info, location.href).then((result) => {
                if (result.accepted) {
                    this.markDone(info, token, result);
                    return result;
                }
                this.clearStateIfTokenMatches(info, token);
                return result;
            }).catch((error) => {
                this.clearStateIfTokenMatches(info, token);
                console.warn(`${LOG_PREFIX} Discourse 浏览追踪上报失败`, error);
                throw error;
            });
        },

        recentStateResult(state) {
            const fallback = { accepted: true, skipped: true, reason: 'recent-or-pending' };
            if (state?.status === 'pending') return fallback;
            const result = state?.result;
            if (result?.skipped && result.reason === 'starter-post-read-with-browser-pageview') {
                return {
                    ...result,
                    accepted: true,
                    skipped: true,
                    reason: 'starter-post-read-with-browser-pageview',
                    recent: true
                };
            }
            if (result?.confirmed) {
                return {
                    ...result,
                    accepted: true,
                    confirmed: true,
                    skipped: true,
                    reason: 'recent-confirmed-refill',
                    recent: true
                };
            }
            if (result?.accepted) {
                return {
                    ...result,
                    accepted: true,
                    skipped: true,
                    reason: 'recent-or-pending',
                    recent: true
                };
            }
            return fallback;
        },

        topicInfo(topicId, href = '') {
            try {
                const url = new URL(href || Urls.canonicalTopic(topicId), location.origin);
                const id = Urls.topicIdFromHref(url.href) || String(topicId || '');
                if (!id) return null;
                return { topicId: id, url };
            } catch (_) {
                return null;
            }
        },

        stateKey(info) {
            return `${this.prefix}${info.url.hostname}:${info.topicId}`;
        },

        readState(info) {
            const key = this.stateKey(info);
            try {
                return JSON.parse(window.localStorage.getItem(key) || 'null');
            } catch (_) {
                return this.memoryState.get(key) || null;
            }
        },

        writeState(info, state) {
            const key = this.stateKey(info);
            const payload = JSON.stringify(state);
            try {
                window.localStorage.setItem(key, payload);
            } catch (_) {
                this.memoryState.set(key, state);
            }
        },

        clearStateIfTokenMatches(info, token) {
            const state = this.readState(info);
            if (state?.token !== token) return;
            const key = this.stateKey(info);
            try {
                window.localStorage.removeItem(key);
            } catch (_) {
                // localStorage 可能不可写，内存兜底同步清理。
            }
            this.memoryState.delete(key);
        },

        claim(info, source) {
            const state = this.readState(info);
            if (state?.expiresAt && state.expiresAt > Date.now()) return '';
            const token = this.randomId();
            this.writeState(info, {
                status: 'pending',
                token,
                source,
                createdAt: Date.now(),
                expiresAt: Date.now() + this.pendingTtl
            });
            return token;
        },

        markDone(info, token, result) {
            this.writeState(info, {
                status: result.confirmed ? 'confirmed' : 'accepted',
                token,
                result,
                createdAt: Date.now(),
                expiresAt: Date.now() + this.doneTtl
            });
        },

        async sendTrackRequest(info, referrerUrl) {
            const attempts = [];
            let confirmed = false;
            let confirmedBy = null;
            try {
                const topicJson = await this.sendTopicJsonTrack(info);
                attempts.push(topicJson);
                if (this.isConfirmed(topicJson)) {
                    confirmed = true;
                    confirmedBy = 'topic-json-header';
                }
                if (this.hasStarterPostReadWithBrowserPageView(topicJson)) {
                    attempts.push({
                        endpoint: 'topic-read-timing',
                        ok: true,
                        skipped: true,
                        reason: 'starter-post-read-with-browser-pageview',
                        readState: topicJson.readState
                    });
                    return {
                        confirmed,
                        accepted: true,
                        skipped: true,
                        reason: 'starter-post-read-with-browser-pageview',
                        confirmedBy: confirmedBy || 'starter-post-read-with-browser-pageview',
                        attempts
                    };
                }
            } catch (error) {
                attempts.push({ endpoint: 'topic-json-track', ok: false, error: this.serializeError(error) });
            }

            try {
                attempts.push(await this.sendTopicReadTiming(info));
            } catch (error) {
                attempts.push({ endpoint: 'topic-read-timing', ok: false, error: this.serializeError(error) });
            }

            if (confirmed) return { confirmed: true, accepted: true, confirmedBy, attempts };

            try {
                const sessionTrack = await this.sendSessionCurrentTrack(info, referrerUrl);
                attempts.push(sessionTrack);
                if (this.isConfirmed(sessionTrack)) {
                    confirmed = true;
                    confirmedBy = 'session-current-header';
                }
            } catch (error) {
                attempts.push({ endpoint: 'session-current-fallback', ok: false, error: this.serializeError(error) });
            }

            const accepted = attempts.some((item) => item?.ok);
            return {
                confirmed,
                accepted,
                confirmedBy: confirmedBy || (accepted ? 'http-ok-without-track-header' : null),
                attempts
            };
        },

        sendSessionCurrentTrack(info, referrerUrl) {
            return this.fetchWithTimeout(`${info.url.origin}${this.basePath()}/session/current.json`, {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: this.trackViewHeaders(info, referrerUrl)
            }).then((response) => this.responseResult('session-current-track', response));
        },

        sendTopicJsonTrack(info) {
            return this.fetchWithTimeout(`${info.url.origin}${this.basePath()}/t/${encodeURIComponent(info.topicId)}/1.json?track_visit=true&forceLoad=true`, {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: this.topicJsonHeaders(info)
            }).then((response) => this.topicJsonResponseResult('topic-json-track', response));
        },

        sendTopicReadTiming(info) {
            return this.fetchWithTimeout(`${info.url.origin}${this.basePath()}/topics/timings`, {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: this.readTimingHeaders(),
                body: this.readTimingBody(info)
            }).then((response) => this.responseResult('topic-read-timing', response));
        },

        commonHeaders() {
            const headers = {
                Accept: 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest'
            };
            const token = this.meta('csrf-token');
            if (token) headers['X-CSRF-Token'] = token;
            return headers;
        },

        trackViewHeaders(info, referrerUrl) {
            return {
                ...this.commonHeaders(),
                'Discourse-Present': 'true',
                'Discourse-Track-View': 'true',
                'Discourse-Track-View-Topic-Id': String(info.topicId),
                'Discourse-Track-View-Url': info.url.href,
                'Discourse-Track-View-Referrer': referrerUrl || document.referrer || '',
                'Discourse-Track-View-Session-Id': this.trackingSessionId()
            };
        },

        topicJsonHeaders(info) {
            return {
                ...this.commonHeaders(),
                'Discourse-Present': 'true',
                'Discourse-Track-View': 'true',
                'Discourse-Track-View-Topic-Id': String(info.topicId)
            };
        },

        readTimingHeaders() {
            return {
                ...this.commonHeaders(),
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            };
        },

        readTimingBody(info) {
            const body = new URLSearchParams();
            body.set('topic_id', String(info.topicId));
            body.set('timings[1]', String(this.readTimingMsecs()));
            return body;
        },

        readTimingMsecs() {
            return Math.round(2500 + Math.random() * 2500);
        },

        fetchWithTimeout(url, options) {
            const controller = new AbortController();
            const timer = window.setTimeout(() => controller.abort(), this.fetchTimeout);
            return fetch(url, { ...options, signal: controller.signal }).finally(() => {
                window.clearTimeout(timer);
            });
        },

        responseResult(endpoint, response) {
            return {
                endpoint,
                status: response.status,
                ok: response.ok,
                trackView: response.headers.get('x-discourse-trackview'),
                browserPageView: response.headers.get('x-discourse-browserpageview'),
                url: response.url
            };
        },

        async topicJsonResponseResult(endpoint, response) {
            const result = this.responseResult(endpoint, response);
            if (!response.ok) return result;
            try {
                const payload = await response.json();
                const readState = this.topicJsonReadState(payload);
                if (readState) {
                    result.readState = readState;
                    result.alreadyRead = readState.alreadyRead;
                    result.starterPostRead = readState.starterPostRead;
                }
            } catch (error) {
                result.jsonError = this.serializeError(error);
            }
            return result;
        },

        topicJsonReadState(payload) {
            if (!payload || typeof payload !== 'object') return null;
            const highestPostNumber = this.finiteNumber(payload.highest_post_number);
            const lastReadPostNumber = this.finiteNumber(payload.last_read_post_number);
            const postsCount = this.finiteNumber(payload.posts_count);
            const starterPost = this.starterPost(payload);
            const starterPostRead = starterPost?.read === true;
            const alreadyRead = highestPostNumber > 0 && lastReadPostNumber >= highestPostNumber;
            return {
                highestPostNumber,
                lastReadPostNumber,
                postsCount,
                starterPostRead,
                alreadyRead
            };
        },

        starterPost(payload) {
            const posts = Array.isArray(payload?.post_stream?.posts) ? payload.post_stream.posts : [];
            return posts.find((post) => Number(post?.post_number) === 1) || posts[0] || null;
        },

        finiteNumber(value) {
            const number = Number(value);
            return Number.isFinite(number) ? number : 0;
        },

        isConfirmed(result) {
            if (!result) return false;
            if (result.browserPageView === '1' || result.trackView === '1') return true;
            if (result.browserPageView === '0' || result.trackView === '0') return false;
            return false;
        },

        hasStarterPostReadWithBrowserPageView(result) {
            return result?.endpoint === 'topic-json-track' &&
                result?.starterPostRead === true &&
                result?.browserPageView === '1';
        },

        meta(name) {
            return document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '';
        },

        basePath() {
            return this.meta('discourse-base-uri').replace(/\/$/, '');
        },

        trackingSessionId() {
            const metaValue = this.meta('discourse-track-view-session-id');
            if (metaValue) return metaValue;
            if (this.sessionId) return this.sessionId;
            const key = `${this.prefix}session-id`;
            try {
                this.sessionId = window.sessionStorage.getItem(key) || '';
                if (!this.sessionId) {
                    this.sessionId = this.randomId();
                    window.sessionStorage.setItem(key, this.sessionId);
                }
            } catch (_) {
                this.sessionId = this.randomId();
            }
            return this.sessionId;
        },

        randomId() {
            if (window.crypto?.randomUUID) return window.crypto.randomUUID();
            return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        },

        serializeError(error) {
            return {
                name: error?.name || 'Error',
                message: error?.message || String(error)
            };
        }
    };

    const Dom = {
        ready(callback) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', callback, { once: true });
            } else {
                callback();
            }
        },

        make(tag, props = {}, children = []) {
            const element = document.createElement(tag);
            Object.entries(props).forEach(([key, value]) => {
                if (value === undefined || value === null) return;
                if (key === 'className') element.className = value;
                else if (key === 'text') element.textContent = value;
                else if (key === 'html') element.innerHTML = value;
                else if (key.startsWith('data-')) element.setAttribute(key, value);
                else element.setAttribute(key, value);
            });

            const list = Array.isArray(children) ? children : [children];
            list.forEach((child) => {
                if (child === undefined || child === null) return;
                element.append(child.nodeType ? child : document.createTextNode(String(child)));
            });
            return element;
        },

        isOwnSurface(target) {
            return !!target?.closest?.(`#${NAME}-eye, #${NAME}-mini-stats, #${NAME}-shade, #${NAME}-drawer, #${NAME}-drawer-sidebar, #${NAME}-prefs`);
        }
    };

    function elementBackgroundLooksDark(element) {
        if (!element || !window.getComputedStyle) return null;
        const color = window.getComputedStyle(element).backgroundColor;
        const match = color?.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/i);
        if (!match) return null;

        const alphaRaw = match[4];
        const alpha = alphaRaw
            ? (alphaRaw.endsWith('%') ? Number.parseFloat(alphaRaw) / 100 : Number.parseFloat(alphaRaw))
            : 1;
        if (!Number.isFinite(alpha) || alpha <= 0.05) return null;

        const r = Number.parseFloat(match[1]);
        const g = Number.parseFloat(match[2]);
        const b = Number.parseFloat(match[3]);
        if (![r, g, b].every(Number.isFinite)) return null;

        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        return luminance < 0.52;
    }

    function pagePrefersDarkTheme() {
        const root = document.documentElement;
        const body = document.body;
        const tokens = [
            ...Array.from(root?.classList || []),
            ...Array.from(body?.classList || [])
        ].map((token) => token.toLowerCase());
        const darkTokens = new Set(['dark', 'dark-scheme', 'theme-dark', 'dark-mode', 'color-scheme-dark']);
        const lightTokens = new Set(['light', 'light-scheme', 'theme-light', 'light-mode', 'color-scheme-light']);

        if (tokens.some((token) => darkTokens.has(token))) return true;
        if (tokens.some((token) => lightTokens.has(token))) return false;

        const schemes = [
            root?.style?.colorScheme,
            body?.style?.colorScheme,
            root ? window.getComputedStyle?.(root)?.colorScheme : '',
            body ? window.getComputedStyle?.(body)?.colorScheme : ''
        ].filter(Boolean);
        const explicitScheme = schemes.find((scheme) => /\bdark\b/i.test(scheme) !== /\blight\b/i.test(scheme));
        if (explicitScheme) return /\bdark\b/i.test(explicitScheme);

        const backgroundDark = [body, root]
            .map((element) => elementBackgroundLooksDark(element))
            .find((value) => value !== null);
        if (backgroundDark !== undefined) return backgroundDark;

        return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
    }

    function estimateSerializedBytes(value) {
        try {
            const seen = new WeakSet();
            const json = JSON.stringify(value, (_, next) => {
                if (typeof next === 'bigint') return String(next);
                if (typeof next === 'function') return `[Function ${next.name || 'anonymous'}]`;
                if (next instanceof Map) return Array.from(next.entries());
                if (next instanceof Set) return Array.from(next.values());
                if (typeof Promise !== 'undefined' && next instanceof Promise) return '[Promise]';
                if (typeof Element !== 'undefined' && next instanceof Element) return `[Element ${next.tagName.toLowerCase()}]`;
                if (typeof Node !== 'undefined' && next instanceof Node) return `[Node ${next.nodeName}]`;
                if (next && typeof next === 'object') {
                    if (seen.has(next)) return '[Circular]';
                    seen.add(next);
                }
                return next;
            });
            return json ? json.length * 2 : 0;
        } catch (_) {
            return 0;
        }
    }

    function formatBytes(bytes) {
        const number = Number(bytes);
        if (!Number.isFinite(number) || number < 0) return '未知';
        const units = ['B', 'KB', 'MB', 'GB'];
        let value = number;
        let index = 0;
        while (value >= 1024 && index < units.length - 1) {
            value /= 1024;
            index += 1;
        }
        const digits = value >= 100 || index === 0 ? 0 : value >= 10 ? 1 : 2;
        return `${value.toFixed(digits)} ${units[index]}`;
    }

    // 复用的点击式尺寸控件，抽屉内设置和页面悬浮设置共用同一套行为。
    const SizeControls = {
        config(field) {
            if (field === 'height') return { min: 60, max: 100, step: 5, unit: 'vh' };
            return { min: 400, max: 1280, step: 20, unit: 'px' };
        },

        build(field, label) {
            const config = this.config(field);
            const value = Prefs.value[field];
            return Dom.make('div', { className: `${NAME}-size-row`, 'data-size-row': field }, [
                Dom.make('span', { className: `${NAME}-size-label`, text: label }),
                Dom.make('button', {
                    className: `${NAME}-size-step`,
                    type: 'button',
                    title: `减少${label}`,
                    'aria-label': `减少${label}`,
                    'data-size-step': '-1',
                    'data-size-field': field,
                    text: '-'
                }),
                Dom.make('button', {
                    className: `${NAME}-size-clicker`,
                    type: 'button',
                    role: 'slider',
                    'aria-label': label,
                    'aria-valuemin': String(config.min),
                    'aria-valuemax': String(config.max),
                    'aria-valuenow': String(value),
                    'data-size-track': field
                }, [
                    Dom.make('span', { className: `${NAME}-size-fill`, 'data-size-fill': field }),
                    Dom.make('span', { className: `${NAME}-size-thumb`, 'data-size-thumb': field })
                ]),
                Dom.make('button', {
                    className: `${NAME}-size-step`,
                    type: 'button',
                    title: `增加${label}`,
                    'aria-label': `增加${label}`,
                    'data-size-step': '1',
                    'data-size-field': field,
                    text: '+'
                }),
                Dom.make('input', {
                    className: `${NAME}-size-number`,
                    type: 'number',
                    min: String(config.min),
                    max: String(config.max),
                    step: String(config.step),
                    value: String(value),
                    'data-size-input': field
                }),
                Dom.make('span', { className: `${NAME}-size-unit`, text: config.unit })
            ]);
        },

        clamp(field, value) {
            const config = this.config(field);
            return Prefs.numberInRange(value, DEFAULT_PREFS[field], config.min, config.max);
        },

        fromTrack(track, clientX) {
            const field = track.dataset.sizeTrack;
            if (field !== 'width' && field !== 'height') return null;
            const config = this.config(field);
            const rect = track.getBoundingClientRect();
            const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
            const raw = config.min + Math.max(0, Math.min(1, ratio)) * (config.max - config.min);
            const stepped = Math.round(raw / config.step) * config.step;
            return { field, value: this.clamp(field, stepped) };
        },

        fromStep(button) {
            const field = button.dataset.sizeField;
            if (field !== 'width' && field !== 'height') return null;
            const config = this.config(field);
            const direction = button.dataset.sizeStep === '-1' ? -1 : 1;
            return { field, value: this.clamp(field, Prefs.value[field] + direction * config.step) };
        },

        fromInput(input) {
            const field = input.dataset.sizeInput;
            if (field !== 'width' && field !== 'height') return null;
            return { field, value: this.clamp(field, input.value) };
        },

        fromTyping(input) {
            const field = input.dataset.sizeInput;
            if (field !== 'width' && field !== 'height') return null;
            if (input.value.trim() === '') return null;
            const value = Number(input.value);
            const config = this.config(field);
            if (!Number.isFinite(value) || value < config.min || value > config.max) return null;
            return { field, value: this.clamp(field, value) };
        },

        sync(root) {
            if (!root) return;
            root.querySelectorAll('[data-size-input]').forEach((input) => {
                const field = input.dataset.sizeInput;
                input.value = String(Prefs.value[field]);
            });
            root.querySelectorAll('[data-size-track]').forEach((track) => {
                const field = track.dataset.sizeTrack;
                const config = this.config(field);
                const value = Prefs.value[field];
                const ratio = (value - config.min) / (config.max - config.min);
                const percent = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
                track.style.setProperty('--size-ratio', percent);
                track.setAttribute('aria-valuenow', String(value));
            });
        }
    };

    // 数据 tab 中的运行参数设置。这里保留较小上限，避免缓存和历史过大再次造成内存压力。
    const TuningControls = {
        config(field) {
            return TUNING_FIELDS[field] || null;
        },

        build(field) {
            const config = this.config(field);
            if (!config) return null;
            return Dom.make('div', { className: `${NAME}-tuning-row`, 'data-tuning-row': field }, [
                Dom.make('div', { className: `${NAME}-tuning-copy` }, [
                    Dom.make('span', { className: `${NAME}-tuning-label`, text: config.label }),
                    Dom.make('span', { className: `${NAME}-tuning-help`, text: config.help })
                ]),
                Dom.make('button', {
                    className: `${NAME}-tuning-step`,
                    type: 'button',
                    title: `减少${config.label}`,
                    'aria-label': `减少${config.label}`,
                    'data-tuning-step': '-1',
                    'data-tuning-field': field,
                    text: '-'
                }),
                Dom.make('input', {
                    className: `${NAME}-tuning-number`,
                    type: 'number',
                    min: String(config.min),
                    max: String(config.max),
                    step: String(config.step),
                    value: String(Prefs.value[field]),
                    'data-tuning-input': field
                }),
                Dom.make('button', {
                    className: `${NAME}-tuning-step`,
                    type: 'button',
                    title: `增加${config.label}`,
                    'aria-label': `增加${config.label}`,
                    'data-tuning-step': '1',
                    'data-tuning-field': field,
                    text: '+'
                }),
                Dom.make('span', { className: `${NAME}-tuning-unit`, text: config.unit })
            ]);
        },

        clamp(field, value) {
            const config = this.config(field);
            if (!config) return null;
            return Prefs.numberInRange(value, DEFAULT_PREFS[field], config.min, config.max);
        },

        fromStep(button) {
            const field = button.dataset.tuningField;
            const config = this.config(field);
            if (!config) return null;
            const direction = button.dataset.tuningStep === '-1' ? -1 : 1;
            return { field, value: this.clamp(field, Prefs.value[field] + direction * config.step) };
        },

        fromInput(input) {
            const field = input.dataset.tuningInput;
            const value = this.clamp(field, input.value);
            return value === null ? null : { field, value };
        },

        fromTyping(input) {
            const field = input.dataset.tuningInput;
            const config = this.config(field);
            if (!config || input.value.trim() === '') return null;
            const value = Number(input.value);
            if (!Number.isFinite(value) || value < config.min || value > config.max) return null;
            return { field, value: this.clamp(field, value) };
        },

        sync(root) {
            if (!root) return;
            root.querySelectorAll('[data-tuning-input]').forEach((input) => {
                const field = input.dataset.tuningInput;
                if (this.config(field)) input.value = String(Prefs.value[field]);
            });
        }
    };

    const TopicHitTest = {
        fromPointerTarget(target) {
            if (!(target instanceof Element) || Dom.isOwnSurface(target)) return null;
            const anchor = target.closest(TOPIC_ANCHOR_QUERY);
            if (!anchor) return null;

            const topicId = Urls.topicIdFromHref(anchor.getAttribute('href'));
            return topicId ? { topicId, anchor } : null;
        }
    };

    // 话题收藏只保存在本地，方便从悬浮设置面板快速回到常看的话题。
    const Favorites = {
        items: [],

        load() {
            let raw = null;
            try {
                raw = typeof GM_getValue === 'function'
                    ? GM_getValue(FAVORITES_KEY, null)
                    : window.localStorage.getItem(FAVORITES_KEY);
            } catch (_) {
                raw = null;
            }

            try {
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                this.items = Array.isArray(parsed)
                    ? parsed.map((item) => this.normalizeItem(item)).filter(Boolean).slice(0, Prefs.value.favoriteLimit)
                    : [];
            } catch (_) {
                this.items = [];
            }
            return this.items;
        },

        save() {
            const payload = JSON.stringify(this.items.slice(0, Prefs.value.favoriteLimit));
            try {
                if (typeof GM_setValue === 'function') {
                    GM_setValue(FAVORITES_KEY, payload);
                } else {
                    window.localStorage.setItem(FAVORITES_KEY, payload);
                }
            } catch (error) {
                console.warn(`${LOG_PREFIX} 收藏保存失败`, error);
            }
        },

        normalizeItem(item) {
            const id = String(item?.id || '');
            if (!id) return null;
            const title = this.cleanTitle(item?.title) || `话题 ${id}`;
            return {
                id,
                title,
                href: Urls.framePreview(item?.href) || Urls.absolute(Urls.canonicalTopic(id)),
                at: Number.isFinite(Number(item?.at)) ? Number(item.at) : Date.now()
            };
        },

        cleanTitle(value) {
            return String(value || '')
                .replace(/\s+/g, ' ')
                .replace(/\s[-–—]\s*(Linux\.?DO|Linux\.do).*$/i, '')
                .trim();
        },

        titleFromAnchor(anchor, topicId) {
            if (!anchor) return '';
            const titleAnchor = this.topicTitleAnchor(anchor, topicId);
            const title = this.cleanTitle(this.anchorTitleText(titleAnchor));
            if (title && !this.isWeakTitle(title, topicId)) return title;
            if (title === '新话题') return title;
            const fallbackTitle = this.cleanTitle(this.anchorTitleText(anchor));
            if (fallbackTitle && !this.isWeakTitle(fallbackTitle, topicId)) return fallbackTitle;
            return fallbackTitle === '新话题' ? fallbackTitle : `话题 ${topicId}`;
        },

        topicTitleAnchor(anchor, topicId) {
            if (!anchor) return null;
            const id = String(topicId || Urls.topicIdFromHref(anchor.getAttribute?.('href')) || '');
            const anchorTitle = this.cleanTitle(this.anchorTitleText(anchor));
            if (this.isTopicTitleAnchor(anchor, id) && !this.isWeakTitle(anchorTitle, id)) return anchor;

            const row = this.topicRow(anchor);
            const titleAnchor = this.findTitleAnchor(row, id, anchor);
            if (titleAnchor) return titleAnchor;

            return anchor;
        },

        findTitleAnchor(scope, topicId, sourceAnchor = null) {
            const id = String(topicId || '');
            if (!scope || !id) return null;

            const primary = Array.from(scope.querySelectorAll?.(BADGE_ANCHOR_QUERY) || []).find((candidate) => {
                return candidate !== sourceAnchor &&
                    this.isTopicTitleAnchor(candidate, id) &&
                    !this.isWeakTitle(this.anchorTitleText(candidate), id);
            });
            if (primary) return primary;

            return Array.from(scope.querySelectorAll?.(TOPIC_ANCHOR_QUERY) || []).find((candidate) => {
                return candidate !== sourceAnchor &&
                    Urls.topicIdFromHref(candidate.getAttribute('href')) === id &&
                    !this.isWeakTitle(this.anchorTitleText(candidate), id) &&
                    !this.isNewTopicBadgeAnchor(candidate);
            }) || null;
        },

        isTopicTitleAnchor(anchor, topicId) {
            if (!anchor?.matches?.(BADGE_ANCHOR_QUERY)) return false;
            return Urls.topicIdFromHref(anchor.getAttribute('href')) === String(topicId || '');
        },

        anchorTitleText(anchor) {
            const titleNode = anchor?.querySelector?.('span[dir="auto"]');
            return titleNode?.textContent || anchor?.getAttribute?.('title') || anchor?.textContent || '';
        },

        isNewTopicBadgeAnchor(anchor) {
            return !!anchor?.matches?.('a.badge.badge-notification.new-topic[title="新话题"][href*="/t/"]');
        },

        topicRow(anchor) {
            return anchor?.closest?.([
                'tr.topic-list-item',
                '.topic-list-item',
                '.latest-topic-list-item',
                '.search-result-topic',
                '.fps-result',
                '.suggested-topics-list-item',
                'li',
                'article'
            ].join(',')) || anchor?.parentElement || null;
        },

        isWeakTitle(value, topicId) {
            const title = this.cleanTitle(value);
            return !title ||
                title === '新话题' ||
                title === `话题 ${topicId}` ||
                /^[\d.,，]+$/.test(title);
        },

        bestTitle(topicId, title = '', sourceAnchor = null, existingTitle = '') {
            const id = String(topicId || '');
            const explicitTitle = this.cleanTitle(title);
            if (explicitTitle) return explicitTitle;
            const anchorTitle = this.titleFromAnchor(sourceAnchor, id);
            if (!this.isWeakTitle(anchorTitle, id)) return anchorTitle;
            const savedTitle = this.cleanTitle(existingTitle);
            if (!this.isWeakTitle(savedTitle, id)) return savedTitle;
            return anchorTitle === '新话题' ? anchorTitle : `话题 ${id}`;
        },

        titleFromDocument(doc, topicId) {
            if (!doc) return '';
            const titleNode = doc.querySelector?.([
                'h1 a.fancy-title',
                'h1 .fancy-title',
                'h1',
                '.topic-title h1',
                '.title-wrapper h1'
            ].join(','));
            return this.cleanTitle(titleNode?.textContent || doc.title) || `话题 ${topicId}`;
        },

        hrefFrom(topicId, sourceAnchor, sourceHref) {
            const id = String(topicId || '');
            const titleAnchor = this.topicTitleAnchor(sourceAnchor, id);
            const titleHref = titleAnchor && titleAnchor !== sourceAnchor ? titleAnchor.getAttribute?.('href') : '';
            return Urls.framePreview(titleHref || sourceHref || sourceAnchor?.getAttribute?.('href') || Urls.canonicalTopic(id)) ||
                Urls.absolute(Urls.canonicalTopic(id));
        },

        itemFrom(topicId, sourceAnchor, sourceHref, title = '') {
            const id = String(topicId || '');
            if (!id) return null;
            const existing = this.get(id);
            return {
                id,
                title: this.bestTitle(id, title, sourceAnchor, existing?.title),
                href: this.hrefFrom(id, sourceAnchor, sourceHref || existing?.href || ''),
                at: Date.now()
            };
        },

        updateMeta(topicId, sourceAnchor, sourceHref, title = '') {
            const id = String(topicId || '');
            const index = this.items.findIndex((item) => item.id === id);
            if (index < 0) return;
            const next = this.itemFrom(id, sourceAnchor, sourceHref, title);
            if (!next) return;
            if (this.items[index].title === next.title && this.items[index].href === next.href) return;
            this.items[index] = { ...this.items[index], ...next, at: this.items[index].at };
            this.save();
        },

        toggle(topicId, sourceAnchor, sourceHref, title = '') {
            const id = String(topicId || '');
            if (!id) return { active: false, item: null };
            const existing = this.get(id);
            if (existing) {
                this.remove(id);
                return { active: false, item: existing };
            }

            const item = this.itemFrom(id, sourceAnchor, sourceHref, title);
            if (!item) return { active: false, item: null };
            this.items = [item, ...this.items.filter((candidate) => candidate.id !== id)].slice(0, Prefs.value.favoriteLimit);
            this.save();
            return { active: true, item };
        },

        trimToLimit() {
            const next = this.items.slice(0, Prefs.value.favoriteLimit);
            if (next.length === this.items.length) return;
            this.items = next;
            this.save();
        },

        remove(topicId) {
            const id = String(topicId || '');
            const length = this.items.length;
            this.items = this.items.filter((item) => item.id !== id);
            if (this.items.length !== length) this.save();
        },

        get(topicId) {
            const id = String(topicId || '');
            return this.items.find((item) => item.id === id) || null;
        },

        has(topicId) {
            return !!this.get(topicId);
        }
    };

    const ReadLaterQueue = {
        items: [],

        load() {
            let raw = null;
            try {
                raw = typeof GM_getValue === 'function'
                    ? GM_getValue(READ_LATER_KEY, null)
                    : window.localStorage.getItem(READ_LATER_KEY);
            } catch (_) {
                raw = null;
            }

            try {
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                this.items = Array.isArray(parsed)
                    ? parsed.map((item) => this.normalizeItem(item)).filter(Boolean).slice(0, MAX_READ_LATER)
                    : [];
            } catch (_) {
                this.items = [];
            }
            return this.items;
        },

        save() {
            const payload = JSON.stringify(this.items.slice(0, MAX_READ_LATER));
            try {
                if (typeof GM_setValue === 'function') {
                    GM_setValue(READ_LATER_KEY, payload);
                } else {
                    window.localStorage.setItem(READ_LATER_KEY, payload);
                }
            } catch (error) {
                console.warn(`${LOG_PREFIX} 稍后阅读队列保存失败`, error);
            }
        },

        normalizeItem(item) {
            const id = String(item?.id || '');
            if (!id) return null;
            return {
                id,
                title: Favorites.cleanTitle(item?.title) || `话题 ${id}`,
                href: Urls.framePreview(item?.href) || Urls.absolute(Urls.canonicalTopic(id)),
                at: Number.isFinite(Number(item?.at)) ? Number(item.at) : Date.now()
            };
        },

        itemFrom(topicId, sourceAnchor = null, sourceHref = '', title = '') {
            const id = String(topicId || '');
            if (!id) return null;
            const existing = this.get(id) || Favorites.get(id) || ReadMemory.get(id);
            return {
                id,
                title: Favorites.bestTitle(id, title, sourceAnchor, existing?.title),
                href: Favorites.hrefFrom(id, sourceAnchor, sourceHref || existing?.href || ''),
                at: Date.now()
            };
        },

        add(topicId, sourceAnchor = null, sourceHref = '', title = '') {
            const item = this.itemFrom(topicId, sourceAnchor, sourceHref, title);
            if (!item) return { added: false, existing: false, full: false, item: null };
            const index = this.items.findIndex((candidate) => candidate.id === item.id);
            if (index >= 0) {
                this.items[index] = { ...this.items[index], ...item, at: this.items[index].at };
                this.save();
                return { added: false, existing: true, full: false, item: this.items[index] };
            }
            if (this.items.length >= MAX_READ_LATER) {
                return { added: false, existing: false, full: true, item };
            }
            this.items = [...this.items, item];
            this.save();
            return { added: true, existing: false, full: false, item };
        },

        remove(topicId) {
            const id = String(topicId || '');
            const length = this.items.length;
            this.items = this.items.filter((item) => item.id !== id);
            const changed = this.items.length !== length;
            if (changed) this.save();
            return changed;
        },

        clear() {
            if (!this.items.length) return false;
            this.items = [];
            this.save();
            return true;
        },

        get(topicId) {
            const id = String(topicId || '');
            return this.items.find((item) => item.id === id) || null;
        },

        has(topicId) {
            return !!this.get(topicId);
        }
    };

    const PageNav = {
        items: [],
        started: false,
        syncTimer: 0,

        load() {
            let raw = null;
            let hasStored = false;
            try {
                raw = typeof GM_getValue === 'function'
                    ? GM_getValue(PAGE_NAV_KEY, null)
                    : window.localStorage.getItem(PAGE_NAV_KEY);
                hasStored = raw !== null && raw !== undefined && raw !== '';
            } catch (_) {
                raw = null;
                hasStored = false;
            }

            try {
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                this.items = Array.isArray(parsed)
                    ? parsed.map((item) => this.normalizeItem(item)).filter(Boolean).slice(0, Prefs.value.pageNavLimit)
                    : [];
            } catch (_) {
                this.items = [];
            }
            if (!hasStored) {
                this.items = this.defaultItems();
                this.save();
            }
            return this.items;
        },

        save() {
            const payload = JSON.stringify(this.items.slice(0, Prefs.value.pageNavLimit));
            try {
                if (typeof GM_setValue === 'function') {
                    GM_setValue(PAGE_NAV_KEY, payload);
                } else {
                    window.localStorage.setItem(PAGE_NAV_KEY, payload);
                }
            } catch (error) {
                console.warn(`${LOG_PREFIX} 页面导航保存失败`, error);
            }
        },

        start() {
            if (this.started) return;
            this.started = true;
            this.patchHistory();
            window.addEventListener('popstate', () => this.scheduleSync(), { passive: true });
            window.addEventListener('hashchange', () => this.scheduleSync(), { passive: true });
            window.addEventListener('focus', () => {
                this.load();
                this.scheduleSync();
            }, { passive: true });
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    this.load();
                    this.scheduleSync();
                }
            });
        },

        patchHistory() {
            ['pushState', 'replaceState'].forEach((method) => {
                const original = window.history?.[method];
                if (typeof original !== 'function') return;
                const nav = this;
                try {
                    window.history[method] = function patchedHistoryMethod(...args) {
                        const result = original.apply(this, args);
                        nav.scheduleSync();
                        return result;
                    };
                } catch (_) {
                    // 历史 API 只用于同步当前标签高亮，包装失败不影响核心预览能力。
                }
            });
        },

        scheduleSync() {
            if (this.syncTimer) window.clearTimeout(this.syncTimer);
            this.syncTimer = window.setTimeout(() => {
                this.syncTimer = 0;
                this.syncSurfaces();
            }, 120);
        },

        defaultItems() {
            return [
                { title: '首页', href: '/' },
                { title: '最新', href: '/latest' },
                { title: '热门', href: '/top' },
                { title: '新话题', href: '/new' },
                { title: '未读', href: '/unread' },
                { title: '分类', href: '/categories' }
            ].map((item) => this.normalizeItem(item)).filter(Boolean).slice(0, Prefs.value.pageNavLimit);
        },

        normalizeItem(item) {
            const href = this.normalizeHref(item?.href);
            if (!href) return null;
            const id = this.idFromHref(href);
            const now = Date.now();
            return {
                id,
                title: this.cleanTitle(item?.title) || this.titleFromHref(href),
                href,
                at: Number.isFinite(Number(item?.at)) ? Number(item.at) : now,
                updatedAt: Number.isFinite(Number(item?.updatedAt)) ? Number(item.updatedAt) : now
            };
        },

        normalizeHref(raw) {
            const href = Urls.framePreview(raw);
            if (!href) return '';
            try {
                const url = new URL(href, location.origin);
                if (url.origin !== location.origin) return '';
                url.hash = '';
                return url.href;
            } catch (_) {
                return '';
            }
        },

        idFromHref(href) {
            try {
                const url = new URL(href, location.origin);
                return `${url.pathname || '/'}${url.search || ''}`;
            } catch (_) {
                return String(href || '');
            }
        },

        currentId() {
            return this.idFromHref(this.normalizeHref(location.href));
        },

        cleanTitle(value) {
            return Favorites.cleanTitle(value)
                .replace(/^\|+|\|+$/g, '')
                .trim();
        },

        titleFromDocument(href) {
            const title = this.cleanTitle(
                document.querySelector('h1 a.fancy-title, h1 .fancy-title, h1, .topic-title h1')?.textContent ||
                document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                document.title
            );
            return title || this.titleFromHref(href);
        },

        titleFromHref(href) {
            try {
                const url = new URL(href, location.origin);
                const topicId = Urls.topicIdFromHref(url.href);
                if (topicId) return `话题 ${topicId}`;
                const parts = url.pathname.split('/').filter(Boolean).map((part) => {
                    try {
                        return decodeURIComponent(part);
                    } catch (_) {
                        return part;
                    }
                });
                if (!parts.length) return '首页';
                const known = {
                    latest: '最新',
                    new: '新话题',
                    unread: '未读',
                    top: '热门',
                    categories: '分类',
                    c: '分类',
                    u: '用户',
                    search: '搜索'
                };
                return known[parts[0]] || parts.join(' / ');
            } catch (_) {
                return 'LinuxDO 页面';
            }
        },

        currentItem() {
            const href = this.normalizeHref(location.href);
            if (!href) return null;
            return {
                id: this.idFromHref(href),
                title: this.titleFromDocument(href),
                href,
                at: Date.now(),
                updatedAt: Date.now()
            };
        },

        add(item) {
            const nextItem = this.normalizeItem(item);
            if (!nextItem) return { added: false, existing: false, item: null };
            const existing = this.get(nextItem.id);
            const next = {
                ...existing,
                ...nextItem,
                at: existing?.at || nextItem.at,
                updatedAt: Date.now()
            };
            this.items = [next, ...this.items.filter((candidate) => candidate.id !== next.id)].slice(0, Prefs.value.pageNavLimit);
            this.save();
            this.syncSurfaces();
            return { added: !existing, existing: !!existing, item: next };
        },

        addCurrent() {
            const item = this.currentItem();
            if (!item) return null;
            return this.add(item);
        },

        displayHref(href) {
            try {
                const url = new URL(href, location.origin);
                return url.origin === location.origin
                    ? `${url.pathname}${url.search}`
                    : url.href;
            } catch (_) {
                return String(href || '');
            }
        },

        update(id, next) {
            const currentId = String(id || '');
            const current = this.get(currentId);
            if (!current) return { updated: false, item: null, reason: 'missing' };
            const href = this.normalizeHref(next?.href || current.href);
            if (!href) return { updated: false, item: current, reason: 'invalid-url' };
            const item = this.normalizeItem({
                ...current,
                href,
                title: this.cleanTitle(next?.title) || this.titleFromHref(href),
                updatedAt: Date.now()
            });
            if (!item) return { updated: false, item: current, reason: 'invalid-url' };
            const titleChanged = current.title !== item.title;
            const hrefChanged = current.href !== item.href;
            if (!titleChanged && !hrefChanged) return {
                updated: false,
                item: current,
                reason: 'unchanged',
                titleChanged: false,
                hrefChanged: false
            };

            const index = this.items.findIndex((candidate) => candidate.id === currentId);
            const nextItems = this.items.filter((candidate) => candidate.id !== currentId && candidate.id !== item.id);
            nextItems.splice(Math.max(0, index), 0, {
                ...item,
                at: current.at || item.at,
                updatedAt: Date.now()
            });
            this.items = nextItems.slice(0, Prefs.value.pageNavLimit);
            this.save();
            this.syncSurfaces();
            return { updated: true, item: this.get(item.id) || item, titleChanged, hrefChanged };
        },

        editWithPrompt(id) {
            const item = this.get(id);
            if (!item) return { updated: false, item: null, reason: 'missing' };
            const title = window.prompt('修改导航标题（确定后继续修改地址；留空则按地址自动命名）', item.title);
            if (title === null) return { updated: false, item, cancelled: true };
            const href = window.prompt('修改导航地址（支持 /latest 或完整 LinuxDO 链接）', this.displayHref(item.href));
            if (href === null) return { updated: false, item, cancelled: true };
            return this.update(id, { title, href });
        },

        editResultMessage(result) {
            if (result?.updated) {
                if (result.titleChanged && result.hrefChanged) return '已更新导航标题和地址';
                if (result.hrefChanged) return '已更新导航地址';
                return '已更新导航标题';
            }
            if (result?.reason === 'unchanged') return '导航标签未变化';
            return '导航地址无效';
        },

        restoreDefaults() {
            this.items = this.defaultItems();
            this.save();
            this.syncSurfaces();
            return this.items.length;
        },

        syncSurfaces() {
            if (typeof FloatingPrefs !== 'undefined') FloatingPrefs.sync();
            if (typeof Drawer !== 'undefined') Drawer.renderSidebar();
        },

        trimToLimit() {
            const next = this.items.slice(0, Prefs.value.pageNavLimit);
            if (next.length === this.items.length) return;
            this.items = next;
            this.save();
            this.syncSurfaces();
        },

        get(id) {
            const value = String(id || '');
            return this.items.find((item) => item.id === value) || null;
        },

        isCurrent(itemOrId) {
            const id = typeof itemOrId === 'object' ? itemOrId?.id : itemOrId;
            return String(id || '') === this.currentId();
        },

        neighbor(id) {
            const index = this.items.findIndex((item) => item.id === String(id || ''));
            if (index < 0) return null;
            return this.items[index + 1] || this.items[index - 1] || null;
        },

        open(id, options = {}) {
            const item = this.get(id);
            if (!item) return false;
            if (options.newTab) {
                const opened = window.open(item.href, '_blank', 'noopener,noreferrer');
                if (opened) opened.opener = null;
                return true;
            }
            if (this.isCurrent(item)) {
                showToast('已在当前页面');
                return true;
            }
            window.location.assign(item.href);
            return true;
        },

        remove(id) {
            const value = String(id || '');
            const length = this.items.length;
            this.items = this.items.filter((item) => item.id !== value);
            if (this.items.length === length) return false;
            this.save();
            this.syncSurfaces();
            return true;
        },

        clear() {
            if (!this.items.length) return false;
            this.items = [];
            this.save();
            this.syncSurfaces();
            return true;
        }
    };

    // 保存可配置数量的预览过话题。“已读”表示被脚本预览过；
    // “话题已生效”只表示曾观察到 new-topic 小蓝点，并且该小蓝点之后消失了。
    const ReadMemory = {
        items: [],
        revision: 0,

        load() {
            let raw = null;
            try {
                raw = typeof GM_getValue === 'function'
                    ? GM_getValue(MEMORY_KEY, null)
                    : window.localStorage.getItem(MEMORY_KEY);
            } catch (_) {
                raw = null;
            }

            try {
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                this.items = Array.isArray(parsed)
                    ? parsed.map((item) => this.normalizeItem(item)).filter(Boolean).slice(0, Prefs.value.memoryLimit)
                    : [];
            } catch (_) {
                this.items = [];
            }
            this.touch();
            return this.items;
        },

        save() {
            const payload = JSON.stringify(this.items.slice(0, Prefs.value.memoryLimit));
            try {
                if (typeof GM_setValue === 'function') {
                    GM_setValue(MEMORY_KEY, payload);
                } else {
                    window.localStorage.setItem(MEMORY_KEY, payload);
                }
            } catch (error) {
                console.warn(`${LOG_PREFIX} 阅读记忆保存失败`, error);
            }
            this.touch();
        },

        touch() {
            this.revision += 1;
        },

        normalizeItem(item) {
            const id = String(item?.id || '');
            if (!id) return null;
            return {
                id,
                title: Favorites.cleanTitle(item?.title) || `话题 ${id}`,
                href: Urls.framePreview(item?.href) || Urls.absolute(Urls.canonicalTopic(id)),
                at: Number.isFinite(Number(item?.at)) ? Number(item.at) : Date.now(),
                readAt: Number.isFinite(Number(item?.readAt)) ? Number(item.readAt) : Date.now(),
                trackedNewTopic: item?.trackedNewTopic === true,
                effective: item?.effective === true,
                effectiveAt: Number.isFinite(Number(item?.effectiveAt)) ? Number(item.effectiveAt) : undefined
            };
        },

        remember(topicId, sourceAnchor = null, sourceHref = '', title = '', options = {}) {
            const id = String(topicId || '');
            if (!id) return null;

            const existing = this.items.find((item) => item.id === id);
            const sourceRow = sourceAnchor instanceof Element ? TopicBadges.topicRow(sourceAnchor) : null;
            const hasNewTopicBadge = TopicBadges.hasNewTopicBadge(id, sourceRow);
            const next = {
                id,
                title: Favorites.bestTitle(id, title, sourceAnchor, existing?.title),
                href: Favorites.hrefFrom(id, sourceAnchor, sourceHref || existing?.href || ''),
                at: Date.now(),
                readAt: Date.now(),
                trackedNewTopic: existing?.trackedNewTopic === true || hasNewTopicBadge,
                effective: existing?.effective === true && existing?.trackedNewTopic === true && !hasNewTopicBadge,
                effectiveAt: existing?.effective === true && !hasNewTopicBadge ? existing?.effectiveAt : undefined
            };
            if (options.preserveOrder && existing) {
                this.items = this.items
                    .map((item) => (item.id === id ? next : item))
                    .slice(0, Prefs.value.memoryLimit);
            } else {
                this.items = [next, ...this.items.filter((item) => item.id !== id)].slice(0, Prefs.value.memoryLimit);
            }
            this.save();
            TopicBadges.start();
            TopicBadges.refreshTopic(id, sourceAnchor);
            if (next.trackedNewTopic && !next.effective) TopicBadges.watchEffect(id);
            return next;
        },

        updateMeta(topicId, sourceAnchor = null, sourceHref = '', title = '') {
            const id = String(topicId || '');
            const index = this.items.findIndex((item) => item.id === id);
            if (index < 0) return;
            const nextTitle = Favorites.bestTitle(id, title, sourceAnchor, this.items[index].title);
            const nextHref = Favorites.hrefFrom(id, sourceAnchor, sourceHref || this.items[index].href || '');
            if (this.items[index].title === nextTitle && this.items[index].href === nextHref) return;
            this.items[index] = { ...this.items[index], title: nextTitle, href: nextHref };
            this.save();
        },

        clear() {
            this.items = [];
            this.save();
            TopicBadges.refresh();
        },

        clearOlderThan(days) {
            const cutoff = Date.now() - Math.max(1, Number(days) || 1) * 24 * 60 * 60 * 1000;
            const before = this.items.length;
            this.items = this.items.filter((item) => {
                const readAt = Number(item.readAt || item.at);
                return Number.isFinite(readAt) && readAt >= cutoff;
            });
            const removed = before - this.items.length;
            if (removed) {
                this.save();
                TopicBadges.refresh();
            }
            return removed;
        },

        trimToLimit() {
            const next = this.items.slice(0, Prefs.value.memoryLimit);
            if (next.length === this.items.length) return false;
            this.items = next;
            this.save();
            TopicBadges.refresh();
            return true;
        },

        markTrackedNewTopic(topicId) {
            const id = String(topicId || '');
            if (!id) return;

            let changed = false;
            this.items = this.items.map((item) => {
                if (item.id !== id || item.trackedNewTopic) return item;
                changed = true;
                return { ...item, trackedNewTopic: true };
            });
            if (changed) this.save();
        },

        markEffective(topicId) {
            const id = String(topicId || '');
            if (!id) return;

            let changed = false;
            this.items = this.items.map((item) => {
                if (item.id !== id || item.effective) return item;
                changed = true;
                return { ...item, effective: true, effectiveAt: Date.now() };
            });
            if (changed) this.save();
        },

        get(topicId) {
            const id = String(topicId || '');
            return this.items.find((item) => item.id === id) || null;
        },

        has(topicId) {
            return !!this.get(topicId);
        }
    };

    const DrawerState = {
        value: null,

        load() {
            let raw = null;
            try {
                raw = typeof GM_getValue === 'function'
                    ? GM_getValue(DRAWER_STATE_KEY, null)
                    : window.localStorage.getItem(DRAWER_STATE_KEY);
            } catch (_) {
                raw = null;
            }

            try {
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                this.value = this.normalize(parsed);
            } catch (_) {
                this.value = null;
            }
            return this.value;
        },

        save(next) {
            const sameTopic = this.value?.topicId && this.value.topicId === String(next?.topicId || '');
            const base = sameTopic ? this.value : {};
            const normalized = this.normalize({ ...base, ...next, updatedAt: Date.now() });
            if (!normalized) return null;
            this.value = normalized;
            try {
                const payload = JSON.stringify(normalized);
                if (typeof GM_setValue === 'function') {
                    GM_setValue(DRAWER_STATE_KEY, payload);
                } else {
                    window.localStorage.setItem(DRAWER_STATE_KEY, payload);
                }
            } catch (error) {
                console.warn(`${LOG_PREFIX} 抽屉状态保存失败`, error);
            }
            return this.value;
        },

        clear() {
            this.value = null;
            try {
                if (typeof GM_setValue === 'function') {
                    GM_setValue(DRAWER_STATE_KEY, '');
                } else {
                    window.localStorage.removeItem(DRAWER_STATE_KEY);
                }
            } catch (_) {
                // 清理失败不影响当前会话。
            }
        },

        normalize(raw) {
            const source = raw && typeof raw === 'object' ? raw : null;
            const topicId = String(source?.topicId || '');
            if (!topicId) return null;
            const history = Array.isArray(source.frameHistory)
                ? source.frameHistory.map((href) => Urls.framePreview(href)).filter(Boolean).slice(-Prefs.value.frameHistoryLimit)
                : [];
            const index = Prefs.numberInRange(source.frameHistoryIndex, Math.max(0, history.length - 1), 0, Math.max(0, history.length - 1));
            const frameUrl = Urls.framePreview(source.frameUrl) || history[index] || '';

            return {
                topicId,
                title: Favorites.cleanTitle(source.title) || `话题 ${topicId}`,
                sourceHref: Urls.framePreview(source.sourceHref) || Urls.absolute(Urls.canonicalTopic(topicId)),
                mode: Prefs.mode(source.mode),
                frameUrl,
                frameHistory: history,
                frameHistoryIndex: index,
                updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : Date.now()
            };
        }
    };

    // 同步话题标题旁的状态标记。滚动时不做全量扫描，只处理新增话题行。
    const TopicBadges = {
        started: false,
        refreshTimer: 0,
        observer: null,
        pendingAnchors: new Set(),
        pendingTimer: 0,
        pendingBatchSize: 80,
        newTopicIds: new Set(),
        newTopicIndexReady: false,
        watchingTopics: new Set(),

        start() {
            if (this.started) return;
            this.started = true;
            this.refresh();
            window.addEventListener('focus', () => this.schedule(), { passive: true });
            window.addEventListener('pageshow', () => this.schedule(), { passive: true });
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) this.schedule();
            });
            this.observeMutations();
        },

        schedule() {
            if (this.refreshTimer) return;
            this.refreshTimer = window.setTimeout(() => {
                this.refreshTimer = 0;
                this.refresh();
            }, Prefs.value.badgeRefreshDelay);
        },

        observeMutations() {
            if (this.observer || typeof MutationObserver !== 'function' || !document.body) return;
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => this.enqueueNode(node));
                });
                this.schedulePending();
            });
            this.observer.observe(document.body, { childList: true, subtree: true });
        },

        enqueueNode(node) {
            if (!(node instanceof Element) || Dom.isOwnSurface(node)) return;
            if (node.matches?.(BADGE_ANCHOR_QUERY)) this.pendingAnchors.add(node);
            node.querySelectorAll?.(BADGE_ANCHOR_QUERY).forEach((anchor) => {
                if (!Dom.isOwnSurface(anchor)) this.pendingAnchors.add(anchor);
            });
        },

        schedulePending(delay = Math.max(80, Prefs.value.badgeRefreshDelay)) {
            if (!this.pendingAnchors.size || this.pendingTimer) return;
            this.pendingTimer = window.setTimeout(() => {
                this.pendingTimer = 0;
                this.flushPending();
            }, delay);
        },

        flushPending() {
            if (!this.pendingAnchors.size) return;
            const anchors = [];
            for (const anchor of this.pendingAnchors) {
                this.pendingAnchors.delete(anchor);
                anchors.push(anchor);
                if (anchors.length >= this.pendingBatchSize) break;
            }
            this.refreshAnchors(anchors);
            if (this.pendingAnchors.size) this.schedulePending(16);
        },

        refresh() {
            this.refreshAnchors(this.topicAnchors(), { cleanup: true });
        },

        refreshAnchors(anchors, options = {}) {
            if (options.cleanup) this.removeMisplacedBadges();
            const context = this.refreshContext();
            const seenAnchors = new Set();
            anchors.forEach((anchor) => {
                if (!(anchor instanceof Element) || !anchor.isConnected || Dom.isOwnSurface(anchor) || seenAnchors.has(anchor)) return;
                seenAnchors.add(anchor);
                this.refreshAnchor(anchor, context);
            });
            if (options.cleanup && !ReadMemory.items.length) {
                this.clearAllDecorations();
            }
        },

        refreshContext() {
            return {
                memoryById: new Map(ReadMemory.items.map((item) => [item.id, item])),
                keywordTerms: KeywordRules.preparedTerms(),
                similarCandidates: SimilarTopics.candidates()
            };
        },

        topicAnchors(root = document) {
            return Array.from(root.querySelectorAll?.(BADGE_ANCHOR_QUERY) || [])
                .filter((anchor) => !Dom.isOwnSurface(anchor));
        },

        refreshTopic(topicId, sourceAnchor = null) {
            const id = String(topicId || '');
            if (!id) return;
            const anchor = this.badgeAnchorFor(sourceAnchor, id, { localOnly: !!sourceAnchor }) || this.findAnchor(id);
            if (anchor) this.refreshAnchor(anchor);
        },

        clearAllDecorations() {
            document.querySelectorAll(`.${NAME}-read-badge, .${NAME}-effective-badge`).forEach((badge) => badge.remove());
        },

        refreshAnchor(anchor, context = null) {
            if (!(anchor instanceof Element) || !anchor.isConnected) return;
            const topicId = Urls.topicIdFromHref(anchor.getAttribute('href'));
            if (!topicId) return;
            const badgeAnchor = this.badgeAnchorFor(anchor, topicId, { localOnly: true });
            if (!badgeAnchor) return;
            const refreshContext = context || this.refreshContext();
            CategoryMarks.refreshAnchor(badgeAnchor);
            KeywordRules.refreshAnchor(badgeAnchor, refreshContext.keywordTerms);
            TopicDates.refreshAnchor(badgeAnchor);
            SimilarTopics.refreshAnchor(badgeAnchor, refreshContext.similarCandidates);
            const memory = refreshContext.memoryById?.get(topicId) || null;
            if (memory) {
                this.decorate(badgeAnchor, topicId, memory);
                return;
            }
            this.removeReadBadge(badgeAnchor);
            this.syncEffectiveBadge(badgeAnchor, null, false);
        },

        rebuildNewTopicIndex() {
            this.newTopicIds = new Set();
            document.querySelectorAll(this.newTopicSelector()).forEach((badge) => {
                if (badge.closest(`#${NAME}-drawer, #${NAME}-eye`)) return;
                if (badge.getAttribute('title') !== '新话题') return;
                const topicId = Urls.topicIdFromHref(badge.getAttribute('href'));
                if (topicId) this.newTopicIds.add(topicId);
            });
            this.newTopicIndexReady = true;
        },

        decorate(anchor, topicId, memory) {
            if (!anchor.matches(BADGE_ANCHOR_QUERY)) return;
            const row = this.topicRow(anchor);
            const hasNewTopicBadge = this.hasNewTopicBadge(topicId, row);
            if (hasNewTopicBadge && !memory.trackedNewTopic) {
                ReadMemory.markTrackedNewTopic(topicId);
                memory = ReadMemory.get(topicId) || memory;
            }

            const trackedNewTopic = memory.trackedNewTopic === true;
            const effective = trackedNewTopic && (memory.effective || !hasNewTopicBadge);
            if (effective && !memory.effective) {
                ReadMemory.markEffective(topicId);
                memory = ReadMemory.get(topicId) || memory;
            }

            const readBadge = Prefs.value.showReadBadges ? this.ensureReadBadge(anchor) : null;
            if (readBadge) readBadge.title = '脚本已记录该话题已预览';
            else this.removeReadBadge(anchor);
            this.syncEffectiveBadge(anchor, readBadge, effective && Prefs.value.showEffectiveBadges);
        },

        ensureReadBadge(anchor) {
            const existing = anchor.nextElementSibling?.classList?.contains(`${NAME}-read-badge`)
                ? anchor.nextElementSibling
                : null;
            if (existing) {
                existing.classList.remove('is-effective');
                if (existing.textContent !== '已读') existing.textContent = '已读';
                return existing;
            }

            const badge = Dom.make('span', { className: `${NAME}-read-badge`, text: '已读' });
            const effectiveBadge = anchor.nextElementSibling?.classList?.contains(`${NAME}-effective-badge`)
                ? anchor.nextElementSibling
                : null;
            if (effectiveBadge) anchor.parentNode.insertBefore(badge, effectiveBadge);
            else anchor.insertAdjacentElement('afterend', badge);
            return badge;
        },

        removeReadBadge(anchor) {
            const badge = anchor.nextElementSibling?.classList?.contains(`${NAME}-read-badge`)
                ? anchor.nextElementSibling
                : null;
            badge?.remove();
        },

        badgeAnchorFor(anchor, topicId, options = {}) {
            const id = String(topicId || '');
            if (!id || !(anchor instanceof Element)) return null;
            if (anchor.matches(BADGE_ANCHOR_QUERY) && Urls.topicIdFromHref(anchor.getAttribute('href')) === id) {
                return anchor;
            }

            const row = this.topicRow(anchor);
            const rowAnchor = Array.from(row?.querySelectorAll?.(BADGE_ANCHOR_QUERY) || []).find((candidate) => {
                return Urls.topicIdFromHref(candidate.getAttribute('href')) === id;
            });
            if (rowAnchor) return rowAnchor;

            if (options.localOnly) return null;
            return Array.from(document.querySelectorAll(BADGE_ANCHOR_QUERY)).find((candidate) => {
                if (Dom.isOwnSurface(candidate)) return false;
                return Urls.topicIdFromHref(candidate.getAttribute('href')) === id;
            }) || null;
        },

        findAnchor(topicId) {
            const id = String(topicId || '');
            if (!id) return null;
            return Array.from(document.querySelectorAll(BADGE_ANCHOR_QUERY)).find((anchor) => {
                if (Dom.isOwnSurface(anchor)) return false;
                return Urls.topicIdFromHref(anchor.getAttribute('href')) === id;
            }) || null;
        },

        removeMisplacedBadges() {
            document.querySelectorAll(`.${NAME}-read-badge`).forEach((badge) => {
                const anchor = badge.previousElementSibling;
                if (Prefs.value.showReadBadges && anchor?.matches?.(BADGE_ANCHOR_QUERY)) return;
                badge.remove();
            });

            document.querySelectorAll(`.${NAME}-effective-badge`).forEach((badge) => {
                const previous = badge.previousElementSibling;
                const anchor = previous?.classList?.contains(`${NAME}-read-badge`)
                    ? previous.previousElementSibling
                    : previous;
                if (Prefs.value.showEffectiveBadges && anchor?.matches?.(BADGE_ANCHOR_QUERY)) return;
                badge.remove();
            });
        },

        syncEffectiveBadge(anchor, readBadge, effective) {
            const target = readBadge || anchor;
            const existing = target.nextElementSibling?.classList?.contains(`${NAME}-effective-badge`)
                ? target.nextElementSibling
                : anchor.nextElementSibling?.classList?.contains(`${NAME}-effective-badge`)
                    ? anchor.nextElementSibling
                    : null;

            if (!effective) {
                existing?.remove();
                return;
            }

            const badge = existing || Dom.make('span', {
                className: `${NAME}-effective-badge`,
                text: '话题已生效',
                title: '预览时存在 new-topic 小蓝点，现已消失'
            });
            badge.title = '预览时存在 new-topic 小蓝点，现已消失';
            if (!existing) target.insertAdjacentElement('afterend', badge);
            else if (existing.previousElementSibling !== target) target.insertAdjacentElement('afterend', existing);
        },

        topicRow(anchor) {
            return anchor.closest([
                'tr.topic-list-item',
                '.topic-list-item',
                '.latest-topic-list-item',
                '.search-result-topic',
                '.fps-result',
                '.suggested-topics-list-item',
                'li',
                'article'
            ].join(',')) || anchor.parentElement;
        },

        hasNewTopicBadge(topicId, row) {
            const id = String(topicId || '');
            if (!id) return false;

            if (row && this.scopeHasNewTopicBadge(row, id)) return true;
            return this.newTopicIds.has(id);
        },

        scopeHasNewTopicBadge(scope, topicId) {
            return Array.from(scope.querySelectorAll?.(this.newTopicSelector()) || []).some((badge) => {
                if (badge.closest(`#${NAME}-drawer, #${NAME}-eye`)) return false;
                return badge.getAttribute('title') === '新话题' &&
                    Urls.topicIdFromHref(badge.getAttribute('href')) === String(topicId);
            });
        },

        newTopicSelector() {
            return 'a.badge.badge-notification.new-topic[title="新话题"][href*="/t/"]';
        },

        watchEffect(topicId) {
            const id = String(topicId || '');
            if (!id || this.watchingTopics.has(id)) return;
            this.watchingTopics.add(id);
            let left = 12;
            const tick = () => {
                this.refreshTopic(id);
                if (ReadMemory.get(id)?.effective) {
                    Drawer.syncTopicStatus();
                    this.watchingTopics.delete(id);
                    return;
                }
                left -= 1;
                if (left > 0) {
                    window.setTimeout(tick, 1000);
                } else {
                    this.watchingTopics.delete(id);
                }
            };
            window.setTimeout(tick, 1000);
        }
    };

    // 将列表右侧活动列里的创建/更新时间提前显示到话题标题旁边。
    const TopicDates = {
        dateFormatter: null,

        refresh() {
            this.clearOrphans();
            document.querySelectorAll(BADGE_ANCHOR_QUERY).forEach((anchor) => {
                if (Dom.isOwnSurface(anchor)) return;
                this.decorate(anchor);
            });
        },

        refreshAnchor(anchor) {
            if (!anchor?.matches?.(BADGE_ANCHOR_QUERY) || Dom.isOwnSurface(anchor)) return;
            this.decorate(anchor);
        },

        clearOrphans() {
            document.querySelectorAll(`.${NAME}-date-badge`).forEach((badge) => {
                if (this.anchorForBadge(badge)) return;
                badge.remove();
            });
        },

        clearAnchor(anchor) {
            this.badgeFor(anchor)?.remove();
        },

        decorate(anchor) {
            const info = this.info(anchor);
            if (!info) {
                this.clearAnchor(anchor);
                return;
            }

            const badge = this.ensureBadge(anchor);
            if (!badge) return;
            badge.textContent = info.text;
            badge.title = info.title;
        },

        info(anchor) {
            const row = TopicBadges.topicRow(anchor);
            if (!row) return null;
            const topicId = Urls.topicIdFromHref(anchor.getAttribute('href'));
            const activity = this.activityCell(row, topicId);
            if (!activity) return null;

            const created = this.createdInfo(activity);
            const updated = this.updatedInfo(activity);
            const textParts = [];
            const titleParts = [];
            if (created?.short) textParts.push(`创 ${created.short}`);
            if (updated?.short) textParts.push(`更 ${updated.short}`);
            if (created?.full) titleParts.push(`创建日期：${created.full}`);
            if (updated?.full) titleParts.push(`更新日期：${updated.full}`);
            if (!textParts.length) return null;

            return {
                text: textParts.join(' · '),
                title: titleParts.join('；') || textParts.join(' · ')
            };
        },

        activityCell(row, topicId) {
            const cells = Array.from(row.querySelectorAll([
                'td.activity.topic-list-data.age',
                'td.topic-list-data.age',
                '.activity.topic-list-data.age',
                '.topic-list-data.age'
            ].join(',')));
            if (!cells.length) return null;
            const id = String(topicId || '');
            if (!id) return cells[0];
            return cells.find((cell) => {
                const href = cell.querySelector('a.post-activity[href], a[href*="/t/"]')?.getAttribute('href');
                return Urls.topicIdFromHref(href) === id;
            }) || cells[0];
        },

        createdInfo(activity) {
            const title = String(activity.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
            if (!title) return null;
            const raw = this.extractTitleValue(title, '创建日期') || title;
            return this.compactDateText(raw);
        },

        updatedInfo(activity) {
            const dateNode = activity.querySelector('.relative-date[data-time], [data-time], time[datetime]');
            const timestamp = dateNode?.getAttribute?.('data-time');
            const fromTimestamp = this.formatTimestamp(timestamp);
            if (fromTimestamp) return fromTimestamp;

            const dateTime = dateNode?.getAttribute?.('datetime');
            const fromDateTime = this.formatTimestamp(Date.parse(dateTime));
            if (fromDateTime) return fromDateTime;

            const title = String(dateNode?.getAttribute?.('title') || '').replace(/\s+/g, ' ').trim();
            const fromTitle = this.compactDateText(title);
            if (fromTitle) return fromTitle;

            const text = String(dateNode?.textContent || '').replace(/\s+/g, ' ').trim();
            return text ? { short: text, full: text } : null;
        },

        extractTitleValue(title, label) {
            const match = String(title || '').match(new RegExp(`${label}\\s*[:：]\\s*([^；;]+)`));
            return match?.[1]?.trim() || '';
        },

        compactDateText(value) {
            const text = String(value || '').replace(/\s+/g, ' ').trim();
            if (!text) return null;
            const normalized = text.replace(/^创建日期\s*[:：]\s*/, '').replace(/^更新日期\s*[:：]\s*/, '').trim();
            const chinese = normalized.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*(\d{1,2})\s*[:：]\s*(\d{2})/);
            if (chinese) {
                const [, year, month, day, hour, minute] = chinese;
                return {
                    short: `${this.pad(month)}-${this.pad(day)} ${this.pad(hour)}:${minute}`,
                    full: `${year}-${this.pad(month)}-${this.pad(day)} ${this.pad(hour)}:${minute}`
                };
            }

            const numeric = normalized.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2})\s*[:：]\s*(\d{2})/);
            if (numeric) {
                const [, year, month, day, hour, minute] = numeric;
                return {
                    short: `${this.pad(month)}-${this.pad(day)} ${this.pad(hour)}:${minute}`,
                    full: `${year}-${this.pad(month)}-${this.pad(day)} ${this.pad(hour)}:${minute}`
                };
            }

            return { short: normalized, full: normalized };
        },

        formatTimestamp(value) {
            const raw = Number(value);
            if (!Number.isFinite(raw) || raw <= 0) return null;
            const date = new Date(raw < 1e12 ? raw * 1000 : raw);
            if (Number.isNaN(date.getTime())) return null;
            const parts = {};
            this.datePartsFormatter().formatToParts(date).forEach((part) => {
                if (part.type !== 'literal') parts[part.type] = part.value;
            });
            if (!parts.year || !parts.month || !parts.day || !parts.hour || !parts.minute) return null;
            return {
                short: `${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`,
                full: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
            };
        },

        datePartsFormatter() {
            if (!this.dateFormatter) {
                this.dateFormatter = new Intl.DateTimeFormat('zh-CN', {
                    timeZone: 'Asia/Shanghai',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
            }
            return this.dateFormatter;
        },

        ensureBadge(anchor) {
            let target = anchor;
            let current = anchor.nextElementSibling;
            let existing = null;
            while (current && this.isTopicBadge(current)) {
                if (current.classList.contains(`${NAME}-date-badge`)) {
                    existing = current;
                    break;
                }
                target = current;
                current = current.nextElementSibling;
            }

            const badge = existing || Dom.make('span', { className: `${NAME}-date-badge` });
            if (!existing || existing.previousElementSibling !== target) {
                target.insertAdjacentElement('afterend', badge);
            }
            return badge;
        },

        badgeFor(anchor) {
            let current = anchor?.nextElementSibling;
            while (current && this.isTopicBadge(current)) {
                if (current.classList.contains(`${NAME}-date-badge`)) return current;
                current = current.nextElementSibling;
            }
            return null;
        },

        anchorForBadge(badge) {
            let current = badge?.previousElementSibling;
            while (current && this.isTopicBadge(current)) {
                current = current.previousElementSibling;
            }
            return current?.matches?.(BADGE_ANCHOR_QUERY) ? current : null;
        },

        isTopicBadge(element) {
            return !!element?.classList && [
                `${NAME}-read-badge`,
                `${NAME}-effective-badge`,
                `${NAME}-last-viewed-badge`,
                `${NAME}-keyword-badge`,
                `${NAME}-date-badge`,
                `${NAME}-similar-badge`
            ].some((className) => element.classList.contains(className));
        },

        pad(value) {
            return String(value).padStart(2, '0');
        }
    };

    // 按标题相似度提示最近看过的近似话题，全部基于本地阅读记忆。
    const SimilarTopics = {
        threshold: 0.58,
        maxCandidates: 500,
        maxMatches: 2,
        candidateCache: null,
        candidateCacheKey: '',
        candidateIndex: null,

        invalidate() {
            this.candidateCache = null;
            this.candidateCacheKey = '';
            this.candidateIndex = null;
        },

        refresh() {
            const candidates = this.candidates();
            if (!candidates.length) {
                this.clear();
                return;
            }

            this.clearOrphans();
            document.querySelectorAll(BADGE_ANCHOR_QUERY).forEach((anchor) => {
                if (Dom.isOwnSurface(anchor)) return;
                this.decorate(anchor, candidates);
            });
        },

        refreshAnchor(anchor, preparedCandidates = null) {
            if (!anchor?.matches?.(BADGE_ANCHOR_QUERY) || Dom.isOwnSurface(anchor)) return;
            const candidates = preparedCandidates || this.candidates();
            if (!candidates.length) {
                this.clearAnchor(anchor);
                return;
            }
            this.decorate(anchor, candidates);
        },

        candidates() {
            const cacheKey = this.cacheKey();
            if (this.candidateCache && this.candidateCacheKey === cacheKey) return this.candidateCache;

            const candidates = ReadMemory.items
                .slice(0, Math.min(this.maxCandidates, Prefs.value.memoryLimit))
                .map((item) => {
                    const normalized = this.normalizeTitle(item.title);
                    const tokens = this.tokens(normalized);
                    if (tokens.size < 2) return null;
                    return { item, normalized, tokens };
                })
                .filter(Boolean);
            this.candidateCache = candidates;
            this.candidateCacheKey = cacheKey;
            this.candidateIndex = this.indexCandidates(candidates);
            return candidates;
        },

        cacheKey() {
            return [
                ReadMemory.revision,
                Math.min(this.maxCandidates, Prefs.value.memoryLimit),
                this.maxCandidates
            ].join(':');
        },

        indexCandidates(candidates) {
            const index = new Map();
            candidates.forEach((candidate) => {
                candidate.tokens.forEach((token) => {
                    const bucket = index.get(token) || [];
                    bucket.push(candidate);
                    index.set(token, bucket);
                });
            });
            return index;
        },

        candidatePool(current, candidates) {
            if (!this.candidateIndex || !current?.tokens?.size) return candidates;
            const seen = new Set();
            const pool = [];
            current.tokens.forEach((token) => {
                const bucket = this.candidateIndex.get(token);
                if (!bucket) return;
                bucket.forEach((candidate) => {
                    if (seen.has(candidate.item.id)) return;
                    seen.add(candidate.item.id);
                    pool.push(candidate);
                });
            });
            return pool;
        },

        decorate(anchor, candidates) {
            const current = this.currentTopic(anchor);
            if (!current?.normalized || current.tokens.size < 2 || !candidates.length) {
                this.clearAnchor(anchor);
                return;
            }

            const matches = this.candidatePool(current, candidates)
                .filter((candidate) => candidate.item.id !== current.id)
                .map((candidate) => ({
                    ...candidate,
                    score: this.score(current, candidate)
                }))
                .filter((candidate) => candidate.score >= this.threshold)
                .sort((a, b) => b.score - a.score || b.item.readAt - a.item.readAt)
                .slice(0, this.maxMatches);

            if (!matches.length) {
                this.clearAnchor(anchor);
                return;
            }

            const badge = this.ensureBadge(anchor);
            if (!badge) return;
            const best = matches[0];
            badge.textContent = matches.length > 1 ? `相似 ${matches.length}` : '相似';
            badge.title = [
                `可能重复：${Math.round(best.score * 100)}%`,
                ...matches.map((match, index) => `${index + 1}. ${match.item.title}`)
            ].join('\n');
            badge.dataset.similarTopicId = best.item.id;
            badge.dataset.similarScore = String(Math.round(best.score * 100));
        },

        currentTopic(anchor) {
            const title = Favorites.cleanTitle(Favorites.titleFromAnchor(anchor, Urls.topicIdFromHref(anchor.getAttribute('href'))));
            const normalized = this.normalizeTitle(title);
            return {
                id: Urls.topicIdFromHref(anchor.getAttribute('href')),
                normalized,
                tokens: this.tokens(normalized)
            };
        },

        score(current, candidate) {
            if (!current.normalized || !candidate.normalized) return 0;
            if (current.normalized === candidate.normalized) return 1;

            const dice = this.dice(current.tokens, candidate.tokens);
            const shorter = current.normalized.length <= candidate.normalized.length ? current.normalized : candidate.normalized;
            const longer = current.normalized.length > candidate.normalized.length ? current.normalized : candidate.normalized;
            const containsBoost = shorter.length >= 8 && longer.includes(shorter) ? 0.86 : 0;
            return Math.max(dice, containsBoost);
        },

        dice(a, b) {
            if (!a.size || !b.size) return 0;
            let intersection = 0;
            a.forEach((token) => {
                if (b.has(token)) intersection += 1;
            });
            return (2 * intersection) / (a.size + b.size);
        },

        normalizeTitle(title) {
            return String(title || '')
                .toLowerCase()
                .normalize('NFKC')
                .replace(/https?:\/\/\S+/g, ' ')
                .replace(/[^\p{Script=Han}\p{Letter}\p{Number}]+/gu, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        },

        tokens(normalized) {
            const tokens = new Set();
            const words = String(normalized || '').match(/[\p{Letter}\p{Number}]+/gu) || [];
            words.forEach((word) => {
                if (/^[\p{Script=Han}]+$/u.test(word)) {
                    if (word.length === 1) {
                        tokens.add(word);
                        return;
                    }
                    for (let index = 0; index < word.length - 1; index += 1) {
                        tokens.add(word.slice(index, index + 2));
                    }
                    return;
                }
                if (word.length >= 2) tokens.add(word);
            });
            return tokens;
        },

        ensureBadge(anchor) {
            let target = anchor;
            let current = anchor.nextElementSibling;
            let existing = null;
            while (current && this.isTopicBadge(current)) {
                if (current.classList.contains(`${NAME}-similar-badge`)) {
                    existing = current;
                    break;
                }
                target = current;
                current = current.nextElementSibling;
            }

            const badge = existing || Dom.make('span', { className: `${NAME}-similar-badge` });
            if (!existing || existing.previousElementSibling !== target) {
                target.insertAdjacentElement('afterend', badge);
            }
            return badge;
        },

        clear() {
            document.querySelectorAll(`.${NAME}-similar-badge`).forEach((badge) => badge.remove());
        },

        clearOrphans() {
            document.querySelectorAll(`.${NAME}-similar-badge`).forEach((badge) => {
                if (this.anchorForBadge(badge)) return;
                badge.remove();
            });
        },

        clearAnchor(anchor) {
            this.badgeFor(anchor)?.remove();
        },

        badgeFor(anchor) {
            let current = anchor?.nextElementSibling;
            while (current && this.isTopicBadge(current)) {
                if (current.classList.contains(`${NAME}-similar-badge`)) return current;
                current = current.nextElementSibling;
            }
            return null;
        },

        anchorForBadge(badge) {
            let current = badge?.previousElementSibling;
            while (current && this.isTopicBadge(current)) {
                current = current.previousElementSibling;
            }
            return current?.matches?.(BADGE_ANCHOR_QUERY) ? current : null;
        },

        isTopicBadge(element) {
            return !!element?.classList && [
                `${NAME}-read-badge`,
                `${NAME}-effective-badge`,
                `${NAME}-last-viewed-badge`,
                `${NAME}-keyword-badge`,
                `${NAME}-date-badge`,
                `${NAME}-similar-badge`
            ].some((className) => element.classList.contains(className));
        }
    };

    // 给不同分类补充稳定的本地颜色提示；优先复用 Discourse 自带分类颜色。
    const CategoryMarks = {
        palette: ['#4f7bd9', '#2f9e89', '#c47a24', '#8b6ed8', '#d85c7a', '#4a9fcf', '#7d9a2e', '#c65f3d'],

        refresh() {
            this.clear();
            if (!Prefs.value.showCategoryColors) return;
            document.querySelectorAll(BADGE_ANCHOR_QUERY).forEach((anchor) => {
                if (Dom.isOwnSurface(anchor)) return;
                this.decorate(anchor);
            });
        },

        refreshAnchor(anchor) {
            if (!anchor?.matches?.(BADGE_ANCHOR_QUERY) || Dom.isOwnSurface(anchor)) return;
            this.clearAnchor(anchor);
            if (Prefs.value.showCategoryColors) this.decorate(anchor);
        },

        clear() {
            document.querySelectorAll(`.${NAME}-category-marked`).forEach((element) => {
                element.classList.remove(`${NAME}-category-marked`);
                element.style.removeProperty('--ldpeek-category-color');
                element.removeAttribute('data-category-name');
            });
        },

        clearAnchor(anchor) {
            const row = TopicBadges.topicRow(anchor) || anchor;
            row.classList.remove(`${NAME}-category-marked`);
            row.style.removeProperty('--ldpeek-category-color');
            row.removeAttribute('data-category-name');
        },

        decorate(anchor) {
            const info = this.categoryInfo(anchor);
            if (!info?.name) return;
            const row = TopicBadges.topicRow(anchor) || anchor;
            const color = info.color || this.colorFor(info.name);
            row.classList.add(`${NAME}-category-marked`);
            row.style.setProperty('--ldpeek-category-color', color);
            row.dataset.categoryName = info.name;
        },

        categoryInfo(anchor) {
            const row = TopicBadges.topicRow(anchor);
            if (!row) return null;
            const node = row.querySelector([
                '.badge-category__wrapper',
                '.badge-category',
                '.topic-category',
                'a[href^="/c/"]',
                'a[href*="/c/"]'
            ].join(','));
            if (!node || node.contains(anchor)) return null;

            const nameNode = node.querySelector?.('.badge-category__name, .category-name') || node;
            const name = String(nameNode?.textContent || node.getAttribute?.('title') || node.getAttribute?.('aria-label') || '')
                .replace(/\s+/g, ' ')
                .trim();
            if (!name) return null;

            return { name, color: this.colorFromNode(node) };
        },

        colorFromNode(node) {
            const style = window.getComputedStyle?.(node);
            const candidates = [
                node.style?.getPropertyValue?.('--category-badge-color'),
                node.style?.getPropertyValue?.('--category-color'),
                style?.getPropertyValue?.('--category-badge-color'),
                style?.getPropertyValue?.('--category-color'),
                style?.borderLeftColor,
                style?.backgroundColor,
                style?.color
            ].map((value) => String(value || '').trim()).filter(Boolean);
            return candidates.find((value) => {
                return value !== 'transparent' && value !== 'rgba(0, 0, 0, 0)' && value !== 'inherit';
            }) || '';
        },

        colorFor(name) {
            let hash = 0;
            for (const char of String(name)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
            return this.palette[hash % this.palette.length];
        }
    };

    // 本地关键词规则只作用于真实话题标题，不处理抽屉和脚本自身 UI。
    const KeywordRules = {
        hasDecorations: false,

        terms(value) {
            return Prefs.cleanTextSetting(value)
                .split(/[\n,，;；]+/)
                .flatMap((part) => part.trim().split(/\s+/))
                .map((part) => part.trim().toLowerCase())
                .filter(Boolean);
        },

        title(anchor) {
            return String(anchor?.textContent || anchor?.getAttribute?.('title') || '').replace(/\s+/g, ' ').trim();
        },

        match(title, terms) {
            const normalized = title.toLowerCase();
            return terms.find((term) => normalized.includes(term)) || '';
        },

        preparedTerms() {
            return {
                blockTerms: this.terms(Prefs.value.keywordBlockList),
                highlightTerms: this.terms(Prefs.value.keywordHighlightList)
            };
        },

        refresh() {
            const { blockTerms, highlightTerms } = this.preparedTerms();
            if (!blockTerms.length && !highlightTerms.length) {
                if (this.hasDecorations) this.clear();
                return;
            }

            this.clear();

            document.querySelectorAll(BADGE_ANCHOR_QUERY).forEach((anchor) => {
                if (Dom.isOwnSurface(anchor)) return;
                this.decorate(anchor, blockTerms, highlightTerms);
            });
        },

        refreshAnchor(anchor, prepared = null) {
            if (!anchor?.matches?.(BADGE_ANCHOR_QUERY) || Dom.isOwnSurface(anchor)) return;
            this.clearAnchor(anchor);
            const { blockTerms, highlightTerms } = prepared || this.preparedTerms();
            if (!blockTerms.length && !highlightTerms.length) return;
            this.decorate(anchor, blockTerms, highlightTerms);
        },

        clear() {
            document.querySelectorAll(`.${NAME}-keyword-badge`).forEach((badge) => badge.remove());
            document.querySelectorAll(`.${NAME}-keyword-highlight`).forEach((element) => {
                element.classList.remove(`${NAME}-keyword-highlight`);
                element.removeAttribute('data-keyword-match');
            });
            document.querySelectorAll(`.${NAME}-keyword-blocked`).forEach((element) => {
                element.classList.remove(`${NAME}-keyword-blocked`);
                element.removeAttribute('data-keyword-match');
            });
            this.hasDecorations = false;
        },

        clearAnchor(anchor) {
            const row = TopicBadges.topicRow(anchor) || anchor;
            row.classList.remove(`${NAME}-keyword-highlight`, `${NAME}-keyword-blocked`);
            row.removeAttribute('data-keyword-match');
            anchor.classList.remove(`${NAME}-keyword-highlight`);
            anchor.removeAttribute('data-keyword-match');
            let next = anchor.nextElementSibling;
            while (next) {
                const current = next;
                next = next.nextElementSibling;
                if (current.classList?.contains(`${NAME}-keyword-badge`)) current.remove();
            }
        },

        decorate(anchor, blockTerms, highlightTerms) {
            const title = this.title(anchor);
            if (!title) return;
            const row = TopicBadges.topicRow(anchor) || anchor;
            const blocked = this.match(title, blockTerms);
            if (blocked) {
                row.classList.add(`${NAME}-keyword-blocked`);
                row.dataset.keywordMatch = blocked;
                this.hasDecorations = true;
                return;
            }

            const highlighted = this.match(title, highlightTerms);
            if (!highlighted) return;
            anchor.classList.add(`${NAME}-keyword-highlight`);
            anchor.dataset.keywordMatch = highlighted;
            this.hasDecorations = true;
            this.ensureBadge(anchor, highlighted);
        },

        ensureBadge(anchor, keyword) {
            let target = anchor;
            while (target.nextElementSibling?.classList?.contains(`${NAME}-read-badge`) ||
                target.nextElementSibling?.classList?.contains(`${NAME}-effective-badge`)) {
                target = target.nextElementSibling;
            }
            const existing = target.nextElementSibling?.classList?.contains(`${NAME}-keyword-badge`)
                ? target.nextElementSibling
                : null;
            const badge = existing || Dom.make('span', {
                className: `${NAME}-keyword-badge`,
                text: '关键词'
            });
            badge.title = `命中高亮关键词：${keyword}`;
            if (!existing) target.insertAdjacentElement('afterend', badge);
        }
    };

    // 小容量话题缓存；预览模式使用 `/t/{id}.json` 里的已加载帖子生成摘要视图。
    const StarterPostStore = {
        cache: new Map(),
        cacheBytes: new Map(),
        preloadAt: new Map(),

        async load(topicId) {
            if (this.cache.has(topicId)) {
                const cached = this.cache.get(topicId);
                this.cache.delete(topicId);
                this.cache.set(topicId, cached);
                return cached;
            }

            const pending = fetch(Urls.topicJson(topicId), {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' }
            })
                .then((response) => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.json();
                })
                .then((payload) => {
                    const model = this.toCardModel(topicId, payload);
                    if (this.cache.get(topicId) === pending) {
                        this.cacheBytes.set(topicId, estimateSerializedBytes(model));
                    }
                    return model;
                });

            this.cache.set(topicId, pending);
            this.trimCache();
            pending.catch(() => {
                if (this.cache.get(topicId) === pending) {
                    this.cache.delete(topicId);
                    this.cacheBytes.delete(topicId);
                }
            });
            return pending;
        },

        preload(topicId) {
            const id = String(topicId || '');
            if (!id || Prefs.value.mode !== 'summary') return;
            const last = this.preloadAt.get(id) || 0;
            if (Date.now() - last < Prefs.value.previewCacheTtl * 1000) return;
            this.preloadAt.set(id, Date.now());
            this.load(id).catch(() => {
                // 预加载失败不打扰用户，正式打开时仍会显示错误兜底。
            });
            this.trimPreloadMarks();
        },

        trimCache() {
            while (this.cache.size > Prefs.value.topicCacheLimit) {
                const key = this.cache.keys().next().value;
                this.cache.delete(key);
                this.cacheBytes.delete(key);
            }
        },

        trimPreloadMarks() {
            while (this.preloadAt.size > Prefs.value.topicCacheLimit * 3) {
                this.preloadAt.delete(this.preloadAt.keys().next().value);
            }
        },

        clearVolatileCache() {
            const count = this.cache.size + this.preloadAt.size;
            this.cache.clear();
            this.cacheBytes.clear();
            this.preloadAt.clear();
            return count;
        },

        toCardModel(topicId, payload) {
            const posts = Array.isArray(payload?.post_stream?.posts)
                ? payload.post_stream.posts.filter((post) => post?.cooked)
                : [];
            const first = posts[0];
            if (!first?.cooked) throw new Error('话题正文为空');

            const replies = posts
                .filter((post) => post !== first && Number(post.post_number || 0) > Number(first.post_number || 1))
                .sort((a, b) => Number(a.post_number || 0) - Number(b.post_number || 0));
            const topReply = replies
                .filter((post) => this.postLikes(post) > 0)
                .sort((a, b) => this.postLikes(b) - this.postLikes(a) || Number(b.post_number || 0) - Number(a.post_number || 0))[0] || null;
            const latestReply = replies[replies.length - 1] || null;
            const starter = this.postSummary('starter', '楼主', first, {
                fallbackEmpty: '暂无楼主正文'
            });
            const top = topReply
                ? this.postSummary('top', '高赞回复', topReply, {
                    badge: `赞 ${this.postLikes(topReply)}`,
                    fallbackEmpty: '暂无高赞回复正文'
                })
                : this.emptySummary('top', '高赞回复', replies.length ? '当前已加载回复暂无点赞' : '暂无回复');
            const latest = latestReply
                ? this.postSummary('latest', '最新回复', latestReply, {
                    badge: `#${Number(latestReply.post_number || 0) || replies.length + 1}`,
                    fallbackEmpty: '暂无最新回复正文'
                })
                : this.emptySummary('latest', '最新回复', '暂无回复');

            return {
                id: topicId,
                title: payload.title || payload.fancy_title || `话题 ${topicId}`,
                displayName: starter.displayName,
                username: starter.username,
                avatar: starter.avatar,
                createdAt: starter.createdAt,
                likes: starter.likes,
                cooked: starter.cooked,
                replyCount: Math.max(0, Number(payload.posts_count || posts.length) - 1),
                loadedReplyCount: replies.length,
                summaries: [starter, top, latest],
                stats: {
                    postsCount: Number(payload.posts_count || 0),
                    highestPostNumber: Number(payload.highest_post_number || 0),
                    streamCount: Array.isArray(payload.post_stream?.stream) ? payload.post_stream.stream.length : 0,
                    participantCount: Number(payload.participant_count || 0),
                    views: Number(payload.views || 0),
                    likeCount: Number(payload.like_count || 0),
                    wordCount: Number(payload.word_count || 0),
                    closed: !!payload.closed,
                    archived: !!payload.archived,
                    createdAt: payload.created_at || '',
                    lastPostedAt: payload.last_posted_at || '',
                    starterDisplayName: starter.displayName,
                    starterUsername: starter.username,
                    starterLikeCount: starter.likes,
                    starterReads: Number(first.reads || first.readers_count || 0),
                    starterReplyCount: Number(first.reply_count || 0),
                    starterCreatedAt: starter.createdAt
                }
            };
        },

        postSummary(key, label, post, options = {}) {
            const postNumber = Number(post?.post_number || 0);
            return {
                key,
                label,
                badge: options.badge || (postNumber ? `#${postNumber}` : ''),
                displayName: post?.name || post?.display_username || post?.username || '未知用户',
                username: post?.username || post?.display_username || '',
                avatar: this.avatarUrl(post?.avatar_template, 96),
                createdAt: post?.created_at || '',
                likes: this.postLikes(post),
                postNumber,
                cooked: this.cleanCooked(post?.cooked || options.fallbackEmpty || ''),
                empty: false
            };
        },

        emptySummary(key, label, text) {
            return {
                key,
                label,
                badge: '',
                displayName: '',
                username: '',
                avatar: '',
                createdAt: '',
                likes: 0,
                postNumber: 0,
                cooked: '',
                empty: true,
                emptyText: text || '暂无内容'
            };
        },

        postLikes(post) {
            const direct = Number(post?.like_count);
            if (Number.isFinite(direct) && direct > 0) return direct;
            const like = Array.isArray(post?.actions_summary)
                ? post.actions_summary.find((item) => item?.id === 2 || item?.name_key === 'like')
                : null;
            const count = Number(like?.count);
            return Number.isFinite(count) && count > 0 ? count : 0;
        },

        avatarUrl(template, size) {
            if (!template) return '';
            return Urls.absolute(template.replace('{size}', String(size)));
        },

        cleanCooked(html) {
            const box = document.createElement('div');
            box.innerHTML = html;

            box.querySelectorAll('script, style, object, embed, form').forEach((node) => node.remove());
            box.querySelectorAll('[onload], [onclick], [onerror], [onmouseover]').forEach((node) => {
                node.removeAttribute('onload');
                node.removeAttribute('onclick');
                node.removeAttribute('onerror');
                node.removeAttribute('onmouseover');
            });
            box.querySelectorAll('img').forEach((img) => {
                const src = img.getAttribute('src') || img.getAttribute('data-src');
                if (src) img.setAttribute('src', Urls.absolute(src));
                img.removeAttribute('width');
                img.removeAttribute('height');
                img.setAttribute('loading', 'lazy');
            });
            box.querySelectorAll('a[href]').forEach((link) => {
                link.setAttribute('href', Urls.absolute(link.getAttribute('href')));
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
            });

            return box.innerHTML.trim();
        }
    };

    // 话题链接悬浮或聚焦后显示的小型预览入口。
    const MiniEye = {
        button: null,
        statsPanel: null,
        anchor: null,
        timer: 0,
        preloadTimer: 0,
        statsTicket: 0,

        mount() {
            if (this.button) return this.button;

            this.button = Dom.make('div', {
                id: `${NAME}-eye`,
                role: 'group',
                'aria-label': '话题快捷操作'
            }, [
                Dom.make('button', {
                    className: `${NAME}-eye-btn ${NAME}-eye-preview`,
                    type: 'button',
                    title: '打开抽屉预览',
                    'aria-label': '打开抽屉预览',
                    'data-eye-action': 'preview'
                }, Dom.make('span', { className: `${NAME}-book-preview`, 'aria-hidden': 'true' }, [
                    Dom.make('span', { className: `${NAME}-book-pages` }),
                    Dom.make('span', { className: `${NAME}-book-cover` })
                ])),
                Dom.make('button', {
                    className: `${NAME}-eye-btn ${NAME}-eye-later`,
                    type: 'button',
                    title: '加入稍后阅读',
                    'aria-label': '加入稍后阅读',
                    'data-eye-action': 'read-later',
                    text: '+'
                }),
                Dom.make('button', {
                    className: `${NAME}-eye-btn ${NAME}-eye-stats`,
                    type: 'button',
                    title: '话题统计',
                    'aria-label': '话题统计',
                    'data-eye-action': 'stats'
                }, Dom.make('span', { className: `${NAME}-eye-stats-icon`, 'aria-hidden': 'true' }))
            ]);

            this.statsPanel = Dom.make('section', {
                id: `${NAME}-mini-stats`,
                'aria-label': '话题统计'
            });
            this.statsPanel.addEventListener('pointerenter', () => this.cancelHide());
            this.statsPanel.addEventListener('pointerleave', () => this.hideSoon());
            this.statsPanel.addEventListener('click', (event) => {
                const copyTarget = event.target.closest('[data-mini-stats-copy]');
                if (copyTarget) {
                    event.preventDefault();
                    copyText(copyTarget.getAttribute('data-mini-stats-copy'), copyTarget.getAttribute('data-mini-stats-copy-message') || '已复制');
                    return;
                }

                const action = event.target.closest('[data-mini-stats-action]')?.dataset.miniStatsAction;
                if (!action) return;
                event.preventDefault();
                if (action === 'close') {
                    this.hideStats();
                    return;
                }
                if (action === 'drawer') {
                    const topicId = this.statsPanel.dataset.topicId || this.button?.dataset.topicId || '';
                    if (!topicId) return;
                    const sourceAnchor = this.anchor?.isConnected ? this.anchor : null;
                    const sourceHref = sourceAnchor?.getAttribute('href') || '';
                    this.hide();
                    Drawer.open(topicId, Prefs.value.mode, sourceAnchor, sourceHref, {
                        sidebarPanel: 'topicStats',
                        trackSource: 'topicLinks'
                    });
                }
            });

            this.button.addEventListener('pointerenter', () => this.cancelHide());
            this.button.addEventListener('pointerleave', () => this.hideSoon());
            this.button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const action = event.target.closest('[data-eye-action]')?.dataset.eyeAction;
                const topicId = this.button.dataset.topicId;
                if (!topicId || !action) return;
                const sourceAnchor = this.anchor?.isConnected ? this.anchor : null;
                const sourceHref = sourceAnchor?.getAttribute('href') || '';
                if (action === 'read-later') {
                    const result = ReadLaterQueue.add(topicId, sourceAnchor, sourceHref);
                    this.syncLaterButton(topicId);
                    FloatingPrefs.sync();
                    Drawer.activeSidebarPanel = 'readLater';
                    Drawer.renderSidebar();
                    if (result.full) showToast(`稍后阅读最多保留 ${MAX_READ_LATER} 个话题`);
                    else showToast(result.existing ? '已在稍后阅读队列' : '已加入稍后阅读');
                    return;
                }
                if (action === 'stats') {
                    this.toggleStats(topicId);
                    return;
                }
                this.hide();
                Drawer.open(topicId, Prefs.value.mode, sourceAnchor, sourceHref, { trackSource: 'topicLinks' });
            });

            document.body.appendChild(this.button);
            document.body.appendChild(this.statsPanel);
            this.applyTheme();
            return this.button;
        },

        applyTheme() {
            if (!this.statsPanel) return;
            const dark = pagePrefersDarkTheme();
            this.statsPanel.classList.toggle('is-light', !dark);
        },

        show(topicId, anchor) {
            if (!topicId || !anchor?.isConnected) return;
            this.mount();
            this.cancelHide();
            this.applyTheme();
            if (this.button.dataset.topicId && this.button.dataset.topicId !== String(topicId)) {
                this.hideStats();
            }
            this.anchor = anchor;
            this.button.dataset.topicId = topicId;
            this.syncLaterButton(topicId);
            this.place();
            this.button.classList.add('is-live');
            this.schedulePreload(topicId);
        },

        syncLaterButton(topicId) {
            const laterButton = this.button?.querySelector('[data-eye-action="read-later"]');
            if (!laterButton) return;
            const active = ReadLaterQueue.has(topicId);
            laterButton.classList.toggle('is-active', active);
            laterButton.textContent = active ? '✓' : '+';
            laterButton.setAttribute('title', active ? '已在稍后阅读' : '加入稍后阅读');
            laterButton.setAttribute('aria-label', active ? '已在稍后阅读' : '加入稍后阅读');
        },

        place() {
            if (!this.button || !this.anchor?.isConnected) return;

            const rect = this.anchor.getBoundingClientRect();
            const buttonWidth = this.button.offsetWidth || 82;
            const buttonHeight = this.button.offsetHeight || 36;
            const gap = 8;
            const margin = 8;
            const vw = document.documentElement.clientWidth;
            const vh = window.innerHeight;

            let left = rect.right + gap;
            let top = rect.top + rect.height / 2 - buttonHeight / 2;

            if (left + buttonWidth + margin > vw) left = rect.left - buttonWidth - gap;
            if (left < margin) {
                left = Math.min(Math.max(rect.left, margin), vw - buttonWidth - margin);
                top = rect.bottom + gap;
            }

            left = Math.max(margin, Math.min(left, vw - buttonWidth - margin));
            top = Math.max(margin, Math.min(top, vh - buttonHeight - margin));

            this.button.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
            this.placeStats(left, top, buttonWidth, buttonHeight);
        },

        placeStats(eyeLeft, eyeTop, eyeWidth, eyeHeight) {
            if (!this.statsPanel?.classList.contains('is-open')) return;

            const gap = 8;
            const margin = 8;
            const vw = document.documentElement.clientWidth;
            const vh = window.innerHeight;
            const panelWidth = this.statsPanel.offsetWidth || 306;
            const panelHeight = this.statsPanel.offsetHeight || 260;

            let left = eyeLeft + eyeWidth + gap;
            if (left + panelWidth + margin > vw) left = eyeLeft - panelWidth - gap;
            if (left < margin) left = Math.min(Math.max(margin, eyeLeft), vw - panelWidth - margin);

            let top = eyeTop + eyeHeight / 2 - panelHeight / 2;
            top = Math.max(margin, Math.min(top, vh - panelHeight - margin));

            this.statsPanel.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
        },

        toggleStats(topicId) {
            const id = String(topicId || '');
            if (!id) return;
            if (this.statsPanel?.classList.contains('is-open') && this.statsPanel.dataset.topicId === id) {
                this.hideStats();
                return;
            }
            this.showStats(id);
        },

        async showStats(topicId) {
            const id = String(topicId || '');
            if (!id) return;
            this.mount();
            const ticket = ++this.statsTicket;
            this.statsPanel.dataset.topicId = id;
            this.statsPanel.replaceChildren(this.statsShell('正在加载统计数据...'));
            this.statsPanel.classList.add('is-open');
            this.place();

            try {
                const topic = await StarterPostStore.load(id);
                if (ticket !== this.statsTicket || this.statsPanel.dataset.topicId !== id) return;
                this.statsPanel.replaceChildren(this.statsContent(topic));
                this.place();
            } catch (_) {
                if (ticket !== this.statsTicket || this.statsPanel.dataset.topicId !== id) return;
                this.statsPanel.replaceChildren(this.statsShell('统计数据加载失败'));
                this.place();
            }
        },

        hideStats() {
            this.statsTicket += 1;
            if (!this.statsPanel) return;
            this.statsPanel.classList.remove('is-open');
            this.statsPanel.removeAttribute('data-topic-id');
            this.statsPanel.style.transform = 'translate(-999px, -999px)';
        },

        statsShell(message) {
            return Dom.make('div', { className: `${NAME}-mini-stats-card` }, [
                this.statsHeader(),
                Dom.make('div', { className: `${NAME}-mini-stats-empty`, text: message })
            ]);
        },

        statsHeader(topic = null) {
            const title = topic?.title || '话题统计';
            return Dom.make('div', { className: `${NAME}-mini-stats-head` }, [
                Dom.make('div', { className: `${NAME}-mini-stats-title`, title, text: title }),
                Dom.make('button', {
                    className: `${NAME}-mini-stats-close`,
                    type: 'button',
                    title: '关闭',
                    'aria-label': '关闭话题统计',
                    'data-mini-stats-action': 'close',
                    text: '×'
                })
            ]);
        },

        statsContent(topic) {
            const s = topic?.stats || {};
            const number = (value) => {
                const next = Number(value);
                return Number.isFinite(next) ? Math.max(0, next) : 0;
            };
            const formatNumber = (value) => number(value).toLocaleString('zh-CN');
            const percent = (value) => Number.isFinite(value) ? `${value.toFixed(1)}%` : '-';
            const postsCount = number(s.postsCount);
            const highestPostNumber = number(s.highestPostNumber);
            const effectiveReplies = Math.max(0, postsCount - 1);
            const deletedFloors = Math.max(0, highestPostNumber - postsCount);
            const floorValidRate = highestPostNumber > 0 ? postsCount / highestPostNumber * 100 : NaN;
            const participantDensity = number(s.views) > 0 ? number(s.participantCount) / number(s.views) * 100 : NaN;
            const status = s.closed ? '已关闭' : s.archived ? '已归档' : '开放中';

            const row = (label, value, options = {}) => Dom.make(options.copyValue ? 'button' : 'div', {
                className: `${NAME}-mini-stats-row${options.warn ? ` ${NAME}-mini-stats-row-warn` : ''}${options.copyValue ? ` ${NAME}-mini-stats-copyable` : ''}`,
                type: options.copyValue ? 'button' : undefined,
                title: options.copyValue ? options.copyTitle || '点击复制' : String(value),
                'data-mini-stats-copy': options.copyValue,
                'data-mini-stats-copy-message': options.copyMessage
            }, [
                Dom.make('span', { className: `${NAME}-mini-stats-label`, text: label }),
                Dom.make('span', { className: `${NAME}-mini-stats-value`, text: String(value) })
            ]);
            const meter = (label, value, pct, options = {}) => {
                const width = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
                return Dom.make('div', { className: `${NAME}-mini-stats-meter${options.warn ? ` ${NAME}-mini-stats-meter-warn` : ''}` }, [
                    Dom.make('div', { className: `${NAME}-mini-stats-meter-head` }, [
                        Dom.make('span', { className: `${NAME}-mini-stats-label`, text: label }),
                        Dom.make('span', { className: `${NAME}-mini-stats-value`, text: value })
                    ]),
                    Dom.make('div', { className: `${NAME}-mini-stats-meter-track` }, [
                        Dom.make('span', { className: `${NAME}-mini-stats-meter-fill`, style: `width:${width}%` })
                    ])
                ]);
            };

            return Dom.make('div', { className: `${NAME}-mini-stats-card` }, [
                this.statsHeader(topic),
                Dom.make('div', { className: `${NAME}-mini-stats-body` }, [
                    Dom.make('div', { className: `${NAME}-mini-stats-id-row` }, [
                        row('话题 ID', topic?.id || '-', topic?.id ? {
                            copyValue: topic.id,
                            copyTitle: '点击复制话题 ID',
                            copyMessage: '已复制话题 ID'
                        } : {}),
                        Dom.make('span', { className: `${NAME}-mini-stats-status`, text: status })
                    ]),
                    Dom.make('div', { className: `${NAME}-mini-stats-grid` }, [
                        row('有效楼层', formatNumber(postsCount)),
                        row('有效回复', formatNumber(effectiveReplies)),
                        row('最高楼层', highestPostNumber ? `#${formatNumber(highestPostNumber)}` : '-'),
                        row('已删除/隐藏楼层', formatNumber(deletedFloors), { warn: deletedFloors > 0 })
                    ]),
                    meter('楼层有效率', percent(floorValidRate), floorValidRate),
                    meter('参与密度', percent(participantDensity), participantDensity),
                    Dom.make('div', { className: `${NAME}-mini-stats-grid` }, [
                        row('参与人数', formatNumber(s.participantCount)),
                        row('全帖点赞', formatNumber(s.likeCount)),
                        row('浏览量', formatNumber(s.views)),
                        row('话题字数', formatNumber(s.wordCount))
                    ]),
                    Dom.make('button', {
                        className: `${NAME}-mini-stats-drawer`,
                        type: 'button',
                        'data-mini-stats-action': 'drawer',
                        text: '抽屉统计'
                    })
                ])
            ]);
        },

        hideSoon(delay = 220) {
            this.cancelHide();
            this.timer = window.setTimeout(() => this.hide(), delay);
        },

        cancelHide() {
            if (!this.timer) return;
            clearTimeout(this.timer);
            this.timer = 0;
        },

        schedulePreload(topicId) {
            this.cancelPreload();
            this.preloadTimer = window.setTimeout(() => {
                this.preloadTimer = 0;
                StarterPostStore.preload(topicId);
            }, Prefs.value.previewPrefetchDelay);
        },

        cancelPreload() {
            if (!this.preloadTimer) return;
            clearTimeout(this.preloadTimer);
            this.preloadTimer = 0;
        },

        hide() {
            this.cancelHide();
            this.cancelPreload();
            this.hideStats();
            if (!this.button) return;
            this.button.classList.remove('is-live');
            this.button.removeAttribute('data-topic-id');
            this.anchor = null;
        }
    };

    // 抽屉关闭后帮助用户定位刚刚查看过的话题。
    const LastViewedMarker = {
        topicId: '',
        anchor: null,
        flashTimer: 0,

        set(topicId, anchor) {
            this.clear({ keepState: false });
            this.topicId = String(topicId || '');
            this.anchor = this.anchorFor(this.topicId, anchor);
            if (!this.anchor) return;

            this.ensureBadge(this.anchor);
        },

        reveal() {
            const anchor = this.anchor?.isConnected ? this.anchor : this.findAnchor(this.topicId);
            if (!anchor) return;
            this.anchor = anchor;

            this.ensureBadge(anchor);
            const row = TopicBadges.topicRow(anchor);
            row?.classList.add(`${NAME}-last-viewed-row`);
            clearTimeout(this.flashTimer);
            this.flashTimer = window.setTimeout(() => {
                row?.classList.remove(`${NAME}-last-viewed-row`);
            }, 2200);

            try {
                anchor.scrollIntoView({ block: 'center', behavior: 'smooth' });
            } catch (_) {
                anchor.scrollIntoView();
            }
        },

        clear({ keepState } = { keepState: true }) {
            clearTimeout(this.flashTimer);
            document.querySelectorAll(`.${NAME}-last-viewed-badge`).forEach((badge) => badge.remove());
            document.querySelectorAll(`.${NAME}-last-viewed-row`).forEach((row) => row.classList.remove(`${NAME}-last-viewed-row`));
            if (!keepState) {
                this.topicId = '';
                this.anchor = null;
            }
        },

        ensureBadge(anchor) {
            if (!anchor?.isConnected) return null;
            this.clear({ keepState: true });
            const badge = Dom.make('span', {
                className: `${NAME}-last-viewed-badge`,
                text: '上次查看',
                title: '刚才在抽屉里查看的话题'
            });

            let target = anchor;
            while (target.nextElementSibling?.classList?.contains(`${NAME}-read-badge`) ||
                target.nextElementSibling?.classList?.contains(`${NAME}-effective-badge`)) {
                target = target.nextElementSibling;
            }
            target.insertAdjacentElement('afterend', badge);
            return badge;
        },

        anchorFor(topicId, sourceAnchor = null) {
            const id = String(topicId || '');
            if (!id) return null;
            return TopicBadges.badgeAnchorFor(sourceAnchor, id, { localOnly: true }) ||
                this.localAnchor(sourceAnchor, id) ||
                this.findAnchor(id);
        },

        localAnchor(sourceAnchor, topicId) {
            const id = String(topicId || '');
            if (!id || !(sourceAnchor instanceof Element) || !sourceAnchor.isConnected) return null;
            if (sourceAnchor.matches(LAST_VIEWED_ANCHOR_QUERY) &&
                Urls.topicIdFromHref(sourceAnchor.getAttribute('href')) === id) {
                return sourceAnchor;
            }

            const row = TopicBadges.topicRow(sourceAnchor);
            return Array.from(row?.querySelectorAll?.(LAST_VIEWED_ANCHOR_QUERY) || []).find((candidate) => {
                return !Dom.isOwnSurface(candidate) && Urls.topicIdFromHref(candidate.getAttribute('href')) === id;
            }) || null;
        },

        findAnchor(topicId) {
            if (!topicId) return null;
            return Array.from(document.querySelectorAll(LAST_VIEWED_ANCHOR_QUERY)).find((anchor) => {
                if (Dom.isOwnSurface(anchor)) return false;
                return Urls.topicIdFromHref(anchor.getAttribute('href')) === String(topicId);
            }) || null;
        }
    };

    // 右侧阅读抽屉。预览模式渲染清理后的首帖 HTML；
    // 详情模式通过 iframe 加载 Discourse 楼层视图或话题原始链接。
    const Drawer = {
        shade: null,
        root: null,
        main: null,
        body: null,
        footer: null,
        sidebar: null,
        activeSidebarPanel: '',
        currentStats: null,
        topicId: '',
        sourceHref: '',
        topicTitle: '',
        mode: 'summary',
        resumeState: null,
        job: 0,
        lockSnapshot: null,
        frameControls: null,
        loadedContentCleanup: null,
        trackViewTimer: 0,
        trackViewCountdownTimer: 0,
        trackViewCountdownDuration: 0,
        trackViewDeadline: 0,
        trackViewStatus: null,
        trackViewSource: '',
        autoScrollState: 'idle',
        autoScrollPauseReason: '',
        autoScrollFrame: 0,
        autoScrollLastAt: 0,
        autoScrollCurrentSpeed: AUTO_SCROLL_DEFAULT_SPEED,
        autoScrollTargetSpeed: AUTO_SCROLL_DEFAULT_SPEED,
        autoScrollNextSpeedAt: 0,
        autoScrollPauseUntil: 0,
        autoScrollFrameDoc: null,
        autoScrollFrameCleanup: null,
        sidebarScrollTop: Object.create(null),
        sidebarPointerClickUntil: 0,

        ensure() {
            if (this.root) return;

            this.shade = Dom.make('div', { id: `${NAME}-shade` });
            this.shade.addEventListener('click', () => {
                if (this.hideSettings()) return;
                this.close();
            });
            document.body.appendChild(this.shade);

            this.sidebar = Dom.make('aside', {
                id: `${NAME}-drawer-sidebar`,
                'aria-label': '抽屉侧边栏'
            });
            this.sidebar.addEventListener('pointerdown', (event) => this.onSidebarPointerDown(event), true);
            this.sidebar.addEventListener('click', (event) => this.onSidebarClick(event));

            this.root = Dom.make('aside', {
                id: `${NAME}-drawer`,
                role: 'dialog',
                'aria-modal': 'true',
                'aria-label': `${APP_NAME} 话题预览`,
                tabindex: '-1'
            });

            this.root.append(
                this.buildHeader(),
                this.main = Dom.make('div', { className: `${NAME}-drawer-main` }, [
                    this.sidebar,
                    this.body = Dom.make('div', { className: `${NAME}-body` })
                ]),
                this.footer = this.buildFooter()
            );

            this.root.addEventListener('click', (event) => this.onClick(event));
            this.root.addEventListener('input', (event) => this.onInput(event));
            this.root.addEventListener('change', (event) => this.onInput(event));
            this.root.addEventListener('wheel', (event) => this.pauseAutoScrollForInteraction(event), { passive: true, capture: true });
            this.root.addEventListener('pointerdown', (event) => this.pauseAutoScrollForInteraction(event), true);
            this.root.addEventListener('touchstart', (event) => this.pauseAutoScrollForInteraction(event), { passive: true, capture: true });
            this.root.addEventListener('keydown', (event) => this.pauseAutoScrollForInteraction(event), true);
            this.bindFrameFocusRelease(this.sidebar);
            this.bindFrameFocusRelease(this.footer);
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) this.pauseAutoScroll('hidden');
            });
            window.addEventListener('blur', () => this.pauseAutoScroll('hidden'), { passive: true });
            document.body.appendChild(this.root);
        },

        buildHeader() {
            const title = Dom.make('div', { className: `${NAME}-title-block` }, [
                Dom.make('div', { className: `${NAME}-title`, text: APP_NAME }),
                Dom.make('div', { className: `${NAME}-subtitle`, 'data-role': 'default-mode' })
            ]);

            const brand = Dom.make('div', { className: `${NAME}-brand` }, [
                Dom.make('span', { className: `${NAME}-brand-eye`, 'aria-hidden': 'true' }),
                title
            ]);

            const modeSwitch = Dom.make('div', { className: `${NAME}-switch`, role: 'group', 'aria-label': '打开方式' }, [
                Dom.make('button', { type: 'button', 'data-mode': 'summary', text: '预览' }),
                Dom.make('button', { type: 'button', 'data-mode': 'thread', text: '详情' })
            ]);

            const tools = Dom.make('div', { className: `${NAME}-tools` }, [
                modeSwitch,
                Dom.make('button', { className: `${NAME}-icon-btn`, type: 'button', title: '收藏话题', 'aria-label': '收藏话题', 'aria-pressed': 'false', 'data-action': 'favorite' },
                    Dom.make('span', { className: `${NAME}-favorite-star`, 'aria-hidden': 'true', text: '☆' })),
                Dom.make('button', { className: `${NAME}-icon-btn`, type: 'button', title: '关闭', 'aria-label': '关闭', 'data-action': 'close' },
                    Dom.make('span', { className: `${NAME}-close`, 'aria-hidden': 'true' }))
            ]);

            return Dom.make('header', { className: `${NAME}-head` }, [brand, tools]);
        },

        buildFooter() {
            return Dom.make('footer', {
                className: `${NAME}-drawer-footer`,
                'aria-label': '抽屉状态栏'
            }, [
                Dom.make('div', {
                    className: `${NAME}-drawer-track`,
                    'data-role': 'drawer-track',
                    'data-drawer-footer-slot': 'tracking'
                }, [
                    Dom.make('div', {
                        className: `${NAME}-drawer-status`,
                        'data-role': 'topic-status',
                        'aria-live': 'polite'
                    }, [
                        Dom.make('span', { className: `${NAME}-drawer-status-dot`, 'aria-hidden': 'true' }),
                        Dom.make('span', {
                            className: `${NAME}-drawer-status-text`,
                            'data-role': 'topic-status-text',
                            text: '话题已生效'
                        })
                    ]),
                    Dom.make('div', { className: `${NAME}-drawer-track-bar`, 'aria-hidden': 'true' }, [
                        Dom.make('span', {
                            className: `${NAME}-drawer-track-fill`,
                            'data-role': 'topic-status-progress'
                        })
                    ])
                ]),
                Dom.make('div', {
                    className: `${NAME}-drawer-footer-actions`,
                    'data-drawer-footer-slot': 'actions'
                }, [
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-drawer-footer-btn ${NAME}-drawer-footer-scroll`,
                        title: '开始自动滚动',
                        'aria-label': '开始自动滚动',
                        'aria-pressed': 'false',
                        'data-action': 'toggle-auto-scroll',
                        'data-scroll-state': 'idle'
                    }, [
                        Dom.make('span', { className: `${NAME}-drawer-footer-scroll-icon`, 'aria-hidden': 'true' }),
                        Dom.make('span', { className: `${NAME}-drawer-footer-scroll-label`, 'data-role': 'auto-scroll-label', text: '自动滚动' })
                    ]),
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-drawer-footer-btn ${NAME}-drawer-footer-copy`,
                        title: '复制当前话题地址',
                        'aria-label': '复制当前话题地址',
                        'data-action': 'copy-current-url'
                    }),
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-drawer-footer-btn ${NAME}-drawer-footer-open`,
                        title: '新标签打开当前话题',
                        'aria-label': '新标签打开当前话题',
                        'data-action': 'open-current-url'
                    })
                ])
            ]);
        },

        settingButton(mode, label, desc) {
            const active = Prefs.value.mode === mode;
            return Dom.make('button', {
                type: 'button',
                className: `${NAME}-setting${active ? ' is-active' : ''}`,
                'aria-pressed': active ? 'true' : 'false',
                'data-default-mode': mode
            }, [
                Dom.make('span', { className: `${NAME}-setting-copy` }, [
                    Dom.make('span', { className: `${NAME}-setting-label`, text: label }),
                    Dom.make('span', { className: `${NAME}-setting-desc`, text: desc })
                ]),
                Dom.make('span', { className: `${NAME}-setting-dot`, 'aria-hidden': 'true' })
            ]);
        },

        threadSourceButton(source, label, desc) {
            const active = Prefs.value.threadSource === source;
            return Dom.make('button', {
                type: 'button',
                className: `${NAME}-setting${active ? ' is-active' : ''}`,
                'aria-pressed': active ? 'true' : 'false',
                'data-thread-source': source
            }, [
                Dom.make('span', { className: `${NAME}-setting-copy` }, [
                    Dom.make('span', { className: `${NAME}-setting-label`, text: label }),
                    Dom.make('span', { className: `${NAME}-setting-desc`, text: desc })
                ]),
                Dom.make('span', { className: `${NAME}-setting-dot`, 'aria-hidden': 'true' })
            ]);
        },

        sizeControl(field, label) {
            return SizeControls.build(field, label);
        },

        sidebarTool(action, icon, label, options = {}) {
            const active = options.active === true;
            const props = {
                type: 'button',
                className: `${NAME}-sidebar-tool${active ? ' is-active' : ''}${options.dockControl ? ` ${NAME}-sidebar-dock-scroll` : ''}`,
                title: label,
                'aria-label': label,
                'data-sidebar-action': action
            };
            if (options.pressed !== undefined) {
                props['aria-pressed'] = options.pressed ? 'true' : 'false';
            }
            if (options.disabled) {
                props.disabled = 'disabled';
                props['aria-disabled'] = 'true';
            }

            const children = [
                Dom.make('span', {
                    className: `${NAME}-sidebar-tool-icon ${NAME}-sidebar-icon-${icon}`,
                    'aria-hidden': 'true'
                })
            ];
            if (Number(options.count) > 0) {
                children.push(Dom.make('span', {
                    className: `${NAME}-sidebar-tool-count`,
                    text: String(options.count)
                }));
            }
            return Dom.make('button', props, children);
        },

        sidebarQueueRows() {
            return ReadLaterQueue.items.map((item, index) => {
                const active = item.id === this.topicId;
                return Dom.make('div', { className: `${NAME}-sidebar-queue-row${active ? ' is-active' : ''}` }, [
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-sidebar-queue-item`,
                        title: item.title,
                        'data-sidebar-queue-open': item.id
                    }, [
                        Dom.make('span', { className: `${NAME}-sidebar-queue-index`, text: String(index + 1) }),
                        Dom.make('span', { className: `${NAME}-sidebar-queue-title`, text: item.title })
                    ]),
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-sidebar-queue-remove`,
                        title: '移出稍后阅读',
                        'aria-label': `移出稍后阅读：${item.title}`,
                        'data-sidebar-queue-remove': item.id,
                        text: '×'
                    })
                ]);
            });
        },

        sidebarLiveRows() {
            return LiveTopics.topics.map((topic) => {
                const active = topic.id === this.topicId;
                const unread = LiveTopics.unreadIds.has(topic.id);
                return Dom.make('button', {
                    type: 'button',
                    className: `${NAME}-live-topic ${NAME}-sidebar-live-topic${active ? ' is-active' : ''}${unread ? ' is-unread' : ''}`,
                    title: topic.title,
                    'aria-current': active ? 'true' : undefined,
                    'data-sidebar-live-open': topic.id
                }, [
                    Dom.make('span', { className: `${NAME}-live-topic-title`, text: topic.title }),
                    Dom.make('span', { className: `${NAME}-live-topic-meta`, text: `${topic.categoryName} · ${LiveTopics.relativeTime(topic.lastPostedAt)} · ${topic.replies} 回复 · ${topic.views} 浏览` })
                ]);
            });
        },

        sidebarFavoriteRows() {
            return Favorites.items.map((item, index) => {
                const active = item.id === this.topicId;
                return Dom.make('div', { className: `${NAME}-sidebar-queue-row ${NAME}-sidebar-topic-row${active ? ' is-active' : ''}` }, [
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-sidebar-queue-item ${NAME}-sidebar-topic-item`,
                        title: item.title,
                        'data-sidebar-favorite-open': item.id
                    }, [
                        Dom.make('span', { className: `${NAME}-sidebar-queue-index`, text: String(index + 1) }),
                        Dom.make('span', { className: `${NAME}-sidebar-topic-copy` }, [
                            Dom.make('span', { className: `${NAME}-sidebar-queue-title`, text: item.title }),
                            Dom.make('span', { className: `${NAME}-sidebar-topic-meta`, text: formatFavoriteTime(item.at) })
                        ])
                    ]),
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-sidebar-queue-remove`,
                        title: '移除收藏',
                        'aria-label': `移除收藏：${item.title}`,
                        'data-sidebar-favorite-remove': item.id,
                        text: '×'
                    })
                ]);
            });
        },

        sidebarRecentRows() {
            return ReadMemory.items.slice(0, Prefs.value.recentLimit).map((item, index) => {
                const active = item.id === this.topicId;
                return Dom.make('div', { className: `${NAME}-sidebar-queue-row ${NAME}-sidebar-topic-row ${NAME}-sidebar-recent-row${active ? ' is-active' : ''}` }, [
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-sidebar-queue-item ${NAME}-sidebar-topic-item`,
                        title: `${item.title}\n${item.href || ''}`,
                        'data-sidebar-recent-open': item.id
                    }, [
                        Dom.make('span', { className: `${NAME}-sidebar-queue-index`, text: String(index + 1) }),
                        Dom.make('span', { className: `${NAME}-sidebar-topic-copy` }, [
                            Dom.make('span', { className: `${NAME}-sidebar-queue-title`, text: item.title }),
                            Dom.make('span', { className: `${NAME}-sidebar-topic-meta`, text: formatFavoriteTime(item.readAt || item.at) })
                        ])
                    ])
                ]);
            });
        },

        queueStepState() {
            return {
                count: ReadLaterQueue.items.length
            };
        },

        sidebarFrameAction(action, label, desc) {
            return Dom.make('button', {
                type: 'button',
                className: `${NAME}-sidebar-frame-action`,
                title: label,
                'aria-label': label,
                'data-sidebar-frame-action': action
            }, [
                Dom.make('span', { className: `${NAME}-sidebar-frame-label`, text: label }),
                Dom.make('span', { className: `${NAME}-sidebar-frame-desc`, text: desc })
            ]);
        },

        sidebarWidthPresetAction(preset) {
            const active = Prefs.value.width === preset.width;
            return Dom.make('button', {
                type: 'button',
                className: `${NAME}-sidebar-frame-action ${NAME}-sidebar-width-preset${active ? ' is-active' : ''}`,
                title: `${preset.label}：${preset.width}px`,
                'aria-label': `${preset.label}：${preset.width}px`,
                'aria-pressed': active ? 'true' : 'false',
                'data-sidebar-width-preset': preset.id
            }, [
                Dom.make('span', { className: `${NAME}-sidebar-frame-label`, text: preset.label }),
                Dom.make('span', { className: `${NAME}-sidebar-frame-desc`, text: `${preset.width}px · ${preset.help}` })
            ]);
        },

        formatSidebarFrameUrl(url) {
            if (!url) return '当前详情地址';
            try {
                const parsed = new URL(url, location.origin);
                return `${parsed.pathname}${parsed.search}${parsed.hash}` || parsed.href;
            } catch (_) {
                return url;
            }
        },

        currentTopicUrl() {
            if (!this.topicId) return '';
            return Urls.absolute(this.sourceHref || Urls.canonicalTopic(this.topicId));
        },

        trackSourceLabel(source) {
            return {
                live: '实时列表',
                topicLinks: '话题入口',
                readLater: '稍后阅读',
                recent: '最近查看',
                resume: '继续抽屉',
                favorites: '收藏话题'
            }[source] || '抽屉';
        },

        applyWidthPreset(presetId) {
            const preset = DRAWER_WIDTH_PRESETS.find((item) => item.id === presetId);
            if (!preset) return;
            this.persistSizeValue('width', preset.width);
            showToast(`抽屉宽度：${preset.label}`);
        },

        open(topicId, mode, sourceAnchor = null, sourceHref = '', options = {}) {
            this.ensure();
            const requestedSidebarPanel = Object.prototype.hasOwnProperty.call(options, 'sidebarPanel')
                ? options.sidebarPanel
                : undefined;
            LastViewedMarker.set(topicId, sourceAnchor);
            this.topicId = topicId;
            this.sourceHref = sourceHref || sourceAnchor?.getAttribute?.('href') || this.sourceHref || '';
            this.topicTitle = Favorites.bestTitle(
                topicId,
                options.title,
                sourceAnchor,
                Favorites.get(topicId)?.title || ReadMemory.get(topicId)?.title
            );
            this.mode = Prefs.mode(mode);
            this.resumeState = options.resumeState?.topicId === String(topicId) ? options.resumeState : null;
            this.trackViewSource = this.normalizeTrackSource(options.trackSource);
            this.job += 1;
            this.releaseLoadedContent();

            this.applyTheme();
            this.applySize();
            ReadMemory.remember(topicId, sourceAnchor, this.sourceHref, this.topicTitle, {
                preserveOrder: options.preserveRecentOrder === true
            });
            this.lockPage();
            this.shade.classList.add('is-open');
            this.root.classList.add('is-open');
            this.hideSettings();
            if (requestedSidebarPanel !== undefined) this.activeSidebarPanel = requestedSidebarPanel || '';
            Favorites.updateMeta(topicId, sourceAnchor, this.sourceHref, this.topicTitle);
            this.saveDrawerState();
            this.syncControls();
            this.renderSidebar();
            this.scheduleTrackView();

            if (this.mode === 'thread') this.paintThread(topicId);
            else this.paintSummary(topicId);
        },

        scheduleTrackView() {
            this.cancelTrackView();
            if (!this.topicId || this.root?.classList.contains('is-open') !== true) {
                this.setTrackViewStatus(null);
                return;
            }
            const disabledStatus = this.trackViewDisabledStatus();
            if (disabledStatus) {
                this.setTrackViewStatus(disabledStatus);
                return;
            }
            const topicId = String(this.topicId);
            const href = this.sourceHref || Urls.canonicalTopic(topicId);
            const source = this.trackViewSource || 'drawer-open';
            const job = this.job;
            const delay = this.trackViewDelay();
            this.startTrackViewCountdown(delay);
            this.trackViewTimer = window.setTimeout(() => {
                this.trackViewTimer = 0;
                this.stopTrackViewCountdown();
                const currentDisabledStatus = this.trackViewDisabledStatus();
                if (currentDisabledStatus) {
                    this.setTrackViewStatus(currentDisabledStatus);
                    return;
                }
                if (job !== this.job || this.topicId !== topicId || this.root?.classList.contains('is-open') !== true) return;
                this.setTrackViewStatus({ type: 'sending', text: '正在发送阅读计数...', progress: 1 });
                DiscourseReadTracker.markTopic(topicId, href, source).then((result) => {
                    if (job !== this.job || this.topicId !== topicId || this.root?.classList.contains('is-open') !== true) return;
                    if (result?.skipped) {
                        this.setTrackViewStatus({
                            type: 'done',
                            text: result.reason === 'starter-post-read-with-browser-pageview'
                                ? '话题计数原已生效'
                                : result.reason === 'recent-confirmed-refill'
                                    ? '补发后话题计数已生效'
                                    : '阅读计数近期已处理',
                            progress: 1
                        });
                    } else if (result?.accepted) {
                        this.setTrackViewStatus({
                            type: result.confirmed ? 'done' : 'sent',
                            text: result.confirmed ? '补发后话题计数已生效' : '阅读计数已发送',
                            progress: 1
                        });
                    } else {
                        this.setTrackViewStatus({ type: 'error', text: '阅读计数发送失败', progress: 1 });
                    }
                }).catch(() => {
                    if (job !== this.job || this.topicId !== topicId || this.root?.classList.contains('is-open') !== true) return;
                    this.setTrackViewStatus({ type: 'error', text: '阅读计数发送失败', progress: 1 });
                });
            }, delay);
        },

        normalizeTrackSource(source) {
            const value = String(source || '');
            return ['live', 'topicLinks', 'readLater', 'recent', 'resume', 'favorites'].includes(value) ? value : '';
        },

        canTrackCurrentSource() {
            return !this.trackViewDisabledStatus();
        },

        trackViewDisabledStatus() {
            if (!Prefs.value.trackDrawerViews) {
                return {
                    type: 'disabled',
                    text: '抽屉计入后台未开启',
                    progress: 0,
                    showProgress: false
                };
            }
            const field = this.trackSourcePref(this.trackViewSource);
            if (!field || Prefs.value[field] === false) {
                return {
                    type: 'disabled',
                    text: '当前入口未计入后台',
                    progress: 0,
                    showProgress: false
                };
            }
            return null;
        },

        trackSourcePref(source) {
            return {
                live: 'trackDrawerViewsLive',
                topicLinks: 'trackDrawerViewsTopicLinks',
                readLater: 'trackDrawerViewsReadLater',
                recent: 'trackDrawerViewsRecent',
                resume: 'trackDrawerViewsResume',
                favorites: 'trackDrawerViewsFavorites'
            }[source] || '';
        },

        trackViewDelay() {
            const min = DRAWER_TRACK_VIEW_DELAY_MIN;
            const max = Math.max(min, DRAWER_TRACK_VIEW_DELAY_MAX);
            return Math.round(min + Math.random() * (max - min));
        },

        cancelTrackView() {
            if (this.trackViewTimer) {
                window.clearTimeout(this.trackViewTimer);
                this.trackViewTimer = 0;
            }
            this.stopTrackViewCountdown();
            this.setTrackViewStatus(null);
        },

        startTrackViewCountdown(delay) {
            this.stopTrackViewCountdown();
            this.trackViewCountdownDuration = Math.max(0, Number(delay) || 0);
            this.trackViewDeadline = Date.now() + this.trackViewCountdownDuration;
            this.updateTrackViewCountdown();
            this.trackViewCountdownTimer = window.setInterval(() => this.updateTrackViewCountdown(), 250);
        },

        stopTrackViewCountdown() {
            if (this.trackViewCountdownTimer) {
                window.clearInterval(this.trackViewCountdownTimer);
                this.trackViewCountdownTimer = 0;
            }
            this.trackViewDeadline = 0;
            this.trackViewCountdownDuration = 0;
        },

        updateTrackViewCountdown() {
            if (!this.trackViewDeadline) return;
            const remaining = Math.max(0, this.trackViewDeadline - Date.now());
            const seconds = Math.ceil(remaining / 100) / 10;
            const duration = Math.max(1, this.trackViewCountdownDuration || remaining || 1);
            this.setTrackViewStatus({
                type: 'pending',
                text: `阅读计数将在 ${seconds.toFixed(1)} 秒后发送`,
                remainingMs: remaining,
                progress: 1 - remaining / duration
            });
            if (remaining <= 0) this.stopTrackViewCountdown();
        },

        setTrackViewStatus(status) {
            this.trackViewStatus = status;
            this.syncTopicStatus();
        },

        close() {
            const shouldRevealLastViewed = !!this.topicId;
            this.job += 1;
            this.stopAutoScroll('closed');
            this.cancelTrackView();
            this.topicId = '';
            this.sourceHref = '';
            this.topicTitle = '';
            this.resumeState = null;
            this.trackViewSource = '';
            this.trackViewStatus = null;
            this.activeSidebarPanel = '';
            this.currentStats = null;
            this.shade?.classList.remove('is-open');
            this.root?.classList.remove('is-open');
            this.sidebar?.classList.remove('is-open');
            this.releaseLoadedContent();
            this.unlockPage();
            FloatingPrefs.syncMemoryMonitor?.();
            if (shouldRevealLastViewed) LastViewedMarker.reveal();
        },

        releaseLoadedContent() {
            this.stopAutoScroll('content');
            this.cleanupAutoScrollFrame();
            const cleanup = this.loadedContentCleanup;
            this.loadedContentCleanup = null;
            if (typeof cleanup === 'function') {
                try {
                    cleanup();
                } catch (error) {
                    console.warn(`${LOG_PREFIX} 抽屉内容清理失败`, error);
                }
            }
            this.frameControls = null;
            if (this.activeSidebarPanel === 'frameTools') this.activeSidebarPanel = '';
            if (!this.body) return;
            this.body.querySelectorAll('iframe').forEach((frame) => {
                try {
                    frame.src = 'about:blank';
                    frame.removeAttribute('src');
                } catch (_) {
                    // 尽力释放 iframe，降低关闭抽屉后的资源占用。
                }
            });
            this.body.replaceChildren();
        },

        onClick(event) {
            const action = event.target.closest('[data-action]')?.dataset.action;
            if (action === 'close') {
                this.close();
                return;
            }
            if (action === 'toggle-auto-scroll') {
                this.toggleAutoScroll();
                return;
            }
            if (action === 'favorite') {
                if (!this.topicId) return;
                const result = Favorites.toggle(this.topicId, LastViewedMarker.anchor, this.sourceHref, this.topicTitle);
                this.syncControls();
                FloatingPrefs.sync();
                showToast(result.active ? '已收藏话题' : '已取消收藏');
                return;
            }
            if (action === 'retry-current') {
                if (this.topicId) this.open(this.topicId, this.mode, LastViewedMarker.anchor, this.sourceHref, { trackSource: this.trackViewSource });
                return;
            }
            if (action === 'copy-current-url') {
                copyText(this.currentTopicUrl(), '已复制链接');
                return;
            }
            if (action === 'open-current-url') {
                const href = this.currentTopicUrl();
                if (!href) return;
                const opened = window.open(href, '_blank', 'noopener,noreferrer');
                if (opened) opened.opener = null;
                return;
            }

            const summaryTab = event.target.closest('[data-summary-tab]')?.dataset.summaryTab;
            if (summaryTab) {
                SummaryCard.activate(event.target.closest(`.${NAME}-summary`), summaryTab);
                return;
            }

            const summaryStep = event.target.closest('[data-summary-search-step]')?.dataset.summarySearchStep;
            if (summaryStep) {
                SummaryCard.step(event.target.closest(`.${NAME}-summary`), Number(summaryStep));
                return;
            }

            if (event.target.closest('[data-summary-search-clear]')) {
                SummaryCard.clearSearch(event.target.closest(`.${NAME}-summary`));
                return;
            }

            const mode = event.target.closest('[data-mode]')?.dataset.mode;
            if (mode) {
                Prefs.save({ mode });
                FloatingPrefs.sync();
                if (this.topicId) this.open(this.topicId, mode, LastViewedMarker.anchor, this.sourceHref, { trackSource: this.trackViewSource });
                return;
            }

            const defaultMode = event.target.closest('[data-default-mode]')?.dataset.defaultMode;
            if (defaultMode) {
                Prefs.save({ mode: defaultMode });
                this.hideSettings();
                FloatingPrefs.sync();
                if (this.topicId) this.open(this.topicId, defaultMode, LastViewedMarker.anchor, this.sourceHref, { trackSource: this.trackViewSource });
                return;
            }

            const threadSource = event.target.closest('[data-thread-source]')?.dataset.threadSource;
            if (threadSource) {
                Prefs.save({ threadSource });
                this.syncControls();
                FloatingPrefs.sync();
                if (this.topicId && this.mode === 'thread') {
                    this.open(this.topicId, this.mode, LastViewedMarker.anchor, this.sourceHref, { trackSource: this.trackViewSource });
                }
                return;
            }

            const autoScrollSpeed = event.target.closest('[data-auto-scroll-speed]')?.dataset.autoScrollSpeed;
            if (autoScrollSpeed) {
                Prefs.save({ autoScrollSpeed });
                this.applyAutoScrollSpeedPreference();
                this.syncControls();
                FloatingPrefs.sync();
                showToast(`自动滚动速度：${AUTO_SCROLL_SPEED_LEVELS[Prefs.value.autoScrollSpeed].label}`);
                return;
            }

            const sizeStep = event.target.closest('[data-size-step]');
            if (sizeStep) {
                const next = SizeControls.fromStep(sizeStep);
                if (next) this.persistSizeValue(next.field, next.value);
                return;
            }

            const sizeTrack = event.target.closest('[data-size-track]');
            if (sizeTrack) {
                const next = SizeControls.fromTrack(sizeTrack, event.clientX);
                if (next) this.persistSizeValue(next.field, next.value);
                return;
            }

        },

        bindFrameFocusRelease(surface) {
            if (!surface) return;
            const release = () => this.releaseFrameFocus();
            surface.addEventListener('pointerover', release, true);
            surface.addEventListener('mouseover', release, true);
            surface.addEventListener('focusin', release, true);
        },

        releaseFrameFocus() {
            const active = document.activeElement;
            if (!(active instanceof HTMLElement) || active.tagName !== 'IFRAME' || !this.body?.contains(active)) return false;
            try {
                active.contentWindow?.blur?.();
            } catch (_) {
                // 跨文档焦点释放失败时，仍继续释放 iframe 元素本身。
            }
            try {
                active.blur();
            } catch (_) {
                // 个别浏览器可能不允许直接 blur iframe，后续 focus 抽屉兜底。
            }
            try {
                window.focus();
            } catch (_) {
                // window.focus 不是关键路径，失败时忽略。
            }
            try {
                this.root?.focus?.({ preventScroll: true });
            } catch (_) {
                this.root?.focus?.();
            }
            return true;
        },

        sidebarActionTarget(target) {
            if (!(target instanceof Element)) return null;
            return target.closest([
                '[data-sidebar-copy]',
                '[data-sidebar-action]',
                '[data-sidebar-live-action]',
                '[data-sidebar-frame-action]',
                '[data-sidebar-width-preset]',
                '[data-sidebar-queue-remove]',
                '[data-sidebar-queue-clear]',
                '[data-sidebar-page-nav-clear]',
                '[data-sidebar-page-nav-add]',
                '[data-sidebar-page-nav-defaults]',
                '[data-sidebar-page-nav-edit]',
                '[data-sidebar-page-nav-blank]',
                '[data-sidebar-page-nav-remove]',
                '[data-sidebar-page-nav-open]',
                '[data-sidebar-favorite-remove]',
                '[data-sidebar-favorite-open]',
                '[data-sidebar-recent-open]',
                '[data-sidebar-live-open]',
                '[data-sidebar-queue-open]',
                `.${NAME}-sidebar-settings-panel [data-pref-action]`,
                `.${NAME}-sidebar-settings-panel [data-pref-tab-scroll]`,
                `.${NAME}-sidebar-settings-panel [data-pref-tab]`,
                `.${NAME}-sidebar-settings-panel [data-live-category-token]`,
                `.${NAME}-sidebar-settings-panel [data-pref-toggle]`,
                `.${NAME}-sidebar-settings-panel [data-default-mode]`,
                `.${NAME}-sidebar-settings-panel [data-thread-source]`,
                `.${NAME}-sidebar-settings-panel [data-auto-scroll-speed]`,
                `.${NAME}-sidebar-settings-panel [data-size-step]`,
                `.${NAME}-sidebar-settings-panel [data-tuning-step]`,
                `.${NAME}-sidebar-settings-panel [data-size-track]`,
                `.${NAME}-sidebar-settings-panel [data-queue-remove]`,
                `.${NAME}-sidebar-settings-panel [data-queue-open]`,
                `.${NAME}-sidebar-settings-panel [data-page-nav-open]`,
                `.${NAME}-sidebar-settings-panel [data-page-nav-blank]`,
                `.${NAME}-sidebar-settings-panel [data-page-nav-edit]`,
                `.${NAME}-sidebar-settings-panel [data-page-nav-remove]`,
                `.${NAME}-sidebar-settings-panel [data-favorite-remove]`,
                `.${NAME}-sidebar-settings-panel [data-favorite-open]`,
                `.${NAME}-sidebar-settings-panel [data-recent-open]`
            ].join(','));
        },

        onSidebarPointerDown(event) {
            if (event.button !== 0 || event.pointerType === 'touch') return;
            if (!(event.target instanceof Element)) return;
            if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
            const target = this.sidebarActionTarget(event.target);
            if (!target) return;
            const control = target.closest('button, a, [role="button"]');
            if (control?.matches?.(':disabled, [aria-disabled="true"]')) return;

            this.releaseFrameFocus();
            this.sidebarPointerClickUntil = Date.now() + 600;
            event.preventDefault();
            event.stopPropagation();
            this.onSidebarClick(event);
        },

        shouldSkipSidebarClick(event) {
            if (!this.sidebarPointerClickUntil) return false;
            if (Date.now() > this.sidebarPointerClickUntil) {
                this.sidebarPointerClickUntil = 0;
                return false;
            }
            if (!this.sidebarActionTarget(event.target)) return false;
            this.sidebarPointerClickUntil = 0;
            event.preventDefault();
            event.stopPropagation();
            return true;
        },

        hideSettings() {
            if (this.activeSidebarPanel !== 'settings') return false;
            this.activeSidebarPanel = '';
            this.renderSidebar();
            FloatingPrefs.syncMemoryMonitor?.();
            return true;
        },

        onInput(event) {
            if (event.target.closest(`.${NAME}-sidebar-settings-panel`)) {
                FloatingPrefs.onInput(event);
                return;
            }

            const summarySearch = event.target.closest('[data-summary-search]');
            if (summarySearch) {
                SummaryCard.search(summarySearch.closest(`.${NAME}-summary`), summarySearch.value);
                return;
            }

            const sizeInput = event.target.closest('[data-size-input]');
            if (!sizeInput) return;
            const next = event.type === 'input'
                ? SizeControls.fromTyping(sizeInput)
                : SizeControls.fromInput(sizeInput);
            if (next) this.persistSizeValue(next.field, next.value);
        },

        onSidebarClick(event) {
            if (event.type === 'click' && this.shouldSkipSidebarClick(event)) return;

            const copyTarget = event.target.closest('[data-sidebar-copy]');
            if (copyTarget) {
                event.preventDefault();
                copyText(copyTarget.getAttribute('data-sidebar-copy'), copyTarget.getAttribute('data-sidebar-copy-message') || '已复制');
                return;
            }

            const action = event.target.closest('[data-sidebar-action]')?.dataset.sidebarAction;
            if (action === 'dockScrollUp' || action === 'dockScrollDown') {
                event.preventDefault();
                const stack = this.sidebar?.querySelector(`.${NAME}-sidebar-tool-stack`);
                stack?.scrollBy({ top: action === 'dockScrollDown' ? 90 : -90, behavior: 'smooth' });
                return;
            }

            if (action === 'settings') {
                event.preventDefault();
                this.activeSidebarPanel = this.activeSidebarPanel === 'settings' ? '' : 'settings';
                this.renderSidebar();
                FloatingPrefs.sync();
                return;
            }

            if (event.target.closest(`.${NAME}-sidebar-settings-panel`)) {
                FloatingPrefs.onClick(event);
                return;
            }

            if (action === 'live') {
                event.preventDefault();
                this.hideSettings();
                this.activeSidebarPanel = this.activeSidebarPanel === 'live' ? '' : 'live';
                this.renderSidebar();
                if (this.activeSidebarPanel === 'live' && !LiveTopics.topics.length && !LiveTopics.inFlight) {
                    LiveTopics.fetchNow({ manual: true });
                }
                return;
            }

            if (action === 'reloadCurrent') {
                event.preventDefault();
                if (this.topicId) this.open(this.topicId, this.mode || Prefs.value.mode, LastViewedMarker.anchor, this.sourceHref, { trackSource: this.trackViewSource });
                return;
            }

            if (action === 'readLater') {
                event.preventDefault();
                this.hideSettings();
                this.activeSidebarPanel = this.activeSidebarPanel === 'readLater' ? '' : 'readLater';
                this.renderSidebar();
                return;
            }

            if (action === 'pageNav') {
                event.preventDefault();
                this.hideSettings();
                this.activeSidebarPanel = this.activeSidebarPanel === 'pageNav' ? '' : 'pageNav';
                this.renderSidebar();
                return;
            }

            if (action === 'favorites') {
                event.preventDefault();
                this.hideSettings();
                this.activeSidebarPanel = this.activeSidebarPanel === 'favorites' ? '' : 'favorites';
                this.renderSidebar();
                return;
            }

            if (action === 'topicStats') {
                event.preventDefault();
                this.hideSettings();
                this.activeSidebarPanel = this.activeSidebarPanel === 'topicStats' ? '' : 'topicStats';
                this.renderSidebar();
                return;
            }

            if (action === 'recent') {
                event.preventDefault();
                this.hideSettings();
                this.activeSidebarPanel = this.activeSidebarPanel === 'recent' ? '' : 'recent';
                this.renderSidebar();
                return;
            }

            if (action === 'frameTools') {
                event.preventDefault();
                if (!this.frameControls) return;
                this.hideSettings();
                this.activeSidebarPanel = this.activeSidebarPanel === 'frameTools' ? '' : 'frameTools';
                this.renderSidebar();
                return;
            }

            if (action === 'widthPresets') {
                event.preventDefault();
                this.hideSettings();
                this.activeSidebarPanel = this.activeSidebarPanel === 'widthPresets' ? '' : 'widthPresets';
                this.renderSidebar();
                return;
            }

            if (action === 'support') {
                event.preventDefault();
                this.hideSettings();
                this.activeSidebarPanel = this.activeSidebarPanel === 'support' ? '' : 'support';
                this.renderSidebar();
                return;
            }

            if (action === 'openOriginal') {
                event.preventDefault();
                const href = Urls.absolute(this.sourceHref || Urls.canonicalTopic(this.topicId));
                if (!href) return;
                const opened = window.open(href, '_blank', 'noopener,noreferrer');
                if (opened) opened.opener = null;
                return;
            }

            if (action === 'close') {
                event.preventDefault();
                this.close();
                return;
            }

            const liveAction = event.target.closest('[data-sidebar-live-action]')?.dataset.sidebarLiveAction;
            if (liveAction === 'refresh') {
                event.preventDefault();
                LiveTopics.fetchNow({ manual: true });
                return;
            }
            if (liveAction === 'close') {
                event.preventDefault();
                this.activeSidebarPanel = '';
                this.renderSidebar();
                return;
            }

            const frameAction = event.target.closest('[data-sidebar-frame-action]')?.dataset.sidebarFrameAction;
            if (frameAction) {
                event.preventDefault();
                this.frameControls?.run(frameAction);
                return;
            }

            const widthPreset = event.target.closest('[data-sidebar-width-preset]')?.dataset.sidebarWidthPreset;
            if (widthPreset) {
                event.preventDefault();
                this.applyWidthPreset(widthPreset);
                return;
            }

            const removeId = event.target.closest('[data-sidebar-queue-remove]')?.dataset.sidebarQueueRemove;
            if (removeId) {
                event.preventDefault();
                if (!ReadLaterQueue.remove(removeId)) return;
                this.syncReadLaterState();
                FloatingPrefs.syncQueueState();
                MiniEye.syncLaterButton(MiniEye.button?.dataset.topicId || '');
                showToast('已移出稍后阅读');
                return;
            }

            const clear = event.target.closest('[data-sidebar-queue-clear]');
            if (clear) {
                event.preventDefault();
                if (!ReadLaterQueue.items.length) return;
                if (!window.confirm('确定清空稍后阅读队列吗？')) return;
                if (!ReadLaterQueue.clear()) return;
                this.syncReadLaterState();
                FloatingPrefs.syncQueueState();
                MiniEye.syncLaterButton(MiniEye.button?.dataset.topicId || '');
                showToast('已清空稍后阅读队列');
                return;
            }

            const clearPageNav = event.target.closest('[data-sidebar-page-nav-clear]');
            if (clearPageNav) {
                event.preventDefault();
                if (!PageNav.items.length) return;
                if (!window.confirm('确定清空页面导航吗？')) return;
                PageNav.clear();
                this.renderSidebar();
                FloatingPrefs.sync();
                showToast('已清空页面导航');
                return;
            }

            const addPageNav = event.target.closest('[data-sidebar-page-nav-add]');
            if (addPageNav) {
                event.preventDefault();
                const result = PageNav.addCurrent();
                this.renderSidebar();
                FloatingPrefs.sync();
                showToast(!result?.item ? '当前页面无法添加' : result.existing ? '当前页面已在导航中' : '已添加当前页面');
                return;
            }

            const restorePageNav = event.target.closest('[data-sidebar-page-nav-defaults]');
            if (restorePageNav) {
                event.preventDefault();
                PageNav.restoreDefaults();
                this.renderSidebar();
                FloatingPrefs.sync();
                showToast('已恢复默认导航');
                return;
            }

            const editPageNav = event.target.closest('[data-sidebar-page-nav-edit]')?.dataset.sidebarPageNavEdit;
            if (editPageNav) {
                event.preventDefault();
                const result = PageNav.editWithPrompt(editPageNav);
                if (result.cancelled) return;
                showToast(PageNav.editResultMessage(result));
                return;
            }

            const blankPageNav = event.target.closest('[data-sidebar-page-nav-blank]')?.dataset.sidebarPageNavBlank;
            if (blankPageNav) {
                event.preventDefault();
                PageNav.open(blankPageNav, { newTab: true });
                return;
            }

            const removePageNav = event.target.closest('[data-sidebar-page-nav-remove]')?.dataset.sidebarPageNavRemove;
            if (removePageNav) {
                event.preventDefault();
                const next = PageNav.isCurrent(removePageNav) ? PageNav.neighbor(removePageNav) : null;
                if (!PageNav.remove(removePageNav)) return;
                this.renderSidebar();
                FloatingPrefs.sync();
                showToast('已关闭导航标签');
                if (next) window.location.assign(next.href);
                return;
            }

            const openPageNav = event.target.closest('[data-sidebar-page-nav-open]')?.dataset.sidebarPageNavOpen;
            if (openPageNav) {
                event.preventDefault();
                PageNav.open(openPageNav);
                return;
            }

            const removeFavorite = event.target.closest('[data-sidebar-favorite-remove]')?.dataset.sidebarFavoriteRemove;
            if (removeFavorite) {
                event.preventDefault();
                Favorites.remove(removeFavorite);
                this.syncControls();
                FloatingPrefs.sync();
                showToast('已移除收藏');
                return;
            }

            const openFavorite = event.target.closest('[data-sidebar-favorite-open]')?.dataset.sidebarFavoriteOpen;
            if (openFavorite) {
                event.preventDefault();
                const item = Favorites.get(openFavorite);
                if (!item || item.id === this.topicId) return;
                this.open(item.id, this.mode || Prefs.value.mode, null, item.href, {
                    title: item.title,
                    sidebarPanel: 'favorites',
                    trackSource: 'favorites'
                });
                return;
            }

            const openRecent = event.target.closest('[data-sidebar-recent-open]')?.dataset.sidebarRecentOpen;
            if (openRecent) {
                event.preventDefault();
                const item = ReadMemory.get(openRecent);
                if (!item || item.id === this.topicId) return;
                this.open(item.id, this.mode || Prefs.value.mode, null, item.href, {
                    title: item.title,
                    sidebarPanel: 'recent',
                    preserveRecentOrder: true,
                    trackSource: 'recent'
                });
                return;
            }

            const openLive = event.target.closest('[data-sidebar-live-open]')?.dataset.sidebarLiveOpen;
            if (openLive) {
                event.preventDefault();
                const topic = LiveTopics.topics.find((item) => item.id === openLive);
                if (!topic || topic.id === this.topicId) return;
                LiveTopics.unreadIds.delete(topic.id);
                LiveTopics.syncButton();
                this.open(topic.id, this.mode || Prefs.value.mode, null, topic.href, {
                    title: topic.title,
                    sidebarPanel: 'live',
                    trackSource: 'live'
                });
                return;
            }

            const openId = event.target.closest('[data-sidebar-queue-open]')?.dataset.sidebarQueueOpen;
            if (!openId) return;
            event.preventDefault();
            const item = ReadLaterQueue.get(openId);
            if (!item || item.id === this.topicId) return;
            this.open(item.id, this.mode || Prefs.value.mode, null, item.href, {
                title: item.title,
                sidebarPanel: 'readLater',
                trackSource: 'readLater'
            });
        },

        syncControls() {
            if (!this.root) return;
            this.root.querySelectorAll('[data-mode]').forEach((button) => {
                const active = button.dataset.mode === this.mode;
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            this.root.querySelectorAll('[data-default-mode]').forEach((button) => {
                const active = button.dataset.defaultMode === Prefs.value.mode;
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            this.root.querySelectorAll('[data-thread-source]').forEach((button) => {
                const active = button.dataset.threadSource === Prefs.value.threadSource;
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            this.root.querySelectorAll('[data-auto-scroll-speed]').forEach((button) => {
                const active = button.dataset.autoScrollSpeed === Prefs.value.autoScrollSpeed;
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-pressed', active ? 'true' : 'false');
            });

            const subtitle = this.root.querySelector('[data-role="default-mode"]');
            const threadSourceLabel = THREAD_SOURCES[Prefs.value.threadSource].label;
            const autoScrollLabel = AUTO_SCROLL_SPEED_LEVELS[Prefs.value.autoScrollSpeed]?.label || AUTO_SCROLL_SPEED_LEVELS[AUTO_SCROLL_DEFAULT_SPEED_LEVEL].label;
            if (subtitle) subtitle.textContent = `默认：${MODES[Prefs.value.mode].label}模式 · 详情：${threadSourceLabel} · 滚动：${autoScrollLabel} · ${Prefs.value.width}x${Prefs.value.height}vh`;
            const favoriteButton = this.root.querySelector('[data-action="favorite"]');
            if (favoriteButton) {
                const active = Favorites.has(this.topicId);
                favoriteButton.classList.toggle('is-favorite-active', active);
                favoriteButton.setAttribute('aria-pressed', active ? 'true' : 'false');
                favoriteButton.setAttribute('title', active ? '取消收藏话题' : '收藏话题');
                favoriteButton.setAttribute('aria-label', active ? '取消收藏话题' : '收藏话题');
                const star = favoriteButton.querySelector(`.${NAME}-favorite-star`);
                if (star) star.textContent = active ? '★' : '☆';
            }
            this.syncTopicStatus();
            this.syncFooterActions();
            if (this.activeSidebarPanel === 'settings') {
                const count = this.sidebar?.querySelector(`.${NAME}-sidebar-settings-panel .${NAME}-sidebar-panel-count`);
                if (count) count.textContent = `${Prefs.value.width}px`;
            } else {
                this.renderSidebar();
            }

            SizeControls.sync(this.root);
        },

        renderSidebar() {
            if (!this.sidebar) return;
            const drawerOpen = this.root?.classList.contains('is-open') === true && !!this.topicId;
            if (!drawerOpen) {
                this.sidebar.classList.remove(
                    'is-open',
                    'is-panel-open',
                    'is-settings-panel',
                    'is-page-nav-panel',
                    'is-read-later-panel',
                    'is-favorites-panel',
                    'is-recent-panel',
                    'is-frame-tools-panel',
                    'is-width-presets-panel',
                    'is-support-panel',
                    'is-topic-stats-panel',
                    'is-live-panel'
                );
                this.sidebar.replaceChildren();
                return;
            }

            if (this.activeSidebarPanel === 'frameTools' && !this.frameControls) this.activeSidebarPanel = '';
            const scrollState = this.captureSidebarScroll();
            const queueState = this.queueStepState();
            const count = queueState.count;
            const settingsOpen = this.activeSidebarPanel === 'settings';
            const readLaterOpen = this.activeSidebarPanel === 'readLater';
            const pageNavOpen = this.activeSidebarPanel === 'pageNav';
            const favoritesOpen = this.activeSidebarPanel === 'favorites';
            const recentOpen = this.activeSidebarPanel === 'recent';
            const liveOpen = this.activeSidebarPanel === 'live';
            const topicStatsOpen = this.activeSidebarPanel === 'topicStats';
            const frameToolsOpen = this.activeSidebarPanel === 'frameTools';
            const widthPresetsOpen = this.activeSidebarPanel === 'widthPresets';
            const supportOpen = this.activeSidebarPanel === 'support';
            const pageNavCount = PageNav.items.length;
            const favoritesCount = Favorites.items.length;
            const favoriteRows = favoritesOpen ? this.sidebarFavoriteRows() : [];
            const recentRows = recentOpen ? this.sidebarRecentRows() : [];
            const liveRows = liveOpen ? this.sidebarLiveRows() : [];
            const recentCount = Math.min(ReadMemory.items.length, Prefs.value.recentLimit);
            const liveCount = LiveTopics.topics.length;
            const rows = this.sidebarQueueRows();
            const pageRows = PageNav.items.map((item, index) => {
                const active = PageNav.isCurrent(item);
                const displayHref = PageNav.displayHref(item.href);
                return Dom.make('div', { className: `${NAME}-sidebar-queue-row ${NAME}-sidebar-page-row${active ? ' is-active' : ''}` }, [
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-sidebar-queue-item ${NAME}-sidebar-page-item`,
                        title: `${item.title} · ${displayHref}`,
                        'aria-current': active ? 'page' : undefined,
                        'data-sidebar-page-nav-open': item.id
                    }, [
                        Dom.make('span', { className: `${NAME}-sidebar-queue-index`, text: String(index + 1) }),
                        Dom.make('span', { className: `${NAME}-sidebar-queue-title`, text: item.title })
                    ]),
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-sidebar-page-action`,
                        title: '编辑导航标题和地址',
                        'aria-label': `编辑导航标题和地址：${item.title}`,
                        'data-sidebar-page-nav-edit': item.id,
                        text: '编'
                    }),
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-sidebar-page-action`,
                        title: '新标签打开',
                        'aria-label': `新标签打开：${item.title}`,
                        'data-sidebar-page-nav-blank': item.id,
                        text: '↗'
                    }),
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-sidebar-queue-remove`,
                        title: '关闭导航标签',
                        'aria-label': `关闭导航标签：${item.title}`,
                        'data-sidebar-page-nav-remove': item.id,
                        text: '×'
                    })
                ]);
            });

            const dockTools = [
                this.sidebarTool('support', 'support', supportOpen ? '收起支持我' : '展开支持我', {
                    active: supportOpen,
                    pressed: supportOpen
                }),
                this.sidebarTool('settings', 'settings', settingsOpen ? '收起设置' : '展开设置', {
                    active: settingsOpen,
                    pressed: settingsOpen
                }),
                this.sidebarTool('live', 'live', liveOpen ? '收起实时最新' : '展开实时最新', {
                    active: liveOpen,
                    pressed: liveOpen,
                    count: liveCount
                }),
                this.sidebarTool('topicStats', 'stats', topicStatsOpen ? '收起话题统计' : '展开话题统计', {
                    active: topicStatsOpen,
                    pressed: topicStatsOpen
                }),
                this.sidebarTool('favorites', 'favorite', favoritesOpen ? '收起收藏话题' : '展开收藏话题', {
                    active: favoritesOpen,
                    pressed: favoritesOpen,
                    count: favoritesCount
                }),
                this.sidebarTool('recent', 'recent', recentOpen ? '收起最近查看' : '展开最近查看', {
                    active: recentOpen,
                    pressed: recentOpen,
                    count: recentCount
                }),
                this.sidebarTool('pageNav', 'nav', pageNavOpen ? '收起页面导航' : '展开页面导航', {
                    active: pageNavOpen,
                    pressed: pageNavOpen,
                    count: pageNavCount
                }),
                this.sidebarTool('widthPresets', 'width', widthPresetsOpen ? '收起宽度预设' : '展开宽度预设', {
                    active: widthPresetsOpen,
                    pressed: widthPresetsOpen
                }),
                this.sidebarTool('reloadCurrent', 'reload', '重新加载当前话题')
            ];
            if (this.mode === 'thread') {
                dockTools.push(this.sidebarTool('frameTools', 'tools', frameToolsOpen ? '收起详情工具' : '展开详情工具', {
                    active: frameToolsOpen,
                    pressed: frameToolsOpen,
                    disabled: !this.frameControls
                }));
            }
            dockTools.push(
                this.sidebarTool('readLater', 'queue', readLaterOpen ? '收起稍后阅读' : '展开稍后阅读', {
                    active: readLaterOpen,
                    pressed: readLaterOpen,
                    count
                }),
                this.sidebarTool('openOriginal', 'open', '新标签打开原帖'),
                this.sidebarTool('close', 'close', '关闭抽屉')
            );

            const rail = Dom.make('nav', { className: `${NAME}-sidebar-rail`, 'aria-label': '抽屉工具' }, [
                this.sidebarTool('dockScrollUp', 'dock-up', '向上滚动 Dock', { dockControl: true }),
                Dom.make('div', { className: `${NAME}-sidebar-tool-stack` }, dockTools),
                this.sidebarTool('dockScrollDown', 'dock-down', '向下滚动 Dock', { dockControl: true })
            ]);
            rail.addEventListener('wheel', (event) => {
                const stack = rail.querySelector(`.${NAME}-sidebar-tool-stack`);
                if (!stack) return;
                event.preventDefault();
                stack.scrollBy({ top: event.deltaY, behavior: 'auto' });
            }, { passive: false });

            const settingsPanel = settingsOpen ? FloatingPrefs.buildDockSettingsPanel() : null;
            const readLaterPanel = Dom.make('section', { className: `${NAME}-sidebar-panel`, 'aria-label': '稍后阅读', 'data-sidebar-panel': 'readLater' }, [
                Dom.make('div', { className: `${NAME}-sidebar-panel-head` }, [
                    Dom.make('span', { className: `${NAME}-sidebar-panel-title`, text: '稍后阅读' }),
                    Dom.make('span', { className: `${NAME}-sidebar-panel-count`, 'data-sidebar-queue-count': '1', text: String(count) }),
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-sidebar-panel-clear`,
                        title: '清空队列',
                        'aria-label': '清空队列',
                        'data-sidebar-queue-clear': '1',
                        text: '清空'
                    })
                ]),
                Dom.make('div', { className: `${NAME}-queue-keep-hint ${NAME}-sidebar-queue-hint`, text: READ_LATER_KEEP_HINT }),
                Dom.make('div', { className: `${NAME}-sidebar-queue-list`, 'data-sidebar-queue-list': '1' }, rows.length
                    ? rows
                    : Dom.make('div', { className: `${NAME}-sidebar-empty`, text: '暂无稍后阅读' }))
            ]);
            const pageNavPanel = Dom.make('section', { className: `${NAME}-sidebar-panel ${NAME}-sidebar-page-panel`, 'aria-label': '页面导航' }, [
                Dom.make('div', { className: `${NAME}-sidebar-panel-head` }, [
                    Dom.make('span', { className: `${NAME}-sidebar-panel-title`, text: '页面导航' }),
                    Dom.make('span', { className: `${NAME}-sidebar-panel-count`, text: String(pageNavCount) })
                ]),
                Dom.make('div', { className: `${NAME}-sidebar-panel-actions` }, [
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-sidebar-panel-clear`,
                        title: '添加当前页面',
                        'aria-label': '添加当前页面',
                        'data-sidebar-page-nav-add': '1',
                        text: '添加'
                    }),
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-sidebar-panel-clear`,
                        title: '恢复默认导航',
                        'aria-label': '恢复默认导航',
                        'data-sidebar-page-nav-defaults': '1',
                        text: '默认'
                    }),
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-sidebar-panel-clear`,
                        title: '清空导航',
                        'aria-label': '清空导航',
                        'data-sidebar-page-nav-clear': '1',
                        text: '清空'
                    })
                ]),
                Dom.make('div', { className: `${NAME}-sidebar-queue-list ${NAME}-sidebar-page-list` }, pageRows.length
                    ? pageRows
                    : Dom.make('div', { className: `${NAME}-sidebar-empty`, text: '暂无页面导航' }))
            ]);
            const favoritesPanel = Dom.make('section', { className: `${NAME}-sidebar-panel ${NAME}-sidebar-favorites-panel`, 'aria-label': '收藏话题' }, [
                Dom.make('div', { className: `${NAME}-sidebar-panel-head` }, [
                    Dom.make('span', { className: `${NAME}-sidebar-panel-title`, text: '收藏话题' }),
                    Dom.make('span', { className: `${NAME}-sidebar-panel-count`, text: String(favoritesCount) })
                ]),
                Dom.make('div', { className: `${NAME}-sidebar-queue-list ${NAME}-sidebar-topic-list` }, favoriteRows.length
                    ? favoriteRows
                    : Dom.make('div', { className: `${NAME}-sidebar-empty`, text: '暂无收藏话题' }))
            ]);
            const recentPanel = Dom.make('section', { className: `${NAME}-sidebar-panel ${NAME}-sidebar-recent-panel`, 'aria-label': '最近查看' }, [
                Dom.make('div', { className: `${NAME}-sidebar-panel-head` }, [
                    Dom.make('span', { className: `${NAME}-sidebar-panel-title`, text: '最近查看' }),
                    Dom.make('span', { className: `${NAME}-sidebar-panel-count`, text: String(recentCount) })
                ]),
                Dom.make('div', { className: `${NAME}-sidebar-queue-list ${NAME}-sidebar-topic-list` }, recentRows.length
                    ? recentRows
                    : Dom.make('div', { className: `${NAME}-sidebar-empty`, text: '暂无最近查看' }))
            ]);
            const livePanel = Dom.make('section', { className: `${NAME}-sidebar-panel ${NAME}-sidebar-live-panel`, 'aria-label': '实时最新' }, [
                Dom.make('div', { className: `${NAME}-sidebar-panel-head` }, [
                    Dom.make('span', { className: `${NAME}-sidebar-panel-title`, text: '实时最新' }),
                    Dom.make('span', { className: `${NAME}-sidebar-panel-count`, text: LiveTopics.inFlight ? '刷新中' : String(liveCount) }),
                    Dom.make('span', { className: `${NAME}-sidebar-panel-head-actions` }, [
                        Dom.make('button', {
                            type: 'button',
                            className: `${NAME}-sidebar-panel-clear ${NAME}-sidebar-panel-icon-button ${NAME}-sidebar-live-refresh`,
                            title: '刷新实时新帖',
                            'aria-label': '刷新实时新帖',
                            'data-sidebar-live-action': 'refresh'
                        }),
                        Dom.make('button', {
                            type: 'button',
                            className: `${NAME}-sidebar-panel-clear ${NAME}-sidebar-panel-icon-button ${NAME}-sidebar-live-collapse`,
                            title: '收起实时最新',
                            'aria-label': '收起实时最新',
                            'data-sidebar-live-action': 'close'
                        })
                    ])
                ]),
                Dom.make('div', { className: `${NAME}-live-status ${NAME}-sidebar-live-status`, text: LiveTopics.statusText() }),
                Dom.make('div', { className: `${NAME}-sidebar-queue-list ${NAME}-sidebar-live-list` }, liveRows.length
                    ? liveRows
                    : Dom.make('div', { className: `${NAME}-sidebar-empty`, text: LiveTopics.inFlight ? '正在刷新最新帖子...' : '暂无匹配的新帖' }))
            ]);
            const currentFrameUrl = this.frameControls?.currentUrl?.() || '';
            const frameToolsPanel = Dom.make('section', { className: `${NAME}-sidebar-panel ${NAME}-sidebar-frame-panel`, 'aria-label': '详情工具' }, [
                Dom.make('div', { className: `${NAME}-sidebar-panel-head` }, [
                    Dom.make('span', { className: `${NAME}-sidebar-panel-title`, text: '详情工具' }),
                    Dom.make('span', { className: `${NAME}-sidebar-panel-count`, text: 'URL' })
                ]),
                Dom.make('div', { className: `${NAME}-sidebar-frame-tools` }, [
                    Dom.make('div', {
                        className: `${NAME}-sidebar-frame-url`,
                        title: currentFrameUrl,
                        text: this.formatSidebarFrameUrl(currentFrameUrl)
                    }),
                    this.sidebarFrameAction('jump', '跳转', '地址栏'),
                    this.sidebarFrameAction('reload', '刷新', '当前详情'),
                    this.sidebarFrameAction('copy', '复制', '当前链接'),
                    this.sidebarFrameAction('open', '新标签打开', '当前详情'),
                    this.sidebarFrameAction('original', '回到原帖', '话题地址'),
                    this.sidebarFrameAction('initial', '回到初始', THREAD_SOURCES[Prefs.value.threadSource].label)
                ])
            ]);
            const widthPresetPanel = Dom.make('section', { className: `${NAME}-sidebar-panel ${NAME}-sidebar-width-panel`, 'aria-label': '抽屉宽度预设' }, [
                Dom.make('div', { className: `${NAME}-sidebar-panel-head` }, [
                    Dom.make('span', { className: `${NAME}-sidebar-panel-title`, text: '抽屉宽度' }),
                    Dom.make('span', { className: `${NAME}-sidebar-panel-count`, text: `${Prefs.value.width}px` })
                ]),
                Dom.make('div', { className: `${NAME}-sidebar-frame-tools` },
                    DRAWER_WIDTH_PRESETS.map((preset) => this.sidebarWidthPresetAction(preset)))
            ]);
            const supportPanel = Dom.make('section', { className: `${NAME}-sidebar-panel ${NAME}-sidebar-support-panel`, 'aria-label': '支持我' }, [
                Dom.make('div', { className: `${NAME}-sidebar-panel-head` }, [
                    Dom.make('span', { className: `${NAME}-sidebar-panel-title`, text: '支持我' }),
                    Dom.make('span', { className: `${NAME}-sidebar-panel-count`, text: 'LDC' })
                ]),
                Dom.make('div', { className: `${NAME}-sidebar-support-list ${NAME}-support-list` }, supportCards())
            ]);
            const topicStatsPanel = this.buildTopicStatsPanel();
            const panel = settingsOpen
                ? settingsPanel
                : topicStatsOpen
                    ? topicStatsPanel
                    : frameToolsOpen
                        ? frameToolsPanel
                        : widthPresetsOpen
                            ? widthPresetPanel
                            : supportOpen
                                ? supportPanel
                                : liveOpen
                                    ? livePanel
                                    : favoritesOpen
                                        ? favoritesPanel
                                        : recentOpen
                                            ? recentPanel
                                            : pageNavOpen
                                                ? pageNavPanel
                                                : readLaterPanel;

            this.sidebar.replaceChildren(rail, panel);
            this.sidebar.classList.add('is-open');
            this.sidebar.classList.toggle('is-panel-open', settingsOpen || readLaterOpen || pageNavOpen || favoritesOpen || recentOpen || liveOpen || frameToolsOpen || widthPresetsOpen || supportOpen || topicStatsOpen);
            this.sidebar.classList.toggle('is-settings-panel', settingsOpen);
            this.sidebar.classList.toggle('is-topic-stats-panel', topicStatsOpen);
            this.sidebar.classList.toggle('is-page-nav-panel', pageNavOpen);
            this.sidebar.classList.toggle('is-read-later-panel', readLaterOpen);
            this.sidebar.classList.toggle('is-favorites-panel', favoritesOpen);
            this.sidebar.classList.toggle('is-recent-panel', recentOpen);
            this.sidebar.classList.toggle('is-live-panel', liveOpen);
            this.sidebar.classList.toggle('is-frame-tools-panel', frameToolsOpen);
            this.sidebar.classList.toggle('is-width-presets-panel', widthPresetsOpen);
            this.sidebar.classList.toggle('is-support-panel', supportOpen);
            this.bindSidebarScrollTracking();
            if (settingsOpen) FloatingPrefs.bindSettingsRoot(settingsPanel);
            this.applyTheme();
            this.applySize();
            this.restoreSidebarScroll(scrollState);
            if (settingsOpen) FloatingPrefs.sync();
        },

        buildTopicStatsPanel() {
            const s = this.currentStats;
            const statRow = (label, value, options = {}) => {
                const props = {
                    className: `${NAME}-sidebar-stat-row${options.copyValue ? ` ${NAME}-sidebar-stat-copyable` : ''}`
                };
                if (options.copyValue) {
                    props.type = 'button';
                    props.title = options.copyTitle || '点击复制';
                    props['data-sidebar-copy'] = String(options.copyValue);
                    props['data-sidebar-copy-message'] = options.copyMessage || '已复制';
                }
                const row = Dom.make(options.copyValue ? 'button' : 'div', props, [
                    Dom.make('span', { className: `${NAME}-sidebar-stat-label`, text: label }),
                    Dom.make('span', {
                        className: `${NAME}-sidebar-stat-value${options.warn ? ` ${NAME}-sidebar-stat-warn` : ''}`,
                        text: String(value),
                        title: String(value)
                    })
                ]);
                return row;
            };
            const statGroup = (label, rows) => Dom.make('section', { className: `${NAME}-sidebar-stat-group`, 'aria-label': label }, [
                Dom.make('div', { className: `${NAME}-sidebar-stat-group-title`, text: label }),
                Dom.make('div', { className: `${NAME}-sidebar-stat-group-body` }, rows)
            ]);
            const meterPercent = (value) => {
                const number = Number(value);
                if (!Number.isFinite(number)) return 0;
                return Math.max(0, Math.min(100, number));
            };
            const statMeter = (label, value, percent, options = {}) => {
                const width = meterPercent(percent);
                return Dom.make('div', {
                    className: `${NAME}-sidebar-stat-meter${options.warn ? ` ${NAME}-sidebar-stat-meter-warn` : ''}`,
                    role: 'img',
                    'aria-label': `${label} ${value}`
                }, [
                    Dom.make('div', { className: `${NAME}-sidebar-stat-meter-head` }, [
                        Dom.make('span', { className: `${NAME}-sidebar-stat-label`, text: label }),
                        Dom.make('span', {
                            className: `${NAME}-sidebar-stat-value${options.warn ? ` ${NAME}-sidebar-stat-warn` : ''}`,
                            text: String(value),
                            title: String(value)
                        })
                    ]),
                    Dom.make('div', { className: `${NAME}-sidebar-stat-meter-track` }, [
                        Dom.make('span', { className: `${NAME}-sidebar-stat-meter-fill`, style: `width:${width}%` })
                    ])
                ]);
            };

            let content;
            if (!s) {
                content = Dom.make('div', { className: `${NAME}-sidebar-empty`, text: '正在加载统计数据…' });
            } else {
                const totalFloors = Math.max(0, s.highestPostNumber - 1);
                const survivingReplies = Math.max(0, s.postsCount - 1);
                const deleted = Math.max(0, totalFloors - survivingReplies);
                const deletedPct = totalFloors > 0 ? (deleted / totalFloors * 100).toFixed(1) : '0.0';
                const floorValidPct = s.highestPostNumber > 0 ? (s.postsCount / s.highestPostNumber * 100).toFixed(1) : '-';
                const participantDensity = s.views > 0 ? (s.participantCount / s.views * 100).toFixed(1) : '-';
                const perCapita = s.participantCount > 0 ? (survivingReplies / s.participantCount).toFixed(2) : '-';
                const likeRate = s.views > 0 ? (s.likeCount / s.views * 100).toFixed(1) : '-';
                const status = s.closed ? '已关闭' : s.archived ? '已归档' : '开放中';
                const percentText = (value) => value === '-' ? '-' : `${value}%`;
                const starterName = s.starterDisplayName
                    ? `${s.starterDisplayName}${s.starterUsername ? ` @${s.starterUsername}` : ''}`
                    : s.starterUsername || '-';
                const formatTime = (iso) => {
                    if (!iso) return '-';
                    const date = new Date(iso);
                    if (Number.isNaN(date.getTime())) return '-';
                    return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                };
                const formatDuration = (startIso, endIso) => {
                    const start = new Date(startIso);
                    const end = new Date(endIso);
                    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return '-';
                    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
                    if (minutes < 60) return `${minutes} 分钟`;
                    const hours = minutes / 60;
                    if (hours < 48) return `${hours.toFixed(1)} 小时`;
                    return `${(hours / 24).toFixed(1)} 天`;
                };
                content = Dom.make('div', { className: `${NAME}-sidebar-stats-list` }, [
                    statGroup('整体统计', [
                        statRow('话题 ID', this.topicId || '-', this.topicId ? {
                            copyValue: this.topicId,
                            copyTitle: '点击复制话题 ID',
                            copyMessage: '已复制话题 ID'
                        } : {}),
                        statRow('总楼层数', totalFloors),
                        statRow('存活回复', survivingReplies),
                        statMeter('楼层有效率', percentText(floorValidPct), floorValidPct),
                        statMeter('已删除/隐藏楼层', `${deleted}（${deletedPct}%）`, deletedPct, { warn: deleted > 0 }),
                        statRow('参与人数', s.participantCount),
                        statMeter('参与密度', percentText(participantDensity), participantDensity),
                        statRow('人均发帖', perCapita),
                        statRow('全帖点赞', s.likeCount),
                        statMeter('点赞率', percentText(likeRate), likeRate),
                        statRow('浏览量', s.views),
                        statRow('全帖总字数', s.wordCount),
                        statRow('持续时间', formatDuration(s.createdAt, s.lastPostedAt)),
                        statRow('话题状态', status),
                        statRow('创建时间', formatTime(s.createdAt)),
                        statRow('最后回复', formatTime(s.lastPostedAt))
                    ]),
                    statGroup('楼主 / 主楼', [
                        statRow('楼主', starterName),
                        statRow('主楼点赞', Number(s.starterLikeCount || 0)),
                        statRow('主楼浏览', Number(s.starterReads || 0)),
                        statRow('主楼回复', Number(s.starterReplyCount || 0)),
                        statRow('主楼时间', formatTime(s.starterCreatedAt || s.createdAt))
                    ])
                ]);
            }

            const survivingCount = s ? Math.max(0, s.postsCount - 1) : '-';
            return Dom.make('section', { className: `${NAME}-sidebar-panel ${NAME}-sidebar-topic-stats-panel`, 'aria-label': '话题统计' }, [
                Dom.make('div', { className: `${NAME}-sidebar-panel-head` }, [
                    Dom.make('span', { className: `${NAME}-sidebar-panel-title`, text: '话题统计' }),
                    Dom.make('span', { className: `${NAME}-sidebar-panel-count`, text: String(survivingCount) })
                ]),
                content
            ]);
        },

        captureSidebarScroll() {
            if (!this.sidebar) return null;
            const panel = this.sidebarPanelFromClassList();
            if (!panel) return null;
            const scroller = this.sidebarScroller();
            if (!scroller) return null;
            this.sidebarScrollTop[panel] = scroller.scrollTop;
            return { panel, top: scroller.scrollTop };
        },

        sidebarPanelFromClassList() {
            if (!this.sidebar) return '';
            if (this.sidebar.classList.contains('is-settings-panel')) return 'settings';
            if (this.sidebar.classList.contains('is-page-nav-panel')) return 'pageNav';
            if (this.sidebar.classList.contains('is-read-later-panel')) return 'readLater';
            if (this.sidebar.classList.contains('is-favorites-panel')) return 'favorites';
            if (this.sidebar.classList.contains('is-recent-panel')) return 'recent';
            if (this.sidebar.classList.contains('is-live-panel')) return 'live';
            if (this.sidebar.classList.contains('is-frame-tools-panel')) return 'frameTools';
            if (this.sidebar.classList.contains('is-width-presets-panel')) return 'widthPresets';
            if (this.sidebar.classList.contains('is-support-panel')) return 'support';
            if (this.sidebar.classList.contains('is-topic-stats-panel')) return 'topicStats';
            return '';
        },

        restoreSidebarScroll(state) {
            const panel = this.activeSidebarPanel;
            if (!panel) return;
            const top = state?.panel === panel && Number.isFinite(state.top)
                ? state.top
                : this.sidebarScrollTop[panel];
            if (!Number.isFinite(top)) return;
            const scroller = this.sidebarScroller();
            if (!scroller) return;
            scroller.scrollTop = top;
            requestAnimationFrame(() => {
                if (scroller.isConnected) scroller.scrollTop = top;
            });
        },

        sidebarScroller() {
            return this.sidebar?.querySelector([
                `.${NAME}-sidebar-panel .${NAME}-sidebar-queue-list`,
                `.${NAME}-sidebar-support-list`,
                `.${NAME}-sidebar-stats-list`
            ].join(',')) || null;
        },

        bindSidebarScrollTracking() {
            const panel = this.activeSidebarPanel;
            if (!panel) return;
            const scroller = this.sidebarScroller();
            if (!scroller) return;
            scroller.addEventListener('scroll', () => {
                this.sidebarScrollTop[panel] = scroller.scrollTop;
            }, { passive: true });
        },

        syncReadLaterState() {
            if (!this.sidebar || this.root?.classList.contains('is-open') !== true) return;
            const queueState = this.queueStepState();
            this.syncSidebarToolCount('readLater', queueState.count);

            const panel = this.sidebar.querySelector('[data-sidebar-panel="readLater"]');
            if (!panel) return;
            const countNode = panel.querySelector('[data-sidebar-queue-count]');
            if (countNode) countNode.textContent = String(queueState.count);
            const clearButton = panel.querySelector('[data-sidebar-queue-clear]');
            if (clearButton) {
                clearButton.disabled = queueState.count <= 0;
                clearButton.toggleAttribute('disabled', queueState.count <= 0);
                clearButton.setAttribute('aria-disabled', queueState.count > 0 ? 'false' : 'true');
            }
            const list = panel.querySelector('[data-sidebar-queue-list]');
            if (!list) return;
            const scrollTop = list.scrollTop;
            this.sidebarScrollTop.readLater = scrollTop;
            const rows = this.sidebarQueueRows();
            list.replaceChildren(...(rows.length
                ? rows
                : [Dom.make('div', { className: `${NAME}-sidebar-empty`, text: '暂无稍后阅读' })]));
            list.scrollTop = scrollTop;
            requestAnimationFrame(() => {
                if (list.isConnected) list.scrollTop = scrollTop;
            });
        },

        syncSidebarActionState(action, enabled) {
            const button = this.sidebar?.querySelector(`[data-sidebar-action="${action}"]`);
            if (!button) return;
            button.disabled = !enabled;
            button.toggleAttribute('disabled', !enabled);
            button.setAttribute('aria-disabled', enabled ? 'false' : 'true');
        },

        syncSidebarToolCount(action, count) {
            const button = this.sidebar?.querySelector(`[data-sidebar-action="${action}"]`);
            if (!button) return;
            let badge = button.querySelector(`.${NAME}-sidebar-tool-count`);
            if (Number(count) > 0) {
                if (!badge) {
                    badge = Dom.make('span', { className: `${NAME}-sidebar-tool-count` });
                    button.appendChild(badge);
                }
                badge.textContent = String(count);
            } else {
                badge?.remove();
            }
        },

        syncFooterVisibility() {
            const footer = this.footer || this.root?.querySelector(`.${NAME}-drawer-footer`);
            if (!footer) return;
            const hasStatus = footer.querySelector('[data-role="drawer-track"]')?.classList.contains('is-visible') === true;
            const hasActions = footer.querySelector('[data-drawer-footer-slot="actions"]')?.classList.contains('is-visible') === true;
            footer.classList.toggle('is-visible', hasStatus || hasActions);
        },

        syncFooterActions() {
            if (!this.root) return;
            const href = this.currentTopicUrl();
            const actions = this.root.querySelector('[data-drawer-footer-slot="actions"]');
            actions?.classList.toggle('is-visible', !!href);
            actions?.querySelectorAll('button').forEach((button) => {
                button.disabled = !href;
                button.toggleAttribute('disabled', !href);
                button.setAttribute('aria-disabled', href ? 'false' : 'true');
            });
            this.syncAutoScrollButton();
            this.syncFooterVisibility();
        },

        toggleAutoScroll() {
            if (this.autoScrollState === 'running') {
                this.pauseAutoScroll('manual');
                return;
            }
            this.startAutoScroll();
        },

        startAutoScroll() {
            if (!this.topicId || this.root?.classList.contains('is-open') !== true) return;
            const target = this.autoScrollTarget();
            if (!target) {
                showToast('当前内容暂时不可自动滚动');
                this.stopAutoScroll('unavailable');
                return;
            }
            if (this.autoScrollAtBottom(target)) {
                showToast('已到达底部');
                this.stopAutoScroll('bottom');
                return;
            }
            this.autoScrollState = 'running';
            this.autoScrollPauseReason = '';
            this.autoScrollLastAt = 0;
            this.autoScrollCurrentSpeed = this.autoScrollSpeedProfile().initial;
            this.autoScrollTargetSpeed = this.randomAutoScrollSpeed();
            this.autoScrollNextSpeedAt = Date.now() + this.randomAutoScrollSpeedDelay();
            this.autoScrollPauseUntil = 0;
            this.scheduleAutoScrollFrame();
            this.syncAutoScrollButton();
        },

        pauseAutoScroll(reason = 'manual') {
            if (this.autoScrollState !== 'running') return;
            this.cancelAutoScrollFrame();
            this.autoScrollState = 'paused';
            this.autoScrollPauseReason = reason;
            this.autoScrollLastAt = 0;
            this.autoScrollPauseUntil = 0;
            this.syncAutoScrollButton();
        },

        stopAutoScroll(reason = '') {
            this.cancelAutoScrollFrame();
            this.autoScrollState = 'idle';
            this.autoScrollPauseReason = reason;
            this.autoScrollLastAt = 0;
            this.autoScrollPauseUntil = 0;
            this.syncAutoScrollButton();
        },

        pauseAutoScrollForInteraction(event) {
            if (this.autoScrollState !== 'running') return;
            if (event?.isTrusted === false) return;
            const target = event?.target instanceof Element ? event.target : null;
            if (target?.closest?.('[data-action="toggle-auto-scroll"]')) return;
            this.pauseAutoScroll('interaction');
        },

        scheduleAutoScrollFrame() {
            if (this.autoScrollFrame || this.autoScrollState !== 'running') return;
            this.autoScrollFrame = window.requestAnimationFrame((time) => this.stepAutoScroll(time));
        },

        cancelAutoScrollFrame() {
            if (!this.autoScrollFrame) return;
            window.cancelAnimationFrame(this.autoScrollFrame);
            this.autoScrollFrame = 0;
        },

        stepAutoScroll(time) {
            this.autoScrollFrame = 0;
            if (this.autoScrollState !== 'running') return;
            if (document.hidden) {
                this.pauseAutoScroll('hidden');
                return;
            }
            if (this.root?.classList.contains('is-open') !== true) {
                this.stopAutoScroll('closed');
                return;
            }

            const target = this.autoScrollTarget();
            if (!target) {
                this.pauseAutoScroll('unavailable');
                return;
            }
            if (this.autoScrollAtBottom(target)) {
                this.stopAutoScroll('bottom');
                showToast('自动滚动已到达底部');
                return;
            }

            const now = Date.now();
            if (now >= this.autoScrollNextSpeedAt) this.retargetAutoScrollSpeed(now);
            if (this.autoScrollPauseUntil && now < this.autoScrollPauseUntil) {
                this.autoScrollLastAt = time;
                this.scheduleAutoScrollFrame();
                return;
            }

            const previous = this.autoScrollLastAt || time;
            const deltaSeconds = Math.max(0, Math.min(0.12, (time - previous) / 1000));
            this.autoScrollLastAt = time;
            const easing = Math.min(1, deltaSeconds * 1.35);
            this.autoScrollCurrentSpeed += (this.autoScrollTargetSpeed - this.autoScrollCurrentSpeed) * easing;

            const nextTop = Math.min(
                this.autoScrollMax(target),
                this.autoScrollTop(target) + this.autoScrollCurrentSpeed * deltaSeconds
            );
            this.setAutoScrollTop(target, nextTop);
            this.scheduleAutoScrollFrame();
        },

        retargetAutoScrollSpeed(now) {
            const profile = this.autoScrollSpeedProfile();
            this.autoScrollTargetSpeed = this.randomAutoScrollSpeed();
            this.autoScrollNextSpeedAt = now + this.randomAutoScrollSpeedDelay();
            const pauseChance = Number.isFinite(profile.pauseChance) ? profile.pauseChance : 0.12;
            if (Math.random() < pauseChance) {
                this.autoScrollPauseUntil = now + this.randomBetween(AUTO_SCROLL_PAUSE_MIN, AUTO_SCROLL_PAUSE_MAX);
            } else {
                this.autoScrollPauseUntil = 0;
            }
        },

        randomAutoScrollSpeed() {
            const profile = this.autoScrollSpeedProfile();
            return this.randomBetween(profile.min, profile.max);
        },

        autoScrollSpeedProfile() {
            return AUTO_SCROLL_SPEED_LEVELS[Prefs.value.autoScrollSpeed] || AUTO_SCROLL_SPEED_LEVELS[AUTO_SCROLL_DEFAULT_SPEED_LEVEL];
        },

        applyAutoScrollSpeedPreference() {
            if (this.autoScrollState !== 'running') return;
            const profile = this.autoScrollSpeedProfile();
            this.autoScrollCurrentSpeed = Math.max(profile.min, Math.min(profile.max, this.autoScrollCurrentSpeed || profile.initial));
            this.autoScrollTargetSpeed = this.randomAutoScrollSpeed();
            this.autoScrollNextSpeedAt = Date.now() + this.randomAutoScrollSpeedDelay();
            this.autoScrollPauseUntil = 0;
        },

        randomAutoScrollSpeedDelay() {
            const profile = this.autoScrollSpeedProfile();
            const min = Number.isFinite(profile.speedChangeMin) ? profile.speedChangeMin : 1400;
            const max = Number.isFinite(profile.speedChangeMax) ? profile.speedChangeMax : 4400;
            return this.randomBetween(min, max);
        },

        randomBetween(min, max) {
            return min + Math.random() * Math.max(0, max - min);
        },

        autoScrollTarget() {
            if (this.mode === 'thread') {
                const frame = this.body?.querySelector(`.${NAME}-frame`);
                try {
                    const doc = frame?.contentDocument || frame?.contentWindow?.document;
                    const element = doc?.scrollingElement || doc?.documentElement;
                    if (element && Number(element.scrollHeight) > Number(element.clientHeight) + 2) {
                        return { element };
                    }
                } catch (_) {
                    return null;
                }
                return null;
            }
            if (!this.body || Number(this.body.scrollHeight) <= Number(this.body.clientHeight) + 2) return null;
            return { element: this.body };
        },

        autoScrollTop(target) {
            return Number(target?.element?.scrollTop || 0);
        },

        setAutoScrollTop(target, value) {
            if (!target?.element) return;
            target.element.scrollTop = value;
        },

        autoScrollMax(target) {
            const element = target?.element;
            if (!element) return 0;
            return Math.max(0, Number(element.scrollHeight || 0) - Number(element.clientHeight || 0));
        },

        autoScrollAtBottom(target) {
            return this.autoScrollMax(target) - this.autoScrollTop(target) <= 2;
        },

        bindAutoScrollFrame(frame) {
            this.cleanupAutoScrollFrame();
            try {
                const doc = frame?.contentDocument || frame?.contentWindow?.document;
                if (!doc) return;
                const pause = (event) => this.pauseAutoScrollForInteraction(event);
                doc.addEventListener('wheel', pause, { passive: true, capture: true });
                doc.addEventListener('pointerdown', pause, true);
                doc.addEventListener('touchstart', pause, { passive: true, capture: true });
                doc.addEventListener('keydown', pause, true);
                this.autoScrollFrameDoc = doc;
                this.autoScrollFrameCleanup = () => {
                    doc.removeEventListener('wheel', pause, true);
                    doc.removeEventListener('pointerdown', pause, true);
                    doc.removeEventListener('touchstart', pause, true);
                    doc.removeEventListener('keydown', pause, true);
                };
            } catch (_) {
                this.cleanupAutoScrollFrame();
            }
        },

        cleanupAutoScrollFrame() {
            const cleanup = this.autoScrollFrameCleanup;
            this.autoScrollFrameCleanup = null;
            this.autoScrollFrameDoc = null;
            if (typeof cleanup !== 'function') return;
            try {
                cleanup();
            } catch (_) {
                // iframe document 可能已经销毁，清理失败不影响抽屉关闭。
            }
        },

        syncAutoScrollButton() {
            const button = this.root?.querySelector('[data-action="toggle-auto-scroll"]');
            if (!button) return;
            const label = button.querySelector('[data-role="auto-scroll-label"]');
            const state = this.autoScrollState === 'running'
                ? 'running'
                : this.autoScrollState === 'paused'
                    ? 'paused'
                    : 'idle';
            const text = state === 'running' ? '滚动中' : state === 'paused' ? '已暂停' : '自动滚动';
            const title = state === 'running'
                ? '暂停自动滚动'
                : state === 'paused'
                    ? `继续自动滚动${this.autoScrollPauseReasonText() ? `：${this.autoScrollPauseReasonText()}` : ''}`
                    : '开始自动滚动';
            button.dataset.scrollState = state;
            button.classList.toggle('is-running', state === 'running');
            button.classList.toggle('is-paused', state === 'paused');
            button.setAttribute('aria-pressed', state === 'idle' ? 'false' : 'true');
            button.setAttribute('title', title);
            button.setAttribute('aria-label', title);
            if (label) label.textContent = text;
        },

        autoScrollPauseReasonText() {
            return {
                manual: '手动暂停',
                interaction: '检测到用户操作',
                hidden: '页面不可见',
                unavailable: '当前内容不可滚动',
                bottom: '已到底部'
            }[this.autoScrollPauseReason] || '';
        },

        syncTopicStatus() {
            if (!this.root) return;
            const status = this.root.querySelector('[data-role="topic-status"]');
            const statusText = this.root.querySelector('[data-role="topic-status-text"]');
            const track = this.root.querySelector('[data-role="drawer-track"]');
            const progress = this.root.querySelector('[data-role="topic-status-progress"]');
            if (!status) return;
            status.classList.remove('is-pending', 'is-sending', 'is-sent', 'is-done', 'is-error', 'is-disabled');
            status.style.removeProperty('--track-progress');
            if (progress) progress.style.removeProperty('width');
            if (this.trackViewStatus?.text) {
                const type = this.trackViewStatus.type || 'sent';
                const ratio = Number.isFinite(this.trackViewStatus.progress)
                    ? Math.max(0, Math.min(1, this.trackViewStatus.progress))
                    : type === 'pending' ? 0 : 1;
                const percent = `${Math.round(ratio * 100)}%`;
                if (statusText) statusText.textContent = this.trackViewStatus.text;
                else status.textContent = this.trackViewStatus.text;
                status.title = `来源：${this.trackSourceLabel(this.trackViewSource)}`;
                status.classList.add(`is-${this.trackViewStatus.type || 'sent'}`);
                status.classList.add('is-visible');
                status.style.setProperty('--track-progress', percent);
                if (progress) progress.style.width = percent;
                track?.classList.add('is-visible');
                track?.classList.toggle('has-progress', this.trackViewStatus.showProgress !== false);
                this.syncFooterVisibility();
                return;
            }
            const memory = ReadMemory.get(this.topicId);
            const visible = Prefs.value.showEffectiveBadges && memory?.effective === true;
            if (statusText) statusText.textContent = '话题已生效';
            else status.textContent = '话题已生效';
            status.title = visible ? 'LinuxDO 小蓝点已消失' : '';
            status.classList.toggle('is-visible', visible);
            if (progress) progress.style.width = visible ? '100%' : '0%';
            track?.classList.toggle('is-visible', visible);
            track?.classList.toggle('has-progress', visible);
            this.syncFooterVisibility();
        },

        applyTheme() {
            if (!this.root) return;
            const dark = pagePrefersDarkTheme();
            this.root.classList.toggle('is-light', !dark);
            this.sidebar?.classList.toggle('is-light', !dark);
        },

        applySize() {
            if (!this.root) return;
            const { width, height } = Prefs.value;
            this.root.style.setProperty('--peek-width', `${width}px`);
            this.root.style.setProperty('--peek-height', `${height}dvh`);
            this.root.style.setProperty('--peek-top', height >= 100 ? '0px' : `calc((100dvh - ${height}dvh) / 2)`);
            this.root.classList.toggle('is-partial-height', height < 100);
            if (this.sidebar) {
                const drawerGap = 12;
                const railOffset = 56;
                const panelGap = 8;
                const viewportPadding = 12;
                const drawerLeftReserve = railOffset + panelGap + viewportPadding;
                const drawerWidth = Math.min(width, Math.max(0, window.innerWidth - drawerGap - drawerLeftReserve));
                const availablePanelWidth = Math.max(160, window.innerWidth - drawerGap - drawerWidth - railOffset - panelGap - viewportPadding);
                const panelWidth = Math.min(280, availablePanelWidth, Math.max(190, Math.round(drawerWidth * .32)));
                const pagePanelWidth = Math.min(360, availablePanelWidth, Math.max(260, Math.round(drawerWidth * .42)));
                const settingsPanelWidth = Math.min(420, availablePanelWidth, Math.max(320, Math.round(drawerWidth * .52)));
                this.sidebar.style.setProperty('--sidebar-panel-width', `${panelWidth}px`);
                this.sidebar.style.setProperty('--sidebar-page-panel-width', `${pagePanelWidth}px`);
                this.sidebar.style.setProperty('--sidebar-settings-panel-width', `${settingsPanelWidth}px`);
            }
        },

        persistSizeValue(field, value) {
            Prefs.save({ [field]: SizeControls.clamp(field, value) });
            this.applySize();
            this.syncControls();
            FloatingPrefs.sync();
        },

        saveDrawerState(extra = {}) {
            if (!this.topicId) return;
            const mode = Prefs.mode(extra.mode || this.mode);
            DrawerState.save({
                topicId: this.topicId,
                title: this.topicTitle,
                sourceHref: this.sourceHref || Urls.canonicalTopic(this.topicId),
                mode,
                frameUrl: mode === 'thread' ? extra.frameUrl : '',
                frameHistory: mode === 'thread' ? extra.frameHistory : [],
                frameHistoryIndex: mode === 'thread' ? extra.frameHistoryIndex : 0,
                ...extra
            });
            FloatingPrefs.sync();
        },

        lockPage() {
            if (this.lockSnapshot) return;
            const html = document.documentElement;
            const body = document.body;
            const gap = Math.max(0, window.innerWidth - html.clientWidth);
            const bodyPadding = parseFloat(getComputedStyle(body).paddingRight) || 0;

            this.lockSnapshot = {
                htmlOverflow: html.style.overflow,
                bodyOverflow: body.style.overflow,
                bodyPaddingRight: body.style.paddingRight
            };

            html.style.overflow = 'hidden';
            body.style.overflow = 'hidden';
            if (gap) body.style.paddingRight = `${bodyPadding + gap}px`;
        },

        unlockPage() {
            if (!this.lockSnapshot) return;
            document.documentElement.style.overflow = this.lockSnapshot.htmlOverflow;
            document.body.style.overflow = this.lockSnapshot.bodyOverflow;
            document.body.style.paddingRight = this.lockSnapshot.bodyPaddingRight;
            this.lockSnapshot = null;
        },

        busy(message) {
            this.body.replaceChildren(Dom.make('div', { className: `${NAME}-state` }, [
                Dom.make('span', { className: `${NAME}-spinner`, 'aria-hidden': 'true' }),
                Dom.make('span', { text: message })
            ]));
        },

        fail(message, actions = []) {
            const children = [Dom.make('div', { className: `${NAME}-state-message`, text: message })];
            if (actions.length) {
                children.push(Dom.make('div', { className: `${NAME}-state-actions` }, actions.map((item) => {
                    if (item.href) {
                        return Dom.make('a', {
                            className: `${NAME}-soft-btn`,
                            href: item.href,
                            target: '_blank',
                            rel: 'noopener noreferrer',
                            text: item.label
                        });
                    }
                    return Dom.make('button', {
                        className: `${NAME}-soft-btn`,
                        type: 'button',
                        'data-action': item.action,
                        text: item.label
                    });
                })));
            }
            this.body.replaceChildren(Dom.make('div', { className: `${NAME}-state ${NAME}-error` }, children));
        },

        async paintSummary(topicId) {
            const ticket = this.job;
            this.busy('正在读取楼主正文');
            try {
                const topic = await StarterPostStore.load(topicId);
                if (ticket !== this.job || this.topicId !== topicId || this.mode !== 'summary') return;
                this.topicTitle = Favorites.cleanTitle(topic.title) || this.topicTitle;
                ReadMemory.updateMeta(topicId, LastViewedMarker.anchor, this.sourceHref, this.topicTitle);
                Favorites.updateMeta(topicId, LastViewedMarker.anchor, this.sourceHref, this.topicTitle);
                this.saveDrawerState();
                this.syncControls();
                this.currentStats = topic.stats || null;
                this.body.replaceChildren(SummaryCard.build(topic));
                this.body.scrollTop = 0;
                this.renderSidebar();
            } catch (error) {
                if (ticket !== this.job) return;
                console.warn(`${LOG_PREFIX} 预览读取失败`, error);
                const originalUrl = Urls.absolute(this.sourceHref || Urls.canonicalTopic(topicId));
                this.fail('读取失败，可能是登录状态、权限或访问频率限制导致。', [
                    { label: '重试', action: 'retry-current' },
                    { label: '打开原帖', href: originalUrl },
                    { label: '复制链接', action: 'copy-current-url' }
                ]);
            }
        },

        paintThread(topicId) {
            const ticket = this.job;
            this.currentStats = null;
            StarterPostStore.load(topicId).then((topic) => {
                if (ticket !== this.job || this.topicId !== topicId) return;
                this.currentStats = topic?.stats || null;
                this.renderSidebar();
            }).catch(() => {});
            const initialTopicUrl = Urls.framePreview(this.threadFrameUrl(topicId));
            const resume = this.resumeState?.mode === 'thread' && this.resumeState.topicId === String(topicId)
                ? this.resumeState
                : null;
            const restoredHistory = (resume?.frameHistory || []).map((href) => Urls.framePreview(href)).filter(Boolean);
            const restoredIndex = restoredHistory.length
                ? Prefs.numberInRange(resume?.frameHistoryIndex, restoredHistory.length - 1, 0, restoredHistory.length - 1)
                : 0;
            const url = Urls.framePreview(resume?.frameUrl) || restoredHistory[restoredIndex] || initialTopicUrl;
            const status = Dom.make('div', { className: `${NAME}-frame-status`, text: '正在加载详情' });
            const frame = Dom.make('iframe', {
                className: `${NAME}-frame`,
                src: url,
                title: `${APP_NAME} 详情预览`,
                loading: 'eager',
                referrerpolicy: 'same-origin'
            });

            const urlInput = Dom.make('input', {
                className: `${NAME}-frame-url-input`,
                type: 'text',
                value: url,
                spellcheck: 'false',
                autocomplete: 'off',
                'aria-label': '详情 iframe 地址'
            });
            const backButton = Dom.make('button', {
                className: `${NAME}-frame-nav ${NAME}-frame-nav-back`,
                type: 'button',
                title: '后退，悬浮查看历史',
                'aria-label': '后退',
                text: '‹'
            });
            const forwardButton = Dom.make('button', {
                className: `${NAME}-frame-nav ${NAME}-frame-nav-forward`,
                type: 'button',
                title: '前进，悬浮查看历史',
                'aria-label': '前进',
                text: '›'
            });
            const navGroup = Dom.make('div', { className: `${NAME}-frame-navs` }, [backButton, forwardButton]);
            const historyMenu = Dom.make('div', { className: `${NAME}-frame-history-menu`, role: 'menu' });
            const urlForm = Dom.make('form', { className: `${NAME}-frame-url-form` }, [
                Dom.make('span', { className: `${NAME}-frame-mode`, text: '详情模式' }),
                navGroup,
                urlInput
            ]);
            const frameWrap = Dom.make('div', { className: `${NAME}-frame-wrap` }, [status, frame]);

            const showStatus = (message, actions = []) => {
                status.classList.toggle('has-actions', actions.length > 0);
                const children = [Dom.make('div', { className: `${NAME}-frame-status-message`, text: message })];
                if (actions.length) {
                    children.push(Dom.make('div', { className: `${NAME}-frame-status-actions` }, actions.map((item) => {
                        if (item.href) {
                            return Dom.make('a', {
                                className: `${NAME}-soft-btn`,
                                href: item.href,
                                target: '_blank',
                                rel: 'noopener noreferrer',
                                text: item.label
                            });
                        }
                        return Dom.make('button', {
                            className: `${NAME}-soft-btn`,
                            type: 'button',
                            'data-frame-action': item.action,
                            text: item.label
                        });
                    })));
                }
                status.replaceChildren(...children);
                if (!status.isConnected) frameWrap.prepend(status);
            };
            let lastFrameUrl = url;
            let pendingFrameUrl = '';
            let pendingHistoryMode = '';
            let pendingHistoryUntil = 0;
            let frameUserNavigationUntil = 0;
            const frameHistory = restoredHistory.length ? restoredHistory : [url];
            let frameHistoryIndex = restoredHistory.length ? restoredIndex : 0;
            if (frameHistory[frameHistoryIndex] !== url) frameHistory[frameHistoryIndex] = url;
            let historyHideTimer = 0;
            let loadTimer = 0;
            let frameWatchTimer = 0;
            let nudgeTimer = 0;
            let frameShell = null;
            let disposed = false;
            let watchedFrameDoc = null;
            let cleanupWatchedFrameDoc = null;
            const currentFrameUrl = () => {
                return Urls.framePreview(lastFrameUrl || urlInput.value || frame.getAttribute('src') || url) || url;
            };
            const statusActions = () => [
                { label: '重试', action: 'retry' },
                { label: '新标签打开', href: currentFrameUrl() },
                { label: '复制链接', action: 'copy' }
            ];
            const clearLoadTimer = () => {
                if (!loadTimer) return;
                window.clearTimeout(loadTimer);
                loadTimer = 0;
            };
            const clearFrameWatchTimer = () => {
                if (!frameWatchTimer) return;
                window.clearTimeout(frameWatchTimer);
                frameWatchTimer = 0;
            };
            const clearNudgeTimer = () => {
                if (!nudgeTimer) return;
                window.clearTimeout(nudgeTimer);
                nudgeTimer = 0;
            };
            const releaseWatchedFrameDoc = () => {
                const cleanupDoc = cleanupWatchedFrameDoc;
                watchedFrameDoc = null;
                cleanupWatchedFrameDoc = null;
                if (typeof cleanupDoc !== 'function') return;
                try {
                    cleanupDoc();
                } catch (_) {
                    // iframe document 可能已经导航或销毁，清理失败不影响关闭。
                }
            };
            const startLoadTimer = () => {
                if (disposed) return;
                clearLoadTimer();
                loadTimer = window.setTimeout(() => {
                    loadTimer = 0;
                    if (disposed || ticket !== this.job || !frame.isConnected || !status.isConnected) return;
                    showStatus('加载时间较长，可以重试或新标签打开。', statusActions());
                }, Prefs.value.frameLoadWait * 1000);
            };
            const updateNavButtons = () => {
                backButton.disabled = frameHistoryIndex <= 0;
                forwardButton.disabled = frameHistoryIndex >= frameHistory.length - 1;
            };
            const saveFrameState = () => {
                const start = Math.max(0, frameHistory.length - Prefs.value.frameHistoryLimit);
                const history = frameHistory.slice(start);
                const index = Math.max(0, frameHistoryIndex - start);
                this.saveDrawerState({
                    mode: 'thread',
                    frameUrl: lastFrameUrl || frameHistory[frameHistoryIndex] || url,
                    frameHistory: history,
                    frameHistoryIndex: index
                });
            };
            const formatHistoryUrl = (historyUrl) => {
                try {
                    const parsed = new URL(historyUrl, location.origin);
                    return `${parsed.pathname}${parsed.search}${parsed.hash}` || parsed.href;
                } catch (_) {
                    return historyUrl;
                }
            };
            const hideHistoryMenu = () => {
                if (historyHideTimer) {
                    window.clearTimeout(historyHideTimer);
                    historyHideTimer = 0;
                }
                historyMenu.classList.remove('is-open');
                historyMenu.replaceChildren();
            };
            const scheduleHistoryHide = () => {
                if (historyHideTimer) window.clearTimeout(historyHideTimer);
                historyHideTimer = window.setTimeout(() => {
                    historyHideTimer = 0;
                    hideHistoryMenu();
                }, 120);
            };
            const keepHistoryMenu = () => {
                if (!historyHideTimer) return;
                window.clearTimeout(historyHideTimer);
                historyHideTimer = 0;
            };
            const positionHistoryMenu = (anchor, direction) => {
                if (!frameShell?.isConnected || !anchor?.isConnected) return;
                const shellRect = frameShell.getBoundingClientRect();
                const anchorRect = anchor.getBoundingClientRect();
                const menuWidth = Math.min(340, Math.max(220, shellRect.width - 20));
                const rawLeft = direction === 'forward'
                    ? anchorRect.right - shellRect.left - menuWidth
                    : anchorRect.left - shellRect.left;
                const maxLeft = Math.max(10, shellRect.width - menuWidth - 10);
                const left = Math.max(10, Math.min(maxLeft, rawLeft));
                const top = Math.max(42, anchorRect.bottom - shellRect.top + 6);

                historyMenu.style.width = `${menuWidth}px`;
                historyMenu.style.left = `${left}px`;
                historyMenu.style.top = `${top}px`;
                historyMenu.style.maxHeight = `${Math.max(120, shellRect.height - top - 10)}px`;
            };
            const showHistoryMenu = (direction, anchor = direction === 'forward' ? forwardButton : backButton) => {
                const entries = direction === 'back'
                    ? frameHistory.slice(0, frameHistoryIndex).map((href, index) => ({ href, index })).reverse()
                    : frameHistory.slice(frameHistoryIndex + 1).map((href, offset) => ({
                        href,
                        index: frameHistoryIndex + 1 + offset
                    }));
                if (!entries.length) {
                    hideHistoryMenu();
                    return false;
                }

                keepHistoryMenu();
                historyMenu.replaceChildren(...entries.map(({ href, index }) => Dom.make('button', {
                    className: `${NAME}-frame-history-item`,
                    type: 'button',
                    title: href,
                    'data-history-index': String(index),
                    text: formatHistoryUrl(href)
                })));
                historyMenu.classList.toggle('is-forward', direction === 'forward');
                positionHistoryMenu(anchor, direction);
                historyMenu.classList.add('is-open');
                return true;
            };
            const pushFrameHistory = (nextUrl) => {
                const normalizedUrl = Urls.framePreview(nextUrl);
                if (!normalizedUrl || frameHistory[frameHistoryIndex] === normalizedUrl) {
                    updateNavButtons();
                    return;
                }
                frameHistory.splice(frameHistoryIndex + 1);
                frameHistory.push(normalizedUrl);
                frameHistoryIndex = frameHistory.length - 1;
                while (frameHistory.length > Prefs.value.frameHistoryLimit) {
                    frameHistory.shift();
                    frameHistoryIndex = Math.max(0, frameHistoryIndex - 1);
                }
                hideHistoryMenu();
                updateNavButtons();
                saveFrameState();
            };
            const replaceFrameHistory = (nextUrl) => {
                const normalizedUrl = Urls.framePreview(nextUrl);
                if (!normalizedUrl) return false;
                frameHistory[frameHistoryIndex] = normalizedUrl;
                updateNavButtons();
                saveFrameState();
                return true;
            };
            const loadFrameUrl = (nextUrl, { pushHistory = true } = {}) => {
                if (disposed) return false;
                const normalizedUrl = Urls.framePreview(nextUrl);
                if (!normalizedUrl) return false;
                showStatus('正在加载详情');
                startLoadTimer();
                if (pushHistory) pushFrameHistory(normalizedUrl);
                else replaceFrameHistory(normalizedUrl);
                lastFrameUrl = normalizedUrl;
                pendingFrameUrl = normalizedUrl;
                pendingHistoryMode = 'replace';
                pendingHistoryUntil = Date.now() + FRAME_HISTORY_REPLACE_WINDOW;
                urlInput.value = normalizedUrl;
                frame.src = normalizedUrl;
                hideHistoryMenu();
                updateNavButtons();
                saveFrameState();
                if (this.activeSidebarPanel === 'frameTools') this.renderSidebar();
                return true;
            };
            const markFrameUserNavigation = () => {
                pendingHistoryMode = '';
                pendingHistoryUntil = 0;
                frameUserNavigationUntil = Date.now() + FRAME_USER_NAV_WINDOW;
            };
            const watchFrameInteractions = () => {
                try {
                    const doc = frame.contentDocument || frame.contentWindow?.document;
                    if (disposed) return;
                    if (!doc) {
                        releaseWatchedFrameDoc();
                        return;
                    }
                    if (watchedFrameDoc === doc) return;
                    releaseWatchedFrameDoc();

                    const mark = (event) => {
                        if (event?.isTrusted === false) return;
                        markFrameUserNavigation();
                    };
                    const markKeydown = (event) => {
                        if (event?.isTrusted === false) return;
                        if (event.key === 'Enter') {
                            markFrameUserNavigation();
                            return;
                        }
                        if (event.key !== ' ' && event.key !== 'Spacebar') return;
                        const target = event.target;
                        if (target?.closest?.('a, button, [role="button"], input[type="button"], input[type="submit"]')) {
                            markFrameUserNavigation();
                        }
                    };
                    doc.addEventListener('click', mark, true);
                    doc.addEventListener('auxclick', mark, true);
                    doc.addEventListener('submit', mark, true);
                    doc.addEventListener('keydown', markKeydown, true);
                    watchedFrameDoc = doc;
                    cleanupWatchedFrameDoc = () => {
                        doc.removeEventListener('click', mark, true);
                        doc.removeEventListener('auxclick', mark, true);
                        doc.removeEventListener('submit', mark, true);
                        doc.removeEventListener('keydown', markKeydown, true);
                    };
                } catch (_) {
                    releaseWatchedFrameDoc();
                    // 跨源页面无法监听内部交互，地址栏仍可手动跳转。
                }
            };
            const syncTitleFromFrame = () => {
                try {
                    const doc = frame.contentDocument || frame.contentWindow?.document;
                    const nextTitle = Favorites.titleFromDocument(doc, topicId);
                    if (!nextTitle || nextTitle === this.topicTitle) return;
                    this.topicTitle = nextTitle;
                    ReadMemory.updateMeta(topicId, LastViewedMarker.anchor, this.sourceHref, nextTitle);
                    Favorites.updateMeta(topicId, LastViewedMarker.anchor, this.sourceHref, nextTitle);
                    this.saveDrawerState({
                        mode: 'thread',
                        frameUrl: currentFrameUrl(),
                        frameHistory,
                        frameHistoryIndex
                    });
                    FloatingPrefs.sync();
                } catch (_) {
                    // 跨源或未完成加载时无法读取标题，保留已有名称。
                }
            };
            const syncFrameUrl = (force = false) => {
                const srcUrl = Urls.framePreview(frame.getAttribute('src') || '') || '';
                let currentUrl = srcUrl;
                try {
                    currentUrl = frame.contentWindow?.location?.href || currentUrl;
                } catch (_) {
                    // 跨源 iframe 无法读取真实地址时，保留最后一次设置的 src。
                }
                currentUrl = Urls.framePreview(currentUrl) || currentUrl;
                if (pendingHistoryMode && pendingHistoryUntil && Date.now() > pendingHistoryUntil) {
                    pendingHistoryMode = '';
                    pendingHistoryUntil = 0;
                }
                if (frameUserNavigationUntil && Date.now() > frameUserNavigationUntil) {
                    frameUserNavigationUntil = 0;
                }
                if (pendingFrameUrl && !force && srcUrl === pendingFrameUrl && currentUrl !== pendingFrameUrl) {
                    return;
                }
                const userNavigatingInFrame = !!frameUserNavigationUntil;
                const shouldReplaceCurrentHistory = pendingHistoryMode === 'replace' || !userNavigatingInFrame;
                if (pendingFrameUrl && (force || currentUrl === pendingFrameUrl)) {
                    pendingFrameUrl = '';
                }
                if (!currentUrl) return;
                if (currentUrl === lastFrameUrl) return;
                lastFrameUrl = currentUrl;
                // 脚本主动加载后的规范化跳转只更新当前项，避免误删前进历史。
                if (shouldReplaceCurrentHistory) {
                    replaceFrameHistory(currentUrl);
                    pendingHistoryMode = '';
                    pendingHistoryUntil = 0;
                } else {
                    pushFrameHistory(currentUrl);
                    frameUserNavigationUntil = 0;
                    pendingHistoryMode = 'replace';
                    pendingHistoryUntil = Date.now() + FRAME_HISTORY_REPLACE_WINDOW;
                }
                if (force || document.activeElement !== urlInput) {
                    urlInput.value = currentUrl;
                }
                saveFrameState();
                if (this.activeSidebarPanel === 'frameTools') this.renderSidebar();
            };
            const watchFrameUrl = () => {
                frameWatchTimer = 0;
                if (disposed || ticket !== this.job || !frame.isConnected || this.mode !== 'thread') return;
                syncFrameUrl();
                frameWatchTimer = window.setTimeout(watchFrameUrl, 500);
            };
            const navigate = (rawUrl) => {
                const nextUrl = Urls.framePreview(rawUrl);
                if (!nextUrl) {
                    showStatus('请输入 http(s) 地址或站内路径');
                    urlInput.focus();
                    return;
                }
                loadFrameUrl(nextUrl, { pushHistory: true });
            };
            const handleFrameAction = (action) => {
                const currentUrl = currentFrameUrl();
                if (action === 'jump') {
                    hideHistoryMenu();
                    navigate(urlInput.value);
                    return true;
                }
                if (action === 'reload' || action === 'retry') {
                    loadFrameUrl(currentUrl, { pushHistory: false });
                    return true;
                }
                if (action === 'copy') {
                    copyText(currentUrl, '已复制当前链接');
                    return true;
                }
                if (action === 'open') {
                    const opened = window.open(currentUrl, '_blank', 'noopener,noreferrer');
                    if (opened) opened.opener = null;
                    return true;
                }
                if (action === 'original') {
                    navigate(Urls.absolute(this.sourceHref || Urls.canonicalTopic(topicId)));
                    return true;
                }
                if (action === 'initial') {
                    navigate(initialTopicUrl);
                    return true;
                }
                return false;
            };
            this.frameControls = {
                currentUrl: currentFrameUrl,
                run: (action) => {
                    hideHistoryMenu();
                    return handleFrameAction(action);
                }
            };
            this.loadedContentCleanup = () => {
                if (disposed) return;
                disposed = true;
                clearLoadTimer();
                clearFrameWatchTimer();
                clearNudgeTimer();
                hideHistoryMenu();
                releaseWatchedFrameDoc();
                try {
                    frame.src = 'about:blank';
                    frame.removeAttribute('src');
                } catch (_) {
                    // iframe 释放失败时继续移除 DOM，避免关闭流程被打断。
                }
            };
            this.renderSidebar();

            frame.addEventListener('load', () => {
                if (disposed || ticket !== this.job) return;
                clearLoadTimer();
                syncFrameUrl(true);
                watchFrameInteractions();
                this.bindAutoScrollFrame(frame);
                syncTitleFromFrame();
                status.remove();
                clearNudgeTimer();
                nudgeTimer = this.nudgeFrame(frame, ticket);
            });
            frame.addEventListener('error', () => {
                if (disposed || ticket !== this.job) return;
                clearLoadTimer();
                showStatus('详情页面加载失败。', statusActions());
            });
            urlForm.addEventListener('submit', (event) => {
                event.preventDefault();
                hideHistoryMenu();
                navigate(urlInput.value);
            });
            backButton.addEventListener('click', () => {
                hideHistoryMenu();
                if (frameHistoryIndex <= 0) return;
                frameHistoryIndex -= 1;
                loadFrameUrl(frameHistory[frameHistoryIndex], { pushHistory: false });
            });
            forwardButton.addEventListener('click', () => {
                hideHistoryMenu();
                if (frameHistoryIndex >= frameHistory.length - 1) return;
                frameHistoryIndex += 1;
                loadFrameUrl(frameHistory[frameHistoryIndex], { pushHistory: false });
            });
            backButton.addEventListener('mouseenter', () => showHistoryMenu('back'));
            forwardButton.addEventListener('mouseenter', () => showHistoryMenu('forward'));
            navGroup.addEventListener('mouseenter', keepHistoryMenu);
            navGroup.addEventListener('mouseleave', scheduleHistoryHide);
            historyMenu.addEventListener('mouseenter', keepHistoryMenu);
            historyMenu.addEventListener('mouseleave', scheduleHistoryHide);
            [backButton, forwardButton].forEach((button) => {
                button.addEventListener('contextmenu', (event) => {
                    event.preventDefault();
                    showHistoryMenu(button === backButton ? 'back' : 'forward', button);
                });
            });
            historyMenu.addEventListener('click', (event) => {
                const item = event.target.closest('[data-history-index]');
                if (!item) return;
                const index = Number(item.dataset.historyIndex);
                if (!Number.isInteger(index) || index < 0 || index >= frameHistory.length) return;
                frameHistoryIndex = index;
                loadFrameUrl(frameHistory[frameHistoryIndex], { pushHistory: false });
            });
            status.addEventListener('click', (event) => {
                const action = event.target.closest('[data-frame-action]')?.dataset.frameAction;
                if (!action) return;
                event.preventDefault();
                handleFrameAction(action);
            });
            urlInput.addEventListener('blur', () => {
                if (lastFrameUrl) urlInput.value = lastFrameUrl;
            });
            updateNavButtons();

            frameShell = Dom.make('section', { className: `${NAME}-frame-shell` }, [
                Dom.make('div', { className: `${NAME}-frame-top` }, [urlForm]),
                frameWrap,
                historyMenu
            ]);
            frameShell.addEventListener('pointerdown', (event) => {
                if (event.target.closest(`.${NAME}-frame-navs`)) return;
                if (event.target.closest(`.${NAME}-frame-history-menu`)) return;
                hideHistoryMenu();
            });

            this.body.replaceChildren(frameShell);
            this.body.scrollTop = 0;
            startLoadTimer();
            saveFrameState();
            watchFrameUrl();
        },

        threadFrameUrl(topicId) {
            if (Prefs.value.threadSource === 'original' && this.sourceHref) {
                return Urls.absolute(this.sourceHref);
            }
            return Urls.nestedThread(topicId);
        },

        nudgeFrame(frame, ticket) {
            return window.setTimeout(() => {
                if (ticket !== this.job || !frame.isConnected) return;
                try {
                    const doc = frame.contentDocument || frame.contentWindow?.document;
                    const root = doc?.scrollingElement || doc?.documentElement;
                    if (!doc?.body || !root) return;

                    doc.documentElement.style.overscrollBehavior = 'contain';
                    doc.body.style.overscrollBehavior = 'contain';

                    const posts = Array.from(doc.querySelectorAll([
                        'article.topic-post',
                        '.topic-post',
                        '[data-post-id][data-post-number]',
                        '.topic-body'
                    ].join(','))).filter((element) => {
                        const rect = element.getBoundingClientRect();
                        return rect.width > 0 && rect.height > 24;
                    });

                    const target = posts[1] || posts[0];
                    if (!target) return;
                    const top = Math.max(0, root.scrollTop + target.getBoundingClientRect().top - 12);
                    root.scrollTo({ top, behavior: 'smooth' });
                } catch (_) {
                    // iframe 本身可用；这里仅做同源页面的滚动优化。
                }
            }, 160);
        }
    };

    const MemoryStats = {
        snapshot() {
            const persistentParts = [
                this.part('设置', Prefs.value, Object.keys(Prefs.value).length),
                this.part('已读记忆', ReadMemory.items, ReadMemory.items.length),
                this.part('收藏话题', Favorites.items, Favorites.items.length),
                this.part('稍后阅读', ReadLaterQueue.items, ReadLaterQueue.items.length),
                this.part('页面导航', PageNav.items, PageNav.items.length),
                this.part('抽屉恢复', DrawerState.value, DrawerState.value ? 1 : 0)
            ];
            const volatileParts = [
                { label: '预览缓存', count: StarterPostStore.cache.size, bytes: this.topicCacheBytes() },
                this.part('预加载标记', Array.from(StarterPostStore.preloadAt.entries()), StarterPostStore.preloadAt.size),
                this.part('相似话题索引', this.similarTopicPayload(), SimilarTopics.candidateCache?.length || 0),
                this.part('话题标记索引', {
                    newTopicIds: Array.from(TopicBadges.newTopicIds),
                    watchingTopics: Array.from(TopicBadges.watchingTopics)
                }, TopicBadges.newTopicIds.size + TopicBadges.watchingTopics.size),
                this.part('当前抽屉', {
                    topicId: Drawer.topicId,
                    title: Drawer.topicTitle,
                    href: Drawer.sourceHref,
                    mode: Drawer.mode,
                    sidebarPanel: Drawer.activeSidebarPanel
                }, Drawer.topicId ? 1 : 0)
            ];
            const interfacePart = this.interfacePart();
            const persistentBytes = this.sum(persistentParts);
            const volatileBytes = this.sum(volatileParts);
            const selfBytes = persistentBytes + volatileBytes + interfacePart.bytes;

            return {
                selfBytes,
                persistentBytes,
                volatileBytes,
                interfacePart,
                parts: [...persistentParts, ...volatileParts, interfacePart],
                heap: this.pageHeap(),
                sampledAt: Date.now()
            };
        },

        part(label, value, count = 0) {
            return {
                label,
                count: Number(count) || 0,
                bytes: estimateSerializedBytes(value)
            };
        },

        sum(parts) {
            return parts.reduce((total, part) => total + (Number(part.bytes) || 0), 0);
        },

        topicCacheBytes() {
            let bytes = 0;
            StarterPostStore.cache.forEach((value, key) => {
                bytes += estimateSerializedBytes(key);
                const measured = StarterPostStore.cacheBytes.get(key);
                bytes += Number.isFinite(measured) ? measured : estimateSerializedBytes(value);
            });
            return bytes;
        },

        similarTopicPayload() {
            const index = [];
            SimilarTopics.candidateIndex?.forEach((bucket, token) => {
                index.push([token, bucket.length]);
            });
            return {
                cacheKey: SimilarTopics.candidateCacheKey,
                candidates: (SimilarTopics.candidateCache || []).map((candidate) => ({
                    id: candidate.item?.id,
                    normalized: candidate.normalized,
                    tokens: Array.from(candidate.tokens || [])
                })),
                index
            };
        },

        interfacePart() {
            const roots = [FloatingPrefs.root, Drawer.root, Drawer.shade, MiniEye.button].filter(Boolean);
            const topRoots = roots.filter((node, index) => {
                return !roots.some((other, otherIndex) => otherIndex !== index && other.contains?.(node));
            });
            let nodes = 0;
            let textBytes = 0;
            topRoots.forEach((root) => {
                nodes += this.countInterfaceNodes(root);
                textBytes += String(root.textContent || '').length * 2;
            });
            return {
                label: '界面节点',
                count: nodes,
                bytes: nodes * 180 + textBytes
            };
        },

        countInterfaceNodes(root) {
            if (!(root instanceof Element)) return 0;
            const showElement = window.NodeFilter?.SHOW_ELEMENT || 1;
            const walker = document.createTreeWalker(root, showElement);
            let count = 1;
            while (walker.nextNode()) count += 1;
            return count;
        },

        pageHeap() {
            const memory = typeof performance !== 'undefined' ? performance.memory : null;
            const used = Number(memory?.usedJSHeapSize);
            const total = Number(memory?.totalJSHeapSize);
            const limit = Number(memory?.jsHeapSizeLimit);
            if (!Number.isFinite(used)) return { supported: false };
            return {
                supported: true,
                used,
                total: Number.isFinite(total) ? total : 0,
                limit: Number.isFinite(limit) ? limit : 0
            };
        },

        heapText(heap) {
            if (!heap?.supported) return '浏览器不支持';
            const total = heap.total ? ` / ${formatBytes(heap.total)}` : '';
            const limit = heap.limit ? ` · 上限 ${formatBytes(heap.limit)}` : '';
            return `${formatBytes(heap.used)}${total}${limit}`;
        },

        partText(part) {
            const count = part.count ? ` · ${part.count}项` : '';
            return `${formatBytes(part.bytes)}${count}`;
        }
    };

    function formatFavoriteTime(timestamp) {
        const time = Number(timestamp);
        if (!Number.isFinite(time)) return '';
        const diff = Date.now() - time;
        if (diff < 60 * 1000) return '刚刚收藏';
        if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / 60000))}分钟前`;
        if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}小时前`;
        return new Date(time).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
    }

    function supportCards() {
        return SUPPORT_LINKS.map((item) => Dom.make('a', {
            className: `${NAME}-support-card`,
            href: item.href,
            target: '_blank',
            rel: 'noopener noreferrer',
            title: `${item.title}：${item.amount}`
        }, [
            Dom.make('span', { className: `${NAME}-support-card-copy` }, [
                Dom.make('span', { className: `${NAME}-support-card-title`, text: item.title }),
                Dom.make('span', { className: `${NAME}-support-card-desc`, text: item.desc })
            ]),
            Dom.make('span', { className: `${NAME}-support-card-side` }, [
                Dom.make('span', { className: `${NAME}-support-card-amount`, text: item.amount }),
                Dom.make('span', { className: `${NAME}-support-card-open`, text: '打开' })
            ])
        ]));
    }

    function supportHeaderButton() {
        return Dom.make('button', {
            type: 'button',
            className: `${NAME}-support-chip`,
            title: '支持我 / LDC 打赏',
            'aria-label': '支持我 / LDC 打赏',
            'aria-expanded': 'false',
            'data-pref-action': 'toggle-support'
        }, [
            Dom.make('span', { className: `${NAME}-support-chip-icon`, 'aria-hidden': 'true', text: '♥' })
        ]);
    }

    function supportHeaderPanel() {
        return Dom.make('div', {
            className: `${NAME}-support-popover ${NAME}-support-list`,
            hidden: 'hidden',
            'data-pref-support-panel': '1'
        }, supportCards());
    }

    function supportHeaderLink() {
        return Dom.make('div', { className: `${NAME}-support-header` }, [
            supportHeaderButton(),
            supportHeaderPanel()
        ]);
    }

    const LiveTopics = {
        panel: null,
        button: null,
        topics: [],
        rawTopics: [],
        categories: new Map(),
        siteCategories: null,
        siteCategoriesPromise: null,
        seenIds: new Set(),
        unreadIds: new Set(),
        timer: 0,
        inFlight: false,
        lastFetchAt: 0,
        error: '',

        mount(button, host) {
            this.button = button || this.button;
            if (!this.panel) {
                this.panel = this.buildPanel();
                this.panel.addEventListener('click', (event) => this.onClick(event));
            }
            if (host && !this.panel.isConnected) host.appendChild(this.panel);
            this.syncButton();
            this.configure();
        },

        buildPanel() {
            return Dom.make('section', {
                className: `${NAME}-live-panel`,
                'aria-label': '实时最新帖子'
            });
        },

        toggle(force) {
            const open = typeof force === 'boolean' ? force : !this.isOpen();
            if (open) this.open();
            else this.hide();
        },

        open() {
            if (!this.panel) return;
            FloatingPrefs.hide();
            RecentTopics.hide();
            this.panel.classList.add('is-open');
            this.markAllRead();
            this.render();
            if (!this.topics.length && !this.inFlight) this.fetchNow({ manual: true });
        },

        hide() {
            this.panel?.classList.remove('is-open');
            this.syncButton();
        },

        isOpen() {
            return this.panel?.classList.contains('is-open') === true;
        },

        configure() {
            this.stop();
            this.syncButton();
            if (Prefs.value.liveEnabled) {
                this.schedule();
                if (!this.topics.length) this.fetchNow({ silent: true });
            }
        },

        stop() {
            if (!this.timer) return;
            window.clearTimeout(this.timer);
            this.timer = 0;
        },

        schedule() {
            this.stop();
            const delay = Math.max(3, Number(Prefs.value.livePollMinutes) || 10) * 60000;
            this.timer = window.setTimeout(() => {
                this.timer = 0;
                if (Prefs.value.liveEnabled) this.fetchNow({ silent: true }).finally(() => this.schedule());
            }, delay);
        },

        async fetchNow(options = {}) {
            if (this.inFlight) return;
            if (Prefs.value.livePauseHidden && document.visibilityState === 'hidden' && !options.manual) return;
            this.inFlight = true;
            this.error = '';
            this.render();
            Drawer.renderSidebar();
            try {
                this.applyPayload(await this.fetchLatestPayload());
                this.lastFetchAt = Date.now();
                if (options.manual) showToast('实时新帖已刷新');
            } catch (error) {
                this.error = error?.message || '刷新失败';
                console.warn(`${LOG_PREFIX} 实时新帖刷新失败`, error);
                if (options.manual) showToast('实时新帖刷新失败');
            } finally {
                this.inFlight = false;
                this.syncButton();
                this.render();
                Drawer.renderSidebar();
            }
        },

        async fetchLatestPayload() {
            const payloads = [];
            const seenTopicIds = new Set();
            const targetCount = Math.max(5, Math.min(150, Number(Prefs.value.liveMaxTopics) || 50));
            const pageLimit = Math.max(1, Math.min(6, Math.ceil(targetCount / 30) + 1));

            for (let page = 0; page < pageLimit; page += 1) {
                const res = await fetch(this.latestUrl(page), {
                    credentials: 'include',
                    headers: { Accept: 'application/json' }
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const payload = await res.json();
                const topics = Array.isArray(payload?.topic_list?.topics) ? payload.topic_list.topics : [];
                if (page > 0 && !topics.length) break;
                payloads.push(payload);
                topics.forEach((topic) => {
                    const id = String(topic?.id || '');
                    if (id) seenTopicIds.add(id);
                });
                if (seenTopicIds.size >= targetCount) break;
            }

            return this.mergeLatestPayloads(payloads, await this.fetchSiteCategories());
        },

        latestUrl(page = 0) {
            const params = new URLSearchParams();
            if (Prefs.value.liveCreatedOrder) params.set('order', 'created');
            if (page > 0) params.set('page', String(page));
            const query = params.toString();
            return `/latest.json${query ? `?${query}` : ''}`;
        },

        mergeLatestPayloads(payloads, siteCategories = []) {
            const base = payloads[0] || {};
            const topicMap = new Map();
            const categories = Array.isArray(siteCategories) ? [...siteCategories] : [];
            const categoryList = [];
            const topicCategories = [];
            payloads.forEach((payload) => {
                (Array.isArray(payload?.topic_list?.topics) ? payload.topic_list.topics : []).forEach((topic) => {
                    const id = String(topic?.id || '');
                    if (id && !topicMap.has(id)) topicMap.set(id, topic);
                });
                if (Array.isArray(payload?.categories)) categories.push(...payload.categories);
                if (Array.isArray(payload?.category_list?.categories)) categoryList.push(...payload.category_list.categories);
                if (Array.isArray(payload?.topic_list?.categories)) topicCategories.push(...payload.topic_list.categories);
            });

            return {
                ...base,
                categories,
                category_list: {
                    ...(base.category_list || {}),
                    categories: categoryList
                },
                topic_list: {
                    ...(base.topic_list || {}),
                    categories: topicCategories,
                    topics: Array.from(topicMap.values())
                }
            };
        },

        async fetchSiteCategories() {
            if (Array.isArray(this.siteCategories)) return this.siteCategories;
            const cached = this.readSiteCategoriesCache();
            if (cached.fresh) {
                this.siteCategories = cached.categories;
                return cached.categories;
            }
            if (!this.siteCategoriesPromise) {
                this.siteCategoriesPromise = fetch('/site.json', {
                    credentials: 'include',
                    headers: { Accept: 'application/json' }
                }).then((res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                }).then((payload) => {
                    const categories = this.flattenCategories(payload?.categories || payload?.category_list?.categories || []);
                    this.siteCategories = categories;
                    this.writeSiteCategoriesCache(categories);
                    return categories;
                }).catch((error) => {
                    console.warn(`${LOG_PREFIX} 实时新帖分类表获取失败`, error);
                    this.siteCategories = cached.categories;
                    return cached.categories;
                }).finally(() => {
                    this.siteCategoriesPromise = null;
                });
            }
            return this.siteCategoriesPromise;
        },

        readSiteCategoriesCache() {
            try {
                const payload = JSON.parse(window.localStorage.getItem(SITE_CATEGORIES_KEY) || 'null');
                const categories = Array.isArray(payload?.categories) ? payload.categories : [];
                const fetchedAt = Number(payload?.fetchedAt || 0);
                const fresh = categories.length > 0 && fetchedAt > 0 && Date.now() - fetchedAt < SITE_CATEGORIES_TTL;
                return { categories, fresh };
            } catch (_) {
                return { categories: [], fresh: false };
            }
        },

        writeSiteCategoriesCache(categories) {
            try {
                window.localStorage.setItem(SITE_CATEGORIES_KEY, JSON.stringify({
                    fetchedAt: Date.now(),
                    categories: Array.isArray(categories) ? categories : []
                }));
            } catch (_) {
                // 分类表只是性能缓存，写入失败不影响实时列表功能。
            }
        },

        siteCategoryChoices() {
            const source = Array.isArray(this.siteCategories)
                ? this.siteCategories
                : this.readSiteCategoriesCache().categories;
            const map = new Map();
            this.flattenCategories(source).forEach((category) => {
                const id = Number(category?.id);
                if (!Number.isFinite(id) || map.has(id)) return;
                map.set(id, {
                    id,
                    name: category.name || category.title || `分类 ${id}`,
                    slug: category.slug || ''
                });
            });
            return Array.from(map.values());
        },

        flattenCategories(list, output = []) {
            if (!Array.isArray(list)) return output;
            list.forEach((category) => {
                if (!category || typeof category !== 'object') return;
                output.push(category);
                this.flattenCategories(category.subcategory_list, output);
                this.flattenCategories(category.subcategories, output);
            });
            return output;
        },

        applyPayload(payload) {
            this.categories = this.categoryMap(payload);
            this.rawTopics = Array.isArray(payload?.topic_list?.topics) ? payload.topic_list.topics : [];
            const nextTopics = this.filteredTopics();
            if (this.seenIds.size) {
                nextTopics.forEach((topic) => {
                    if (!this.seenIds.has(topic.id)) this.unreadIds.add(topic.id);
                });
            }
            nextTopics.forEach((topic) => this.seenIds.add(topic.id));
            this.topics = nextTopics;
            if (this.isOpen()) this.markAllRead();
        },

        filteredTopics() {
            return this.rawTopics
                .map((topic) => this.topicModel(topic))
                .filter(Boolean)
                .filter((topic) => this.matchesFilter(topic))
                .slice(0, Prefs.value.liveMaxTopics);
        },

        refreshFilter() {
            this.topics = this.filteredTopics();
            this.render();
            Drawer.renderSidebar();
        },

        categoryMap(payload) {
            const map = new Map();
            [payload?.categories, payload?.category_list?.categories, payload?.topic_list?.categories].forEach((list) => {
                this.flattenCategories(list).forEach((category) => {
                    this.addCategoryToMap(map, category);
                });
            });
            return map;
        },

        addCategoryToMap(map, category) {
            const id = Number(category?.id);
            if (!Number.isFinite(id)) return;
            map.set(id, {
                id,
                name: category.name || category.title || `分类 ${id}`,
                slug: category.slug || ''
            });
        },

        topicModel(topic) {
            const id = String(topic?.id || '');
            if (!id) return null;
            const category = this.categories.get(Number(topic.category_id)) || null;
            const slug = topic.slug ? `/${encodeURIComponent(topic.slug)}` : '';
            return {
                id,
                title: topic.title || topic.fancy_title || `话题 ${id}`,
                href: `/t${slug}/${encodeURIComponent(id)}`,
                categoryId: Number(topic.category_id) || 0,
                categoryName: category?.name || (topic.category_id ? `分类 ${topic.category_id}` : '未分类'),
                categorySlug: category?.slug || '',
                replies: Math.max(0, Number(topic.posts_count || 1) - 1),
                views: Number(topic.views || 0),
                lastPostedAt: topic.last_posted_at || topic.bumped_at || topic.created_at || ''
            };
        },

        filterTokens() {
            return String(Prefs.value.liveCategoryFilter || '')
                .split(/[\n,，;；]+/)
                .map((item) => item.trim().toLowerCase())
                .filter(Boolean);
        },

        matchesFilter(topic) {
            const tokens = this.filterTokens();
            if (!tokens.length) return true;
            const fields = [String(topic.categoryId || ''), topic.categoryName, topic.categorySlug]
                .map((value) => String(value || '').toLowerCase());
            return tokens.some((token) => fields.some((field) => field === token || field.includes(token)));
        },

        markAllRead() {
            this.unreadIds.clear();
            this.syncButton();
            Drawer.renderSidebar();
        },

        syncButton() {
            if (!this.button) return;
            const count = this.unreadIds.size;
            this.button.classList.toggle('is-active', this.isOpen());
            this.button.classList.toggle('is-enabled', Prefs.value.liveEnabled);
            this.button.setAttribute('aria-expanded', this.isOpen() ? 'true' : 'false');
            this.button.setAttribute('title', Prefs.value.liveEnabled ? '实时新帖已开启' : '打开实时新帖');
            const badge = this.button.querySelector('[data-live-count]');
            if (badge) {
                badge.textContent = count > 99 ? '99+' : String(count);
                badge.toggleAttribute('hidden', count <= 0);
            }
            if (typeof FloatingPrefs !== 'undefined') {
                FloatingPrefs.syncPieState?.();
            }
        },

        render() {
            if (!this.panel) return;
            const rows = this.topics.length
                ? this.topics.map((topic) => this.topicRow(topic))
                : [Dom.make('div', { className: `${NAME}-live-empty`, text: this.inFlight ? '正在刷新最新帖子…' : '暂无匹配的新帖' })];
            this.panel.replaceChildren(
                Dom.make('div', { className: `${NAME}-live-head` }, [
                    Dom.make('div', { className: `${NAME}-live-title`, text: '实时最新' }),
                    Dom.make('div', { className: `${NAME}-live-actions` }, [
                        Dom.make('button', { type: 'button', className: `${NAME}-live-icon`, title: '刷新', 'aria-label': '刷新实时新帖', 'data-live-action': 'refresh', text: '↻' }),
                        Dom.make('button', { type: 'button', className: `${NAME}-live-icon`, title: '关闭', 'aria-label': '关闭实时新帖', 'data-live-action': 'close', text: '×' })
                    ])
                ]),
                Dom.make('div', { className: `${NAME}-live-status`, text: this.statusText() }),
                Dom.make('div', { className: `${NAME}-live-list` }, rows)
            );
        },

        topicRow(topic) {
            const unread = this.unreadIds.has(topic.id);
            return Dom.make('button', {
                type: 'button',
                className: `${NAME}-live-topic${unread ? ' is-unread' : ''}`,
                title: topic.title,
                'data-live-topic': topic.id
            }, [
                Dom.make('span', { className: `${NAME}-live-topic-title`, text: topic.title }),
                Dom.make('span', { className: `${NAME}-live-topic-meta`, text: `${topic.categoryName} · ${this.relativeTime(topic.lastPostedAt)} · ${topic.replies} 回复 · ${topic.views} 浏览` })
            ]);
        },

        statusText() {
            if (this.error) return `刷新失败：${this.error}`;
            const mode = Prefs.value.liveEnabled ? `${Prefs.value.livePollMinutes} 分钟轮询` : '手动刷新';
            const order = Prefs.value.liveCreatedOrder ? '创建排序' : '默认排序';
            const filter = this.filterTokens().length ? '已过滤板块' : '全部板块';
            const time = this.lastFetchAt ? new Date(this.lastFetchAt).toLocaleTimeString('zh-CN', { hour12: false }) : '尚未刷新';
            return `${mode} · ${order} · ${filter} · ${time}`;
        },

        relativeTime(iso) {
            const time = Date.parse(iso || '');
            if (!Number.isFinite(time)) return '未知时间';
            const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
            if (minutes < 1) return '刚刚';
            if (minutes < 60) return `${minutes} 分钟前`;
            const hours = Math.round(minutes / 60);
            if (hours < 24) return `${hours} 小时前`;
            return `${Math.round(hours / 24)} 天前`;
        },

        onClick(event) {
            const action = event.target.closest('[data-live-action]')?.dataset.liveAction;
            if (action === 'refresh') {
                event.preventDefault();
                this.fetchNow({ manual: true });
                return;
            }
            if (action === 'close') {
                event.preventDefault();
                this.hide();
                return;
            }
            const topicId = event.target.closest('[data-live-topic]')?.dataset.liveTopic;
            if (!topicId) return;
            const topic = this.topics.find((item) => item.id === topicId);
            if (!topic) return;
            this.unreadIds.delete(topicId);
            this.syncButton();
            Drawer.open(topic.id, Prefs.value.mode, null, topic.href, {
                title: topic.title,
                sidebarPanel: 'live',
                trackSource: 'live'
            });
            this.hide();
        }
    };

    const RecentTopics = {
        panel: null,
        button: null,

        mount(button, host) {
            this.button = button || this.button;
            if (!this.panel) {
                this.panel = this.buildPanel();
                this.panel.addEventListener('click', (event) => this.onClick(event));
            }
            if (host && !this.panel.isConnected) host.appendChild(this.panel);
            this.syncButton();
        },

        buildPanel() {
            return Dom.make('section', {
                className: `${NAME}-live-panel ${NAME}-recent-panel`,
                'aria-label': '最近查看'
            });
        },

        toggle(force) {
            const open = typeof force === 'boolean' ? force : !this.isOpen();
            if (open) this.open();
            else this.hide();
        },

        open() {
            if (!this.panel) return;
            FloatingPrefs.hide();
            LiveTopics.hide();
            this.panel.classList.add('is-open');
            this.render();
            this.syncButton();
        },

        hide() {
            this.panel?.classList.remove('is-open');
            this.syncButton();
        },

        isOpen() {
            return this.panel?.classList.contains('is-open') === true;
        },

        items() {
            return ReadMemory.items.slice(0, Prefs.value.recentLimit);
        },

        sync() {
            this.syncButton();
            if (this.isOpen()) this.render();
        },

        syncButton() {
            if (!this.button) return;
            const count = this.items().length;
            this.button.classList.toggle('is-active', this.isOpen());
            this.button.setAttribute('aria-expanded', this.isOpen() ? 'true' : 'false');
            this.button.setAttribute('title', count ? `打开最近查看（${count}）` : '打开最近查看');
            const badge = this.button.querySelector('[data-recent-count]');
            if (badge) {
                badge.textContent = count > 99 ? '99+' : String(count);
                badge.toggleAttribute('hidden', count <= 0);
            }
        },

        render() {
            if (!this.panel) return;
            const items = this.items();
            const rows = items.length
                ? items.map((item) => this.topicRow(item))
                : [Dom.make('div', { className: `${NAME}-live-empty`, text: '暂无最近查看' })];
            this.panel.replaceChildren(
                Dom.make('div', { className: `${NAME}-live-head` }, [
                    Dom.make('div', { className: `${NAME}-live-title`, text: '最近查看' }),
                    Dom.make('div', { className: `${NAME}-live-actions` }, [
                        Dom.make('button', { type: 'button', className: `${NAME}-live-icon`, title: '关闭', 'aria-label': '关闭最近查看', 'data-recent-action': 'close', text: '×' })
                    ])
                ]),
                Dom.make('div', { className: `${NAME}-live-status`, text: this.statusText(items.length) }),
                Dom.make('div', { className: `${NAME}-live-list ${NAME}-recent-list` }, rows)
            );
        },

        topicRow(item) {
            const active = String(item.id) === String(Drawer.topicId || '');
            return Dom.make('button', {
                type: 'button',
                className: `${NAME}-live-topic ${NAME}-recent-topic${active ? ' is-active' : ''}`,
                title: `${item.title}\n${item.href || ''}`,
                'data-recent-topic': item.id
            }, [
                Dom.make('span', { className: `${NAME}-live-topic-title`, text: item.title }),
                Dom.make('span', { className: `${NAME}-live-topic-meta`, text: formatFavoriteTime(item.readAt || item.at) })
            ]);
        },

        statusText(count) {
            return `显示 ${count} / ${ReadMemory.items.length} 条 · 上限 ${Prefs.value.recentLimit}`;
        },

        onClick(event) {
            const action = event.target.closest('[data-recent-action]')?.dataset.recentAction;
            if (action === 'close') {
                event.preventDefault();
                this.hide();
                return;
            }
            const topicId = event.target.closest('[data-recent-topic]')?.dataset.recentTopic;
            if (!topicId) return;
            const item = ReadMemory.get(topicId);
            if (!item) return;
            this.hide();
            Drawer.open(item.id, Prefs.value.mode, null, item.href, {
                title: item.title,
                sidebarPanel: 'recent',
                preserveRecentOrder: true,
                trackSource: 'recent'
            });
        }
    };

    // 页面级设置入口，不依赖抽屉打开，方便用户先配置默认行为。
    const FloatingPrefs = {
        root: null,
        button: null,
        menu: null,
        liveButton: null,
        recentButton: null,
        panel: null,
        drag: null,
        ignoreClick: false,
        activeTab: 'quick',
        keywordRefreshTimer: 0,
        memoryTimer: 0,
        recentSearch: '',
        supportOpen: false,
        pieHighlightSpan: 54,

        mount() {
            if (this.root) return;

            this.button = Dom.make('button', {
                className: `${NAME}-pref-button ${NAME}-pie-trigger`,
                type: 'button',
                title: `${APP_NAME} 快捷菜单`,
                'aria-label': `${APP_NAME} 快捷菜单`,
                'aria-expanded': 'false',
                'data-pie-toggle': '1'
            }, [
                Dom.make('span', { className: `${NAME}-launcher-symbol`, 'aria-hidden': 'true' }, [
                    Dom.make('span', { className: `${NAME}-launcher-dot` }),
                    Dom.make('span', { className: `${NAME}-launcher-dot` }),
                    Dom.make('span', { className: `${NAME}-launcher-dot` }),
                    Dom.make('span', { className: `${NAME}-launcher-dot` })
                ])
            ]);
            this.menu = this.buildPieMenu();
            this.liveButton = this.menu.querySelector('[data-pie-action="live"]');
            this.recentButton = this.menu.querySelector('[data-pie-action="recent"]');

            this.panel = this.buildPanel();
            this.root = Dom.make('div', { id: `${NAME}-prefs` }, [this.button, this.menu, this.panel]);
            this.root.addEventListener('click', (event) => this.onClick(event));
            this.root.addEventListener('input', (event) => this.onInput(event));
            this.root.addEventListener('change', (event) => this.onInput(event));
            this.menu.addEventListener('pointerover', (event) => this.onPieItemEnter(event));
            this.menu.addEventListener('pointerout', (event) => this.onPieItemLeave(event));
            this.menu.addEventListener('focusin', (event) => this.onPieItemEnter(event));
            this.menu.addEventListener('focusout', () => this.onPieFocusOut());
            this.button.addEventListener('pointerenter', (event) => this.onButtonPointerEnter(event));
            this.button.addEventListener('pointerdown', (event) => this.onButtonPointerDown(event));
            this.button.addEventListener('pointermove', (event) => this.onButtonPointerMove(event));
            this.button.addEventListener('pointerup', (event) => this.onButtonPointerUp(event));
            this.button.addEventListener('pointercancel', (event) => this.onButtonPointerUp(event));
            this.panel.addEventListener('pointerdown', (event) => {
                if (event.target.closest('[data-size-field], [data-size-input], [data-size-track]')) event.stopPropagation();
            }, true);
            this.bindSettingsRoot(this.panel);

            document.addEventListener('pointerdown', (event) => {
                if (!this.isOpen() && !this.isPieOpen() && !LiveTopics.isOpen() && !RecentTopics.isOpen()) return;
                if (event.target instanceof Node && this.root.contains(event.target)) return;
                this.hide();
                LiveTopics.hide();
                RecentTopics.hide();
            }, true);

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    this.hide();
                    LiveTopics.hide();
                    RecentTopics.hide();
                }
            });

            document.body.appendChild(this.root);
            LiveTopics.mount(this.liveButton, this.root);
            RecentTopics.mount(this.recentButton, this.root);
            this.applyTheme();
            this.applyPosition();
            this.sync();
        },

        pieItems() {
            return [
                {
                    id: 'drawer',
                    label: '抽屉',
                    title: '打开 / 继续抽屉',
                    icon: 'drawer'
                },
                {
                    id: 'live',
                    label: '实时',
                    title: '实时最新帖子',
                    icon: 'live',
                    badge: 'live'
                },
                {
                    id: 'recent',
                    label: '最近',
                    title: '最近查看',
                    icon: 'recent',
                    badge: 'recent'
                },
                {
                    id: 'queue',
                    label: '队列',
                    title: '稍后阅读队列',
                    icon: 'queue'
                },
                {
                    id: 'nav',
                    label: '导航',
                    title: '页面导航',
                    icon: 'nav'
                },
                {
                    id: 'topics',
                    label: '话题',
                    title: '收藏与最近查看',
                    icon: 'topics'
                },
                {
                    id: 'rules',
                    label: '筛选',
                    title: '关键词筛选规则',
                    icon: 'rules'
                },
                {
                    id: 'mode',
                    label: '模式',
                    title: '切换默认打开方式',
                    icon: 'mode'
                },
                {
                    id: 'data',
                    label: '数据',
                    title: '数据与缓存维护',
                    icon: 'data'
                },
                {
                    id: 'settings',
                    label: '设置',
                    title: `${APP_NAME} 设置`,
                    icon: 'settings'
                }
            ];
        },

        buildPieMenu() {
            return Dom.make('div', {
                className: `${NAME}-pie-menu`,
                role: 'menu',
                'aria-label': `${APP_NAME} 快捷菜单`
            }, this.pieItems().map((item, index, items) => this.pieItem(item, index, items.length)));
        },

        pieItem(item, index, total) {
            const children = [
                Dom.make('span', { className: `${NAME}-pie-item-icon ${NAME}-pie-icon-${item.icon}`, 'aria-hidden': 'true' }, this.pieIcon(item)),
                Dom.make('span', { className: `${NAME}-pie-item-label`, text: item.label })
            ];
            if (item.badge === 'live') {
                children.push(Dom.make('span', {
                    className: `${NAME}-live-count`,
                    'data-live-count': '1',
                    hidden: 'hidden',
                    text: '0'
                }));
            }
            if (item.badge === 'recent') {
                children.push(Dom.make('span', {
                    className: `${NAME}-live-count ${NAME}-recent-count`,
                    'data-recent-count': '1',
                    hidden: 'hidden',
                    text: '0'
                }));
            }
            return Dom.make('button', {
                className: `${NAME}-pie-item`,
                type: 'button',
                role: 'menuitem',
                title: item.title,
                'aria-label': item.title,
                'aria-expanded': 'false',
                'data-pie-action': item.id,
                'data-pie-index': String(index),
                'data-pie-total': String(total)
            }, children);
        },

        pieIcon(item) {
            if (item.icon === 'drawer') {
                return Dom.make('span', { className: `${NAME}-pie-drawer-icon` }, [
                    Dom.make('span')
                ]);
            }
            if (item.icon === 'settings') {
                return Dom.make('span', { className: `${NAME}-pie-settings-icon` }, [
                    Dom.make('span'),
                    Dom.make('span'),
                    Dom.make('span')
                ]);
            }
            if (item.icon === 'live') {
                return Dom.make('span', { className: `${NAME}-pie-live-icon` }, [
                    Dom.make('span'),
                    Dom.make('span')
                ]);
            }
            if (item.icon === 'recent') {
                return Dom.make('span', { className: `${NAME}-pie-recent-icon` }, [
                    Dom.make('span'),
                    Dom.make('span')
                ]);
            }
            if (item.icon === 'queue') {
                return Dom.make('span', { className: `${NAME}-pie-queue-icon` }, [
                    Dom.make('span'),
                    Dom.make('span'),
                    Dom.make('span')
                ]);
            }
            if (item.icon === 'topics') {
                return Dom.make('span', { className: `${NAME}-pie-topics-icon` }, [
                    Dom.make('span')
                ]);
            }
            if (item.icon === 'nav') {
                return Dom.make('span', { className: `${NAME}-pie-nav-icon` }, [
                    Dom.make('span')
                ]);
            }
            if (item.icon === 'rules') {
                return Dom.make('span', { className: `${NAME}-pie-rules-icon` }, [
                    Dom.make('span')
                ]);
            }
            if (item.icon === 'mode') {
                return Dom.make('span', { className: `${NAME}-pie-mode-icon` }, [
                    Dom.make('span')
                ]);
            }
            if (item.icon === 'data') {
                return Dom.make('span', { className: `${NAME}-pie-data-icon` }, [
                    Dom.make('span')
                ]);
            }
            return Dom.make('span', { className: `${NAME}-pie-dot` });
        },

        onPieItemEnter(event) {
            const item = event.target?.closest?.('[data-pie-action]');
            if (!item || !this.menu?.contains(item)) return;
            this.highlightPieItem(item);
        },

        onPieItemLeave(event) {
            const item = event.target?.closest?.('[data-pie-action]');
            if (!item || !this.menu?.contains(item)) return;
            if (event.relatedTarget instanceof Node && item.contains(event.relatedTarget)) return;
            const next = event.relatedTarget?.closest?.('[data-pie-action]');
            if (next && this.menu.contains(next)) {
                this.highlightPieItem(next);
                return;
            }
            this.clearPieHighlight();
        },

        onPieFocusOut() {
            window.requestAnimationFrame(() => {
                const focused = document.activeElement?.closest?.('[data-pie-action]');
                if (focused && this.menu?.contains(focused)) {
                    this.highlightPieItem(focused);
                    return;
                }
                this.clearPieHighlight();
            });
        },

        highlightPieItem(item) {
            if (!this.menu || !item || !this.menu.contains(item) || !this.isPieOpen()) return;
            const angle = Number(item.dataset.pieAngle);
            const span = Number(item.dataset.pieSpan) || this.pieHighlightSpan;
            if (!Number.isFinite(angle)) return;
            const label = item.querySelector(`.${NAME}-pie-item-label`)?.textContent || item.getAttribute('aria-label') || '';
            const cssAngle = angle + 90;
            this.menu.style.setProperty('--pie-highlight-start', `${Math.round(cssAngle - span / 2)}deg`);
            this.menu.style.setProperty('--pie-highlight-span', `${Math.round(span)}deg`);
            this.menu.setAttribute('data-pie-label', label);
            this.menu.classList.add('is-highlighted');
        },

        restorePieHighlight() {
            if (!this.menu || !this.isPieOpen()) {
                this.clearPieHighlight();
                return;
            }
            const focused = document.activeElement?.closest?.('[data-pie-action]');
            if (focused && this.menu.contains(focused)) this.highlightPieItem(focused);
            else this.clearPieHighlight();
        },

        clearPieHighlight() {
            if (!this.menu) return;
            this.menu.classList.remove('is-highlighted');
            this.menu.removeAttribute('data-pie-label');
            this.menu.style.removeProperty('--pie-highlight-start');
            this.menu.style.removeProperty('--pie-highlight-span');
        },

        buildPanel() {
            return Dom.make('div', {
                className: `${NAME}-settings ${NAME}-floating-settings`,
                role: 'menu',
                'aria-label': `${APP_NAME} 设置`
            }, this.buildSettingsContent());
        },

        buildDockSettingsPanel() {
            return Dom.make('section', {
                className: `${NAME}-sidebar-panel ${NAME}-sidebar-settings-panel`,
                'aria-label': '设置'
            }, [
                Dom.make('div', {
                    className: `${NAME}-settings ${NAME}-dock-settings`,
                    'data-dock-settings': '1'
                }, this.buildSettingsContent())
            ]);
        },

        buildSettingsContent() {
            return [
                Dom.make('div', { className: `${NAME}-prefs-head` }, [
                    Dom.make('div', { className: `${NAME}-prefs-title-row` }, [
                        Dom.make('div', { className: `${NAME}-prefs-title`, text: `${APP_NAME} 设置` }),
                        supportHeaderLink()
                    ]),
                    Dom.make('div', { className: `${NAME}-prefs-subtitle`, 'data-role': 'prefs-current' })
                ]),
                Dom.make('div', { className: `${NAME}-pref-tab-strip`, 'aria-label': `${APP_NAME} 设置分组导航` }, [
                    this.tabScrollButton(-1),
                    Dom.make('div', {
                        className: `${NAME}-pref-tabs`,
                        role: 'tablist',
                        'aria-label': `${APP_NAME} 设置分组`,
                        'data-pref-tab-track': '1'
                    }, [
                        this.tabButton('quick', '队列'),
                        this.tabButton('nav', '导航'),
                        this.tabButton('display', '阅读'),
                        this.tabButton('rules', '筛选'),
                        this.tabButton('live', '实时'),
                        this.tabButton('topics', '话题'),
                        this.tabButton('data', '数据')
                    ]),
                    this.tabScrollButton(1)
                ]),
                this.tabPanel('quick', [
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title`, text: '抽屉入口' }),
                        Dom.make('button', {
                            type: 'button',
                            className: `${NAME}-resume-button`,
                            'data-pref-action': 'open-drawer'
                        }, [
                            Dom.make('span', { className: `${NAME}-favorite-title`, 'data-role': 'drawer-open-label', text: '打开抽屉' }),
                            Dom.make('span', { className: `${NAME}-favorite-meta`, 'data-role': 'drawer-open-meta', text: '暂无可继续阅读内容' })
                        ])
                    ]),
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title` }, [
                            Dom.make('span', { text: '稍后阅读' }),
                            Dom.make('span', { className: `${NAME}-section-count`, 'data-count-role': 'queue', text: '0' })
                        ]),
                        Dom.make('div', { className: `${NAME}-queue-keep-hint`, text: READ_LATER_KEEP_HINT }),
                        Dom.make('div', { className: `${NAME}-favorite-list`, 'data-role': 'queue' }),
                        Dom.make('div', { className: `${NAME}-management-actions ${NAME}-queue-actions` }, [
                            Dom.make('button', { type: 'button', className: `${NAME}-soft-btn`, 'data-pref-action': 'clear-queue', text: '清空队列' })
                        ])
                    ])
                ]),
                this.tabPanel('nav', [
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title` }, [
                            Dom.make('span', { text: '页面导航' }),
                            Dom.make('span', { className: `${NAME}-section-count`, 'data-count-role': 'page-nav', text: '0' })
                        ]),
                        Dom.make('div', { className: `${NAME}-favorite-list ${NAME}-page-nav-list`, 'data-role': 'page-nav' }),
                        Dom.make('div', { className: `${NAME}-management-actions ${NAME}-page-nav-actions` }, [
                            Dom.make('button', { type: 'button', className: `${NAME}-soft-btn`, 'data-pref-action': 'add-page-nav', text: '添加当前' }),
                            Dom.make('button', { type: 'button', className: `${NAME}-soft-btn`, 'data-pref-action': 'restore-page-nav', text: '恢复默认' }),
                            Dom.make('button', { type: 'button', className: `${NAME}-soft-btn`, 'data-pref-action': 'clear-page-nav', text: '清空导航' })
                        ])
                    ])
                ]),
                this.tabPanel('display', [
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title`, text: '站点偏好' }),
                        this.prefToggleButton('forceCreatedOrder', '按创建排序', '访问 LinuxDO 页面时自动使用 order=created'),
                        this.prefToggleButton('clickTopicToDrawer', '单击话题进抽屉', '开启后拦截普通左键单击；关闭时正常跳转'),
                        this.prefToggleButton('trackDrawerViews', '抽屉计入后台', '开启后抽屉停留片刻会补发 LinuxDo 后台话题浏览统计')
                    ]),
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title`, text: '后台统计入口' }),
                        this.prefToggleButton('trackDrawerViewsLive', '实时列表', '从实时新帖列表打开抽屉时计入后台'),
                        this.prefToggleButton('trackDrawerViewsTopicLinks', '话题快捷入口', '从页面话题快捷按钮或单击话题进抽屉时计入后台'),
                        this.prefToggleButton('trackDrawerViewsReadLater', '稍后阅读', '从稍后阅读队列打开抽屉时计入后台'),
                        this.prefToggleButton('trackDrawerViewsRecent', '最近查看', '从最近查看打开抽屉时计入后台'),
                        this.prefToggleButton('trackDrawerViewsResume', '继续抽屉', '从快捷菜单继续或恢复抽屉时计入后台'),
                        this.prefToggleButton('trackDrawerViewsFavorites', '收藏话题', '从收藏话题打开抽屉时计入后台')
                    ]),
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title`, text: '自动滚动速度' }),
                        this.autoScrollSpeedButton('fast', AUTO_SCROLL_SPEED_LEVELS.fast.label, AUTO_SCROLL_SPEED_LEVELS.fast.help),
                        this.autoScrollSpeedButton('normal', AUTO_SCROLL_SPEED_LEVELS.normal.label, AUTO_SCROLL_SPEED_LEVELS.normal.help),
                        this.autoScrollSpeedButton('slow', AUTO_SCROLL_SPEED_LEVELS.slow.label, AUTO_SCROLL_SPEED_LEVELS.slow.help)
                    ]),
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title`, text: '默认打开方式' }),
                        this.settingButton('summary', '预览模式', '读取话题 JSON，展示楼主正文'),
                        this.settingButton('thread', '详情模式', '右侧抽屉中加载详情页面 iframe')
                    ]),
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title`, text: '详情链接来源' }),
                        this.threadSourceButton('nested', THREAD_SOURCES.nested.label, THREAD_SOURCES.nested.help),
                        this.threadSourceButton('original', THREAD_SOURCES.original.label, THREAD_SOURCES.original.help)
                    ]),
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title`, text: '抽屉分辨率' }),
                        Dom.make('div', { className: `${NAME}-size-hint`, text: '点击进度条、加减按钮或数字框调整宽度和高度。' }),
                        this.sizeControl('width', '宽度'),
                        this.sizeControl('height', '高度')
                    ])
                ]),
                this.tabPanel('rules', [
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title`, text: '关键词规则' }),
                        this.keywordBox('keywordBlockList', '屏蔽关键词', '命中的话题会在列表里隐藏。'),
                        this.keywordBox('keywordHighlightList', '高亮关键词', '命中的标题会用文字和徽标标记。')
                    ])
                ]),
                this.tabPanel('live', [
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title`, text: '实时新帖' }),
                        this.prefToggleButton('liveEnabled', '启用自动轮询', '开启后按设定间隔检查 /latest.json'),
                        this.prefToggleButton('livePauseHidden', '后台暂停轮询', '页面不可见时跳过自动刷新'),
                        this.prefToggleButton('liveCreatedOrder', '按创建排序', '请求 /latest.json?order=created'),
                        Dom.make('div', { className: `${NAME}-management-actions` }, [
                            Dom.make('button', { type: 'button', className: `${NAME}-soft-btn`, 'data-pref-action': 'open-live', text: '打开实时窗' }),
                            Dom.make('button', { type: 'button', className: `${NAME}-soft-btn`, 'data-pref-action': 'refresh-live', text: '立即刷新' })
                        ])
                    ]),
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title`, text: '轮询与数量' }),
                        this.tuningControl('livePollMinutes'),
                        this.tuningControl('liveMaxTopics')
                    ]),
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title`, text: '板块过滤' }),
                        this.keywordBox('liveCategoryFilter', '只显示这些板块', '可点选下方板块，也可手写 slug、名称或 ID；留空显示全部。'),
                        this.liveCategoryPicker()
                    ])
                ]),
                this.tabPanel('topics', [
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title` }, [
                            Dom.make('span', { text: '收藏话题' }),
                            Dom.make('span', { className: `${NAME}-section-count`, 'data-count-role': 'favorites', text: '0' })
                        ]),
                        Dom.make('div', { className: `${NAME}-favorite-list`, 'data-role': 'favorites' })
                    ]),
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title` }, [
                            Dom.make('span', { text: '最近查看' }),
                            Dom.make('span', { className: `${NAME}-section-count`, 'data-count-role': 'recent', text: '0' })
                        ]),
                        Dom.make('input', {
                            className: `${NAME}-list-search`,
                            type: 'search',
                            placeholder: '搜索标题、链接或备注',
                            autocomplete: 'off',
                            spellcheck: 'false',
                            'data-recent-search': '1',
                            value: this.recentSearch
                        }),
                        Dom.make('div', { className: `${NAME}-favorite-list`, 'data-role': 'recent' })
                    ])
                ]),
                this.tabPanel('data', [
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title`, text: '内存监控' }),
                        Dom.make('div', { className: `${NAME}-memory-grid` }, [
                            this.memoryRow('self-total', 'LDPeek 估算'),
                            this.memoryRow('page-heap', '当前页 JS堆'),
                            this.memoryRow('persistent-data', '持久数据'),
                            this.memoryRow('volatile-data', '运行缓存'),
                            this.memoryRow('interface-nodes', '界面节点'),
                            this.memoryRow('sampled-at', '采样时间')
                        ]),
                        Dom.make('div', { className: `${NAME}-memory-parts`, 'data-memory-role': 'parts' }),
                        Dom.make('div', { className: `${NAME}-management-actions` }, [
                            Dom.make('button', { type: 'button', className: `${NAME}-soft-btn`, 'data-pref-action': 'refresh-memory', text: '刷新内存' })
                        ])
                    ]),
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title`, text: '页面标记' }),
                        this.prefToggleButton('showReadBadges', '显示已读标记', '在话题标题后显示脚本已预览'),
                        this.prefToggleButton('showEffectiveBadges', '显示话题已生效', 'new-topic 小蓝点消失后显示'),
                        this.prefToggleButton('showCategoryColors', '显示分类颜色', '在话题行左侧显示分类颜色')
                    ]),
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title`, text: '保存数量' }),
                        this.tuningControl('memoryLimit'),
                        this.tuningControl('favoriteLimit'),
                        this.tuningControl('recentLimit'),
                        this.tuningControl('pageNavLimit')
                    ]),
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title`, text: '缓存与历史' }),
                        this.tuningControl('topicCacheLimit'),
                        this.tuningControl('frameHistoryLimit')
                    ]),
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title`, text: '等待时间' }),
                        this.tuningControl('previewPrefetchDelay'),
                        this.tuningControl('previewCacheTtl'),
                        this.tuningControl('badgeRefreshDelay'),
                        this.tuningControl('frameLoadWait')
                    ]),
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title`, text: '一键清理策略' }),
                        Dom.make('div', { className: `${NAME}-management-actions` }, [
                            Dom.make('button', { type: 'button', className: `${NAME}-soft-btn`, 'data-pref-action': 'cleanup-old-read', text: '清理7天前已读' }),
                            Dom.make('button', { type: 'button', className: `${NAME}-soft-btn`, 'data-pref-action': 'cleanup-cache', text: '清理无效缓存' }),
                            Dom.make('button', { type: 'button', className: `${NAME}-soft-btn`, 'data-pref-action': 'cleanup-keep-favorites', text: '保留收藏清空其他' })
                        ])
                    ]),
                    Dom.make('div', { className: `${NAME}-setting-group` }, [
                        Dom.make('div', { className: `${NAME}-setting-group-title`, text: '配置管理' }),
                        Dom.make('div', { className: `${NAME}-management-actions` }, [
                            Dom.make('button', { type: 'button', className: `${NAME}-soft-btn`, 'data-pref-action': 'clear-read', text: '清空已读' }),
                            Dom.make('button', { type: 'button', className: `${NAME}-soft-btn`, 'data-pref-action': 'export-data', text: '导出配置' }),
                            Dom.make('button', { type: 'button', className: `${NAME}-soft-btn`, 'data-pref-action': 'import-data', text: '导入配置' })
                        ])
                    ])
                ])
            ];
        },

        bindSettingsRoot(root) {
            root?.querySelector('[data-pref-tab-track]')?.addEventListener('scroll', () => {
                this.syncTabScrollControls(root);
            }, { passive: true });
        },

        dockSettingsRoot() {
            return Drawer.sidebar?.querySelector(`.${NAME}-dock-settings`) || null;
        },

        settingsRoots() {
            return [this.panel, this.dockSettingsRoot()].filter((root) => root?.isConnected);
        },

        forEachSettingsRoot(callback) {
            this.settingsRoots().forEach((root) => callback(root));
        },

        isDockSettingsOpen() {
            return Drawer.activeSidebarPanel === 'settings' && !!this.dockSettingsRoot();
        },

        tabScrollButton(direction) {
            const isLeft = Number(direction) < 0;
            const path = isLeft ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';
            return Dom.make('button', {
                type: 'button',
                className: `${NAME}-pref-tab-scroll ${isLeft ? 'is-left' : 'is-right'}`,
                title: isLeft ? '向左查看设置分组' : '向右查看设置分组',
                'aria-label': isLeft ? '向左查看设置分组' : '向右查看设置分组',
                'data-pref-tab-scroll': String(direction),
                html: `<svg class="${NAME}-pref-tab-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}"></path></svg>`
            });
        },

        tabButton(tab, label) {
            const countRole = tab === 'quick'
                ? 'queue-tab'
                : tab === 'topics'
                    ? 'topics'
                    : tab === 'nav'
                        ? 'nav-tab'
                        : '';
            return Dom.make('button', {
                type: 'button',
                className: `${NAME}-pref-tab`,
                role: 'tab',
                'aria-selected': 'false',
                'data-pref-tab': tab
            }, [
                Dom.make('span', { className: `${NAME}-pref-tab-label`, text: label }),
                countRole
                    ? Dom.make('span', {
                        className: `${NAME}-pref-tab-count`,
                        'data-count-role': countRole,
                        text: '0'
                    })
                    : null
            ]);
        },

        tabPanel(tab, children) {
            return Dom.make('div', {
                className: `${NAME}-pref-tab-panel`,
                role: 'tabpanel',
                'data-pref-panel': tab
            }, children);
        },

        settingButton(mode, label, desc) {
            return Dom.make('button', { type: 'button', className: `${NAME}-setting`, 'data-default-mode': mode }, [
                Dom.make('span', { className: `${NAME}-setting-copy` }, [
                    Dom.make('span', { className: `${NAME}-setting-label`, text: label }),
                    Dom.make('span', { className: `${NAME}-setting-desc`, text: desc })
                ]),
                Dom.make('span', { className: `${NAME}-setting-dot`, 'aria-hidden': 'true' })
            ]);
        },

        threadSourceButton(source, label, desc) {
            return Dom.make('button', { type: 'button', className: `${NAME}-setting`, 'data-thread-source': source }, [
                Dom.make('span', { className: `${NAME}-setting-copy` }, [
                    Dom.make('span', { className: `${NAME}-setting-label`, text: label }),
                    Dom.make('span', { className: `${NAME}-setting-desc`, text: desc })
                ]),
                Dom.make('span', { className: `${NAME}-setting-dot`, 'aria-hidden': 'true' })
            ]);
        },

        autoScrollSpeedButton(speed, label, desc) {
            return Dom.make('button', { type: 'button', className: `${NAME}-setting`, 'data-auto-scroll-speed': speed }, [
                Dom.make('span', { className: `${NAME}-setting-copy` }, [
                    Dom.make('span', { className: `${NAME}-setting-label`, text: label }),
                    Dom.make('span', { className: `${NAME}-setting-desc`, text: desc })
                ]),
                Dom.make('span', { className: `${NAME}-setting-dot`, 'aria-hidden': 'true' })
            ]);
        },

        prefToggleButton(field, label, desc) {
            return Dom.make('button', { type: 'button', className: `${NAME}-setting`, 'data-pref-toggle': field }, [
                Dom.make('span', { className: `${NAME}-setting-copy` }, [
                    Dom.make('span', { className: `${NAME}-setting-label`, text: label }),
                    Dom.make('span', { className: `${NAME}-setting-desc`, text: desc })
                ]),
                Dom.make('span', { className: `${NAME}-setting-dot`, 'aria-hidden': 'true' })
            ]);
        },

        sizeControl(field, label) {
            return SizeControls.build(field, label);
        },

        tuningControl(field) {
            return TuningControls.build(field);
        },

        memoryRow(role, label) {
            return Dom.make('div', { className: `${NAME}-memory-row` }, [
                Dom.make('span', { className: `${NAME}-memory-label`, text: label }),
                Dom.make('span', { className: `${NAME}-memory-value`, 'data-memory-role': role, text: '等待采样' })
            ]);
        },

        keywordBox(field, label, desc) {
            return Dom.make('label', { className: `${NAME}-keyword-field` }, [
                Dom.make('span', { className: `${NAME}-keyword-label`, text: label }),
                Dom.make('span', { className: `${NAME}-keyword-desc`, text: desc }),
                Dom.make('textarea', {
                    className: `${NAME}-keyword-input`,
                    rows: '3',
                    spellcheck: 'false',
                    placeholder: '每行一个，或用逗号分隔',
                    'data-keyword-input': field,
                    text: Prefs.value[field]
                })
            ]);
        },

        liveCategoryPicker() {
            return Dom.make('div', { className: `${NAME}-category-picker`, 'data-live-category-picker': '1' }, this.liveCategoryPickerContent());
        },

        liveCategoryPickerContent() {
            const categories = LiveTopics.siteCategoryChoices();
            if (!categories.length) {
                return Dom.make('div', { className: `${NAME}-category-picker-empty`, text: '打开或刷新实时新帖后显示可选板块。' });
            }
            const tokens = new Set(LiveTopics.filterTokens());
            return categories.map((category) => {
                const token = category.slug || category.name || String(category.id);
                const values = [String(category.id), category.slug, category.name].map((value) => String(value || '').toLowerCase()).filter(Boolean);
                const active = values.some((value) => tokens.has(value));
                return Dom.make('button', {
                    type: 'button',
                    className: `${NAME}-category-chip${active ? ' is-active' : ''}`,
                    title: `${active ? '移除' : '添加'}板块过滤：${category.name}${category.slug ? ` / ${category.slug}` : ''}`,
                    'aria-pressed': active ? 'true' : 'false',
                    'data-live-category-token': token
                }, [
                    Dom.make('span', { className: `${NAME}-category-chip-name`, text: category.name || `分类 ${category.id}` }),
                    category.slug ? Dom.make('span', { className: `${NAME}-category-chip-slug`, text: category.slug }) : null
                ]);
            });
        },

        onClick(event) {
            if (this.ignoreClick) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }

            if (event.target.closest('[data-pie-toggle]')) {
                event.preventDefault();
                this.togglePie();
                return;
            }

            const pieAction = event.target.closest('[data-pie-action]')?.dataset.pieAction;
            if (pieAction === 'drawer') {
                event.preventDefault();
                this.hidePie();
                const opened = this.openDrawerTarget();
                if (!opened) this.collapseEdgeStateIfIdle();
                if (!opened) showToast('暂无可打开的抽屉内容');
                return;
            }
            if (pieAction === 'settings') {
                event.preventDefault();
                this.openSettingsPanel('display');
                return;
            }
            if (pieAction === 'live') {
                event.preventDefault();
                this.hidePie();
                LiveTopics.toggle();
                this.collapseEdgeStateIfIdle();
                return;
            }
            if (pieAction === 'recent') {
                event.preventDefault();
                this.hidePie();
                RecentTopics.toggle();
                this.collapseEdgeStateIfIdle();
                return;
            }
            if (pieAction === 'queue') {
                event.preventDefault();
                this.openSettingsPanel('quick');
                return;
            }
            if (pieAction === 'nav') {
                event.preventDefault();
                this.openSettingsPanel('nav');
                return;
            }
            if (pieAction === 'topics') {
                event.preventDefault();
                this.openSettingsPanel('topics');
                return;
            }
            if (pieAction === 'rules') {
                event.preventDefault();
                this.openSettingsPanel('rules');
                return;
            }
            if (pieAction === 'mode') {
                event.preventDefault();
                this.hidePie();
                const nextMode = Prefs.value.mode === 'summary' ? 'thread' : 'summary';
                Prefs.save({ mode: nextMode });
                Drawer.syncControls();
                this.sync();
                this.collapseEdgeStateIfIdle();
                showToast(`默认打开方式：${MODES[nextMode]?.label || nextMode}`);
                return;
            }
            if (pieAction === 'data') {
                event.preventDefault();
                this.openSettingsPanel('data');
                return;
            }

            if (event.target.closest('[data-pref-action="toggle-support"]')) {
                this.toggleSupport();
                return;
            }

            const tabScrollButton = event.target.closest('[data-pref-tab-scroll]');
            const tabScroll = tabScrollButton?.dataset.prefTabScroll;
            if (tabScroll) {
                this.scrollTabs(Number(tabScroll), tabScrollButton.closest(`.${NAME}-settings`));
                return;
            }

            const nextTab = event.target.closest('[data-pref-tab]')?.dataset.prefTab;
            if (nextTab) {
                this.activeTab = nextTab;
                this.syncTabs();
                if (nextTab === 'quick') this.renderQueue();
                if (nextTab === 'live') this.ensureLiveCategoryChoices();
                return;
            }

            const liveCategoryToken = event.target.closest('[data-live-category-token]')?.dataset.liveCategoryToken;
            if (liveCategoryToken) {
                event.preventDefault();
                this.toggleLiveCategoryToken(liveCategoryToken);
                return;
            }

            const prefToggle = event.target.closest('[data-pref-toggle]')?.dataset.prefToggle;
            if (prefToggle === 'showReadBadges' || prefToggle === 'showEffectiveBadges' || prefToggle === 'showCategoryColors' || prefToggle === 'forceCreatedOrder' || prefToggle === 'clickTopicToDrawer' || prefToggle === 'trackDrawerViews' || TRACK_DRAWER_VIEW_PREFS.includes(prefToggle) || prefToggle === 'liveEnabled' || prefToggle === 'livePauseHidden' || prefToggle === 'liveCreatedOrder') {
                Prefs.save({ [prefToggle]: !Prefs.value[prefToggle] });
                if (prefToggle === 'forceCreatedOrder' && Prefs.value.forceCreatedOrder) {
                    if (CreatedOrder.apply()) return;
                }
                if (prefToggle === 'showReadBadges' || prefToggle === 'showEffectiveBadges' || prefToggle === 'showCategoryColors') {
                    TopicBadges.refresh();
                }
                if (prefToggle === 'trackDrawerViews' || TRACK_DRAWER_VIEW_PREFS.includes(prefToggle)) {
                    Drawer.scheduleTrackView();
                }
                if (prefToggle === 'liveEnabled' || prefToggle === 'livePauseHidden') LiveTopics.configure();
                if (prefToggle === 'liveCreatedOrder') LiveTopics.fetchNow({ manual: true });
                Drawer.syncControls();
                this.sync();
                return;
            }

            const prefAction = event.target.closest('[data-pref-action]')?.dataset.prefAction;
            if (prefAction === 'open-drawer') {
                const opened = this.openDrawerTarget();
                if (!opened) showToast('暂无可打开的抽屉内容');
                return;
            }
            if (prefAction === 'clear-read') {
                if (window.confirm('确定清空已读记忆吗？')) {
                    ReadMemory.clear();
                    Drawer.syncControls();
                    this.sync();
                    showToast('已清空已读记忆');
                }
                return;
            }
            if (prefAction === 'clear-queue') {
                if (ReadLaterQueue.items.length && window.confirm('确定清空稍后阅读队列吗？')) {
                    if (!ReadLaterQueue.clear()) return;
                    this.syncQueueState();
                    Drawer.syncReadLaterState();
                    MiniEye.syncLaterButton(MiniEye.button?.dataset.topicId || '');
                    showToast('已清空稍后阅读队列');
                }
                return;
            }
            if (prefAction === 'clear-page-nav') {
                if (PageNav.items.length && window.confirm('确定清空页面导航吗？')) {
                    PageNav.clear();
                    this.sync();
                    Drawer.renderSidebar();
                    showToast('已清空页面导航');
                }
                return;
            }
            if (prefAction === 'add-page-nav') {
                const result = PageNav.addCurrent();
                this.sync();
                Drawer.renderSidebar();
                showToast(!result?.item ? '当前页面无法添加' : result.existing ? '当前页面已在导航中' : '已添加当前页面');
                return;
            }
            if (prefAction === 'restore-page-nav') {
                PageNav.restoreDefaults();
                this.sync();
                Drawer.renderSidebar();
                showToast('已恢复默认导航');
                return;
            }
            if (prefAction === 'cleanup-old-read') {
                const removed = ReadMemory.clearOlderThan(7);
                this.syncAfterCleanup();
                showToast(removed ? `已清理 ${removed} 条7天前已读` : '没有7天前已读');
                return;
            }
            if (prefAction === 'cleanup-cache') {
                const cleared = StarterPostStore.clearVolatileCache();
                this.syncMemoryStats();
                showToast(cleared ? `已清理 ${cleared} 条缓存` : '暂无可清理缓存');
                return;
            }
            if (prefAction === 'cleanup-keep-favorites') {
                if (!window.confirm('保留收藏和设置，清空已读、页面导航、稍后阅读、抽屉恢复状态和缓存吗？')) return;
                const readCount = ReadMemory.items.length;
                const queueCount = ReadLaterQueue.items.length;
                const navCount = PageNav.items.length;
                const cacheCount = StarterPostStore.clearVolatileCache();
                ReadMemory.clear();
                ReadLaterQueue.clear();
                PageNav.clear();
                DrawerState.clear();
                LastViewedMarker.clear({ keepState: false });
                this.syncAfterCleanup();
                showToast(`已清理 ${readCount + queueCount + navCount + cacheCount} 条记录`);
                return;
            }
            if (prefAction === 'export-data') {
                exportLocalData();
                return;
            }
            if (prefAction === 'import-data') {
                importLocalData();
                this.sync();
                Drawer.syncControls();
                return;
            }
            if (prefAction === 'refresh-memory') {
                this.syncMemoryStats();
                showToast('内存数据已刷新');
                return;
            }
            if (prefAction === 'open-live') {
                LiveTopics.open();
                return;
            }
            if (prefAction === 'refresh-live') {
                LiveTopics.fetchNow({ manual: true });
                return;
            }

            const defaultMode = event.target.closest('[data-default-mode]')?.dataset.defaultMode;
            if (defaultMode) {
                Prefs.save({ mode: defaultMode });
                Drawer.syncControls();
                this.sync();
                return;
            }

            const threadSource = event.target.closest('[data-thread-source]')?.dataset.threadSource;
            if (threadSource) {
                Prefs.save({ threadSource });
                Drawer.syncControls();
                this.sync();
                if (Drawer.topicId && Drawer.mode === 'thread') {
                    Drawer.open(Drawer.topicId, Drawer.mode, LastViewedMarker.anchor, Drawer.sourceHref, { trackSource: Drawer.trackViewSource });
                }
                return;
            }

            const autoScrollSpeed = event.target.closest('[data-auto-scroll-speed]')?.dataset.autoScrollSpeed;
            if (autoScrollSpeed) {
                Prefs.save({ autoScrollSpeed });
                Drawer.applyAutoScrollSpeedPreference();
                Drawer.syncControls();
                this.sync();
                showToast(`自动滚动速度：${AUTO_SCROLL_SPEED_LEVELS[Prefs.value.autoScrollSpeed].label}`);
                return;
            }

            const sizeStep = event.target.closest('[data-size-step]');
            if (sizeStep) {
                const next = SizeControls.fromStep(sizeStep);
                if (next) this.persistSizeValue(next.field, next.value);
                return;
            }

            const tuningStep = event.target.closest('[data-tuning-step]');
            if (tuningStep) {
                const next = TuningControls.fromStep(tuningStep);
                if (next) this.persistTuningValue(next.field, next.value);
                return;
            }

            const sizeTrack = event.target.closest('[data-size-track]');
            if (sizeTrack) {
                const next = SizeControls.fromTrack(sizeTrack, event.clientX);
                if (next) this.persistSizeValue(next.field, next.value);
                return;
            }

            const removeQueue = event.target.closest('[data-queue-remove]')?.dataset.queueRemove;
            if (removeQueue) {
                if (!ReadLaterQueue.remove(removeQueue)) return;
                this.syncQueueState();
                Drawer.syncReadLaterState();
                MiniEye.syncLaterButton(MiniEye.button?.dataset.topicId || '');
                showToast('已移出稍后阅读');
                return;
            }

            const openQueue = event.target.closest('[data-queue-open]')?.dataset.queueOpen;
            if (openQueue) {
                const item = ReadLaterQueue.get(openQueue);
                if (!item) return;
                this.hide();
                this.sync();
                Drawer.renderSidebar();
                MiniEye.syncLaterButton(MiniEye.button?.dataset.topicId || '');
                Drawer.open(item.id, Prefs.value.mode, null, item.href, {
                    title: item.title,
                    sidebarPanel: 'readLater',
                    trackSource: 'readLater'
                });
                return;
            }

            const openPageNav = event.target.closest('[data-page-nav-open]')?.dataset.pageNavOpen;
            if (openPageNav) {
                const item = PageNav.get(openPageNav);
                if (!item) return;
                if (!PageNav.isCurrent(item)) this.hide();
                PageNav.open(openPageNav);
                return;
            }

            const blankPageNav = event.target.closest('[data-page-nav-blank]')?.dataset.pageNavBlank;
            if (blankPageNav) {
                PageNav.open(blankPageNav, { newTab: true });
                return;
            }

            const editPageNav = event.target.closest('[data-page-nav-edit]')?.dataset.pageNavEdit;
            if (editPageNav) {
                const result = PageNav.editWithPrompt(editPageNav);
                if (result.cancelled) return;
                showToast(PageNav.editResultMessage(result));
                return;
            }

            const removePageNav = event.target.closest('[data-page-nav-remove]')?.dataset.pageNavRemove;
            if (removePageNav) {
                const next = PageNav.isCurrent(removePageNav) ? PageNav.neighbor(removePageNav) : null;
                if (!PageNav.remove(removePageNav)) return;
                this.sync();
                Drawer.renderSidebar();
                showToast('已关闭导航标签');
                if (next) window.location.assign(next.href);
                return;
            }

            const removeFavorite = event.target.closest('[data-favorite-remove]')?.dataset.favoriteRemove;
            if (removeFavorite) {
                Favorites.remove(removeFavorite);
                Drawer.syncControls();
                this.sync();
                showToast('已移除收藏');
                return;
            }

            const openFavorite = event.target.closest('[data-favorite-open]')?.dataset.favoriteOpen;
            if (openFavorite) {
                const item = Favorites.get(openFavorite);
                if (!item) return;
                this.hide();
                Drawer.open(item.id, Prefs.value.mode, null, item.href, {
                    title: item.title,
                    sidebarPanel: 'favorites',
                    trackSource: 'favorites'
                });
                return;
            }

            const openRecent = event.target.closest('[data-recent-open]')?.dataset.recentOpen;
            if (openRecent) {
                const item = ReadMemory.get(openRecent);
                if (!item) return;
                this.hide();
                Drawer.open(item.id, Prefs.value.mode, null, item.href, {
                    title: item.title,
                    sidebarPanel: 'recent',
                    preserveRecentOrder: true,
                    trackSource: 'recent'
                });
                return;
            }

        },

        onButtonPointerEnter(event) {
            if (event.pointerType === 'touch' || this.drag || !this.isEdgeHidden()) return;
            this.togglePie(true);
        },

        onButtonPointerDown(event) {
            if (event.button !== 0 || !this.root || !this.button) return;
            const rect = this.root.getBoundingClientRect();
            this.drag = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                currentX: event.clientX,
                currentY: event.clientY,
                left: rect.left,
                top: rect.top,
                moved: false,
                active: false,
                pendingMove: false,
                edgeHidden: this.isEdgeHidden(),
                timer: window.setTimeout(() => {
                    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
                    this.activateDrag();
                    const deltaX = this.drag.currentX - this.drag.startX;
                    const deltaY = this.drag.currentY - this.drag.startY;
                    if (Math.hypot(deltaX, deltaY) >= 3) {
                        this.drag.moved = true;
                        this.applyPosition(this.drag.left + deltaX, this.drag.top + deltaY);
                    }
                }, FLOATING_LONG_PRESS)
            };
            this.button.setPointerCapture?.(event.pointerId);
        },

        onButtonPointerMove(event) {
            if (!this.drag || this.drag.pointerId !== event.pointerId) return;
            this.drag.currentX = event.clientX;
            this.drag.currentY = event.clientY;
            let deltaX = event.clientX - this.drag.startX;
            let deltaY = event.clientY - this.drag.startY;
            let distance = Math.hypot(deltaX, deltaY);
            if (!this.drag.active) {
                if (distance > 8) {
                    if (this.drag.timer) {
                        window.clearTimeout(this.drag.timer);
                        this.drag.timer = 0;
                    }
                    this.drag.pendingMove = true;
                    this.activateDrag();
                    deltaX = event.clientX - this.drag.startX;
                    deltaY = event.clientY - this.drag.startY;
                    distance = Math.hypot(deltaX, deltaY);
                } else {
                    return;
                }
            }
            if (!this.drag.moved && distance < 3) return;

            this.drag.moved = true;
            this.applyPosition(this.drag.left + deltaX, this.drag.top + deltaY);
            event.preventDefault();
        },

        onButtonPointerUp(event) {
            if (!this.drag || this.drag.pointerId !== event.pointerId) return;
            if (this.drag.timer) {
                window.clearTimeout(this.drag.timer);
                this.drag.timer = 0;
            }
            const wasActive = this.drag.active;
            const pendingMove = this.drag.pendingMove;
            const drag = this.drag;
            this.button.releasePointerCapture?.(event.pointerId);
            this.root?.classList.remove('is-dragging');
            this.drag = null;

            if (!wasActive) {
                if (pendingMove) {
                    this.ignoreClick = true;
                    window.setTimeout(() => {
                        this.ignoreClick = false;
                    }, 0);
                }
                return;
            }
            const position = this.clampPosition(
                drag.left + drag.currentX - drag.startX,
                drag.top + drag.currentY - drag.startY
            );
            const edgeState = this.edgeStateFromPosition(position);
            if (edgeState) {
                Prefs.save({ prefEdgeState: edgeState });
                this.applyEdgeState(edgeState);
            } else {
                Prefs.save({
                    prefLeft: position.left,
                    prefTop: position.top,
                    prefEdgeState: null
                });
                this.applyPosition(position.left, position.top);
            }
            this.ignoreClick = true;
            window.setTimeout(() => {
                this.ignoreClick = false;
            }, 0);
        },

        activateDrag() {
            if (!this.drag || !this.root) return;
            if (this.drag.edgeHidden) {
                this.revealEdgeState();
                const rect = this.root.getBoundingClientRect();
                this.drag.left = rect.left;
                this.drag.top = rect.top;
                this.drag.startX = this.drag.currentX;
                this.drag.startY = this.drag.currentY;
                this.drag.edgeHidden = false;
            }
            this.drag.active = true;
            this.root.classList.add('is-dragging');
            this.hide();
            LiveTopics.hide();
        },

        onInput(event) {
            const sizeInput = event.target.closest('[data-size-input]');
            if (sizeInput) {
                const next = event.type === 'input'
                    ? SizeControls.fromTyping(sizeInput)
                    : SizeControls.fromInput(sizeInput);
                if (next) this.persistSizeValue(next.field, next.value);
                return;
            }

            const tuningInput = event.target.closest('[data-tuning-input]');
            if (tuningInput) {
                const next = event.type === 'input'
                    ? TuningControls.fromTyping(tuningInput)
                    : TuningControls.fromInput(tuningInput);
                if (next) this.persistTuningValue(next.field, next.value);
                return;
            }

            const keywordInput = event.target.closest('[data-keyword-input]');
            if (keywordInput) {
                this.persistKeywordValue(keywordInput.dataset.keywordInput, keywordInput.value, {
                    immediate: event.type === 'change'
                });
                return;
            }

            const recentSearch = event.target.closest('[data-recent-search]');
            if (!recentSearch) return;
            this.recentSearch = recentSearch.value;
            this.renderRecent();
            this.syncTopicTabCount();
        },

        syncTopicTabCount() {
            this.forEachSettingsRoot((root) => {
                const recentCount = root.querySelector('[data-count-role="recent"]');
                if (recentCount) recentCount.textContent = String(this.recentItems().length);
                const topicCount = root.querySelector('[data-count-role="topics"]');
                if (topicCount) topicCount.textContent = String(Favorites.items.length + this.recentItems().length);
            });
        },

        drawerTarget() {
            if (Drawer.topicId) {
                return {
                    label: '回到当前抽屉',
                    topicId: Drawer.topicId,
                    title: Drawer.topicTitle || `话题 ${Drawer.topicId}`,
                    href: Drawer.sourceHref,
                    mode: Drawer.mode || Prefs.value.mode,
                    trackSource: 'resume'
                };
            }

            const currentTopicId = Urls.topicIdFromHref(location.href);
            if (currentTopicId) {
                return {
                    label: '打开当前话题',
                    topicId: currentTopicId,
                    title: Favorites.titleFromDocument(document, currentTopicId),
                    href: location.href,
                    mode: Prefs.value.mode,
                    trackSource: 'resume'
                };
            }

            if (DrawerState.value?.topicId) {
                const mode = Prefs.value.mode;
                return {
                    label: '继续上次抽屉',
                    topicId: DrawerState.value.topicId,
                    title: DrawerState.value.title,
                    href: DrawerState.value.sourceHref,
                    mode,
                    resumeState: mode === 'thread' ? DrawerState.value : null,
                    trackSource: 'resume'
                };
            }

            const queued = ReadLaterQueue.items[0];
            if (queued) {
                return {
                    label: '打开稍后阅读',
                    topicId: queued.id,
                    title: queued.title,
                    href: queued.href,
                    mode: Prefs.value.mode,
                    sidebarPanel: 'readLater',
                    trackSource: 'readLater'
                };
            }

            const recent = ReadMemory.items[0];
            if (recent) {
                return {
                    label: '打开最近查看',
                    topicId: recent.id,
                    title: recent.title,
                    href: recent.href,
                    mode: Prefs.value.mode,
                    trackSource: 'recent'
                };
            }

            const favorite = Favorites.items[0];
            if (favorite) {
                return {
                    label: '打开收藏话题',
                    topicId: favorite.id,
                    title: favorite.title,
                    href: favorite.href,
                    mode: Prefs.value.mode,
                    trackSource: 'favorites'
                };
            }

            return null;
        },

        openDrawerTarget() {
            const target = this.drawerTarget();
            if (!target?.topicId) return false;
            this.hide();
            if (Drawer.topicId === String(target.topicId) && Drawer.root?.classList.contains('is-open')) {
                return true;
            }
            Drawer.open(target.topicId, target.mode || Prefs.value.mode, null, target.href, {
                title: target.title,
                resumeState: target.resumeState,
                sidebarPanel: target.sidebarPanel,
                trackSource: target.trackSource
            });
            return true;
        },

        persistSizeValue(field, value) {
            Prefs.save({ [field]: SizeControls.clamp(field, value) });
            Drawer.applySize();
            Drawer.syncControls();
            this.sync();
        },

        persistTuningValue(field, value) {
            const nextValue = TuningControls.clamp(field, value);
            if (nextValue === null) return;
            Prefs.save({ [field]: nextValue });
            this.applyTuningSideEffects(field);
            Drawer.syncControls();
            this.sync();
        },

        applyTuningSideEffects(field) {
            if (field === 'memoryLimit') {
                SimilarTopics.invalidate();
                if (!ReadMemory.trimToLimit()) TopicBadges.refresh();
            }
            if (field === 'favoriteLimit') Favorites.trimToLimit();
            if (field === 'pageNavLimit') PageNav.trimToLimit();
            if (field === 'topicCacheLimit') {
                StarterPostStore.trimCache();
                StarterPostStore.trimPreloadMarks();
            }
            if (field === 'frameHistoryLimit' && DrawerState.value?.frameHistory?.length) {
                DrawerState.save({ frameHistory: DrawerState.value.frameHistory, frameHistoryIndex: DrawerState.value.frameHistoryIndex });
            }
            if (field === 'badgeRefreshDelay') TopicBadges.schedule();
            if (field === 'livePollMinutes' || field === 'liveMaxTopics') {
                LiveTopics.configure();
                LiveTopics.refreshFilter();
            }
        },

        syncAfterCleanup() {
            TopicBadges.refresh();
            Drawer.syncControls();
            Drawer.renderSidebar();
            MiniEye.syncLaterButton(MiniEye.button?.dataset.topicId || '');
            this.sync();
        },

        persistKeywordValue(field, value, options = {}) {
            if (field !== 'keywordBlockList' && field !== 'keywordHighlightList' && field !== 'liveCategoryFilter') return;
            Prefs.save({ [field]: Prefs.cleanTextSetting(value) });
            if (field === 'liveCategoryFilter') {
                LiveTopics.refreshFilter();
                this.renderLiveCategoryPicker();
                return;
            }
            this.scheduleKeywordRefresh(options.immediate === true);
            this.syncKeywordInputs();
        },

        toggleLiveCategoryToken(token) {
            const value = String(token || '').trim();
            if (!value) return;
            const current = String(Prefs.value.liveCategoryFilter || '')
                .split(/[\n,，;；]+/)
                .map((item) => item.trim())
                .filter(Boolean);
            const index = current.findIndex((item) => item.toLowerCase() === value.toLowerCase());
            if (index >= 0) current.splice(index, 1);
            else current.push(value);
            Prefs.save({ liveCategoryFilter: current.join('\n') });
            LiveTopics.refreshFilter();
            this.syncKeywordInputs();
            this.renderLiveCategoryPicker();
        },

        renderLiveCategoryPicker() {
            this.forEachSettingsRoot((root) => {
                const picker = root.querySelector('[data-live-category-picker]');
                if (!picker) return;
                const content = this.liveCategoryPickerContent();
                picker.replaceChildren(...(Array.isArray(content) ? content : [content]));
            });
        },

        ensureLiveCategoryChoices() {
            const choices = LiveTopics.siteCategoryChoices();
            const cache = LiveTopics.readSiteCategoriesCache();
            if (choices.length) {
                this.renderLiveCategoryPicker();
                if (cache.fresh || Array.isArray(LiveTopics.siteCategories)) return;
            }
            LiveTopics.fetchSiteCategories().then(() => {
                if (this.activeTab === 'live') this.renderLiveCategoryPicker();
            });
        },

        scheduleKeywordRefresh(immediate = false) {
            if (this.keywordRefreshTimer) {
                window.clearTimeout(this.keywordRefreshTimer);
                this.keywordRefreshTimer = 0;
            }
            if (immediate) {
                KeywordRules.refresh();
                return;
            }
            this.keywordRefreshTimer = window.setTimeout(() => {
                this.keywordRefreshTimer = 0;
                KeywordRules.refresh();
            }, 220);
        },

        toggle() {
            const open = !this.isOpen();
            if (open) {
                this.openSettingsPanel();
                return;
            }
            this.hidePie();
            this.panel.classList.remove('is-open');
            this.applyTheme();
            this.applyPanelPlacement();
            this.syncPieState();
            this.sync();
            this.syncMemoryMonitor();
        },

        openSettingsPanel(tab = '') {
            if (tab) this.activeTab = tab;
            this.revealEdgeState();
            LiveTopics.hide();
            RecentTopics.hide();
            this.hidePie();
            this.panel.classList.add('is-open');
            this.applyTheme();
            this.applyPanelPlacement();
            this.syncPieState();
            this.sync();
            this.syncMemoryMonitor();
            if (this.activeTab === 'live') this.ensureLiveCategoryChoices();
        },

        hide() {
            if (!this.panel) return;
            this.panel.classList.remove('is-open');
            this.hidePie();
            this.toggleSupport(false);
            this.syncPieState();
            this.stopMemoryMonitor();
            this.collapseEdgeStateIfIdle();
        },

        isOpen() {
            return this.panel?.classList.contains('is-open') === true;
        },

        togglePie(force) {
            if (!this.root) return;
            const open = typeof force === 'boolean' ? force : !this.isPieOpen();
            if (open) {
                this.revealEdgeState();
                this.panel?.classList.remove('is-open');
                LiveTopics.hide();
                RecentTopics.hide();
                this.toggleSupport(false);
                this.stopMemoryMonitor();
                this.resetPieViewportOffset();
                this.root.classList.add('is-pie-open');
                this.syncPieViewportOffset();
                this.syncPieLayout();
            } else {
                this.root.classList.remove('is-pie-open');
                this.resetPieViewportOffset();
                this.collapseEdgeStateIfIdle();
            }
            this.syncPieState();
        },

        hidePie() {
            if (!this.root) return;
            this.root.classList.remove('is-pie-open');
            this.resetPieViewportOffset();
            if (document.activeElement instanceof HTMLElement && this.menu?.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            this.syncPieState();
        },

        isPieOpen() {
            return this.root?.classList.contains('is-pie-open') === true;
        },

        syncPieState() {
            if (!this.root) return;
            const pieOpen = this.isPieOpen();
            this.button?.setAttribute('aria-expanded', pieOpen ? 'true' : 'false');
            this.menu?.querySelectorAll('[data-pie-action]').forEach((button) => {
                const action = button.dataset.pieAction;
                const active = action === 'settings' ? this.isOpen() && (this.activeTab === 'display' || this.activeTab === 'live') :
                    action === 'live' ? LiveTopics.isOpen() :
                        action === 'recent' ? RecentTopics.isOpen() :
                            action === 'queue' ? this.isOpen() && this.activeTab === 'quick' :
                                action === 'nav' ? this.isOpen() && this.activeTab === 'nav' :
                                    action === 'topics' ? this.isOpen() && this.activeTab === 'topics' :
                                        action === 'rules' ? this.isOpen() && this.activeTab === 'rules' :
                                            action === 'data' ? this.isOpen() && this.activeTab === 'data' :
                                                action === 'mode' ? Prefs.value.mode === 'thread' : false;
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-expanded', active ? 'true' : 'false');
            });
            this.restorePieHighlight();
        },

        sync() {
            if (!this.root) return;
            this.forEachSettingsRoot((root) => {
                root.querySelectorAll('[data-default-mode]').forEach((button) => {
                    const active = button.dataset.defaultMode === Prefs.value.mode;
                    button.classList.toggle('is-active', active);
                    button.setAttribute('aria-pressed', active ? 'true' : 'false');
                });
                root.querySelectorAll('[data-thread-source]').forEach((button) => {
                    const active = button.dataset.threadSource === Prefs.value.threadSource;
                    button.classList.toggle('is-active', active);
                    button.setAttribute('aria-pressed', active ? 'true' : 'false');
                });
                root.querySelectorAll('[data-auto-scroll-speed]').forEach((button) => {
                    const active = button.dataset.autoScrollSpeed === Prefs.value.autoScrollSpeed;
                    button.classList.toggle('is-active', active);
                    button.setAttribute('aria-pressed', active ? 'true' : 'false');
                });
                root.querySelectorAll('[data-pref-toggle]').forEach((button) => {
                    const active = Prefs.value[button.dataset.prefToggle] !== false;
                    button.classList.toggle('is-active', active);
                    button.setAttribute('aria-pressed', active ? 'true' : 'false');
                });
                SizeControls.sync(root);
                TuningControls.sync(root);
                const current = root.querySelector('[data-role="prefs-current"]');
                if (current) {
                    const mode = MODES[Prefs.value.mode]?.label || '预览';
                    const source = THREAD_SOURCES[Prefs.value.threadSource]?.label || '楼层视图';
                    const autoScroll = AUTO_SCROLL_SPEED_LEVELS[Prefs.value.autoScrollSpeed]?.label || AUTO_SCROLL_SPEED_LEVELS[AUTO_SCROLL_DEFAULT_SPEED_LEVEL].label;
                    current.textContent = `默认 ${mode} · ${source} · 滚动 ${autoScroll} · ${Prefs.value.width}px × ${Prefs.value.height}vh`;
                }
                const favoriteCount = root.querySelector('[data-count-role="favorites"]');
                if (favoriteCount) favoriteCount.textContent = String(Favorites.items.length);
                const queueCount = root.querySelector('[data-count-role="queue"]');
                if (queueCount) queueCount.textContent = String(ReadLaterQueue.items.length);
                const queueTabCount = root.querySelector('[data-count-role="queue-tab"]');
                if (queueTabCount) queueTabCount.textContent = String(ReadLaterQueue.items.length);
                const pageNavCount = root.querySelector('[data-count-role="page-nav"]');
                if (pageNavCount) pageNavCount.textContent = String(PageNav.items.length);
                const navTabCount = root.querySelector('[data-count-role="nav-tab"]');
                if (navTabCount) navTabCount.textContent = String(PageNav.items.length);
                const recentCount = root.querySelector('[data-count-role="recent"]');
                if (recentCount) recentCount.textContent = String(this.recentItems().length);
                const topicCount = root.querySelector('[data-count-role="topics"]');
                if (topicCount) {
                    topicCount.textContent = String(Favorites.items.length + this.recentItems().length);
                }
            });
            this.syncKeywordInputs();
            this.syncDrawerEntry();
            this.syncSupportPanel();
            this.syncPieState();
            LiveTopics.syncButton();
            RecentTopics.sync();
            this.syncTabs();
            this.renderQueue();
            this.renderPageNav();
            this.renderFavorites();
            this.renderRecent();
            if ((this.isOpen() || this.isDockSettingsOpen()) && this.activeTab === 'data') this.syncMemoryStats();
        },

        syncQueueState() {
            if (!this.root) return;
            const count = String(ReadLaterQueue.items.length);
            this.forEachSettingsRoot((root) => {
                const queueCount = root.querySelector('[data-count-role="queue"]');
                if (queueCount) queueCount.textContent = count;
                const queueTabCount = root.querySelector('[data-count-role="queue-tab"]');
                if (queueTabCount) queueTabCount.textContent = count;
            });
            this.syncDrawerEntry();
            if ((this.isOpen() || this.isDockSettingsOpen()) && this.activeTab === 'quick') this.renderQueue();
        },

        syncMemoryStats() {
            if (!this.root) return;
            const snapshot = MemoryStats.snapshot();
            this.setMemoryText('self-total', formatBytes(snapshot.selfBytes));
            this.setMemoryText('page-heap', MemoryStats.heapText(snapshot.heap));
            this.setMemoryText('persistent-data', formatBytes(snapshot.persistentBytes));
            this.setMemoryText('volatile-data', formatBytes(snapshot.volatileBytes));
            this.setMemoryText('interface-nodes', `${formatBytes(snapshot.interfacePart.bytes)} · ${snapshot.interfacePart.count}节点`);
            this.setMemoryText('sampled-at', new Date(snapshot.sampledAt).toLocaleTimeString('zh-CN', { hour12: false }));
            this.forEachSettingsRoot((root) => {
                const parts = root.querySelector('[data-memory-role="parts"]');
                if (!parts) return;
                parts.replaceChildren(...snapshot.parts
                    .filter((part) => part.bytes || part.count)
                    .map((part) => Dom.make('div', { className: `${NAME}-memory-part` }, [
                        Dom.make('span', { className: `${NAME}-memory-part-label`, text: part.label }),
                        Dom.make('span', { className: `${NAME}-memory-part-value`, text: MemoryStats.partText(part) })
                    ])));
            });
        },

        setMemoryText(role, text) {
            this.forEachSettingsRoot((root) => {
                const node = root.querySelector(`[data-memory-role="${role}"]`);
                if (!node) return;
                node.textContent = text;
                node.title = text;
            });
        },

        toggleSupport(force) {
            this.supportOpen = typeof force === 'boolean' ? force : !this.supportOpen;
            this.syncSupportPanel();
        },

        syncSupportPanel() {
            if (!this.root) return;
            this.forEachSettingsRoot((root) => {
                const button = root.querySelector('[data-pref-action="toggle-support"]');
                const panel = root.querySelector('[data-pref-support-panel]');
                if (button) button.setAttribute('aria-expanded', this.supportOpen ? 'true' : 'false');
                if (panel) panel.toggleAttribute('hidden', !this.supportOpen);
            });
        },

        syncMemoryMonitor() {
            if ((this.isOpen() || this.isDockSettingsOpen()) && this.activeTab === 'data') {
                this.startMemoryMonitor();
            } else {
                this.stopMemoryMonitor();
            }
        },

        startMemoryMonitor() {
            this.syncMemoryStats();
            if (this.memoryTimer) return;
            this.memoryTimer = window.setInterval(() => this.syncMemoryStats(), 2000);
        },

        stopMemoryMonitor() {
            if (!this.memoryTimer) return;
            window.clearInterval(this.memoryTimer);
            this.memoryTimer = 0;
        },

        syncKeywordInputs() {
            if (!this.root) return;
            this.forEachSettingsRoot((root) => {
                root.querySelectorAll('[data-keyword-input]').forEach((input) => {
                    const field = input.dataset.keywordInput;
                    if (document.activeElement === input) return;
                    if (field === 'keywordBlockList' || field === 'keywordHighlightList' || field === 'liveCategoryFilter') {
                        input.value = Prefs.value[field];
                    }
                });
            });
        },

        syncDrawerEntry() {
            const target = this.drawerTarget();
            this.forEachSettingsRoot((root) => {
                const button = root.querySelector('[data-pref-action="open-drawer"]');
                if (!button) return;
                const label = button.querySelector('[data-role="drawer-open-label"]');
                const meta = button.querySelector('[data-role="drawer-open-meta"]');
                button.disabled = !target;
                button.toggleAttribute('disabled', !target);
                button.setAttribute('aria-disabled', target ? 'false' : 'true');
                button.setAttribute('title', target ? `${target.label}：${target.title}` : '暂无可打开的抽屉内容');
                if (label) label.textContent = target?.label || '打开抽屉';
                if (meta) meta.textContent = target?.title || '暂无可继续阅读内容';
            });
        },

        syncTabs() {
            if (!this.root) return;
            const validTabs = new Set(['quick', 'nav', 'display', 'rules', 'live', 'topics', 'data']);
            if (!validTabs.has(this.activeTab)) this.activeTab = 'quick';

            this.forEachSettingsRoot((root) => {
                let activeButton = null;
                root.querySelectorAll('[data-pref-tab]').forEach((button) => {
                    const active = button.dataset.prefTab === this.activeTab;
                    button.classList.toggle('is-active', active);
                    button.setAttribute('aria-selected', active ? 'true' : 'false');
                    if (active) activeButton = button;
                });
                root.querySelectorAll('[data-pref-panel]').forEach((panel) => {
                    const active = panel.dataset.prefPanel === this.activeTab;
                    panel.classList.toggle('is-active', active);
                    panel.toggleAttribute('hidden', !active);
                });
                this.revealActiveTab(activeButton);
                this.syncTabScrollControls(root);
            });
            this.syncMemoryMonitor();
        },

        scrollTabs(direction, root = this.panel) {
            const track = root?.querySelector('[data-pref-tab-track]');
            if (!track) return;
            const amount = Math.max(80, Math.round(track.clientWidth * .72));
            track.scrollBy({
                left: Number(direction) < 0 ? -amount : amount,
                behavior: 'smooth'
            });
            window.setTimeout(() => this.syncTabScrollControls(root), 220);
        },

        revealActiveTab(button) {
            if (!button) return;
            try {
                button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            } catch (_) {
                // 旧浏览器不支持对象参数时，保持当前滚动位置即可。
            }
        },

        syncTabScrollControls(root = this.panel) {
            const track = root?.querySelector('[data-pref-tab-track]');
            if (!track) return;
            const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
            const leftButton = root.querySelector('[data-pref-tab-scroll="-1"]');
            const rightButton = root.querySelector('[data-pref-tab-scroll="1"]');
            const disabled = maxScroll <= 1;
            const canScrollLeft = !disabled && track.scrollLeft > 1;
            const canScrollRight = !disabled && track.scrollLeft < maxScroll - 1;
            if (leftButton) leftButton.disabled = !canScrollLeft;
            if (rightButton) rightButton.disabled = !canScrollRight;
            const strip = track.closest(`.${NAME}-pref-tab-strip`);
            if (strip) {
                strip.classList.toggle('is-scroll-left', canScrollLeft);
                strip.classList.toggle('is-scroll-right', canScrollRight);
            }
        },

        renderQueue() {
            this.forEachSettingsRoot((root) => {
                const list = root.querySelector('[data-role="queue"]');
                if (!list) return;
                if (!ReadLaterQueue.items.length) {
                    list.replaceChildren(Dom.make('div', { className: `${NAME}-favorite-empty`, text: '暂无稍后阅读' }));
                    return;
                }

                list.replaceChildren(...ReadLaterQueue.items.map((item, index) => Dom.make('div', { className: `${NAME}-favorite-row ${NAME}-queue-row` }, [
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-favorite-item ${NAME}-queue-item`,
                        title: item.title,
                        'data-queue-open': item.id
                    }, [
                        Dom.make('span', { className: `${NAME}-favorite-title`, text: `${index + 1}. ${item.title}` }),
                        Dom.make('span', { className: `${NAME}-favorite-meta`, text: `加入队列 ${formatFavoriteTime(item.at)}` })
                    ]),
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-favorite-remove`,
                        title: '移出稍后阅读',
                        'aria-label': `移出稍后阅读：${item.title}`,
                        'data-queue-remove': item.id,
                        text: '×'
                    })
                ])));
            });
        },

        renderPageNav() {
            this.forEachSettingsRoot((root) => {
                const list = root.querySelector('[data-role="page-nav"]');
                if (!list) return;
                if (!PageNav.items.length) {
                    list.replaceChildren(Dom.make('div', { className: `${NAME}-favorite-empty`, text: '暂无页面导航' }));
                    return;
                }

                list.replaceChildren(...PageNav.items.map((item, index) => {
                    const active = PageNav.isCurrent(item);
                    const displayHref = PageNav.displayHref(item.href);
                    return Dom.make('div', { className: `${NAME}-favorite-row ${NAME}-page-nav-row${active ? ' is-active' : ''}` }, [
                        Dom.make('button', {
                            type: 'button',
                            className: `${NAME}-favorite-item ${NAME}-page-nav-item`,
                            title: `${item.title} · ${displayHref}`,
                            'aria-current': active ? 'page' : undefined,
                            'data-page-nav-open': item.id
                        }, [
                            Dom.make('span', { className: `${NAME}-favorite-title`, text: `${index + 1}. ${item.title}` }),
                            Dom.make('span', { className: `${NAME}-favorite-meta`, text: active ? `当前页面 · ${displayHref}` : displayHref })
                        ]),
                        Dom.make('button', {
                            type: 'button',
                            className: `${NAME}-page-nav-action`,
                            title: '编辑导航标题和地址',
                            'aria-label': `编辑导航标题和地址：${item.title}`,
                            'data-page-nav-edit': item.id,
                            text: '编'
                        }),
                        Dom.make('button', {
                            type: 'button',
                            className: `${NAME}-page-nav-action`,
                            title: '新标签打开',
                            'aria-label': `新标签打开：${item.title}`,
                            'data-page-nav-blank': item.id,
                            text: '↗'
                        }),
                        Dom.make('button', {
                            type: 'button',
                            className: `${NAME}-favorite-remove`,
                            title: '关闭导航标签',
                            'aria-label': `关闭导航标签：${item.title}`,
                            'data-page-nav-remove': item.id,
                            text: '×'
                        })
                    ]);
                }));
            });
        },

        renderFavorites() {
            this.forEachSettingsRoot((root) => {
                const list = root.querySelector('[data-role="favorites"]');
                if (!list) return;

                if (!Favorites.items.length) {
                    list.replaceChildren(Dom.make('div', { className: `${NAME}-favorite-empty`, text: '暂无收藏话题' }));
                    return;
                }

                list.replaceChildren(...Favorites.items.map((item) => Dom.make('div', { className: `${NAME}-favorite-row` }, [
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-favorite-item`,
                        title: item.title,
                        'data-favorite-open': item.id
                    }, [
                        Dom.make('span', { className: `${NAME}-favorite-title`, text: item.title }),
                        Dom.make('span', { className: `${NAME}-favorite-meta`, text: formatFavoriteTime(item.at) })
                    ]),
                    Dom.make('button', {
                        type: 'button',
                        className: `${NAME}-favorite-remove`,
                        title: '移除收藏',
                        'aria-label': `移除收藏：${item.title}`,
                        'data-favorite-remove': item.id,
                        text: '×'
                    })
                ])));
            });
        },

        renderRecent() {
            const items = this.recentItems();
            this.forEachSettingsRoot((root) => {
                const list = root.querySelector('[data-role="recent"]');
                if (!list) return;
                if (!items.length) {
                    const emptyText = ReadMemory.items.length && this.recentSearch.trim()
                        ? '没有匹配的最近查看'
                        : '暂无最近查看';
                    list.replaceChildren(Dom.make('div', { className: `${NAME}-favorite-empty`, text: emptyText }));
                    return;
                }

                list.replaceChildren(...items.map((item) => Dom.make('button', {
                    type: 'button',
                    className: `${NAME}-favorite-item ${NAME}-recent-item`,
                    title: `${item.title}\n${item.href || ''}`,
                    'data-recent-open': item.id
                }, [
                    Dom.make('span', { className: `${NAME}-favorite-title`, text: item.title }),
                    Dom.make('span', { className: `${NAME}-favorite-meta`, text: formatFavoriteTime(item.readAt || item.at) })
                ])));
            });
        },

        recentItems() {
            const query = this.recentSearch.trim().toLowerCase();
            const source = query
                ? ReadMemory.items.filter((item) => this.matchesRecentSearch(item, query))
                : ReadMemory.items;
            return source.slice(0, Prefs.value.recentLimit);
        },

        matchesRecentSearch(item, query) {
            const note = item?.note || item?.remark || item?.memo || '';
            return [
                item?.title,
                item?.href,
                note
            ].some((value) => String(value || '').toLowerCase().includes(query));
        },

        applyTheme() {
            if (!this.root) return;
            const dark = pagePrefersDarkTheme();
            this.root.classList.toggle('is-light', !dark);
        },

        applyPosition(left, top) {
            if (!this.root) return;
            if (arguments.length === 0) {
                if (Prefs.value.prefEdgeState) {
                    this.applyEdgeState(Prefs.value.prefEdgeState, { hidden: !this.isInteractionOpen() });
                    return;
                }
                left = Prefs.value.prefLeft;
                top = Prefs.value.prefTop;
            }
            if (!Number.isFinite(left) || !Number.isFinite(top)) {
                this.root.style.removeProperty('left');
                this.root.style.removeProperty('top');
                this.root.style.removeProperty('right');
                this.root.style.removeProperty('bottom');
                this.root.classList.remove('is-positioned');
                this.clearEdgeClasses();
                this.applyPanelPlacement();
                if (this.isPieOpen()) this.syncPieViewportOffset();
                this.syncPieLayout();
                return;
            }

            const position = this.clampPosition(left, top);
            this.clearEdgeClasses();
            this.root.style.left = `${position.left}px`;
            this.root.style.top = `${position.top}px`;
            this.root.style.right = 'auto';
            this.root.style.bottom = 'auto';
            this.root.classList.add('is-positioned');
            this.applyPanelPlacement(position.left, position.top);
            if (this.isPieOpen()) this.syncPieViewportOffset();
        },

        clampPosition(left, top) {
            const width = this.button?.offsetWidth || FLOATING_BUTTON_SIZE;
            const height = this.button?.offsetHeight || FLOATING_BUTTON_SIZE;
            const viewportWidth = this.viewportWidth();
            const viewportHeight = this.viewportHeight();
            return {
                left: Math.max(6, Math.min(Math.round(left), viewportWidth - width - 6)),
                top: Math.max(6, Math.min(Math.round(top), viewportHeight - height - 6))
            };
        },

        edgeStateFromPosition(position) {
            if (!position || !Number.isFinite(position.left) || !Number.isFinite(position.top)) return null;
            const width = this.button?.offsetWidth || FLOATING_BUTTON_SIZE;
            const height = this.button?.offsetHeight || FLOATING_BUTTON_SIZE;
            const minLeft = 6;
            const minTop = 6;
            const maxLeft = Math.max(minLeft, this.viewportWidth() - width - 6);
            const maxTop = Math.max(minTop, this.viewportHeight() - height - 6);
            const distances = [
                { edge: 'left', value: position.left - minLeft },
                { edge: 'right', value: maxLeft - position.left },
                { edge: 'top', value: position.top - minTop },
                { edge: 'bottom', value: maxTop - position.top }
            ].filter((item) => item.value <= FLOATING_EDGE_DISTANCE);
            if (!distances.length) return null;
            distances.sort((a, b) => a.value - b.value);
            return {
                edge: distances[0].edge,
                left: Math.max(minLeft, Math.min(Math.round(position.left), maxLeft)),
                top: Math.max(minTop, Math.min(Math.round(position.top), maxTop))
            };
        },

        positionFromEdgeState(state, hidden = true) {
            const normalized = Prefs.edgeState(state);
            if (!normalized) return null;
            const width = this.button?.offsetWidth || FLOATING_BUTTON_SIZE;
            const height = this.button?.offsetHeight || FLOATING_BUTTON_SIZE;
            const visible = this.clampPosition(normalized.left, normalized.top);
            if (!hidden) return visible;
            if (normalized.edge === 'left') return { left: FLOATING_EDGE_PEEK - width, top: visible.top };
            if (normalized.edge === 'right') return { left: this.viewportWidth() - FLOATING_EDGE_PEEK, top: visible.top };
            if (normalized.edge === 'top') return { left: visible.left, top: FLOATING_EDGE_PEEK - height };
            return { left: visible.left, top: this.viewportHeight() - FLOATING_EDGE_PEEK };
        },

        applyEdgeState(state, options = {}) {
            if (!this.root) return false;
            const normalized = Prefs.edgeState(state);
            if (!normalized) {
                this.clearEdgeClasses();
                return false;
            }
            const hidden = options.hidden !== false;
            const position = this.positionFromEdgeState(normalized, hidden);
            if (!position) return false;
            this.root.style.left = `${position.left}px`;
            this.root.style.top = `${position.top}px`;
            this.root.style.right = 'auto';
            this.root.style.bottom = 'auto';
            this.root.classList.add('is-positioned');
            this.setEdgeClasses(normalized.edge, hidden);
            this.applyPanelPlacement(normalized.left, normalized.top);
            if (this.isPieOpen()) this.syncPieViewportOffset();
            this.syncPieLayout();
            return true;
        },

        revealEdgeState() {
            if (!Prefs.value.prefEdgeState || this.isPieOpen()) return false;
            return this.applyEdgeState(Prefs.value.prefEdgeState, { hidden: false });
        },

        collapseEdgeStateIfIdle() {
            if (!Prefs.value.prefEdgeState || this.drag || this.isInteractionOpen()) return false;
            return this.applyEdgeState(Prefs.value.prefEdgeState);
        },

        isInteractionOpen() {
            return this.isOpen() || this.isPieOpen() || LiveTopics.isOpen();
        },

        isEdgeHidden() {
            return this.root?.classList.contains('is-edge-hidden') === true;
        },

        setEdgeClasses(edge, hidden) {
            if (!this.root) return;
            this.clearEdgeClasses();
            this.root.classList.add(`is-edge-${edge}`);
            this.root.classList.toggle('is-edge-hidden', hidden);
        },

        clearEdgeClasses() {
            if (!this.root) return;
            this.root.classList.remove(
                'is-edge-hidden',
                'is-edge-left',
                'is-edge-right',
                'is-edge-top',
                'is-edge-bottom'
            );
        },

        viewportWidth() {
            return Math.max(0, document.documentElement?.clientWidth || window.innerWidth || 0);
        },

        viewportHeight() {
            return Math.max(0, document.documentElement?.clientHeight || window.innerHeight || 0);
        },

        applyPanelPlacement(left = this.root?.getBoundingClientRect().left, top = this.root?.getBoundingClientRect().top) {
            if (!this.root) return;
            const rect = this.root.getBoundingClientRect();
            const x = Number.isFinite(left) ? left : rect.left;
            const y = Number.isFinite(top) ? top : rect.top;
            this.root.classList.toggle('is-panel-left', x < 360);
            this.root.classList.toggle('is-panel-below', y < 360);
            this.syncPieLayout();
        },

        resetPieViewportOffset() {
            if (!this.root) return;
            this.root.style.removeProperty('--pie-shift-x');
            this.root.style.removeProperty('--pie-shift-y');
            this.menu?.classList.remove('is-shifted');
        },

        syncPieViewportOffset() {
            if (!this.root || !this.menu) return;
            const rect = this.root.getBoundingClientRect();
            const buttonWidth = rect.width || this.button?.offsetWidth || FLOATING_BUTTON_SIZE;
            const buttonHeight = rect.height || this.button?.offsetHeight || FLOATING_BUTTON_SIZE;
            const margin = 14;
            const radius = FLOATING_PIE_RADIUS + 6;
            const centerX = rect.left + buttonWidth / 2;
            const centerY = rect.top + buttonHeight / 2;
            const nextCenterX = Math.max(radius + margin, Math.min(centerX, this.viewportWidth() - radius - margin));
            const nextCenterY = Math.max(radius + margin, Math.min(centerY, this.viewportHeight() - radius - margin));
            const shiftX = Math.round(nextCenterX - centerX);
            const shiftY = Math.round(nextCenterY - centerY);

            this.root.style.setProperty('--pie-shift-x', `${shiftX}px`);
            this.root.style.setProperty('--pie-shift-y', `${shiftY}px`);
            this.menu.classList.toggle('is-shifted', Math.abs(shiftX) > 1 || Math.abs(shiftY) > 1);
        },

        syncPieLayout() {
            if (!this.root || !this.button || !this.menu) return;
            const items = Array.from(this.menu.querySelectorAll('[data-pie-action]'));
            if (!items.length) return;

            const radius = items.length > 4 ? 74 : 70;
            const startAngle = -92;
            const step = items.length > 1 ? 360 / items.length : 0;
            const span = Math.max(34, Math.min(54, step ? step - 18 : 54));
            this.pieHighlightSpan = span;
            this.root.classList.toggle('is-pie-left', false);
            this.root.classList.toggle('is-pie-up', false);
            items.forEach((item, index) => {
                const angle = startAngle + index * step;
                const radian = angle * Math.PI / 180;
                item.style.setProperty('--pie-x', `${Math.round(Math.cos(radian) * radius)}px`);
                item.style.setProperty('--pie-y', `${Math.round(Math.sin(radian) * radius)}px`);
                item.style.setProperty('--pie-delay', `${index * 24}ms`);
                item.dataset.pieAngle = String(angle);
                item.dataset.pieSpan = String(span);
            });
            this.restorePieHighlight();
        }
    };

    const CrossTabSync = {
        started: false,
        timer: 0,
        pendingKinds: new Set(),
        keys: new Map([
            [PREF_KEY, 'prefs'],
            [MEMORY_KEY, 'readMemory'],
            [FAVORITES_KEY, 'favorites'],
            [READ_LATER_KEY, 'readLater'],
            [PAGE_NAV_KEY, 'pageNav'],
            [DRAWER_STATE_KEY, 'drawerState']
        ]),

        start() {
            if (this.started) return;
            this.started = true;
            this.watchGMValues();
            this.watchLocalStorage();
            this.watchPageResume();
        },

        watchGMValues() {
            if (typeof GM_addValueChangeListener !== 'function') return;
            this.keys.forEach((kind, key) => {
                try {
                    GM_addValueChangeListener(key, (_name, oldValue, newValue, remote) => {
                        if (remote === false || oldValue === newValue) return;
                        this.schedule(kind);
                    });
                } catch (error) {
                    console.warn(`${LOG_PREFIX} 跨标签同步监听失败`, key, error);
                }
            });
        },

        watchLocalStorage() {
            window.addEventListener('storage', (event) => {
                if (event.storageArea && event.storageArea !== window.localStorage) return;
                const kind = this.keys.get(event.key);
                if (kind) this.schedule(kind);
            });
        },

        watchPageResume() {
            const syncAll = () => this.schedule('all');
            window.addEventListener('focus', syncAll, { passive: true });
            window.addEventListener('pageshow', syncAll, { passive: true });
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) syncAll();
            });
        },

        schedule(kind = 'all') {
            this.pendingKinds.add(kind);
            if (this.timer) return;
            this.timer = window.setTimeout(() => this.flush(), 80);
        },

        flush() {
            this.timer = 0;
            const kinds = new Set(this.pendingKinds);
            this.pendingKinds.clear();
            if (kinds.has('all')) {
                this.reloadAll();
                return;
            }
            this.reloadKinds(kinds);
            this.refreshSurfaces(kinds);
        },

        reloadAll() {
            const kinds = new Set(['prefs', 'readMemory', 'favorites', 'readLater', 'pageNav', 'drawerState']);
            this.reloadKinds(kinds);
            this.refreshSurfaces(kinds);
        },

        reloadKinds(kinds) {
            ['prefs', 'readMemory', 'favorites', 'readLater', 'pageNav', 'drawerState'].forEach((kind) => {
                if (kinds.has(kind)) this.reloadKind(kind);
            });
        },

        reloadKind(kind) {
            if (kind === 'prefs') Prefs.load();
            else if (kind === 'readMemory') {
                ReadMemory.load();
                SimilarTopics.invalidate();
            } else if (kind === 'favorites') Favorites.load();
            else if (kind === 'readLater') ReadLaterQueue.load();
            else if (kind === 'pageNav') PageNav.load();
            else if (kind === 'drawerState') DrawerState.load();
        },

        refreshSurfaces(kinds) {
            if (kinds.has('prefs') && Prefs.value.forceCreatedOrder && CreatedOrder.apply()) return;
            if (kinds.has('prefs')) {
                StarterPostStore.trimCache();
                StarterPostStore.trimPreloadMarks();
            }
            if (kinds.has('prefs') || kinds.has('readMemory')) {
                TopicBadges.refresh();
            }
            MiniEye.syncLaterButton(MiniEye.button?.dataset.topicId || '');
            Drawer.applySize();
            Drawer.syncControls();
            Drawer.renderSidebar();
            FloatingPrefs.applyPosition();
            FloatingPrefs.applyTheme();
            FloatingPrefs.sync();
        }
    };

    // 将标准化后的 Discourse 首帖数据渲染成预览卡片。
    const SummaryCard = {
        build(topic) {
            const summaries = Array.isArray(topic.summaries) && topic.summaries.length
                ? topic.summaries
                : [{
                    key: 'starter',
                    label: '楼主',
                    displayName: topic.displayName,
                    username: topic.username,
                    avatar: topic.avatar,
                    createdAt: topic.createdAt,
                    likes: topic.likes,
                    postNumber: 1,
                    cooked: topic.cooked
                }];
            const activeKey = summaries.find((item) => !item.empty)?.key || summaries[0]?.key || 'starter';
            const tabs = Dom.make('div', { className: `${NAME}-summary-tabs`, role: 'tablist', 'aria-label': '回复摘要切换' },
                summaries.map((summary) => Dom.make('button', {
                    type: 'button',
                    className: `${NAME}-summary-tab${summary.key === activeKey ? ' is-active' : ''}`,
                    role: 'tab',
                    'aria-selected': summary.key === activeKey ? 'true' : 'false',
                    'data-summary-tab': summary.key,
                    title: summary.empty ? summary.emptyText : summary.label
                }, [
                    Dom.make('span', { className: `${NAME}-summary-tab-label`, text: summary.label }),
                    summary.badge
                        ? Dom.make('span', { className: `${NAME}-summary-tab-badge`, text: summary.badge })
                        : null
                ])));

            return Dom.make('article', { className: `${NAME}-summary` }, [
                tabs,
                Dom.make('div', { className: `${NAME}-summary-hint`, text: this.hintText(topic) }),
                this.searchBox(),
                ...summaries.map((summary) => this.view(topic, summary, summary.key === activeKey)),
                Dom.make('div', { className: `${NAME}-actions` }, [
                    Dom.make('button', { className: `${NAME}-primary-btn`, type: 'button', 'data-mode': 'thread', text: '查看详情' }),
                    Dom.make('a', {
                        className: `${NAME}-soft-btn`,
                        href: Urls.canonicalTopic(topic.id),
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        text: '打开原帖'
                    })
                ])
            ]);
        },

        searchBox() {
            return Dom.make('div', { className: `${NAME}-summary-search`, role: 'search', 'aria-label': '预览内容搜索' }, [
                Dom.make('input', {
                    className: `${NAME}-summary-search-input`,
                    type: 'search',
                    placeholder: '搜索当前摘要',
                    autocomplete: 'off',
                    spellcheck: 'false',
                    'data-summary-search': '1'
                }),
                Dom.make('button', {
                    type: 'button',
                    className: `${NAME}-summary-search-btn`,
                    title: '上一处',
                    'aria-label': '上一处',
                    'data-summary-search-step': '-1',
                    disabled: 'disabled',
                    text: '‹'
                }),
                Dom.make('button', {
                    type: 'button',
                    className: `${NAME}-summary-search-btn`,
                    title: '下一处',
                    'aria-label': '下一处',
                    'data-summary-search-step': '1',
                    disabled: 'disabled',
                    text: '›'
                }),
                Dom.make('button', {
                    type: 'button',
                    className: `${NAME}-summary-search-btn`,
                    title: '清空搜索',
                    'aria-label': '清空搜索',
                    'data-summary-search-clear': '1',
                    disabled: 'disabled',
                    text: '×'
                }),
                Dom.make('span', { className: `${NAME}-summary-search-count`, 'data-summary-search-count': '1', text: '0/0' })
            ]);
        },

        hintText(topic) {
            const loaded = Number(topic.loadedReplyCount || 0);
            const total = Number(topic.replyCount || 0);
            if (total > loaded) {
                return `提示：高赞回复和最新回复仅基于当前预览已加载的 ${loaded} 条回复，全帖约 ${total} 条回复，可能不是全量最新；完整阅读请查看详情。`;
            }
            if (loaded > 0) {
                return `提示：高赞回复和最新回复基于当前预览接口返回的 ${loaded} 条回复，可能与详情页实时排序存在差异。`;
            }
            return '提示：当前预览未加载回复，高赞回复和最新回复可能为空；完整阅读请查看详情。';
        },

        view(topic, summary, active) {
            if (summary.empty) {
                return Dom.make('section', {
                    className: `${NAME}-summary-view${active ? ' is-active' : ''}`,
                    role: 'tabpanel',
                    'data-summary-view': summary.key,
                    hidden: active ? null : 'hidden'
                }, [
                    Dom.make('div', { className: `${NAME}-summary-empty`, text: summary.emptyText || '暂无内容' })
                ]);
            }

            const avatar = summary.avatar
                ? Dom.make('img', { className: `${NAME}-avatar`, src: summary.avatar, alt: '' })
                : Dom.make('span', { className: `${NAME}-avatar`, text: (summary.displayName || '?').charAt(0).toUpperCase() });
            const createdAt = summary.createdAt
                ? new Date(summary.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
                : '';
            const author = Dom.make('div', { className: `${NAME}-author` }, [
                avatar,
                Dom.make('div', { className: `${NAME}-author-copy` }, [
                    Dom.make('div', { className: `${NAME}-name`, text: summary.displayName || '未知用户' }),
                    Dom.make('div', { className: `${NAME}-username`, text: summary.username ? `@${summary.username}` : '' })
                ])
            ]);
            const metaItems = [];
            if (summary.postNumber) metaItems.push(Dom.make('span', { text: `楼层：#${summary.postNumber}` }));
            if (createdAt) metaItems.push(Dom.make('span', { text: `时间：${createdAt}` }));
            metaItems.push(Dom.make('span', { text: `点赞数：${summary.likes || 0}` }));
            if (Number(topic.replyCount) > 0) metaItems.push(Dom.make('span', { text: `回复数：${topic.replyCount}` }));

            return Dom.make('section', {
                className: `${NAME}-summary-view${active ? ' is-active' : ''}`,
                role: 'tabpanel',
                'data-summary-view': summary.key,
                hidden: active ? null : 'hidden'
            }, [
                Dom.make('header', { className: `${NAME}-topic-head` }, [
                    author,
                    Dom.make('h2', { className: `${NAME}-topic-title`, text: topic.title }),
                    Dom.make('div', { className: `${NAME}-meta` }, metaItems)
                ]),
                Dom.make('section', { className: `${NAME}-cooked`, html: summary.cooked || '<p>暂无正文内容</p>' })
            ]);
        },

        activate(card, key) {
            if (!card || !key) return;
            card.querySelectorAll('[data-summary-tab]').forEach((button) => {
                const active = button.dataset.summaryTab === key;
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            card.querySelectorAll('[data-summary-view]').forEach((view) => {
                const active = view.dataset.summaryView === key;
                view.classList.toggle('is-active', active);
                view.toggleAttribute('hidden', !active);
            });
            const input = card.querySelector('[data-summary-search]');
            if (input?.value) this.search(card, input.value);
        },

        search(card, query) {
            if (!card) return;
            const value = String(query || '').trim();
            const input = card.querySelector('[data-summary-search]');
            if (input && input.value !== query) input.value = query || '';
            this.clearMarks(card);
            if (!value) {
                this.updateSearchState(card, 0, 0, false);
                return;
            }

            const root = card.querySelector(`.${NAME}-summary-view.is-active .${NAME}-cooked`);
            if (!root) {
                this.updateSearchState(card, 0, 0, true);
                return;
            }
            this.highlight(root, value);
            const marks = this.marks(card);
            if (!marks.length) {
                this.updateSearchState(card, 0, 0, true);
                return;
            }
            this.setCurrent(card, 0, { scroll: true });
        },

        step(card, direction) {
            if (!card) return;
            const marks = this.marks(card);
            if (!marks.length) return;
            const current = Number(card.dataset.summarySearchIndex || 0);
            const next = (current + Number(direction || 0) + marks.length) % marks.length;
            this.setCurrent(card, next, { scroll: true });
        },

        clearSearch(card) {
            if (!card) return;
            const input = card.querySelector('[data-summary-search]');
            if (input) input.value = '';
            this.clearMarks(card);
            this.updateSearchState(card, 0, 0, false);
            input?.focus();
        },

        highlight(root, query) {
            const needle = query.toLowerCase();
            const nodes = [];
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
                acceptNode(node) {
                    const text = node.nodeValue || '';
                    if (!text.trim()) return NodeFilter.FILTER_REJECT;
                    if (node.parentElement?.closest?.(`.${NAME}-summary-search-hit`)) return NodeFilter.FILTER_REJECT;
                    return text.toLowerCase().includes(needle)
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT;
                }
            });
            while (walker.nextNode()) nodes.push(walker.currentNode);

            nodes.forEach((node) => {
                const text = node.nodeValue || '';
                const lower = text.toLowerCase();
                const fragment = document.createDocumentFragment();
                let cursor = 0;
                let index = lower.indexOf(needle);
                while (index >= 0) {
                    if (index > cursor) fragment.append(document.createTextNode(text.slice(cursor, index)));
                    fragment.append(Dom.make('mark', { className: `${NAME}-summary-search-hit`, text: text.slice(index, index + query.length) }));
                    cursor = index + query.length;
                    index = lower.indexOf(needle, cursor);
                }
                if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
                node.replaceWith(fragment);
            });
        },

        clearMarks(card) {
            card.querySelectorAll(`.${NAME}-summary-search-hit`).forEach((mark) => {
                const parent = mark.parentNode;
                mark.replaceWith(document.createTextNode(mark.textContent || ''));
                parent?.normalize?.();
            });
            card.dataset.summarySearchIndex = '0';
        },

        marks(card) {
            return Array.from(card.querySelectorAll(`.${NAME}-summary-view.is-active .${NAME}-summary-search-hit`));
        },

        setCurrent(card, index, options = {}) {
            const marks = this.marks(card);
            marks.forEach((mark) => mark.classList.remove('is-current'));
            if (!marks.length) {
                this.updateSearchState(card, 0, 0, true);
                return;
            }
            const current = Math.max(0, Math.min(marks.length - 1, Number(index) || 0));
            const mark = marks[current];
            mark.classList.add('is-current');
            card.dataset.summarySearchIndex = String(current);
            this.updateSearchState(card, current + 1, marks.length, true);
            if (options.scroll !== false) {
                mark.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
            }
        },

        updateSearchState(card, current, total, hasQuery) {
            const count = card.querySelector('[data-summary-search-count]');
            if (count) count.textContent = `${current}/${total}`;
            card.querySelectorAll('[data-summary-search-step]').forEach((button) => {
                button.disabled = total < 2;
                button.toggleAttribute('disabled', total < 2);
            });
            const clear = card.querySelector('[data-summary-search-clear]');
            if (clear) {
                clear.disabled = !hasQuery;
                clear.toggleAttribute('disabled', !hasQuery);
            }
        }
    };

    // 集中处理页面级交互：话题悬浮识别、外部点击关闭和键盘关闭。
    const Interactions = {
        bind() {
            document.addEventListener('pointerover', (event) => this.onPointerOver(event), true);
            document.addEventListener('pointerout', (event) => this.onPointerOut(event), true);
            document.addEventListener('focusin', (event) => this.onFocus(event), true);
            document.addEventListener('click', (event) => this.onTopicClick(event), true);

            document.addEventListener('pointerdown', (event) => {
                if (event.button !== 0) return;
                if (Dom.isOwnSurface(event.target)) return;
                const hit = TopicHitTest.fromPointerTarget(event.target);
                if (hit) return;
                MiniEye.hide();
            }, true);

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    if (Drawer.root?.classList.contains('is-open')) Drawer.close();
                    else if (LiveTopics.isOpen()) LiveTopics.hide();
                    else MiniEye.hide();
                }
            });

            window.addEventListener('scroll', () => MiniEye.place(), { passive: true });
            window.addEventListener('resize', () => {
                Drawer.applyTheme();
                Drawer.applySize();
                FloatingPrefs.applyTheme();
                FloatingPrefs.applyPosition();
                MiniEye.applyTheme();
                MiniEye.place();
            }, { passive: true });
        },

        onTopicClick(event) {
            if (!Prefs.value.clickTopicToDrawer || event.defaultPrevented || event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            if (Dom.isOwnSurface(event.target)) return;
            const hit = TopicHitTest.fromPointerTarget(event.target);
            if (!hit) return;
            if (this.shouldLetBrowserOpen(hit.anchor)) return;

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            MiniEye.hide();
            TopicBadges.refreshAnchor(hit.anchor);
            Drawer.open(hit.topicId, Prefs.value.mode, hit.anchor, hit.anchor.getAttribute('href') || '', { trackSource: 'topicLinks' });
        },

        shouldLetBrowserOpen(anchor) {
            if (!anchor?.matches?.('a[href]')) return true;
            if (anchor.hasAttribute('download')) return true;
            const target = String(anchor.getAttribute('target') || '').trim().toLowerCase();
            return !!target && target !== '_self';
        },

        onPointerOver(event) {
            if (window.innerWidth <= 768) return;
            const hit = TopicHitTest.fromPointerTarget(event.target);
            if (!hit) return;
            TopicBadges.refreshAnchor(hit.anchor);
            MiniEye.show(hit.topicId, hit.anchor);
        },

        onPointerOut(event) {
            if (window.innerWidth <= 768) return;
            const hit = TopicHitTest.fromPointerTarget(event.target);
            if (!hit) return;
            if (event.relatedTarget instanceof Node && hit.anchor.contains(event.relatedTarget)) return;
            if (Dom.isOwnSurface(event.relatedTarget)) return;
            MiniEye.hideSoon();
        },

        onFocus(event) {
            if (window.innerWidth <= 768) return;
            const hit = TopicHitTest.fromPointerTarget(event.target);
            if (!hit) return;
            TopicBadges.refreshAnchor(hit.anchor);
            MiniEye.show(hit.topicId, hit.anchor);
        }
    };

    // 样式一次性注入，让脚本保持单文件形态，便于 GitHub 直接安装。
    function installStyle() {
        const css = `
            #${NAME}-eye,
            #${NAME}-eye *,
            #${NAME}-mini-stats,
            #${NAME}-mini-stats *,
            #${NAME}-drawer,
            #${NAME}-drawer-sidebar,
            #${NAME}-drawer-sidebar *,
            #${NAME}-shade,
            #${NAME}-prefs,
            #${NAME}-prefs *,
            #${NAME}-drawer * {
                box-sizing: border-box;
            }

            #${NAME}-eye {
                --blue: #5e7ee8;
                --green: #4eb4a5;
                position: fixed;
                left: 0;
                top: 0;
                width: auto;
                height: 36px;
                border: 0;
                border-radius: 11px;
                display: flex;
                align-items: center;
                justify-content: flex-start;
                gap: 3px;
                padding: 3px;
                color: #fff;
                background:
                    linear-gradient(180deg, rgba(255, 255, 255, .28), rgba(255, 255, 255, .08)),
                    linear-gradient(135deg, rgba(94, 126, 232, .86), rgba(78, 180, 165, .86));
                box-shadow:
                    0 14px 34px rgba(20, 28, 48, .28),
                    0 4px 12px rgba(20, 28, 48, .18),
                    inset 0 1px 0 rgba(255, 255, 255, .42),
                    inset 0 0 0 1px rgba(255, 255, 255, .24);
                z-index: 100000;
                opacity: 0;
                pointer-events: none;
                transform: translate(-999px, -999px) scale(.92);
                backdrop-filter: blur(16px) saturate(1.35);
                -webkit-backdrop-filter: blur(16px) saturate(1.35);
                transition: opacity 150ms ease, box-shadow 150ms ease, filter 150ms ease;
                -webkit-tap-highlight-color: transparent;
            }

            #${NAME}-eye::before {
                content: '';
                position: absolute;
                inset: 1px;
                border-radius: 10px;
                background: linear-gradient(180deg, rgba(255, 255, 255, .22), transparent 48%);
                pointer-events: none;
            }

            #${NAME}-eye.is-live {
                opacity: 1;
                pointer-events: auto;
            }

            #${NAME}-eye:hover,
            #${NAME}-eye:focus-within {
                filter: brightness(1.05);
                box-shadow:
                    0 18px 42px rgba(20, 28, 48, .36),
                    0 0 0 3px rgba(94, 126, 232, .2),
                    inset 0 1px 0 rgba(255, 255, 255, .5),
                    inset 0 0 0 1px rgba(255, 255, 255, .3);
            }

            .${NAME}-eye-btn {
                appearance: none;
                width: 36px;
                height: 30px;
                border: 0;
                border-radius: 8px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                background: transparent;
                cursor: pointer;
                font: inherit;
                font-size: 19px;
                font-weight: 850;
                line-height: 1;
            }

            .${NAME}-eye-btn:hover,
            .${NAME}-eye-btn:focus-visible {
                outline: none;
                background: rgba(255, 255, 255, .18);
            }

            .${NAME}-eye-later.is-active {
                color: #1f2941;
                background: rgba(255, 255, 255, .92);
            }

            .${NAME}-eye-stats-icon {
                position: relative;
                display: block;
                width: 24px;
                height: 22px;
                filter: drop-shadow(0 1px 1px rgba(0, 0, 0, .22));
            }

            .${NAME}-eye-stats-icon::before {
                content: '';
                position: absolute;
                left: 4px;
                bottom: 5px;
                width: 4px;
                height: 8px;
                border-radius: 3px 3px 1px 1px;
                background: rgba(255, 255, 255, .96);
                box-shadow:
                    7px -5px 0 rgba(255, 255, 255, .9),
                    14px -2px 0 rgba(255, 255, 255, .82);
            }

            .${NAME}-eye-stats-icon::after {
                content: '';
                position: absolute;
                left: 3px;
                right: 2px;
                bottom: 3px;
                height: 2px;
                border-radius: 999px;
                background: rgba(255, 255, 255, .78);
            }

            #${NAME}-mini-stats {
                --mini-bg: rgba(18, 22, 34, .97);
                --mini-panel: rgba(255, 255, 255, .075);
                --mini-line: rgba(255, 255, 255, .13);
                --mini-text: #f5f7fb;
                --mini-muted: #aab3c8;
                --mini-blue: #7b95ff;
                --mini-green: #55c3aa;
                --mini-warn: #ffbe73;
                position: fixed;
                left: 0;
                top: 0;
                z-index: 100001;
                width: min(306px, calc(100vw - 16px));
                color: var(--mini-text);
                font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
                opacity: 0;
                pointer-events: none;
                transform: translate(-999px, -999px);
                transition: opacity 150ms ease, filter 150ms ease;
                -webkit-tap-highlight-color: transparent;
            }

            #${NAME}-mini-stats.is-light {
                --mini-bg: rgba(255, 255, 255, .98);
                --mini-panel: rgba(245, 247, 252, .96);
                --mini-line: rgba(24, 33, 52, .13);
                --mini-text: #202636;
                --mini-muted: #596276;
                --mini-blue: #526fd6;
                --mini-green: #258a7b;
                --mini-warn: #b45309;
            }

            #${NAME}-mini-stats.is-open {
                opacity: 1;
                pointer-events: auto;
            }

            .${NAME}-mini-stats-card {
                overflow: hidden;
                border: 1px solid var(--mini-line);
                border-radius: 10px;
                background:
                    linear-gradient(180deg, rgba(255, 255, 255, .08), transparent 44%),
                    var(--mini-bg);
                box-shadow:
                    0 18px 44px rgba(14, 20, 34, .34),
                    0 8px 18px rgba(14, 20, 34, .22),
                    inset 0 1px 0 rgba(255, 255, 255, .12);
                backdrop-filter: blur(16px) saturate(1.25);
                -webkit-backdrop-filter: blur(16px) saturate(1.25);
            }

            #${NAME}-mini-stats.is-light .${NAME}-mini-stats-card {
                background:
                    linear-gradient(180deg, rgba(255, 255, 255, .92), transparent 46%),
                    var(--mini-bg);
                box-shadow:
                    0 18px 42px rgba(31, 41, 58, .14),
                    0 8px 18px rgba(31, 41, 58, .1),
                    inset 0 1px 0 rgba(255, 255, 255, .8);
            }

            .${NAME}-mini-stats-head {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 10px 8px;
                border-bottom: 1px solid var(--mini-line);
            }

            .${NAME}-mini-stats-title {
                min-width: 0;
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 13px;
                font-weight: 750;
                color: var(--mini-text);
            }

            .${NAME}-mini-stats-close {
                appearance: none;
                width: 24px;
                height: 24px;
                border: 1px solid transparent;
                border-radius: 7px;
                color: var(--mini-muted);
                background: transparent;
                cursor: pointer;
                font: 18px/1 Arial, sans-serif;
            }

            .${NAME}-mini-stats-close:hover,
            .${NAME}-mini-stats-close:focus-visible {
                outline: none;
                color: var(--mini-text);
                background: rgba(255, 255, 255, .1);
            }

            #${NAME}-mini-stats.is-light .${NAME}-mini-stats-close:hover,
            #${NAME}-mini-stats.is-light .${NAME}-mini-stats-close:focus-visible {
                background: rgba(24, 33, 52, .08);
            }

            .${NAME}-mini-stats-empty {
                padding: 18px 12px;
                color: var(--mini-muted);
                text-align: center;
            }

            .${NAME}-mini-stats-body {
                display: flex;
                flex-direction: column;
                gap: 9px;
                padding: 10px;
            }

            .${NAME}-mini-stats-id-row {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                gap: 8px;
                align-items: stretch;
            }

            .${NAME}-mini-stats-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 8px;
            }

            .${NAME}-mini-stats-row,
            .${NAME}-mini-stats-status {
                min-width: 0;
                border: 1px solid var(--mini-line);
                border-radius: 8px;
                background: var(--mini-panel);
            }

            .${NAME}-mini-stats-row {
                display: flex;
                flex-direction: column;
                gap: 2px;
                padding: 7px 8px;
                color: inherit;
                text-align: left;
            }

            button.${NAME}-mini-stats-row {
                appearance: none;
                cursor: pointer;
                font: inherit;
            }

            button.${NAME}-mini-stats-row:hover,
            button.${NAME}-mini-stats-row:focus-visible {
                outline: none;
                border-color: rgba(123, 149, 255, .48);
                background: rgba(123, 149, 255, .16);
            }

            #${NAME}-mini-stats.is-light button.${NAME}-mini-stats-row:hover,
            #${NAME}-mini-stats.is-light button.${NAME}-mini-stats-row:focus-visible {
                border-color: rgba(82, 111, 214, .42);
                background: rgba(82, 111, 214, .1);
            }

            .${NAME}-mini-stats-row-warn .${NAME}-mini-stats-value {
                color: var(--mini-warn);
            }

            .${NAME}-mini-stats-label {
                overflow: hidden;
                color: var(--mini-muted);
                font-size: 11px;
                white-space: nowrap;
                text-overflow: ellipsis;
            }

            .${NAME}-mini-stats-value {
                overflow: hidden;
                color: var(--mini-text);
                font-size: 14px;
                font-weight: 760;
                white-space: nowrap;
                text-overflow: ellipsis;
            }

            .${NAME}-mini-stats-status {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 58px;
                padding: 0 9px;
                color: var(--mini-green);
                font-size: 12px;
                font-weight: 720;
            }

            .${NAME}-mini-stats-meter {
                border: 1px solid var(--mini-line);
                border-radius: 8px;
                padding: 7px 8px 8px;
                background: var(--mini-panel);
            }

            .${NAME}-mini-stats-meter-head {
                display: flex;
                justify-content: space-between;
                gap: 10px;
                margin-bottom: 6px;
            }

            .${NAME}-mini-stats-meter-track {
                overflow: hidden;
                height: 7px;
                border-radius: 999px;
                background: rgba(255, 255, 255, .11);
            }

            #${NAME}-mini-stats.is-light .${NAME}-mini-stats-meter-track {
                background: rgba(24, 33, 52, .08);
            }

            .${NAME}-mini-stats-meter-fill {
                display: block;
                height: 100%;
                border-radius: inherit;
                background: linear-gradient(90deg, var(--mini-blue), var(--mini-green));
            }

            .${NAME}-mini-stats-meter-warn .${NAME}-mini-stats-meter-fill {
                background: linear-gradient(90deg, var(--mini-warn), #f07178);
            }

            .${NAME}-mini-stats-drawer {
                appearance: none;
                height: 30px;
                border: 1px solid rgba(123, 149, 255, .42);
                border-radius: 8px;
                color: #fff;
                background: linear-gradient(135deg, rgba(123, 149, 255, .76), rgba(85, 195, 170, .72));
                cursor: pointer;
                font: inherit;
                font-size: 12px;
                font-weight: 760;
            }

            .${NAME}-mini-stats-drawer:hover,
            .${NAME}-mini-stats-drawer:focus-visible {
                outline: none;
                filter: brightness(1.08);
            }

            .${NAME}-book-preview {
                position: relative;
                z-index: 1;
                width: 30px;
                height: 23px;
                perspective: 80px;
                filter: drop-shadow(0 1px 1px rgba(0, 0, 0, .25));
            }

            .${NAME}-book-preview::before {
                content: '';
                position: absolute;
                left: 2px;
                top: 2px;
                width: 5px;
                height: 19px;
                border-radius: 3px;
                background: rgba(255, 255, 255, .95);
                box-shadow: 0 0 0 1px rgba(255, 255, 255, .2);
            }

            .${NAME}-book-pages,
            .${NAME}-book-cover {
                position: absolute;
                left: 6px;
                top: 2px;
                width: 22px;
                height: 19px;
                border-radius: 2px 6px 6px 2px;
                transform-origin: left center;
                transition: transform 240ms cubic-bezier(.22, 1, .36, 1), opacity 180ms ease, box-shadow 180ms ease;
            }

            .${NAME}-book-pages {
                background:
                    linear-gradient(90deg, rgba(255, 255, 255, .9) 0 1px, transparent 1px 100%),
                    repeating-linear-gradient(180deg, rgba(90, 110, 150, .28) 0 1px, transparent 1px 4px),
                    linear-gradient(180deg, #fff 0%, #e8edf8 100%);
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .7);
                opacity: .72;
                transform: rotateY(16deg) translateX(0);
            }

            .${NAME}-book-cover {
                background:
                    linear-gradient(90deg, rgba(255, 255, 255, .28) 0 2px, transparent 2px),
                    linear-gradient(135deg, #ffffff 0%, #dce7ff 52%, #b9caf4 100%);
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .7), 0 2px 5px rgba(0, 0, 0, .18);
                transform: rotateY(0deg);
            }

            .${NAME}-book-cover::after {
                content: '';
                position: absolute;
                right: 5px;
                top: 6px;
                width: 9px;
                height: 2px;
                border-radius: 2px;
                background: rgba(76, 95, 140, .48);
                box-shadow: 0 5px 0 rgba(76, 95, 140, .34);
            }

            #${NAME}-eye:hover .${NAME}-book-cover,
            #${NAME}-eye:focus-visible .${NAME}-book-cover {
                transform: rotateY(-58deg) translateX(-1px);
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .7), 3px 3px 8px rgba(0, 0, 0, .18);
            }

            #${NAME}-eye:hover .${NAME}-book-pages,
            #${NAME}-eye:focus-visible .${NAME}-book-pages {
                opacity: 1;
                transform: rotateY(0deg) translateX(2px);
            }

            #${NAME}-prefs {
                --bg: rgba(18, 20, 29, .98);
                --panel: rgba(30, 33, 45, .94);
                --panel2: rgba(39, 43, 58, .92);
                --text: #eef1f7;
                --muted: #a0a7ba;
                --weak: #6f778b;
                --line: rgba(255, 255, 255, .09);
                --blue: #6385ef;
                --green: #56b8aa;
                --rail-bg: var(--bg);
                --rail-line: var(--line);
                --rail-text: var(--text);
                --rail-muted: var(--muted);
                --rail-button: var(--panel2);
                --rail-button-hover: rgba(99, 133, 239, .14);
                --rail-button-active: rgba(99, 133, 239, .18);
                --active-border: rgba(99, 133, 239, .42);
                --badge: var(--green);
                --pie-disc-bg: rgba(18, 20, 29, .94);
                --pie-disc-center: rgba(7, 10, 20, .74);
                --pie-inner-line: rgba(255, 255, 255, .10);
                --pie-sector: rgba(255, 255, 255, .13);
                --pie-sector-line: rgba(255, 255, 255, .08);
                --pie-ease-out: cubic-bezier(.16, 1, .3, 1);
                --pie-ease-back: cubic-bezier(.34, 1.56, .64, 1);
                position: fixed;
                right: 22px;
                bottom: 22px;
                width: 40px;
                height: 40px;
                z-index: 100000;
                display: block;
                color: var(--text);
                font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
                isolation: isolate;
            }

            #${NAME}-prefs.is-light {
                --bg: rgba(250, 251, 254, .98);
                --panel: rgba(244, 247, 252, .96);
                --panel2: rgba(255, 255, 255, .96);
                --text: #202636;
                --muted: #596276;
                --weak: #8992a4;
                --line: rgba(24, 33, 52, .11);
                --rail-bg: rgba(250, 251, 254, .98);
                --rail-button: rgba(255, 255, 255, .98);
                --rail-muted: #596276;
                --rail-text: #202636;
                --rail-line: rgba(24, 33, 52, .12);
                --pie-disc-bg: rgba(250, 251, 254, .94);
                --pie-disc-center: rgba(255, 255, 255, .82);
                --pie-inner-line: rgba(24, 33, 52, .12);
                --pie-sector: rgba(24, 33, 52, .12);
                --pie-sector-line: rgba(24, 33, 52, .09);
            }

            .${NAME}-pref-button {
                position: absolute;
                inset: 0;
                z-index: 4;
                width: 40px;
                height: 40px;
                border: 1px solid var(--rail-line);
                border-radius: 14px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: var(--rail-muted);
                background: var(--rail-bg);
                box-shadow: 0 12px 30px rgba(0, 0, 0, .26), inset 0 1px 0 rgba(255, 255, 255, .06);
                cursor: pointer;
                touch-action: none;
                user-select: none;
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
                will-change: transform, opacity, filter;
                transition:
                    opacity 150ms ease,
                    filter 150ms ease,
                    color 130ms ease,
                    background 130ms ease,
                    border-radius 160ms ease,
                    transform 180ms cubic-bezier(.2, .8, .2, 1),
                    box-shadow 160ms ease;
            }

            .${NAME}-pref-button::after {
                content: '';
                position: absolute;
                left: 50%;
                top: 50%;
                width: 0;
                height: 0;
                border: 0;
                opacity: 0;
                pointer-events: none;
                transform: translate(-50%, -50%) scale(.82);
                transition: opacity 140ms ease, transform 180ms cubic-bezier(.2, .8, .2, 1);
            }

            #${NAME}-prefs.is-edge-hidden .${NAME}-pref-button {
                color: #f3f7ff;
                background: linear-gradient(145deg, rgba(74, 82, 96, .98), rgba(28, 34, 43, .98));
                border-color: rgba(125, 152, 190, .58);
                border-radius: 999px;
                box-shadow:
                    0 10px 24px rgba(7, 12, 20, .36),
                    0 0 0 1px rgba(96, 165, 250, .18),
                    inset 0 1px 0 rgba(255, 255, 255, .22),
                    inset 0 -10px 18px rgba(5, 8, 13, .22);
                transform: none;
            }

            #${NAME}-prefs.is-edge-hidden .${NAME}-pref-button:hover,
            #${NAME}-prefs.is-edge-hidden .${NAME}-pref-button:focus-visible {
                color: #fff;
                background: linear-gradient(145deg, rgba(86, 96, 112, .98), rgba(35, 43, 55, .98));
                border-color: rgba(147, 197, 253, .72);
                box-shadow:
                    0 12px 28px rgba(7, 12, 20, .40),
                    0 0 0 1px rgba(96, 165, 250, .30),
                    0 0 18px rgba(96, 165, 250, .18),
                    inset 0 1px 0 rgba(255, 255, 255, .26),
                    inset 0 -10px 18px rgba(5, 8, 13, .20);
                transform: none;
            }

            #${NAME}-prefs.is-edge-hidden .${NAME}-launcher-symbol {
                opacity: 0;
                transform: scale(.72);
            }

            #${NAME}-prefs.is-edge-hidden .${NAME}-pref-button::after {
                opacity: 1;
                transform: translate(0, 0) scale(1);
            }

            #${NAME}-prefs.is-edge-hidden.is-edge-left .${NAME}-pref-button::after {
                left: auto;
                right: 3px;
                top: 50%;
                border-top: 7px solid transparent;
                border-bottom: 7px solid transparent;
                border-left: 10px solid #f3f7ff;
                transform: translateY(-50%);
            }

            #${NAME}-prefs.is-edge-hidden.is-edge-right .${NAME}-pref-button::after {
                left: 3px;
                top: 50%;
                border-top: 7px solid transparent;
                border-bottom: 7px solid transparent;
                border-right: 10px solid #f3f7ff;
                transform: translateY(-50%);
            }

            #${NAME}-prefs.is-edge-hidden.is-edge-top .${NAME}-pref-button::after {
                left: 50%;
                top: auto;
                bottom: 3px;
                border-left: 7px solid transparent;
                border-right: 7px solid transparent;
                border-top: 10px solid #f3f7ff;
                transform: translateX(-50%);
            }

            #${NAME}-prefs.is-edge-hidden.is-edge-bottom .${NAME}-pref-button::after {
                left: 50%;
                top: 3px;
                border-left: 7px solid transparent;
                border-right: 7px solid transparent;
                border-bottom: 10px solid #f3f7ff;
                transform: translateX(-50%);
            }

            .${NAME}-pref-button:hover,
            .${NAME}-pref-button:focus-visible {
                outline: none;
                color: var(--rail-text);
                background: var(--rail-button-hover);
                transform: translateX(1px) scale(1.04);
            }

            #${NAME}-prefs.is-pie-open .${NAME}-pref-button {
                color: var(--rail-text);
                background: var(--rail-button-active);
                transform: translate3d(var(--pie-shift-x, 0px), var(--pie-shift-y, 0px), 0) scale(1.04);
                box-shadow: 0 14px 36px rgba(0, 0, 0, .28), 0 0 0 7px rgba(99, 133, 239, .05), inset 0 0 0 1px var(--active-border);
            }

            .${NAME}-launcher-symbol {
                position: relative;
                z-index: 1;
                width: 17px;
                height: 17px;
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                grid-template-rows: repeat(2, 1fr);
                gap: 3px;
                filter: drop-shadow(0 1px 1px rgba(0, 0, 0, .28));
                transition:
                    opacity 150ms ease,
                    gap 240ms var(--pie-ease-out),
                    transform 360ms cubic-bezier(.22, .98, .33, 1.08);
            }

            .${NAME}-launcher-dot {
                border-radius: 3px;
                background: currentColor;
                transition:
                    background 180ms ease,
                    border-radius 240ms var(--pie-ease-out),
                    box-shadow 180ms ease,
                    transform 320ms var(--pie-ease-back);
            }

            #${NAME}-prefs.is-pie-open .${NAME}-launcher-dot,
            .${NAME}-pref-button:hover .${NAME}-launcher-dot,
            .${NAME}-pref-button:focus-visible .${NAME}-launcher-dot {
                border-radius: 999px;
                background: var(--blue);
                box-shadow: 0 0 7px rgba(99, 133, 239, .36);
            }

            #${NAME}-prefs.is-pie-open .${NAME}-launcher-symbol {
                gap: 2px;
                transform: rotate(45deg) scale(.82);
            }

            .${NAME}-pie-menu {
                position: absolute;
                inset: 0;
                z-index: 3;
                pointer-events: none;
                isolation: isolate;
                --pie-item-size: 34px;
            }

            .${NAME}-pie-menu::before {
                content: '';
                position: absolute;
                z-index: 0;
                left: calc(50% + var(--pie-shift-x, 0px));
                top: calc(50% + var(--pie-shift-y, 0px));
                width: 200px;
                height: 200px;
                border: 1px solid var(--rail-line);
                border-radius: 999px;
                background:
                    radial-gradient(circle at 50% 50%,
                        var(--pie-disc-center) 0 47px,
                        var(--pie-inner-line) 47px 48px,
                        transparent 49px),
                    radial-gradient(circle at 50% 50%,
                        transparent 0 48px,
                        var(--pie-disc-bg) 49px 100px,
                        transparent 101px);
                visibility: hidden;
                box-shadow: none;
                opacity: 0;
                pointer-events: none;
                transform: translate(-50%, -50%) scale(.86);
                transform-origin: center;
                transition: none;
                backdrop-filter: none;
                -webkit-backdrop-filter: none;
            }

            #${NAME}-prefs.is-pie-open .${NAME}-pie-menu::before {
                visibility: visible;
                box-shadow: 0 16px 42px rgba(0, 0, 0, .32), inset 0 0 0 1px rgba(255, 255, 255, .025);
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
                transition:
                    opacity 220ms var(--pie-ease-out),
                    transform 420ms var(--pie-ease-back);
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
            }

            .${NAME}-pie-menu::after {
                content: '';
                position: absolute;
                z-index: 1;
                left: calc(50% + var(--pie-shift-x, 0px));
                top: calc(50% + var(--pie-shift-y, 0px));
                width: 200px;
                height: 200px;
                border-radius: 999px;
                background:
                    conic-gradient(from var(--pie-highlight-start, -119deg),
                        var(--pie-sector-line) 0deg,
                        var(--pie-sector-line) 1.5deg,
                        var(--pie-sector) 1.5deg,
                        var(--pie-sector) calc(var(--pie-highlight-span, 54deg) - 1.5deg),
                        var(--pie-sector-line) calc(var(--pie-highlight-span, 54deg) - 1.5deg),
                        var(--pie-sector-line) var(--pie-highlight-span, 54deg),
                        transparent var(--pie-highlight-span, 54deg),
                        transparent 360deg);
                visibility: hidden;
                opacity: 0;
                pointer-events: none;
                transform: translate(-50%, -50%) scale(.9);
                transform-origin: center;
                filter: none;
                -webkit-mask: radial-gradient(circle, transparent 0 48px, #000 49px 100px, transparent 101px);
                mask: radial-gradient(circle, transparent 0 48px, #000 49px 100px, transparent 101px);
                transition: none;
            }

            #${NAME}-prefs.is-pie-open .${NAME}-pie-menu.is-highlighted::after {
                visibility: visible;
                opacity: 1;
                filter: drop-shadow(0 10px 18px rgba(0, 0, 0, .24));
                transform: translate(-50%, -50%) scale(1);
                transition:
                    opacity 140ms ease,
                    transform 220ms var(--pie-ease-out);
            }

            .${NAME}-pie-item {
                appearance: none;
                position: absolute;
                left: 3px;
                top: 3px;
                z-index: 2;
                width: var(--pie-item-size);
                height: var(--pie-item-size);
                border: 1px solid transparent;
                border-radius: 999px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: var(--rail-muted);
                background: transparent;
                box-shadow: none;
                cursor: pointer;
                opacity: 0;
                pointer-events: none;
                transform: translate3d(var(--pie-shift-x, 0px), var(--pie-shift-y, 0px), 0) scale(.7);
                transition:
                    opacity 190ms var(--pie-ease-out),
                    transform 360ms var(--pie-ease-back),
                    border-color 150ms ease,
                    background 130ms ease,
                    color 130ms ease,
                    box-shadow 130ms ease;
                transition-delay: 0ms;
                will-change: transform, opacity;
            }

            .${NAME}-pie-item::before {
                content: '';
                display: none;
            }

            .${NAME}-pie-item::after {
                content: '';
                display: none;
            }

            #${NAME}-prefs.is-pie-open .${NAME}-pie-item {
                opacity: 1;
                pointer-events: auto;
                transform: translate3d(calc(var(--pie-shift-x, 0px) + var(--pie-x, 0px)), calc(var(--pie-shift-y, 0px) + var(--pie-y, 0px)), 0) scale(1);
                transition-delay: var(--pie-delay, 0ms);
            }

            .${NAME}-pie-item:hover::before,
            .${NAME}-pie-item:focus-visible::before,
            .${NAME}-pie-item.is-active::before {
                display: none;
            }

            .${NAME}-pie-item:hover::after,
            .${NAME}-pie-item:focus-visible::after,
            .${NAME}-pie-item.is-active::after,
            .${NAME}-pie-item.is-enabled::after {
                display: none;
            }

            .${NAME}-pie-item:hover,
            .${NAME}-pie-item:focus-visible,
            .${NAME}-pie-item.is-active {
                outline: none;
                color: var(--rail-text);
                background: transparent;
                border-color: transparent;
                box-shadow: none;
                transform: translate3d(calc(var(--pie-shift-x, 0px) + var(--pie-x, 0px)), calc(var(--pie-shift-y, 0px) + var(--pie-y, 0px)), 0) scale(1);
            }

            .${NAME}-pie-item.is-enabled:not(.is-active) {
                color: var(--rail-text);
                background: transparent;
                border-color: transparent;
                box-shadow: none;
            }

            .${NAME}-pie-item-icon {
                position: relative;
                z-index: 1;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 20px;
                height: 20px;
                transition: filter 170ms ease, transform 220ms var(--pie-ease-out);
            }

            .${NAME}-pie-item:hover .${NAME}-pie-item-icon,
            .${NAME}-pie-item:focus-visible .${NAME}-pie-item-icon,
            .${NAME}-pie-item.is-active .${NAME}-pie-item-icon {
                filter: brightness(1.12) drop-shadow(0 2px 5px rgba(0, 0, 0, .42));
                transform: scale(1.1);
            }

            .${NAME}-pie-item-label {
                position: absolute;
                z-index: 4;
                left: 50%;
                top: calc(100% + 8px);
                max-width: 88px;
                padding: 4px 8px;
                border: 1px solid var(--rail-line);
                border-radius: 8px;
                color: var(--text);
                background: var(--rail-bg);
                box-shadow: 0 14px 36px rgba(0, 0, 0, .28);
                font-size: 11px;
                font-weight: 760;
                white-space: nowrap;
                opacity: 0;
                pointer-events: none;
                transform: translate(-50%, -3px);
                backdrop-filter: blur(16px) saturate(1.35);
                -webkit-backdrop-filter: blur(16px) saturate(1.35);
                transition: opacity 140ms ease, transform 140ms ease;
            }

            .${NAME}-pie-item:hover .${NAME}-pie-item-label,
            .${NAME}-pie-item:focus-visible .${NAME}-pie-item-label {
                opacity: 1;
                transform: translate(-50%, 0);
            }

            .${NAME}-pie-dot {
                width: 8px;
                height: 8px;
                border-radius: 999px;
                background: currentColor;
                box-shadow:
                    -8px 0 0 rgba(255, 255, 255, .72),
                    8px 0 0 rgba(255, 255, 255, .72);
            }

            .${NAME}-pie-drawer-icon,
            .${NAME}-pie-settings-icon,
            .${NAME}-pie-queue-icon,
            .${NAME}-pie-topics-icon,
            .${NAME}-pie-live-icon,
            .${NAME}-pie-recent-icon,
            .${NAME}-pie-nav-icon,
            .${NAME}-pie-rules-icon,
            .${NAME}-pie-mode-icon,
            .${NAME}-pie-data-icon {
                position: relative;
                width: 20px;
                height: 20px;
                display: block;
                filter: drop-shadow(0 1px 1px rgba(0, 0, 0, .22));
            }

            .${NAME}-pie-drawer-icon::before {
                content: '';
                position: absolute;
                left: 2px;
                top: 4px;
                width: 14px;
                height: 11px;
                border: 2px solid currentColor;
                border-radius: 4px;
                box-sizing: border-box;
            }

            .${NAME}-pie-drawer-icon::after {
                content: '';
                position: absolute;
                left: 6px;
                top: 7px;
                width: 7px;
                height: 2px;
                border-radius: 999px;
                background: currentColor;
                box-shadow: 0 3px 0 currentColor;
                opacity: .9;
            }

            .${NAME}-pie-drawer-icon span {
                position: absolute;
                left: 4px;
                top: 6px;
                width: 3px;
                height: 8px;
                border-radius: 3px;
                background: currentColor;
                opacity: .34;
            }

            .${NAME}-pie-settings-icon::before {
                content: '';
                position: absolute;
                inset: 3px;
                border: 2px solid currentColor;
                border-radius: 999px;
            }

            .${NAME}-pie-settings-icon::after {
                content: '';
                position: absolute;
                left: 50%;
                top: 50%;
                width: 4px;
                height: 4px;
                border-radius: 999px;
                background: currentColor;
                transform: translate(-50%, -50%);
            }

            .${NAME}-pie-settings-icon span {
                position: absolute;
                left: 8px;
                top: 2px;
                width: 2px;
                height: 4px;
                border-radius: 999px;
                background: currentColor;
                opacity: .86;
                transform-origin: 1px 7px;
            }

            .${NAME}-pie-settings-icon span:nth-child(2) {
                transform: rotate(120deg);
            }

            .${NAME}-pie-settings-icon span:nth-child(3) {
                transform: rotate(240deg);
            }

            .${NAME}-pie-item:hover .${NAME}-pie-settings-icon,
            .${NAME}-pie-item:focus-visible .${NAME}-pie-settings-icon,
            .${NAME}-pie-item.is-active .${NAME}-pie-settings-icon {
                animation: ${NAME}-gear-turn 820ms cubic-bezier(.2, .8, .2, 1);
            }

            .${NAME}-pie-queue-icon span {
                position: absolute;
                left: 4px;
                width: 12px;
                height: 2px;
                border-radius: 999px;
                background: currentColor;
                box-shadow: inset 0 -1px 0 rgba(0, 0, 0, .08);
            }

            .${NAME}-pie-queue-icon span:nth-child(1) {
                top: 3px;
            }

            .${NAME}-pie-queue-icon span:nth-child(2) {
                top: 8px;
                width: 10px;
            }

            .${NAME}-pie-queue-icon span:nth-child(3) {
                top: 13px;
                width: 8px;
            }

            .${NAME}-pie-topics-icon::before {
                content: '';
                position: absolute;
                left: 5px;
                top: 2px;
                width: 10px;
                height: 14px;
                border-radius: 4px 4px 5px 5px;
                background: currentColor;
                transform: rotate(8deg);
                box-shadow: -4px 2px 0 currentColor;
                opacity: .92;
            }

            .${NAME}-pie-topics-icon::after {
                content: '';
                position: absolute;
                left: 8px;
                top: 6px;
                width: 5px;
                height: 2px;
                border-radius: 999px;
                background: var(--rail-button);
                box-shadow: 0 4px 0 var(--rail-button);
                transform: rotate(8deg);
                opacity: .72;
            }

            .${NAME}-pie-topics-icon span {
                position: absolute;
                right: 4px;
                bottom: 2px;
                width: 6px;
                height: 6px;
                border-radius: 999px;
                background: var(--badge);
                box-shadow: 0 0 0 2px var(--rail-button);
            }

            .${NAME}-pie-nav-icon::before {
                content: '';
                position: absolute;
                left: 3px;
                top: 4px;
                width: 14px;
                height: 12px;
                border: 2px solid currentColor;
                border-radius: 4px;
                box-sizing: border-box;
            }

            .${NAME}-pie-nav-icon::after {
                content: '';
                position: absolute;
                left: 6px;
                top: 8px;
                width: 8px;
                height: 2px;
                border-radius: 999px;
                background: currentColor;
                box-shadow: 0 4px 0 currentColor;
                opacity: .86;
            }

            .${NAME}-pie-nav-icon span {
                position: absolute;
                right: 2px;
                top: 2px;
                width: 5px;
                height: 5px;
                border-radius: 999px;
                background: var(--badge);
                box-shadow: 0 0 0 2px var(--pie-disc-bg);
            }

            .${NAME}-pie-rules-icon::before {
                content: '';
                position: absolute;
                left: 3px;
                top: 3px;
                width: 14px;
                height: 9px;
                background: currentColor;
                clip-path: polygon(0 0, 100% 0, 62% 100%, 38% 100%);
                opacity: .92;
            }

            .${NAME}-pie-rules-icon::after {
                content: '';
                position: absolute;
                left: 8px;
                top: 10px;
                width: 4px;
                height: 6px;
                border-radius: 0 0 3px 3px;
                background: currentColor;
            }

            .${NAME}-pie-rules-icon span {
                position: absolute;
                left: 7px;
                top: 15px;
                width: 6px;
                height: 2px;
                border-radius: 999px;
                background: currentColor;
                opacity: .74;
            }

            .${NAME}-pie-mode-icon::before,
            .${NAME}-pie-mode-icon::after {
                content: '';
                position: absolute;
                top: 4px;
                width: 8px;
                height: 12px;
                border: 2px solid currentColor;
                box-sizing: border-box;
            }

            .${NAME}-pie-mode-icon::before {
                left: 2px;
                border-radius: 4px 1px 1px 4px;
            }

            .${NAME}-pie-mode-icon::after {
                right: 2px;
                border-left: 0;
                border-radius: 1px 4px 4px 1px;
                opacity: .72;
            }

            .${NAME}-pie-mode-icon span {
                position: absolute;
                left: 9px;
                top: 6px;
                width: 2px;
                height: 8px;
                border-radius: 999px;
                background: currentColor;
                opacity: .9;
            }

            .${NAME}-pie-data-icon::before {
                content: '';
                position: absolute;
                left: 4px;
                top: 3px;
                width: 12px;
                height: 6px;
                border: 2px solid currentColor;
                border-radius: 999px;
                box-sizing: border-box;
            }

            .${NAME}-pie-data-icon::after {
                content: '';
                position: absolute;
                left: 4px;
                top: 6px;
                width: 12px;
                height: 10px;
                border: 2px solid currentColor;
                border-top: 0;
                border-radius: 0 0 6px 6px;
                box-sizing: border-box;
            }

            .${NAME}-pie-data-icon span {
                position: absolute;
                left: 6px;
                top: 10px;
                width: 8px;
                height: 2px;
                border-radius: 999px;
                background: currentColor;
                opacity: .7;
                box-shadow: 0 4px 0 currentColor;
            }

            .${NAME}-pie-live-icon::before {
                content: '';
                position: absolute;
                left: 7px;
                top: 7px;
                width: 5px;
                height: 5px;
                border-radius: 999px;
                background: currentColor;
                box-shadow: 0 0 0 4px rgba(99, 133, 239, .14);
            }

            .${NAME}-pie-live-icon::after,
            .${NAME}-pie-live-icon span {
                content: '';
                position: absolute;
                inset: 2px;
                border: 2px solid currentColor;
                border-left-color: transparent;
                border-bottom-color: transparent;
                border-radius: 999px;
                transform: rotate(-28deg);
            }

            .${NAME}-pie-live-icon span:nth-child(1) {
                inset: 5px;
                opacity: .72;
            }

            .${NAME}-pie-live-icon span:nth-child(2) {
                inset: 0;
                opacity: .34;
            }

            .${NAME}-pie-recent-icon::before {
                content: '';
                position: absolute;
                left: 3px;
                top: 3px;
                width: 14px;
                height: 14px;
                border: 2px solid currentColor;
                border-radius: 999px;
                box-sizing: border-box;
            }

            .${NAME}-pie-recent-icon::after {
                content: '';
                position: absolute;
                left: 9px;
                top: 6px;
                width: 2px;
                height: 6px;
                border-radius: 999px;
                background: currentColor;
                transform-origin: 1px 4px;
                transform: rotate(0deg);
                box-shadow: 3px 4px 0 -1px currentColor;
            }

            .${NAME}-pie-recent-icon span:nth-child(1) {
                position: absolute;
                left: 1px;
                top: 8px;
                width: 5px;
                height: 5px;
                border-left: 2px solid currentColor;
                border-bottom: 2px solid currentColor;
                transform: rotate(45deg);
            }

            .${NAME}-pie-recent-icon span:nth-child(2) {
                position: absolute;
                left: 1px;
                top: 9px;
                width: 5px;
                height: 2px;
                border-radius: 999px;
                background: currentColor;
            }

            .${NAME}-live-count {
                position: absolute;
                right: -6px;
                top: -6px;
                min-width: 16px;
                height: 16px;
                border: 2px solid var(--rail-bg);
                border-radius: 999px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0 4px;
                color: #fff;
                background: var(--badge);
                font-size: 10px;
                font-weight: 850;
                line-height: 12px;
            }

            @keyframes ${NAME}-gear-turn {
                0% { transform: rotate(0deg) scale(1); }
                55% { transform: rotate(260deg) scale(1.06); }
                100% { transform: rotate(360deg) scale(1); }
            }

            #${NAME}-prefs.is-dragging,
            #${NAME}-prefs.is-dragging .${NAME}-pref-button {
                cursor: grabbing;
            }

            #${NAME}-prefs.is-dragging .${NAME}-pref-button {
                transform: scale(1.04);
                color: var(--rail-text);
                background: var(--rail-button-active);
                box-shadow: 0 14px 36px rgba(0, 0, 0, .28), inset 0 0 0 1px var(--active-border);
            }

            #${NAME}-prefs .${NAME}-settings {
                position: absolute;
                top: auto;
                right: 0;
                bottom: 58px;
                z-index: 1;
                box-shadow: 0 18px 48px rgba(0, 0, 0, .3);
                transform-origin: right bottom;
            }

            #${NAME}-prefs .${NAME}-live-panel {
                position: absolute;
                right: 0;
                bottom: 58px;
                z-index: 2;
                width: min(380px, calc(100vw - 24px));
                max-height: min(560px, calc(100dvh - 80px));
                overflow: hidden;
                border: 1px solid var(--line);
                border-radius: 8px;
                color: var(--text);
                background: var(--bg);
                box-shadow: 0 18px 48px rgba(0, 0, 0, .32);
                opacity: 0;
                pointer-events: none;
                transform: translateY(-8px) scale(.98);
                transform-origin: right bottom;
                transition: opacity 150ms ease, transform 170ms cubic-bezier(.22, 1, .36, 1);
            }

            #${NAME}-prefs .${NAME}-live-panel.is-open {
                opacity: 1;
                pointer-events: auto;
                transform: translateY(0) scale(1);
            }

            #${NAME}-prefs.is-panel-left .${NAME}-settings {
                left: 0;
                right: auto;
                transform-origin: left bottom;
            }

            #${NAME}-prefs.is-panel-left .${NAME}-live-panel {
                left: 0;
                right: auto;
                transform-origin: left bottom;
            }

            #${NAME}-prefs.is-panel-below .${NAME}-settings {
                top: 58px;
                bottom: auto;
                transform-origin: right top;
            }

            #${NAME}-prefs.is-panel-below .${NAME}-live-panel {
                top: 58px;
                bottom: auto;
                transform-origin: right top;
            }

            #${NAME}-prefs.is-panel-left.is-panel-below .${NAME}-settings {
                transform-origin: left top;
            }

            #${NAME}-prefs.is-panel-left.is-panel-below .${NAME}-live-panel {
                transform-origin: left top;
            }

            #${NAME}-prefs.is-light .${NAME}-settings {
                box-shadow: 0 18px 44px rgba(24, 33, 52, .18);
            }

            #${NAME}-prefs.is-light .${NAME}-live-panel {
                box-shadow: 0 18px 44px rgba(24, 33, 52, .18);
            }

            .${NAME}-compact-title {
                margin-top: 10px;
            }

            .${NAME}-brand-eye {
                position: relative;
                width: 22px;
                height: 14px;
                border: 2px solid currentColor;
                border-radius: 999px / 78%;
                transform: rotate(-8deg);
            }

            .${NAME}-brand-eye::after {
                content: '';
                position: absolute;
                left: 50%;
                top: 50%;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: currentColor;
                transform: translate(-50%, -50%);
            }

            #${NAME}-shade {
                position: fixed;
                inset: 0;
                z-index: 100001;
                background: rgba(8, 10, 18, .18);
                opacity: 0;
                pointer-events: none;
                transition: opacity 180ms ease;
            }

            #${NAME}-shade.is-open {
                opacity: 1;
                pointer-events: auto;
            }

            #${NAME}-drawer-sidebar {
                --bg: rgba(18, 20, 29, .98);
                --panel: rgba(30, 33, 45, .96);
                --panel2: rgba(39, 43, 58, .94);
                --text: #eef1f7;
                --muted: #a0a7ba;
                --weak: #6f778b;
                --line: rgba(255, 255, 255, .1);
                --blue: #6385ef;
                --green: #56b8aa;
                --bad: #e36f86;
                --rail-bg: var(--bg);
                --rail-line: var(--line);
                --rail-text: var(--text);
                --rail-muted: var(--muted);
                --rail-button: var(--panel2);
                --rail-button-hover: rgba(99, 133, 239, .14);
                --rail-button-active: rgba(99, 133, 239, .18);
                --panel-bg: var(--panel);
                --button-bg: transparent;
                --button-hover: rgba(99, 133, 239, .14);
                --active-bg: rgba(99, 133, 239, .16);
                --active-border: rgba(99, 133, 239, .42);
                --active-text: var(--text);
                --soft-bg: rgba(125, 136, 158, .16);
                --badge: var(--green);
                position: absolute;
                left: calc(-1 * var(--sidebar-rail-offset, 56px));
                top: 50%;
                z-index: 12;
                width: var(--sidebar-rail-width, 48px);
                min-height: 0;
                max-height: calc(100% - 24px);
                display: none;
                transform: translateY(-50%);
                overflow: visible;
                color: var(--text);
                font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
            }

            #${NAME}-drawer-sidebar.is-open {
                display: block;
            }

            #${NAME}-drawer-sidebar.is-panel-open {
                width: var(--sidebar-rail-width, 48px);
            }

            #${NAME}-drawer-sidebar.is-light {
                --bg: rgba(250, 251, 254, .98);
                --panel: rgba(244, 247, 252, .98);
                --panel2: rgba(255, 255, 255, .98);
                --text: #202636;
                --muted: #596276;
                --weak: #8992a4;
                --line: rgba(24, 33, 52, .12);
                --soft-bg: rgba(125, 136, 158, .16);
            }

            .${NAME}-sidebar-rail {
                min-width: 0;
                width: var(--sidebar-rail-width, 48px);
                max-height: min(480px, calc(min(var(--peek-height, 100dvh), 100dvh) - 92px));
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 5px;
                padding: 6px;
                border: 1px solid var(--rail-line);
                border-radius: 18px;
                background: var(--rail-bg);
                box-shadow: 0 14px 36px rgba(0, 0, 0, .28);
                backdrop-filter: blur(14px);
                position: relative;
                overflow: visible;
            }

            .${NAME}-sidebar-tool-stack {
                position: relative;
                z-index: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                max-height: min(360px, calc(min(var(--peek-height, 100dvh), 100dvh) - 154px));
                overflow-y: auto;
                overflow-x: hidden;
                overscroll-behavior: contain;
                scrollbar-width: none;
            }

            .${NAME}-sidebar-tool-stack::-webkit-scrollbar {
                display: none;
            }

            .${NAME}-sidebar-tool {
                appearance: none;
                position: relative;
                width: 32px;
                height: 32px;
                border: 0;
                border-radius: 8px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: var(--rail-muted);
                background: var(--rail-button);
                cursor: pointer;
                font: inherit;
                font-weight: 850;
                line-height: 1;
                box-shadow: none;
                transition: background 130ms ease, border-color 130ms ease, color 130ms ease, transform 130ms ease;
            }

            .${NAME}-sidebar-dock-scroll {
                width: 30px;
                height: 22px;
                flex: 0 0 auto;
                border-radius: 999px;
                opacity: .84;
            }

            .${NAME}-sidebar-tool:hover {
                color: var(--rail-text);
                background: var(--rail-button-hover);
                transform: translateX(1px) scale(1.04);
            }

            .${NAME}-sidebar-tool.is-active {
                color: var(--rail-text);
                background: var(--rail-button-active);
                box-shadow: inset 0 0 0 1px var(--active-border);
            }

            .${NAME}-sidebar-tool:disabled {
                cursor: default;
                opacity: .48;
            }

            .${NAME}-sidebar-tool:disabled:hover {
                color: var(--rail-muted);
                background: var(--rail-button);
                transform: none;
            }

            .${NAME}-sidebar-tool-icon {
                position: relative;
                width: 18px;
                height: 18px;
                display: block;
                color: currentColor;
                pointer-events: none;
            }

            .${NAME}-sidebar-tool-icon::before,
            .${NAME}-sidebar-tool-icon::after {
                box-sizing: border-box;
            }

            .${NAME}-sidebar-icon-dock-up::before,
            .${NAME}-sidebar-icon-dock-down::before {
                content: "";
                position: absolute;
                width: 9px;
                height: 9px;
                border-color: currentColor;
                border-style: solid;
            }

            .${NAME}-sidebar-icon-dock-up::before {
                left: 4px;
                top: 6px;
                border-width: 2px 0 0 2px;
                transform: rotate(45deg);
            }

            .${NAME}-sidebar-icon-dock-down::before {
                left: 4px;
                top: 2px;
                border-width: 0 2px 2px 0;
                transform: rotate(45deg);
            }

            .${NAME}-sidebar-icon-queue::before {
                content: "";
                position: absolute;
                left: 6px;
                top: 4px;
                width: 10px;
                height: 2px;
                border-radius: 999px;
                background: currentColor;
                box-shadow: 0 5px 0 currentColor, 0 10px 0 currentColor;
            }

            .${NAME}-sidebar-icon-queue::after {
                content: "";
                position: absolute;
                left: 2px;
                top: 4px;
                width: 2px;
                height: 2px;
                border-radius: 999px;
                background: currentColor;
                box-shadow: 0 5px 0 currentColor, 0 10px 0 currentColor;
            }

            .${NAME}-sidebar-icon-nav::before,
            .${NAME}-sidebar-icon-nav::after {
                content: "";
                position: absolute;
                border: 2px solid currentColor;
                border-radius: 4px;
            }

            .${NAME}-sidebar-icon-nav::before {
                left: 3px;
                top: 6px;
                width: 12px;
                height: 9px;
                background: transparent;
            }

            .${NAME}-sidebar-icon-nav::after {
                left: 6px;
                top: 3px;
                width: 9px;
                height: 7px;
                border-bottom: 0;
                opacity: .7;
            }

            .${NAME}-sidebar-icon-tools::before {
                content: "";
                position: absolute;
                left: 4px;
                top: 4px;
                width: 4px;
                height: 4px;
                border-radius: 2px;
                background: currentColor;
                box-shadow: 7px 0 0 currentColor, 0 7px 0 currentColor, 7px 7px 0 currentColor;
            }

            .${NAME}-sidebar-icon-width::before,
            .${NAME}-sidebar-icon-width::after {
                content: "";
                position: absolute;
                left: 3px;
                right: 3px;
                border-color: currentColor;
                border-style: solid;
            }

            .${NAME}-sidebar-icon-width::before {
                top: 4px;
                height: 10px;
                border-width: 2px 0;
            }

            .${NAME}-sidebar-icon-width::after {
                top: 8px;
                height: 2px;
                border-width: 0 2px;
            }

            .${NAME}-sidebar-icon-settings::before,
            .${NAME}-sidebar-icon-reload::before,
            .${NAME}-sidebar-icon-open::before,
            .${NAME}-sidebar-icon-favorite::before,
            .${NAME}-sidebar-icon-support::before,
            .${NAME}-sidebar-icon-close::before {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI Symbol", "Segoe UI", sans-serif;
                font-weight: 500;
                line-height: 1;
            }

            .${NAME}-sidebar-icon-settings::before {
                content: "⚙";
                font-size: 16px;
            }

            .${NAME}-sidebar-icon-reload::before {
                content: "↻";
                font-size: 18px;
            }

            .${NAME}-sidebar-icon-open::before {
                content: "↗";
                font-size: 18px;
            }

            .${NAME}-sidebar-icon-favorite::before {
                content: "★";
                font-size: 17px;
                font-weight: 850;
                transform: translateY(-1px);
            }

            .${NAME}-sidebar-icon-recent::before {
                content: "";
                position: absolute;
                inset: 2px;
                border: 2px solid currentColor;
                border-radius: 999px;
            }

            .${NAME}-sidebar-icon-recent::after {
                content: "";
                position: absolute;
                left: 9px;
                top: 4px;
                width: 5px;
                height: 7px;
                border-left: 2px solid currentColor;
                border-bottom: 2px solid currentColor;
                border-radius: 1px;
                transform: rotate(-28deg);
                transform-origin: left bottom;
            }

            .${NAME}-sidebar-icon-support::before {
                content: "♥";
                color: #fb7185;
                font-size: 18px;
                font-weight: 850;
                transform: translateY(-1px);
            }

            .${NAME}-sidebar-icon-live::before {
                content: "";
                position: absolute;
                left: 4px;
                top: 4px;
                width: 10px;
                height: 10px;
                border: 2px solid currentColor;
                border-radius: 999px;
                box-shadow: 0 0 0 3px rgba(86, 184, 170, .16);
            }

            .${NAME}-sidebar-icon-live::after {
                content: "";
                position: absolute;
                right: 3px;
                bottom: 3px;
                width: 5px;
                height: 5px;
                border-radius: 999px;
                background: var(--green);
            }

            .${NAME}-sidebar-icon-stats::before {
                content: "";
                position: absolute;
                left: 5px;
                bottom: 4px;
                width: 3px;
                height: 7px;
                border-radius: 2px 2px 0 0;
                background: currentColor;
                box-shadow: 5px -4px 0 currentColor, 10px -8px 0 currentColor;
            }

            .${NAME}-sidebar-icon-stats::after {
                content: "";
                position: absolute;
                left: 4px;
                bottom: 3px;
                width: 15px;
                height: 13px;
                border-left: 2px solid currentColor;
                border-bottom: 2px solid currentColor;
                border-radius: 0 0 0 3px;
                opacity: .45;
            }

            .${NAME}-sidebar-icon-close::before {
                content: "×";
                font-size: 23px;
                font-weight: 300;
            }

            .${NAME}-sidebar-tool-count {
                position: absolute;
                right: -6px;
                top: -6px;
                min-width: 16px;
                height: 16px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0 5px;
                border: 2px solid var(--rail-bg);
                border-radius: 999px;
                color: #fff;
                background: var(--badge);
                font-size: 10px;
                font-weight: 800;
                line-height: 12px;
            }

            .${NAME}-sidebar-panel {
                position: absolute;
                top: 50%;
                right: calc(100% + var(--sidebar-panel-gap, 8px));
                z-index: 4;
                width: var(--sidebar-panel-width, 240px);
                min-width: var(--sidebar-panel-width, 240px);
                max-height: min(420px, calc(100% - 16px));
                display: flex;
                flex-direction: column;
                overflow: hidden;
                opacity: 0;
                pointer-events: none;
                transform: translate(8px, -50%);
                border: 1px solid var(--line);
                border-radius: 8px;
                color: var(--text);
                background: var(--panel-bg);
                box-shadow: 0 18px 48px rgba(0, 0, 0, .34);
                transition: opacity 150ms ease, transform 170ms cubic-bezier(.22, 1, .36, 1);
            }

            #${NAME}-drawer-sidebar.is-panel-open .${NAME}-sidebar-panel {
                opacity: 1;
                pointer-events: auto;
                transform: translate(0, -50%);
            }

            #${NAME}-drawer-sidebar.is-settings-panel .${NAME}-sidebar-panel {
                width: var(--sidebar-settings-panel-width, 360px);
                min-width: var(--sidebar-settings-panel-width, 360px);
                height: min(560px, calc(min(var(--peek-height, 100dvh), 100dvh) - 32px));
                max-height: min(560px, calc(min(var(--peek-height, 100dvh), 100dvh) - 32px));
            }

            #${NAME}-drawer-sidebar.is-page-nav-panel .${NAME}-sidebar-panel {
                width: var(--sidebar-page-panel-width, var(--sidebar-panel-width, 280px));
                min-width: var(--sidebar-page-panel-width, var(--sidebar-panel-width, 280px));
            }

            #${NAME}-drawer-sidebar.is-live-panel .${NAME}-sidebar-panel {
                width: var(--sidebar-page-panel-width, var(--sidebar-panel-width, 280px));
                min-width: var(--sidebar-page-panel-width, var(--sidebar-panel-width, 280px));
            }

            #${NAME}-drawer-sidebar.is-support-panel .${NAME}-sidebar-panel {
                width: min(320px, var(--sidebar-page-panel-width, var(--sidebar-panel-width, 280px)));
                min-width: min(320px, var(--sidebar-page-panel-width, var(--sidebar-panel-width, 280px)));
            }

            .${NAME}-sidebar-panel-head {
                min-height: 42px;
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto auto;
                align-items: center;
                gap: 8px;
                padding: 0 12px;
                border-bottom: 1px solid var(--line);
                color: var(--text);
                background: var(--panel);
                position: relative;
                overflow: hidden;
            }

            .${NAME}-sidebar-panel-title {
                position: relative;
                z-index: 1;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 13px;
                font-weight: 750;
            }

            .${NAME}-sidebar-panel-count {
                position: relative;
                z-index: 1;
                min-width: 20px;
                height: 20px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0 6px;
                border-radius: 999px;
                color: var(--text);
                background: rgba(99, 133, 239, .2);
                font-size: 10px;
                font-weight: 850;
            }

            .${NAME}-sidebar-panel-head-actions {
                position: relative;
                z-index: 1;
                min-width: 0;
                display: inline-flex;
                align-items: center;
                justify-content: flex-end;
                gap: 6px;
            }

            .${NAME}-sidebar-panel-head-actions .${NAME}-sidebar-panel-clear {
                flex: 0 0 auto;
            }

            .${NAME}-sidebar-panel-icon-button {
                width: 28px;
                padding: 0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }

            .${NAME}-sidebar-panel-icon-button::before,
            .${NAME}-sidebar-panel-icon-button::after {
                content: "";
                position: absolute;
                box-sizing: border-box;
                pointer-events: none;
            }

            .${NAME}-sidebar-live-refresh::before {
                width: 13px;
                height: 13px;
                border: 2px solid currentColor;
                border-right-color: transparent;
                border-radius: 999px;
                transform: rotate(-28deg);
            }

            .${NAME}-sidebar-live-refresh::after {
                right: 7px;
                top: 6px;
                width: 5px;
                height: 5px;
                border-top: 2px solid currentColor;
                border-right: 2px solid currentColor;
                transform: rotate(28deg);
            }

            .${NAME}-sidebar-live-collapse::before,
            .${NAME}-sidebar-live-collapse::after {
                left: 8px;
                width: 12px;
                height: 2px;
                border-radius: 2px;
                background: currentColor;
            }

            .${NAME}-sidebar-live-collapse::before {
                top: 9px;
                transform: rotate(45deg);
            }

            .${NAME}-sidebar-live-collapse::after {
                top: 17px;
                transform: rotate(-45deg);
            }

            .${NAME}-sidebar-panel-actions {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 6px;
                padding: 8px 8px 0;
                border-bottom: 0;
                background: var(--panel-bg);
            }

            .${NAME}-sidebar-panel-clear {
                position: relative;
                z-index: 1;
                appearance: none;
                height: 26px;
                border: 1px solid var(--line);
                border-radius: 7px;
                padding: 0 8px;
                color: var(--muted);
                background: var(--panel2);
                cursor: pointer;
                font: inherit;
                font-size: 12px;
                font-weight: 750;
                white-space: nowrap;
            }

            .${NAME}-sidebar-panel-clear:hover {
                color: var(--text);
                border-color: rgba(99, 133, 239, .48);
                background: var(--button-hover);
            }

            .${NAME}-queue-keep-hint {
                color: var(--weak);
                font-size: 10px;
                line-height: 1.45;
            }

            .${NAME}-sidebar-queue-hint {
                padding: 7px 12px 0;
                background: var(--panel-bg);
            }

            .${NAME}-sidebar-queue-list {
                min-height: 0;
                overflow-y: auto;
                overflow-x: hidden;
                padding: 8px;
                scrollbar-width: thin;
                scrollbar-color: rgba(125, 136, 158, .5) transparent;
            }

            .${NAME}-sidebar-support-list {
                min-height: 0;
                overflow-y: auto;
                overflow-x: hidden;
                padding: 10px;
                scrollbar-width: thin;
                scrollbar-color: transparent transparent;
            }

            .${NAME}-sidebar-support-list:hover,
            .${NAME}-sidebar-support-list:focus-within {
                scrollbar-color: rgba(125, 136, 158, .52) transparent;
            }

            .${NAME}-sidebar-support-list::-webkit-scrollbar {
                width: 8px;
            }

            .${NAME}-sidebar-support-list::-webkit-scrollbar-track {
                background: transparent;
            }

            .${NAME}-sidebar-support-list::-webkit-scrollbar-thumb {
                border: 2px solid transparent;
                border-radius: 999px;
                background: transparent;
                background-clip: padding-box;
            }

            .${NAME}-sidebar-support-list:hover::-webkit-scrollbar-thumb,
            .${NAME}-sidebar-support-list:focus-within::-webkit-scrollbar-thumb {
                background-color: rgba(125, 136, 158, .52);
            }

            .${NAME}-sidebar-stats-list {
                min-height: 0;
                overflow-y: auto;
                overflow-x: hidden;
                padding: 8px;
                scrollbar-width: thin;
                scrollbar-color: rgba(125, 136, 158, .5) transparent;
            }

            .${NAME}-sidebar-stat-group + .${NAME}-sidebar-stat-group {
                margin-top: 10px;
            }

            .${NAME}-sidebar-stat-group-title {
                margin: 0 2px 6px;
                color: var(--weak);
                font-size: 10px;
                font-weight: 800;
                letter-spacing: 0;
            }

            .${NAME}-sidebar-stat-group-body {
                overflow: hidden;
                border: 1px solid var(--line);
                border-radius: 8px;
                background: var(--panel2);
            }

            .${NAME}-sidebar-stat-row {
                appearance: none;
                width: 100%;
                min-height: 34px;
                border: 0;
                border-radius: 0;
                display: grid;
                grid-template-columns: max-content minmax(0, 1fr);
                align-items: center;
                gap: 8px;
                padding: 6px 9px;
                color: var(--text);
                background: transparent;
                font: inherit;
                text-align: left;
            }

            .${NAME}-sidebar-stat-group-body > * + * {
                border-top: 1px solid var(--line);
            }

            .${NAME}-sidebar-stat-copyable {
                cursor: copy;
            }

            .${NAME}-sidebar-stat-copyable:hover {
                background: var(--button-hover);
            }

            .${NAME}-sidebar-stat-meter {
                padding: 7px 9px 8px;
            }

            .${NAME}-sidebar-stat-meter-head {
                min-width: 0;
                display: grid;
                grid-template-columns: max-content minmax(0, 1fr);
                align-items: center;
                gap: 8px;
            }

            .${NAME}-sidebar-stat-meter-track {
                height: 5px;
                margin-top: 6px;
                overflow: hidden;
                border-radius: 999px;
                background: var(--soft-bg);
            }

            .${NAME}-sidebar-stat-meter-fill {
                display: block;
                width: 0;
                height: 100%;
                border-radius: inherit;
                background: linear-gradient(90deg, var(--badge), var(--green));
            }

            .${NAME}-sidebar-stat-meter-warn .${NAME}-sidebar-stat-meter-fill {
                background: linear-gradient(90deg, #f97316, #ef4444);
            }

            .${NAME}-sidebar-stat-label {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 12px;
                color: var(--muted);
            }

            .${NAME}-sidebar-stat-value {
                min-width: 0;
                overflow-wrap: anywhere;
                word-break: break-word;
                white-space: normal;
                font-size: 12px;
                font-weight: 700;
                font-variant-numeric: tabular-nums;
                text-align: right;
            }

            .${NAME}-sidebar-stat-warn {
                color: #ef4444;
            }

            .${NAME}-support-list {
                display: grid;
                gap: 8px;
            }

            .${NAME}-support-card {
                min-width: 0;
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                align-items: center;
                gap: 10px;
                padding: 10px;
                border: 1px solid var(--line);
                border-radius: 8px;
                color: var(--text);
                background: var(--panel2);
                text-decoration: none;
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
            }

            .${NAME}-support-card:hover {
                border-color: rgba(99, 133, 239, .5);
                background: var(--button-hover);
            }

            .${NAME}-support-card-copy,
            .${NAME}-support-card-side {
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 3px;
            }

            .${NAME}-support-card-side {
                align-items: flex-end;
            }

            .${NAME}-support-card-title {
                color: var(--text);
                font-size: 13px;
                font-weight: 850;
                line-height: 1.25;
            }

            .${NAME}-support-card-desc {
                color: var(--weak);
                font-size: 11px;
                font-weight: 650;
                line-height: 1.35;
            }

            .${NAME}-support-card-amount {
                min-width: 52px;
                height: 22px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0 8px;
                border-radius: 999px;
                color: #fff;
                background: #2563eb;
                font-size: 11px;
                font-weight: 850;
                white-space: nowrap;
            }

            .${NAME}-support-card-open {
                color: var(--muted);
                font-size: 10px;
                font-weight: 800;
                line-height: 1.2;
            }

            .${NAME}-sidebar-queue-row {
                display: grid;
                grid-template-columns: minmax(0, 1fr) 28px;
                gap: 4px;
                align-items: stretch;
            }

            .${NAME}-sidebar-page-row {
                grid-template-columns: minmax(0, 1fr) 28px 28px 28px;
            }

            .${NAME}-sidebar-recent-row {
                grid-template-columns: minmax(0, 1fr);
            }

            .${NAME}-sidebar-queue-row + .${NAME}-sidebar-queue-row {
                margin-top: 4px;
            }

            .${NAME}-sidebar-queue-item {
                appearance: none;
                min-width: 0;
                min-height: 36px;
                border: 1px solid transparent;
                border-radius: 7px;
                display: grid;
                grid-template-columns: 22px minmax(0, 1fr);
                align-items: center;
                gap: 7px;
                padding: 6px 8px;
                color: var(--text);
                background: var(--panel2);
                cursor: pointer;
                font: inherit;
                text-align: left;
            }

            .${NAME}-sidebar-queue-item:hover {
                border-color: rgba(99, 133, 239, .45);
                background: var(--button-hover);
            }

            .${NAME}-sidebar-queue-row.is-active .${NAME}-sidebar-queue-item {
                border-color: rgba(78, 180, 165, .58);
                background: rgba(78, 180, 165, .16);
            }

            .${NAME}-sidebar-queue-index {
                width: 22px;
                height: 22px;
                border-radius: 999px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: var(--muted);
                background: var(--soft-bg);
                font-size: 10px;
                font-weight: 850;
            }

            .${NAME}-sidebar-queue-row.is-active .${NAME}-sidebar-queue-index {
                color: #fff;
                background: var(--badge);
            }

            .${NAME}-sidebar-queue-title {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 12px;
                font-weight: 780;
            }

            .${NAME}-sidebar-topic-copy {
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .${NAME}-sidebar-topic-meta {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color: var(--weak);
                font-size: 10px;
                font-weight: 650;
                line-height: 1.2;
            }

            .${NAME}-sidebar-queue-row.is-active .${NAME}-sidebar-topic-meta {
                color: var(--green);
            }

            .${NAME}-sidebar-queue-remove {
                appearance: none;
                width: 28px;
                border: 1px solid var(--line);
                border-radius: 7px;
                color: var(--weak);
                background: var(--panel2);
                cursor: pointer;
                font: inherit;
                font-size: 16px;
                line-height: 1;
            }

            .${NAME}-sidebar-queue-remove:hover {
                color: var(--bad);
                border-color: rgba(227, 111, 134, .45);
                background: rgba(227, 111, 134, .12);
            }

            .${NAME}-sidebar-page-action {
                appearance: none;
                width: 28px;
                border: 1px solid var(--line);
                border-radius: 7px;
                color: var(--weak);
                background: var(--panel2);
                cursor: pointer;
                font: inherit;
                font-size: 14px;
                font-weight: 750;
                line-height: 1;
            }

            .${NAME}-sidebar-page-action:hover {
                color: var(--text);
                border-color: rgba(99, 133, 239, .45);
                background: rgba(99, 133, 239, .14);
            }

            .${NAME}-sidebar-empty {
                padding: 14px 8px;
                color: var(--weak);
                font-size: 12px;
                text-align: center;
            }

            .${NAME}-sidebar-frame-tools {
                min-height: 0;
                overflow-y: auto;
                overflow-x: hidden;
                padding: 8px;
                scrollbar-width: thin;
                scrollbar-color: rgba(125, 136, 158, .5) transparent;
            }

            .${NAME}-sidebar-frame-url {
                min-width: 0;
                margin-bottom: 6px;
                border: 1px solid var(--line);
                border-radius: 7px;
                padding: 7px 8px;
                color: var(--muted);
                background: rgba(125, 136, 158, .1);
                font-size: 11px;
                font-weight: 700;
                line-height: 1.35;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .${NAME}-sidebar-frame-action {
                appearance: none;
                width: 100%;
                min-height: 40px;
                border: 1px solid transparent;
                border-radius: 7px;
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                align-items: center;
                gap: 8px;
                padding: 7px 9px;
                color: var(--text);
                background: var(--panel2);
                cursor: pointer;
                font: inherit;
                text-align: left;
            }

            .${NAME}-sidebar-frame-action + .${NAME}-sidebar-frame-action {
                margin-top: 5px;
            }

            .${NAME}-sidebar-frame-action:hover {
                border-color: rgba(99, 133, 239, .45);
                background: var(--button-hover);
            }

            .${NAME}-sidebar-width-preset.is-active {
                border-color: var(--active-border);
                background: var(--active-bg);
            }

            .${NAME}-sidebar-width-preset.is-active .${NAME}-sidebar-frame-label {
                color: var(--active-text);
            }

            .${NAME}-sidebar-frame-label,
            .${NAME}-sidebar-frame-desc {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .${NAME}-sidebar-frame-label {
                font-size: 12px;
                font-weight: 820;
            }

            .${NAME}-sidebar-frame-desc {
                color: var(--weak);
                font-size: 10px;
                font-weight: 750;
            }

            #${NAME}-drawer {
                --bg: rgba(18, 20, 29, .98);
                --panel: rgba(30, 33, 45, .94);
                --panel2: rgba(39, 43, 58, .92);
                --text: #eef1f7;
                --muted: #a0a7ba;
                --weak: #6f778b;
                --line: rgba(255, 255, 255, .09);
                --blue: #6385ef;
                --green: #56b8aa;
                --bad: #e36f86;
                --drawer-gap: 12px;
                --drawer-radius: 12px;
                --drawer-left-reserve: 76px;
                --sidebar-rail-width: 48px;
                --sidebar-rail-offset: 56px;
                --sidebar-panel-gap: 8px;
                position: fixed;
                top: max(var(--drawer-gap), var(--peek-top, 0px));
                right: var(--drawer-gap);
                z-index: 100002;
                width: min(var(--peek-width, 760px), calc(100vw - var(--drawer-gap) - var(--drawer-left-reserve)));
                height: min(var(--peek-height, 100dvh), calc(100dvh - var(--drawer-gap) - var(--drawer-gap)));
                display: flex;
                flex-direction: column;
                overflow: visible;
                color: var(--text);
                background: var(--bg);
                border: 1px solid var(--line);
                border-radius: var(--drawer-radius);
                box-shadow: 0 22px 64px rgba(0, 0, 0, .44);
                font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
                transform: translateX(calc(100% + var(--drawer-gap) + 12px));
                transition: transform 240ms cubic-bezier(.22, 1, .36, 1);
            }

            #${NAME}-drawer.is-open {
                transform: translateX(0);
            }

            #${NAME}-drawer:focus {
                outline: none;
            }

            #${NAME}-drawer.is-light {
                --bg: rgba(250, 251, 254, .98);
                --panel: rgba(244, 247, 252, .96);
                --panel2: rgba(255, 255, 255, .96);
                --text: #202636;
                --muted: #596276;
                --weak: #8992a4;
                --line: rgba(24, 33, 52, .11);
                box-shadow: 0 22px 58px rgba(24, 33, 52, .18);
            }

            .${NAME}-drawer-main {
                position: relative;
                z-index: 1;
                min-height: 0;
                flex: 1 1 auto;
                display: flex;
                overflow: visible;
                background: var(--bg);
            }

            .${NAME}-head {
                position: relative;
                z-index: 20;
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                gap: 12px;
                align-items: center;
                min-height: 68px;
                padding: 12px 14px;
                color: #fff;
                background: linear-gradient(135deg, #5876da 0%, #4666c4 54%, #48aa9c 100%);
                border-radius: calc(var(--drawer-radius) - 1px) calc(var(--drawer-radius) - 1px) 0 0;
                overflow: hidden;
            }

            .${NAME}-head::after {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(180deg, rgba(255, 255, 255, .16), transparent);
                pointer-events: none;
            }

            .${NAME}-brand,
            .${NAME}-tools {
                position: relative;
                z-index: 1;
            }

            .${NAME}-brand {
                min-width: 0;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .${NAME}-brand-eye {
                width: 24px;
                height: 15px;
                flex: 0 0 auto;
            }

            .${NAME}-title-block {
                min-width: 0;
            }

            .${NAME}-title {
                font-size: 15px;
                line-height: 1.25;
                font-weight: 850;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .${NAME}-subtitle {
                margin-top: 2px;
                color: rgba(255, 255, 255, .72);
                font-size: 11px;
            }

            .${NAME}-tools {
                display: flex;
                flex-wrap: wrap;
                justify-content: flex-end;
                align-items: center;
                gap: 7px;
            }

            .${NAME}-switch {
                display: flex;
                align-items: center;
                padding: 3px;
                border-radius: 8px;
                background: rgba(0, 0, 0, .18);
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .12);
            }

            .${NAME}-switch button,
            .${NAME}-icon-btn,
            .${NAME}-pref-button,
            .${NAME}-setting,
            .${NAME}-favorite-item,
            .${NAME}-favorite-remove,
            .${NAME}-page-nav-action,
            .${NAME}-resume-button,
            .${NAME}-primary-btn,
            .${NAME}-soft-btn {
                appearance: none;
                font: inherit;
            }

            .${NAME}-switch button {
                min-width: 46px;
                height: 28px;
                border: 0;
                border-radius: 6px;
                color: rgba(255, 255, 255, .78);
                background: transparent;
                cursor: pointer;
                font-size: 12px;
                font-weight: 750;
            }

            .${NAME}-switch button.is-active {
                color: #1f2941;
                background: #fff;
            }

            .${NAME}-icon-btn {
                width: 32px;
                height: 32px;
                border: 0;
                border-radius: 8px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                background: rgba(255, 255, 255, .14);
                cursor: pointer;
            }

            .${NAME}-icon-btn:hover {
                background: rgba(255, 255, 255, .24);
            }

            .${NAME}-icon-btn.is-favorite-active {
                color: #ffe08a;
                background: rgba(255, 208, 95, .22);
            }

            .${NAME}-drawer-footer {
                position: relative;
                z-index: 20;
                flex: 0 0 auto;
                display: none;
                align-items: center;
                gap: 8px;
                padding: 7px 10px;
                border-top: 1px solid var(--line);
                border-radius: 0 0 calc(var(--drawer-radius) - 1px) calc(var(--drawer-radius) - 1px);
                color: var(--text);
                background: var(--bg);
            }

            .${NAME}-drawer-footer.is-visible {
                display: flex;
                width: 100%;
            }

            .${NAME}-drawer-track {
                min-width: 0;
                width: 100%;
                flex: 1 1 auto;
                display: none;
                flex-direction: column;
                gap: 4px;
            }

            .${NAME}-drawer-track.is-visible {
                display: flex;
            }

            .${NAME}-drawer-status {
                --track-progress: 0%;
                min-width: 0;
                min-height: 24px;
                width: 100%;
                display: none;
                align-items: center;
                gap: 7px;
                padding: 3px 8px;
                border: 1px solid rgba(125, 136, 158, .25);
                border-radius: 8px;
                color: var(--muted);
                background: rgba(125, 136, 158, .1);
                font-size: 11px;
                font-weight: 800;
                line-height: 1.35;
            }

            .${NAME}-drawer-status.is-visible {
                display: inline-flex;
            }

            .${NAME}-drawer-status-dot {
                width: 7px;
                height: 7px;
                flex: 0 0 7px;
                border-radius: 999px;
                background: currentColor;
                box-shadow: 0 0 0 3px rgba(125, 136, 158, .16);
            }

            .${NAME}-drawer-status-text {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .${NAME}-drawer-status.is-pending {
                color: #8fb1ff;
                border-color: rgba(99, 133, 239, .35);
                background: rgba(99, 133, 239, .13);
            }

            .${NAME}-drawer-status.is-sending {
                color: #a5b4fc;
                border-color: rgba(129, 140, 248, .42);
                background: rgba(99, 102, 241, .14);
            }

            .${NAME}-drawer-status.is-disabled {
                color: var(--muted);
                border-color: rgba(125, 136, 158, .25);
                background: rgba(125, 136, 158, .1);
            }

            .${NAME}-drawer-status.is-sent,
            .${NAME}-drawer-status.is-done {
                color: var(--green);
                border-color: rgba(78, 180, 165, .4);
                background: rgba(78, 180, 165, .13);
            }

            .${NAME}-drawer-status.is-error {
                color: var(--bad);
                border-color: rgba(244, 63, 94, .42);
                background: rgba(244, 63, 94, .13);
            }

            .${NAME}-drawer-track-bar {
                height: 3px;
                display: none;
                overflow: hidden;
                border-radius: 999px;
                background: rgba(125, 136, 158, .18);
            }

            .${NAME}-drawer-track.has-progress .${NAME}-drawer-track-bar {
                display: block;
            }

            .${NAME}-drawer-track-fill {
                display: block;
                width: 0;
                height: 100%;
                border-radius: inherit;
                background: linear-gradient(90deg, var(--blue), var(--green));
                transition: width 180ms linear;
            }

            .${NAME}-drawer-footer-actions {
                display: none;
                align-items: center;
                justify-content: flex-end;
                gap: 6px;
                margin-left: auto;
                flex: 0 0 auto;
            }

            .${NAME}-drawer-footer-actions.is-visible {
                display: inline-flex;
            }

            .${NAME}-drawer-footer-btn {
                appearance: none;
                position: relative;
                width: 28px;
                height: 28px;
                flex: 0 0 28px;
                border: 1px solid var(--line);
                border-radius: 7px;
                color: var(--muted);
                background: var(--panel2);
                cursor: pointer;
                font: inherit;
            }

            .${NAME}-drawer-footer-btn:hover:not(:disabled) {
                color: var(--text);
                border-color: rgba(99, 133, 239, .5);
                background: rgba(99, 133, 239, .14);
            }

            .${NAME}-drawer-footer-btn:disabled {
                cursor: default;
                opacity: .48;
            }

            .${NAME}-drawer-footer-scroll {
                width: auto;
                min-width: 92px;
                flex: 0 0 auto;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                padding: 0 9px;
                font-size: 11px;
                font-weight: 850;
                line-height: 1;
                white-space: nowrap;
            }

            .${NAME}-drawer-footer-scroll.is-running,
            .${NAME}-drawer-footer-scroll.is-paused {
                color: var(--text);
                border-color: rgba(99, 133, 239, .55);
                background: rgba(99, 133, 239, .14);
            }

            .${NAME}-drawer-footer-scroll.is-running {
                border-color: rgba(78, 180, 165, .58);
                background: rgba(78, 180, 165, .16);
            }

            .${NAME}-drawer-footer-scroll-icon {
                position: relative;
                width: 14px;
                height: 14px;
                flex: 0 0 14px;
                display: inline-block;
            }

            .${NAME}-drawer-footer-scroll-icon::before,
            .${NAME}-drawer-footer-scroll-icon::after {
                content: "";
                position: absolute;
                box-sizing: border-box;
            }

            .${NAME}-drawer-footer-scroll-icon::before {
                left: 4px;
                top: 2px;
                width: 0;
                height: 0;
                border-top: 5px solid transparent;
                border-bottom: 5px solid transparent;
                border-left: 7px solid currentColor;
            }

            .${NAME}-drawer-footer-scroll-icon::after {
                left: 2px;
                top: 11px;
                width: 10px;
                height: 2px;
                border-radius: 999px;
                background: currentColor;
                opacity: .42;
            }

            .${NAME}-drawer-footer-scroll.is-running .${NAME}-drawer-footer-scroll-icon::before,
            .${NAME}-drawer-footer-scroll.is-running .${NAME}-drawer-footer-scroll-icon::after {
                top: 2px;
                width: 3px;
                height: 10px;
                border: 0;
                border-radius: 2px;
                background: currentColor;
                opacity: 1;
            }

            .${NAME}-drawer-footer-scroll.is-running .${NAME}-drawer-footer-scroll-icon::before {
                left: 3px;
            }

            .${NAME}-drawer-footer-scroll.is-running .${NAME}-drawer-footer-scroll-icon::after {
                left: 8px;
            }

            .${NAME}-drawer-footer-scroll.is-paused .${NAME}-drawer-footer-scroll-icon::after {
                background: var(--bad);
                opacity: .78;
            }

            .${NAME}-drawer-footer-scroll-label {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .${NAME}-drawer-footer-scroll::before,
            .${NAME}-drawer-footer-scroll::after {
                display: none;
            }

            .${NAME}-drawer-footer-btn::before,
            .${NAME}-drawer-footer-btn::after {
                content: "";
                position: absolute;
                box-sizing: border-box;
                pointer-events: none;
            }

            .${NAME}-drawer-footer-copy::before {
                left: 8px;
                top: 8px;
                width: 10px;
                height: 10px;
                border: 2px solid currentColor;
                border-radius: 3px;
                background: transparent;
            }

            .${NAME}-drawer-footer-copy::after {
                left: 11px;
                top: 11px;
                width: 10px;
                height: 10px;
                border: 2px solid currentColor;
                border-radius: 3px;
                background: var(--panel2);
            }

            .${NAME}-drawer-footer-open::before {
                left: 8px;
                top: 10px;
                width: 10px;
                height: 10px;
                border: 2px solid currentColor;
                border-top: 0;
                border-right: 0;
                border-radius: 2px;
            }

            .${NAME}-drawer-footer-open::after {
                right: 8px;
                top: 7px;
                width: 9px;
                height: 9px;
                border-top: 2px solid currentColor;
                border-right: 2px solid currentColor;
                transform: rotate(0deg);
                box-shadow: 3px -3px 0 -2px currentColor;
            }

            .${NAME}-settings-gear,
            .${NAME}-close,
            .${NAME}-favorite-star {
                position: relative;
                display: block;
                width: 17px;
                height: 17px;
            }

            .${NAME}-favorite-star {
                width: auto;
                height: auto;
                font-size: 18px;
                line-height: 1;
                transform: translateY(-1px);
            }

            .${NAME}-settings-gear {
                border: 2px solid currentColor;
                border-radius: 50%;
                box-shadow:
                    0 -8px 0 -6px currentColor,
                    0 8px 0 -6px currentColor,
                    8px 0 0 -6px currentColor,
                    -8px 0 0 -6px currentColor,
                    5.6px 5.6px 0 -6px currentColor,
                    -5.6px 5.6px 0 -6px currentColor,
                    5.6px -5.6px 0 -6px currentColor,
                    -5.6px -5.6px 0 -6px currentColor;
            }

            .${NAME}-settings-gear::before {
                content: '';
                position: absolute;
                inset: 3px;
                border-radius: 50%;
                border: 2px solid currentColor;
            }

            .${NAME}-settings-gear::after {
                content: '';
                position: absolute;
                left: 50%;
                top: -5px;
                width: 2px;
                height: 23px;
                border-radius: 2px;
                background: currentColor;
                transform: translateX(-50%) rotate(45deg);
                box-shadow: 0 0 0 0 currentColor;
            }

            .${NAME}-close::before,
            .${NAME}-close::after {
                content: '';
                position: absolute;
                left: 7px;
                top: 1px;
                width: 2px;
                height: 14px;
                border-radius: 2px;
                background: currentColor;
            }

            .${NAME}-close::before {
                transform: rotate(45deg);
            }

            .${NAME}-close::after {
                transform: rotate(-45deg);
            }

            .${NAME}-settings {
                position: absolute;
                z-index: 30;
                top: 54px;
                right: 52px;
                width: min(340px, calc(100vw - 24px));
                max-height: min(560px, calc(100dvh - 80px));
                overflow-y: auto;
                overflow-x: hidden;
                padding: 10px;
                border: 1px solid rgba(255, 255, 255, .16);
                border-radius: 8px;
                color: var(--text);
                background: var(--bg);
                box-shadow: 0 18px 48px rgba(0, 0, 0, .32);
                opacity: 0;
                pointer-events: none;
                transform: translateY(-8px) scale(.98);
                transition: opacity 150ms ease, transform 170ms cubic-bezier(.22, 1, .36, 1);
            }

            .${NAME}-settings.is-open {
                opacity: 1;
                pointer-events: auto;
                transform: translateY(0) scale(1);
            }

            .${NAME}-floating-settings {
                width: min(420px, calc(100vw - 24px));
                overflow: hidden;
                padding: 8px;
            }

            .${NAME}-dock-settings {
                position: static;
                z-index: auto;
                width: 100%;
                height: 100%;
                max-height: none;
                min-height: 0;
                flex: 1 1 auto;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                padding: 8px;
                border: 0;
                border-radius: 0;
                background: transparent;
                box-shadow: none;
                opacity: 1;
                pointer-events: auto;
                transform: none;
                transition: none;
            }

            .${NAME}-dock-settings .${NAME}-prefs-head {
                flex: 0 0 auto;
                padding: 2px 2px 10px;
            }

            .${NAME}-dock-settings .${NAME}-pref-tab-strip {
                flex: 0 0 auto;
            }

            .${NAME}-dock-settings .${NAME}-pref-tab-panel {
                flex: 1 1 auto;
                min-height: 0;
                max-height: none;
            }

            .${NAME}-dock-settings .${NAME}-favorite-list {
                max-height: 150px;
            }

            .${NAME}-live-head {
                min-width: 0;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                padding: 12px 12px 8px;
                border-bottom: 1px solid var(--line);
            }

            .${NAME}-live-title {
                color: var(--text);
                font-size: 14px;
                font-weight: 850;
            }

            .${NAME}-live-actions {
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .${NAME}-live-icon {
                appearance: none;
                width: 28px;
                height: 28px;
                border: 1px solid var(--line);
                border-radius: 7px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: var(--muted);
                background: var(--panel2);
                font-size: 16px;
                line-height: 1;
                cursor: pointer;
            }

            .${NAME}-live-icon:hover {
                color: var(--text);
                background: var(--button-hover);
            }

            .${NAME}-live-status {
                padding: 8px 12px;
                border-bottom: 1px solid var(--line);
                color: var(--weak);
                font-size: 11px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .${NAME}-sidebar-live-status {
                white-space: normal;
                overflow: visible;
                text-overflow: clip;
                line-height: 1.35;
            }

            .${NAME}-live-list {
                max-height: min(456px, calc(100dvh - 170px));
                overflow-y: auto;
                padding: 8px;
                scrollbar-width: thin;
                scrollbar-color: rgba(125, 136, 158, .5) transparent;
            }

            .${NAME}-live-topic {
                appearance: none;
                width: 100%;
                border: 1px solid var(--line);
                border-radius: 8px;
                display: grid;
                gap: 4px;
                padding: 9px;
                color: var(--text);
                background: var(--panel2);
                text-align: left;
                cursor: pointer;
            }

            .${NAME}-live-topic + .${NAME}-live-topic {
                margin-top: 6px;
            }

            .${NAME}-live-topic:hover {
                border-color: rgba(99, 133, 239, .48);
                background: var(--button-hover);
            }

            .${NAME}-live-topic.is-unread {
                box-shadow: inset 3px 0 0 var(--green);
            }

            .${NAME}-recent-topic.is-active {
                border-color: var(--active-border);
                background: var(--active-bg);
                box-shadow: inset 3px 0 0 var(--blue);
            }

            .${NAME}-sidebar-live-topic.is-active {
                border-color: var(--active-border);
                background: var(--active-bg);
                box-shadow: inset 3px 0 0 var(--blue);
            }

            .${NAME}-live-topic-title {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 12px;
                font-weight: 800;
            }

            .${NAME}-live-topic-meta {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color: var(--muted);
                font-size: 10px;
                font-weight: 650;
            }

            .${NAME}-live-empty {
                padding: 24px 12px;
                color: var(--muted);
                text-align: center;
                font-size: 12px;
            }

            .${NAME}-prefs-head {
                padding: 10px 10px 12px;
                border-bottom: 1px solid var(--line);
                margin-bottom: 8px;
            }

            .${NAME}-prefs-title {
                color: var(--text);
                font-size: 14px;
                font-weight: 850;
                line-height: 1.25;
            }

            .${NAME}-prefs-title-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
            }

            .${NAME}-support-header {
                position: relative;
                flex: 0 0 auto;
                display: inline-flex;
            }

            .${NAME}-support-chip {
                appearance: none;
                flex: 0 0 auto;
                width: 28px;
                height: 28px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                border: 1px solid var(--line);
                border-radius: 8px;
                color: #fb7185;
                background: var(--button);
                box-shadow: none;
                cursor: pointer;
                font: inherit;
                font-weight: 850;
                line-height: 1;
                transition: background 130ms ease, border-color 130ms ease, color 130ms ease, transform 130ms ease;
            }

            .${NAME}-support-chip:hover,
            .${NAME}-support-chip[aria-expanded="true"] {
                color: #f43f5e;
                background: var(--button-hover);
                border-color: rgba(244, 63, 94, .36);
            }

            .${NAME}-support-chip-icon {
                font-size: 17px;
                line-height: 1;
                transform: translateY(-1px);
            }

            .${NAME}-support-popover {
                position: absolute;
                top: calc(100% + 8px);
                right: 0;
                z-index: 20;
                width: min(268px, calc(100vw - 48px));
                padding: 8px;
                border: 1px solid var(--line);
                border-radius: 8px;
                background: var(--panel);
                box-shadow: 0 16px 34px rgba(0, 0, 0, .22);
            }

            .${NAME}-support-popover[hidden] {
                display: none;
            }

            .${NAME}-support-popover .${NAME}-support-card {
                box-shadow: none;
            }

            .${NAME}-prefs-subtitle {
                margin-top: 3px;
                color: var(--weak);
                font-size: 11px;
                line-height: 1.35;
            }

            .${NAME}-pref-tab-strip {
                display: grid;
                grid-template-columns: 30px minmax(0, 1fr) 30px;
                gap: 5px;
                padding: 6px;
                border: 1px solid var(--line);
                border-radius: 8px;
                background: rgba(125, 136, 158, .08);
            }

            .${NAME}-pref-tabs {
                --ldpeek-tab-mask-start: #000 0;
                --ldpeek-tab-mask-end: #000 100%;
                min-width: 0;
                display: flex;
                align-items: center;
                gap: 5px;
                overflow-x: auto;
                overflow-y: hidden;
                overscroll-behavior-x: contain;
                scroll-behavior: smooth;
                scrollbar-width: none;
                -webkit-mask-image: linear-gradient(to right, var(--ldpeek-tab-mask-start), #000 18px, #000 calc(100% - 18px), var(--ldpeek-tab-mask-end));
                mask-image: linear-gradient(to right, var(--ldpeek-tab-mask-start), #000 18px, #000 calc(100% - 18px), var(--ldpeek-tab-mask-end));
            }

            .${NAME}-pref-tab-strip.is-scroll-left .${NAME}-pref-tabs {
                --ldpeek-tab-mask-start: transparent 0;
            }

            .${NAME}-pref-tab-strip.is-scroll-right .${NAME}-pref-tabs {
                --ldpeek-tab-mask-end: transparent 100%;
            }

            .${NAME}-pref-tabs::-webkit-scrollbar {
                display: none;
            }

            .${NAME}-pref-tab-scroll {
                appearance: none;
                width: 30px;
                height: 32px;
                border: 1px solid var(--line);
                border-radius: 7px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: var(--muted);
                background: var(--panel2);
                cursor: pointer;
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
                transition: color .16s ease, border-color .16s ease, background .16s ease, opacity .16s ease;
            }

            .${NAME}-pref-tab-icon {
                width: 18px;
                height: 18px;
                display: block;
                fill: none;
                stroke: currentColor;
                stroke-width: 2.2;
                stroke-linecap: round;
                stroke-linejoin: round;
                pointer-events: none;
                transition: transform .16s ease;
            }

            .${NAME}-pref-tab-scroll:hover:not(:disabled) {
                color: var(--text);
                border-color: rgba(99, 133, 239, .48);
                background: rgba(99, 133, 239, .14);
            }

            .${NAME}-pref-tab-scroll.is-left:hover:not(:disabled) .${NAME}-pref-tab-icon {
                transform: translateX(-1px);
            }

            .${NAME}-pref-tab-scroll.is-right:hover:not(:disabled) .${NAME}-pref-tab-icon {
                transform: translateX(1px);
            }

            .${NAME}-pref-tab-scroll:disabled {
                cursor: default;
                opacity: .36;
            }

            .${NAME}-pref-tab {
                appearance: none;
                flex: 0 0 auto;
                min-width: 66px;
                height: 32px;
                border: 1px solid transparent;
                border-radius: 7px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
                padding: 0 8px;
                color: var(--muted);
                background: transparent;
                cursor: pointer;
                font: inherit;
                font-size: 12px;
                font-weight: 850;
            }

            .${NAME}-pref-tab:hover {
                color: var(--text);
                background: rgba(125, 136, 158, .14);
            }

            .${NAME}-pref-tab.is-active {
                color: var(--text);
                border-color: rgba(99, 133, 239, .46);
                background: rgba(99, 133, 239, .18);
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
            }

            .${NAME}-pref-tab-label {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .${NAME}-pref-tab-count {
                min-width: 16px;
                height: 16px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0 5px;
                border-radius: 999px;
                color: var(--text);
                background: rgba(99, 133, 239, .22);
                font-size: 10px;
                line-height: 1;
            }

            .${NAME}-pref-tab-panel {
                display: none;
                max-height: min(430px, calc(100dvh - 220px));
                overflow-y: auto;
                overflow-x: hidden;
                margin-top: 8px;
                padding: 10px;
                border: 1px solid var(--line);
                border-radius: 8px;
                background: rgba(125, 136, 158, .07);
                scrollbar-width: thin;
                scrollbar-color: rgba(125, 136, 158, .5) transparent;
            }

            .${NAME}-pref-tab-panel.is-active {
                display: block;
            }

            .${NAME}-setting-group {
                padding-top: 8px;
                border-top: 1px solid rgba(125, 136, 158, .16);
            }

            .${NAME}-setting-group:first-child {
                padding-top: 0;
                border-top: 0;
            }

            .${NAME}-setting-group + .${NAME}-setting-group {
                margin-top: 10px;
            }

            .${NAME}-setting-group-title {
                min-height: 18px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin: 0 0 6px;
                color: var(--muted);
                font-size: 11px;
                font-weight: 850;
            }

            .${NAME}-section-count {
                min-width: 18px;
                height: 18px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0 6px;
                border-radius: 999px;
                color: var(--text);
                background: rgba(99, 133, 239, .18);
                font-size: 10px;
                font-weight: 850;
            }

            .${NAME}-floating-settings .${NAME}-favorite-list {
                max-height: 150px;
            }

            .${NAME}-floating-settings .${NAME}-queue-keep-hint {
                margin: -2px 0 7px;
            }

            .${NAME}-floating-settings .${NAME}-resume-button {
                margin-bottom: 0;
            }

            .${NAME}-list-search {
                width: 100%;
                height: 34px;
                margin-bottom: 7px;
                border: 1px solid var(--line);
                border-radius: 8px;
                padding: 0 9px;
                color: var(--text);
                background: var(--panel2);
                font: inherit;
                font-size: 12px;
                outline: none;
            }

            .${NAME}-list-search:focus {
                border-color: rgba(99, 133, 239, .58);
                box-shadow: 0 0 0 3px rgba(99, 133, 239, .14);
            }

            .${NAME}-memory-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 6px;
            }

            .${NAME}-memory-row {
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 2px;
                padding: 7px 8px;
                border: 1px solid var(--line);
                border-radius: 8px;
                background: var(--panel2);
            }

            .${NAME}-memory-label {
                color: var(--weak);
                font-size: 10px;
                font-weight: 800;
                line-height: 1.2;
            }

            .${NAME}-memory-value {
                min-width: 0;
                color: var(--text);
                font-size: 12px;
                font-weight: 850;
                line-height: 1.3;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .${NAME}-memory-parts {
                display: grid;
                gap: 5px;
                margin-top: 7px;
            }

            .${NAME}-memory-part {
                min-width: 0;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                color: var(--weak);
                font-size: 10px;
                line-height: 1.35;
            }

            .${NAME}-memory-part-label,
            .${NAME}-memory-part-value {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .${NAME}-memory-part-value {
                flex: 0 0 auto;
                color: var(--muted);
            }

            .${NAME}-keyword-field {
                display: block;
                padding: 8px;
                border-radius: 8px;
                background: var(--panel2);
            }

            .${NAME}-keyword-field + .${NAME}-keyword-field {
                margin-top: 8px;
            }

            .${NAME}-keyword-label,
            .${NAME}-keyword-desc {
                display: block;
            }

            .${NAME}-keyword-label {
                color: var(--text);
                font-size: 12px;
                font-weight: 800;
            }

            .${NAME}-keyword-desc {
                margin-top: 1px;
                color: var(--weak);
                font-size: 10px;
            }

            .${NAME}-keyword-input {
                width: 100%;
                min-height: 72px;
                margin-top: 7px;
                resize: vertical;
                border: 1px solid var(--line);
                border-radius: 8px;
                padding: 7px 8px;
                color: var(--text);
                background: var(--bg);
                font: inherit;
                font-size: 12px;
                line-height: 1.45;
                outline: none;
            }

            .${NAME}-keyword-input:focus {
                border-color: rgba(99, 133, 239, .58);
                box-shadow: 0 0 0 3px rgba(99, 133, 239, .14);
            }

            .${NAME}-category-picker {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-top: 8px;
                padding: 8px;
                border: 1px solid var(--line);
                border-radius: 8px;
                background: var(--panel2);
                max-height: 180px;
                overflow-y: auto;
                scrollbar-width: thin;
                scrollbar-color: rgba(125, 136, 158, .5) transparent;
            }

            .${NAME}-category-picker-empty {
                color: var(--weak);
                font-size: 11px;
                line-height: 1.45;
            }

            .${NAME}-category-chip {
                appearance: none;
                position: relative;
                max-width: 100%;
                min-width: 0;
                display: inline-flex;
                align-items: center;
                gap: 5px;
                min-height: 26px;
                border: 1px solid var(--line);
                border-radius: 999px;
                padding: 3px 8px;
                color: var(--muted);
                background: var(--bg);
                cursor: pointer;
                font: inherit;
                line-height: 1.2;
            }

            .${NAME}-category-chip:hover,
            .${NAME}-category-chip.is-active {
                color: var(--text);
                border-color: rgba(99, 133, 239, .48);
                background: var(--button-hover);
            }

            .${NAME}-category-chip.is-active {
                padding-left: 22px;
                color: var(--active-text);
                border-color: rgba(99, 133, 239, .78);
                background: linear-gradient(135deg, rgba(99, 133, 239, .28), rgba(86, 184, 170, .18));
                box-shadow:
                    inset 0 0 0 1px rgba(99, 133, 239, .48),
                    0 0 0 2px rgba(99, 133, 239, .12);
            }

            .${NAME}-category-chip.is-active::before {
                content: "";
                position: absolute;
                left: 8px;
                top: 50%;
                width: 7px;
                height: 7px;
                border-radius: 999px;
                background: var(--green);
                box-shadow: 0 0 0 2px rgba(86, 184, 170, .22);
                transform: translateY(-50%);
            }

            .${NAME}-category-chip-name {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 11px;
                font-weight: 750;
            }

            .${NAME}-category-chip-slug {
                flex: 0 1 auto;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color: var(--weak);
                font-size: 10px;
                font-weight: 650;
            }

            .${NAME}-category-chip.is-active .${NAME}-category-chip-name {
                font-weight: 850;
            }

            .${NAME}-category-chip.is-active .${NAME}-category-chip-slug {
                color: var(--text);
            }

            .${NAME}-settings-title {
                margin: 0 0 8px;
                color: var(--muted);
                font-size: 12px;
                font-weight: 800;
            }

            .${NAME}-size-title {
                margin-top: 12px;
                padding-top: 10px;
                border-top: 1px solid var(--line);
            }

            .${NAME}-setting {
                width: 100%;
                min-height: 44px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                padding: 8px 10px;
                border: 1px solid transparent;
                border-radius: 8px;
                color: var(--text);
                background: var(--panel2);
                cursor: pointer;
                text-align: left;
            }

            .${NAME}-setting + .${NAME}-setting {
                margin-top: 6px;
            }

            .${NAME}-setting.is-active {
                border-color: rgba(99, 133, 239, .65);
                background: rgba(99, 133, 239, .16);
            }

            .${NAME}-setting-copy {
                min-width: 0;
                display: flex;
                flex-direction: column;
            }

            .${NAME}-setting-label {
                font-size: 12px;
                font-weight: 800;
            }

            .${NAME}-setting-desc {
                margin-top: 1px;
                color: var(--weak);
                font-size: 10px;
            }

            .${NAME}-setting-dot {
                width: 16px;
                height: 16px;
                border: 2px solid var(--weak);
                border-radius: 50%;
                flex: 0 0 auto;
            }

            .${NAME}-setting.is-active .${NAME}-setting-dot {
                border-color: var(--blue);
                background: radial-gradient(circle at center, var(--blue) 0 45%, transparent 48%);
            }

            .${NAME}-favorite-list {
                max-height: 220px;
                overflow-y: auto;
                overflow-x: hidden;
                padding-right: 2px;
                scrollbar-width: thin;
                scrollbar-color: rgba(125, 136, 158, .5) transparent;
            }

            .${NAME}-favorite-row {
                display: grid;
                grid-template-columns: minmax(0, 1fr) 28px;
                align-items: stretch;
                gap: 6px;
            }

            .${NAME}-page-nav-row {
                grid-template-columns: minmax(0, 1fr) 28px 28px 28px;
            }

            .${NAME}-page-nav-row.is-active .${NAME}-page-nav-item {
                border-color: rgba(78, 180, 165, .58);
                background: rgba(78, 180, 165, .16);
            }

            .${NAME}-page-nav-row.is-active .${NAME}-favorite-meta {
                color: var(--green);
            }

            .${NAME}-favorite-row + .${NAME}-favorite-row {
                margin-top: 6px;
            }

            .${NAME}-recent-item + .${NAME}-recent-item {
                margin-top: 6px;
            }

            .${NAME}-favorite-item,
            .${NAME}-resume-button {
                min-width: 0;
                min-height: 38px;
                border: 1px solid transparent;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                padding: 7px 9px;
                color: var(--text);
                background: var(--panel2);
                cursor: pointer;
                text-align: left;
            }

            .${NAME}-resume-button {
                width: 100%;
                margin-bottom: 10px;
            }

            .${NAME}-favorite-item:hover,
            .${NAME}-resume-button:hover {
                border-color: rgba(99, 133, 239, .45);
                background: rgba(99, 133, 239, .14);
            }

            .${NAME}-resume-button:disabled {
                cursor: default;
                opacity: .58;
            }

            .${NAME}-resume-button:disabled:hover {
                border-color: transparent;
                background: var(--panel2);
            }

            .${NAME}-favorite-title,
            .${NAME}-favorite-meta {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .${NAME}-favorite-title {
                font-size: 12px;
                font-weight: 800;
            }

            .${NAME}-favorite-meta {
                margin-top: 1px;
                color: var(--weak);
                font-size: 10px;
            }

            .${NAME}-favorite-remove {
                width: 28px;
                min-height: 38px;
                border: 1px solid var(--line);
                border-radius: 8px;
                color: var(--weak);
                background: var(--panel2);
                cursor: pointer;
                font-size: 18px;
                font-weight: 500;
                line-height: 1;
            }

            .${NAME}-favorite-remove:hover {
                color: var(--bad, #e36f86);
                border-color: rgba(227, 111, 134, .45);
                background: rgba(227, 111, 134, .12);
            }

            .${NAME}-page-nav-action {
                width: 28px;
                min-height: 38px;
                border: 1px solid var(--line);
                border-radius: 8px;
                color: var(--weak);
                background: var(--panel2);
                cursor: pointer;
                font-size: 14px;
                font-weight: 750;
                line-height: 1;
            }

            .${NAME}-page-nav-action:hover {
                color: var(--text);
                border-color: rgba(99, 133, 239, .45);
                background: rgba(99, 133, 239, .14);
            }

            .${NAME}-favorite-empty {
                padding: 10px;
                border-radius: 8px;
                color: var(--weak);
                background: var(--panel2);
                font-size: 12px;
                text-align: center;
            }

            .${NAME}-resume-box:empty {
                display: none;
            }

            .${NAME}-management-actions {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 6px;
                margin-top: 8px;
            }

            .${NAME}-management-actions .${NAME}-soft-btn {
                min-height: 30px;
                padding: 5px 7px;
                font-size: 11px;
                white-space: nowrap;
            }

            .${NAME}-queue-actions {
                grid-template-columns: minmax(0, 1fr);
            }

            .${NAME}-size-row {
                display: grid;
                grid-template-columns: 34px 24px minmax(56px, 1fr) 24px 64px 20px;
                align-items: center;
                gap: 6px;
                min-height: 40px;
                padding: 6px;
                border-radius: 8px;
                background: var(--panel2);
            }

            .${NAME}-size-row + .${NAME}-size-row {
                margin-top: 6px;
            }

            .${NAME}-size-hint {
                margin: -2px 0 8px;
                padding: 7px 9px;
                border: 1px solid var(--line);
                border-radius: 8px;
                color: var(--muted);
                background: rgba(125, 136, 158, .08);
                font-size: 11px;
                line-height: 1.35;
            }

            .${NAME}-size-label,
            .${NAME}-size-unit {
                color: var(--muted);
                font-size: 11px;
                font-weight: 750;
            }

            .${NAME}-size-step,
            .${NAME}-size-clicker,
            .${NAME}-tuning-step,
            .${NAME}-tuning-number {
                appearance: none;
                font: inherit;
            }

            .${NAME}-size-step {
                width: 24px;
                height: 24px;
                border: 1px solid var(--line);
                border-radius: 7px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: var(--text);
                background: var(--bg);
                cursor: pointer;
                font-size: 15px;
                font-weight: 850;
                line-height: 1;
            }

            .${NAME}-size-step:hover {
                border-color: rgba(99, 133, 239, .55);
                background: rgba(99, 133, 239, .14);
            }

            .${NAME}-size-clicker {
                --size-ratio: 50%;
                position: relative;
                width: 100%;
                height: 24px;
                border: 0;
                border-radius: 8px;
                overflow: hidden;
                background:
                    linear-gradient(90deg, rgba(99, 133, 239, .86) 0 var(--size-ratio), rgba(125, 136, 158, .24) var(--size-ratio) 100%);
                box-shadow: inset 0 0 0 1px var(--line);
                cursor: pointer;
                text-align: left;
            }

            .${NAME}-size-clicker::before {
                content: '';
                position: absolute;
                inset: 9px 8px;
                border-radius: 999px;
                background: rgba(255, 255, 255, .38);
                opacity: .5;
            }

            .${NAME}-size-thumb {
                position: absolute;
                left: var(--size-ratio);
                top: 50%;
                width: 14px;
                height: 14px;
                border: 2px solid rgba(255, 255, 255, .95);
                border-radius: 50%;
                background: linear-gradient(135deg, var(--blue), var(--green));
                box-shadow: 0 2px 7px rgba(0, 0, 0, .25);
                transform: translate(-50%, -50%);
                pointer-events: none;
            }

            .${NAME}-size-number {
                width: 64px;
                height: 24px;
                border: 1px solid var(--line);
                border-radius: 7px;
                padding: 3px 6px;
                color: var(--text);
                background: var(--bg);
                font: inherit;
                font-size: 12px;
            }

            .${NAME}-tuning-row {
                display: grid;
                grid-template-columns: minmax(0, 1fr) 24px 58px 24px 28px;
                align-items: center;
                gap: 6px;
                min-height: 46px;
                padding: 7px;
                border-radius: 8px;
                background: var(--panel2);
            }

            .${NAME}-tuning-row + .${NAME}-tuning-row {
                margin-top: 6px;
            }

            .${NAME}-tuning-copy {
                min-width: 0;
                display: flex;
                flex-direction: column;
            }

            .${NAME}-tuning-label {
                color: var(--text);
                font-size: 12px;
                font-weight: 800;
                line-height: 1.25;
            }

            .${NAME}-tuning-help {
                margin-top: 1px;
                color: var(--weak);
                font-size: 10px;
                line-height: 1.25;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .${NAME}-tuning-step {
                width: 24px;
                height: 24px;
                border: 1px solid var(--line);
                border-radius: 7px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: var(--text);
                background: var(--bg);
                cursor: pointer;
                font-size: 15px;
                font-weight: 850;
                line-height: 1;
            }

            .${NAME}-tuning-step:hover {
                border-color: rgba(99, 133, 239, .55);
                background: rgba(99, 133, 239, .14);
            }

            .${NAME}-tuning-number {
                width: 58px;
                height: 24px;
                border: 1px solid var(--line);
                border-radius: 7px;
                padding: 3px 5px;
                color: var(--text);
                background: var(--bg);
                font-size: 12px;
            }

            .${NAME}-tuning-unit {
                min-width: 0;
                color: var(--muted);
                font-size: 10px;
                font-weight: 750;
                white-space: nowrap;
            }

            .${NAME}-read-badge,
            .${NAME}-effective-badge,
            .${NAME}-last-viewed-badge,
            .${NAME}-keyword-badge,
            .${NAME}-date-badge,
            .${NAME}-similar-badge {
                display: inline-flex;
                align-items: center;
                min-height: 18px;
                margin-left: 8px;
                padding: 1px 7px;
                border: 1px solid rgba(99, 133, 239, .35);
                border-radius: 999px;
                color: #4f6fd6;
                background: rgba(99, 133, 239, .1);
                font-size: 11px;
                font-weight: 750;
                line-height: 1.2;
                vertical-align: middle;
                white-space: nowrap;
            }

            .${NAME}-effective-badge {
                border-color: rgba(78, 180, 165, .42);
                color: #348b7f;
                background: rgba(78, 180, 165, .12);
            }

            .${NAME}-last-viewed-badge {
                border-color: #1d4ed8;
                color: #fff;
                background: #2563eb;
                box-shadow: 0 0 0 2px rgba(37, 99, 235, .18);
            }

            .${NAME}-keyword-badge {
                border-color: rgba(212, 168, 83, .55);
                color: #8f6a11;
                background: rgba(255, 207, 92, .2);
            }

            .${NAME}-date-badge {
                border-color: rgba(125, 136, 158, .34);
                color: #667085;
                background: rgba(125, 136, 158, .1);
                font-weight: 700;
            }

            .${NAME}-similar-badge {
                border-color: rgba(99, 133, 239, .38);
                color: #4f6fd6;
                background: rgba(99, 133, 239, .12);
                font-weight: 800;
            }

            .${NAME}-category-marked {
                position: relative;
            }

            tr.${NAME}-category-marked,
            .topic-list-item.${NAME}-category-marked,
            .latest-topic-list-item.${NAME}-category-marked,
            .search-result-topic.${NAME}-category-marked,
            li.${NAME}-category-marked,
            article.${NAME}-category-marked {
                box-shadow: inset 3px 0 0 var(--ldpeek-category-color, #6385ef);
            }

            .${NAME}-keyword-blocked {
                display: none !important;
            }

            a.${NAME}-keyword-highlight {
                color: #a66f00 !important;
                text-decoration: underline;
                text-decoration-color: rgba(166, 111, 0, .45);
                text-decoration-thickness: 1px;
                text-underline-offset: 2px;
            }

            .${NAME}-last-viewed-row {
                position: relative;
                border-radius: 8px;
                box-shadow: inset 4px 0 0 #2563eb;
                animation: ${NAME}-last-viewed-pulse 2200ms ease-out 1;
            }

            @keyframes ${NAME}-last-viewed-pulse {
                0% {
                    box-shadow: inset 4px 0 0 #2563eb, 0 0 0 0 rgba(37, 99, 235, .58);
                    background: rgba(37, 99, 235, .18);
                }
                55% {
                    box-shadow: inset 4px 0 0 #2563eb, 0 0 0 8px rgba(37, 99, 235, .1);
                    background: rgba(37, 99, 235, .1);
                }
                100% {
                    box-shadow: inset 4px 0 0 #2563eb, 0 0 0 12px rgba(37, 99, 235, 0);
                    background: transparent;
                }
            }

            .${NAME}-body {
                position: relative;
                z-index: 1;
                min-height: 0;
                min-width: 0;
                flex: 1 1 auto;
                overflow: auto;
                overscroll-behavior: contain;
                padding: 10px;
                scrollbar-width: thin;
                scrollbar-color: rgba(125, 136, 158, .55) transparent;
            }

            .${NAME}-body::-webkit-scrollbar {
                width: 8px;
            }

            .${NAME}-body::-webkit-scrollbar-thumb {
                border-radius: 8px;
                background: rgba(125, 136, 158, .55);
            }

            .${NAME}-state {
                min-height: 180px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 12px;
                padding: 18px;
                color: var(--muted);
                text-align: center;
            }

            .${NAME}-error {
                color: var(--bad);
            }

            .${NAME}-state-message {
                max-width: 520px;
            }

            .${NAME}-state-actions {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 8px;
            }

            .${NAME}-spinner {
                width: 24px;
                height: 24px;
                margin-right: 10px;
                border: 3px solid rgba(125, 136, 158, .28);
                border-top-color: var(--blue);
                border-radius: 50%;
                animation: ${NAME}-spin 800ms linear infinite;
            }

            @keyframes ${NAME}-spin {
                to { transform: rotate(360deg); }
            }

            .${NAME}-summary {
                display: flex;
                flex-direction: column;
                gap: 14px;
            }

            .${NAME}-summary-tabs {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 6px;
            }

            .${NAME}-summary-tab {
                min-width: 0;
                min-height: 34px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                border: 1px solid var(--line);
                border-radius: 8px;
                padding: 6px 8px;
                color: var(--muted);
                background: var(--panel);
                font: inherit;
                font-size: 12px;
                font-weight: 850;
                cursor: pointer;
            }

            .${NAME}-summary-tab:hover {
                border-color: rgba(99, 133, 239, .42);
                color: var(--text);
                background: var(--button-hover);
            }

            .${NAME}-summary-tab.is-active {
                border-color: rgba(99, 133, 239, .62);
                color: var(--text);
                background: rgba(99, 133, 239, .16);
            }

            .${NAME}-summary-tab-label,
            .${NAME}-summary-tab-badge {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .${NAME}-summary-tab-badge {
                flex: 0 0 auto;
                max-width: 64px;
                color: var(--weak);
                font-size: 10px;
            }

            .${NAME}-summary-hint {
                margin-top: -8px;
                color: var(--weak);
                font-size: 11px;
                line-height: 1.45;
            }

            .${NAME}-summary-search {
                display: grid;
                grid-template-columns: minmax(0, 1fr) 32px 32px 32px auto;
                gap: 6px;
                align-items: center;
            }

            .${NAME}-summary-search-input {
                min-width: 0;
                height: 34px;
                border: 1px solid var(--line);
                border-radius: 8px;
                padding: 0 10px;
                color: var(--text);
                background: var(--panel);
                font: inherit;
                font-size: 12px;
                outline: none;
            }

            .${NAME}-summary-search-input:focus {
                border-color: rgba(99, 133, 239, .58);
                box-shadow: 0 0 0 3px rgba(99, 133, 239, .14);
            }

            .${NAME}-summary-search-btn {
                width: 32px;
                height: 32px;
                border: 1px solid var(--line);
                border-radius: 8px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: var(--muted);
                background: var(--panel);
                font: inherit;
                font-size: 18px;
                font-weight: 850;
                line-height: 1;
                cursor: pointer;
            }

            .${NAME}-summary-search-btn:hover {
                color: var(--text);
                background: var(--button-hover);
            }

            .${NAME}-summary-search-btn:disabled {
                opacity: .45;
                cursor: default;
                background: var(--panel);
            }

            .${NAME}-summary-search-count {
                min-width: 34px;
                color: var(--weak);
                font-size: 11px;
                font-weight: 800;
                text-align: right;
                white-space: nowrap;
            }

            .${NAME}-summary-search-hit {
                border-radius: 3px;
                padding: 0 2px;
                color: inherit;
                background: rgba(250, 204, 21, .38);
            }

            .${NAME}-summary-search-hit.is-current {
                background: rgba(249, 115, 22, .52);
                box-shadow: 0 0 0 1px rgba(249, 115, 22, .42);
            }

            .${NAME}-summary-view {
                display: flex;
                flex-direction: column;
                gap: 14px;
            }

            .${NAME}-summary-view[hidden] {
                display: none;
            }

            .${NAME}-summary-empty {
                border: 1px solid var(--line);
                border-radius: 8px;
                padding: 18px;
                color: var(--muted);
                background: var(--panel);
                text-align: center;
                font-size: 13px;
                font-weight: 750;
            }

            .${NAME}-topic-head,
            .${NAME}-cooked,
            .${NAME}-frame-shell {
                border: 1px solid var(--line);
                border-radius: 8px;
                background: var(--panel);
            }

            .${NAME}-topic-head {
                padding: 14px;
            }

            .${NAME}-author {
                min-width: 0;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .${NAME}-avatar {
                width: 42px;
                height: 42px;
                border-radius: 50%;
                object-fit: cover;
                flex: 0 0 auto;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: var(--text);
                background: var(--panel2);
                font-weight: 850;
            }

            .${NAME}-author-copy {
                min-width: 0;
            }

            .${NAME}-name {
                font-weight: 850;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .${NAME}-username,
            .${NAME}-meta {
                color: var(--muted);
                font-size: 12px;
            }

            .${NAME}-topic-title {
                margin: 12px 0 0;
                color: var(--text);
                font-size: 18px;
                line-height: 1.35;
                font-weight: 850;
                word-break: break-word;
            }

            .${NAME}-meta {
                margin-top: 8px;
                display: flex;
                flex-wrap: wrap;
                gap: 8px 12px;
            }

            .${NAME}-cooked {
                padding: 16px;
                word-break: break-word;
                background: var(--panel2);
            }

            .${NAME}-cooked p {
                margin: 0 0 10px;
            }

            .${NAME}-cooked p:last-child {
                margin-bottom: 0;
            }

            .${NAME}-cooked a {
                color: var(--blue);
                text-decoration: none;
            }

            .${NAME}-cooked a:hover {
                text-decoration: underline;
            }

            .${NAME}-cooked blockquote {
                margin: 10px 0;
                padding: 10px 12px;
                border-left: 4px solid var(--blue);
                border-radius: 0 8px 8px 0;
                background: rgba(99, 133, 239, .1);
            }

            .${NAME}-cooked ul,
            .${NAME}-cooked ol {
                margin: 8px 0;
                padding-left: 24px;
            }

            .${NAME}-cooked li {
                margin: 4px 0;
            }

            .${NAME}-cooked pre {
                max-height: 260px;
                overflow: auto;
                margin: 10px 0;
                padding: 12px;
                border-radius: 8px;
                background: rgba(5, 8, 14, .36);
            }

            #${NAME}-drawer.is-light .${NAME}-cooked pre {
                background: rgba(24, 33, 52, .06);
            }

            .${NAME}-cooked code {
                font-size: 13px;
            }

            .${NAME}-cooked h1,
            .${NAME}-cooked h2,
            .${NAME}-cooked h3 {
                margin: 14px 0 8px;
                font-size: 1.15em;
                line-height: 1.35;
            }

            .${NAME}-cooked img,
            .${NAME}-cooked video {
                display: block;
                max-width: 100%;
                height: auto;
                margin: 10px 0;
                border-radius: 8px;
            }

            .${NAME}-cooked table {
                display: block;
                max-width: 100%;
                overflow-x: auto;
                border-collapse: collapse;
            }

            .${NAME}-actions {
                display: flex;
                flex-wrap: wrap;
                justify-content: flex-end;
                gap: 8px;
            }

            .${NAME}-primary-btn,
            .${NAME}-soft-btn {
                min-height: 34px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 7px 12px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 750;
                text-decoration: none;
            }

            .${NAME}-primary-btn {
                border: 0;
                color: #fff;
                background: linear-gradient(135deg, var(--blue), var(--green));
            }

            .${NAME}-soft-btn {
                border: 1px solid var(--line);
                color: var(--text);
                background: var(--panel2);
            }

            .${NAME}-frame-shell {
                position: relative;
                height: 100%;
                min-height: 420px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .${NAME}-frame-top {
                position: relative;
                z-index: 3;
                min-height: 40px;
                display: flex;
                align-items: center;
                padding: 8px 10px;
                border-bottom: 1px solid var(--line);
                color: var(--muted);
                font-size: 12px;
                overflow: visible;
            }

            .${NAME}-frame-url-form {
                --${NAME}-frame-control-height: 32px;
                min-width: 0;
                width: 100%;
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: nowrap;
            }

            .${NAME}-frame-mode {
                flex: 0 0 auto;
                height: var(--${NAME}-frame-control-height);
                display: inline-flex;
                align-items: center;
                white-space: nowrap;
                font-weight: 750;
                line-height: 1;
            }

            .${NAME}-frame-navs {
                position: relative;
                height: var(--${NAME}-frame-control-height);
                display: inline-flex;
                align-items: center;
                gap: 4px;
                flex: 0 0 auto;
            }

            .${NAME}-frame-nav {
                appearance: none;
                box-sizing: border-box;
                width: var(--${NAME}-frame-control-height);
                height: var(--${NAME}-frame-control-height);
                margin: 0;
                border: 1px solid var(--line);
                border-radius: 7px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                color: var(--text);
                background: var(--panel2);
                cursor: pointer;
                font: inherit;
                font-size: 0;
                font-weight: 850;
                line-height: 1;
            }

            .${NAME}-frame-nav::before {
                display: block;
                color: currentColor;
                font-size: 20px;
                font-weight: 850;
                line-height: 1;
                transform: translateY(-1px);
            }

            .${NAME}-frame-nav-back::before {
                content: "‹";
            }

            .${NAME}-frame-nav-forward::before {
                content: "›";
            }

            .${NAME}-frame-nav:hover:not(:disabled) {
                border-color: rgba(99, 133, 239, .55);
                background: rgba(99, 133, 239, .14);
            }

            .${NAME}-frame-nav:disabled {
                cursor: default;
                opacity: .38;
            }

            .${NAME}-frame-history-menu {
                position: absolute;
                z-index: 8;
                top: 42px;
                left: 10px;
                width: min(340px, calc(100% - 20px));
                max-height: 280px;
                overflow: auto;
                padding: 6px;
                border: 1px solid var(--line);
                border-radius: 8px;
                background: var(--bg);
                box-shadow: 0 14px 36px rgba(0, 0, 0, .26);
                opacity: 0;
                pointer-events: none;
                transform: translateY(-4px) scale(.98);
                transform-origin: top left;
                transition: opacity 120ms ease, transform 140ms ease;
            }

            .${NAME}-frame-history-menu.is-open {
                opacity: 1;
                pointer-events: auto;
                transform: translateY(0) scale(1);
            }

            .${NAME}-frame-history-menu.is-forward {
                transform-origin: top right;
            }

            .${NAME}-frame-history-item {
                appearance: none;
                width: 100%;
                min-height: 32px;
                border: 0;
                border-radius: 6px;
                padding: 6px 8px;
                display: block;
                color: var(--text);
                background: transparent;
                cursor: pointer;
                font: inherit;
                font-size: 12px;
                line-height: 1.35;
                text-align: left;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .${NAME}-frame-history-item:hover {
                background: rgba(99, 133, 239, .14);
                color: var(--accent);
            }

            .${NAME}-frame-url-input {
                box-sizing: border-box;
                min-width: 0;
                flex: 1 1 120px;
                width: 100%;
                height: var(--${NAME}-frame-control-height);
                margin: 0 !important;
                margin-block: 0 !important;
                border: 1px solid var(--line);
                border-radius: 7px;
                padding: 0 9px;
                color: var(--text);
                background: var(--panel2);
                font: inherit;
                font-size: 12px;
                line-height: normal;
            }

            #${NAME}-drawer .${NAME}-frame-url-input {
                margin: 0 !important;
                margin-block: 0 !important;
                margin-bottom: 0 !important;
                align-self: center;
            }

            .${NAME}-frame-url-input:focus {
                outline: none;
                border-color: rgba(99, 133, 239, .65);
                box-shadow: 0 0 0 3px rgba(99, 133, 239, .16);
            }

            @media (max-width: 560px) {
                .${NAME}-frame-mode {
                    display: none;
                }

                .${NAME}-frame-url-form {
                    gap: 6px;
                }
            }

            .${NAME}-frame-wrap {
                position: relative;
                z-index: 1;
                min-height: 0;
                flex: 1 1 auto;
                background: #fff;
            }

            .${NAME}-frame-status {
                position: absolute;
                inset: 0;
                z-index: 2;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 12px;
                padding: 16px;
                color: #667085;
                background: rgba(255, 255, 255, .92);
                pointer-events: none;
            }

            .${NAME}-frame-status.has-actions {
                pointer-events: auto;
            }

            .${NAME}-frame-status-actions {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 8px;
            }

            .${NAME}-frame {
                position: relative;
                z-index: 1;
                width: 100%;
                height: 100%;
                min-height: calc(min(var(--peek-height, 100dvh), 100dvh) - 176px);
                border: 0;
                display: block;
                background: #fff;
            }

            #${NAME}-toast {
                position: fixed;
                left: 50%;
                bottom: 28px;
                z-index: 100004;
                max-width: min(360px, calc(100vw - 32px));
                padding: 10px 14px;
                border: 1px solid rgba(255, 255, 255, .18);
                border-radius: 8px;
                color: #fff;
                background: rgba(31, 41, 55, .94);
                box-shadow: 0 14px 34px rgba(20, 28, 48, .28);
                font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
                opacity: 0;
                pointer-events: none;
                transform: translate(-50%, 10px);
                transition: opacity 160ms ease, transform 180ms cubic-bezier(.22, 1, .36, 1);
            }

            #${NAME}-toast.is-open {
                opacity: 1;
                transform: translate(-50%, 0);
            }

            @media (max-width: 768px) {
                #${NAME}-prefs {
                    display: none;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                #${NAME}-prefs .${NAME}-pref-button,
                #${NAME}-prefs .${NAME}-launcher-symbol,
                #${NAME}-prefs .${NAME}-launcher-dot,
                #${NAME}-prefs .${NAME}-pie-menu::before,
                #${NAME}-prefs .${NAME}-pie-menu::after,
                #${NAME}-prefs .${NAME}-pie-item,
                #${NAME}-prefs .${NAME}-pie-item::before,
                #${NAME}-prefs .${NAME}-pie-item::after,
                #${NAME}-prefs .${NAME}-pie-item-icon {
                    transition: none;
                }

                .${NAME}-pie-item:hover .${NAME}-pie-settings-icon,
                .${NAME}-pie-item:focus-visible .${NAME}-pie-settings-icon,
                .${NAME}-pie-item.is-active .${NAME}-pie-settings-icon {
                    animation: none;
                }
            }
        `;

        if (typeof GM_addStyle === 'function') {
            GM_addStyle(css);
        } else {
            const style = document.createElement('style');
            style.textContent = css;
            (document.head || document.documentElement).appendChild(style);
        }
    }

    function showToast(message) {
        if (!document.body) {
            console.info(`${LOG_PREFIX} ${message}`);
            return;
        }

        let toast = document.getElementById(`${NAME}-toast`);
        if (!toast) {
            toast = Dom.make('div', { id: `${NAME}-toast`, role: 'status', 'aria-live': 'polite' });
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('is-open');
        clearTimeout(toast.hideTimer);
        toast.hideTimer = window.setTimeout(() => {
            toast.classList.remove('is-open');
        }, 1800);
    }

    function copyText(text, message = '已复制') {
        const value = String(text || '');
        if (!value) return;
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(value)
                .then(() => showToast(message))
                .catch(() => {
                    window.prompt('复制下面的内容', value);
                });
            return;
        }
        window.prompt('复制下面的内容', value);
    }

    function exportLocalData() {
        const payload = {
            app: APP_NAME,
            version: '0.4.74',
            exportedAt: new Date().toISOString(),
            prefs: Prefs.value,
            readMemory: ReadMemory.items,
            favorites: Favorites.items,
            readLaterQueue: ReadLaterQueue.items,
            pageNav: PageNav.items,
            drawerState: DrawerState.value
        };
        copyText(JSON.stringify(payload, null, 2), '配置已复制');
    }

    function importLocalData() {
        const raw = window.prompt('粘贴 LD Peek 导出的配置 JSON');
        if (!raw) return;
        try {
            const payload = JSON.parse(raw);
            if (payload.prefs) Prefs.save(payload.prefs);
            if (Array.isArray(payload.readMemory)) {
                ReadMemory.items = payload.readMemory.map((item) => ReadMemory.normalizeItem(item)).filter(Boolean).slice(0, Prefs.value.memoryLimit);
                ReadMemory.save();
            }
            if (Array.isArray(payload.favorites)) {
                Favorites.items = payload.favorites.map((item) => Favorites.normalizeItem(item)).filter(Boolean).slice(0, Prefs.value.favoriteLimit);
                Favorites.save();
            }
            if (Array.isArray(payload.readLaterQueue)) {
                ReadLaterQueue.items = payload.readLaterQueue.map((item) => ReadLaterQueue.normalizeItem(item)).filter(Boolean).slice(0, MAX_READ_LATER);
                ReadLaterQueue.save();
            }
            if (Array.isArray(payload.pageNav)) {
                PageNav.items = payload.pageNav.map((item) => PageNav.normalizeItem(item)).filter(Boolean).slice(0, Prefs.value.pageNavLimit);
                PageNav.save();
            }
            if (payload.drawerState) {
                DrawerState.save(payload.drawerState);
            }
            Drawer.applySize();
            Drawer.syncControls();
            FloatingPrefs.applyPosition();
            FloatingPrefs.applyTheme();
            TopicBadges.refresh();
            FloatingPrefs.sync();
            showToast('配置已导入');
        } catch (error) {
            console.warn(`${LOG_PREFIX} 配置导入失败`, error);
            showToast('导入失败，请检查 JSON');
        }
    }

    function notifyModeChange(mode) {
        const label = MODES[Prefs.mode(mode)].label;
        const message = `已切换到：${label}模式`;
        if (typeof GM_notification === 'function') {
            try {
                GM_notification({
                    title: APP_NAME,
                    text: message,
                    timeout: 1800,
                    silent: true
                });
                return;
            } catch (_) {
                // 部分脚本管理器可能声明了接口但禁用通知权限，失败时回退到页面提示。
            }
        }

        showToast(message);
    }

    // 油猴菜单命令作为轻量备用入口，方便偏好使用扩展菜单的用户。
    function registerMenu() {
        if (typeof GM_registerMenuCommand !== 'function') return;
        GM_registerMenuCommand(`切换 ${APP_NAME} 默认模式`, () => {
            const prefs = Prefs.toggle();
            FloatingPrefs.sync();
            if (Drawer.topicId && Drawer.root?.classList.contains('is-open')) {
                Drawer.open(Drawer.topicId, prefs.mode, LastViewedMarker.anchor, Drawer.sourceHref, { trackSource: Drawer.trackViewSource });
            }
            notifyModeChange(prefs.mode);
        });
        GM_registerMenuCommand(`打开 ${APP_NAME} 实时新帖`, () => {
            LiveTopics.open();
        });
    }

    Prefs.load();
    if (CreatedOrder.apply()) return;
    CreatedOrder.start();
    ReadMemory.load();
    Favorites.load();
    ReadLaterQueue.load();
    PageNav.load();
    DrawerState.load();
    CrossTabSync.start();
    Dom.ready(() => {
        installStyle();
        MiniEye.mount();
        FloatingPrefs.mount();
        PageNav.start();
        TopicBadges.start();
        Interactions.bind();
        registerMenu();
    });
})();
