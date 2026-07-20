/**
 * stats.js 单元测试
 * 覆盖：renderWeekBarChart 周柱状图渲染
 */
import { describe, it, expect, beforeEach } from 'vitest';

const Stats = window.App.Modules.Stats;
const Utils = window.App.Core.Utils;

describe('stats.js', () => {
  beforeEach(() => {
    __resetData();
  });

  describe('renderWeekBarChart 周柱状图', () => {
    it('容器不存在应直接返回', () => {
      // 不创建容器，调用不应抛错
      expect(() => Stats.renderWeekBarChart('non-existent')).not.toThrow();
    });

    it('空习惯应渲染 0% 柱状图', () => {
      const container = window.document.createElement('div');
      container.id = 'testChart';
      window.document.body.appendChild(container);

      Stats.renderWeekBarChart('testChart');

      expect(container.innerHTML).toBeTruthy();
      expect(container.innerHTML).toContain('0%');
      // 应有 7 个柱子
      const bars = container.querySelectorAll('div[style*="flex:1"]');
      expect(bars.length).toBe(7);
      container.remove();
    });

    it('应正确渲染今日完成率', () => {
      const h1 = __makeHabit({ id: 'wb1' });
      const h2 = __makeHabit({ id: 'wb2' });
      window.habitsConfig = [h1, h2];
      window.checkinRecords = {
        [__todayKey()]: {
          [h1.id]: { done: true, value: 1 },
          [h2.id]: { done: true, value: 1 }
        }
      };
      Utils.markStatsDirty();

      const container = window.document.createElement('div');
      container.id = 'testChart2';
      window.document.body.appendChild(container);

      Stats.renderWeekBarChart('testChart2');

      // 今天完成率应为 100%
      expect(container.innerHTML).toContain('100%');
      container.remove();
    });

    it('默认 containerId 应为 weekBarChart', () => {
      const container = window.document.createElement('div');
      container.id = 'weekBarChart';
      window.document.body.appendChild(container);

      Stats.renderWeekBarChart();

      expect(container.innerHTML).toBeTruthy();
      container.remove();
    });

    it('今日柱应使用渐变背景', () => {
      const container = window.document.createElement('div');
      container.id = 'testChart3';
      window.document.body.appendChild(container);

      Stats.renderWeekBarChart('testChart3');

      // 今日的柱子应包含 linear-gradient
      expect(container.innerHTML).toContain('linear-gradient');
      container.remove();
    });

    it('应显示"今天"标签', () => {
      const container = window.document.createElement('div');
      container.id = 'testChart4';
      window.document.body.appendChild(container);

      Stats.renderWeekBarChart('testChart4');

      expect(container.innerHTML).toContain('今天');
      container.remove();
    });
  });
});
