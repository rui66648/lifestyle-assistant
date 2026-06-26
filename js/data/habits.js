const HABIT_LIBRARY = [
  // 早晨
  {id:'early_rise',name:'早起',icon:'☀️',category:'morning',type:'boolean',unit:'',tip:'建议6:00-7:00起床，顺应阳气生发'},
  {id:'morning_run',name:'晨跑',icon:'🏃',category:'morning',type:'timer',unit:'分钟',tip:'建议20-30分钟，微汗即可，空腹或早餐后1小时'},
  {id:'breakfast',name:'早餐',icon:'🥣',category:'morning',type:'boolean',unit:'',tip:'建议7:00-8:00，包含碳水+蛋白质+蔬果'},
  // 上午
  {id:'breathe',name:'深呼吸',icon:'🌬️',category:'forenoon',type:'count',unit:'次',tip:'建议每次5-10次腹式呼吸，缓解压力'},
  {id:'eye_rest',name:'眼睛休息',icon:'👁️',category:'forenoon',type:'count',unit:'次',defaultReminder:{time:'10:00'},tip:'建议每用眼20分钟，远眺20秒或闭目1分钟'},
  {id:'good_posture',name:'正确坐姿',icon:'🪑',category:'forenoon',type:'boolean',unit:'',defaultReminder:{time:'09:00'},tip:'背部挺直，双脚平放，屏幕与眼平齐'},
  {id:'less_sit',name:'少坐多动',icon:'🧍',category:'forenoon',type:'count',unit:'次',defaultReminder:{time:'10:30'},tip:'建议每坐45分钟起身活动5分钟'},
  // 下午
  {id:'reading',name:'阅读',icon:'📖',category:'afternoon',type:'timer',unit:'分钟',tip:'建议20-30分钟，纸质书优于电子书'},
  {id:'walk',name:'散步',icon:'🚶',category:'afternoon',type:'timer',unit:'分钟',tip:'建议饭后30分钟散步15-20分钟'},
  {id:'healthy_diet',name:'均衡饮食',icon:'🥗',category:'afternoon',type:'boolean',unit:'',defaultReminder:{time:'12:00'},tip:'每餐12种以上食物，七分饱为宜'},
  {id:'fruits_veggies',name:'蔬果摄入',icon:'🥗',category:'afternoon',type:'count',unit:'份',defaultReminder:{time:'14:00'},tip:'建议每天300-500g蔬菜+200-350g水果'},
  {id:'sunshine',name:'晒太阳',icon:'☀️',category:'afternoon',type:'timer',unit:'分钟',defaultReminder:{time:'16:00'},tip:'建议15-20分钟，促进维生素D合成'},
  // 晚上
  {id:'early_sleep',name:'早睡',icon:'🌙',category:'evening',type:'boolean',unit:'',tip:'建议22:30前入睡，保证7-8小时睡眠'},
  {id:'meditation',name:'冥想',icon:'🧘',category:'evening',type:'timer',unit:'分钟',tip:'建议10-15分钟，睡前冥想有助入眠'},
  {id:'diary',name:'写日记',icon:'📝',category:'evening',type:'boolean',unit:'',tip:'记录3件感恩的事，培养积极心态'},
  {id:'skincare',name:'护肤',icon:'🧦',category:'evening',type:'boolean',unit:'',tip:'清洁+保湿+防晒，睡前彻底卸妆'},
  {id:'foot_bath',name:'泡脚',icon:'🦶',category:'evening',type:'timer',unit:'分钟',tip:'建议15-20分钟，水温40℃左右，睡前1小时'},
  {id:'vitamin',name:'补充维生素',icon:'💊',category:'evening',type:'boolean',unit:'',defaultReminder:{time:'20:00'},tip:'随餐或餐后服用，脂溶性维生素需油脂'},
  // 健身
  {id:'strength',name:'力量训练',icon:'🏋️',category:'fitness',type:'timer',unit:'分钟',tip:'建议30-45分钟，每周2-3次，注意热身'},
  {id:'yoga',name:'瑜伽',icon:'🧘',category:'fitness',type:'timer',unit:'分钟',tip:'建议30-60分钟，空腹或餐后2小时练习'},
  {id:'swimming',name:'游泳',icon:'🏊',category:'fitness',type:'timer',unit:'分钟',tip:'建议30-45分钟，每周2-3次'},
  {id:'cycling',name:'骑车',icon:'🚴',category:'fitness',type:'timer',unit:'分钟',tip:'建议30-60分钟，中等强度，注意防晒'},
  {id:'jump_rope',name:'跳绳',icon:'🤸',category:'fitness',type:'count',unit:'个',tip:'建议1000-3000个/次，分组进行，保护膝盖'},
  // 学习
  {id:'vocabulary',name:'背单词',icon:'📝',category:'study',type:'count',unit:'个',tip:'建议20-30个/天，利用碎片时间复习'},
  {id:'calligraphy',name:'练字',icon:'✍️',category:'study',type:'timer',unit:'分钟',tip:'建议30分钟，静心专注，改善书写'},
  {id:'coding',name:'学编程',icon:'💻',category:'study',type:'timer',unit:'分钟',tip:'建议30-60分钟，动手实践优于纯看视频'},
  {id:'listen_course',name:'听课',icon:'🎧',category:'study',type:'boolean',unit:'',tip:'建议25分钟为一段，番茄工作法'},
  {id:'notes',name:'写笔记',icon:'📓',category:'study',type:'boolean',unit:'',tip:'用自己的话总结，费曼学习法'},
  // 健康建议
  {id:'daily_water',name:'每日饮水',icon:'💧',category:'health',type:'water',unit:'ml',tip:'建议1500-2000ml/天，少量多次，晨起一杯温水',waterConfig:{dailyGoal:2000,perCup:250,schedule:[{time:'06:30',label:'起床第一杯温水',amount:300},{time:'09:30',label:'上午',amount:250},{time:'11:30',label:'午餐前',amount:250},{time:'14:00',label:'下午',amount:200},{time:'16:00',label:'下午补水',amount:250},{time:'18:30',label:'晚餐前',amount:200},{time:'20:30',label:'睡前',amount:150},{time:'22:00',label:'晚间',amount:150}]}},
  // 五色养五脏（黄帝内经）
  {id:'green_food',name:'青色养肝',icon:'🥬',category:'color_diet',type:'count',unit:'种',foods:'菠菜、芹菜、西兰花、绿茶',tip:'建议每天1-2种，春季宜多食'},
  {id:'red_food',name:'赤色养心',icon:'🍅',category:'color_diet',type:'count',unit:'种',foods:'红枣、番茄、红豆、山楂',tip:'建议每天1-2种，夏季宜多食'},
  {id:'yellow_food',name:'黄色养脾',icon:'🌽',category:'color_diet',type:'count',unit:'种',foods:'南瓜、小米、黄豆、玉米',tip:'建议每天1-2种，长夏宜多食'},
  {id:'white_food',name:'白色养肺',icon:'🥦',category:'color_diet',type:'count',unit:'种',foods:'白萝卜、百合、银耳、莲藕',tip:'建议每天1-2种，秋季宜多食'},
  {id:'black_food',name:'黑色养肾',icon:'🫘',category:'color_diet',type:'count',unit:'种',foods:'黑豆、黑芝麻、桑葚、海带',tip:'建议每天1-2种，冬季宜多食'},
  // 情志养生
  {id:'emotion_check',name:'情绪记录',icon:'😊',category:'emotion',type:'select',unit:'',options:['😠怒','😂喜','🤔思','😢悲','😨恐'],tip:'记录当下情绪，了解自己的情绪模式'},
  // 五劳防护
  {id:'eye_protect',name:'闭目养肝',icon:'👁️',category:'wulao',type:'timer',unit:'分钟',tip:'久视伤血，每20分钟闭目20秒'},
  {id:'sit_protect',name:'起身活动',icon:'🧍',category:'wulao',type:'timer',unit:'分钟',tip:'久坐伤肉，每45分钟起身5分钟'},
  {id:'stand_protect',name:'交替坐立',icon:'🪑',category:'wulao',type:'timer',unit:'分钟',tip:'久立伤骨，交替坐立踮脚尖'},
  {id:'lie_protect',name:'扩胸运动',icon:'🛏️',category:'wulao',type:'count',unit:'次',tip:'久卧伤气，适度活动扩胸'},
  {id:'walk_protect',name:'拉筋放松',icon:'🚶',category:'wulao',type:'timer',unit:'分钟',tip:'久行伤筋，运动后拉伸'},
  // 负向习惯
  {id:'no_smoking',name:'吸烟',icon:'🚬',category:'negative',type:'boolean',unit:'',negative:true,tip:'记录今天有没有吸烟'},
  {id:'no_drinking',name:'饮酒',icon:'🍺',category:'negative',type:'boolean',unit:'',negative:true,tip:'记录今天有没有饮酒'},
  {id:'no_latenight',name:'熬夜',icon:'🌙',category:'negative',type:'boolean',unit:'',negative:true,tip:'23点后未睡即为熬夜'},
  {id:'no_junkfood',name:'吃垃圾食品',icon:'🍔',category:'negative',type:'boolean',unit:'',negative:true,tip:'记录今天有没有吃垃圾食品'}
];

