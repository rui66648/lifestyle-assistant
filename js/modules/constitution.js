(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';

  /* ========== 体质分享海报 ========== */
  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    // 背景
    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 顶部色条
    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    // 标题
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    // 分割线
    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    // 日期
    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    // 体质大emoji和名称
    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    // 体质描述（换行处理）
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

    // 分割线2
    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    // 调理建议标题
    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    // 调理建议内容
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

    // 底部扫码提示
    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    // 显示canvas
    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function downloadConstitutionPoster() {
    var canvas = document.getElementById('posterCanvas');
    var link = document.createElement('a');
    link.download = '体质报告_' + new Date().toISOString().slice(0,10) + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  /* ========== 分享到微信/复制链接 ========== */
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

  /* ========== 智能浏览器检测 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent.toLowerCase();
    var isAndroid = ua.indexOf('android') > -1;
    var isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    var isChrome = ua.indexOf('chrome') > -1 && ua.indexOf('edg') === -1;
    var isEdge = ua.indexOf('edg') > -1;
    var isFirefox = ua.indexOf('firefox') > -1;
    var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    var isWeChat = ua.indexOf('micromessenger') > -1;
    var isQQ = ua.indexOf('qq') > -1 && ua.indexOf('mqqbrowser') > -1;
    var isUC = ua.indexOf('ucbrowser') > -1 || ua.indexOf('ucweb') > -1;
    var isBaidu = ua.indexOf('baidu') > -1 && ua.indexOf('baidubrowser') > -1;
    var isMiBrowser = ua.indexOf('xiaomi') > -1 || ua.indexOf('miui') > -1;
    var isHuaweiBrowser = ua.indexOf('huawei') > -1 || ua.indexOf('honor') > -1;
    var isOppoBrowser = ua.indexOf('oppobrowser') > -1;
    var isVivoBrowser = ua.indexOf('vivobrowser') > -1;

    return {
      isAndroid: isAndroid,
      isIos: isIos,
      isChrome: isChrome,
      isEdge: isEdge,
      isFirefox: isFirefox,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isUC: isUC,
      isBaidu: isBaidu,
      isMiBrowser: isMiBrowser,
      isHuaweiBrowser: isHuaweiBrowser,
      isOppoBrowser: isOppoBrowser,
      isVivoBrowser: isVivoBrowser,
      supportsInstallPrompt: (isAndroid && (isChrome || isEdge)) && !isWeChat && !isQQ && !isUC
    };
  }

  /* ========== 获取安装引导文案 ========== */
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
    if (info.isQQ) {
      return {
        title: 'QQ内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'qq'
      };
    }
    if (info.isSafari && info.isIos) {
      return {
        title: '📲 添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '加桌面',
        type: 'ios_safari'
      };
    }
    if (info.isUC) {
      return {
        title: '📲 添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '加桌面',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '📲 添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '加桌面',
        type: 'baidu'
      };
    }
    if (info.isMiBrowser) {
      return {
        title: '📲 添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '加桌面',
        type: 'mi'
      };
    }
    if (info.isHuaweiBrowser) {
      return {
        title: '📲 添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '加桌面',
        type: 'huawei'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '📲 添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'auto'
      };
    }
    return {
      title: '📲 添加到桌面',
      desc: '每天按体质提醒你喝什么茶',
      button: '加桌面',
      type: 'manual'
    };
  }

  /* ========== 添加到桌面引导 ========== */
  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;

    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      showInstallGuideModal();
    }
  }

  function showInstallGuideModal() {
    var info = getBrowserInfo();
    var old = document.getElementById('installGuideModal');
    if (old) old.remove();

    var browserName, steps;

    if (info.isWeChat) {
      browserName = '微信';
      steps = [
        {icon:'1️⃣', text:'点击右上角「···」'},
        {icon:'2️⃣', text:'选择「在浏览器中打开」'},
        {icon:'3️⃣', text:'在浏览器中添加到桌面'}
      ];
    } else if (info.isSafari && info.isIos) {
      browserName = 'Safari';
      steps = [
        {icon:'1️⃣', text:'点击底部「分享」按钮 ↗'},
        {icon:'2️⃣', text:'上滑找到「添加到主屏幕」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else if (info.isChrome && info.isAndroid) {
      browserName = 'Chrome';
      steps = [
        {icon:'1️⃣', text:'点击右上角「⋮」菜单'},
        {icon:'2️⃣', text:'选择「添加到主屏幕」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else if (info.isEdge && info.isAndroid) {
      browserName = 'Edge';
      steps = [
        {icon:'1️⃣', text:'点击右下角「⋯」菜单'},
        {icon:'2️⃣', text:'选择「应用」→「添加到主屏幕」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else if (info.isFirefox) {
      browserName = 'Firefox';
      steps = [
        {icon:'1️⃣', text:'点击右上角「☰」菜单'},
        {icon:'2️⃣', text:'选择「安装」或「添加到主屏幕」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else if (info.isUC) {
      browserName = 'UC浏览器';
      steps = [
        {icon:'1️⃣', text:'点击底部「菜单」按钮'},
        {icon:'2️⃣', text:'选择「添加到桌面」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else if (info.isBaidu) {
      browserName = '百度浏览器';
      steps = [
        {icon:'1️⃣', text:'点击底部「菜单」按钮'},
        {icon:'2️⃣', text:'选择「添加到桌面」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else if (info.isMiBrowser) {
      browserName = '小米浏览器';
      steps = [
        {icon:'1️⃣', text:'点击底部「菜单」按钮'},
        {icon:'2️⃣', text:'选择「添加到桌面」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else if (info.isHuaweiBrowser) {
      browserName = '华为浏览器';
      steps = [
        {icon:'1️⃣', text:'点击底部「菜单」按钮'},
        {icon:'2️⃣', text:'选择「添加到桌面」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else if (info.isOppoBrowser) {
      browserName = 'OPPO浏览器';
      steps = [
        {icon:'1️⃣', text:'点击底部「菜单」按钮'},
        {icon:'2️⃣', text:'选择「添加到桌面」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else if (info.isVivoBrowser) {
      browserName = 'vivo浏览器';
      steps = [
        {icon:'1️⃣', text:'点击底部「菜单」按钮'},
        {icon:'2️⃣', text:'选择「添加到桌面」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else {
      browserName = '您的浏览器';
      steps = [
        {icon:'1️⃣', text:'点击浏览器菜单按钮'},
        {icon:'2️⃣', text:'选择「添加到桌面/主屏幕」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    }

    var html = '<div id="installGuideModal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this){this.remove()}">' +
      '<div style="background:var(--bg);border-radius:20px;padding:24px;max-width:320px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.2);animation:modalIn .3s ease">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
          '<div style="font-size:16px;font-weight:700">📲 加到桌面</div>' +
          '<span style="font-size:20px;cursor:pointer;color:var(--muted)" onclick="document.getElementById(\'installGuideModal\').remove()">✕</span>' +
        '</div>' +
        '<div style="font-size:13px;color:var(--muted);margin-bottom:16px">' + browserName + ' 用户请按以下步骤操作：</div>' +
        steps.map(function(s){return '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg2);border-radius:12px;margin-bottom:10px">' +
          '<span style="font-size:20px">' + s.icon + '</span>' +
          '<span style="font-size:14px;color:var(--ink)">' + s.text + '</span>' +
        '</div>'}).join('') +
        '<button class="const-btn" style="width:100%;margin-top:8px" onclick="document.getElementById(\'installGuideModal\').remove()">知道了</button>' +
      '</div>' +
    '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  /* ========== 版本选择入口 ========== */
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
        '<div style="color:var(--muted);font-size:0.85rem;margin-bottom:1.5rem;line-height:1.6">基于王琦教授《中医体质分类与判定》标准<br>请选择适合您的测试版本</div>' +
        '<div class="const-version-list">' +
          '<div class="const-version-card" onclick="selectConstitutionVersion(\'quick\')">' +
            '<div class="const-version-emoji">⚡</div>' +
            '<div class="const-version-name">快筛版</div>' +
            '<div class="const-version-meta">10题 · 约1分钟</div>' +
            '<div class="const-version-desc">快速了解主要体质倾向</div>' +
          '</div>' +
          '<div class="const-version-card" onclick="selectConstitutionVersion(\'std\')">' +
            '<div class="const-version-emoji">📋</div>' +
            '<div class="const-version-name">标准版</div>' +
            '<div class="const-version-meta">30题 · 约3分钟</div>' +
            '<div class="const-version-desc">较全面的体质评估</div>' +
          '</div>' +
          '<div class="const-version-card" onclick="selectConstitutionVersion(\'full\')">' +
            '<div class="const-version-emoji">🔬</div>' +
            '<div class="const-version-name">完整版</div>' +
            '<div class="const-version-meta">67题 · 约10分钟</div>' +
            '<div class="const-version-desc">国标完整量表，最精准</div>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:1rem;font-size:0.8rem;color:var(--muted)">💡 首次建议从快筛版开始</div>' +
      '</div>';
  }

  function selectConstitutionVersion(version) {
    if (version === 'quick' && typeof CONSTITUTION_QUICK_QUIZ !== 'undefined') {
      currentQuizSet = CONSTITUTION_QUICK_QUIZ;
      currentQuizName = '快筛版';
    } else if (version === 'std' && typeof CONSTITUTION_STD_QUIZ !== 'undefined') {
      currentQuizSet = CONSTITUTION_STD_QUIZ;
      currentQuizName = '标准版';
    } else {
      currentQuizSet = CONSTITUTION_QUIZ;
      currentQuizName = '完整版';
    }
    renderGenderSelect();
  }

  function renderGenderSelect() {
    var body = document.getElementById('constitutionPanelBody');
    var count = currentQuizSet ? currentQuizSet.length : 67;
    body.innerHTML = '<div style="padding:1.5rem;text-align:center">' +
      '<div style="font-size:2rem;margin-bottom:0.8rem">🩺</div>' +
      '<div style="font-weight:700;font-size:1.1rem;margin-bottom:0.5rem">九种体质辨识 · ' + currentQuizName + '</div>' +
      '<div style="color:var(--muted);font-size:0.85rem;margin-bottom:1.5rem;line-height:1.6">共' + count + '道题目，请根据近一年的体验和感觉回答</div>' +
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
    var quiz = currentQuizSet || CONSTITUTION_QUIZ;
    return quiz.filter(function(q) {
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

    // 快筛版和平质判定阈值适当降低
    var pingheThreshold = currentQuizSet === CONSTITUTION_QUICK_QUIZ ? 50 : 60;
    var biasThreshold = currentQuizSet === CONSTITUTION_QUICK_QUIZ ? 35 : 40;

    var resultTypes = [];
    CONSTITUTION_TYPES.forEach(function(c) {
      if (c.id === 'pinghe') return;
      if (convertedScores[c.id] >= biasThreshold) {
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

    var isPinghe = convertedScores['pinghe'] >= pingheThreshold && resultTypes.length === 0;
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
      quizVersion: currentQuizName,
      date: new Date().toISOString()
    };
    localStorage.setItem('constitution_result', JSON.stringify(constitutionResult));
    renderConstitutionResult();
  }

  function renderConstitutionResult() {
    var body = document.getElementById('constitutionPanelBody');
    var result = constitutionResult;
    var mainType = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });

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

    // 体质钩子文案
    var hookText = {
      pinghe: '阴阳调和，气血充盈，继续保持！',
      qixu: '不是懒，是气虚容易累',
      yangxu: '手脚冰凉不是你脆弱，是阳虚在作祟',
      yinxu: '口干失眠不是小事，阴虚需要滋阴',
      tanshi: '不是你胖，是痰湿体质容易囤',
      shire: '油光满面不是不讲卫生，是湿热体质',
      xueyu: '黑眼圈不一定是熬夜，血瘀需要活血',
      qiyu: '闷闷不乐不是你的错，气郁需要疏解',
      tebing: '过敏不是矫情，特禀体质需要呵护'
    };

    var html = '<div class="const-result">' +
      '<div style="text-align:center;padding:1rem 0">' +
        '<div class="const-result-emoji" style="font-size:3rem">' + mainType.emoji + '</div>' +
        '<div class="const-result-name" style="color:' + mainType.color + ';font-size:1.3rem;font-weight:700">' + mainType.name + '</div>' +
        '<div class="const-result-desc" style="margin:0.3rem 0;color:var(--muted);font-size:0.85rem">' + mainType.desc + '</div>' +
        '<div style="font-size:0.9rem;color:' + mainType.color + ';font-weight:600;margin-top:0.3rem">💬 ' + (hookText[mainType.id] || '') + '</div>' +
      '</div>';

    // 添加到桌面引导（结果页最有认同感时）
    if (shouldShowInstallPrompt()) {
      var guide = getInstallGuideText();
      var cardBg = guide.type === 'wechat' || guide.type === 'qq' 
        ? 'background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3)' 
        : 'background:linear-gradient(135deg,var(--accent-light),var(--accent2-light))';
      html += '<div class="install-prompt-card" style="margin:0.5rem 0;padding:12px 16px;' + cardBg + ';border-radius:12px;display:flex;align-items:center;gap:10px">' +
        '<span style="font-size:1.5rem">' + (guide.title.startsWith('📲') ? '📲' : '⚠️') + '</span>' +
        '<div style="flex:1">' +
          '<div style="font-weight:700;font-size:0.9rem">' + guide.title.replace('📲 ','') + '</div>' +
          '<div style="font-size:0.8rem;color:var(--ink2)">' + guide.desc + '</div>' +
        '</div>' +
        '<button class="const-btn" style="padding:6px 14px;font-size:0.8rem;white-space:nowrap" onclick="showInstallPrompt()">' + guide.button + '</button>' +
      '</div>';
    }

    // 九种体质得分详情
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
      // 分享和海报按钮
      '<div style="display:flex;gap:0.6rem;margin:1rem 0">' +
        '<button class="const-btn" style="flex:1;background:var(--accent);color:#fff" onclick="openConstitutionPosterPanel()">🎨 生成体质卡</button>' +
        '<button class="const-btn" style="flex:1;background:var(--bg2);color:var(--ink)" onclick="shareConstitutionResult()">🔗 分享结果</button>' +
      '</div>' +
      '<div style="display:flex;gap:0.8rem;margin-top:0.5rem">' +
        '<button class="const-btn" style="flex:1" onclick="retakeConstitutionQuiz()">重新测试</button>' +
        '<button class="const-btn" style="flex:1;background:var(--bg2);color:var(--ink)" onclick="closeAllPanels()">关闭</button>' +
      '</div>' +
      // 合规声明
      '<div style="margin-top:1rem;padding-top:0.8rem;border-top:1px solid var(--border);font-size:0.7rem;color:var(--muted);text-align:center;line-height:1.5">' +
        '本测试仅供参考，如有不适请就医<br>' +
        '参考《中医体质分类与判定》（中华中医药学会2009版）' +
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
    renderVersionSelect();
  }

  /* ========== 监听 PWA install 事件 ========== */
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window._deferredInstallPrompt = e;
  });

  /* ========== URL参数解析：带参落地 ========== */
  function checkUrlParams() {
    var params = new URLSearchParams(window.location.search);
    var type = params.get('type');
    if (type && CONSTITUTION_TYPES.some(function(c) { return c.id === type; })) {
      // 有体质参数，预设结果并打开面板
      var ct = CONSTITUTION_TYPES.find(function(c) { return c.id === type; });
      constitutionResult = {
        typeId: type,
        isPinghe: type === 'pinghe',
        convertedScores: {},
        resultTypes: type === 'pinghe' ? [] : [{id:type,name:ct.name,emoji:ct.emoji,color:ct.color,score:50,level:'中度倾向'}],
        quizVersion: '分享导入',
        date: new Date().toISOString()
      };
      // 不保存到localStorage，让用户自己测
      renderConstitutionResult();
      openPanel('constitutionPanel');
      // 清理URL参数
      window.history.replaceState({}, document.title, window.location.pathname);
      return true;
    }
    return false;
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Constitution = {
    openConstitutionPanel: openConstitutionPanel,
    selectConstitutionVersion: selectConstitutionVersion,
    startConstitutionQuiz: startConstitutionQuiz,
    renderConstitutionQuiz: renderConstitutionQuiz,
    selectConstitutionOption: selectConstitutionOption,
    calculateConstitution: calculateConstitution,
    renderConstitutionResult: renderConstitutionResult,
    addHabitFromConstitution: addHabitFromConstitution,
    retakeConstitutionQuiz: retakeConstitutionQuiz,
    generateConstitutionPoster: generateConstitutionPoster,
    openConstitutionPosterPanel: openConstitutionPosterPanel,
    downloadConstitutionPoster: downloadConstitutionPoster,
    shareConstitutionResult: shareConstitutionResult,
    showInstallPrompt: showInstallPrompt,
    checkUrlParams: checkUrlParams
  };
})();
