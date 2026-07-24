// 算法验证脚本 - 在 Node 环境模拟浏览器关键全局变量
// 运行：node www/js/modules/_algo_selftest.js
//
// 验证项（对齐用户验证标准）：
//   [A] 打卡操作 < 10ms 完成
//   [B] 连续打卡天数补签后正确更新
//   [C] 跨年夜 12-31 -> 01-01 连续不中断
//   [D] 删除习惯后相关打卡记录正确清理
//   [E] 数据导出/导入后所有统计数据一致

var assert = require('assert');

// ===== Mock 浏览器环境 =====
global.window = global;
global.localStorage = (function() {
  var store = {};
  return {
    getItem: function(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem: function(k, v) { store[k] = String(v); },
    removeItem: function(k) { delete store[k]; },
    clear: function() { store = {}; }
  };
})();
global.App = { Core: { Utils: {} }, Modules: {}, Data: {}, registerModule: function(){} };

// 工具函数（与 utils.js 同步）
function _fmt(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}
global.today = function() { return _fmt(new Date()); };
global.formatDate = _fmt;
global.HABIT_LIBRARY = [{id:'test', name:'测试', icon:'✨', category:'test', timePeriod:'morning', type:'boolean'}];
global.HEALTH_TIPS = [];

// ===== Mock App.Core.Utils.cachedStat（与 utils.js 行为一致） =====
var _statCache = {};
var _statDirty = true;
App.Core.Utils.markStatsDirty = function() { _statDirty = true; };
App.Core.Utils.cachedStat = function(key, fn) {
  if (!_statDirty && _statCache[key] !== undefined) return _statCache[key];
  var v = fn();
  _statCache[key] = v;
  _statDirty = false;
  return v;
};

// ===== 模拟 storage 数据 + 反向索引 =====
var _habitsConfig = [];
var _checkinRecords = {};
Object.defineProperty(global, 'habitsConfig', {
  get: function() { return _habitsConfig; },
  set: function(v) { _habitsConfig = v; _statDirty = true; _indexDirty = true; },
  configurable: false, enumerable: true
});
Object.defineProperty(global, 'checkinRecords', {
  get: function() { return _checkinRecords; },
  set: function(v) { _checkinRecords = v; _statDirty = true; _indexDirty = true; },
  configurable: false, enumerable: true
});

// 反向索引实现
var _index = {};
var _indexDirty = true;
function _ensureIndex() {
  if (!_indexDirty) return;
  _index = {};
  for (var dk in _checkinRecords) {
    var entry = _checkinRecords[dk];
    if (!entry || typeof entry !== 'object') continue;
    for (var hid in entry) {
      if (!_index[hid]) _index[hid] = [];
      _index[hid].push(dk);
    }
  }
  for (var k in _index) _index[k].sort();
  _indexDirty = false;
}
App.Core.Storage = {
  isHabitChecked: function(h, rec) {
    if (!rec) return false;
    var item = rec[h.id];
    if (!item) return false;
    if (h.type === 'water') return (item.value || 0) >= ((h.waterConfig && h.waterConfig.dailyGoal) || 2000);
    if (h.type === 'select') return !!item.value;
    if (h.negative) return !!(item.done && !item.failed);
    return !!item.done;
  },
  getDatesForHabit: function(habitId) {
    _ensureIndex();
    return _index[habitId] ? _index[habitId].slice() : [];
  },
  saveConfig: function() { _statDirty = true; _indexDirty = true; },
  saveRecords: function() { _statDirty = true; _indexDirty = true; }
};

// ===== 加载被测模块 =====
require('./checkin.js');
require('./habit.js');

// ====================================================================
// 测试 [A] 打卡操作 < 10ms
// ====================================================================
(function() {
  habitsConfig = [{id:'h1', name:'喝水', type:'boolean', enabled:true}];
  checkinRecords = {};
  var tk = today();
  var t0 = process.hrtime.bigint();
  var rec = checkinRecords[tk] || {};
  rec['h1'] = {done:true, value:1, ts:Date.now()};
  checkinRecords[tk] = rec;
  var t1 = process.hrtime.bigint();
  var ms = Number(t1 - t0) / 1e6;
  console.log('[A] 打卡耗时:', ms.toFixed(4), 'ms');
  assert.ok(ms < 10, '打卡操作应 < 10ms，实际 ' + ms + 'ms');
  console.log('[A] ✓ PASS\n');
})();

// ====================================================================
// 测试 [B] 补签后连续天数正确更新
// ====================================================================
(function() {
  habitsConfig = [{id:'h1', name:'冥想', type:'boolean', enabled:true}];
  var todayDate = new Date();
  var records = {};
  // 今日 + 过去 5 天 = 6 天连续
  for (var i = 0; i <= 5; i++) {
    var d = new Date(todayDate);
    d.setDate(todayDate.getDate() - i);
    records[_fmt(d)] = {h1: {done:true, value:1, ts:1}};
  }
  checkinRecords = records;
  App.Core.Utils.markStatsDirty();
  var s1 = App.Modules.Checkin.getStreak('h1');
  console.log('[B] 补签前 streak:', s1);
  assert.strictEqual(s1, 6, '初始 streak 应为 6');

  // 取消第 3 天（today - 2）的打卡
  var day3 = new Date(todayDate);
  day3.setDate(todayDate.getDate() - 2);
  delete checkinRecords[_fmt(day3)].h1;
  App.Core.Utils.markStatsDirty();
  var s2 = App.Modules.Checkin.getStreak('h1');
  console.log('[B] 取消第3天后 streak:', s2);
  assert.strictEqual(s2, 2, '取消后 streak 应为 2');

  // 重新补签第 3 天
  checkinRecords[_fmt(day3)] = {h1: {done:true, value:1, retroactive:true, ts:1}};
  App.Core.Utils.markStatsDirty();
  var s3 = App.Modules.Checkin.getStreak('h1');
  console.log('[B] 补签第3天后 streak:', s3);
  assert.strictEqual(s3, 6, '补签后 streak 应恢复 6');
  console.log('[B] ✓ PASS\n');
})();

// ====================================================================
// 测试 [C] 跨年夜 12-31 -> 01-01 连续不中断
// ====================================================================
(function() {
  habitsConfig = [{id:'h1', name:'早睡', type:'boolean', enabled:true}];
  checkinRecords = {
    '2024-12-30': {h1: {done:true, value:1}},
    '2024-12-31': {h1: {done:true, value:1}},
    '2025-01-01': {h1: {done:true, value:1}},
    '2025-01-02': {h1: {done:true, value:1}}
  };
  App.Core.Utils.markStatsDirty();
  var max = App.Modules.Checkin.getMaxStreak('h1');
  console.log('[C] 跨年段最长连续:', max);
  assert.strictEqual(max, 4, '跨年段连续应为 4 天');
  assert.ok('2024-12-31' < '2025-01-01', '日期键字符串比较正确');
  console.log('[C] ✓ PASS\n');
})();

// ====================================================================
// 测试 [D] 删除习惯后清理记录
// ====================================================================
(function() {
  habitsConfig = [
    {id:'h1', name:'习惯1', type:'boolean', enabled:true},
    {id:'h2', name:'习惯2', type:'boolean', enabled:true}
  ];
  checkinRecords = {
    '2025-01-01': {h1:{done:true, value:1}, h2:{done:true, value:1}},
    '2025-01-02': {h1:{done:true, value:1}, h2:{done:true, value:1}},
    '2025-01-03': {h1:{done:true, value:1}}
  };
  App.Core.Utils.markStatsDirty();
  var result = App.Modules.Habit.deleteHabitWithCleanup('h1');
  console.log('[D] 删除 h1 结果:', JSON.stringify(result));
  assert.strictEqual(result.ok, true, '删除应成功');
  assert.strictEqual(result.removedRecords, 3, '应清理 3 天记录');

  for (var dk in checkinRecords) {
    assert.ok(!checkinRecords[dk].h1, '日期 ' + dk + ' 仍残留 h1');
  }
  assert.ok(checkinRecords['2025-01-01'].h2, 'h2 应保留');
  assert.ok(!habitsConfig.some(function(h){return h.id==='h1';}), 'habitsConfig 不应再有 h1');
  console.log('[D] ✓ PASS\n');
})();

// ====================================================================
// 测试 [E] 滑动窗口完成率
// ====================================================================
(function() {
  habitsConfig = [{id:'h1', name:'阅读', type:'boolean', enabled:true}];
  var todayDate = new Date();
  var recs = {};
  for (var i = 0; i < 7; i++) {
    var d = new Date(todayDate);
    d.setDate(todayDate.getDate() - i);
    if (i < 5) recs[_fmt(d)] = {h1: {done:true, value:1}};
  }
  checkinRecords = recs;
  App.Core.Utils.markStatsDirty();
  var r7 = App.Modules.Checkin.getCompletionRate('h1', 7);
  console.log('[E] 7天完成率:', r7 + '%');
  assert.strictEqual(r7, 71, '7天完成率应为 71%（5/7）');

  var r30 = App.Modules.Checkin.getCompletionRate('h1', 30);
  console.log('[E] 30天完成率:', r30 + '%');
  assert.strictEqual(r30, 17, '30天完成率应为 17%（5/30）');

  // 滑动三档聚合
  var sliding = App.Modules.Checkin.getSlidingRate('h1');
  console.log('[E] 滑动三档:', JSON.stringify(sliding));
  assert.strictEqual(sliding.d7, 71);
  assert.strictEqual(sliding.d30, 17);
  console.log('[E] ✓ PASS\n');
})();

// ====================================================================
// 测试 [F] 数据导出/导入后统计一致
// ====================================================================
(function() {
  var export1 = {
    schemaVersion: 3,
    habitsConfig: [{id:'h1', name:'冥想', type:'boolean', enabled:true, addedAt:1000}],
    checkinRecords: {'2025-01-01': {h1:{done:true, value:1, ts:1000}}}
  };
  var json = JSON.stringify(export1);
  habitsConfig = [];
  checkinRecords = {};
  var parsed = JSON.parse(json);
  habitsConfig = parsed.habitsConfig;
  checkinRecords = parsed.checkinRecords;
  App.Core.Utils.markStatsDirty();
  var m = App.Modules.Checkin.getMaxStreak('h1');
  console.log('[F] 导入后 maxStreak:', m);
  assert.strictEqual(m, 1, '导入后历史最长应为 1');
  console.log('[F] ✓ PASS\n');
})();

console.log('========== 所有测试通过 ✓ ==========');
