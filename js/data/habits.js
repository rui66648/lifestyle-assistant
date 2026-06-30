const HABIT_LIBRARY = [
  // ============ 运动健身 ============
  {id:'morning_run',name:'晨跑',icon:'🏃‍♂️',category:'sport',timePeriod:'morning',type:'timer',unit:'分钟',tip:'建议20-30分钟，微汗即可'},
  {id:'evening_walk',name:'散步',icon:'🚶‍♀️',category:'sport',timePeriod:'evening',type:'timer',unit:'分钟',tip:'饭后30分钟散步15-20分钟'},
  {id:'yoga',name:'瑜伽',icon:'🧘‍♀️',category:'sport',timePeriod:'morning',type:'timer',unit:'分钟',tip:'30-60分钟，空腹或餐后2小时'},
  {id:'strength',name:'力量训练',icon:'💪',category:'sport',timePeriod:'afternoon',type:'timer',unit:'分钟',tip:'30-45分钟，每周2-3次'},
  {id:'swimming',name:'游泳',icon:'🏊‍♂️',category:'sport',timePeriod:'afternoon',type:'timer',unit:'分钟',tip:'30-45分钟，每周2-3次'},
  {id:'cycling',name:'骑车',icon:'🚴‍♀️',category:'sport',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'30-60分钟，中等强度'},
  {id:'jump_rope',name:'跳绳',icon:'🪢',category:'sport',timePeriod:'forenoon',type:'count',unit:'个',tip:'1000-3000个/次，分组进行'},
  {id:'stretch',name:'拉伸放松',icon:'🤸‍♀️',category:'sport',timePeriod:'evening',type:'timer',unit:'分钟',tip:'10-15分钟全身拉伸，放松肌肉'},
  {id:'climb_stairs',name:'爬楼梯',icon:'🪜',category:'sport',timePeriod:'forenoon',type:'count',unit:'层',tip:'每天爬10层以上，替代电梯'},
  {id:'dance',name:'跳舞',icon:'💃',category:'sport',timePeriod:'evening',type:'timer',unit:'分钟',tip:'20-30分钟，快乐燃脂'},

  // ============ 饮食营养 ============
  {id:'breakfast',name:'吃早餐',icon:'🍳',category:'diet',timePeriod:'morning',type:'boolean',unit:'',tip:'7:00-8:00，碳水+蛋白质+蔬果'},
  {id:'healthy_diet',name:'均衡饮食',icon:'🥗',category:'diet',timePeriod:'afternoon',type:'boolean',unit:'',defaultReminder:{time:'12:00'},tip:'每餐12种以上食物，七分饱'},
  {id:'fruits_veggies',name:'蔬果摄入',icon:'🥦',category:'diet',timePeriod:'afternoon',type:'count',unit:'份',tip:'每天300-500g蔬菜+200-350g水果'},
  {id:'daily_water',name:'每日饮水',icon:'💧',category:'diet',timePeriod:'morning',type:'water',unit:'ml',tip:'1500-2000ml/天，少量多次',waterConfig:{dailyGoal:2000,perCup:250},intervalReminder:{interval:120,unit:'minute',enabled:true,startTime:'07:00',endTime:'22:00',days:[0,1,2,3,4,5,6]}},
  {id:'less_oil',name:'少油少盐',icon:'🧂',category:'diet',timePeriod:'afternoon',type:'boolean',unit:'',tip:'每天油≤25g，盐≤6g'},
  {id:'home_cooking',name:'自己做饭',icon:'👨‍🍳',category:'diet',timePeriod:'evening',type:'boolean',unit:'',tip:'减少外卖，自己动手更健康'},
  {id:'no_sugar_drink',name:'不喝含糖饮料',icon:'🚫',category:'diet',timePeriod:'afternoon',type:'boolean',unit:'',tip:'用白水/茶代替碳酸饮料和奶茶'},
  {id:'nuts_intake',name:'坚果摄入',icon:'🥜',category:'diet',timePeriod:'forenoon',type:'count',unit:'份',tip:'每天一小把（约20g），补充优质脂肪'},
  {id:'tea_time',name:'喝茶养生',icon:'🍵',category:'diet',timePeriod:'afternoon',type:'count',unit:'杯',tip:'绿茶抗氧化，红茶暖胃，花茶疏肝'},
  {id:'probiotics',name:'补充益生菌',icon:'🥛',category:'diet',timePeriod:'morning',type:'boolean',unit:'',tip:'酸奶/益生菌饮品，维护肠道健康'},

  // ============ 学习成长 ============
  {id:'reading',name:'阅读',icon:'📚',category:'study',timePeriod:'evening',type:'timer',unit:'分钟',tip:'20-30分钟，纸质书优于电子书'},
  {id:'vocabulary',name:'背单词',icon:'📝',category:'study',timePeriod:'forenoon',type:'count',unit:'个',tip:'20-30个/天，利用碎片时间'},
  {id:'calligraphy',name:'练字',icon:'✍️',category:'study',timePeriod:'evening',type:'timer',unit:'分钟',tip:'30分钟，静心专注'},
  {id:'coding',name:'学编程',icon:'💻',category:'study',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'30-60分钟，动手实践'},
  {id:'listen_course',name:'听课',icon:'🎧',category:'study',timePeriod:'forenoon',type:'boolean',unit:'',tip:'25分钟为一段，番茄工作法'},
  {id:'notes',name:'写笔记',icon:'📒',category:'study',timePeriod:'evening',type:'boolean',unit:'',tip:'用自己的话总结，费曼学习法'},
  {id:'language',name:'学外语',icon:'🗣️',category:'study',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'每天15-30分钟，听说读写结合'},
  {id:'podcast',name:'听播客',icon:'🎙️',category:'study',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'通勤/散步时听，拓宽视野'},
  {id:'chess',name:'下棋/益智游戏',icon:'♟️',category:'study',timePeriod:'evening',type:'timer',unit:'分钟',tip:'锻炼逻辑思维，预防认知衰退'},

  // ============ 睡眠作息 ============
  {id:'early_rise',name:'早起',icon:'🌅',category:'sleep',timePeriod:'morning',type:'boolean',unit:'',tip:'6:00-7:00起床，顺应阳气生发'},
  {id:'early_sleep',name:'早睡',icon:'🌙',category:'sleep',timePeriod:'evening',type:'boolean',unit:'',tip:'22:30前入睡，保证7-8小时'},
  {id:'nap',name:'午休',icon:'😴',category:'sleep',timePeriod:'afternoon',type:'timer',unit:'分钟',tip:'12:00-14:00，20-30分钟为宜'},
  {id:'no_phone_bed',name:'睡前不玩手机',icon:'📵',category:'sleep',timePeriod:'evening',type:'boolean',unit:'',tip:'睡前30分钟放下手机，蓝光影响褪黑素'},
  {id:'bedtime_routine',name:'睡前仪式',icon:'🛁',category:'sleep',timePeriod:'evening',type:'boolean',unit:'',tip:'泡脚/冥想/轻音乐，帮助放松入睡'},

  // ============ 心灵修养 ============
  {id:'meditation',name:'冥想',icon:'🧘‍♂️',category:'mind',timePeriod:'morning',type:'timer',unit:'分钟',tip:'10-15分钟，正念冥想有助减压'},
  {id:'diary',name:'写日记',icon:'📔',category:'mind',timePeriod:'evening',type:'boolean',unit:'',tip:'记录3件感恩的事'},
  {id:'emotion_check',name:'情绪记录',icon:'😊',category:'mind',timePeriod:'evening',type:'select',unit:'',options:['😠怒','😂喜','🤔思','😢悲','😨恐'],tip:'记录当下情绪'},
  {id:'gratitude',name:'感恩练习',icon:'🙏',category:'mind',timePeriod:'evening',type:'count',unit:'件',tip:'每天写下3件值得感恩的事'},
  {id:'affirmation',name:'自我肯定',icon:'💪',category:'mind',timePeriod:'morning',type:'boolean',unit:'',tip:'对着镜子说一句积极的话'},
  {id:'digital_detox',name:'数字排毒',icon:'🔌',category:'mind',timePeriod:'evening',type:'timer',unit:'分钟',tip:'每天至少1小时不看屏幕'},
  {id:'deep_breath',name:'深呼吸',icon:'🌬️',category:'mind',timePeriod:'forenoon',type:'count',unit:'次',tip:'5-10次腹式深呼吸，缓解压力'},

  // ============ 五劳五色防护 ============
  {id:'eye_protect',name:'闭目养神',icon:'👁️',category:'protect',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'久视伤血，每20分钟闭目20秒',intervalReminder:{interval:20,unit:'minute',enabled:true,startTime:'08:00',endTime:'22:00',days:[0,1,2,3,4,5,6]}},
  {id:'sit_protect',name:'起身活动',icon:'🚶',category:'protect',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'久坐伤肉，每45分钟起身5分钟',intervalReminder:{interval:45,unit:'minute',enabled:true,startTime:'09:00',endTime:'18:00',days:[1,2,3,4,5]}},
  {id:'stand_protect',name:'交替坐立',icon:'🪑',category:'protect',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'久立伤骨，交替坐立踮脚尖'},
  {id:'lie_protect',name:'扩胸运动',icon:'🏃',category:'protect',timePeriod:'forenoon',type:'count',unit:'次',tip:'久卧伤气，适度活动扩胸'},
  {id:'walk_protect',name:'拉筋放松',icon:'🤸',category:'protect',timePeriod:'evening',type:'timer',unit:'分钟',tip:'久行伤筋，运动后拉伸'},
  {id:'good_posture',name:'正确坐姿',icon:'🧘',category:'protect',timePeriod:'forenoon',type:'boolean',unit:'',tip:'背挺直，双脚平放，屏幕与眼平齐'},
  {id:'eye_rest',name:'眼睛休息',icon:'👀',category:'protect',timePeriod:'forenoon',type:'count',unit:'次',defaultReminder:{time:'10:00'},tip:'每用眼20分钟，远眺20秒'},
  {id:'green_food',name:'青色养肝',icon:'🥬',category:'protect',timePeriod:'afternoon',type:'count',unit:'种',foods:'菠菜、芹菜、西兰花、绿茶',tip:'每天1-2种，春季宜多食'},
  {id:'red_food',name:'赤色养心',icon:'🍅',category:'protect',timePeriod:'afternoon',type:'count',unit:'种',foods:'红枣、番茄、红豆、山楂',tip:'每天1-2种，夏季宜多食'},
  {id:'yellow_food',name:'黄色养脾',icon:'🌽',category:'protect',timePeriod:'afternoon',type:'count',unit:'种',foods:'南瓜、小米、黄豆、玉米',tip:'每天1-2种，长夏宜多食'},
  {id:'white_food',name:'白色养肺',icon:'🥦',category:'protect',timePeriod:'afternoon',type:'count',unit:'种',foods:'白萝卜、百合、银耳、莲藕',tip:'每天1-2种，秋季宜多食'},
  {id:'black_food',name:'黑色养肾',icon:'🫘',category:'protect',timePeriod:'afternoon',type:'count',unit:'种',foods:'黑豆、黑芝麻、桑葚、海带',tip:'每天1-2种，冬季宜多食'},

  // ============ 个人护理 ============
  {id:'skincare',name:'护肤',icon:'🧴',category:'care',timePeriod:'morning',type:'boolean',unit:'',tip:'清洁+保湿+防晒，睡前卸妆'},
  {id:'foot_bath',name:'泡脚',icon:'🦶',category:'care',timePeriod:'evening',type:'timer',unit:'分钟',tip:'15-20分钟，水温40℃，睡前1小时'},
  {id:'vitamin',name:'补充维生素',icon:'💊',category:'care',timePeriod:'morning',type:'boolean',unit:'',tip:'随餐或餐后服用'},
  {id:'brush_teeth',name:'认真刷牙',icon:'🪥',category:'care',timePeriod:'morning',type:'boolean',unit:'',tip:'早晚各一次，每次2分钟，巴氏刷牙法'},
  {id:'floss',name:'使用牙线',icon:'🦷',category:'care',timePeriod:'evening',type:'boolean',unit:'',tip:'每天一次，清洁牙缝'},
  {id:'sunscreen',name:'涂防晒',icon:'🧴',category:'care',timePeriod:'morning',type:'boolean',unit:'',tip:'出门前20分钟涂抹，SPF30+'},
  {id:'shower',name:'洗澡',icon:'🚿',category:'care',timePeriod:'evening',type:'boolean',unit:'',tip:'水温不宜过高，10-15分钟为宜'},
  {id:'hair_care',name:'护发',icon:'💇‍♀️',category:'care',timePeriod:'evening',type:'boolean',unit:'',tip:'定期修剪，使用护发素/发膜'},

  // ============ 居家生活 ============
  {id:'tidy_room',name:'整理房间',icon:'🧹',category:'home',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'每天10分钟，保持环境整洁'},
  {id:'plants_care',name:'照料植物',icon:'🪴',category:'home',timePeriod:'morning',type:'boolean',unit:'',tip:'浇水/修剪，与自然连接'},
  {id:'pet_care',name:'陪宠物',icon:'🐕',category:'home',timePeriod:'evening',type:'timer',unit:'分钟',tip:'遛狗/逗猫，互相陪伴'},
  {id:'laundry',name:'洗衣整理',icon:'🧺',category:'home',timePeriod:'forenoon',type:'boolean',unit:'',tip:'定期洗衣，保持整洁卫生'},
  {id:'declutter',name:'断舍离',icon:'📦',category:'home',timePeriod:'forenoon',type:'count',unit:'件',tip:'每天处理1件不需要的物品'},

  // ============ 社交人际 ============
  {id:'call_family',name:'给家人打电话',icon:'📞',category:'social',timePeriod:'evening',type:'boolean',unit:'',tip:'每天联系家人，表达关心'},
  {id:'help_others',name:'帮助他人',icon:'🤝',category:'social',timePeriod:'afternoon',type:'boolean',unit:'',tip:'日行一善，助人为乐'},
  {id:'smile',name:'保持微笑',icon:'😊',category:'social',timePeriod:'forenoon',type:'boolean',unit:'',tip:'微笑能释放内啡肽，让自己和他人开心'},
  {id:'chat_friend',name:'和朋友聊天',icon:'💬',category:'social',timePeriod:'evening',type:'boolean',unit:'',tip:'保持社交联系，分享生活'},

  // ============ 兴趣爱好 ============
  {id:'music',name:'听音乐',icon:'🎵',category:'hobby',timePeriod:'evening',type:'timer',unit:'分钟',tip:'听喜欢的音乐放松心情'},
  {id:'instrument',name:'练乐器',icon:'🎸',category:'hobby',timePeriod:'evening',type:'timer',unit:'分钟',tip:'每天30分钟，坚持就有进步'},
  {id:'drawing',name:'绘画',icon:'🎨',category:'hobby',timePeriod:'afternoon',type:'timer',unit:'分钟',tip:'不拘形式，自由表达'},
  {id:'photography',name:'摄影',icon:'📷',category:'hobby',timePeriod:'afternoon',type:'boolean',unit:'',tip:'每天拍一张有意义的照片'},
  {id:'cooking_new',name:'学做新菜',icon:'👩‍🍳',category:'hobby',timePeriod:'evening',type:'boolean',unit:'',tip:'每周尝试一道新菜品'},
  {id:'gardening',name:'园艺种植',icon:'🌱',category:'hobby',timePeriod:'morning',type:'timer',unit:'分钟',tip:'种花种菜，亲近自然'},

  // ============ 负向习惯 ============
  {id:'no_smoking',name:'吸烟',icon:'🚬',category:'quit',timePeriod:'afternoon',type:'boolean',unit:'',negative:true,tip:'记录今天有没有吸烟'},
  {id:'no_drinking',name:'饮酒',icon:'🍺',category:'quit',timePeriod:'evening',type:'boolean',unit:'',negative:true,tip:'记录今天有没有饮酒'},
  {id:'no_latenight',name:'熬夜',icon:'🌙',category:'quit',timePeriod:'evening',type:'boolean',unit:'',negative:true,tip:'23点后未睡即为熬夜'},
  {id:'no_junkfood',name:'垃圾食品',icon:'🍔',category:'quit',timePeriod:'afternoon',type:'boolean',unit:'',negative:true,tip:'记录今天有没有吃垃圾食品'},
  {id:'no_overeat',name:'暴饮暴食',icon:'🍕',category:'quit',timePeriod:'evening',type:'boolean',unit:'',negative:true,tip:'记录今天有没有暴饮暴食'},
  {id:'no_procrastinate',name:'拖延',icon:'⏳',category:'quit',timePeriod:'forenoon',type:'boolean',unit:'',negative:true,tip:'记录今天有没有拖延重要任务'}
];

