/**
 * Vitest 全局测试环境 setup
 * ----------------------------------------------------------------
 * 职责：
 *   1. 初始化 window.App 命名空间与 registerModule 模拟
 *   2. Mock localStorage / AudioContext / URL.createObjectURL 等浏览器 API
 *   3. 按依赖顺序加载 www/js 下的 IIFE 模块（constants → storage → utils → checkin → habit → stats → water）
 *   4. 暴露全局测试辅助方法（resetData / makeHabit 等）
 *
 * 设计要点：
 *   - 不修改源代码的模块注册方式（IIFE 内调用 App.registerModule）
 *   - 通过 vm.runInThisContext 执行脚本，让 IIFE 内部裸标识符（habitsConfig / today 等）
 *     能沿作用域链解析到 globalThis（jsdom 中 window === globalThis）
 *   - constants.js 中的 const 声明不会成为全局变量，需转换为 var 后执行
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JS_ROOT = join(__dirname, '..', 'www', 'js');

// ====================================================================
// 1. window.App 命名空间 + registerModule 模拟
// ====================================================================
// 不修改源码：源码中 `if (App.registerModule) App.registerModule(...)`
// 只需提供该方法即可，无需真实注册流程
window.App = window.App || {};
window.App.registerModule = function (name, group, deps) {
  // 记录注册顺序，便于测试断言
  window.App._registry = window.App._registry || [];
  window.App._registry.push({ name, group, deps, time: Date.now() });
};
window.App.Core = window.App.Core || {};
window.App.Modules = window.App.Modules || {};
window.App.Data = window.App.Data || {};

// ====================================================================
// 2. localStorage Mock（jsdom 已内置，但确保清空状态）
// ====================================================================
// jsdom 提供 localStorage，但每次测试需清空
beforeEach(() => {
  window.localStorage.clear();
  // 重置积分
  window.localStorage.setItem('user_points', '0');
  window.localStorage.setItem('points_history', '[]');
});

// ====================================================================
// 3. 浏览器 API Mock
// ====================================================================

// 3.1 AudioContext mock（playSound 依赖）
window.AudioContext = class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.destination = {};
  }
  createOscillator() {
    return {
      connect: () => {},
      type: '',
      frequency: { setValueAtTime: () => {} },
      start: () => {},
      stop: () => {}
    };
  }
  createGain() {
    return {
      connect: () => {},
      gain: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {}
      }
    };
  }
  resume() { this.state = 'running'; }
};
window.webkitAudioContext = window.AudioContext;

// 3.2 URL.createObjectURL / revokeObjectURL mock（exportData 依赖）
window.URL.createObjectURL = () => 'blob:mock://test';
window.URL.revokeObjectURL = () => {};

// 3.3 Blob mock（jsdom 已有，但确保可用）
if (typeof window.Blob === 'undefined') {
  window.Blob = class Blob {
    constructor(parts, options) {
      this.parts = parts;
      this.type = options?.type || '';
      this.size = parts.reduce((s, p) => s + String(p).length, 0);
    }
  };
}

// 3.4 FileReader mock（importData 依赖）
window.FileReader = class MockFileReader {
  constructor() {
    this.onload = null;
    this.result = null;
  }
  readAsText(file) {
    this.result = file._content || '';
    setTimeout(() => {
      if (this.onload) this.onload({ target: { result: this.result } });
    }, 0);
  }
};

// 3.5 alert mock（importData 的成功/失败提示）
window.alert = () => {};

// 3.6 navigator.vibrate mock（playAlarmSequence 依赖）
if (!window.navigator.vibrate) {
  Object.defineProperty(window.navigator, 'vibrate', {
    value: () => true,
    configurable: true,
    writable: true
  });
}

// 3.7 document.body / getElementById mock（flashScreen / showToast 依赖）
// jsdom 提供 document.body，但确保 #toast 元素存在
if (!window.document.getElementById('toast')) {
  const toast = window.document.createElement('div');
  toast.id = 'toast';
  window.document.body.appendChild(toast);
}

// 3.8 render / closeAllPanels mock（importData 末尾调用）
window.render = () => {};
window.closeAllPanels = () => {};

// ====================================================================
// 4. 按依赖顺序加载 IIFE 模块
// ====================================================================
/**
 * 用 vm.runInThisContext 执行脚本。
 * - IIFE 内部的 var / function 声明会进入全局
 * - const / let 是块级，不会成为全局变量
 */
