(function() {
  let constitutionAnswers = [];
  let constitutionResult = null;

  function openConstitutionPanel() {
    constitutionAnswers = [];
    constitutionResult = JSON.parse(localStorage.getItem('constitution_result') || 'null');
    if (constitutionResult) {
      renderConstitutionResult();
    } else {
      renderConstitutionQuiz(0);
    }
    openPanel('constitutionPanel');
  }

  function renderConstitutionQuiz(qIdx) {
    const body = document.getElementById('constitutionPanelBody');
    const q = CONSTITUTION_QUIZ[qIdx];
    const progress = Math.round((qIdx / CONSTITUTION_QUIZ.length) * 100);

    let html = `
      <div class="const-progress">
        <div class="const-progress-bar"><div class="const-progress-fill" style="width:${progress}%"></div></div>
        <span class="const-progress-text">${qIdx + 1}/${CONSTITUTION_QUIZ.length}</span>
      </div>
      <div class="const-question">
        <div class="const-question-text">${q.question}</div>
        <div class="const-options">
    `;

    q.options.forEach((opt, i) => {
      html += `<div class="const-option" onclick="selectConstitutionOption(${qIdx}, ${i})">${opt.text}</div>`;
    });

    html += '</div></div>';
    body.innerHTML = html;
  }

  function selectConstitutionOption(qIdx, optIdx) {
    constitutionAnswers.push({ qIdx, optIdx });

    if (qIdx + 1 < CONSTITUTION_QUIZ.length) {
      renderConstitutionQuiz(qIdx + 1);
    } else {
      calculateConstitution();
    }
  }

  function calculateConstitution() {
    const scores = {};
    CONSTITUTION_TYPES.forEach(c => scores[c.id] = 0);

    constitutionAnswers.forEach(ans => {
      const opt = CONSTITUTION_QUIZ[ans.qIdx].options[ans.optIdx];
      Object.entries(opt.scores).forEach(([id, score]) => {
        scores[id] = (scores[id] || 0) + score;
      });
    });

    let maxId = 'pinghe', maxScore = 0;
    Object.entries(scores).forEach(([id, score]) => {
      if (score > maxScore) {
        maxScore = score;
        maxId = id;
      }
    });

    constitutionResult = { typeId: maxId, scores, date: new Date().toISOString() };
    localStorage.setItem('constitution_result', JSON.stringify(constitutionResult));
    renderConstitutionResult();
  }

  function renderConstitutionResult() {
    const body = document.getElementById('constitutionPanelBody');
    const result = constitutionResult;
    const type = CONSTITUTION_TYPES.find(c => c.id === result.typeId);

    let html = `
      <div class="const-result">
        <div class="const-result-emoji">${type.emoji}</div>
        <div class="const-result-name" style="color:${type.color}">${type.name}</div>
        <div class="const-result-desc">${type.desc}</div>
        <div class="const-result-advice">
          <strong>调理建议：</strong><br>${type.advice}
        </div>
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;text-align:left">🎯 推荐习惯（点击添加）</div>
        <div class="const-result-habits">
    `;

    type.habits.forEach(hid => {
      const habit = HABIT_LIBRARY.find(h => h.id === hid);
      if (!habit) return;
      const exists = habitsConfig.some(h => h.id === hid);
      html += `
        <div class="const-result-habit">
          <span class="rh-icon">${habit.icon}</span>
          <span class="rh-name">${habit.name}</span>
          ${exists ? '<span style="font-size:12px;color:var(--accent)">✓ 已添加</span>' : `<span class="rh-btn" onclick="addHabitFromConstitution('${hid}')">+ 添加</span>`}
        </div>
      `;
    });

    html += `
        </div>
        <button class="const-btn" onclick="retakeConstitutionQuiz()">重新测试</button>
      </div>
    `;

    body.innerHTML = html;
  }

  function addHabitFromConstitution(hid) {
    const habit = HABIT_LIBRARY.find(h => h.id === hid);
    if (!habit || habitsConfig.some(h => h.id === hid)) return;

    const cat = CATEGORY_MAP[habit.category] || { timePeriod: 'afternoon' };
    const newHabit = {
      id: habit.id,
      name: habit.name,
      icon: habit.icon,
      category: habit.category,
      type: habit.type,
      unit: habit.unit || '',
      timePeriod: cat.timePeriod,
      tip: habit.tip || '',
      ...(habit.defaultReminder ? { reminder: { ...habit.defaultReminder, enabled: true } } : {})
    };

    if (habit.type === 'water') {
      newHabit.waterConfig = { cupSize: 250, dailyGoal: 2000 };
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
    renderConstitutionQuiz(0);
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Constitution = {
    openConstitutionPanel,
    renderConstitutionQuiz,
    selectConstitutionOption,
    calculateConstitution,
    renderConstitutionResult,
    addHabitFromConstitution,
    retakeConstitutionQuiz
  };
})();
