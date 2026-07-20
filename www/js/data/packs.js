const HEALTH_PACK = {
  name: '健康生活建议包',
  description: '基于《黄帝内经》与现代医学的一日健康作息方案',
  habits: [
    // 早晨：早起+喝水+运动+早餐
    {id:'early_rise',reminder:{time:'06:30',enabled:true}},
    {id:'daily_water',reminder:{time:'06:40',enabled:true}},
    {id:'morning_run',reminder:{time:'07:00',enabled:true}},
    {id:'breakfast',reminder:{time:'07:45',enabled:true}},
    // 上午：护眼+坐姿+起身+深呼吸
    {id:'eye_rest',reminder:{time:'10:00',enabled:true}},
    {id:'good_posture',reminder:{time:'09:00',enabled:true}},
    {id:'sit_protect',reminder:{time:'10:30',enabled:true}},
    {id:'deep_breath',reminder:{time:'11:00',enabled:true}},
    // 下午：均衡饮食+散步+蔬果+午休
    {id:'healthy_diet',reminder:{time:'12:00',enabled:true}},
    {id:'evening_walk',reminder:{time:'12:30',enabled:true}},
    {id:'nap',reminder:{time:'13:00',enabled:true}},
    {id:'fruits_veggies',reminder:{time:'14:00',enabled:true}},
    {id:'tea_time',reminder:{time:'15:30',enabled:true}},
    // 晚上：护肤+泡脚+冥想+日记+早睡
    {id:'skincare',reminder:{time:'21:00',enabled:true}},
    {id:'foot_bath',reminder:{time:'21:30',enabled:true}},
    {id:'meditation',reminder:{time:'22:00',enabled:true}},
    {id:'diary',reminder:{time:'22:15',enabled:true}},
    {id:'early_sleep',reminder:{time:'22:30',enabled:true}}
  ]
};

