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
