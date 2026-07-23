/**
 * 运动数据 - 基于参考文献
 * 《运动改造大脑》John Ratey
 * 《人体运动生理学》
 * 《高级运动营养学》
 * 《运动医学与康复》
 */
if (!window.App) window.App = {};
if (!App.Data) App.Data = {};

// ============ 运动类型定义 ============
App.Data.SportsTypes = [
  // 有氧运动
  { id: 'running', name: '晨跑', icon: '🏃', category: 'aerobic', timePeriod: 'morning', unit: '分钟', target: 30, tip: '中等强度，微汗即可，《运动改造大脑》推荐每周150分钟有氧', ref: '运动改造大脑' },
  { id: 'jogging', name: '慢跑', icon: '🏃‍♂️', category: 'aerobic', timePeriod: 'anytime', unit: '分钟', target: 30, tip: '心率控制在最大心率的65-75%', ref: '人体运动生理学' },
  { id: 'cycling', name: '骑行', icon: '🚴', category: 'aerobic', timePeriod: 'afternoon', unit: '分钟', target: 45, tip: '申时(15-17点)膀胱经活跃，适合骑行', ref: '黄帝内经' },
  { id: 'swimming', name: '游泳', icon: '🏊', category: 'aerobic', timePeriod: 'anytime', unit: '分钟', target: 30, tip: '全身运动，对关节友好', ref: '运动医学与康复' },
  { id: 'walking', name: '散步', icon: '🚶', category: 'aerobic', timePeriod: 'anytime', unit: '分钟', target: 30, tip: '饭后百步走，活到九十九', ref: '遵生八笺' },

  // 力量训练
  { id: 'strength', name: '力量训练', icon: '💪', category: 'strength', timePeriod: 'afternoon', unit: '组', target: 8, tip: '每周2-3次，每次8-10个复合动作，《运动改造大脑》推荐', ref: '运动改造大脑' },
  { id: 'pushup', name: '俯卧撑', icon: '🏋️', category: 'strength', timePeriod: 'morning', unit: '个', target: 20, tip: '上肢力量训练，每组8-12次', ref: '高级运动营养学' },
  { id: 'squat', name: '深蹲', icon: '🦵', category: 'strength', timePeriod: 'afternoon', unit: '个', target: 20, tip: '下肢复合动作，促进IGF-1分泌', ref: '运动改造大脑' },
  { id: 'plank', name: '平板支撑', icon: '🧘', category: 'strength', timePeriod: 'anytime', unit: '秒', target: 60, tip: '核心肌群训练，每次保持30-60秒', ref: '运动医学与康复' },

  // 协调训练
  { id: 'yoga', name: '瑜伽', icon: '🧘‍♀️', category: 'coordination', timePeriod: 'morning', unit: '分钟', target: 30, tip: '促进身心平衡，《运动改造大脑》推荐协调性训练', ref: '运动改造大脑' },
  { id: 'taiji', name: '太极', icon: '🥋', category: 'coordination', timePeriod: 'morning', unit: '分钟', target: 20, tip: '申时膀胱经活跃时段最佳，缓步行气', ref: '黄帝内经' },
  { id: 'baduanjin', name: '八段锦', icon: '🙆', category: 'coordination', timePeriod: 'morning', unit: '遍', target: 2, tip: '导引养生功法，晨起练习效果佳', ref: '遵生八笺' },
  { id: 'dancing', name: '舞蹈', icon: '💃', category: 'coordination', timePeriod: 'evening', unit: '分钟', target: 30, tip: '需要学习和进步的运动，更能促进神经可塑性', ref: '运动改造大脑' },

  // 拉伸放松
  { id: 'stretch', name: '拉伸', icon: '🤸', category: 'flexibility', timePeriod: 'anytime', unit: '分钟', target: 10, tip: '运动后必做，预防肌肉僵硬', ref: '运动医学与康复' },
  { id: 'foam_roll', name: '泡沫轴放松', icon: '🫧', category: 'flexibility', timePeriod: 'evening', unit: '分钟', target: 10, tip: '筋膜放松，促进恢复', ref: '高级运动营养学' },
];

// ============ 运动分类定义 ============
App.Data.SportsCategories = {
  aerobic: { label: '有氧运动', icon: '🏃', color: '#E07A5F', desc: '提升心肺功能，促进BDNF分泌' },
  strength: { label: '力量训练', icon: '💪', color: '#81B29A', desc: '增强肌肉，促进IGF-1分泌' },
  coordination: { label: '协调训练', icon: '🧘', color: '#F4A261', desc: '促进神经可塑性，提升认知' },
  flexibility: { label: '拉伸放松', icon: '🤸', color: '#3D405B', desc: '预防损伤，促进恢复' },
};

