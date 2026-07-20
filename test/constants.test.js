/**
 * constants.js 单元测试
 * 覆盖：节气数据完整性、等级体系、农历数据、自定义图标、番茄钟常量
 */
import { describe, it, expect } from 'vitest';

const Data = window.App.Data;

describe('constants.js', () => {

  // ==================== DAY_NAMES ====================
  describe('DAY_NAMES', () => {
    it('应为 7 个元素', () => {
      expect(Array.isArray(DAY_NAMES)).toBe(true);
      expect(DAY_NAMES).toHaveLength(7);
    });

    it('应从周日开始（周日=0）', () => {
      expect(DAY_NAMES[0]).toBe('日');
      expect(DAY_NAMES[6]).toBe('六');
    });

    it('应与 new Date().getDay() 索引对应', () => {
      const d = new Date(2024, 0, 1); // 2024-01-01 是周一
      expect(DAY_NAMES[d.getDay()]).toBe('一');
      const d2 = new Date(2024, 0, 7); // 2024-01-07 是周日
      expect(DAY_NAMES[d2.getDay()]).toBe('日');
    });
  });

  // ==================== SOLAR_TERMS ====================
  describe('SOLAR_TERMS 节气数据', () => {
    it('应有 24 个节气', () => {
      expect(Array.isArray(SOLAR_TERMS)).toBe(true);
      expect(SOLAR_TERMS).toHaveLength(24);
    });

    it('每个节气应包含完整字段', () => {
      SOLAR_TERMS.forEach((term, i) => {
        expect(term).toHaveProperty('name', expect.any(String));
        expect(term.name.length).toBeGreaterThan(0);
        expect(term).toHaveProperty('month');
        expect(term.month).toBeGreaterThanOrEqual(1);
        expect(term.month).toBeLessThanOrEqual(12);
        expect(term).toHaveProperty('day');
        expect(term.day).toBeGreaterThanOrEqual(1);
        expect(term.day).toBeLessThanOrEqual(31);
        expect(term).toHaveProperty('emoji', expect.any(String));
        expect(term).toHaveProperty('season', expect.any(String));
        expect(term).toHaveProperty('tip', expect.any(String));
        expect(term.tip.length).toBeGreaterThan(0);
      });
    });

    it('season 应为四值之一', () => {
      const validSeasons = ['spring', 'summer', 'autumn', 'winter'];
      SOLAR_TERMS.forEach(term => {
        expect(validSeasons).toContain(term.season);
      });
    });

    it('节气名称应不重复', () => {
      const names = SOLAR_TERMS.map(t => t.name);
      const unique = new Set(names);
      expect(unique.size).toBe(24);
    });

    it('应按时间顺序排列（从立春开始）', () => {
      // 立春是第一个节气
      expect(SOLAR_TERMS[0].name).toBe('立春');
      // 大寒是最后一个
      expect(SOLAR_TERMS[23].name).toBe('大寒');
    });

    it('每个季节应有 6 个节气', () => {
      const counts = { spring: 0, summer: 0, autumn: 0, winter: 0 };
      SOLAR_TERMS.forEach(t => counts[t.season]++);
      expect(counts.spring).toBe(6);
      expect(counts.summer).toBe(6);
      expect(counts.autumn).toBe(6);
      expect(counts.winter).toBe(6);
    });

    it('month+day 组合应合理（在公历日期范围内）', () => {
      const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      SOLAR_TERMS.forEach(term => {
        expect(term.day).toBeLessThanOrEqual(daysInMonth[term.month - 1]);
      });
    });

    it('应包含关键节点：春分、夏至、秋分、冬至', () => {
      const names = SOLAR_TERMS.map(t => t.name);
      expect(names).toContain('春分');
      expect(names).toContain('夏至');
      expect(names).toContain('秋分');
      expect(names).toContain('冬至');
    });

    it('春节气应在 2-4 月', () => {
      const springTerms = SOLAR_TERMS.filter(t => t.season === 'spring');
      springTerms.forEach(t => {
        expect(t.month).toBeGreaterThanOrEqual(2);
        expect(t.month).toBeLessThanOrEqual(4);
      });
    });

    it('夏节气应在 5-7 月', () => {
      const summerTerms = SOLAR_TERMS.filter(t => t.season === 'summer');
      summerTerms.forEach(t => {
        expect(t.month).toBeGreaterThanOrEqual(5);
        expect(t.month).toBeLessThanOrEqual(7);
      });
    });

    it('秋节气应在 8-10 月', () => {
      const autumnTerms = SOLAR_TERMS.filter(t => t.season === 'autumn');
      autumnTerms.forEach(t => {
        expect(t.month).toBeGreaterThanOrEqual(8);
        expect(t.month).toBeLessThanOrEqual(10);
      });
    });

    it('冬节气应在 11-1 月', () => {
      const winterTerms = SOLAR_TERMS.filter(t => t.season === 'winter');
      winterTerms.forEach(t => {
        // 冬至在 12 月，立冬/小雪在 11 月，小寒/大寒在 1 月
        expect([1, 11, 12]).toContain(t.month);
      });
    });
  });

  // ==================== LEVELS ====================
  describe('LEVELS 等级体系', () => {
    it('应有 5 个等级', () => {
      expect(Array.isArray(LEVELS)).toBe(true);
      expect(LEVELS).toHaveLength(5);
    });

    it('每个等级应包含完整字段', () => {
      LEVELS.forEach(lv => {
        expect(lv).toHaveProperty('level', expect.any(Number));
        expect(lv).toHaveProperty('name', expect.any(String));
        expect(lv).toHaveProperty('icon', expect.any(String));
        expect(lv).toHaveProperty('minDays', expect.any(Number));
      });
    });

    it('level 应为 1-5 连续整数', () => {
      LEVELS.forEach((lv, i) => {
        expect(lv.level).toBe(i + 1);
      });
    });

    it('minDays 应递增', () => {
      for (let i = 1; i < LEVELS.length; i++) {
        expect(LEVELS[i].minDays).toBeGreaterThan(LEVELS[i - 1].minDays);
      }
    });

    it('第一个等级 minDays 应为 0（新手门槛）', () => {
      expect(LEVELS[0].minDays).toBe(0);
    });

    it('最高等级 minDays 应 >= 30', () => {
      expect(LEVELS[LEVELS.length - 1].minDays).toBeGreaterThanOrEqual(30);
    });

    it('等级名称应不重复', () => {
      const names = LEVELS.map(l => l.name);
      const unique = new Set(names);
      expect(unique.size).toBe(LEVELS.length);
    });

    it('应包含"养生小白"作为初始等级', () => {
      expect(LEVELS[0].name).toBe('养生小白');
    });

    it('应包含"养生大师"作为最高等级', () => {
      expect(LEVELS[4].name).toBe('养生大师');
    });
  });

  // ==================== LUNAR_INFO ====================
  describe('LUNAR_INFO 农历数据', () => {
    it('应为数组', () => {
      expect(Array.isArray(LUNAR_INFO)).toBe(true);
    });

    it('应覆盖农历数据范围（150 个元素，1900-2049）', () => {
      expect(LUNAR_INFO.length).toBe(150);
    });

    it('每个元素应为数字（hex 编码）', () => {
      LUNAR_INFO.forEach(v => {
        expect(typeof v).toBe('number');
        expect(v).toBeGreaterThanOrEqual(0);
      });
    });

    it('1900 年数据应为 0x04bd8（基准值）', () => {
      expect(LUNAR_INFO[0]).toBe(0x04bd8);
    });

    it('不应有 undefined 或 null', () => {
      LUNAR_INFO.forEach(v => {
        expect(v).not.toBeUndefined();
        expect(v).not.toBeNull();
      });
    });

    it('2024 年（闰年）数据应存在', () => {
      // 2024 - 1900 = 124
      expect(LUNAR_INFO[124]).toBeDefined();
      expect(typeof LUNAR_INFO[124]).toBe('number');
    });
  });

  // ==================== LUNAR_MONTHS ====================
  describe('LUNAR_MONTHS 农历月名', () => {
    it('应有 12 个月名', () => {
      expect(Array.isArray(LUNAR_MONTHS)).toBe(true);
      expect(LUNAR_MONTHS).toHaveLength(12);
    });

    it('应从"正"月开始', () => {
      expect(LUNAR_MONTHS[0]).toBe('正');
    });

    it('应包含"腊"月（十二月）', () => {
      expect(LUNAR_MONTHS[11]).toBe('腊');
    });

    it('月名应不重复', () => {
      const unique = new Set(LUNAR_MONTHS);
      expect(unique.size).toBe(12);
    });

    it('应包含"冬"月（十一月）', () => {
      expect(LUNAR_MONTHS).toContain('冬');
    });
  });

  // ==================== LUNAR_DAYS ====================
  describe('LUNAR_DAYS 农历日名', () => {
    it('应有 30 个日名', () => {
      expect(Array.isArray(LUNAR_DAYS)).toBe(true);
      expect(LUNAR_DAYS).toHaveLength(30);
    });

    it('应从"初一"开始', () => {
      expect(LUNAR_DAYS[0]).toBe('初一');
    });

    it('应到"三十"结束', () => {
      expect(LUNAR_DAYS[29]).toBe('三十');
    });

    it('日名应不重复', () => {
      const unique = new Set(LUNAR_DAYS);
      expect(unique.size).toBe(30);
    });

    it('前十天应为"初X"格式', () => {
      for (let i = 0; i < 10; i++) {
        expect(LUNAR_DAYS[i]).toMatch(/^初/);
      }
    });

    it('后二十天应使用"十/廿/三十"前缀', () => {
      for (let i = 10; i < 30; i++) {
        const day = LUNAR_DAYS[i];
        expect(day).toMatch(/^(十|廿|二|三)/);
      }
    });

    it('应包含"十五"（中秋节）', () => {
      expect(LUNAR_DAYS[14]).toBe('十五');
    });
  });

  // ==================== CUSTOM_ICONS ====================
  describe('CUSTOM_ICONS 自定义图标', () => {
    it('应为非空数组', () => {
      expect(Array.isArray(CUSTOM_ICONS)).toBe(true);
      expect(CUSTOM_ICONS.length).toBeGreaterThan(30);
    });

    it('每个图标应为字符串', () => {
      CUSTOM_ICONS.forEach(icon => {
        expect(typeof icon).toBe('string');
        expect(icon.length).toBeGreaterThan(0);
      });
    });

    it('应包含常用养生图标：✅ 💧 🧘 🏃', () => {
      expect(CUSTOM_ICONS).toContain('✅');
      expect(CUSTOM_ICONS).toContain('💧');
      expect(CUSTOM_ICONS).toContain('🧘');
      expect(CUSTOM_ICONS).toContain('🏃');
    });

    it('应包含饮食相关图标', () => {
      expect(CUSTOM_ICONS).toContain('🍵');
      expect(CUSTOM_ICONS).toContain('🍎');
    });

    it('应包含睡眠相关图标', () => {
      expect(CUSTOM_ICONS).toContain('😴');
      expect(CUSTOM_ICONS).toContain('🛏️');
    });

    it('图标应不重复（或允许少量重复但应少于 10%）', () => {
      const unique = new Set(CUSTOM_ICONS);
      const dupRate = 1 - unique.size / CUSTOM_ICONS.length;
      expect(dupRate).toBeLessThan(0.1);
    });
  });

  // ==================== POMO ====================
  describe('POMO 番茄钟常量', () => {
    it('POMO_WORK 应为 25 分钟（1500 秒）', () => {
      expect(POMO_WORK).toBe(25 * 60);
      expect(POMO_WORK).toBe(1500);
    });

    it('POMO_SHORT 应为 5 分钟（300 秒）', () => {
      expect(POMO_SHORT).toBe(5 * 60);
      expect(POMO_SHORT).toBe(300);
    });

    it('POMO_LONG 应为 15 分钟（900 秒）', () => {
      expect(POMO_LONG).toBe(15 * 60);
      expect(POMO_LONG).toBe(900);
    });

    it('工作时长应大于短休', () => {
      expect(POMO_WORK).toBeGreaterThan(POMO_SHORT);
    });

    it('长休应大于短休', () => {
      expect(POMO_LONG).toBeGreaterThan(POMO_SHORT);
    });

    it('工作时长应大于长休（标准番茄钟）', () => {
      expect(POMO_WORK).toBeGreaterThan(POMO_LONG);
    });
  });

  // ==================== App.Data 注册 ====================
  describe('App.Data 命名空间注册', () => {
    it('所有常量应注册到 App.Data', () => {
      expect(Data.DAY_NAMES).toBe(DAY_NAMES);
      expect(Data.SOLAR_TERMS).toBe(SOLAR_TERMS);
      expect(Data.LEVELS).toBe(LEVELS);
      expect(Data.LUNAR_INFO).toBe(LUNAR_INFO);
      expect(Data.LUNAR_MONTHS).toBe(LUNAR_MONTHS);
      expect(Data.LUNAR_DAYS).toBe(LUNAR_DAYS);
      expect(Data.CUSTOM_ICONS).toBe(CUSTOM_ICONS);
      expect(Data.POMO_WORK).toBe(POMO_WORK);
      expect(Data.POMO_SHORT).toBe(POMO_SHORT);
      expect(Data.POMO_LONG).toBe(POMO_LONG);
    });
  });

  // ==================== 数据一致性 ====================
  describe('数据一致性', () => {
    it('LUNAR_MONTHS 长度应与公历月数一致（12）', () => {
      expect(LUNAR_MONTHS.length).toBe(12);
    });

    it('LUNAR_DAYS 长度应覆盖农历最大天数（30）', () => {
      // 农历大月 30 天，小月 29 天
      expect(LUNAR_DAYS.length).toBe(30);
    });

    it('SOLAR_TERMS season 字段值应与四季对应', () => {
      const seasonMap = {
        spring: ['立春', '春分'],
        summer: ['立夏', '夏至'],
        autumn: ['立秋', '秋分'],
        winter: ['立冬', '冬至']
      };
      Object.entries(seasonMap).forEach(([season, names]) => {
        names.forEach(name => {
          const term = SOLAR_TERMS.find(t => t.name === name);
          expect(term).toBeDefined();
          expect(term.season).toBe(season);
        });
      });
    });
  });
});
