/**
 * utils.js 单元测试
 * 覆盖：日期格式化、农历转换、节气计算、积分系统、热力图等级、等级进度
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const Utils = window.App.Core.Utils;

describe('utils.js', () => {
  beforeEach(() => {
    __resetData();
  });

  // ==================== 日期处理 ====================
  describe('日期处理', () => {
    it('formatDate 应返回 YYYY-MM-DD 格式', () => {
      expect(Utils.formatDate(new Date(2024, 0, 1))).toBe('2024-01-01');
      expect(Utils.formatDate(new Date(2024, 5, 15))).toBe('2024-06-15');
      expect(Utils.formatDate(new Date(2024, 11, 31))).toBe('2024-12-31');
    });

    it('formatDate 应补零', () => {
      expect(Utils.formatDate(new Date(2024, 0, 5))).toBe('2024-01-05');
      expect(Utils.formatDate(new Date(2024, 9, 9))).toBe('2024-10-09');
    });

    it('today 应返回今天日期', () => {
      const d = new Date();
      const expected = Utils.formatDate(d);
      expect(Utils.today()).toBe(expected);
    });

    it('today 应受 viewDateOffset 影响', () => {
      Utils.setViewDateOffset(3);
      const d = new Date();
      d.setDate(d.getDate() + 3);
      expect(Utils.today()).toBe(Utils.formatDate(d));
      Utils.setViewDateOffset(0);
    });

    it('getDayOfWeek 应返回 0-6', () => {
      const dow = Utils.getDayOfWeek();
      expect(dow).toBeGreaterThanOrEqual(0);
      expect(dow).toBeLessThanOrEqual(6);
      expect(dow).toBe(new Date().getDay());
    });

    it('viewDateOffset getter/setter 应同步', () => {
      Utils.setViewDateOffset(5);
      expect(Utils.getViewDateOffset()).toBe(5);
      expect(window.viewDateOffset).toBe(5);
      Utils.setViewDateOffset(0);
    });
  });

  // ==================== 农历转换 ====================
  describe('农历转换 getLunarDate', () => {
    it('2024-02-10 应为甲辰年正月初一（春节）', () => {
      const r = Utils.getLunarDate(new Date(2024, 1, 10));
      expect(r.year).toBe(2024);
      expect(r.month).toBe(1);
      expect(r.day).toBe(1);
      expect(r.monthStr).toBe('正');
      expect(r.dayStr).toBe('初一');
      expect(r.isLeap).toBe(false);
    });

    it('2024-02-09 应为腊月三十（除夕）', () => {
      const r = Utils.getLunarDate(new Date(2024, 1, 9));
      expect(r.month).toBe(12);
      expect(r.day).toBe(30);
      expect(r.dayStr).toBe('三十');
    });

    it('2023-06-22 应为农历五月初五（端午）', () => {
      const r = Utils.getLunarDate(new Date(2023, 5, 22));
      expect(r.month).toBe(5);
      expect(r.day).toBe(5);
      expect(r.dayStr).toBe('初五');
    });

    it('2024-06-10 应为农历五月初五（端午）', () => {
      const r = Utils.getLunarDate(new Date(2024, 5, 10));
      expect(r.month).toBe(5);
      expect(r.day).toBe(5);
    });

    it('闰年 2025 有闰六月', () => {
      // 2025 年有闰六月，验证闰月逻辑不抛错
      const r = Utils.getLunarDate(new Date(2025, 6, 25));
      expect(r.year).toBe(2025);
      expect(typeof r.month).toBe('number');
      expect(typeof r.isLeap).toBe('boolean');
    });

    it('lYearDays 应返回合理天数（354 或 384 左右）', () => {
      const days2024 = Utils.lYearDays(2024);
      expect(days2024).toBeGreaterThanOrEqual(353);
      expect(days2024).toBeLessThanOrEqual(385);
    });

    it('leapMonth 应返回闰月月份（0 表示无闰月）', () => {
      // 2024 年无闰月
      expect(Utils.leapMonth(2024)).toBe(0);
      // 2025 年闰六月
      expect(Utils.leapMonth(2025)).toBe(6);
    });

    it('leapDays 应返回闰月天数', () => {
      expect(Utils.leapDays(2024)).toBe(0);
      expect(Utils.leapDays(2025)).toBeGreaterThanOrEqual(29);
      expect(Utils.leapDays(2025)).toBeLessThanOrEqual(30);
    });

    it('monthDays 应返回 29 或 30', () => {
      const d = Utils.monthDays(2024, 1);
      expect([29, 30]).toContain(d);
    });
  });

  // ==================== 节气计算 ====================
  describe('节气 getCurrentSolarTerm', () => {
    it('春节附近应返回立春或雨水', () => {
      __mockDate('2024-02-04T12:00:00');
      const term = Utils.getCurrentSolarTerm();
      expect(term).not.toBeNull();
      expect(['立春', '雨水']).toContain(term.name);
      __restoreDate();
    });

    it('夏至附近应返回夏至', () => {
      __mockDate('2024-06-21T12:00:00');
      const term = Utils.getCurrentSolarTerm();
      expect(term.name).toBe('夏至');
      __restoreDate();
    });

    it('冬至附近应返回冬至', () => {
      __mockDate('2024-12-21T12:00:00');
      const term = Utils.getCurrentSolarTerm();
      expect(['冬至', '小寒', '大雪']).toContain(term.name);
      __restoreDate();
    });

    it('节气对象应包含完整字段', () => {
      const term = Utils.getCurrentSolarTerm();
      expect(term).toHaveProperty('name');
      expect(term).toHaveProperty('month');
      expect(term).toHaveProperty('day');
      expect(term).toHaveProperty('emoji');
      expect(term).toHaveProperty('season');
      expect(term).toHaveProperty('tip');
    });
  });

  // ==================== 季节判断 ====================
  describe('季节 getCurrentSeason / getSeasonPack', () => {
    it('3 月应为春季', () => {
      __mockDate('2024-03-15T12:00:00');
      expect(Utils.getCurrentSeason()).toBe('spring');
      __restoreDate();
    });

    it('7 月应为夏季', () => {
      __mockDate('2024-07-15T12:00:00');
      expect(Utils.getCurrentSeason()).toBe('summer');
      __restoreDate();
    });

    it('10 月应为秋季', () => {
      __mockDate('2024-10-15T12:00:00');
      expect(Utils.getCurrentSeason()).toBe('autumn');
      __restoreDate();
    });

    it('12 月应为冬季', () => {
      __mockDate('2024-12-15T12:00:00');
      expect(Utils.getCurrentSeason()).toBe('winter');
      __restoreDate();
    });

    it('getSeasonPack 应返回季节信息', () => {
      const pack = Utils.getSeasonPack('spring');
      expect(pack.name).toBe('春天养生包');
      expect(pack.focus).toBe('养肝舒展，早睡早起');
      expect(pack.emoji).toBeTruthy();
    });

    it('getSeasonPack 未知季节应返回春季兜底', () => {
      const pack = Utils.getSeasonPack('unknown');
      expect(pack.name).toBe('春天养生包');
    });
  });

  // ==================== 时辰 ====================
  describe('时辰 getCurrentShichen', () => {
    it('应返回时辰对象', () => {
      const sc = Utils.getCurrentShichen();
      expect(sc).toHaveProperty('id');
      expect(sc).toHaveProperty('name');
      expect(sc).toHaveProperty('start');
      expect(sc).toHaveProperty('end');
    });
  });

  // ==================== 热力图等级 ====================
  describe('热力图 getHeatmapLevel', () => {
    it('0 应返回 0', () => {
      expect(Utils.getHeatmapLevel(0)).toBe(0);
    });
    it('0.1 应返回 1', () => {
      expect(Utils.getHeatmapLevel(0.1)).toBe(1);
    });
    it('0.25 应返回 1（边界）', () => {
      expect(Utils.getHeatmapLevel(0.25)).toBe(1);
    });
    it('0.3 应返回 2', () => {
      expect(Utils.getHeatmapLevel(0.3)).toBe(2);
    });
    it('0.5 应返回 2（边界）', () => {
      expect(Utils.getHeatmapLevel(0.5)).toBe(2);
    });
    it('0.6 应返回 3', () => {
      expect(Utils.getHeatmapLevel(0.6)).toBe(3);
    });
    it('0.75 应返回 3（边界）', () => {
      expect(Utils.getHeatmapLevel(0.75)).toBe(3);
    });
    it('0.8 应返回 4', () => {
      expect(Utils.getHeatmapLevel(0.8)).toBe(4);
    });
    it('1.0 应返回 4', () => {
      expect(Utils.getHeatmapLevel(1.0)).toBe(4);
    });
  });

  // ==================== 等级系统 ====================
  describe('等级系统', () => {
    beforeEach(() => {
      // 注入 3 天连续打卡数据，达到"养生学徒"
      const h = __makeHabit({ id: 'lvl-test' });
      window.habitsConfig = [h];
      const todayKey = __todayKey();
      const recs = {};
      for (let i = 0; i < 3; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = __dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
        recs[key] = { [h.id]: { done: true, value: 1 } };
      }
      window.checkinRecords = recs;
      Utils.markStatsDirty();
    });

    it('getCurrentStreak 应返回 3', () => {
      expect(Utils.getCurrentStreak()).toBe(3);
    });

    it('getCurrentLevel 应返回学徒等级', () => {
      const lv = Utils.getCurrentLevel();
      expect(lv.level).toBe(2);
      expect(lv.name).toBe('养生学徒');
      expect(lv.minDays).toBe(3);
    });

    it('getNextLevel 应返回下一级', () => {
      const next = Utils.getNextLevel();
      expect(next).not.toBeNull();
      expect(next.level).toBe(3);
    });

    it('getLevelProgress 应返回 0-100', () => {
      const p = Utils.getLevelProgress();
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    });

    it('最高等级时 getNextLevel 应返回 null', () => {
      // 注入 30+ 天数据达到最高级
      const h = window.habitsConfig[0];
      const recs = {};
      for (let i = 0; i < 35; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = __dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
        recs[key] = { [h.id]: { done: true, value: 1 } };
      }
      window.checkinRecords = recs;
      Utils.markStatsDirty();
      expect(Utils.getNextLevel()).toBeNull();
      expect(Utils.getLevelProgress()).toBe(100);
    });

    it('空数据时 getCurrentLevel 应返回新手', () => {
      __resetData();
      const lv = Utils.getCurrentLevel();
      expect(lv.level).toBe(1);
      expect(lv.name).toBe('养生小白');
    });
  });

  // ==================== 积分系统 ====================
  describe('积分系统', () => {
    it('getUserPoints 初始应为 0', () => {
      expect(Utils.getUserPoints()).toBe(0);
    });

    it('addPoints 应累加积分', () => {
      Utils.addPoints(10, '测试');
      expect(Utils.getUserPoints()).toBe(10);
      Utils.addPoints(5, '测试2');
      expect(Utils.getUserPoints()).toBe(15);
    });

    it('addPoints 应记录历史', () => {
      Utils.addPoints(10, '完成习惯');
      const history = JSON.parse(window.localStorage.getItem('points_history') || '[]');
      expect(history).toHaveLength(1);
      expect(history[0].amount).toBe(10);
      expect(history[0].reason).toBe('完成习惯');
      expect(history[0].total).toBe(10);
    });

    it('addPoints 历史超过 100 条应裁剪', () => {
      for (let i = 0; i < 110; i++) {
        Utils.addPoints(1, 'test' + i);
      }
      const history = JSON.parse(window.localStorage.getItem('points_history') || '[]');
      expect(history).toHaveLength(100);
    });

    it('checkinReward 应有正确配置', () => {
      expect(Utils.checkinReward.perHabit).toBe(1);
      expect(Utils.checkinReward.allDoneBonus).toBe(5);
    });

    it('checkAllDoneBonus 今天未完成应返回 false', () => {
      window.habitsConfig = [__makeHabit(), __makeHabit()];
      expect(Utils.checkAllDoneBonus()).toBe(false);
    });

    it('checkAllDoneBonus 全部完成应返回 true 并标记', () => {
      const h1 = __makeHabit({ id: 'c1' });
      const h2 = __makeHabit({ id: 'c2' });
      window.habitsConfig = [h1, h2];
      const todayKey = __todayKey();
      window.checkinRecords = {
        [todayKey]: {
          [h1.id]: { done: true, value: 1 },
          [h2.id]: { done: true, value: 1 }
        }
      };
      Utils.markStatsDirty();
      // mock getTodayDone
      window.getTodayDone = () => 2;
      expect(Utils.checkAllDoneBonus()).toBe(true);
      // 再次调用应返回 false（已发放）
      expect(Utils.checkAllDoneBonus()).toBe(false);
      delete window.getTodayDone;
    });
  });

  // ==================== 统计缓存 ====================
  describe('统计缓存 cachedStat / markStatsDirty', () => {
    it('缓存应只计算一次', () => {
      let count = 0;
      const r1 = Utils.cachedStat('test-key', () => { count++; return 'value'; });
      const r2 = Utils.cachedStat('test-key', () => { count++; return 'other'; });
      expect(r1).toBe('value');
      expect(r2).toBe('value');
      expect(count).toBe(1);
    });

    it('markStatsDirty 应失效缓存', () => {
      let count = 0;
      Utils.cachedStat('test-key2', () => { count++; return 1; });
      Utils.markStatsDirty();
      Utils.cachedStat('test-key2', () => { count++; return 2; });
      expect(count).toBe(2);
    });
  });

  // ==================== HTML 转义 ====================
  describe('esc HTML 转义', () => {
    it('应转义特殊字符', () => {
      expect(window.esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(window.esc('"hello"')).toBe('&quot;hello&quot;');
      expect(window.esc("it's")).toBe('it&#39;s');
      expect(window.esc('a & b')).toBe('a &amp; b');
    });

    it('null/undefined 应返回空字符串', () => {
      expect(window.esc(null)).toBe('');
      expect(window.esc(undefined)).toBe('');
    });

    it('非字符串应转为字符串', () => {
      expect(window.esc(123)).toBe('123');
    });
  });

  // ==================== getTotalCheckins / 完成率 ====================
  describe('getTotalCheckins / getTodayCompletionRate', () => {
    beforeEach(() => {
      const h1 = __makeHabit({ id: 'tc1' });
      const h2 = __makeHabit({ id: 'tc2' });
      window.habitsConfig = [h1, h2];
      const t = __todayKey();
      const y = __offsetKey(-1);
      window.checkinRecords = {
        [t]: { [h1.id]: { done: true, value: 1 } },
        [y]: { [h1.id]: { done: true, value: 1 }, [h2.id]: { done: true, value: 1 } }
      };
      Utils.markStatsDirty();
    });

    it('getTotalCheckins 应统计所有打卡数', () => {
      expect(Utils.getTotalCheckins()).toBe(3);
    });

    it('getTodayCompletionRate 应返回今日完成百分比', () => {
      // 今天只有 1/2 完成
      expect(Utils.getTodayCompletionRate()).toBe(50);
    });

    it('空习惯时完成率应为 0', () => {
      __resetData();
      expect(Utils.getTodayCompletionRate()).toBe(0);
      expect(Utils.getTotalCheckins()).toBe(0);
    });
  });

  // ==================== showToast / playSound / flashScreen ====================
  describe('DOM 相关函数', () => {
    it('showToast 应设置 #toast 文本', () => {
      Utils.showToast('测试消息');
      const toast = window.document.getElementById('toast');
      expect(toast.textContent).toBe('测试消息');
      expect(toast.classList.contains('show')).toBe(true);
    });

    it('playSound 不应抛出异常', () => {
      expect(() => Utils.playSound('checkin')).not.toThrow();
      expect(() => Utils.playSound('complete')).not.toThrow();
      expect(() => Utils.playSound('unlock')).not.toThrow();
      expect(() => Utils.playSound('reminder')).not.toThrow();
      expect(() => Utils.playSound('alarm')).not.toThrow();
      expect(() => Utils.playSound('unknown')).not.toThrow();
    });

    it('flashScreen 应创建 overlay 元素', () => {
      Utils.flashScreen();
      const overlay = window.document.querySelector('.alarm-flash');
      expect(overlay).not.toBeNull();
    });

    it('playAlarmSequence 应启动定时器', () => {
      expect(() => Utils.playAlarmSequence()).not.toThrow();
    });
  });
});