// ============ 运动处方（基于《运动改造大脑》） ============
App.Data.SportPrescriptions = {
  // 运动与学习
  forStudy: {
    title: '学习前运动处方',
    icon: '📚',
    duration: '20-30分钟',
    intensity: '中等强度有氧',
    effect: '提升BDNF，促进记忆巩固',
    tip: '运动后学习窗口是大脑接收新信息的最佳时机',
    ref: '《运动改造大脑》- 运动与学习',
  },
  // 运动与情绪
  forMood: {
    title: '情绪调节运动处方',
    icon: '😊',
    duration: '30-45分钟',
    intensity: '有氧运动',
    effect: '提升多巴胺、血清素、内啡肽',
    tip: '运动后48小时内情绪改善效果持续',
    ref: '《运动改造大脑》- 运动与情绪',
  },
  // 运动与压力
  forStress: {
    title: '压力释放运动处方',
    icon: '😌',
    duration: '30分钟',
    intensity: '中等至剧烈',
    effect: '消耗皮质醇，激活副交感神经',
    tip: '为"战斗或逃跑"反应提供物理出口',
    ref: '《运动改造大脑》- 运动与压力',
  },
  // 运动与衰老
  forAntiaging: {
    title: '抗衰老运动处方',
    icon: '🧬',
    duration: '每周150分钟',
    intensity: '有氧 + 力量',
    effect: '促进海马体神经发生，延缓认知衰退',
    tip: '运动永远不会太迟，但开始得越早越好',
    ref: '《运动改造大脑》- 运动与衰老',
  },
};

// ============ 每日运动目标（基于文献） ============
App.Data.DailyTargets = {
  aerobic: { label: '有氧运动', target: 30, unit: '分钟/天', weekly: 150, ref: '《运动改造大脑》' },
  strength: { label: '力量训练', target: 1, unit: '次/天', weekly: 2, ref: '《运动改造大脑》' },
  coordination: { label: '协调训练', target: 1, unit: '次/天', weekly: 2, ref: '《运动改造大脑》' },
};

// ============ 子午流注运动建议 ============
App.Data.MeridianSports = [
  { id: 'yin', name: '寅时', start: 3, end: 5, meridian: '肺经', action: '宜静养，可做轻柔伸展', icon: '🌅' },
  { id: 'mao', name: '卯时', start: 5, end: 7, meridian: '大肠经', action: '起床，户外散步或太极', icon: '🌄' },
  { id: 'chen', name: '辰时', start: 7, end: 9, meridian: '胃经', action: '胃经活跃，宜轻度运动', icon: '☀️' },
  { id: 'wei', name: '未时', start: 13, end: 15, meridian: '小肠经', action: '午餐后消食，可散步', icon: '🌤️' },
  { id: 'shen', name: '申时', start: 15, end: 17, meridian: '膀胱经', action: '最佳运动时段，跑步、球类皆宜', icon: '🌞', highlight: true },
  { id: 'xu', name: '戌时', start: 19, end: 21, meridian: '心包经', action: '宜静养，减少剧烈运动', icon: '🌙' },
];

// ============ 运动营养建议 ============
App.Data.SportNutrition = {
  before: {
    title: '运动前',
    time: '运动前2-3小时',
    carbs: '低-中GI碳水化合物',
    protein: '少量或避免',
    tip: '缓慢释放能量，避免血糖骤降',
    ref: '《高级运动营养学》',
  },
  during: {
    title: '运动中',
    time: '超过1小时',
    carbs: '30-60g/h碳水化合物',
    protein: '无需',
    tip: '选择易吸收的糖原（如葡萄糖）',
    ref: '《高级运动营养学》',
  },
  after: {
    title: '运动后',
    time: '运动后30-120分钟',
    carbs: '高GI + 蛋白质1.2g/kg',
    protein: '20-40g高质量蛋白',
    tip: '最大化糖原再合成和肌肉修复',
    ref: '《高级运动营养学》',
  },
};

// ============ 运动损伤预防 ============
App.Data.InjuryPrevention = [
  { habit: 'walk_protect', name: '久行伤筋', emoji: '🚶', organ: '肝', scene: '过度行走跑步', action: '量力而行，注意休息', tip: '运动后做拉伸放松' },
  { habit: 'lie_protect', name: '久卧伤气', emoji: '🛏️', organ: '肺', scene: '长期躺床不动', action: '扩胸运动', tip: '适度活动，不可赖床过久' },
];

// ============ 运动金句（基于文献） ============
App.Data.SportQuotes = [
  { text: '运动是大脑最优质的肥料。每一次肌肉收缩都会释放出促进大脑生长的化学物质——BDNF。', source: '《运动改造大脑》John Ratey' },
  { text: '运动是天然的抗抑郁剂。它不仅能提高短期情绪，还能重建大脑的奖励系统。', source: '《运动改造大脑》John Ratey' },
  { text: '运动是唯一被证明能够逆转老年人海马体萎缩的干预手段。', source: '《运动改造大脑》John Ratey' },
  { text: '每一种运动都以自己独特的方式重塑大脑。', source: '《运动改造大脑》John Ratey' },
  { text: '广步于庭，被发缓形，以使志生。', source: '《素问·四气调神大论》' },
  { text: '形劳而不倦。', source: '《素问·上古天真论》' },
];

// ============ 参考文献链接 ============
App.Data.SportReferences = [
  { name: '《运动改造大脑》', author: 'John Ratey', emoji: '🧠', desc: '运动与脑科学', url: 'references/运动改造大脑/运动改造大脑.html' },
  { name: '《人体运动生理学》', author: '运动科学', emoji: '🏃', desc: '能量代谢与运动适应', url: 'references/人体运动生理学/人体运动生理学.html' },
  { name: '《高级运动营养学》', author: '营养科学', emoji: '🥩', desc: '周期化营养与补剂', url: 'references/高级运动营养学/高级运动营养学.html' },
  { name: '《运动医学与康复》', author: '运动医学', emoji: '🩺', desc: '损伤预防与康复', url: 'references/运动医学与康复/运动医学与康复.html' },
];
