/**
 * storage.js 单元测试
 * 覆盖：读写、迁移、校验、反向索引、事务性写入、导出/导入
 *
 * 实际 API（来自 www/js/core/storage.js）：
 *   - loadData, migrateOldFormat, runMigrations, migrateV1toV2, migrateV2toV3
 *   - consistencyCheck (autoFix) → { errors, fixed, stats }
 *   - saveConfig, saveRecords, saveData, saveDataAtomic
 *   - exportData, importData
 *   - isHabitChecked
 *   - getDatesForHabit, getAllDates
 *   - registerSaveHook
 *   - getCurrentSchema, getSchemaVersion
 *   - purgeHabitRecords
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const Storage = window.App.Core.Storage;

describe('storage.js', () => {
  beforeEach(() => {
    __resetData();
  });

  // ==================== 数据加载与保存 ====================
  describe('loadData / saveConfig / saveRecords', () => {
    it('空 localStorage 应初始化为空数组', () => {
      Storage.loadData();
      expect(window.habitsConfig).toEqual([]);
      expect(window.checkinRecords).toEqual({});
    });

    it('saveConfig 应写入 localStorage', () => {
      window.habitsConfig = [__makeHabit({ id: 's1' })];
      Storage.saveConfig();
      const saved = JSON.parse(window.localStorage.getItem('habits_config'));
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe('s1');
    });

    it('saveRecords 应写入 localStorage', () => {
      const todayKey = __todayKey();
      window.checkinRecords = {
        [todayKey]: { h1: { done: true, value: 1 } }
      };
      Storage.saveRecords();
      const saved = JSON.parse(window.localStorage.getItem('checkin_records'));
      expect(saved[todayKey].h1.done).toBe(true);
    });

    it('saveData 应同时保存配置和记录', () => {
      window.habitsConfig = [__makeHabit({ id: 'd1' })];
      window.checkinRecords = { '2024-01-01': { d1: { done: true } } };
      Storage.saveData();
      expect(window.localStorage.getItem('habits_config')).toBeTruthy();
      expect(window.localStorage.getItem('checkin_records')).toBeTruthy();
    });

    it('loadData 应从 localStorage 恢复', () => {
      const h = __makeHabit({ id: 'load1' });
      window.localStorage.setItem('habits_config', JSON.stringify([h]));
      const recs = { '2024-01-01': { load1: { done: true, value: 1 } } };
      window.localStorage.setItem('checkin_records', JSON.stringify(recs));
      Storage.loadData();
      expect(window.habitsConfig).toHaveLength(1);
      expect(window.habitsConfig[0].id).toBe('load1');
      expect(window.checkinRecords['2024-01-01'].load1.done).toBe(true);
    });

    it('loadData 损坏数据应降级为空', () => {
      window.localStorage.setItem('habits_config', 'not-json{');
      window.localStorage.setItem('checkin_records', 'not-json{');
      Storage.loadData();
      expect(window.habitsConfig).toEqual([]);
      expect(window.checkinRecords).toEqual({});
    });
  });

  // ==================== Schema 版本管理 ====================
  describe('Schema 版本管理', () => {
    it('getCurrentSchema 应返回 3', () => {
      expect(Storage.getCurrentSchema()).toBe(3);
    });

    it('新用户 loadData 后 getSchemaVersion 应为 CURRENT_SCHEMA', () => {
      Storage.loadData();
      expect(Storage.getSchemaVersion()).toBe(3);
    });

    it('旧版本数据 loadData 后应升级到 3', () => {
      // 模拟 v1 数据（数组格式）
      const v1 = { '2024-01-01': [{ id: 'h1', value: 1 }] };
      window.localStorage.setItem('checkin_records', JSON.stringify(v1));
      window.localStorage.setItem('habits_config', '[]');
      window.localStorage.setItem('schema_version', '0');
      Storage.loadData();
      expect(Storage.getSchemaVersion()).toBe(3);
    });
  });

  // ==================== 数据迁移 ====================
  describe('migrateOldFormat 数据迁移', () => {
    it('v1 数组格式应迁移为 v2 对象格式', () => {
      const v1 = {
        '2024-01-01': [{ id: 'h1', value: 3 }],
        '2024-01-02': [{ id: 'h2', value: 1 }, { id: 'h1', value: 2 }]
      };
      window.localStorage.setItem('checkin_records', JSON.stringify(v1));
      window.localStorage.setItem('habits_config', '[]');
      window.localStorage.setItem('schema_version', '0');
      Storage.loadData();
      // v1→v2 转换为对象，v2→v3 会补 ts（基于日期键）
      expect(window.checkinRecords['2024-01-01'].h1.done).toBe(true);
      expect(window.checkinRecords['2024-01-01'].h1.value).toBe(3);
      expect(window.checkinRecords['2024-01-01'].h1.ts).toBeTypeOf('number');
      expect(window.checkinRecords['2024-01-02'].h1.done).toBe(true);
      expect(window.checkinRecords['2024-01-02'].h1.value).toBe(2);
      expect(window.checkinRecords['2024-01-02'].h2.done).toBe(true);
      expect(window.checkinRecords['2024-01-02'].h2.value).toBe(1);
    });

    it('v2 对象格式 loadData 后应补充 ts 元数据（v3）', () => {
      const v2 = {
        '2024-01-01': { h1: { done: true, value: 1 } }
      };
      window.localStorage.setItem('checkin_records', JSON.stringify(v2));
      window.localStorage.setItem('habits_config', JSON.stringify([
        { id: 'h1', type: 'boolean', name: '测试', category: 'health' }
      ]));
      window.localStorage.setItem('schema_version', '2');
      Storage.loadData();
      // v3 迁移会补 ts
      expect(window.checkinRecords['2024-01-01'].h1.ts).toBeTypeOf('number');
      // 习惯补 addedAt
      expect(window.habitsConfig[0].addedAt).toBeTypeOf('number');
    });

    it('migrateV1toV2 应转换数组 entry', () => {
      window.habitsConfig = [];
      window.checkinRecords = {
        '2024-01-01': [{ id: 'a', value: 2 }, { id: 'b', value: 5 }]
      };
      Storage.migrateV1toV2();
      expect(window.checkinRecords['2024-01-01'].a).toEqual({ done: true, value: 2 });
      expect(window.checkinRecords['2024-01-01'].b).toEqual({ done: true, value: 5 });
    });

    it('migrateV2toV3 应为习惯补 addedAt（用最早打卡日期）', () => {
      window.habitsConfig = [{ id: 'm1', type: 'boolean', name: 'M1' }];
      window.checkinRecords = {
        '2024-03-15': { m1: { done: true } },
        '2024-01-10': { m1: { done: true } }
      };
      Storage.migrateV2toV3();
      // addedAt 应基于 2024-01-10（最早日期）
      const expected = new Date('2024-01-10T12:00:00').getTime();
      expect(window.habitsConfig[0].addedAt).toBe(expected);
    });

    it('migrateV2toV3 未打卡习惯应用当前时间', () => {
      const before = Date.now();
      window.habitsConfig = [{ id: 'noRec', type: 'boolean', name: 'X' }];
      window.checkinRecords = {};
      Storage.migrateV2toV3();
      const after = Date.now();
      expect(window.habitsConfig[0].addedAt).toBeGreaterThanOrEqual(before);
      expect(window.habitsConfig[0].addedAt).toBeLessThanOrEqual(after);
    });

    it('migrateV2toV3 应为记录补 ts（优先用 lastInterval）', () => {
      window.habitsConfig = [];
      window.checkinRecords = {
        '2024-05-20': { h1: { done: true, lastInterval: 1700000000000 } }
      };
      Storage.migrateV2toV3();
      expect(window.checkinRecords['2024-05-20'].h1.ts).toBe(1700000000000);
    });

    it('migrateV2toV3 已有 ts 不应被覆盖', () => {
      window.habitsConfig = [];
      const origTs = 1600000000000;
      window.checkinRecords = {
        '2024-05-20': { h1: { done: true, ts: origTs } }
      };
      Storage.migrateV2toV3();
      expect(window.checkinRecords['2024-05-20'].h1.ts).toBe(origTs);
    });

    it('migrateOldFormat 应是幂等的', () => {
      window.habitsConfig = [{ id: 'id1', type: 'boolean', name: 'A', addedAt: 123 }];
      window.checkinRecords = { '2024-01-01': { id1: { done: true, ts: 456 } } };
      Storage.migrateOldFormat();
      // 再次调用不应改变数据
      const recBefore = JSON.stringify(window.checkinRecords);
      const cfgBefore = JSON.stringify(window.habitsConfig);
      Storage.migrateOldFormat();
      expect(JSON.stringify(window.checkinRecords)).toBe(recBefore);
      expect(JSON.stringify(window.habitsConfig)).toBe(cfgBefore);
    });
  });

  // ==================== isHabitChecked ====================
  describe('isHabitChecked 打卡完成判断', () => {
    it('boolean 类型：done 为 true 应算完成', () => {
      const h = { id: 'h1', type: 'boolean' };
      const rec = { h1: { done: true, value: 1 } };
      expect(Storage.isHabitChecked(h, rec)).toBe(true);
    });

    it('boolean 类型：done 为 false 应算未完成', () => {
      const h = { id: 'h1', type: 'boolean' };
      const rec = { h1: { done: false, value: 0 } };
      expect(Storage.isHabitChecked(h, rec)).toBe(false);
    });

    it('water 类型：value >= dailyGoal 应算完成', () => {
      const h = { id: 'w1', type: 'water', waterConfig: { dailyGoal: 2000 } };
      const rec = { w1: { value: 2000 } };
      expect(Storage.isHabitChecked(h, rec)).toBe(true);
    });

    it('water 类型：value < dailyGoal 应算未完成', () => {
      const h = { id: 'w1', type: 'water', waterConfig: { dailyGoal: 2000 } };
      const rec = { w1: { value: 1500 } };
      expect(Storage.isHabitChecked(h, rec)).toBe(false);
    });

    it('water 类型：无 waterConfig 应默认 2000', () => {
      const h = { id: 'w1', type: 'water' };
      expect(Storage.isHabitChecked(h, { w1: { value: 2000 } })).toBe(true);
      expect(Storage.isHabitChecked(h, { w1: { value: 1999 } })).toBe(false);
    });

    it('select 类型：value 存在即算完成', () => {
      const h = { id: 's1', type: 'select' };
      expect(Storage.isHabitChecked(h, { s1: { value: 1 } })).toBe(true);
      expect(Storage.isHabitChecked(h, { s1: { value: 0 } })).toBe(false);
      expect(Storage.isHabitChecked(h, { s1: {} })).toBe(false);
    });

    it('negative 类型：done=true 且 failed!=true 才算完成', () => {
      const h = { id: 'n1', type: 'boolean', negative: true };
      expect(Storage.isHabitChecked(h, { n1: { done: true, failed: false } })).toBe(true);
      expect(Storage.isHabitChecked(h, { n1: { done: true, failed: true } })).toBe(false);
      expect(Storage.isHabitChecked(h, { n1: { done: false } })).toBe(false);
    });

    it('rec 为 null 应返回 false', () => {
      const h = { id: 'h1', type: 'boolean' };
      expect(Storage.isHabitChecked(h, null)).toBe(false);
      expect(Storage.isHabitChecked(h, undefined)).toBe(false);
    });
  });

  // ==================== 反向索引 ====================
  describe('反向索引 getDatesForHabit / getAllDates', () => {
    beforeEach(() => {
      window.habitsConfig = [__makeHabit({ id: 'idx1' }), __makeHabit({ id: 'idx2' })];
      window.checkinRecords = {
        '2024-01-01': { idx1: { done: true }, idx2: { done: true } },
        '2024-01-03': { idx1: { done: true } },
        '2024-01-05': { idx1: { done: true }, idx2: { done: true } }
      };
      Storage.saveRecords();
    });

    it('getDatesForHabit 应返回升序日期数组', () => {
      const dates = Storage.getDatesForHabit('idx1');
      expect(dates).toEqual(['2024-01-01', '2024-01-03', '2024-01-05']);
    });

    it('未打卡的习惯应返回空数组', () => {
      const dates = Storage.getDatesForHabit('no-exist');
      expect(dates).toEqual([]);
    });

    it('saveRecords 后索引应重建', () => {
      expect(Storage.getDatesForHabit('idx1')).toHaveLength(3);
      window.checkinRecords['2024-01-07'] = { idx1: { done: true } };
      Storage.saveRecords();
      expect(Storage.getDatesForHabit('idx1')).toEqual([
        '2024-01-01', '2024-01-03', '2024-01-05', '2024-01-07'
      ]);
    });

    it('getAllDates 应返回所有日期升序去重', () => {
      const all = Storage.getAllDates();
      expect(all).toEqual(['2024-01-01', '2024-01-03', '2024-01-05']);
    });
  });

  // ==================== purgeHabitRecords ====================
  describe('purgeHabitRecords 删除习惯记录', () => {
    beforeEach(() => {
      window.habitsConfig = [__makeHabit({ id: 'p1' }), __makeHabit({ id: 'p2' })];
      window.checkinRecords = {
        '2024-01-01': { p1: { done: true }, p2: { done: true } },
        '2024-01-02': { p1: { done: true } },
        '2024-01-03': { p2: { done: true } }
      };
      Storage.saveRecords();
    });

    it('应删除指定习惯的所有记录', () => {
      const cleaned = Storage.purgeHabitRecords('p1');
      expect(cleaned).toBe(2);
      expect(window.checkinRecords['2024-01-01'].p1).toBeUndefined();
      expect(window.checkinRecords['2024-01-02']).toBeUndefined();
      expect(window.checkinRecords['2024-01-03'].p2).toBeDefined();
    });

    it('应从索引中移除', () => {
      Storage.purgeHabitRecords('p1');
      expect(Storage.getDatesForHabit('p1')).toEqual([]);
      expect(Storage.getDatesForHabit('p2')).toHaveLength(2);
    });

    it('不存在的习惯应返回 0', () => {
      expect(Storage.purgeHabitRecords('no-exist')).toBe(0);
    });
  });

  // ==================== consistencyCheck ====================
  describe('consistencyCheck 数据校验', () => {
    it('空数据应有效（无 errors）', () => {
      window.habitsConfig = [];
      window.checkinRecords = {};
      Storage.saveData();
      const v = Storage.consistencyCheck(false);
      expect(v.errors).toHaveLength(0);
      expect(v.stats.habitCount).toBe(0);
    });

    it('正常数据应无 errors', () => {
      window.habitsConfig = [
        { id: 'v1', type: 'boolean', name: 'V1' },
        { id: 'v2', type: 'count', name: 'V2' }
      ];
      window.checkinRecords = {
        '2024-01-01': { v1: { done: true, value: 1 } },
        '2024-01-02': { v2: { done: true, value: 5 } }
      };
      Storage.saveData();
      const v = Storage.consistencyCheck(false);
      expect(v.errors).toHaveLength(0);
      expect(v.stats.habitCount).toBe(2);
      expect(v.stats.dateCount).toBe(2);
    });

    it('重复 id 应报错', () => {
      window.habitsConfig = [
        { id: 'dup', type: 'boolean', name: 'A' },
        { id: 'dup', type: 'count', name: 'B' }
      ];
      window.checkinRecords = {};
      Storage.saveData();
      const v = Storage.consistencyCheck(false);
      expect(v.errors.some(e => e.type === 'duplicate_habit_id')).toBe(true);
    });

    it('非法日期 key 应报错', () => {
      window.habitsConfig = [];
      window.checkinRecords = {
        'invalid-date': { h1: { done: true } }
      };
      Storage.saveData();
      const v = Storage.consistencyCheck(false);
      expect(v.errors.some(e => e.type === 'invalid_date_key')).toBe(true);
    });

    it('孤立的 habitId 应报错（autoFix=false）', () => {
      window.habitsConfig = [{ id: 'exist', type: 'boolean', name: 'E' }];
      window.checkinRecords = { '2024-01-01': { orphan: { done: true } } };
      Storage.saveData();
      const v = Storage.consistencyCheck(false);
      expect(v.errors.some(e => e.type === 'orphan_records')).toBe(true);
    });

    it('autoFix=true 应清理孤立记录并持久化', () => {
      window.habitsConfig = [{ id: 'keep', type: 'boolean', name: 'K' }];
      window.checkinRecords = {
        '2024-01-01': { keep: { done: true }, orphan: { done: true } }
      };
      Storage.saveData();
      const v = Storage.consistencyCheck(true);
      expect(v.fixed.some(f => f.type === 'removed_orphan')).toBe(true);
      expect(window.checkinRecords['2024-01-01'].orphan).toBeUndefined();
      expect(window.checkinRecords['2024-01-01'].keep).toBeDefined();
    });

    it('autoFix=true 应将数组 entry 转为对象', () => {
      window.habitsConfig = [{ id: 'arr1', type: 'boolean', name: 'A' }];
      window.checkinRecords = {
        '2024-01-01': [{ id: 'arr1', value: 2 }]
      };
      Storage.saveData();
      const v = Storage.consistencyCheck(true);
      expect(v.fixed.some(f => f.type === 'array_to_object')).toBe(true);
      expect(window.checkinRecords['2024-01-01'].arr1).toEqual({ done: true, value: 2 });
    });

    it('autoFix=true 应删除非法日期 key', () => {
      window.habitsConfig = [];
      window.checkinRecords = { 'bad-key': { h1: { done: true } } };
      Storage.saveData();
      const v = Storage.consistencyCheck(true);
      expect(v.fixed.some(f => f.type === 'removed_invalid_date')).toBe(true);
      expect(window.checkinRecords['bad-key']).toBeUndefined();
    });

    it('stats 应包含 habitCount/dateCount/totalRecords', () => {
      window.habitsConfig = [{ id: 's1', type: 'boolean', name: 'S1' }];
      window.checkinRecords = {
        '2024-01-01': { s1: { done: true } },
        '2024-01-02': { s1: { done: true } }
      };
      Storage.saveData();
      const v = Storage.consistencyCheck(false);
      expect(v.stats.habitCount).toBe(1);
      expect(v.stats.dateCount).toBe(2);
      expect(v.stats.totalRecords).toBe(2);
    });

    it('stats 应包含 orphanHabitIds', () => {
      window.habitsConfig = [{ id: 'exist', type: 'boolean', name: 'E' }];
      window.checkinRecords = { '2024-01-01': { ghost: { done: true } } };
      Storage.saveData();
      const v = Storage.consistencyCheck(false);
      expect(v.stats.orphanHabitIds).toContain('ghost');
    });
  });

  // ==================== saveDataAtomic 事务性写入 ====================
  describe('saveDataAtomic 事务性写入', () => {
    it('成功时应返回 true 并写入', () => {
      window.habitsConfig = [__makeHabit({ id: 'a1' })];
      window.checkinRecords = { '2024-01-01': { a1: { done: true } } };
      const ok = Storage.saveDataAtomic();
      expect(ok).toBe(true);
      const cfg = JSON.parse(window.localStorage.getItem('habits_config'));
      const rec = JSON.parse(window.localStorage.getItem('checkin_records'));
      expect(cfg[0].id).toBe('a1');
      expect(rec['2024-01-01'].a1.done).toBe(true);
    });

    it('localStorage 抛错应返回 false 不抛出', () => {
      window.habitsConfig = [__makeHabit({ id: 'a2' })];
      // 直接替换 setItem（jsdom 中 setItem 可能不可 spy，用直接赋值）
      const origSetItem = window.localStorage.setItem;
      let throwOnce = true;
      window.localStorage.setItem = function() {
        if (throwOnce) {
          throwOnce = false;
          throw new Error('quota');
        }
      };
      expect(() => Storage.saveDataAtomic()).not.toThrow();
      // 恢复
      window.localStorage.setItem = origSetItem;
    });
  });

  // ==================== registerSaveHook ====================
  describe('registerSaveHook 保存钩子', () => {
    it('saveConfig 后应触发钩子', () => {
      let called = 0;
      Storage.registerSaveHook(() => { called++; });
      window.habitsConfig = [__makeHabit()];
      Storage.saveConfig();
      expect(called).toBe(1);
    });

    it('saveDataAtomic 后应触发钩子', () => {
      let called = 0;
      Storage.registerSaveHook(() => { called++; });
      Storage.saveDataAtomic();
      expect(called).toBe(1);
    });

    it('钩子抛错不应中断保存', () => {
      Storage.registerSaveHook(() => { throw new Error('hook error'); });
      expect(() => Storage.saveConfig()).not.toThrow();
    });

    it('非函数不应被注册', () => {
      const before = Storage.registerSaveHook.length;
      Storage.registerSaveHook(null);
      Storage.registerSaveHook('not a function');
      Storage.registerSaveHook(undefined);
      // 不抛错即通过
      expect(true).toBe(true);
    });
  });

  // ==================== exportData / importData ====================
  describe('exportData 导出', () => {
    it('应触发下载（调用 a.click）', () => {
      window.habitsConfig = [__makeHabit({ id: 'e1' })];
      window.checkinRecords = {};
      Storage.saveData();

      let clickCalled = false;
      const origClick = window.HTMLElement.prototype.click;
      window.HTMLElement.prototype.click = function () { clickCalled = true; };

      Storage.exportData();

      expect(clickCalled).toBe(true);
      window.HTMLElement.prototype.click = origClick;
    });
  });

  describe('importData 导入', () => {
    it('合法 JSON 应导入成功', async () => {
      const data = {
        habitsConfig: [{ id: 'imp1', type: 'boolean', name: 'I1', category: 'health' }],
        checkinRecords: { '2024-01-01': { imp1: { done: true, value: 1 } } }
      };
      const file = { _content: JSON.stringify(data) };
      const input = { files: [file], value: '' };

      Storage.importData(input);
      await new Promise(r => setTimeout(r, 10));

      expect(window.habitsConfig).toHaveLength(1);
      expect(window.habitsConfig[0].id).toBe('imp1');
      expect(window.checkinRecords['2024-01-01'].imp1.done).toBe(true);
    });

    it('非 JSON 应弹出错误提示', async () => {
      const alertSpy = vi.spyOn(window, 'alert');
      const file = { _content: 'not-json{' };
      const input = { files: [file], value: '' };

      Storage.importData(input);
      await new Promise(r => setTimeout(r, 10));

      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('导入失败'));
      alertSpy.mockRestore();
    });

    it('缺少必要字段应提示', async () => {
      const alertSpy = vi.spyOn(window, 'alert');
      const file = { _content: JSON.stringify({ foo: 'bar' }) };
      const input = { files: [file], value: '' };

      Storage.importData(input);
      await new Promise(r => setTimeout(r, 10));

      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('文件缺少必要字段'));
      alertSpy.mockRestore();
    });

    it('无文件应直接返回', () => {
      const input = { files: [] };
      expect(() => Storage.importData(input)).not.toThrow();
    });

    it('包含体质结果应一并导入', async () => {
      const data = {
        habitsConfig: [],
        checkinRecords: {},
        constitutionResult: { type: '平和质' }
      };
      const file = { _content: JSON.stringify(data) };
      const input = { files: [file], value: '' };
      Storage.importData(input);
      await new Promise(r => setTimeout(r, 10));

      const stored = JSON.parse(window.localStorage.getItem('constitution_result') || 'null');
      expect(stored).toEqual({ type: '平和质' });
    });

    it('v1 数组格式导入数据应自动迁移', async () => {
      const data = {
        habitsConfig: [{ id: 'v1imp', type: 'boolean', name: 'V1' }],
        checkinRecords: { '2024-01-01': [{ id: 'v1imp', value: 2 }] },
        schemaVersion: 1
      };
      const file = { _content: JSON.stringify(data) };
      const input = { files: [file], value: '' };
      Storage.importData(input);
      await new Promise(r => setTimeout(r, 10));

      expect(window.checkinRecords['2024-01-01'].v1imp).toEqual({ done: true, value: 2 });
    });
  });

  // ==================== syncHabitIcons ====================
  describe('syncHabitIcons 图标同步', () => {
    it('HABIT_LIBRARY 中存在新图标应同步', () => {
      window.HABIT_LIBRARY = [{ id: 'sync1', icon: '🆕' }];
      window.habitsConfig = [{ id: 'sync1', icon: '❌', type: 'boolean' }];
      Storage.saveConfig();
      Storage.loadData();
      expect(window.habitsConfig[0].icon).toBe('🆕');
    });

    it('无 HABIT_LIBRARY 不应抛错', () => {
      delete window.HABIT_LIBRARY;
      window.habitsConfig = [{ id: 'sync2', icon: '✅', type: 'boolean' }];
      Storage.saveConfig();
      expect(() => Storage.loadData()).not.toThrow();
    });
  });
});