const SEASONAL_PACKS = {
  spring: {
    name: '春天养生包',
    season: '春',
    emoji: '🌿',
    months: [2, 3, 4],
    focus: '养肝舒展，早睡早起',
    color: 'spring',
    quote: '',
    tip: '春季养生重在<em>养肝</em>。夜卧早起（不超23点），广步于庭（户外散步舒展），使志生（精神舒展不压抑），省酸增甘（多吃甘味养肝脾）。逆之伤肝。',
    habits: [
      // 起居：夜卧早起
      {id:'early_rise',reminder:{time:'06:30',enabled:true}},
      {id:'early_sleep',reminder:{time:'22:30',enabled:true}},
      // 运动：广步于庭（散步舒展）
      {id:'evening_walk',reminder:{time:'07:30',enabled:true}},
      {id:'stretch',reminder:{time:'20:00',enabled:true}},
      // 饮食：省酸增甘，养肝护脾
      {id:'breakfast',reminder:{time:'07:30',enabled:true}},
      {id:'healthy_diet',reminder:{time:'12:00',enabled:true}},
      {id:'fruits_veggies',reminder:{time:'12:00',enabled:true}},
      {id:'green_food',reminder:{time:'12:00',enabled:true}},
      // 情志：使志生（精神舒展，不压抑不发怒）
      {id:'meditation',reminder:{time:'22:00',enabled:true}},
      {id:'emotion_check',reminder:{time:'21:00',enabled:true}},
      // 防护
      {id:'daily_water',reminder:{time:'06:40',enabled:true}},
      {id:'eye_rest',reminder:{time:'10:30',enabled:true}}
    ]
  },
  summer: {
    name: '夏天养生包',
    season: '夏',
    emoji: '☀️',
    months: [5, 6, 7],
    focus: '养心安神，多晒太阳',
    color: 'summer',
    quote: '',
    tip: '夏季养生重在<em>养心</em>。夜卧早起，无厌于日（适当晒太阳不出汗），使志无怒（保持心情愉快不郁怒），饮食清淡多食苦（清心火）。逆之伤心。',
    habits: [
      // 起居：夜卧早起
      {id:'early_rise',reminder:{time:'06:00',enabled:true}},
      {id:'early_sleep',reminder:{time:'22:30',enabled:true}},
      {id:'nap',reminder:{time:'13:00',enabled:true}},
      // 运动：无厌于日（适当晒太阳，使气得泄）
      {id:'morning_run',reminder:{time:'07:00',enabled:true}},
      {id:'evening_walk',reminder:{time:'16:00',enabled:true}},
      // 饮食：清淡为主，适当食苦味清心火
      {id:'healthy_diet',reminder:{time:'12:00',enabled:true}},
      {id:'red_food',reminder:{time:'12:00',enabled:true}},
      {id:'no_sugar_drink',reminder:{time:'14:00',enabled:true}},
      {id:'tea_time',reminder:{time:'15:00',enabled:true}},
      // 情志：使志无怒（保持心情愉快）
      {id:'meditation',reminder:{time:'22:00',enabled:true}},
      {id:'gratitude',reminder:{time:'21:00',enabled:true}},
      // 饮水：夏季多汗，多饮水
      {id:'daily_water',reminder:{time:'06:10',enabled:true}}
    ]
  },
  autumn: {
    name: '秋天养生包',
    season: '秋',
    emoji: '🍂',
    months: [8, 9, 10],
    focus: '养肺润燥，早睡早起',
    color: 'autumn',
    quote: '',
    tip: '秋季养生重在<em>养肺</em>。早卧早起（与鸡俱兴），使志安宁（保持内心宁静），食酸敛肺防秋燥（多吃白色食物）。逆之伤肺。',
    habits: [
      // 起居：早卧早起，与鸡俱兴
      {id:'early_rise',reminder:{time:'06:30',enabled:true}},
      {id:'early_sleep',reminder:{time:'22:00',enabled:true}},
      // 饮食：食酸敛肺，防秋燥，多吃白色食物
      {id:'healthy_diet',reminder:{time:'12:00',enabled:true}},
      {id:'white_food',reminder:{time:'12:00',enabled:true}},
      {id:'fruits_veggies',reminder:{time:'14:00',enabled:true}},
      {id:'nuts_intake',reminder:{time:'15:00',enabled:true}},
      // 护肤：秋季干燥，注意保湿
      {id:'skincare',reminder:{time:'21:00',enabled:true}},
      {id:'foot_bath',reminder:{time:'21:30',enabled:true}},
      // 情志：使志安宁（保持内心宁静）
      {id:'meditation',reminder:{time:'22:00',enabled:true}},
      {id:'diary',reminder:{time:'22:15',enabled:true}},
      // 运动：适度收敛，减少剧烈运动
      {id:'evening_walk',reminder:{time:'16:00',enabled:true}},
      {id:'deep_breath',reminder:{time:'10:00',enabled:true}}
    ]
  },
  winter: {
    name: '冬天养生包',
    season: '冬',
    emoji: '❄️',
    months: [11, 12, 1],
    focus: '养肾保暖，早睡晚起',
    color: 'winter',
    quote: '',
    tip: '冬季养生重在<em>养肾</em>。早卧晚起（必待日光，等太阳升起再起床），使志若伏若匿（情志内藏不外露），食咸补肾（温补食物），去寒就温（注意保暖），无泄皮肤（减少户外出汗）。逆之伤肾。',
    habits: [
      // 起居：早卧晚起，必待日光
      {id:'early_sleep',reminder:{time:'21:30',enabled:true}},
      {id:'evening_walk',reminder:{time:'10:00',enabled:true}},
      // 饮食：食咸补肾，温热食物，去寒就温
      {id:'healthy_diet',reminder:{time:'12:00',enabled:true}},
      {id:'black_food',reminder:{time:'12:00',enabled:true}},
      {id:'foot_bath',reminder:{time:'21:00',enabled:true}},
      {id:'vitamin',reminder:{time:'20:00',enabled:true}},
      // 运动：减少户外出汗，无泄皮肤
      {id:'stretch',reminder:{time:'20:00',enabled:true}},
      {id:'yoga',reminder:{time:'19:00',enabled:true}},
      // 情志：使志若伏若匿（情志内藏，不外露）
      {id:'meditation',reminder:{time:'21:30',enabled:true}},
      {id:'reading',reminder:{time:'20:00',enabled:true}},
      // 保暖：去寒就温
      {id:'daily_water',reminder:{time:'07:00',enabled:true}}
    ]
  }
};

