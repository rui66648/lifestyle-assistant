(function() {
  const dietTips = [
    {tip:'五谷为养，五果为助，五畜为益，五菜为充。',source:'《素问·藏气法时论》'},
    {tip:'饮食自倍，肠胃乃伤。',source:'《素问·痹论》'},
    {tip:'早饭好，午饭饱，晚饭少。',source:'民间养生谚语'},
    {tip:'进食顺序：先吃蔬菜→再吃蛋白质→最后吃碳水，可降低血糖峰值。',source:'《控糖革命》'},
    {tip:'成年人每天建议饮水1500-2000ml，少量多次。',source:'现代营养学'},
    {tip:'胃以喜为补，适合自己的才是最好的。',source:'中医养生理念'},
    {tip:'早饭吃得像皇帝，午饭吃得像平民，晚饭吃得像乞丐。',source:'民间养生谚语'},
    {tip:'细嚼慢咽，每口饭咀嚼20次以上，有助于消化吸收。',source:'传统养生智慧'},
    {tip:'春季省酸增甘，以养脾气；夏季省苦增辛，以养肺气。',source:'《黄帝内经》四季养生'},
    {tip:'秋季省辛增酸，以养肝气；冬季省咸增苦，以养心气。',source:'《黄帝内经》四季养生'},
    {tip:'五色入五脏：青入肝、赤入心、黄入脾、白入肺、黑入肾。',source:'中医五行理论'},
    {tip:'不渴也要喝水，不饿也要吃饭，不累也要休息，无病也要锻炼。',source:'民间养生谚语'},
  ];

  const fiveColorsFoods = [
    {color:'青',organ:'肝',icon:'🥬',foods:['菠菜','西兰花','芹菜','黄瓜','绿豆']},
    {color:'赤',organ:'心',icon:'🍅',foods:['西红柿','红枣','红豆','胡萝卜','草莓']},
    {color:'黄',organ:'脾',icon:'🌽',foods:['小米','玉米','南瓜','山药','黄豆']},
    {color:'白',organ:'肺',icon:'🥔',foods:['白萝卜','银耳','百合','梨','豆腐']},
    {color:'黑',organ:'肾',icon:'🫘',foods:['黑豆','黑芝麻','黑米','黑木耳','紫菜']},
  ];

  const mealTips = {
    breakfast: {
      title:'早餐',
      time:'7:00-9:00',
      icon:'🥣',
      desc:'辰时胃经当令，营养吸收最佳',
      tips:['一定要吃早餐','碳水+蛋白质+蔬果搭配','不要吃得太急','温热食物为宜'],
    },
    lunch: {
      title:'午餐',
      time:'11:30-13:30',
      icon:'🍱',
      desc:'午时心经当令，午餐后宜小憩',
      tips:['吃饱但不要过饱','荤素搭配均衡','饭后散步10分钟','避免马上午睡'],
    },
    dinner: {
      title:'晚餐',
      time:'17:30-19:30',
      icon:'🍲',
      desc:'酉时肾经当令，晚餐宜早宜少',
      tips:['七分饱即可','清淡少油少盐','睡前3小时不吃东西','多吃蔬菜少吃肉'],
    },
  };

  function getDietTipOfDay() {
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    return dietTips[dayOfYear % dietTips.length];
  }

  function getCurrentMeal() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 10) return 'breakfast';
    if (hour >= 11 && hour < 14) return 'lunch';
    if (hour >= 17 && hour < 20) return 'dinner';
    return null;
  }

  function getSeasonalTip() {
    const month = new Date().getMonth() + 1;
    const tips = {
      '春季':{months:[2,3,4],tip:'省酸增甘，以养脾气。多吃甘味食物如红枣、山药、小米。',icon:'🌱'},
      '夏季':{months:[5,6,7],tip:'清淡为主，适当食苦味清心火。多吃苦瓜、莲子、绿豆。',icon:'☀️'},
      '秋季':{months:[8,9,10],tip:'省辛增酸，以养肝气。多吃酸味食物如山楂、乌梅、石榴。',icon:'🍂'},
      '冬季':{months:[11,12,1],tip:'省咸增苦，以养心气。多吃黑色食物如黑豆、黑芝麻、核桃。',icon:'❄️'},
    };
    for (const [season, info] of Object.entries(tips)) {
      if (info.months.includes(month)) {
        return {season,...info};
      }
    }
    return {season:'四季',tip:'饮食有节，起居有常。',icon:'🌍'};
  }

  function renderDietPanel() {
    const tipOfDay = getDietTipOfDay();
    const currentMeal = getCurrentMeal();
    const seasonal = getSeasonalTip();

    let mealSection = '';
    if (currentMeal && mealTips[currentMeal]) {
      const meal = mealTips[currentMeal];
      mealSection = `
        <div class="diet-meal-card">
          <div class="diet-meal-header">
            <span class="diet-meal-icon">${meal.icon}</span>
            <div>
              <div class="diet-meal-title">${meal.title} · ${meal.time}</div>
              <div class="diet-meal-desc">${meal.desc}</div>
            </div>
          </div>
          <div class="diet-meal-tips">
            ${meal.tips.map(t => `<div class="diet-meal-tip">✅ ${t}</div>`).join('')}
          </div>
        </div>
      `;
    }

    let fiveColorsHtml = '';
    fiveColorsFoods.forEach(item => {
      fiveColorsHtml += `
        <div class="diet-color-card">
          <div class="diet-color-icon">${item.icon}</div>
          <div class="diet-color-name">${item.color}色入${item.organ}</div>
          <div class="diet-color-foods">${item.foods.join('、')}</div>
        </div>
      `;
    });

    const dietHabits = habitsConfig.filter(h => h.category === 'diet' || h.category === 'quit');
    let todayDietRec = checkinRecords[App.Core.Utils.today()] || {};
    let completedDiet = 0;
    dietHabits.forEach(h => {
      if (todayDietRec[h.id] && todayDietRec[h.id].done) completedDiet++;
    });

    return `
      <div class="diet-panel">
        <div class="diet-tip-card">
          <div class="diet-tip-icon">💡</div>
          <div class="diet-tip-content">
            <div class="diet-tip-text">"${tipOfDay.tip}"</div>
            <div class="diet-tip-source">—— ${tipOfDay.source}</div>
          </div>
        </div>

        <div class="diet-summary">
          <div class="diet-summary-item">
            <span class="diet-summary-val">${completedDiet}/${dietHabits.length}</span>
            <span class="diet-summary-label">今日饮食习惯</span>
          </div>
          <div class="diet-summary-divider"></div>
          <div class="diet-summary-item">
            <span class="diet-summary-val">${seasonal.icon} ${seasonal.season}</span>
            <span class="diet-summary-label">当前节气</span>
          </div>
        </div>

        <div class="diet-section-title">🌿 节气饮食</div>
        <div class="diet-seasonal-card">
          <span class="diet-seasonal-icon">${seasonal.icon}</span>
          <div class="diet-seasonal-text">${seasonal.tip}</div>
        </div>

        ${mealSection}

        <div class="diet-section-title">🎨 五色饮食</div>
        <div class="diet-colors-grid">
          ${fiveColorsHtml}
        </div>

        <div class="diet-section-title">📚 饮食相关习惯</div>
        <div class="diet-habits-list">
          ${dietHabits.map(h => {
            const done = todayDietRec[h.id] && todayDietRec[h.id].done;
            return `
              <div class="diet-habit-item ${done ? 'done' : ''}" onclick="handleCheckin('${h.id}')">
                <span class="diet-habit-icon">${h.icon}</span>
                <span class="diet-habit-name">${h.name}</span>
                <span class="diet-habit-check">${done ? '✓' : '打卡'}</span>
              </div>
            `;
          }).join('')}
        </div>

        <div class="diet-section-title">📖 推荐阅读</div>
        <div class="diet-books-list">
          <div class="diet-book-item" onclick="window.open('references/饮膳正要/饮膳正要.html','_blank')">
            <span class="diet-book-emoji">🍲</span>
            <div class="diet-book-info">
              <div class="diet-book-name">《饮膳正要》</div>
              <div class="diet-book-desc">元代宫廷营养学专著</div>
            </div>
            <span class="diet-book-arrow">›</span>
          </div>
          <div class="diet-book-item" onclick="window.open('references/你是你吃出来的/你是你吃出来的.html','_blank')">
            <span class="diet-book-emoji">🥗</span>
            <div class="diet-book-info">
              <div class="diet-book-name">《你是你吃出来的》</div>
              <div class="diet-book-desc">细胞营养与七大营养素</div>
            </div>
            <span class="diet-book-arrow">›</span>
          </div>
          <div class="diet-book-item" onclick="window.open('references/控糖革命/控糖革命.html','_blank')">
            <span class="diet-book-emoji">🍬</span>
            <div class="diet-book-info">
              <div class="diet-book-name">《控糖革命》</div>
              <div class="diet-book-desc">血糖管理与健康饮食</div>
            </div>
            <span class="diet-book-arrow">›</span>
          </div>
        </div>

        <div style="height:20px"></div>
      </div>
    `;
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Diet = {
    renderDietPanel,
    getDietTipOfDay,
    getCurrentMeal,
    getSeasonalTip,
  };

  if (App.registerModule) {
    App.registerModule('modules.diet', 'modules', null);
  }
})();