const CATEGORY_MAP = {
  sport: {label:'运动', emoji:'💪'},
  diet: {label:'饮食', emoji:'🥗'},
  study: {label:'学习', emoji:'📚'},
  sleep: {label:'睡眠', emoji:'😴'},
  mind: {label:'心灵', emoji:'🧠'},
  protect: {label:'防护', emoji:'🛡️'},
  care: {label:'护理', emoji:'🧴'},
  home: {label:'居家', emoji:'🏠'},
  social: {label:'社交', emoji:'💬'},
  hobby: {label:'兴趣', emoji:'🎯'},
  quit: {label:'戒除', emoji:'🚫'},
  daytime: {label:'自定义', emoji:'✨'}
};

const TIME_PERIOD_MAP = {
  morning: {label:'早晨', emoji:'🌅', order:0, range:'5:00-10:00'},
  forenoon: {label:'上午', emoji:'🌤️', order:1, range:'10:00-12:00'},
  afternoon: {label:'下午', emoji:'☀️', order:2, range:'12:00-18:00'},
  evening: {label:'晚上', emoji:'🌙', order:3, range:'18:00-23:00'}
};

const DEFAULT_HABITS = ['daily_water','morning_run','early_sleep','reading','meditation','early_rise'];

if (!window.App) window.App = {};
if (!App.Data) App.Data = {};

App.Data.HABIT_LIBRARY = HABIT_LIBRARY;
App.Data.CATEGORY_MAP = CATEGORY_MAP;
App.Data.TIME_PERIOD_MAP = TIME_PERIOD_MAP;
App.Data.DEFAULT_HABITS = DEFAULT_HABITS;

if (App.registerModule) {
  App.registerModule('data.habits', 'data', null);
}