const NEIJING_PACK = {
  name: '黄帝内经养生包',
  emoji: '🏛️',
  description: '基于《素问》《灵枢》原文：上古天真论、四气调神大论、阴阳应象大论、宣明五气篇、藏气法时论、五脏生成篇、生气通天论、灵枢·师传、灵枢·天年',
  source: '参考《黄帝内经说什么》《九种体质养生全书》《老老恒言》等现代解读',
  subPacks: [
    {
      id: 'seasonal',
      name: '四季养生',
      emoji: '🌿',
      desc: '春生夏长秋收冬藏',
      children: ['spring','summer','autumn','winter'],
      type: 'seasonal'
    },
    {
      id: 'wuse',
      name: '五色饮食',
      emoji: '🍽️',
      desc: '《五脏生成篇》五色养五脏：白当肺、赤当心、青当肝、黄当脾、黑当肾',
      type: 'wuse',
      content: [
        // 青色入肝（酸）→ 养肝舒筋，春季宜食
        {color:'青', emoji:'🥬', organ:'肝', flavor:'酸', effect:'养肝舒筋，收敛固涩',
         foods:'菠菜、芹菜、西兰花、乌梅、绿茶、醋',
         tip:'《五脏生成篇》：青当肝、酸。春季宜食甘缓肝（粳米、牛肉、枣、葵），过酸伤筋。',
         habits:['green_food','fruits_veggies','healthy_diet']},
        // 赤色入心（苦）→ 养心清火，夏季宜食
        {color:'赤', emoji:'🍅', organ:'心', flavor:'苦', effect:'养心清火，坚阴降逆',
         foods:'红枣、番茄、红豆、山楂、红米、胡萝卜',
         tip:'《藏气法时论》：心色赤，宜食酸（小豆、犬肉、李、韭）。夏季宜食酸以收心气。',
         habits:['red_food','healthy_diet','tea_time']},
        // 黄色入脾（甘）→ 养脾补气，长夏宜食
        {color:'黄', emoji:'🌽', organ:'脾', flavor:'甘', effect:'养脾补气，缓急和中',
         foods:'小米、南瓜、黄豆、玉米、山药、红枣、蜂蜜、甘草',
         tip:'《五脏生成篇》：黄当脾、甘。肝苦急，急食甘以缓之。长夏多食黄，健脾益气。',
         habits:['yellow_food','breakfast','healthy_diet']},
        // 白色入肺（辛）→ 养肺散寒，秋季宜食
        {color:'白', emoji:'🥦', organ:'肺', flavor:'辛', effect:'宣肺散寒，行气活血',
         foods:'白萝卜、百合、银耳、莲藕、梨、山药、杏仁',
         tip:'《藏气法时论》：肺色白，宜食苦（麦、羊肉、杏、薤）。秋季食酸敛肺，多食白色润燥。',
         habits:['white_food','fruits_veggies','healthy_diet']},
        // 黑色入肾（咸）→ 养肾软坚，冬季宜食
        {color:'黑', emoji:'🫘', organ:'肾', flavor:'咸', effect:'补肾软坚，润下散结',
         foods:'黑豆、黑芝麻、桑葚、海带、紫菜、黑木耳、黑米',
         tip:'《五脏生成篇》：黑当肾、咸。肾苦燥，急食辛以润之。冬季宜温补，食咸补肾。',
         habits:['black_food','foot_bath','healthy_diet']}
      ]
    },
    {
      id: 'emotion',
      name: '情志养生',
      emoji: '🧘',
      desc: '《阴阳应象大论》五志相胜，以情胜情',
      type: 'emotion'
    },
    {
      id: 'wulao',
      name: '五劳防护',
      emoji: '💪',
      desc: '《宣明五气篇》久视伤血，久卧伤气，久坐伤肉，久立伤骨，久行伤筋',
      type: 'wulao'
    }
  ]
};