const CATEGORY_MAP = {
  morning: {label:'早晨', emoji:'☀️', timePeriod:'morning'},
  forenoon: {label:'上午', emoji:'🌤️', timePeriod:'forenoon'},
  afternoon: {label:'下午', emoji:'☀️', timePeriod:'afternoon'},
  evening: {label:'晚上', emoji:'🌙', timePeriod:'evening'},
  fitness: {label:'健身', emoji:'💪', timePeriod:'afternoon'},
  study: {label:'学习', emoji:'📚', timePeriod:'forenoon'},
  health: {label:'健康建议', emoji:'💚', timePeriod:'afternoon'},
  color_diet: {label:'五色饮食', emoji:'🎨', timePeriod:'afternoon'},
  emotion: {label:'情志养生', emoji:'💭', timePeriod:'evening'},
  wulao: {label:'五劳防护', emoji:'🛡️', timePeriod:'forenoon'},
  negative: {label:'负向习惯', emoji:'🚫', timePeriod:'evening'},
  daytime: {label:'自定义', emoji:'✨', timePeriod:'afternoon'}
};

const TIME_PERIOD_MAP = {
  morning: {label:'早晨', emoji:'🌅', order:0},
  forenoon: {label:'上午', emoji:'🌤️', order:1},
  afternoon: {label:'下午', emoji:'☀️', order:2},
  evening: {label:'晚上', emoji:'🌙', order:3}
};

const DEFAULT_HABITS = ['daily_water','morning_run','early_sleep','reading','meditation','early_rise'];

if (!window.App) window.App = {};
if (!App.Data) App.Data = {};

App.Data.HABIT_LIBRARY = HABIT_LIBRARY;
App.Data.CATEGORY_MAP = CATEGORY_MAP;
App.Data.TIME_PERIOD_MAP = TIME_PERIOD_MAP;
App.Data.DEFAULT_HABITS = DEFAULT_HABITS;
