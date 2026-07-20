/**
 * habit.js 单元测试
 * 覆盖：习惯排序、归档/恢复、物理删除（含记录清理）、元数据维护
 */
import { describe, it, expect, beforeEach } from 'vitest';

const Habit = window.App.Modules.Habit;
const Storage = window.App.Core.Storage;
const Utils = window.App.Core.Utils;

describe('habit.js', () => {
  beforeEach(() => {
    __resetData();
  });

  // ==================== sortHabits 排序 ====================
  describe('sortHabits 排序', () => {
    it('空数组应返回空', () => {
      expect(Habit.sortHabits([], 'time')).toEqual([]);
    });

    it('应过滤 archived 习惯', () => {
      const h1 = __makeHabit({ id: 'ar1' });
      const h2 = __makeHabit({ id: 'ar2', archived: true });
      const result = Habit.sortHabits([h1, h2], 'time');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ar1');
    });

    it('默认排序应按 timePeriod → category', () => {
      // 自定义 CATEGORY_MAP / TIME_PERIOD_MAP
      window.CATEGORY_MAP = { health: { name: '健康' }, sport: { name: '运动' } };
      window.TIME_PERIOD_MAP = {
        morning: { order: 0 },
        afternoon: { order: 1 },
        evening: { order: 2 }
      };
      const h1 = __makeHabit({ id: 'so1', timePeriod: 'evening', category: 'health' });
      const h2 = __makeHabit({ id: 'so2', timePeriod: 'morning', category: 'sport' });
      const h3 = __makeHabit({ id: 'so3', timePeriod: 'morning', category: 'health' });
      const result = Habit.sortHabits([h1, h2, h3]);
      expect(result.map(h => h.id)).toEqual(['so3', 'so2', 'so1']);
    });

    it('按 category 排序', () => {
      window.CATEGORY_MAP = { health: {}, sport: {}, study: {} };
      window.TIME_PERIOD_MAP = { morning: { order: 0 } };
      const h1 = __makeHabit({ id: 'sc1', category: 'study' });
      const h2 = __makeHabit({ id: 'sc2', category: 'health' });
      const h3 = __makeHabit({ id: 'sc3', category: 'sport' });
      const result = Habit.sortHabits([h1, h2, h3], 'category');
      expect(result.map(h => h.id)).toEqual(['sc2', 'sc3', 'sc1']);
    });

    it('按 time 排序（最近完成的在前）', () => {
      const h1 = __makeHabit({ id: 'st1' });
      const h2 = __makeHabit({ id: 'st2' });
      const h3 = __makeHabit({ id: 'st3' });
      window.habitsConfig = [h1, h2, h3];
      // h2 最近完成
      window.checkinRecords = {
        [__offsetKey(0)]: { [h2.id]: { done: true, ts: 1000000 } },
        [__offsetKey(-2)]: { [h1.id]: { done: true, ts: 500000 } }
      };
      Utils.markStatsDirty();
      const result = Habit.sortHabits([h1, h2, h3], 'time');
      expect(result[0].id).toBe('st2'); // 最近完成
    });

    it('groupBy=category 应返回分组结构', () => {
      const h1 = __makeHabit({ id: 'gc1', category: 'health' });
      const h2 = __makeHabit({ id: 'gc2', category: 'sport' });
      const h3 = __makeHabit({ id: 'gc3', category: 'health' });
      const result = Habit.sortHabits([h1, h2, h3], 'time', 'category');
      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('health');
      expect(result[0].items).toHaveLength(2);
      expect(result[1].category).toBe('sport');
      expect(result[1].items).toHaveLength(1);
    });

    it('groupBy=timePeriod 应返回时段分组', () => {
      const h1 = __makeHabit({ id: 'gt1', timePeriod: 'morning' });
      const h2 = __makeHabit({ id: 'gt2', timePeriod: 'evening' });
      const h3 = __makeHabit({ id: 'gt3', timePeriod: 'morning' });
      const result = Habit.sortHabits([h1, h2, h3], 'time', 'timePeriod');
      expect(result).toHaveLength(2);
      const morningGroup = result.find(g => g.timePeriod === 'morning');
      expect(morningGroup.items).toHaveLength(2);
    });

    it('不传 habits 应使用全局 habitsConfig', () => {
      const h = __makeHabit({ id: 'gh1' });
      window.habitsConfig = [h];
      const result = Habit.sortHabits(undefined, 'time');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('gh1');
    });
  });

  // ==================== _lastDoneTimestamp ====================
  describe('_lastDoneTimestamp 最近完成时间戳', () => {
    it('无记录应返回 -1', () => {
      const result = Habit._lastDoneTimestamp('no-record');
      expect(result).toBe(-1);
    });

    it('应返回最近的时间戳', () => {
      const h = __makeHabit({ id: 'lt1' });
      window.habitsConfig = [h];
      window.checkinRecords = {
        '2024-01-01': { [h.id]: { done: true, ts: 1000 } },
        '2024-01-03': { [h.id]: { done: true, ts: 3000 } },
        '2024-01-02': { [h.id]: { done: true, ts: 2000 } }
      };
      Utils.markStatsDirty();
      expect(Habit._lastDoneTimestamp('lt1')).toBe(3000);
    });

    it('使用 lastInterval 优先', () => {
      const h = __makeHabit({ id: 'lt2' });
      window.habitsConfig = [h];
      window.checkinRecords = {
        '2024-01-01': { [h.id]: { done: true, ts: 1000, lastInterval: 5000 } }
      };
      expect(Habit._lastDoneTimestamp('lt2')).toBe(5000);
    });

    it('无 ts 时用日期键估算', () => {
      const h = __makeHabit({ id: 'lt3' });
      window.habitsConfig = [h];
      window.checkinRecords = {
        '2024-01-15': { [h.id]: { done: true } }
      };
      const ts = Habit._lastDoneTimestamp('lt3');
      expect(ts).toBeGreaterThan(0);
    });
  });

  // ==================== archiveHabit / unarchiveHabit ====================
  describe('archiveHabit / unarchiveHabit 归档', () => {
    it('archiveHabit 应设置 archived=true', () => {
      const h = __makeHabit({ id: 'ar1' });
      window.habitsConfig = [h];
      Storage.saveConfig();

      expect(Habit.archiveHabit('ar1')).toBe(true);
      expect(window.habitsConfig[0].archived).toBe(true);
      expect(window.habitsConfig[0].enabled).toBe(false);
      expect(window.habitsConfig[0].archivedAt).toBeTypeOf('number');
    });

    it('archiveHabit 不存在的 id 应返回 false', () => {
      expect(Habit.archiveHabit('not-exists')).toBe(false);
    });

    it('unarchiveHabit 应恢复 enabled', () => {
      const h = __makeHabit({ id: 'ar2', archived: true, enabled: false, archivedAt: 123 });
      window.habitsConfig = [h];
      Storage.saveConfig();

      expect(Habit.unarchiveHabit('ar2')).toBe(true);
      expect(window.habitsConfig[0].archived).toBe(false);
      expect(window.habitsConfig[0].enabled).toBe(true);
      expect(window.habitsConfig[0].archivedAt).toBeUndefined();
    });

    it('unarchiveHabit 不存在的 id 应返回 false', () => {
      expect(Habit.unarchiveHabit('not-exists')).toBe(false);
    });

    it('归档应持久化到 localStorage', () => {
      const h = __makeHabit({ id: 'ar3' });
      window.habitsConfig = [h];
      Storage.saveConfig();
      Habit.archiveHabit('ar3');
      const saved = JSON.parse(window.localStorage.getItem('habits_config'));
      expect(saved[0].archived).toBe(true);
    });
  });

  // ==================== cleanupRecordsForHabit ====================
  describe('cleanupRecordsForHabit 孤儿记录清理', () => {
    it('应删除指定习惯的所有打卡记录', () => {
      const h1 = __makeHabit({ id: 'cl1' });
      const h2 = __makeHabit({ id: 'cl2' });
      window.habitsConfig = [h1, h2];
      window.checkinRecords = {
        '2024-01-01': { [h1.id]: { done: true }, [h2.id]: { done: true } },
        '2024-01-02': { [h1.id]: { done: true } },
        '2024-01-03': { [h2.id]: { done: true } }
      };
      Storage.saveRecords();

      const result = Habit.cleanupRecordsForHabit('cl1');
      expect(result.removed).toBe(2);
      expect(window.checkinRecords['2024-01-01'].cl1).toBeUndefined();
      expect(window.checkinRecords['2024-01-01'].cl2).toBeDefined();
      expect(window.checkinRecords['2024-01-02']).toBeUndefined(); // 空 entry 已删
      expect(window.checkinRecords['2024-01-03'].cl2).toBeDefined();
    });

    it('空日期 entry 应被删除', () => {
      const h1 = __makeHabit({ id: 'cl3' });
      window.habitsConfig = [h1];
      window.checkinRecords = {
        '2024-01-01': { [h1.id]: { done: true } }
      };
      Storage.saveRecords();
      Habit.cleanupRecordsForHabit('cl3');
      expect(window.checkinRecords['2024-01-01']).toBeUndefined();
    });

    it('不存在的 habitId 应 removed=0', () => {
      window.habitsConfig = [__makeHabit({ id: 'cl4' })];
      window.checkinRecords = { '2024-01-01': { cl4: { done: true } } };
      Storage.saveRecords();
      const result = Habit.cleanupRecordsForHabit('not-exists');
      expect(result.removed).toBe(0);
    });
  });

  // ==================== deleteHabitWithCleanup ====================
  describe('deleteHabitWithCleanup 物理删除', () => {
    it('应同时删除配置和记录', () => {
      const h = __makeHabit({ id: 'dl1' });
      window.habitsConfig = [h];
      window.checkinRecords = {
        '2024-01-01': { [h.id]: { done: true } },
        '2024-01-02': { [h.id]: { done: true } }
      };
      Storage.saveData();

      const result = Habit.deleteHabitWithCleanup('dl1');
      expect(result.ok).toBe(true);
      expect(result.removedRecords).toBe(2);
      expect(window.habitsConfig).toHaveLength(0);
      expect(window.checkinRecords['2024-01-01']).toBeUndefined();
      expect(window.checkinRecords['2024-01-02']).toBeUndefined();
    });

    it('不存在的 id 应返回 ok=false', () => {
      window.habitsConfig = [__makeHabit({ id: 'dl2' })];
      const result = Habit.deleteHabitWithCleanup('not-exists');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('not_found');
    });

    it('habitsConfig 为空数组时删除不存在的习惯应返回 not_found', () => {
      window.habitsConfig = [];
      const result = Habit.deleteHabitWithCleanup('non-existent');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('not_found');
    });
  });

  // ==================== touchLastDone / markAddedAt ====================
  describe('touchLastDone / markAddedAt 元数据维护', () => {
    it('touchLastDone 应写入 ts 字段', () => {
      const h = __makeHabit({ id: 'tl1' });
      window.habitsConfig = [h];
      const todayKey = __todayKey();
      window.checkinRecords = {
        [todayKey]: { [h.id]: { done: true, value: 1 } }
      };
      Storage.saveRecords();

      Habit.touchLastDone('tl1');
      expect(window.checkinRecords[todayKey][h.id].ts).toBeTypeOf('number');
    });

    it('touchLastDone 已有 ts 不应覆盖', () => {
      const h = __makeHabit({ id: 'tl2' });
      window.habitsConfig = [h];
      const todayKey = __todayKey();
      const origTs = 1000;
      window.checkinRecords = {
        [todayKey]: { [h.id]: { done: true, value: 1, ts: origTs } }
      };
      Storage.saveRecords();

      Habit.touchLastDone('tl2');
      expect(window.checkinRecords[todayKey][h.id].ts).toBe(origTs);
    });

    it('touchLastDone 指定日期键', () => {
      const h = __makeHabit({ id: 'tl3' });
      window.habitsConfig = [h];
      window.checkinRecords = {
        '2024-01-01': { [h.id]: { done: true } }
      };
      Storage.saveRecords();
      Habit.touchLastDone('tl3', '2024-01-01');
      expect(window.checkinRecords['2024-01-01'][h.id].ts).toBeTypeOf('number');
    });

    it('touchLastDone 不存在的记录不应抛错', () => {
      expect(() => Habit.touchLastDone('not-exists')).not.toThrow();
    });

    it('markAddedAt 应写入 addedAt', () => {
      const h = __makeHabit({ id: 'ma1' });
      window.habitsConfig = [h];
      Storage.saveConfig();
      Habit.markAddedAt('ma1');
      expect(window.habitsConfig[0].addedAt).toBeTypeOf('number');
    });

    it('markAddedAt 已有 addedAt 不应覆盖', () => {
      const origAddedAt = 1000;
      const h = __makeHabit({ id: 'ma2', addedAt: origAddedAt });
      window.habitsConfig = [h];
      Storage.saveConfig();
      Habit.markAddedAt('ma2');
      expect(window.habitsConfig[0].addedAt).toBe(origAddedAt);
    });

    it('markAddedAt 不存在的 id 不应抛错', () => {
      window.habitsConfig = [];
      expect(() => Habit.markAddedAt('not-exists')).not.toThrow();
    });
  });
});