const CONSTITUTION_PACKS = {
  yangxu: {
    name: '阳虚体质调理包',
    emoji: '☀️',
    description: '畏寒怕冷、手脚冰凉，需要温补阳气',
    focus: '温补脾肾，散寒保暖',
    habits: [
      {id:'early_sleep',reminder:{time:'21:00',enabled:true}},
      {id:'foot_bath',reminder:{time:'21:30',enabled:true}},
      {id:'black_food',reminder:{time:'07:00',enabled:true}},
      {id:'morning_run',reminder:{time:'07:30',enabled:true}},
      {id:'winter_warm',reminder:{time:'08:00',enabled:true}},
      {id:'daily_water',reminder:{time:'07:00',enabled:true}},
      {id:'healthy_diet',reminder:{time:'12:00',enabled:true}}
    ]
  },
  yinxu: {
    name: '阴虚体质调理包',
    emoji: '🌙',
    description: '口干咽燥、潮热盗汗，需要滋阴润燥',
    focus: '滋阴降火，润燥生津',
    habits: [
      {id:'white_food',reminder:{time:'12:00',enabled:true}},
      {id:'fruits_veggies',reminder:{time:'14:00',enabled:true}},
      {id:'tea_time',reminder:{time:'15:00',enabled:true}},
      {id:'meditation',reminder:{time:'22:00',enabled:true}},
      {id:'skincare',reminder:{time:'21:00',enabled:true}},
      {id:'no_spicy',reminder:{time:'12:00',enabled:true}},
      {id:'early_sleep',reminder:{time:'22:00',enabled:true}}
    ]
  },
  phlegm: {
    name: '痰湿体质调理包',
    emoji: '☁️',
    description: '体型肥胖、胸闷痰多，需要健脾祛湿',
    focus: '健脾祛湿，化痰通络',
    habits: [
      {id:'morning_run',reminder:{time:'07:00',enabled:true}},
      {id:'healthy_diet',reminder:{time:'12:00',enabled:true}},
      {id:'no_sugar_drink',reminder:{time:'14:00',enabled:true}},
      {id:'fruits_veggies',reminder:{time:'12:00',enabled:true}},
      {id:'deep_breath',reminder:{time:'10:00',enabled:true}},
      {id:'evening_walk',reminder:{time:'18:00',enabled:true}},
      {id:'green_food',reminder:{time:'12:00',enabled:true}}
    ]
  },
  blood_stasis: {
    name: '血瘀体质调理包',
    emoji: '🩸',
    description: '面色暗沉、肢体麻木，需要活血化瘀',
    focus: '活血化瘀，行气通络',
    habits: [
      {id:'morning_run',reminder:{time:'07:00',enabled:true}},
      {id:'evening_walk',reminder:{time:'18:00',enabled:true}},
      {id:'deep_breath',reminder:{time:'10:00',enabled:true}},
      {id:'meditation',reminder:{time:'22:00',enabled:true}},
      {id:'healthy_diet',reminder:{time:'12:00',enabled:true}},
      {id:'fruits_veggies',reminder:{time:'14:00',enabled:true}},
      {id:'red_food',reminder:{time:'12:00',enabled:true}}
    ]
  },
  qi_stagnation: {
    name: '气郁体质调理包',
    emoji: '🌪️',
    description: '情绪抑郁、胸闷叹气，需要疏肝理气',
    focus: '疏肝解郁，畅达情志',
    habits: [
      {id:'meditation',reminder:{time:'22:00',enabled:true}},
      {id:'evening_walk',reminder:{time:'18:00',enabled:true}},
      {id:'gratitude',reminder:{time:'21:00',enabled:true}},
      {id:'emotion_check',reminder:{time:'21:00',enabled:true}},
      {id:'diary',reminder:{time:'22:15',enabled:true}},
      {id:'tea_time',reminder:{time:'15:00',enabled:true}},
      {id:'stretch',reminder:{time:'20:00',enabled:true}}
    ]
  },
  special: {
    name: '特殊调理包',
    emoji: '✨',
    description: '气虚、血虚、湿热、平和体质综合调理',
    focus: '综合调理，因人而异',
    habits: [
      {id:'yellow_food',reminder:{time:'07:00',enabled:true}},
      {id:'morning_run',reminder:{time:'07:30',enabled:true}},
      {id:'healthy_diet',reminder:{time:'12:00',enabled:true}},
      {id:'daily_water',reminder:{time:'07:00',enabled:true}},
      {id:'meditation',reminder:{time:'22:00',enabled:true}},
      {id:'nap',reminder:{time:'13:00',enabled:true}},
      {id:'fruits_veggies',reminder:{time:'14:00',enabled:true}}
    ]
  }
};