function loadScript(relPath) {
  const absPath = join(JS_ROOT, relPath);
  const code = readFileSync(absPath, 'utf-8');
  // 使用绝对 file URL 作为 filename，让 V8 coverage 能正确归并到源文件
  vm.runInThisContext(code, { filename: pathToFileURL(absPath).href });
}

/**
 * 加载使用 const/let 声明全局常量的文件（如 constants.js / packs.js）。
 * 将 const/let 替换为 var 后执行，让常量成为全局变量（供其他模块 typeof 检查使用）。
 */
function loadConstAsGlobals(relPath) {
  const absPath = join(JS_ROOT, relPath);
  const code = readFileSync(absPath, 'utf-8');
  const varCode = code
    .replace(/\bconst\s+/g, 'var ')
    .replace(/\blet\s+/g, 'var ');
  vm.runInThisContext(varCode, { filename: pathToFileURL(absPath).href });
}

// 执行顺序：constants → packs → storage → utils → checkin → habit → stats → water → compat
// compat.js 是源码的兼容层：将 App.* 下的函数暴露到 window，
// 让 water.js / render.js 等使用裸标识符（getStreak / formatDate）能解析到 window。
try {
  loadConstAsGlobals('data/constants.js');
  loadConstAsGlobals('data/packs.js');  // 提供 SEASONAL_PACKS 给 utils.getCurrentSeason
  loadScript('core/storage.js');
  loadScript('core/utils.js');
  loadScript('modules/checkin.js');
  loadScript('modules/habit.js');
  loadScript('modules/stats.js');
  loadScript('modules/water.js');
  // 加载兼容层：暴露 App.* 函数到 window（不修改源码）
  loadScript('compat.js');
} catch (e) {
  console.error('[test/setup] 模块加载失败:', e);
  throw e;
}

// ====================================================================
// 5. 全局测试辅助方法
// ====================================================================
/**
 * 重置数据到初始状态（每个测试用例前调用）
 */
globalThis.__resetData = function () {
  window.localStorage.clear();
  window.localStorage.setItem('user_points', '0');
  window.localStorage.setItem('points_history', '[]');
  // 通过 storage 代理重置
  window.habitsConfig = [];
  window.checkinRecords = {};
  // 触发 storage.loadData 重新初始化
  window.App.Core.Storage.loadData();
  // 失效统计缓存
  window.App.Core.Utils.markStatsDirty();
  // 重置 viewDateOffset
  window.App.Core.Utils.setViewDateOffset(0);
};

/**
 * 构造一个习惯对象（便于测试）
 */
globalThis.__makeHabit = function (overrides = {}) {
  return Object.assign({
    id: 'test-' + Math.random().toString(36).slice(2, 8),
    name: '测试习惯',
    icon: '✅',
    type: 'boolean',
    category: 'health',
    timePeriod: 'morning',
    enabled: true,
    goal: 1
  }, overrides);
};

/**
 * 构造一条打卡记录
 */
globalThis.__makeRecord = function (overrides = {}) {
  return Object.assign({
    done: true,
    value: 1
  }, overrides);
};

/**
 * 生成指定日期的 dateKey
 */
globalThis.__dateKey = function (year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * 生成今天的 dateKey
 */
globalThis.__todayKey = function () {
  const d = new Date();
  return __dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
};

/**
 * 生成相对于今天偏移 n 天的 dateKey
 */
globalThis.__offsetKey = function (offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return __dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
};

/**
 * Mock Date.now 控制时间（用于测试时间相关逻辑）
 * 用法：__mockDate('2024-06-15T12:00:00'); ... __restoreDate();
 */
const _realDateNow = Date.now;
globalThis.__mockDate = function (isoString) {
  const fixed = new Date(isoString).getTime();
  Date.now = () => fixed;
  // 同时覆盖 new Date() 的默认行为（仅当无参数时）
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fixed);
      else super(...args);
    }
    static now() { return fixed; }
  };
  globalThis.Date.UTC = RealDate.UTC;
  globalThis.Date.parse = RealDate.parse;
};
globalThis.__restoreDate = function () {
  Date.now = _realDateNow;
  // 恢复原始 Date（通过重新赋值可能不够，但在测试间隔离即可）
};
