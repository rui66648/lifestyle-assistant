(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;

  function openConstitutionPanel() {
    constitutionAnswers = [];
    constitutionResult = JSON.parse(localStorage.getItem('constitution_result') || 'null');
    if (constitutionResult) {
      renderConstitutionResult();
    } else {
      renderGenderSelect();
    }
    openPanel('constitutionPanel');
  }

  function renderGenderSelect() {
    var body = document.getElementById('constitutionPanelBody');
    body.innerHTML = '<div style="padding:1.5rem;text-align:center">' +
      '<div style="font-size:2rem;margin-bottom:0.8rem">🩺</div>' +
      '<div style="font-weight:700;font-size:1.1rem;margin-bottom:0.5rem">九种体质辨识</div>' +
      '<div style="color:var(--muted);font-size:0.85rem;margin-bottom:1.5rem;line-height:1.6">基于王琦教授《中医体质分类与判定》标准量表<br>共67道题目，请根据近一年的体验和感觉回答</div>' +
      '<div style="font-size:0.9rem;margin-bottom:1rem;color:var(--ink)">请选择您的性别（部分题目需性别筛选）</div>' +
      '<div style="display:flex;gap:1rem;justify-content:center">' +
        '<button class="const-option" style="flex:1;padding:1rem;font-size:1rem" onclick="startConstitutionQuiz(\'female\')">♀ 女性</button>' +
        '<button class="const-option" style="flex:1;padding:1rem;font-size:1rem" onclick="startConstitutionQuiz(\'male\')">♂ 男性</button>' +
      '</div>' +
    '</div>';
  }

  function startConstitutionQuiz(gender) {
    constitutionGender = gender;
    renderConstitutionQuiz(0);
  }

  function getFilteredQuiz() {
    return CONSTITUTION_QUIZ.filter(function(q) {
      if (q.gender) return q.gender === constitutionGender;
      return true;
    });
  }

  function renderConstitutionQuiz(qIdx) {
    var body = document.getElementById('constitutionPanelBody');
    var quiz = getFilteredQuiz();
    var q = quiz[qIdx];
    var progress = Math.round((qIdx / quiz.length) * 100);
    var typeName = CONSTITUTION_TYPES.find(function(c) { return c.id === q.type; });

    var html = '<div class="const-progress">' +
      '<div class="const-progress-bar"><div class="const-progress-fill" style="width:' + progress + '%"></div></div>' +
      '<span class="const-progress-text">' + (qIdx + 1) + '/' + quiz.length + ' ' + (typeName ? typeName.name : '') + '</span>' +
      '</div>' +
      '<div class="const-question">' +
        '<div class="const-question-text">' + q.question + '</div>' +
        '<div class="const-options">';

    q.options.forEach(function(opt, i) {
      html += '<div class="const-option" onclick="selectConstitutionOption(' + qIdx + ',' + i + ')">' + opt.text + '</div>';
    });

    html += '</div></div>';
    body.innerHTML = html;
  }

  function selectConstitutionOption(qIdx, optIdx) {
    constitutionAnswers.push({ qIdx: qIdx, optIdx: optIdx });

    var quiz = getFilteredQuiz();
    if (qIdx + 1 < quiz.length) {
      renderConstitutionQuiz(qIdx + 1);
    } else {
      calculateConstitution();
    }
  }

  function calculateConstitution() {
    var quiz = getFilteredQuiz();
    var rawScores = {};
    var questionCounts = {};
    CONSTITUTION_TYPES.forEach(function(c) {
      rawScores[c.id] = 0;
      questionCounts[c.id] = 0;
    });

    constitutionAnswers.forEach(function(ans) {
      var q = quiz[ans.qIdx];
      var score = q.options[ans.optIdx].score;
      rawScores[q.type] = (rawScores[q.type] || 0) + score;
      questionCounts[q.type] = (questionCounts[q.type] || 0) + 1;
    });

    // 转化分 = (原始分 - 题数) / (题数 × 4) × 100
    var convertedScores = {};
    CONSTITUTION_TYPES.forEach(function(c) {
      var raw = rawScores[c.id] || 0;
      var count = questionCounts[c.id] || 1;
      convertedScores[c.id] = Math.round((raw - count) / (count * 4) * 100);
    });

    // 判定标准：转化分 >= 40 分为该体质"是"
    // 平和质特殊：转化分 >= 60 为"是"，且各偏颇体质都 < 30
    var resultTypes = [];
    CONSTITUTION_TYPES.forEach(function(c) {
      if (c.id === 'pinghe') return;
      if (convertedScores[c.id] >= 40) {
        resultTypes.push({
          id: c.id,
          name: c.name,
          emoji: c.emoji,
          color: c.color,
          score: convertedScores[c.id],
          level: convertedScores[c.id] >= 60 ? '重度倾向' : '轻度倾向'
        });
      }
    });

    var isPinghe = convertedScores['pinghe'] >= 60 && resultTypes.length === 0;
    var mainType = isPinghe ? 'pinghe' : (resultTypes.length > 0 ? resultTypes[0].id : 'pinghe');

    constitutionResult = {
      typeId: mainType,
      isPinghe: isPinghe,
      rawScores: rawScores,
      convertedScores: convertedScores,
      questionCounts: questionCounts,
      resultTypes: resultTypes,
      gender: constitutionGender,
      totalQuestions: quiz.length,
      date: new Date().toISOString()
    };
    localStorage.setItem('constitution_result', JSON.stringify(constitutionResult));
    renderConstitutionResult();
  }

  function renderConstitutionResult() {
    var body = document.getElementById('constitutionPanelBody');
    var result = constitutionResult;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });

    // 计算所有体质的倾向等级
    function getTendencyLevel(score, typeId) {
      if (typeId === 'pinghe') {
        if (score >= 60) return '是';
        if (score >= 40) return '倾向';
        return '否';
      } else {
        if (score >= 60) return '重度倾向';
        if (score >= 40) return '中度倾向';
        if (score >= 30) return '轻度倾向';
        return '否';
      }
    }

    // 对所有体质按得分降序排列
    var allTypes = CONSTITUTION_TYPES.map(function(c) {
      var score = result.convertedScores[c.id] || 0;
      var level = getTendencyLevel(score, c.id);
      return {
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        color: c.color,
        desc: c.desc,
        score: score,
        level: level
      };
    }).sort(function(a, b) {
      if (a.id === 'pinghe') return 1;
      if (b.id === 'pinghe') return -1;
      return b.score - a.score;
    });

    var html = '<div class="const-result">' +
      '<div style="text-align:center;padding:1rem 0">' +
        '<div class="const-result-emoji" style="font-size:3rem">' + mainType.emoji + '</div>' +
        '<div class="const-result-name" style="color:' + mainType.color + ';font-size:1.3rem;font-weight:700">' + mainType.name + '</div>' +
        '<div class="const-result-desc" style="margin:0.5rem 0;color:var(--muted);font-size:0.9rem">' + mainType.desc + '</div>' +
      '</div>';

    // 全部九种体质得分详情
    html += '<div style="background:var(--bg2);border-radius:10px;padding:0.8rem;margin:0.5rem 0">' +
      '<div style="font-size:13px;font-weight:700;margin-bottom:0.5rem">📊 九种体质得分详情</div>';
    allTypes.forEach(function(t, i) {
      var isMain = t.id === result.typeId;
      var barWidth = Math.max(5, Math.min(100, t.score));
      var barColor = t.score >= 40 ? t.color : '#ccc';
      html += '<div style="margin-bottom:0.6rem' + (i < allTypes.length - 1 ? ';padding-bottom:0.6rem;border-bottom:1px solid var(--border)' : '') + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem">' +
          '<span style="font-size:0.85rem;font-weight:' + (isMain ? '700' : '400') + '">' + t.emoji + ' ' + t.name + (isMain ? ' ★' : '') + '</span>' +
          '<span style="font-size:0.8rem;color:' + (t.level === '否' ? 'var(--muted)' : t.color) + ';font-weight:600">' + t.score + '分 <span style="font-weight:400">' + t.level + '</span></span>' +
        '</div>' +
        '<div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">' +
          '<div style="height:100%;width:' + barWidth + '%;background:' + barColor + ';border-radius:3px;transition:width 0.3s"></div>' +
        '</div>' +
        '<div style="font-size:0.75rem;color:var(--muted);margin-top:0.2rem">' + t.desc + '</div>' +
      '</div>';
    });
    html += '</div>';

    // 调理建议
    html += '<div class="const-result-advice" style="margin:0.8rem 0">' +
      '<strong>调理建议：</strong><br>' + mainType.advice +
      '</div>';

    // 推荐习惯
    html += '<div style="font-size:13px;font-weight:700;margin-bottom:8px;text-align:left">🎯 推荐习惯（点击添加）</div>' +
      '<div class="const-result-habits">';

    mainType.habits.forEach(function(hid) {
      var habit = HABIT_LIBRARY.find(function(h) { return h.id === hid; });
      if (!habit) return;
      var exists = habitsConfig.some(function(h) { return h.id === hid; });
      html += '<div class="const-result-habit">' +
        '<span class="rh-icon">' + habit.icon + '</span>' +
        '<span class="rh-name">' + habit.name + '</span>' +
        (exists ? '<span style="font-size:12px;color:var(--accent)">✓ 已添加</span>' : '<span class="rh-btn" onclick="addHabitFromConstitution(\'' + hid + '\')">+ 添加</span>') +
        '</div>';
    });

    html += '</div>' +
      '<div style="display:flex;gap:0.8rem;margin-top:1rem">' +
        '<button class="const-btn" style="flex:1" onclick="retakeConstitutionQuiz()">重新测试</button>' +
        '<button class="const-btn" style="flex:1;background:var(--bg2);color:var(--ink)" onclick="closeAllPanels()">关闭</button>' +
      '</div>' +
    '</div>';

    body.innerHTML = html;
  }

  function addHabitFromConstitution(hid) {
    var habit = HABIT_LIBRARY.find(function(h) { return h.id === hid; });
    if (!habit || habitsConfig.some(function(h) { return h.id === hid; })) return;

    var newHabit = {
      id: habit.id,
      name: habit.name,
      icon: habit.icon,
      category: habit.category,
      type: habit.type,
      unit: habit.unit || '',
      timePeriod: habit.timePeriod || 'daytime',
      tip: habit.tip || ''
    };
    if (habit.defaultReminder) {
      newHabit.reminder = Object.assign({}, habit.defaultReminder, { enabled: true });
    }
    if (habit.type === 'water') {
      newHabit.waterConfig = { perCup: 250, dailyGoal: 2000 };
    }
    if (habit.options) newHabit.options = habit.options;

    habitsConfig.push(newHabit);
    saveData();
    renderConstitutionResult();
    render();
  }

  function retakeConstitutionQuiz() {
    constitutionAnswers = [];
    constitutionResult = null;
    localStorage.removeItem('constitution_result');
    renderGenderSelect();
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Constitution = {
    openConstitutionPanel: openConstitutionPanel,
    startConstitutionQuiz: startConstitutionQuiz,
    renderConstitutionQuiz: renderConstitutionQuiz,
    selectConstitutionOption: selectConstitutionOption,
    calculateConstitution: calculateConstitution,
    renderConstitutionResult: renderConstitutionResult,
    addHabitFromConstitution: addHabitFromConstitution,
    retakeConstitutionQuiz: retakeConstitutionQuiz
  };
})();
(function() {
  var(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) {(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient((function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#F(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0,(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle =(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0,(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 3(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 1(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(main(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 37(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle =(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = '(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var at(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 +=(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D919(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant',(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c)(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name +(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallback(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS =(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSaf(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWe(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu:(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if ((function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ·(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if ((function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type:(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu)(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function show(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if ((function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide =(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.is(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 200(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  function dismissInstallPrompt() {
    localStorage(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  function dismissInstallPrompt() {
    localStorage.setItem('install_prompt_dismissed', '(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  function dismissInstallPrompt() {
    localStorage.setItem('install_prompt_dismissed', 'true');
  }

  window.addEventListener('beforeinstallprompt', function(e) {
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  function dismissInstallPrompt() {
    localStorage.setItem('install_prompt_dismissed', 'true');
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window._deferredInstallPrompt = e;
  });

  function(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  function dismissInstallPrompt() {
    localStorage.setItem('install_prompt_dismissed', 'true');
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window._deferredInstallPrompt = e;
  });

  function openConstitutionPanel() {
    constitutionAnswers = [];
    constitutionResult = JSON.parse(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  function dismissInstallPrompt() {
    localStorage.setItem('install_prompt_dismissed', 'true');
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window._deferredInstallPrompt = e;
  });

  function openConstitutionPanel() {
    constitutionAnswers = [];
    constitutionResult = JSON.parse(localStorage.getItem('constitution_result') || 'null');
    if (constitutionResult) {
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  function dismissInstallPrompt() {
    localStorage.setItem('install_prompt_dismissed', 'true');
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window._deferredInstallPrompt = e;
  });

  function openConstitutionPanel() {
    constitutionAnswers = [];
    constitutionResult = JSON.parse(localStorage.getItem('constitution_result') || 'null');
    if (constitutionResult) {
      renderConstitutionResult();
    } else {
      renderVersionSelect();
    }(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  function dismissInstallPrompt() {
    localStorage.setItem('install_prompt_dismissed', 'true');
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window._deferredInstallPrompt = e;
  });

  function openConstitutionPanel() {
    constitutionAnswers = [];
    constitutionResult = JSON.parse(localStorage.getItem('constitution_result') || 'null');
    if (constitutionResult) {
      renderConstitutionResult();
    } else {
      renderVersionSelect();
    }
    openPanel('constitutionPanel');
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  function dismissInstallPrompt() {
    localStorage.setItem('install_prompt_dismissed', 'true');
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window._deferredInstallPrompt = e;
  });

  function openConstitutionPanel() {
    constitutionAnswers = [];
    constitutionResult = JSON.parse(localStorage.getItem('constitution_result') || 'null');
    if (constitutionResult) {
      renderConstitutionResult();
    } else {
      renderVersionSelect();
    }
    openPanel('constitutionPanel');
  }

  function renderVersionSelect() {
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  function dismissInstallPrompt() {
    localStorage.setItem('install_prompt_dismissed', 'true');
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window._deferredInstallPrompt = e;
  });

  function openConstitutionPanel() {
    constitutionAnswers = [];
    constitutionResult = JSON.parse(localStorage.getItem('constitution_result') || 'null');
    if (constitutionResult) {
      renderConstitutionResult();
    } else {
      renderVersionSelect();
    }
    openPanel('constitutionPanel');
  }

  function renderVersionSelect() {
    var body = document.getElementById('constitutionPanelBody');
    body.innerHTML =
      '<div(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  function dismissInstallPrompt() {
    localStorage.setItem('install_prompt_dismissed', 'true');
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window._deferredInstallPrompt = e;
  });

  function openConstitutionPanel() {
    constitutionAnswers = [];
    constitutionResult = JSON.parse(localStorage.getItem('constitution_result') || 'null');
    if (constitutionResult) {
      renderConstitutionResult();
    } else {
      renderVersionSelect();
    }
    openPanel('constitutionPanel');
  }

  function renderVersionSelect() {
    var body = document.getElementById('constitutionPanelBody');
    body.innerHTML =
      '<div style="padding:1.5rem;text-align:center">' +
        '<div style="font(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  function dismissInstallPrompt() {
    localStorage.setItem('install_prompt_dismissed', 'true');
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window._deferredInstallPrompt = e;
  });

  function openConstitutionPanel() {
    constitutionAnswers = [];
    constitutionResult = JSON.parse(localStorage.getItem('constitution_result') || 'null');
    if (constitutionResult) {
      renderConstitutionResult();
    } else {
      renderVersionSelect();
    }
    openPanel('constitutionPanel');
  }

  function renderVersionSelect() {
    var body = document.getElementById('constitutionPanelBody');
    body.innerHTML =
      '<div style="padding:1.5rem;text-align:center">' +
        '<div style="font-size:2rem;margin-bottom:0.8rem">🩺</div>' +
        '<div(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  function dismissInstallPrompt() {
    localStorage.setItem('install_prompt_dismissed', 'true');
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window._deferredInstallPrompt = e;
  });

  function openConstitutionPanel() {
    constitutionAnswers = [];
    constitutionResult = JSON.parse(localStorage.getItem('constitution_result') || 'null');
    if (constitutionResult) {
      renderConstitutionResult();
    } else {
      renderVersionSelect();
    }
    openPanel('constitutionPanel');
  }

  function renderVersionSelect() {
    var body = document.getElementById('constitutionPanelBody');
    body.innerHTML =
      '<div style="padding:1.5rem;text-align:center">' +
        '<div style="font-size:2rem;margin-bottom:0.8rem">🩺</div>' +
        '<div style="font-weight:700;font-size(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  function dismissInstallPrompt() {
    localStorage.setItem('install_prompt_dismissed', 'true');
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window._deferredInstallPrompt = e;
  });

  function openConstitutionPanel() {
    constitutionAnswers = [];
    constitutionResult = JSON.parse(localStorage.getItem('constitution_result') || 'null');
    if (constitutionResult) {
      renderConstitutionResult();
    } else {
      renderVersionSelect();
    }
    openPanel('constitutionPanel');
  }

  function renderVersionSelect() {
    var body = document.getElementById('constitutionPanelBody');
    body.innerHTML =
      '<div style="padding:1.5rem;text-align:center">' +
        '<div style="font-size:2rem;margin-bottom:0.8rem">🩺</div>' +
        '<div style="font-weight:700;font-size:1.1rem;margin-bottom:0.(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  function dismissInstallPrompt() {
    localStorage.setItem('install_prompt_dismissed', 'true');
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window._deferredInstallPrompt = e;
  });

  function openConstitutionPanel() {
    constitutionAnswers = [];
    constitutionResult = JSON.parse(localStorage.getItem('constitution_result') || 'null');
    if (constitutionResult) {
      renderConstitutionResult();
    } else {
      renderVersionSelect();
    }
    openPanel('constitutionPanel');
  }

  function renderVersionSelect() {
    var body = document.getElementById('constitutionPanelBody');
    body.innerHTML =
      '<div style="padding:1.5rem;text-align:center">' +
        '<div style="font-size:2rem;margin-bottom:0.8rem">🩺</div>' +
        '<div style="font-weight:700;font-size:1.1rem;margin-bottom:0.5rem">九种体质辨识</div>' +
        '<div style="color:var(--(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  function dismissInstallPrompt() {
    localStorage.setItem('install_prompt_dismissed', 'true');
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window._deferredInstallPrompt = e;
  });

  function openConstitutionPanel() {
    constitutionAnswers = [];
    constitutionResult = JSON.parse(localStorage.getItem('constitution_result') || 'null');
    if (constitutionResult) {
      renderConstitutionResult();
    } else {
      renderVersionSelect();
    }
    openPanel('constitutionPanel');
  }

  function renderVersionSelect() {
    var body = document.getElementById('constitutionPanelBody');
    body.innerHTML =
      '<div style="padding:1.5rem;text-align:center">' +
        '<div style="font-size:2rem;margin-bottom:0.8rem">🩺</div>' +
        '<div style="font-weight:700;font-size:1.1rem;margin-bottom:0.5rem">九种体质辨识</div>' +
        '<div style="color:var(--muted);font-size:0.85rem;margin-bottom:1.5rem;line(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能安装引导优化 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent;
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPad|iPhone|iPod/i.test(ua);
    var isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
    var isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    var isWeChat = /MicroMessenger/i.test(ua);
    var isQQ = /QQ/i.test(ua);
    var isBaidu = /Baidu/i.test(ua);
    var isUC = /UCBrowser/i.test(ua);
    
    return {
      isAndroid: isAndroid,
      isIOS: isIOS,
      isChrome: isChrome,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isBaidu: isBaidu,
      isUC: isUC,
      supportsInstallPrompt: isAndroid && isChrome && !isWeChat && !isQQ
    };
  }

  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isIOS && info.isSafari) {
      return {
        title: '添加到主屏幕',
        desc: '点击 Safari 底部「分享」按钮 → 选择「添加到主屏幕」',
        button: '我知道了',
        type: 'ios'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'android'
      };
    }
    if (info.isUC) {
      return {
        title: '添加到桌面',
        desc: '点击 UC 菜单 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '添加到桌面',
        desc: '点击底部导航栏 → 选择「添加到桌面」',
        button: '我知道了',
        type: 'baidu'
      };
    }
    return {
      title: '添加到桌面',
      desc: '在浏览器菜单中找到「添加到桌面」选项',
      button: '我知道了',
      type: 'other'
    };
  }

  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;
    
    if (info.isWeChat) {
      showToast('微信内无法直接安装，请点击右上角"···"在浏览器中打开');
      return;
    }
    
    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        } else {
          showToast('已取消安装');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      var guide = getInstallGuideText();
      showToast(guide.desc);
      if (info.isIOS) {
        setTimeout(function() {
          showToast('提示：Safari用户需手动添加');
        }, 2000);
      }
    }
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  function dismissInstallPrompt() {
    localStorage.setItem('install_prompt_dismissed', 'true');
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window._deferredInstallPrompt = e;
  });

  function openConstitutionPanel() {
    constitutionAnswers = [];
    constitutionResult = JSON.parse(localStorage.getItem('constitution_result') || 'null');
    if (constitutionResult) {
      renderConstitutionResult();
    } else {
      renderVersionSelect();
    }
    openPanel('constitutionPanel');
  }

  function renderVersionSelect() {
    var body = document.getElementById('constitutionPanelBody');
    body.innerHTML =
      '<div style="padding:1.5rem;text-align:center">' +
        '<div style="font-size:2rem;margin-bottom:0.8rem">🩺</div>' +
        '<div style="font-weight:700;font-size:1.1rem;margin-bottom:0.5rem">九种体质辨识</div>' +
        '<div style="color:var(--muted);font-size:0.85rem;margin-bottom:1.5rem;line-height:1.6">基于王琦教授《中医体质分类与判定》标准<br>