const WORK_PACK = {
  name: '职场健康包',
  emoji: '💼',
  description: '办公室人群专属：预防颈椎病、眼疲劳、久坐病',
  focus: '预防职业病，保持工作活力',
  habits: [
    {id:'good_posture',reminder:{time:'09:00',enabled:true}},
    {id:'eye_rest',reminder:{time:'10:00',enabled:true}},
    {id:'sit_protect',reminder:{time:'10:30',enabled:true}},
    {id:'deep_breath',reminder:{time:'11:00',enabled:true}},
    {id:'healthy_diet',reminder:{time:'12:00',enabled:true}},
    {id:'evening_walk',reminder:{time:'12:30',enabled:true}},
    {id:'nap',reminder:{time:'13:00',enabled:true}},
    {id:'tea_time',reminder:{time:'15:30',enabled:true}},
    {id:'stretch',reminder:{time:'16:00',enabled:true}},
    {id:'skincare',reminder:{time:'21:00',enabled:true}},
    {id:'meditation',reminder:{time:'22:00',enabled:true}},
    {id:'early_sleep',reminder:{time:'22:30',enabled:true}}
  ]
};

const STUDENT_PACK = {
  name: '学生备考包',
  emoji: '📚',
  description: '学生党专属：高效学习、劳逸结合、保护视力',
  focus: '科学备考，身心健康',
  habits: [
    {id:'early_rise',reminder:{time:'06:30',enabled:true}},
    {id:'daily_water',reminder:{time:'06:40',enabled:true}},
    {id:'breakfast',reminder:{time:'07:00',enabled:true}},
    {id:'eye_rest',reminder:{time:'10:00',enabled:true}},
    {id:'deep_breath',reminder:{time:'11:00',enabled:true}},
    {id:'healthy_diet',reminder:{time:'12:00',enabled:true}},
    {id:'fruits_veggies',reminder:{time:'12:00',enabled:true}},
    {id:'nap',reminder:{time:'13:00',enabled:true}},
    {id:'reading',reminder:{time:'15:00',enabled:true}},
    {id:'stretch',reminder:{time:'16:00',enabled:true}},
    {id:'evening_walk',reminder:{time:'17:00',enabled:true}},
    {id:'meditation',reminder:{time:'21:00',enabled:true}},
    {id:'diary',reminder:{time:'21:30',enabled:true}},
    {id:'early_sleep',reminder:{time:'22:00',enabled:true}}
  ]
};

const FITNESS_PACK = {
  name: '健身达人包',
  emoji: '💪',
  description: '健身爱好者专属：科学训练、营养补充、恢复休息',
  focus: '科学健身，健康增肌',
  habits: [
    {id:'early_rise',reminder:{time:'06:00',enabled:true}},
    {id:'morning_run',reminder:{time:'06:30',enabled:true}},
    {id:'breakfast',reminder:{time:'07:30',enabled:true}},
    {id:'protein_intake',reminder:{time:'08:00',enabled:true}},
    {id:'healthy_diet',reminder:{time:'12:00',enabled:true}},
    {id:'fruits_veggies',reminder:{time:'12:00',enabled:true}},
    {id:'nuts_intake',reminder:{time:'15:00',enabled:true}},
    {id:'yoga',reminder:{time:'18:00',enabled:true}},
    {id:'skincare',reminder:{time:'21:00',enabled:true}},
    {id:'foot_bath',reminder:{time:'21:30',enabled:true}},
    {id:'early_sleep',reminder:{time:'22:00',enabled:true}}
  ]
};

