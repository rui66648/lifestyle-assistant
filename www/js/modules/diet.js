(function() {
  /* ========== 原有数据 ========== */
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
    breakfast: { title:'早餐', time:'7:00-9:00', icon:'🥣', desc:'辰时胃经当令，营养吸收最佳', tips:['一定要吃早餐','碳水+蛋白质+蔬果搭配','不要吃得太急','温热食物为宜'] },
    lunch: { title:'午餐', time:'11:30-13:30', icon:'🍱', desc:'午时心经当令，午餐后宜小憩', tips:['吃饱但不要过饱','荤素搭配均衡','饭后散步10分钟','避免马上午睡'] },
    dinner: { title:'晚餐', time:'17:30-19:30', icon:'🍲', desc:'酉时肾经当令，晚餐宜早宜少', tips:['七分饱即可','清淡少油少盐','睡前3小时不吃东西','多吃蔬菜少吃肉'] },
  };

  /* ========== 新增：饮食记录配置 ========== */
  const STORAGE_KEY = 'diet_photo_records';
  const MAX_RECORDS = 60;
  const MEAL_OPTIONS = [
    {id:'breakfast',label:'早餐',icon:'🌅'},
    {id:'lunch',label:'午餐',icon:'☀️'},
    {id:'dinner',label:'晚餐',icon:'🌙'},
    {id:'snack',label:'加餐',icon:'🍎'}
  ];

  let currentDietView = 'knowledge';
  let tempPhotoBase64 = null;

  function today() {
    try { return App.Core.Utils.today(); }
    catch(e) {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }
  }

  /* ========== 原有辅助函数 ========== */
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

  const SOLAR_TERM_FOODS = {
    '立春':{foods:['韭菜','豆芽','香椿','春笋','荠菜'],tag:'春'},
    '雨水':{foods:['山药','薏米','红枣','蜂蜜','南瓜'],tag:'湿'},
    '惊蛰':{foods:['梨','银耳','百合','莲子','蜂蜜'],tag:'燥'},
    '春分':{foods:['春笋','菠菜','芹菜','荠菜','枸杞'],tag:'平'},
    '清明':{foods:['青团','艾草','马兰头','螺蛳','河蚌'],tag:'清'},
    '谷雨':{foods:['香椿','豆芽','草莓','菠萝','桑葚'],tag:'湿'},
    '立夏':{foods:['苦瓜','黄瓜','绿豆','西瓜','莲子'],tag:'夏'},
    '小满':{foods:['苦瓜','绿豆','冬瓜','薏米','丝瓜'],tag:'湿'},
    '芒种':{foods:['杨梅','青梅','西瓜','绿豆汤','酸梅汤'],tag:'暑'},
    '夏至':{foods:['西瓜','苦瓜','绿豆','荷叶茶','鸭肉'],tag:'热'},
    '小暑':{foods:['绿豆','苦瓜','冬瓜','莲子','荷叶'],tag:'暑'},
    '大暑':{foods:['绿豆','苦瓜','莲子','冬瓜','西瓜'],tag:'热'},
    '立秋':{foods:['梨','银耳','百合','蜂蜜','柚子'],tag:'燥'},
    '处暑':{foods:['百合','银耳','莲子','梨','鸭肉'],tag:'润'},
    '白露':{foods:['山药','红枣','核桃','百合','银耳'],tag:'养'},
    '秋分':{foods:['秋梨','百合','银耳','蜂蜜','芝麻'],tag:'平'},
    '寒露':{foods:['芝麻','核桃','山药','红枣','栗子'],tag:'温'},
    '霜降':{foods:['柿子','栗子','萝卜','牛肉','羊肉'],tag:'补'},
    '立冬':{foods:['羊肉','牛肉','核桃','栗子','红薯'],tag:'补'},
    '小雪':{foods:['羊肉','牛肉','白萝卜','山药','核桃'],tag:'温'},
    '大雪':{foods:['羊肉','牛肉','萝卜','核桃','黑芝麻'],tag:'补'},
    '冬至':{foods:['饺子','羊肉','汤圆','核桃','黑芝麻'],tag:'补'},
    '小寒':{foods:['羊肉','牛肉','黑豆','黑芝麻','核桃'],tag:'温'},
    '大寒':{foods:['羊肉','牛肉','糯米','红枣','桂圆'],tag:'补'}
  };

  function getSeasonalTip() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    let term = null;
    let minDiff = Infinity;
    if (typeof SOLAR_TERMS !== 'undefined' && Array.isArray(SOLAR_TERMS)) {
      for (const t of SOLAR_TERMS) {
        const tDate = new Date(now.getFullYear(), t.month - 1, t.day);
        const diff = Math.abs(tDate - now);
        if (diff < minDiff) { minDiff = diff; term = t; }
      }
    }
    const seasonMap = {spring:'春季',summer:'夏季',autumn:'秋季',winter:'冬季'};
    const seasonEmojis = {spring:'🌱',summer:'☀️',autumn:'🍂',winter:'❄️'};
    const seasonTips = {
      '春季':'省酸增甘，以养脾气。多吃甘味食物如红枣、山药、小米。',
      '夏季':'清淡为主，适当食苦味清心火。多吃苦瓜、莲子、绿豆。',
      '秋季':'省辛增酸，以养肝气。多吃酸味食物如山楂、乌梅、石榴。',
      '冬季':'省咸增苦，以养心气。多吃黑色食物如黑豆、黑芝麻、核桃。'
    };
    if (term) {
      const season = seasonMap[term.season] || '四季';
      const seasonEmoji = seasonEmojis[term.season] || '🌍';
      const seasonTip = seasonTips[season] || '饮食有节，起居有常。';
      const termFoods = SOLAR_TERM_FOODS[term.name] || {foods:[],tag:''};
      return {
        season,
        icon: seasonEmoji,
        tip: seasonTip,
        termName: term.name,
        termEmoji: term.emoji,
        termTip: term.tip,
        foods: termFoods.foods,
        foodTag: termFoods.tag
      };
    }
    const season = month >= 2 && month <= 4 ? '春季' : month >= 5 && month <= 7 ? '夏季' : month >= 8 && month <= 10 ? '秋季' : '冬季';
    return {
      season,
      icon: seasonEmojis[season] || '🌍',
      tip: seasonTips[season] || '饮食有节，起居有常。',
      termName: null,
      termEmoji: null,
      termTip: null,
      foods: [],
      foodTag: ''
    };
  }

  /* ========== 新增：存储管理 ========== */
  function loadRecords() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  }

  function saveRecords(records) {
    try {
      if (records.length > MAX_RECORDS) records = records.slice(0, MAX_RECORDS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch(e) {
      if (records.length > 5) {
        records = records.slice(0, Math.floor(records.length / 2));
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); return; }
        catch(e2) {}
      }
      if (typeof showToast === 'function') showToast('保存失败，存储空间已满');
    }
  }

  function addRecord(record) {
    const records = loadRecords();
    records.unshift(record);
    saveRecords(records);
  }

  function deleteRecord(id) {
    let records = loadRecords();
    records = records.filter(r => r.id !== id);
    saveRecords(records);
  }

  function getRecordsByDate(date) {
    return loadRecords().filter(r => r.date === date);
  }

  function getAllDates() {
    const records = loadRecords();
    const dates = [...new Set(records.map(r => r.date))];
    return dates.sort((a,b) => b.localeCompare(a));
  }

  /* ========== 新增：图片压缩 ========== */
  function compressImage(file, maxWidth, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ========== 新增：本地分析 ========== */
  function buildLocalAnalysis(records) {
    if (!records || records.length === 0) return null;
    const meals = records.map(r => r.meal);
    const hasBreakfast = meals.includes('breakfast');
    const hasLunch = meals.includes('lunch');
    const hasDinner = meals.includes('dinner');
    let score = 0, tips = [];

    if (hasBreakfast) score += 25; else tips.push('❌ 未记录早餐，辰时胃经当令，不吃早餐伤胃气');
    if (hasLunch) score += 25; else tips.push('❌ 未记录午餐，午时心经当令，午餐要吃饱');
    if (hasDinner) score += 25; else tips.push('❌ 未记录晚餐，酉时肾经当令，晚餐宜早宜少');

    const dinnerRec = records.find(r => r.meal === 'dinner');
    if (dinnerRec) {
      const hour = parseInt(dinnerRec.time.split(':')[0]);
      if (hour >= 20) tips.push('⚠️ 晚餐时间较晚，建议19:30前吃完');
      else score += 10;
    }

    const allDesc = records.map(r => r.description || '').join(' ');
    const hasVeggie = /菜|蔬|果|瓜|豆|菇|茄|椒|菠|芹|萝|西兰|生菜|白菜|青|绿/i.test(allDesc);
    if (hasVeggie) score += 15; else tips.push('💡 建议每餐搭配蔬菜，五谷为养，五菜为充');

    if (tips.length === 0) tips.push('✅ 今日饮食规律，继续保持！');

    return {
      score: Math.min(100, score),
      mealCount: records.length,
      hasBreakfast, hasLunch, hasDinner,
      tips,
      summary: `今日记录 ${records.length} 餐${hasBreakfast && hasLunch && hasDinner ? '，三餐规律' : ''}`
    };
  }

  /* ========== 新增：AI 分析 ========== */
  async function callDietAI(prompt) {
    let cfg = {};
    try {
      const saved = localStorage.getItem('ai_config');
      if (saved) cfg = JSON.parse(saved);
    } catch(e) {}

    const workerUrl = cfg.workerUrl || '';
    const apiKey = cfg.apiKey || '';
    const model = cfg.model || 'qwen-turbo';

    if (!workerUrl && !apiKey) throw new Error('AI 未配置');

    const messages = [
      {role:'system', content:'你是一位精通《黄帝内经》的中医养生顾问，擅长饮食调理建议。回答简洁实用，控制在200字以内。'},
      {role:'user', content:prompt}
    ];

    if (workerUrl) {
      const res = await fetch(workerUrl, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({model, messages, max_tokens:500, temperature:0.7})
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'Worker 错误');
      return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    } else {
      const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer ' + apiKey},
        body: JSON.stringify({model, messages, max_tokens:500, temperature:0.7})
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'API 错误');
      return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    }
  }



  /* ========== 原有：饮食知识视图 ========== */
  function renderKnowledgeView() {
    const tipOfDay = getDietTipOfDay();
    const currentMeal = getCurrentMeal();
    const seasonal = getSeasonalTip();

    let mealSection = '';
    if (currentMeal && mealTips[currentMeal]) {
      const meal = mealTips[currentMeal];
      mealSection = `
        <div class="diet-meal-card">
          <div class="diet-meal-header">
            <span class="diet-meal-icon">${esc(meal.icon)}</span>
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
          <div class="diet-color-icon">${esc(item.icon)}</div>
          <div class="diet-color-name">${item.color}色入${item.organ}</div>
          <div class="diet-color-foods">${item.foods.join('、')}</div>
        </div>
      `;
    });

    const dietHabits = habitsConfig.filter(h => h.category === 'diet' || h.category === 'quit');
    let todayDietRec = checkinRecords[today()] || {};
    let completedDiet = 0;
    dietHabits.forEach(h => { if (todayDietRec[h.id] && todayDietRec[h.id].done) completedDiet++; });

    return `
      <div class="diet-panel">
        <div class="diet-tip-card">
          <div class="diet-tip-icon">💡</div>
          <div class="diet-tip-content">
            <div class="diet-tip-text">"${esc(tipOfDay.tip)}"</div>
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
            <span class="diet-summary-val">${esc(seasonal.icon)} ${seasonal.season}</span>
            <span class="diet-summary-label">当前节气</span>
          </div>
        </div>

        <div class="diet-section-title">🌿 节气饮食</div>
        <div class="diet-seasonal-card">
          <span class="diet-seasonal-icon">${esc(seasonal.icon)}</span>
          <div class="diet-seasonal-text">${esc(seasonal.tip)}</div>
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
                <span class="diet-habit-icon">${esc(h.icon)}</span>
                <span class="diet-habit-name">${esc(h.name)}</span>
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

  function renderMealProgress(records) {
    const mealStats = {};
    MEAL_OPTIONS.forEach(m => { mealStats[m.id] = { label: m.label, icon: m.icon, count: 0 }; });
    records.forEach(r => { if (mealStats[r.meal]) mealStats[r.meal].count++; });
    const total = MEAL_OPTIONS.length;
    const done = MEAL_OPTIONS.filter(m => mealStats[m.id].count > 0).length;

    return `
      <div class="diet-meal-progress">
        <div class="diet-meal-progress-bar">
          ${MEAL_OPTIONS.map(m => `
            <div class="diet-meal-seg ${mealStats[m.id].count > 0 ? 'done' : ''}" title="${m.label}">
              <span class="diet-meal-seg-icon">${m.icon}</span>
              <span class="diet-meal-seg-label">${m.label}</span>
            </div>
          `).join('')}
        </div>
        <div class="diet-meal-progress-info">
          <span class="diet-meal-progress-text">已记录 ${done}/${total} 餐</span>
          <span class="diet-meal-progress-count">共 ${records.length} 张</span>
        </div>
      </div>
    `;
  }

  let _dietDietCollapsed = true;
  let _dietSportCollapsed = true;

  window.toggleDietKnowledge = function() {
    _dietDietCollapsed = !_dietDietCollapsed;
    const content = document.getElementById('dkCollapsibleContent');
    const arrow = document.getElementById('dkCollapseArrow');
    if (content) content.style.display = _dietDietCollapsed ? 'none' : 'block';
    if (arrow) arrow.style.transform = _dietDietCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
  };

  window.toggleDietSport = function() {
    _dietSportCollapsed = !_dietSportCollapsed;
    const content = document.getElementById('dkSportContent');
    const arrow = document.getElementById('dkSportArrow');
    if (content) content.style.display = _dietSportCollapsed ? 'none' : 'block';
    if (arrow) arrow.style.transform = _dietSportCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
  };

  /* ========== 新增：饮食记录视图 ========== */
  function renderRecordView(targetDate) {
    const date = targetDate || today();
    const todayRecords = getRecordsByDate(date);
    const analysis = buildLocalAnalysis(todayRecords);
    const allDates = getAllDates();
    const seasonal = getSeasonalTip();
    const currentMeal = getCurrentMeal();
    const mealTip = currentMeal && mealTips[currentMeal] ? mealTips[currentMeal] : null;

    let tipCard = '';
    if (mealTip) {
      tipCard = `
        <div class="diet-tip-advice-card">
          <div class="diet-tip-advice-header">
            <span class="diet-tip-advice-icon">${esc(mealTip.icon)}</span>
            <span class="diet-tip-advice-title">${mealTip.title} · ${mealTip.time}</span>
          </div>
          <div class="diet-tip-advice-text">${esc(mealTip.tips[0])}</div>
          <div class="diet-tip-advice-tags">
            ${mealTip.tips.slice(1, 4).map(t => `<span class="diet-tip-tag">${esc(t)}</span>`).join('')}
          </div>
        </div>
      `;
    } else if (seasonal) {
      tipCard = `
        <div class="diet-tip-advice-card">
          <div class="diet-tip-advice-header">
            <span class="diet-tip-advice-icon">${esc(seasonal.termEmoji || seasonal.icon)}</span>
            <span class="diet-tip-advice-title">${seasonal.termName || seasonal.season}饮食</span>
          </div>
          <div class="diet-tip-advice-text">${esc(seasonal.termTip || seasonal.tip)}</div>
        </div>
      `;
    }

    return `
      <div class="diet-record-view">
        <div class="diet-photo-hero">
          <input type="file" id="dietPhotoInput" accept="image/*" capture="environment" style="display:none" onchange="handleDietPhotoSelect(this)">
          <button class="diet-photo-hero-btn" onclick="document.getElementById('dietPhotoInput').click()">
            <div class="diet-photo-hero-icon">📷</div>
            <div class="diet-photo-hero-text">
              <div class="diet-photo-hero-title">拍照记录</div>
              <div class="diet-photo-hero-sub">记录每一餐 · 养成健康饮食习惯</div>
            </div>
            <div class="diet-photo-hero-arrow">›</div>
          </button>
        </div>

        ${tipCard}

        ${analysis ? renderAnalysisCard(analysis) : ''}

        <div class="diet-today-card">
          <div class="diet-today-header">
            <span class="diet-today-title">${date === today() ? '今日记录' : date + ' 记录'}</span>
          </div>
          ${renderMealProgress(todayRecords)}
          ${todayRecords.length > 0 ? renderRecordGrid(todayRecords) : '<div class="diet-empty-tip">' + (date === today() ? '今天还没有记录哦，点击上方按钮开始记录 📷' : '该日期暂无记录') + '</div>'}
        </div>

        ${renderHistorySection(allDates)}

        <div class="dk-collapse-wrap">
          <div class="dk-collapse-header" onclick="toggleDietKnowledge()">
            <span class="dk-collapse-title">🍃 饮食建议</span>
            <span class="dk-collapse-arrow" id="dkCollapseArrow">›</span>
          </div>
          <div class="dk-collapse-content" id="dkCollapsibleContent" style="display:${_dietDietCollapsed ? 'none' : 'block'}">
            ${renderDietKnowledgeCompact(seasonal, mealTip)}
          </div>
        </div>

        <div class="dk-collapse-wrap">
          <div class="dk-collapse-header" onclick="toggleDietSport()">
            <span class="dk-collapse-title">🏃 运动养生</span>
            <span class="dk-collapse-arrow" id="dkSportArrow">›</span>
          </div>
          <div class="dk-collapse-content" id="dkSportContent" style="display:${_dietSportCollapsed ? 'none' : 'block'}">
            ${renderSportsKnowledgeCompact()}
          </div>
        </div>

        <div style="height:20px"></div>
      </div>
    `;
  }

  function renderAnalysisCard(analysis) {
    const scoreColor = analysis.score >= 80 ? '#7CB69D' : analysis.score >= 60 ? '#F4A683' : '#E07A5F';
    return `
      <div class="diet-analysis-card">
        <div class="diet-analysis-header">
          <div class="diet-analysis-score-ring" style="--score-color:${scoreColor}">
            <span class="diet-analysis-score">${analysis.score}</span>
          </div>
          <div class="diet-analysis-info">
            <div class="diet-analysis-title">今日饮食评分</div>
            <div class="diet-analysis-summary">${esc(analysis.summary)}</div>
          </div>
        </div>
        <div class="diet-analysis-tags">
          ${analysis.tips.map(t => `<span class="diet-analysis-tag">${esc(t)}</span>`).join('')}
        </div>
        <div class="diet-analysis-footer">
          <button class="diet-analysis-ai-link" onclick="analyzeDietToday()">
            <span>🤖</span> AI 深度分析建议
          </button>
        </div>
      </div>
    `;
  }

  function renderRecordGrid(records) {
    return `
      <div class="diet-photo-grid">
        ${records.map(r => {
          const meal = MEAL_OPTIONS.find(m => m.id === r.meal);
          return `
            <div class="diet-photo-item" onclick="showDietPhotoDetail('${r.id}')">
              <img src="${r.image}" class="diet-photo-img" alt="">
              <div class="diet-photo-overlay">
                <span>${meal ? meal.icon : '🍽️'} ${esc(meal ? meal.label : '')}</span>
                <span>${esc(r.time)}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderHistorySection(allDates) {
    const otherDates = allDates.filter(d => d !== today());
    if (otherDates.length === 0) return '';

    return `
      <div class="diet-section-title">📆 历史记录</div>
      <div class="diet-history-list">
        ${otherDates.slice(0, 7).map((date, idx) => {
          const records = getRecordsByDate(date);
          const mealCount = records.length;
          const firstImg = records[0] ? records[0].image : '';
          const isLast = idx === otherDates.slice(0, 7).length - 1;
          return `
            <div class="diet-history-row">
              <div class="diet-history-timeline">
                <div class="diet-history-dot"></div>
                ${!isLast ? '<div class="diet-history-line"></div>' : ''}
              </div>
              <div class="diet-history-body">
                <div class="diet-history-item" onclick="toggleDietHistoryDate('${date}')">
                  <div class="diet-history-thumb" style="background-image:url('${firstImg}')"></div>
                  <div class="diet-history-info">
                    <div class="diet-history-date">${date}</div>
                    <div class="diet-history-count">共 ${mealCount} 餐</div>
                  </div>
                  <span class="diet-history-arrow" id="dietHistoryArrow_${date}">›</span>
                </div>
                <div class="diet-history-detail" id="dietHistoryDetail_${date}" style="display:none">
                  ${renderRecordGrid(records)}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /* ========== 修改：主渲染函数（饮食面板只保留知识内容） ========== */
  function renderDietPanel() {
    return renderKnowledgeView();
  }

  /* ========== 新增：记录页底部知识精简卡 ========== */
  function renderDietKnowledgeCompact(seasonal, mealTip) {
    // 五色饮食精简
    const colorsHtml = fiveColorsFoods.map(item => `
      <div class="dk-color-item">
        <span class="dk-color-icon">${esc(item.icon)}</span>
        <span class="dk-color-name">${item.color}色·${item.organ}</span>
        <span class="dk-color-foods">${item.foods.slice(0,3).join('、')}</span>
      </div>
    `).join('');

    // 当餐建议精简
    let mealHtml = '';
    if (mealTip) {
      mealHtml = `
        <div class="dk-meal-card">
          <div class="dk-meal-header">
            <span class="dk-meal-icon">${esc(mealTip.icon)}</span>
            <span class="dk-meal-title">${mealTip.title} · ${mealTip.time}</span>
          </div>
          <div class="dk-meal-tips">
            ${mealTip.tips.map(t => `<span class="dk-meal-tag">${esc(t)}</span>`).join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="dk-section">
        <div class="dk-section-title">饮食建议</div>
        <div class="dk-seasonal-card">
          <span class="dk-seasonal-icon">${esc(seasonal.icon)}</span>
          <div class="dk-seasonal-body">
            <div class="dk-seasonal-name">${seasonal.season}饮食</div>
            <div class="dk-seasonal-text">${esc(seasonal.tip)}</div>
          </div>
        </div>
        ${mealHtml}
        <div class="dk-colors-grid">${colorsHtml}</div>
      </div>
    `;
  }

  function renderSportsKnowledgeCompact() {
    if (!App.Data || !App.Data.MeridianSports) return '';
    const currentMeridian = App.Data.MeridianSports.find(m => {
      const h = new Date().getHours();
      return h >= m.start && h < m.end;
    }) || App.Data.MeridianSports[0];

    const dailyTargets = App.Data.DailyTargets || {};
    const targetsHtml = Object.entries(dailyTargets).map(([key, t]) => `
      <div class="dk-sport-target">
        <span class="dk-sport-target-label">${t.label}</span>
        <span class="dk-sport-target-val">${esc(t.target)}${esc(t.unit)}</span>
      </div>
    `).join('');

    // 运动处方精简（取前2个）
    const prescriptions = App.Data.SportPrescriptions || {};
    const prescriptionHtml = Object.values(prescriptions).slice(0, 2).map(p => `
      <div class="dk-prescription-card">
        <div class="dk-prescription-header">
          <span class="dk-prescription-icon">${esc(p.icon)}</span>
          <span class="dk-prescription-title">${p.title}</span>
        </div>
        <div class="dk-prescription-rows">
          <span>时长 ${p.duration}</span>
          <span>强度 ${p.intensity}</span>
        </div>
        <div class="dk-prescription-tip">${esc(p.tip)}</div>
      </div>
    `).join('');

    return `
      <div class="dk-section">
        <div class="dk-section-title">运动养生</div>
        <div class="dk-meridian-card">
          <span class="dk-meridian-icon">${esc(currentMeridian.icon)}</span>
          <div class="dk-meridian-body">
            <div class="dk-meridian-name">${esc(currentMeridian.name)} · ${currentMeridian.meridian}</div>
            <div class="dk-meridian-action">${currentMeridian.highlight ? '⭐ 最佳运动时段' : esc(currentMeridian.action)}</div>
          </div>
        </div>
        ${targetsHtml ? `<div class="dk-sport-targets">${targetsHtml}</div>` : ''}
        ${prescriptionHtml ? `<div class="dk-prescriptions">${prescriptionHtml}</div>` : ''}
      </div>
    `;
  }

  /* ========== 新增：全局交互函数 ========== */
  window.switchDietView = function(view) {
    currentDietView = view;
    const body = document.getElementById('dietPanelBody');
    if (body && App.Modules.Diet) {
      body.innerHTML = App.Modules.Diet.renderDietPanel();
    }
  };

  window.handleDietPhotoSelect = async function(input) {
    const file = input.files[0];
    if (!file) return;
    try {
      if (typeof showToast === 'function') showToast('正在处理图片...');
      const base64 = await compressImage(file, 800, 0.7);
      tempPhotoBase64 = base64;
      showDietRecordForm(base64);
    } catch(e) {
      if (typeof showToast === 'function') showToast('图片处理失败');
      console.error(e);
    }
    input.value = '';
  };

  window.showDietRecordForm = function(base64) {
    const body = document.getElementById('dietPanelBody');
    const existing = document.getElementById('dietRecordFormOverlay');
    if (existing) existing.remove();

    const html = `
      <div id="dietRecordFormOverlay" class="diet-form-overlay" onclick="if(event.target===this)closeDietRecordForm()">
        <div class="diet-form-panel" onclick="event.stopPropagation()">
          <div class="diet-form-header">
            <span>📝 记录饮食</span>
            <button class="diet-form-close" onclick="closeDietRecordForm()">✕</button>
          </div>
          <div class="diet-form-body">
            <img src="${base64}" class="diet-form-preview">
            <div class="diet-form-group">
              <label>选择餐次</label>
              <div class="diet-meal-options">
                ${MEAL_OPTIONS.map(m => `
                  <div class="diet-meal-option" data-meal="${m.id}" onclick="selectDietMeal('${m.id}')">
                    <span class="diet-meal-option-icon">${m.icon}</span>
                    <span>${m.label}</span>
                  </div>
                `).join('')}
              </div>
            </div>
            <div class="diet-form-group">
              <label>食物描述（可选）</label>
              <textarea id="dietFormDesc" placeholder="例如：米饭、青菜、红烧肉、紫菜蛋花汤" rows="2"></textarea>
            </div>
            <button class="diet-form-save" onclick="saveDietRecord()">💾 保存记录</button>
          </div>
        </div>
      </div>
    `;
    body.insertAdjacentHTML('beforeend', html);

    const now = new Date();
    const hour = now.getHours();
    let defaultMeal = 'snack';
    if (hour >= 5 && hour < 10) defaultMeal = 'breakfast';
    else if (hour >= 10 && hour < 15) defaultMeal = 'lunch';
    else if (hour >= 15 && hour < 21) defaultMeal = 'dinner';
    selectDietMeal(defaultMeal);
  };

  window.selectDietMeal = function(mealId) {
    document.querySelectorAll('.diet-meal-option').forEach(el => {
      el.classList.toggle('selected', el.dataset.meal === mealId);
    });
    window._selectedDietMeal = mealId;
  };

  window.closeDietRecordForm = function() {
    const el = document.getElementById('dietRecordFormOverlay');
    if (el) el.remove();
    tempPhotoBase64 = null;
    window._selectedDietMeal = null;
  };

  window.saveDietRecord = function() {
    if (!tempPhotoBase64) return;
    const mealId = window._selectedDietMeal || 'snack';
    const descEl = document.getElementById('dietFormDesc');
    const desc = descEl ? descEl.value.trim() : '';
    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

    const record = {
      id: 'diet_' + now.getTime(),
      date: today(),
      time: timeStr,
      meal: mealId,
      image: tempPhotoBase64,
      description: desc,
      createdAt: now.toISOString()
    };

    addRecord(record);
    closeDietRecordForm();
    if (typeof showToast === 'function') showToast('✅ 记录已保存');
    switchDietView('record');
  };

  window.deleteDietRecord = function(id) {
    if (!confirm('确定删除这条记录吗？')) return;
    deleteRecord(id);
    switchDietView('record');
    if (typeof showToast === 'function') showToast('已删除');
  };

  window.showDietPhotoDetail = function(id) {
    const records = loadRecords();
    const record = records.find(r => r.id === id);
    if (!record) return;
    const meal = MEAL_OPTIONS.find(m => m.id === record.meal);

    const html = `
      <div id="dietPhotoDetailOverlay" class="diet-form-overlay" onclick="if(event.target===this)closeDietPhotoDetail()">
        <div class="diet-detail-panel" onclick="event.stopPropagation()">
          <button class="diet-detail-close" onclick="closeDietPhotoDetail()">✕</button>
          <img src="${record.image}" class="diet-detail-img">
          <div class="diet-detail-info">
            <div class="diet-detail-meal">${meal ? meal.icon : '🍽️'} ${esc(meal ? meal.label : record.meal)} · ${esc(record.time)}</div>
            ${record.description ? `<div class="diet-detail-desc">${esc(record.description)}</div>` : ''}
            <button class="diet-detail-delete" onclick="deleteDietRecord('${record.id}'); closeDietPhotoDetail();">🗑️ 删除记录</button>
          </div>
        </div>
      </div>
    `;
    const body = document.getElementById('dietPanelBody');
    const existing = document.getElementById('dietPhotoDetailOverlay');
    if (existing) existing.remove();
    body.insertAdjacentHTML('beforeend', html);
  };

  window.closeDietPhotoDetail = function() {
    const el = document.getElementById('dietPhotoDetailOverlay');
    if (el) el.remove();
  };

  window.toggleDietHistoryDate = function(date) {
    const detail = document.getElementById('dietHistoryDetail_' + date);
    const arrow = document.getElementById('dietHistoryArrow_' + date);
    if (!detail) return;
    const showing = detail.style.display !== 'none';
    detail.style.display = showing ? 'none' : 'block';
    if (arrow) arrow.style.transform = showing ? '' : 'rotate(90deg)';
  };

  window.analyzeDietToday = async function() {
    const todayRecords = getRecordsByDate(today());
    if (todayRecords.length === 0) {
      if (typeof showToast === 'function') showToast('今天还没有记录');
      return;
    }

    let cfg = {};
    try {
      const saved = localStorage.getItem('ai_config');
      if (saved) cfg = JSON.parse(saved);
    } catch(e) {}
    if ((!cfg.workerUrl || cfg.workerUrl.trim() === '') && (!cfg.apiKey || cfg.apiKey.trim() === '')) {
      if (typeof showToast === 'function') showToast('请先配置AI（我的 → 设置 → AI配置）');
      return;
    }

    if (typeof showToast === 'function') showToast('AI 分析中...');

    try {
      const lines = todayRecords.map(r => {
        const meal = MEAL_OPTIONS.find(m => m.id === r.meal);
        return `- ${meal ? meal.label : r.meal}（${r.time}）：${r.description || '未描述'}`;
      });

      const prompt = `请作为中医养生顾问，根据以下今日饮食记录给出简短分析和建议（控制在200字以内）：\n\n${lines.join('\n')}\n\n请从以下角度分析：\n1. 三餐是否规律、时间是否合适\n2. 食物搭配是否合理（五谷、蔬果、蛋白质等）\n3. 从《黄帝内经》等中医角度给出建议\n4. 具体的改进建议`;

      const reply = await callDietAI(prompt);
      if (reply) {
        const body = document.getElementById('dietPanelBody');
        const html = `
          <div id="dietAIResultOverlay" class="diet-form-overlay" onclick="if(event.target===this)this.remove()">
            <div class="diet-ai-result-panel" onclick="event.stopPropagation()">
              <div class="diet-ai-result-header">
                <span>🤖 AI 饮食分析</span>
                <button onclick="document.getElementById('dietAIResultOverlay').remove()">✕</button>
              </div>
              <div class="diet-ai-result-body"><pre>${esc(reply)}</pre></div>
            </div>
          </div>
        `;
        const existing = document.getElementById('dietAIResultOverlay');
        if (existing) existing.remove();
        body.insertAdjacentHTML('beforeend', html);
      }
    } catch(e) {
      if (typeof showToast === 'function') showToast('AI分析失败：' + (e.message || '请检查网络或配置'));
      console.error(e);
    }
  };

  /* ========== 模块导出 ========== */
  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Diet = {
    renderDietPanel,
    renderRecordView,
    getDietTipOfDay,
    getCurrentMeal,
    getSeasonalTip,
    switchDietView,
    loadRecords
    // 注意：saveRecords 不导出，避免与 App.Core.Storage.saveRecords 冲突
    // （compat.js 会把模块函数暴露到 window，导致 window.saveRecords 被覆盖）
  };

  if (App.registerModule) {
    App.registerModule('modules.diet', 'modules', null);
  }
})();
