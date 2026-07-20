/**
 * checkin.js 单元测试
 * 覆盖：连续天数、最大连续天数、滑动窗口完成率、周/月完成率、一键完成、聚合统计
 */
import { describe, it, expect, beforeEach } from 'vitest';

const Checkin = window.App.Modules.Checkin;
const Utils = window.App.Core.Utils;

describe('checkin.js', () => {
  beforeEach(() => {
    __resetData();
  });

  // ==================== getStreak 连续天数 ====================
  describe('getStreak 连续打卡天数', () => {
    it('无记录应返回 0', () => {
      const h = __makeHabit({ id: 'sk1' });
      window.habitsConfig = [h];
      expect(Checkin.getStreak('sk1')).toBe(0);
    });

    it('今天已打卡应从今天起算', () => {
      const h = __makeHabit({ id: 'sk2' });
      window.habitsConfig = [h];
      const today = __todayKey();
      window.checkinRecords = { [today]: { [h.id]: { done: true, value: 1 } } };
      Utils.markStatsDirty();
      expect(Checkin.getStreak('sk2')).toBe(1);
    });

    it('连续 5 天应返回 5', () => {
      const h = __makeHabit({ id: 'sk3' });
      window.habitsConfig = [h];
      const recs = {};
      for (let i = 0; i < 5; i++) {
        const key = __offsetKey(-i);
        recs[key] = { [h.id]: { done: true, value: 1 } };
      }
      window.checkinRecords = recs;
      Utils.markStatsDirty();
      expect(Checkin.getStreak('sk3')).toBe(5);
    });

    it('今天未打卡但昨天起连续应从昨天起算（跨日不中断）', () => {
      const h = __makeHabit({ id: 'sk4' });
      window.habitsConfig = [h];
      const recs = {};
      // 昨天、前天打卡，今天未打
      for (let i = 1; i <= 3; i++) {
        const key = __offsetKey(-i);
        recs[key] = { [h.id]: { done: true, value: 1 } };
      }
      window.checkinRecords = recs;
      Utils.markStatsDirty();
      expect(Checkin.getStreak('sk4')).toBe(3);
    });

    it('中间断档应停止计数', () => {
      const h = __makeHabit({ id: 'sk5' });
      window.habitsConfig = [h];
      const recs = {};
      // 今天和昨天打卡，但前天未打
      recs[__offsetKey(0)] = { [h.id]: { done: true, value: 1 } };
      recs[__offsetKey(-1)] = { [h.id]: { done: true, value: 1 } };
      // 跳过 -2
      recs[__offsetKey(-3)] = { [h.id]: { done: true, value: 1 } };
      window.checkinRecords = recs;
      Utils.markStatsDirty();
      expect(Checkin.getStreak('sk5')).toBe(2);
    });

    it('不存在的 habitId 应返回 0', () => {
      window.habitsConfig = [__makeHabit({ id: 'exists' })];
      expect(Checkin.getStreak('not-exists')).toBe(0);
    });

    it('缓存应生效（连续两次调用返回相同结果）', () => {
      const h = __makeHabit({ id: 'sk6' });
      window.habitsConfig = [h];
      window.checkinRecords = { [__todayKey()]: { [h.id]: { done: true, value: 1 } } };
      Utils.markStatsDirty();
      const r1 = Checkin.getStreak('sk6');
      const r2 = Checkin.getStreak('sk6');
      expect(r1).toBe(r2);
      expect(r1).toBe(1);
    });
  });

  // ==================== getMaxStreak 历史最大连续 ====================
  describe('getMaxStreak 历史最大连续天数', () => {
    it('无记录应返回 0', () => {
      const h = __makeHabit({ id: 'mk1' });
      window.habitsConfig = [h];
      expect(Checkin.getMaxStreak('mk1')).toBe(0);
    });

    it('应返回历史最大值（不依赖今天）', () => {
      const h = __makeHabit({ id: 'mk2' });
      window.habitsConfig = [h];
      const recs = {};
      // 10 天前连续 7 天
      for (let i = 10; i <= 16; i++) {
        const key = __offsetKey(-i);
        recs[key] = { [h.id]: { done: true, value: 1 } };
      }
      // 今天起连续 3 天
      for (let i = 0; i < 3; i++) {
        const key = __offsetKey(-i);
        recs[key] = { [h.id]: { done: true, value: 1 } };
      }
      window.checkinRecords = recs;
      Utils.markStatsDirty();
      expect(Checkin.getMaxStreak('mk2')).toBe(7);
    });

    it('断档后重新连续应取较大值', () => {
      const h = __makeHabit({ id: 'mk3' });
      window.habitsConfig = [h];
      const recs = {};
      // 远古 4 天连续
      for (let i = 20; i <= 23; i++) {
        recs[__offsetKey(-i)] = { [h.id]: { done: true, value: 1 } };
      }
      // 最近 5 天连续
      for (let i = 0; i < 5; i++) {
        recs[__offsetKey(-i)] = { [h.id]: { done: true, value: 1 } };
      }
      window.checkinRecords = recs;
      Utils.markStatsDirty();
      expect(Checkin.getMaxStreak('mk3')).toBe(5);
    });

    it('failed=true 的 negative 习惯不应计入', () => {
      const h = __makeHabit({ id: 'mk4', type: 'boolean', negative: true });
      window.habitsConfig = [h];
      const recs = {};
      for (let i = 0; i < 5; i++) {
        recs[__offsetKey(-i)] = { [h.id]: { done: true, failed: true, value: 1 } };
      }
      window.checkinRecords = recs;
      Utils.markStatsDirty();
      expect(Checkin.getMaxStreak('mk4')).toBe(0);
    });
  });

  // ==================== getCompletionRate 滑动窗口完成率 ====================
  describe('getCompletionRate 滑动窗口完成率', () => {
    it('7 天窗口：3 天完成应返回约 43%', () => {
      const h = __makeHabit({ id: 'cr1' });
      window.habitsConfig = [h];
      const recs = {};
      for (let i = 0; i < 3; i++) {
        recs[__offsetKey(-i)] = { [h.id]: { done: true, value: 1 } };
      }
      window.checkinRecords = recs;
      Utils.markStatsDirty();
      const rate = Checkin.getCompletionRate('cr1', 7);
      expect(rate).toBe(Math.round((3 / 7) * 100)); // 43
    });

    it('30 天窗口：10 天完成应返回 33%', () => {
      const h = __makeHabit({ id: 'cr2' });
      window.habitsConfig = [h];
      const recs = {};
      for (let i = 0; i < 10; i++) {
        recs[__offsetKey(-i)] = { [h.id]: { done: true, value: 1 } };
      }
      window.checkinRecords = recs;
      Utils.markStatsDirty();
      expect(Checkin.getCompletionRate('cr2', 30)).toBe(Math.round((10 / 30) * 100)); // 33
    });

    it('365 天窗口：50 天完成应返回 14%', () => {
      const h = __makeHabit({ id: 'cr3' });
      window.habitsConfig = [h];
      const recs = {};
      for (let i = 0; i < 50; i++) {
        recs[__offsetKey(-i)] = { [h.id]: { done: true, value: 1 } };
      }
      window.checkinRecords = recs;
      Utils.markStatsDirty();
      expect(Checkin.getCompletionRate('cr3', 365)).toBe(Math.round((50 / 365) * 100)); // 14
    });

    it('无记录应返回 0', () => {
      const h = __makeHabit({ id: 'cr4' });
      window.habitsConfig = [h];
      expect(Checkin.getCompletionRate('cr4', 7)).toBe(0);
    });

    it('不计未来的打卡', () => {
      const h = __makeHabit({ id: 'cr5' });
      window.habitsConfig = [h];
      // 注入未来日期打卡（异常数据）
      window.checkinRecords = {
        [__offsetKey(2)]: { [h.id]: { done: true, value: 1 } }
      };
      Utils.markStatsDirty();
      expect(Checkin.getCompletionRate('cr5', 7)).toBe(0);
    });
  });

  // ==================== getSlidingRate 三档聚合 ====================
  describe('getSlidingRate 三档聚合', () => {
    it('应同时返回 d7 / d30 / d365', () => {
      const h = __makeHabit({ id: 'sr1' });
      window.habitsConfig = [h];
      const recs = {};
      for (let i = 0; i < 7; i++) {
        recs[__offsetKey(-i)] = { [h.id]: { done: true, value: 1 } };
      }
      window.checkinRecords = recs;
      Utils.markStatsDirty();
      const r = Checkin.getSlidingRate('sr1');
      expect(r.d7).toBe(100);
      expect(r.d30).toBe(Math.round((7 / 30) * 100));
      expect(r.d365).toBe(Math.round((7 / 365) * 100));
    });

    it('不存在的 habitId 应返回全 0', () => {
      const r = Checkin.getSlidingRate('not-exists');
      expect(r.d7).toBe(0);
      expect(r.d30).toBe(0);
      expect(r.d365).toBe(0);
    });
  });

  // ==================== getWeekRate / getMonthRate ====================
  describe('getWeekRate / getMonthRate 周/月完成率', () => {
    it('空习惯应返回 0', () => {
      expect(Checkin.getWeekRate()).toBe(0);
      expect(Checkin.getMonthRate()).toBe(0);
    });

    it('getWeekRate 应统计最近 7 天', () => {
      const h1 = __makeHabit({ id: 'wr1' });
      const h2 = __makeHabit({ id: 'wr2' });
      window.habitsConfig = [h1, h2];
      const recs = {};
      // 7 天内 h1 完成 7 次，h2 完成 3 次 = 10/14 ≈ 71%
      for (let i = 0; i < 7; i++) {
        recs[__offsetKey(-i)] = { [h1.id]: { done: true, value: 1 } };
      }
      for (let i = 0; i < 3; i++) {
        recs[__offsetKey(-i)][h2.id] = { done: true, value: 1 };
      }
      window.checkinRecords = recs;
      Utils.markStatsDirty();
      expect(Checkin.getWeekRate()).toBe(Math.round((10 / 14) * 100));
    });

    it('getMonthRate 应统计本月所有天', () => {
      const h = __makeHabit({ id: 'mr1' });
      window.habitsConfig = [h];
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const recs = {};
      // 本月每天打卡
      for (let i = 1; i <= daysInMonth; i++) {
        const key = __dateKey(now.getFullYear(), now.getMonth() + 1, i);
        // 不计未来日期
        const today = __todayKey();
        if (key <= today) {
          recs[key] = { [h.id]: { done: true, value: 1 } };
        }
      }
      window.checkinRecords = recs;
      Utils.markStatsDirty();
      const expectedDays = Object.keys(recs).length;
      const rate = Checkin.getMonthRate();
      expect(rate).toBe(Math.round((expectedDays / daysInMonth) * 100));
    });

    it('enabled=false 的习惯不应计入', () => {
      const h1 = __makeHabit({ id: 'dis1' });
      const h2 = __makeHabit({ id: 'dis2', enabled: false });
      window.habitsConfig = [h1, h2];
      window.checkinRecords = {
        [__todayKey()]: {
          [h1.id]: { done: true, value: 1 },
          [h2.id]: { done: true, value: 1 }
        }
      };
      Utils.markStatsDirty();
      // 只统计 h1（h2 disabled）
      const weekRate = Checkin.getWeekRate();
      expect(weekRate).toBeGreaterThan(0);
    });
  });

  // ==================== getMaxStreakAll 全局最大连续 ====================
  describe('getMaxStreakAll 全局最大连续', () => {
    it('空数据应返回 0', () => {
      expect(Checkin.getMaxStreakAll()).toBe(0);
    });

    it('应返回所有习惯聚合后的最大连续天数', () => {
      const h1 = __makeHabit({ id: 'ga1' });
      const h2 = __makeHabit({ id: 'ga2' });
      window.habitsConfig = [h1, h2];
      const recs = {};
      // h1 打卡第 1-5 天前
      for (let i = 1; i <= 5; i++) {
        recs[__offsetKey(-i)] = { [h1.id]: { done: true, value: 1 } };
      }
      // h2 打卡第 3-8 天前，与 h1 重叠后形成 8 天连续
      for (let i = 3; i <= 8; i++) {
        if (!recs[__offsetKey(-i)]) recs[__offsetKey(-i)] = {};
        recs[__offsetKey(-i)][h2.id] = { done: true, value: 1 };
      }
      window.checkinRecords = recs;
      Utils.markStatsDirty();
      // 第 1-8 天前每天都有打卡（1-5 h1, 3-8 h2），共 8 天
      expect(Checkin.getMaxStreakAll()).toBe(8);
    });
  });

  // ==================== getTodayDone / getTodayTotal ====================
  describe('getTodayDone / getTodayTotal 今日统计', () => {
    it('空习惯应返回 0', () => {
      expect(Checkin.getTodayDone()).toBe(0);
      expect(Checkin.getTodayTotal()).toBe(0);
    });

    it('应统计今天已完成的数量', () => {
      const h1 = __makeHabit({ id: 'td1' });
      const h2 = __makeHabit({ id: 'td2' });
      const h3 = __makeHabit({ id: 'td3' });
      window.habitsConfig = [h1, h2, h3];
      window.checkinRecords = {
        [__todayKey()]: {
          [h1.id]: { done: true, value: 1 },
          [h2.id]: { done: false, value: 0 },
          // h3 未记录
        }
      };
      Utils.markStatsDirty();
      expect(Checkin.getTodayDone()).toBe(1);
      expect(Checkin.getTodayTotal()).toBe(3);
    });

    it('enabled=false 的习惯不应计入 total', () => {
      const h1 = __makeHabit({ id: 'td4' });
      const h2 = __makeHabit({ id: 'td5', enabled: false });
      window.habitsConfig = [h1, h2];
      expect(Checkin.getTodayTotal()).toBe(1);
    });

    it('viewDateOffset 应影响"今天"判定', () => {
      const h = __makeHabit({ id: 'td6' });
      window.habitsConfig = [h];
      const yesterday = __offsetKey(-1);
      window.checkinRecords = {
        [yesterday]: { [h.id]: { done: true, value: 1 } }
      };
      Utils.markStatsDirty();
      Utils.setViewDateOffset(-1);
      expect(Checkin.getTodayDone()).toBe(1);
      Utils.setViewDateOffset(0);
    });
  });

  // ==================== buildBatchCompleteRecord 一键完成 ====================
  describe('buildBatchCompleteRecord 一键完成', () => {
    it('boolean 类型应返回 {done:true, value:1}', () => {
      const h = { type: 'boolean' };
      expect(Checkin.buildBatchCompleteRecord(h)).toEqual({ done: true, value: 1 });
    });

    it('count 类型应使用 goal', () => {
      const h = { type: 'count', goal: 8 };
      expect(Checkin.buildBatchCompleteRecord(h)).toEqual({ done: true, value: 8 });
    });

    it('count 类型无 goal 应默认 1', () => {
      const h = { type: 'count' };
      expect(Checkin.buildBatchCompleteRecord(h)).toEqual({ done: true, value: 1 });
    });

    it('timer 类型应使用 goal', () => {
      const h = { type: 'timer', goal: 1800 };
      expect(Checkin.buildBatchCompleteRecord(h)).toEqual({ done: true, value: 1800 });
    });

    it('water 类型应使用 dailyGoal', () => {
      const h = { type: 'water', waterConfig: { dailyGoal: 2500 } };
      expect(Checkin.buildBatchCompleteRecord(h)).toEqual({ done: true, value: 2500 });
    });

    it('water 类型无 waterConfig 应默认 2000', () => {
      const h = { type: 'water' };
      expect(Checkin.buildBatchCompleteRecord(h)).toEqual({ done: true, value: 2000 });
    });

    it('negative 类型应设置 failed:false', () => {
      const h = { type: 'boolean', negative: true };
      expect(Checkin.buildBatchCompleteRecord(h)).toEqual({ done: true, failed: false, value: 1 });
    });

    it('select 类型应返回 null（需手动选择）', () => {
      const h = { type: 'select' };
      expect(Checkin.buildBatchCompleteRecord(h)).toBeNull();
    });

    it('null 输入应返回 null', () => {
      expect(Checkin.buildBatchCompleteRecord(null)).toBeNull();
    });
  });

  // ==================== getHabitStats 单习惯聚合 ====================
  describe('getHabitStats 单习惯聚合统计', () => {
    it('不存在的 habitId 应返回 null', () => {
      window.habitsConfig = [__makeHabit({ id: 'hs1' })];
      expect(Checkin.getHabitStats('not-exists')).toBeNull();
    });

    it('应返回完整统计对象', () => {
      const h = __makeHabit({ id: 'hs2' });
      window.habitsConfig = [h];
      const recs = {};
      for (let i = 0; i < 5; i++) {
        recs[__offsetKey(-i)] = { [h.id]: { done: true, value: 1 } };
      }
      window.checkinRecords = recs;
      Utils.markStatsDirty();

      const stats = Checkin.getHabitStats('hs2');
      expect(stats.id).toBe('hs2');
      expect(stats.streak).toBe(5);
      expect(stats.maxStreak).toBe(5);
      expect(stats.totalDays).toBe(5);
      expect(stats.sliding).toHaveProperty('d7');
      expect(stats.sliding).toHaveProperty('d30');
      expect(stats.sliding).toHaveProperty('d365');
    });
  });

  // ==================== 跨年/跨月/闰年边界 ====================
  describe('边界情况：跨年 / 跨月 / 闰年', () => {
    it('跨年 12/31 → 1/1 应连续', () => {
      __mockDate('2024-01-01T12:00:00');
      const h = __makeHabit({ id: 'cy1' });
      window.habitsConfig = [h];
      window.checkinRecords = {
        '2023-12-30': { [h.id]: { done: true, value: 1 } },
        '2023-12-31': { [h.id]: { done: true, value: 1 } },
        '2024-01-01': { [h.id]: { done: true, value: 1 } }
      };
      Utils.markStatsDirty();
      expect(Checkin.getStreak('cy1')).toBe(3);
      __restoreDate();
    });

    it('跨月 1/31 → 2/1 应连续', () => {
      __mockDate('2024-02-01T12:00:00');
      const h = __makeHabit({ id: 'cm1' });
      window.habitsConfig = [h];
      window.checkinRecords = {
        '2024-01-30': { [h.id]: { done: true, value: 1 } },
        '2024-01-31': { [h.id]: { done: true, value: 1 } },
        '2024-02-01': { [h.id]: { done: true, value: 1 } }
      };
      Utils.markStatsDirty();
      expect(Checkin.getStreak('cm1')).toBe(3);
      __restoreDate();
    });

    it('闰年 2/29 应正常处理', () => {
      __mockDate('2024-03-01T12:00:00');
      const h = __makeHabit({ id: 'ly1' });
      window.habitsConfig = [h];
      window.checkinRecords = {
        '2024-02-28': { [h.id]: { done: true, value: 1 } },
        '2024-02-29': { [h.id]: { done: true, value: 1 } },
        '2024-03-01': { [h.id]: { done: true, value: 1 } }
      };
      Utils.markStatsDirty();
      expect(Checkin.getStreak('ly1')).toBe(3);
      __restoreDate();
    });

    it('非闰年 2/29 不应存在', () => {
      // 2023 年 2 月只有 28 天，2/29 不应被当作有效日期
      const h = __makeHabit({ id: 'nly1' });
      window.habitsConfig = [h];
      window.checkinRecords = {
        '2023-02-28': { [h.id]: { done: true, value: 1 } },
        '2023-02-29': { [h.id]: { done: true, value: 1 } } // 无效日期
      };
      Utils.markStatsDirty();
      // getStreak 从今天回溯，不应受影响
      expect(Checkin.getStreak('nly1')).toBeGreaterThanOrEqual(0);
    });

    it('空数据不抛错', () => {
      expect(() => Checkin.getStreak('empty')).not.toThrow();
      expect(() => Checkin.getMaxStreak('empty')).not.toThrow();
      expect(() => Checkin.getCompletionRate('empty', 7)).not.toThrow();
      expect(() => Checkin.getSlidingRate('empty')).not.toThrow();
      expect(() => Checkin.getMaxStreakAll()).not.toThrow();
    });
  });
});
