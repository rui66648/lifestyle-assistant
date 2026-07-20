/**
 * water.js 单元测试
 * 覆盖：饮水追踪渲染、目标计算、杯数换算、间隔提醒
 */
import { describe, it, expect, beforeEach } from 'vitest';

const Water = window.App.Modules.Water;
const Utils = window.App.Core.Utils;

describe('water.js', () => {
  beforeEach(() => {
    __resetData();
  });

  describe('renderWaterTracker 饮水追踪渲染', () => {
    it('应渲染基本结构（默认配置 2000ml / 250ml）', () => {
      const h = __makeHabit({
        id: 'w1',
        type: 'water',
        name: '喝水',
        icon: '💧',
        waterConfig: { dailyGoal: 2000, perCup: 250 }
      });
      window.habitsConfig = [h];
      window.checkinRecords = {};
      Utils.markStatsDirty();

      const html = Water.renderWaterTracker(h, {});
      expect(html).toContain('water-tracker');
      expect(html).toContain('2000ml');
      expect(html).toContain('250ml');
      expect(html).toContain('8杯'); // 2000/250=8
    });

    it('应正确显示已喝杯数和百分比', () => {
      const h = __makeHabit({
        id: 'w2',
        type: 'water',
        waterConfig: { dailyGoal: 2000, perCup: 250 }
      });
      window.habitsConfig = [h];
      window.checkinRecords = {
        [__todayKey()]: {
          [h.id]: { done: false, value: 500, cups: [{ time: '08:00', amount: 250 }, { time: '10:00', amount: 250 }] }
        }
      };
      Utils.markStatsDirty();

      const html = Water.renderWaterTracker(h, window.checkinRecords[__todayKey()]);
      expect(html).toContain('2杯');    // 已喝 2 杯
      expect(html).toContain('500ml');  // 已喝 500ml
      expect(html).toContain('25%');    // 500/2000=25%
    });

    it('达成目标应显示庆祝消息', () => {
      const h = __makeHabit({
        id: 'w3',
        type: 'water',
        waterConfig: { dailyGoal: 1000, perCup: 250 }
      });
      window.habitsConfig = [h];
      window.checkinRecords = {
        [__todayKey()]: {
          [h.id]: { done: true, value: 1000 }
        }
      };
      Utils.markStatsDirty();

      const html = Water.renderWaterTracker(h, window.checkinRecords[__todayKey()]);
      expect(html).toContain('今日目标已达成');
      expect(html).toContain('🎉');
    });

    it('未达目标应显示"还需 X 杯"', () => {
      const h = __makeHabit({
        id: 'w4',
        type: 'water',
        waterConfig: { dailyGoal: 2000, perCup: 250 }
      });
      window.habitsConfig = [h];
      window.checkinRecords = {
        [__todayKey()]: {
          [h.id]: { done: false, value: 500 }
        }
      };
      Utils.markStatsDirty();

      const html = Water.renderWaterTracker(h, window.checkinRecords[__todayKey()]);
      // 还需 (2000-500)/250 = 6 杯
      expect(html).toContain('还需 6杯');
    });

    it('无 waterConfig 应使用默认值', () => {
      const h = __makeHabit({ id: 'w5', type: 'water', name: '喝水' });
      window.habitsConfig = [h];
      window.checkinRecords = {};
      Utils.markStatsDirty();

      const html = Water.renderWaterTracker(h, {});
      expect(html).toContain('2000ml');
      expect(html).toContain('250ml');
    });

    it('杯数可视化应渲染总杯数个杯子', () => {
      const h = __makeHabit({
        id: 'w6',
        type: 'water',
        waterConfig: { dailyGoal: 1000, perCup: 200 } // 5 杯
      });
      window.habitsConfig = [h];
      window.checkinRecords = {};
      Utils.markStatsDirty();

      const html = Water.renderWaterTracker(h, {});
      // 应有 5 个 water-cup-item
      const matches = html.match(/water-cup-item/g) || [];
      expect(matches.length).toBe(5);
    });

    it('已喝的杯子应标记 filled', () => {
      const h = __makeHabit({
        id: 'w7',
        type: 'water',
        waterConfig: { dailyGoal: 1000, perCup: 200 }
      });
      window.habitsConfig = [h];
      window.checkinRecords = {
        [__todayKey()]: {
          [h.id]: { value: 400 } // 2 杯
        }
      };
      Utils.markStatsDirty();

      const html = Water.renderWaterTracker(h, window.checkinRecords[__todayKey()]);
      const filledMatches = html.match(/water-cup filled/g) || [];
      expect(filledMatches.length).toBe(2);
    });

    it('下一杯应标记 next', () => {
      const h = __makeHabit({
        id: 'w8',
        type: 'water',
        waterConfig: { dailyGoal: 1000, perCup: 200 }
      });
      window.habitsConfig = [h];
      window.checkinRecords = {
        [__todayKey()]: {
          [h.id]: { value: 400 } // 第 3 杯是 next
        }
      };
      Utils.markStatsDirty();

      const html = Water.renderWaterTracker(h, window.checkinRecords[__todayKey()]);
      expect(html).toContain('next');
    });

    it('pct >= 80 应使用 high 样式', () => {
      const h = __makeHabit({
        id: 'w9',
        type: 'water',
        waterConfig: { dailyGoal: 1000, perCup: 100 }
      });
      window.habitsConfig = [h];
      window.checkinRecords = {
        [__todayKey()]: {
          [h.id]: { value: 850 } // 85%
        }
      };
      Utils.markStatsDirty();

      const html = Water.renderWaterTracker(h, window.checkinRecords[__todayKey()]);
      expect(html).toContain('high');
    });

    it('pct >= 50 应使用 mid 样式', () => {
      const h = __makeHabit({
        id: 'w10',
        type: 'water',
        waterConfig: { dailyGoal: 1000, perCup: 100 }
      });
      window.habitsConfig = [h];
      window.checkinRecords = {
        [__todayKey()]: {
          [h.id]: { value: 600 } // 60%
        }
      };
      Utils.markStatsDirty();

      const html = Water.renderWaterTracker(h, window.checkinRecords[__todayKey()]);
      expect(html).toContain('mid');
    });

    it('首次未喝水应显示鼓励提示', () => {
      const h = __makeHabit({
        id: 'w11',
        type: 'water',
        waterConfig: { dailyGoal: 2000, perCup: 250 }
      });
      window.habitsConfig = [h];
      window.checkinRecords = {};
      Utils.markStatsDirty();

      const html = Water.renderWaterTracker(h, {});
      expect(html).toContain('今天还没喝水');
    });

    it('超过 2 小时未喝水应显示提醒', () => {
      const h = __makeHabit({
        id: 'w12',
        type: 'water',
        waterConfig: { dailyGoal: 2000, perCup: 250 }
      });
      window.habitsConfig = [h];

      // 构造 3 小时前的喝水记录
      const now = new Date();
      const past = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const pastTime = `${String(past.getHours()).padStart(2, '0')}:${String(past.getMinutes()).padStart(2, '0')}`;

      window.checkinRecords = {
        [__todayKey()]: {
          [h.id]: { value: 250, cups: [{ time: pastTime, amount: 250 }] }
        }
      };
      Utils.markStatsDirty();

      const html = Water.renderWaterTracker(h, window.checkinRecords[__todayKey()]);
      expect(html).toContain('距离上次喝水');
      expect(html).toContain('3小时');
    });

    it('应正确列出今日喝水记录', () => {
      const h = __makeHabit({
        id: 'w13',
        type: 'water',
        waterConfig: { dailyGoal: 2000, perCup: 250 }
      });
      window.habitsConfig = [h];
      window.checkinRecords = {
        [__todayKey()]: {
          [h.id]: {
            value: 500,
            cups: [
              { time: '08:30', amount: 250 },
              { time: '10:15', amount: 250 }
            ]
          }
        }
      };
      Utils.markStatsDirty();

      const html = Water.renderWaterTracker(h, window.checkinRecords[__todayKey()]);
      expect(html).toContain('08:30');
      expect(html).toContain('10:15');
      expect(html).toContain('今日：');
    });

    it('应显示快速加水按钮（半杯/一杯/两杯）', () => {
      const h = __makeHabit({
        id: 'w14',
        type: 'water',
        waterConfig: { dailyGoal: 2000, perCup: 250 }
      });
      window.habitsConfig = [h];
      window.checkinRecords = {};
      Utils.markStatsDirty();

      const html = Water.renderWaterTracker(h, {});
      expect(html).toContain('125ml');  // 250/2
      expect(html).toContain('250ml');  // 一杯
      expect(html).toContain('500ml');  // 250*2
      expect(html).toContain('自定义');
    });

    it('连续天数 > 0 应显示 streak 标签', () => {
      const h = __makeHabit({
        id: 'w15',
        type: 'water',
        waterConfig: { dailyGoal: 1000, perCup: 200 }
      });
      window.habitsConfig = [h];
      const recs = {};
      for (let i = 0; i < 3; i++) {
        recs[__offsetKey(-i)] = { [h.id]: { done: true, value: 1000 } };
      }
      window.checkinRecords = recs;
      Utils.markStatsDirty();

      const html = Water.renderWaterTracker(h, window.checkinRecords[__todayKey()]);
      expect(html).toContain('🔥');
      expect(html).toContain('3天');
    });

    it('应正确转义习惯名称（XSS 防护）', () => {
      const h = __makeHabit({
        id: 'w16',
        type: 'water',
        name: '<script>evil</script>',
        icon: '💧',
        waterConfig: { dailyGoal: 1000, perCup: 200 }
      });
      window.habitsConfig = [h];
      window.checkinRecords = {};
      Utils.markStatsDirty();

      const html = Water.renderWaterTracker(h, {});
      expect(html).not.toContain('<script>evil</script>');
      expect(html).toContain('&lt;script&gt;evil&lt;/script&gt;');
    });

    it('pct 超过 100 应限制为 100', () => {
      const h = __makeHabit({
        id: 'w17',
        type: 'water',
        waterConfig: { dailyGoal: 1000, perCup: 250 }
      });
      window.habitsConfig = [h];
      window.checkinRecords = {
        [__todayKey()]: {
          [h.id]: { value: 1500 } // 超出目标
        }
      };
      Utils.markStatsDirty();

      const html = Water.renderWaterTracker(h, window.checkinRecords[__todayKey()]);
      expect(html).toContain('100%');
    });

    it('remaining 不应为负数', () => {
      const h = __makeHabit({
        id: 'w18',
        type: 'water',
        waterConfig: { dailyGoal: 1000, perCup: 250 }
      });
      window.habitsConfig = [h];
      window.checkinRecords = {
        [__todayKey()]: {
          [h.id]: { value: 1500 }
        }
      };
      Utils.markStatsDirty();

      const html = Water.renderWaterTracker(h, window.checkinRecords[__todayKey()]);
      expect(html).not.toContain('还需 -');
      expect(html).toContain('今日目标已达成');
    });
  });
});
