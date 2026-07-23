(function() {
  'use strict';

  const CATEGORY_NAMES = {
    sport:    { name: '运动健身', icon: '🏃' },
    diet:     { name: '饮食营养', icon: '🥗' },
    study:    { name: '学习成长', icon: '📚' },
    sleep:    { name: '睡眠作息', icon: '🌙' },
    mind:     { name: '心灵修养', icon: '🧘' },
    protect:  { name: '五劳防护', icon: '🛡️' },
    care:     { name: '个人护理', icon: '🧴' },
    home:     { name: '居家生活', icon: '🏠' },
    social:   { name: '社交人际', icon: '🤝' }
  };

  const CONSTITUTION_FOCUS = {
    pinghe:  { focus: '阴阳调和',   organ: '五脏',       adviceTemplate: '继续保持均衡生活，顺应四时养生' },
    qixu:    { focus: '补气养元',   organ: '脾肺',       adviceTemplate: '气虚质需健脾益气，避免过度劳累' },
    yangxu:  { focus: '温阳散寒',   organ: '脾肾',       adviceTemplate: '阳虚质当温补阳气，注意保暖多晒太阳' },
    yinxu:   { focus: '滋阴降火',   organ: '肺肾',       adviceTemplate: '阴虚质宜滋阴润燥，忌熬夜和辛辣' },
    tanshi:  { focus: '健脾祛湿',   organ: '脾胃',       adviceTemplate: '痰湿质应化痰祛湿，少油腻多运动' },
    shire:   { focus: '清热利湿',   organ: '肝胆脾胃',   adviceTemplate: '湿热质需清热利湿，忌辛辣油腻' },
    xueyu:   { focus: '活血化瘀',   organ: '心肝',       adviceTemplate: '血瘀质宜行气活血，保持心情舒畅' },
    qiyu:    { focus: '疏肝解郁',   organ: '肝',         adviceTemplate: '气郁质应疏肝理气，多社交多晒太阳' },
    tebing:  { focus: '益气固表',   organ: '肺脾',       adviceTemplate: '特禀质需益气固表，远离过敏原' }
  };

  const SEASON_FOCUS = {
    spring:  { name: '春', organ: '肝', principle: '养肝舒展，夜卧早起，广步于庭', color: '#7CB69D' },
    summer:  { name: '夏', organ: '心', principle: '养心安神，夜卧早起，无厌于日', color: '#E07A5F' },
    autumn:  { name: '秋', organ: '肺', principle: '养肺润燥，早卧早起，与鸡俱兴', color: '#D4A373' },
    winter:  { name: '冬', organ: '肾', principle: '养肾藏精，早卧晚起，必待日光', color: '#5B8DB8' }
  };

  const LEVEL_HABIT_LIMIT = { 1: 3, 2: 5, 3: 7, 4: 10, 5: 15 };

  function getUserLevel() {
    const levels = App.Data.LEVELS || [];
    const maxStreak = _getMaxStreakAll();
    let level = 1;
    for (let i = 0; i < levels.length; i++) {
      if (maxStreak >= levels[i].minDays) level = levels[i].level;
    }
    return level;
  }

  function _getMaxStreakAll() {
    let max = 0;
    if (!habitsConfig || !habitsConfig.length) return 0;
    habitsConfig.forEach(h => {
      const s = _getStreak(h.id);
      if (s > max) max = s;
    });
    return max;
  }

  function _getStreak(habitId) {
    let streak = 0;
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return 0;
    const d = new Date();
    while (true) {
      const key = formatDate(d);
      const rec = checkinRecords[key];
      if (App.Core.Storage.isHabitChecked(h, rec)) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return streak;
  }

  function getCategoryCompletion(days) {
    days = days || 30;
    const result = {};
    if (!habitsConfig || !habitsConfig.length) return result;
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = formatDate(d);
      const rec = checkinRecords[key] || {};
      habitsConfig.forEach(h => {
        if (h.enabled === false) return;
        const cat = h.category || 'other';
        if (!result[cat]) result[cat] = { done: 0, total: 0 };
        result[cat].total++;
        if (App.Core.Storage.isHabitChecked(h, rec)) result[cat].done++;
      });
    }
    for (const cat in result) {
      result[cat].rate = result[cat].total > 0 ? result[cat].done / result[cat].total : 0;
    }
    return result;
  }

  function findWeakCategories(days) {
    days = days || 30;
    const rates = getCategoryCompletion(days);
    const arr = [];
    for (const cat in rates) {
      if (rates[cat].total >= 3) {
        arr.push({ category: cat, rate: rates[cat].rate, total: rates[cat].total });
      }
    }
    arr.sort((a, b) => a.rate - b.rate);
    return arr;
  }

  function getConstitution() {
    try {
      const saved = localStorage.getItem('constitution_result');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return null;
  }

  function getCurrentSeason() {
    if (App.Core.Utils && App.Core.Utils.getCurrentSeason) {
      return App.Core.Utils.getCurrentSeason();
    }
    const month = new Date().getMonth() + 1;
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  function getCurrentSolarTerm() {
    if (App.Core.Utils && App.Core.Utils.getCurrentSolarTerm) {
      return App.Core.Utils.getCurrentSolarTerm();
    }
    return null;
  }

  function getWaterStats(days) {
    days = days || 7;
    const waterHabit = habitsConfig.find(h => h.type === 'water');
    if (!waterHabit) return null;
    const goal = (waterHabit.waterConfig && waterHabit.waterConfig.dailyGoal) || 2000;
    let reachedDays = 0, totalDays = 0, avgAmount = 0;
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = formatDate(d);
      const rec = checkinRecords[key];
      if (rec && rec[waterHabit.id]) {
        const val = rec[waterHabit.id].value || 0;
        if (val >= goal) reachedDays++;
        avgAmount += val;
        totalDays++;
      } else {
        totalDays++;
      }
    }
    return {
      goal,
      reachedDays,
      totalDays,
      reachRate: totalDays > 0 ? reachedDays / totalDays : 0,
      avgAmount: totalDays > 0 ? Math.round(avgAmount / totalDays) : 0
    };
  }

  function getEmotionDistribution(days) {
    days = days || 30;
    const emotionHabit = habitsConfig.find(h => h.id === 'emotion_check');
    if (!emotionHabit) return null;
    const counts = {};
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = formatDate(d);
      const rec = checkinRecords[key];
      if (rec && rec[emotionHabit.id] && rec[emotionHabit.id].value) {
        const v = rec[emotionHabit.id].value;
        counts[v] = (counts[v] || 0) + 1;
      }
    }
    return counts;
  }

  function _getConstitutionHabits() {
    const c = getConstitution();
    if (!c || !c.typeId) return [];
    const types = App.Data.CONSTITUTION_TYPES || [];
    const t = types.find(x => x.id === c.typeId);
    return (t && t.habits) ? t.habits : [];
  }

  function _getSeasonalHabits() {
    const season = getCurrentSeason();
    const packs = typeof SEASONAL_PACKS !== 'undefined' ? SEASONAL_PACKS : null;
    if (!packs || !packs[season]) return [];
    return packs[season].habits.map(h => h.id);
  }

  function _habitLibrary() {
    return typeof HABIT_LIBRARY !== 'undefined' ? HABIT_LIBRARY : (App.Data && App.Data.HABIT_LIBRARY ? App.Data.HABIT_LIBRARY : []);
  }

  function _findHabit(id) {
    const lib = _habitLibrary();
    return lib.find(h => h.id === id);
  }

  function _userHasHabit(id) {
    return habitsConfig.some(h => h.id === id);
  }

  function generateRecommendations(opts) {
    opts = opts || {};
    const limit = opts.limit || 3;
    const level = getUserLevel();
    const season = getCurrentSeason();
    const term = getCurrentSolarTerm();
    const constitution = getConstitution();
    const weakCats = findWeakCategories(30);
    const waterStats = getWaterStats(7);
    const emotionDist = getEmotionDistribution(30);

    const candidates = [];

    const constHabits = _getConstitutionHabits();
    const seasonHabits = _getSeasonalHabits();
    const lib = _habitLibrary();

    const constSet = new Set(constHabits);
    const seasonSet = new Set(seasonHabits);

    lib.forEach(h => {
      let score = 0;
      const reasons = [];

      if (constSet.has(h.id)) {
        score += 40;
        reasons.push('体质调养');
      }

      if (seasonSet.has(h.id)) {
        score += 30;
        reasons.push('当季养生');
      }

      if (weakCats.length > 0) {
        const weakest = weakCats[0];
        if (h.category === weakest.category && weakest.rate < 0.5) {
          score += 25;
          reasons.push('改善弱项');
        }
      }

      if (waterStats && waterStats.reachRate < 0.5 && h.type === 'water') {
        score += 30;
        reasons.push('饮水不足');
      }

      if (emotionDist && (emotionDist['😠怒'] || emotionDist['😢悲']) && (h.category === 'mind' || h.id === 'meditation')) {
        score += 20;
        reasons.push('情绪调节');
      }

      if (level <= 2 && (h.category === 'sleep' || h.category === 'diet')) {
        score += 10;
        reasons.push('新手友好');
      }
      if (level >= 4 && (h.category === 'sport' || h.id === 'baduanjin' || h.id === 'taiji')) {
        score += 10;
        reasons.push('进阶挑战');
      }

      const userHabit = habitsConfig.find(x => x.id === h.id);
      if (userHabit) {
        const streak = _getStreak(h.id);
        if (streak >= 7) {
          score -= 15;
          reasons.push('已坚持');
        }
      }

      if (score >= 20) {
        candidates.push({
          habit: h,
          score,
          reasons,
          alreadyHas: !!userHabit
        });
      }
    });

    candidates.sort((a, b) => b.score - a.score);

    const selected = [];
    const seenCats = new Set();
    for (const c of candidates) {
      if (selected.length >= limit) break;
      if (selected.length < 2 && seenCats.has(c.habit.category)) continue;
      selected.push(c);
      seenCats.add(c.habit.category);
    }

    return {
      level,
      season,
      term,
      constitution,
      weakCats,
      waterStats,
      emotionDist,
      recommendations: selected.map(c => ({
        id: c.habit.id,
        name: c.habit.name,
        icon: c.habit.icon,
        category: c.habit.category,
        categoryName: (CATEGORY_NAMES[c.habit.category] || {}).name || c.habit.category,
        categoryIcon: (CATEGORY_NAMES[c.habit.category] || {}).icon || '📋',
        tip: c.habit.tip || '',
        timePeriod: c.habit.timePeriod || '',
        unit: c.habit.unit || '',
        type: c.habit.type || 'boolean',
        score: c.score,
        reasons: c.reasons,
        alreadyHas: c.alreadyHas,
        actionText: c.alreadyHas ? '继续保持' : '添加习惯'
      }))
    };
  }

  function generateHealthReport(period) {
    period = period || 'week';
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const level = getUserLevel();
    const levels = App.Data.LEVELS || [];
    const levelInfo = levels.find(l => l.level === level) || levels[0];
    const season = getCurrentSeason();
    const seasonInfo = SEASON_FOCUS[season];
    const constitution = getConstitution();
    const constInfo = constitution && constitution.typeId
      ? (App.Data.CONSTITUTION_TYPES || []).find(t => t.id === constitution.typeId)
      : null;
    const weakCats = findWeakCategories(days);
    const recs = generateRecommendations({ limit: 3 });
    const catRates = getCategoryCompletion(days);

    let overallRate = 0, overallTotal = 0, overallDone = 0;
    for (const cat in catRates) {
      overallDone += catRates[cat].done;
      overallTotal += catRates[cat].total;
    }
    overallRate = overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0;

    const bestCat = weakCats.length > 0
      ? [...weakCats].sort((a, b) => b.rate - a.rate)[0]
      : null;
    const worstCat = weakCats.length > 0 ? weakCats[0] : null;

    let trend = 'stable';
    if (days >= 14) {
      const firstHalf = getCategoryCompletion(Math.floor(days / 2));
      let firstRate = 0, firstTotal = 0, firstDone = 0;
      for (const cat in firstHalf) {
        firstDone += firstHalf[cat].done;
        firstTotal += firstHalf[cat].total;
      }
      firstRate = firstTotal > 0 ? firstDone / firstTotal : 0;
      const recentRate = overallRate / 100;
      if (recentRate - firstRate > 0.05) trend = 'up';
      else if (firstRate - recentRate > 0.05) trend = 'down';
    }

    const waterStats = getWaterStats(Math.min(days, 7));

    return {
      period,
      days,
      level,
      levelInfo,
      season,
      seasonInfo,
      constitution,
      constInfo,
      overallRate,
      overallDone,
      overallTotal,
      bestCategory: bestCat ? {
        category: bestCat.category,
        name: (CATEGORY_NAMES[bestCat.category] || {}).name || bestCat.category,
        icon: (CATEGORY_NAMES[bestCat.category] || {}).icon || '📋',
        rate: Math.round(bestCat.rate * 100)
      } : null,
      worstCategory: worstCat ? {
        category: worstCat.category,
        name: (CATEGORY_NAMES[worstCat.category] || {}).name || worstCat.category,
        icon: (CATEGORY_NAMES[worstCat.category] || {}).icon || '📋',
        rate: Math.round(worstCat.rate * 100)
      } : null,
      trend,
      trendText: trend === 'up' ? '上升趋势 👍' : trend === 'down' ? '下降趋势 ⚠️' : '保持稳定 📊',
      categoryRates: catRates,
      waterStats,
      recommendations: recs.recommendations,
      weakCategories: weakCats.map(w => ({
        category: w.category,
        name: (CATEGORY_NAMES[w.category] || {}).name || w.category,
        icon: (CATEGORY_NAMES[w.category] || {}).icon || '📋',
        rate: Math.round(w.rate * 100)
      }))
    };
  }

  function getDailyTip() {
    const season = getCurrentSeason();
    const seasonInfo = SEASON_FOCUS[season];
    const constitution = getConstitution();
    const constInfo = constitution && constitution.typeId
      ? CONSTITUTION_FOCUS[constitution.typeId]
      : null;
    const term = getCurrentSolarTerm();

    const tips = [];

    if (term) {
      tips.push({
        type: 'solar_term',
        icon: term.emoji || '🌿',
        title: `${term.name}养生`,
        content: term.tip || ''
      });
    }

    if (seasonInfo) {
      tips.push({
        type: 'season',
        icon: season === 'spring' ? '🌿' : season === 'summer' ? '☀️' : season === 'autumn' ? '🍂' : '❄️',
        title: `${seasonInfo.name}季养${seasonInfo.organ}`,
        content: seasonInfo.principle
      });
    }

    if (constInfo) {
      tips.push({
        type: 'constitution',
        icon: constInfo.organ ? '🧬' : '😊',
        title: `${constInfo.focus}`,
        content: constInfo.adviceTemplate
      });
    }

    const weakCats = findWeakCategories(7);
    if (weakCats.length > 0 && weakCats[0].rate < 0.5) {
      const wc = weakCats[0];
      const catInfo = CATEGORY_NAMES[wc.category] || { name: wc.category, icon: '📋' };
      tips.push({
        type: 'weakness',
        icon: '💪',
        title: `本周${catInfo.name}完成率偏低`,
        content: `本周完成率仅 ${Math.round(wc.rate * 100)}%，建议加强${catInfo.name}方面的习惯养成`
      });
    }

    return tips;
  }

  function _formatDate(date) {
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function _getWeekRange(date) {
    const d = date || new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  }

  function generateWeeklyAnalysisData(date) {
    const range = _getWeekRange(date);
    const thisWeekStart = range.start;
    const thisWeekEnd = range.end;

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekEnd);
    lastWeekEnd.setDate(thisWeekEnd.getDate() - 7);

    const thisWeekDays = [];
    const d = new Date(thisWeekStart);
    while (d <= thisWeekEnd) {
      thisWeekDays.push(_formatDate(d));
      d.setDate(d.getDate() + 1);
    }

    const lastWeekDays = [];
    const ld = new Date(lastWeekStart);
    while (ld <= lastWeekEnd) {
      lastWeekDays.push(_formatDate(ld));
      ld.setDate(ld.getDate() + 1);
    }

    const weekDayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

    let thisWeekDone = 0, thisWeekTotal = 0;
    let lastWeekDone = 0, lastWeekTotal = 0;

    const dailyStats = [];
    const habitStats = {};
    const dayFailStats = {};

    weekDayNames.forEach((name, idx) => {
      dayFailStats[name] = { fail: 0, total: 0 };
    });

    habitsConfig.forEach(h => {
      if (h.enabled === false) return;
      const id = h.id;
      habitStats[id] = {
        name: h.name,
        icon: h.icon || '📋',
        category: h.category || 'other',
        type: h.type || 'boolean',
        thisWeekDone: 0,
        thisWeekTotal: 0,
        lastWeekDone: 0,
        lastWeekTotal: 0,
        streak: _getStreak(id),
        fails: []
      };
    });

    thisWeekDays.forEach((dateKey, idx) => {
      const rec = checkinRecords[dateKey] || {};
      const dayName = weekDayNames[idx];
      let dayDone = 0, dayTotal = 0;

      habitsConfig.forEach(h => {
        if (h.enabled === false) return;
        dayTotal++;
        thisWeekTotal++;

        const isChecked = App.Core.Storage.isHabitChecked(h, rec);
        if (isChecked) {
          dayDone++;
          thisWeekDone++;
          habitStats[h.id].thisWeekDone++;
        } else {
          habitStats[h.id].fails.push(dateKey);
          dayFailStats[dayName].fail++;
        }
        habitStats[h.id].thisWeekTotal++;
        dayFailStats[dayName].total++;
      });

      dailyStats.push({
        date: dateKey,
        dayName: dayName,
        done: dayDone,
        total: dayTotal,
        rate: dayTotal > 0 ? Math.round((dayDone / dayTotal) * 100) : 0
      });
    });

    lastWeekDays.forEach(dateKey => {
      const rec = checkinRecords[dateKey] || {};
      habitsConfig.forEach(h => {
        if (h.enabled === false) return;
        lastWeekTotal++;
        habitStats[h.id].lastWeekTotal++;
        if (App.Core.Storage.isHabitChecked(h, rec)) {
          lastWeekDone++;
          habitStats[h.id].lastWeekDone++;
        }
      });
    });

    const thisWeekRate = thisWeekTotal > 0 ? Math.round((thisWeekDone / thisWeekTotal) * 100) : 0;
    const lastWeekRate = lastWeekTotal > 0 ? Math.round((lastWeekDone / lastWeekTotal) * 100) : 0;

    let trend = 'stable';
    let trendText = '与上周持平';
    const rateDiff = thisWeekRate - lastWeekRate;
    if (rateDiff > 5) {
      trend = 'up';
      trendText = `比上周提升${rateDiff}% 👍`;
    } else if (rateDiff < -5) {
      trend = 'down';
      trendText = `比上周下降${Math.abs(rateDiff)}% ⚠️`;
    }

    const habitRateList = [];
    for (const id in habitStats) {
      const hs = habitStats[id];
      const thisRate = hs.thisWeekTotal > 0 ? Math.round((hs.thisWeekDone / hs.thisWeekTotal) * 100) : 0;
      const lastRate = hs.lastWeekTotal > 0 ? Math.round((hs.lastWeekDone / hs.lastWeekTotal) * 100) : 0;
      habitRateList.push({
        id,
        name: hs.name,
        icon: hs.icon,
        category: hs.category,
        thisWeekRate: thisRate,
        lastWeekRate: lastRate,
        streak: hs.streak,
        fails: hs.fails,
        failCount: hs.fails.length
      });
    }

    habitRateList.sort((a, b) => b.thisWeekRate - a.thisWeekRate);

    const bestHabit = habitRateList.length > 0 ? habitRateList[0] : null;
    const weakestHabit = habitRateList.length > 0 ? habitRateList[habitRateList.length - 1] : null;

    const failDayList = [];
    for (const day in dayFailStats) {
      const stats = dayFailStats[day];
      if (stats.total > 0) {
        failDayList.push({
          dayName: day,
          failRate: stats.total > 0 ? Math.round((stats.fail / stats.total) * 100) : 0,
          failCount: stats.fail,
          total: stats.total
        });
      }
    }
    failDayList.sort((a, b) => b.failRate - a.failRate);

    const highFailDay = failDayList.length > 0 && failDayList[0].failRate > 50 ? failDayList[0] : null;

    const categoryStats = {};
    habitsConfig.forEach(h => {
      if (h.enabled === false) return;
      const cat = h.category || 'other';
      if (!categoryStats[cat]) {
        categoryStats[cat] = {
          name: (CATEGORY_NAMES[cat] || {}).name || cat,
          icon: (CATEGORY_NAMES[cat] || {}).icon || '📋',
          thisWeekDone: 0,
          thisWeekTotal: 0,
          lastWeekDone: 0,
          lastWeekTotal: 0
        };
      }
      const hs = habitStats[h.id];
      categoryStats[cat].thisWeekDone += hs.thisWeekDone;
      categoryStats[cat].thisWeekTotal += hs.thisWeekTotal;
      categoryStats[cat].lastWeekDone += hs.lastWeekDone;
      categoryStats[cat].lastWeekTotal += hs.lastWeekTotal;
    });

    for (const cat in categoryStats) {
      const cs = categoryStats[cat];
      cs.thisWeekRate = cs.thisWeekTotal > 0 ? Math.round((cs.thisWeekDone / cs.thisWeekTotal) * 100) : 0;
      cs.lastWeekRate = cs.lastWeekTotal > 0 ? Math.round((cs.lastWeekDone / cs.lastWeekTotal) * 100) : 0;
    }

    const waterStats = getWaterStats(7);
    const emotionDist = getEmotionDistribution(7);
    const constitution = getConstitution();
    const level = getUserLevel();
    const season = getCurrentSeason();

    return {
      period: 'week',
      periodLabel: '本周',
      startDate: _formatDate(thisWeekStart),
      endDate: _formatDate(thisWeekEnd),
      summary: {
        overallRate: thisWeekRate,
        lastWeekRate: lastWeekRate,
        trend,
        trendText,
        totalHabits: habitsConfig.filter(h => h.enabled !== false).length,
        thisWeekDone,
        thisWeekTotal
      },
      dailyStats,
      habitStats: habitRateList,
      bestHabit: bestHabit ? {
        id: bestHabit.id,
        name: bestHabit.name,
        icon: bestHabit.icon,
        rate: bestHabit.thisWeekRate,
        streak: bestHabit.streak
      } : null,
      weakestHabit: weakestHabit ? {
        id: weakestHabit.id,
        name: weakestHabit.name,
        icon: weakestHabit.icon,
        rate: weakestHabit.thisWeekRate,
        failCount: weakestHabit.failCount
      } : null,
      highFailDay,
      categoryStats,
      waterStats,
      emotionDist,
      userContext: {
        level,
        season,
        constitutionType: constitution ? constitution.typeId : null,
        constitutionName: constitution && constitution.typeName ? constitution.typeName : null
      },
      dataSource: ['本周打卡记录', '上周打卡记录', '睡眠记录', '情绪记录']
    };
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Recommendation = {
    CATEGORY_NAMES,
    CONSTITUTION_FOCUS,
    SEASON_FOCUS,
    getUserLevel,
    getCategoryCompletion,
    findWeakCategories,
    getConstitution,
    getCurrentSeason,
    getWaterStats,
    getEmotionDistribution,
    generateRecommendations,
    generateHealthReport,
    getDailyTip,
    generateWeeklyAnalysisData
  };

  if (App.registerModule) {
    App.registerModule('modules.recommendation', 'modules', null);
  }
})();