const PACK_MARKET = [
  { id: 'health', name: '健康生活建议包', emoji: '🌿', desc: '一日健康作息方案', type: 'daily', pack: HEALTH_PACK },
  { id: 'work', name: '职场健康包', emoji: '💼', desc: '办公室人群专属', type: 'specialty', pack: WORK_PACK },
  { id: 'student', name: '学生备考包', emoji: '📚', desc: '高效学习劳逸结合', type: 'specialty', pack: STUDENT_PACK },
  { id: 'fitness', name: '健身达人包', emoji: '💪', desc: '科学训练营养补充', type: 'specialty', pack: FITNESS_PACK },
  { id: 'spring', name: '春天养生包', emoji: '🌸', desc: '养肝舒展早睡早起', type: 'seasonal', pack: SEASONAL_PACKS.spring },
  { id: 'summer', name: '夏天养生包', emoji: '☀️', desc: '养心安神多晒太阳', type: 'seasonal', pack: SEASONAL_PACKS.summer },
  { id: 'autumn', name: '秋天养生包', emoji: '🍂', desc: '养肺润燥早睡早起', type: 'seasonal', pack: SEASONAL_PACKS.autumn },
  { id: 'winter', name: '冬天养生包', emoji: '❄️', desc: '养肾保暖早睡晚起', type: 'seasonal', pack: SEASONAL_PACKS.winter },
  { id: 'yangxu', name: '阳虚体质调理包', emoji: '☀️', desc: '畏寒怕冷手脚冰凉', type: 'constitution', pack: CONSTITUTION_PACKS.yangxu },
  { id: 'yinxu', name: '阴虚体质调理包', emoji: '🌙', desc: '口干咽燥潮热盗汗', type: 'constitution', pack: CONSTITUTION_PACKS.yinxu },
  { id: 'phlegm', name: '痰湿体质调理包', emoji: '☁️', desc: '体型肥胖胸闷痰多', type: 'constitution', pack: CONSTITUTION_PACKS.phlegm },
  { id: 'blood_stasis', name: '血瘀体质调理包', emoji: '🩸', desc: '面色暗沉肢体麻木', type: 'constitution', pack: CONSTITUTION_PACKS.blood_stasis },
  { id: 'qi_stagnation', name: '气郁体质调理包', emoji: '🌪️', desc: '情绪抑郁胸闷叹气', type: 'constitution', pack: CONSTITUTION_PACKS.qi_stagnation },
];

function exportCurrentHabitPack() {
  if (typeof habitsConfig === 'undefined') return null;
  const pack = {
    name: '我的习惯包',
    description: '从生活习惯小助手导出',
    exportTime: new Date().toISOString(),
    habits: habitsConfig.filter(h => h.enabled).map(h => ({
      id: h.id,
      name: h.name,
      icon: h.icon,
      category: h.category,
      reminder: h.reminder ? {
        time: h.reminder.time,
        enabled: h.reminder.enabled,
        method: h.reminder.method
      } : null
    }))
  };
  return JSON.stringify(pack, null, 2);
}

function importHabitPack(packData, mode = 'merge') {
  try {
    const pack = typeof packData === 'string' ? JSON.parse(packData) : packData;
    if (!pack.habits || !Array.isArray(pack.habits)) return { success: false, message: '无效的习惯包数据' };

    let added = 0;
    let updated = 0;
    let skipped = 0;

    pack.habits.forEach(pHabit => {
      const existing = habitsConfig.find(h => h.id === pHabit.id);
      if (existing) {
        if (mode === 'replace') {
          Object.assign(existing, pHabit);
          updated++;
        } else {
          if (pHabit.reminder && !existing.reminder) {
            existing.reminder = pHabit.reminder;
            updated++;
          } else {
            skipped++;
          }
        }
      } else {
        habitsConfig.push(pHabit);
        added++;
      }
    });

    if (typeof saveConfig === 'function') saveConfig();
    if (typeof renderHabits === 'function') renderHabits();

    return {
      success: true,
      message: `导入成功：新增 ${added} 个，更新 ${updated} 个，跳过 ${skipped} 个`,
      added, updated, skipped
    };
  } catch(e) {
    return { success: false, message: '导入失败：' + e.message };
  }
}

function getPackById(id) {
  return PACK_MARKET.find(p => p.id === id);
}

function getPacksByType(type) {
  if (!type) return PACK_MARKET;
  return PACK_MARKET.filter(p => p.type === type);
}

if (!window.App) window.App = {};
if (!App.Data) App.Data = {};
if (!App.Modules) App.Modules = {};

App.Data.HEALTH_PACK = HEALTH_PACK;
App.Data.SEASONAL_PACKS = SEASONAL_PACKS;
App.Data.NEIJING_PACK = NEIJING_PACK;
App.Data.CONSTITUTION_PACKS = CONSTITUTION_PACKS;
App.Data.WORK_PACK = WORK_PACK;
App.Data.STUDENT_PACK = STUDENT_PACK;
App.Data.FITNESS_PACK = FITNESS_PACK;
App.Data.PACK_MARKET = PACK_MARKET;

App.Modules.PackMarket = {
  exportCurrentHabitPack,
  importHabitPack,
  getPackById,
  getPacksByType
};

if (App.registerModule) {
  App.registerModule('data.packs', 'data', null);
  App.registerModule('pack.market', 'module', App.Modules.PackMarket);
}
