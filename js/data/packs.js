const HEALTH_PACK = {
  name: '健康生活建议包',
  description: '基于医学研究的一日健康作息方案，包含18个科学建议习惯',
  habits: [
    // 早晨 3个
    {id:'early_rise',reminder:{time:'06:30',enabled:true}},
    {id:'daily_water',reminder:{time:'06:40',enabled:true}},
    {id:'morning_run',reminder:{time:'07:00',enabled:true}},
    {id:'breakfast',reminder:{time:'07:45',enabled:true}},
    // 上午 4个
    {id:'eye_rest',reminder:{time:'10:00',enabled:true}},
    {id:'good_posture',reminder:{time:'09:00',enabled:true}},
    {id:'less_sit',reminder:{time:'10:30',enabled:true}},
    {id:'breathe',reminder:{time:'11:00',enabled:true}},
    // 下午 5个
    {id:'healthy_diet',reminder:{time:'12:00',enabled:true}},
    {id:'walk',reminder:{time:'12:30',enabled:true}},
    {id:'fruits_veggies',reminder:{time:'14:00',enabled:true}},
    {id:'daily_water',reminder:{time:'09:00',enabled:true}},
    {id:'sunshine',reminder:{time:'16:00',enabled:true}},
    // 晚上 5个
    {id:'skincare',reminder:{time:'21:00',enabled:true}},
    {id:'foot_bath',reminder:{time:'21:30',enabled:true}},
    {id:'meditation',reminder:{time:'22:00',enabled:true}},
    {id:'diary',reminder:{time:'22:15',enabled:true}},
    {id:'early_sleep',reminder:{time:'22:30',enabled:true}}
  ]
};

const SEASONAL_PACKS = {
  spring: {
    name: '春季养生包',
    season: '春',
    emoji: '🌿',
    months: [2, 3, 4],
    focus: '养肝舒展',
    color: 'spring',
    quote: '《黄帝内经》："春三月，此谓发陈，天地俱生，万物以荣。夜卧早起，广步于庭，被发缓形，以使志生。"',
    tip: '春季养生重在<em>养肝</em>。宜晚睡早起（不超23点），多户外散步，饮食省酸增甘，保持心情舒畅。',
    habits: [
      {id:'early_rise',reminder:{time:'06:30',enabled:true}},
      {id:'daily_water',reminder:{time:'06:40',enabled:true}},
      {id:'breakfast',reminder:{time:'07:30',enabled:true}},
      {id:'walk',reminder:{time:'07:30',enabled:true}},
      {id:'breathe',reminder:{time:'10:00',enabled:true}},
      {id:'fruits_veggies',reminder:{time:'12:00',enabled:true}},
      {id:'daily_water',reminder:{time:'09:00',enabled:true}},
      {id:'eye_rest',reminder:{time:'10:30',enabled:true}},
      {id:'good_posture',reminder:{time:'09:00',enabled:true}},
      {id:'meditation',reminder:{time:'22:00',enabled:true}},
      {id:'early_sleep',reminder:{time:'22:30',enabled:true}}
    ]
  },
  summer: {
    name: '夏季养生包',
    season: '夏',
    emoji: '☀️',
    months: [5, 6, 7],
    focus: '养心静心',
    color: 'summer',
    quote: '《黄帝内经》："夏三月，此谓蕃秀，天地气交，万物华实。夜卧早起，无厌于日，使志无怒，使华英成秀。"',
    tip: '夏季养生重在<em>养心</em>。宜晚睡早起，多饮水（2500ml），饮食清淡，适当晒太阳养阳气，保持心态平和。',
    habits: [
      {id:'early_rise',reminder:{time:'06:00',enabled:true}},
      {id:'daily_water',reminder:{time:'06:10',enabled:true}},
      {id:'breakfast',reminder:{time:'07:00',enabled:true}},
      {id:'good_posture',reminder:{time:'09:00',enabled:true}},
      {id:'less_sit',reminder:{time:'10:00',enabled:true}},
      {id:'healthy_diet',reminder:{time:'12:00',enabled:true}},
      {id:'fruits_veggies',reminder:{time:'14:00',enabled:true}},
      {id:'daily_water',reminder:{time:'09:00',enabled:true}},
      {id:'sunshine',reminder:{time:'16:00',enabled:true}},
      {id:'foot_bath',reminder:{time:'21:30',enabled:true}},
      {id:'meditation',reminder:{time:'22:00',enabled:true}},
      {id:'early_sleep',reminder:{time:'22:30',enabled:true}}
    ]
  },
  autumn: {
    name: '秋季养生包',
    season: '秋',
    emoji: '🍂',
    months: [8, 9, 10],
    focus: '养肺润燥',
    color: 'autumn',
    quote: '《黄帝内经》："秋三月，此谓容平，天气以急，地气以明。早卧早起，与鸡俱兴，使志安宁，以缓秋刑。"',
    tip: '秋季养生重在<em>养肺</em>。宜早睡早起，多食白色食物（百合、银耳、梨），注意皮肤保湿，保持情绪安宁。',
    habits: [
      {id:'early_rise',reminder:{time:'06:30',enabled:true}},
      {id:'daily_water',reminder:{time:'06:40',enabled:true}},
      {id:'breakfast',reminder:{time:'07:30',enabled:true}},
      {id:'breathe',reminder:{time:'10:00',enabled:true}},
      {id:'eye_rest',reminder:{time:'10:30',enabled:true}},
      {id:'healthy_diet',reminder:{time:'12:00',enabled:true}},
      {id:'fruits_veggies',reminder:{time:'14:00',enabled:true}},
      {id:'daily_water',reminder:{time:'09:00',enabled:true}},
      {id:'walk',reminder:{time:'16:00',enabled:true}},
      {id:'skincare',reminder:{time:'21:00',enabled:true}},
      {id:'foot_bath',reminder:{time:'21:30',enabled:true}},
      {id:'early_sleep',reminder:{time:'22:00',enabled:true}}
    ]
  },
  winter: {
    name: '冬季养生包',
    season: '冬',
    emoji: '❄️',
    months: [11, 12, 1],
    focus: '养肾保暖',
    color: 'winter',
    quote: '《黄帝内经》："冬三月，此谓闭藏，水冰地坼，无扰乎阳。早卧晚起，必待日光，去寒就温，无泄皮肤。"',
    tip: '冬季养生重在<em>养肾</em>。宜早睡晚起（等太阳升起），多温补食物，注意保暖，适当泡脚暖身，减少户外剧烈运动。',
    habits: [
      {id:'daily_water',reminder:{time:'07:00',enabled:true}},
      {id:'breakfast',reminder:{time:'08:00',enabled:true}},
      {id:'good_posture',reminder:{time:'09:00',enabled:true}},
      {id:'less_sit',reminder:{time:'10:30',enabled:true}},
      {id:'healthy_diet',reminder:{time:'12:00',enabled:true}},
      {id:'fruits_veggies',reminder:{time:'14:00',enabled:true}},
      {id:'daily_water',reminder:{time:'09:00',enabled:true}},
      {id:'sunshine',reminder:{time:'15:00',enabled:true}},
      {id:'vitamin',reminder:{time:'20:00',enabled:true}},
      {id:'foot_bath',reminder:{time:'21:00',enabled:true}},
      {id:'meditation',reminder:{time:'21:30',enabled:true}},
      {id:'early_sleep',reminder:{time:'22:00',enabled:true}}
    ]
  }
};

if (!window.App) window.App = {};
if (!App.Data) App.Data = {};

App.Data.HEALTH_PACK = HEALTH_PACK;
App.Data.SEASONAL_PACKS = SEASONAL_PACKS;
