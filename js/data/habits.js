const HABIT_LIBRARY = [
  // ============ 运动健身 ============
  // 辰时(7-9)胃经当令，晨练助阳气生发
  {id:'morning_run',name:'晨跑',icon:'🏃‍♂️',category:'sport',timePeriod:'morning',type:'timer',unit:'分钟',tip:'晨跑助阳气生发，20-30分钟微汗即可',defaultReminder:{time:'07:00',enabled:true}},
  // 酉时(17-19)肾经当令，傍晚散步补肾气
  {id:'evening_walk',name:'散步',icon:'🚶‍♀️',category:'sport',timePeriod:'evening',type:'timer',unit:'分钟',tip:'饭后散步养肾气，15-20分钟',defaultReminder:{time:'18:30',enabled:true}},
  // 辰时空腹练瑜伽，助脾胃运化
  {id:'yoga',name:'瑜伽',icon:'🧘‍♀️',category:'sport',timePeriod:'morning',type:'timer',unit:'分钟',tip:'助脾胃运化，30-60分钟',defaultReminder:{time:'07:00',enabled:true}},
  // 申时(15-17)膀胱经当令，申时运动排毒
  {id:'strength',name:'力量训练',icon:'💪',category:'sport',timePeriod:'afternoon',type:'timer',unit:'分钟',tip:'适合力量训练排毒，30-45分钟',defaultReminder:{time:'16:00',enabled:true}},
  {id:'swimming',name:'游泳',icon:'🏊‍♂️',category:'sport',timePeriod:'afternoon',type:'timer',unit:'分钟',tip:'全身运动促进代谢，30-45分钟',defaultReminder:{time:'16:00',enabled:true}},
  // 巳时(9-11)脾经当令，骑车强脾
  {id:'cycling',name:'骑车',icon:'🚴‍♀️',category:'sport',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'骑车锻炼强脾胃，30-60分钟',defaultReminder:{time:'09:30',enabled:true}},
  {id:'jump_rope',name:'跳绳',icon:'🪢',category:'sport',timePeriod:'forenoon',type:'count',unit:'个',tip:'振奋阳气，1000-3000个/次',defaultReminder:{time:'10:00',enabled:true}},
  // 酉时拉伸放松
  {id:'stretch',name:'拉伸放松',icon:'🤸‍♀️',category:'sport',timePeriod:'evening',type:'timer',unit:'分钟',tip:'拉伸放松养肾，10-15分钟',defaultReminder:{time:'18:00',enabled:true}},
  {id:'climb_stairs',name:'爬楼梯',icon:'🪜',category:'sport',timePeriod:'forenoon',type:'count',unit:'层',tip:'助脾运化，每天10层以上',defaultReminder:{time:'10:00',enabled:true}},
  // 戌时(19-21)心包经当令，跳舞畅达心气
  {id:'dance',name:'跳舞',icon:'💃',category:'sport',timePeriod:'evening',type:'timer',unit:'分钟',tip:'跳舞畅达心气，20-30分钟',defaultReminder:{time:'19:30',enabled:true}},
  // 辰时练八段锦，调理脾胃
  {id:'baduanjin',name:'八段锦',icon:'🧘',category:'sport',timePeriod:'morning',type:'timer',unit:'分钟',tip:'《遵生八笺》：八段锦调理脾胃，',defaultReminder:{time:'07:00',enabled:true}},
  {id:'taiji',name:'太极拳',icon:'🥋',category:'sport',timePeriod:'morning',type:'timer',unit:'分钟',tip:'《太极拳论》：，助阳气生发，20-30分钟',defaultReminder:{time:'07:00',enabled:true}},
  {id:'zhanzhuang',name:'站桩',icon:'🧍',category:'sport',timePeriod:'morning',type:'timer',unit:'分钟',tip:'浑圆桩养气，',defaultReminder:{time:'07:00',enabled:true}},
  {id:'fast_walk',name:'快走',icon:'🚶‍♂️',category:'sport',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'助脾运化，30分钟中等强度',defaultReminder:{time:'09:30',enabled:true}},
  {id:'pilates',name:'普拉提',icon:'🤸‍♂️',category:'sport',timePeriod:'afternoon',type:'timer',unit:'分钟',tip:'核心力量训练，20-30分钟',defaultReminder:{time:'16:00',enabled:true}},
  // 巳时脾经当令，提肛运动补中气
  {id:'kegel',name:'提肛运动',icon:'🍑',category:'sport',timePeriod:'forenoon',type:'count',unit:'次',tip:'《医宗金鉴》：常撮谷道则肾气充，每次30下',defaultReminder:{time:'10:00',enabled:true}},

  // ============ 饮食营养 ============
  // 辰时(7-9)胃经当令，此时吃早餐最养胃
  {id:'breakfast',name:'吃早餐',icon:'🍳',category:'diet',timePeriod:'morning',type:'boolean',unit:'',tip:'7-8点吃早餐最养胃，碳水+蛋白质+蔬果',defaultReminder:{time:'07:30',enabled:true}},
  // 午时(11-13)心经当令，午餐养心
  {id:'healthy_diet',name:'均衡饮食',icon:'🥗',category:'diet',timePeriod:'afternoon',type:'boolean',unit:'',defaultReminder:{time:'12:00',enabled:true},tip:'午餐养心，12种以上食物七分饱'},
  // 未时(13-15)小肠经当令，分清泌浊，宜食蔬果
  {id:'fruits_veggies',name:'蔬果摄入',icon:'🥦',category:'diet',timePeriod:'afternoon',type:'count',unit:'份',tip:'分清泌浊，宜食蔬果，300-500g菜+200-350g果',defaultReminder:{time:'14:00',enabled:true}},
  // 辰时起床饮水，助胃排毒
  {id:'daily_water',name:'每日饮水',icon:'💧',category:'diet',timePeriod:'morning',type:'water',unit:'ml',tip:'1500-2000ml/天少量多次',waterConfig:{dailyGoal:2000,perCup:250},intervalReminder:{interval:120,unit:'minute',enabled:true,startTime:'07:00',endTime:'22:00',days:[0,1,2,3,4,5,6]}},
  // 午时午餐少油少盐
  {id:'less_oil',name:'少油少盐',icon:'🧂',category:'diet',timePeriod:'afternoon',type:'boolean',unit:'',tip:'油≤25g盐≤6g',defaultReminder:{time:'12:00',enabled:true}},
  // 酉时做晚饭，养肾
  {id:'home_cooking',name:'自己做饭',icon:'👨‍🍳',category:'diet',timePeriod:'evening',type:'boolean',unit:'',tip:'亲手做晚餐养肾气',defaultReminder:{time:'17:30',enabled:true}},
  // 申时忌含糖饮料，宜饮茶
  {id:'no_sugar_drink',name:'不喝含糖饮料',icon:'🚫',category:'diet',timePeriod:'afternoon',type:'boolean',unit:'',tip:'宜饮水忌含糖饮料',defaultReminder:{time:'15:00',enabled:true}},
  // 巳时脾经旺，坚果健脾胃
  {id:'nuts_intake',name:'坚果摄入',icon:'🥜',category:'diet',timePeriod:'forenoon',type:'count',unit:'份',tip:'坚果健脾胃，每天一小把约20g',defaultReminder:{time:'10:00',enabled:true}},
  // 申时膀胱经旺，饮茶利排毒
  {id:'tea_time',name:'喝茶养生',icon:'🍵',category:'diet',timePeriod:'afternoon',type:'count',unit:'杯',tip:'饮茶利排毒，绿茶抗氧化红茶暖胃',defaultReminder:{time:'15:30',enabled:true}},
  // 辰时补充益生菌，助脾胃
  {id:'probiotics',name:'补充益生菌',icon:'🥛',category:'diet',timePeriod:'morning',type:'boolean',unit:'',tip:'益生菌助脾胃运化',defaultReminder:{time:'08:00',enabled:true}},
  // 午时午餐细嚼慢咽
  {id:'chew_well',name:'细嚼慢咽',icon:'😋',category:'diet',timePeriod:'afternoon',type:'boolean',unit:'',tip:'《养病庸言》：每餐咀嚼36次脾胃不伤',defaultReminder:{time:'12:00',enabled:true}},
  // 未时饭后散步
  {id:'afternoon_walk',name:'饭后散步',icon:'🚶',category:'diet',timePeriod:'afternoon',type:'timer',unit:'分钟',tip:'《摄生要语》：饭后百步走，15-20分钟',defaultReminder:{time:'13:00',enabled:true}},
  // 午时食宜温暖
  {id:'warm_food',name:'食宜温暖',icon:'🍲',category:'diet',timePeriod:'afternoon',type:'boolean',unit:'',tip:'《黄帝内经》：饮食者热无灼灼寒无沧沧',defaultReminder:{time:'12:00',enabled:true}},
  // 辰时五谷为养
  {id:'five_grains',name:'五谷为养',icon:'🌾',category:'diet',timePeriod:'morning',type:'count',unit:'种',tip:'《黄帝内经》：五谷为养，每日3种以上粗粮',defaultReminder:{time:'07:30',enabled:true}},
  // 未时五菜为充
  {id:'five_vegetables',name:'五菜为充',icon:'🥬',category:'diet',timePeriod:'afternoon',type:'count',unit:'种',tip:'《黄帝内经》：五菜为充，每日3种以上蔬菜',defaultReminder:{time:'14:00',enabled:true}},
  // 午时食不语
  {id:'no_eating_talk',name:'食不语',icon:'🤫',category:'diet',timePeriod:'afternoon',type:'boolean',unit:'',tip:'《论语·乡党》：食不语寝不言',defaultReminder:{time:'12:00',enabled:true}},

  // ============ 学习成长 ============
  // 巳时(9-11)脾经当令，脾主思，最佳学习时段
  {id:'reading',name:'阅读',icon:'📚',category:'study',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'最佳阅读时段，20-30分钟',defaultReminder:{time:'09:30',enabled:true}},
  {id:'vocabulary',name:'背单词',icon:'📝',category:'study',timePeriod:'forenoon',type:'count',unit:'个',tip:'记忆力佳，20-30个/天',defaultReminder:{time:'09:00',enabled:true}},
  // 戌时(19-21)心包经当令，静心学习
  {id:'calligraphy',name:'练字',icon:'✍️',category:'study',timePeriod:'evening',type:'timer',unit:'分钟',tip:'静心练字30分钟',defaultReminder:{time:'20:00',enabled:true}},
  {id:'coding',name:'学编程',icon:'💻',category:'study',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'编程学习30-60分钟',defaultReminder:{time:'09:30',enabled:true}},
  {id:'listen_course',name:'听课',icon:'🎧',category:'study',timePeriod:'forenoon',type:'boolean',unit:'',tip:'25分钟番茄工作法',defaultReminder:{time:'09:00',enabled:true}},
  // 戌时写笔记总结
  {id:'notes',name:'写笔记',icon:'📒',category:'study',timePeriod:'evening',type:'boolean',unit:'',tip:'费曼学习法',defaultReminder:{time:'20:00',enabled:true}},
  {id:'language',name:'学外语',icon:'🗣️',category:'study',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'学外语15-30分钟',defaultReminder:{time:'09:30',enabled:true}},
  {id:'podcast',name:'听播客',icon:'🎙️',category:'study',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'通勤散步时听，拓宽视野',defaultReminder:{time:'09:00',enabled:true}},
  // 戌时下棋益智
  {id:'chess',name:'下棋/益智游戏',icon:'♟️',category:'study',timePeriod:'evening',type:'timer',unit:'分钟',tip:'益智锻炼防认知衰退',defaultReminder:{time:'20:00',enabled:true}},

  // ============ 睡眠作息 ============
  // 卯时(5-7)大肠经当令，宜起床排便
  {id:'early_rise',name:'早起',icon:'🌅',category:'sleep',timePeriod:'morning',type:'boolean',unit:'',tip:'6-7点起床顺应阳气生发',defaultReminder:{time:'06:30',enabled:true}},
  // 亥时(21-23)三焦经当令，宜入睡养百脉
  {id:'early_sleep',name:'早睡',icon:'🌙',category:'sleep',timePeriod:'evening',type:'boolean',unit:'',tip:'22:30前入睡养百脉',defaultReminder:{time:'22:30',enabled:true}},
  // 午时(11-13)心经当令，午睡养心
  {id:'nap',name:'午休',icon:'😴',category:'sleep',timePeriod:'afternoon',type:'timer',unit:'分钟',tip:'午睡20-30分钟养心安神',defaultReminder:{time:'12:30',enabled:true}},
  // 亥时放手机
  {id:'no_phone_bed',name:'睡前不玩手机',icon:'📵',category:'sleep',timePeriod:'evening',type:'boolean',unit:'',tip:'睡前30分钟放下手机养百脉',defaultReminder:{time:'21:30',enabled:true}},
  // 亥时睡前仪式
  {id:'bedtime_routine',name:'睡前仪式',icon:'🛁',category:'sleep',timePeriod:'evening',type:'boolean',unit:'',tip:'助三焦通调',defaultReminder:{time:'21:30',enabled:true}},
  // 亥时梳头
  {id:'bedtime_comb',name:'睡前梳头',icon:'🪮',category:'sleep',timePeriod:'evening',type:'count',unit:'次',tip:'《养生论》：，疏通头部经络',defaultReminder:{time:'21:30',enabled:true}},
  // 亥时揉腹
  {id:'abdomen_massage_sleep',name:'睡前揉腹',icon:'🫄',category:'sleep',timePeriod:'evening',type:'timer',unit:'分钟',tip:'《千金要方》：，健脾消食5-10分钟',defaultReminder:{time:'21:30',enabled:true}},
  // 午时子午觉
  {id:'midday_nap_tradition',name:'子午觉',icon:'🌞',category:'sleep',timePeriod:'afternoon',type:'timer',unit:'分钟',tip:'《黄帝内经》：子时大睡，',defaultReminder:{time:'12:00',enabled:true}},

  // ============ 心灵修养 ============
  // 辰时冥想，助阳气生发
  {id:'meditation',name:'冥想',icon:'🧘‍♂️',category:'mind',timePeriod:'morning',type:'timer',unit:'分钟',tip:'10-15分钟，助阳气生发',defaultReminder:{time:'07:00',enabled:true}},
  // 亥时写日记
  {id:'diary',name:'写日记',icon:'📔',category:'mind',timePeriod:'evening',type:'boolean',unit:'',tip:'写日记记录3件感恩的事',defaultReminder:{time:'21:00',enabled:true}},
  // 戌时情绪记录
  {id:'emotion_check',name:'情绪记录',icon:'😊',category:'mind',timePeriod:'evening',type:'select',unit:'',options:['😠怒','😂喜','🤔思','😢悲','😨恐'],tip:'觉察情绪记录当下',defaultReminder:{time:'20:00',enabled:true}},
  {id:'gratitude',name:'感恩练习',icon:'🙏',category:'mind',timePeriod:'evening',type:'count',unit:'件',tip:'每天写下3件值得感恩的事',defaultReminder:{time:'21:00',enabled:true}},
  // 辰时自我肯定
  {id:'affirmation',name:'自我肯定',icon:'💪',category:'mind',timePeriod:'morning',type:'boolean',unit:'',tip:'对着镜子说一句积极的话',defaultReminder:{time:'07:00',enabled:true}},
  // 戌时数字排毒
  {id:'digital_detox',name:'数字排毒',icon:'🔌',category:'mind',timePeriod:'evening',type:'timer',unit:'分钟',tip:'放下手机1小时',defaultReminder:{time:'19:30',enabled:true}},
  // 巳时深呼吸，脾主运化调气
  {id:'deep_breath',name:'深呼吸',icon:'🌬️',category:'mind',timePeriod:'forenoon',type:'count',unit:'次',tip:'5-10次腹式深呼吸调气',defaultReminder:{time:'10:00',enabled:true}},
  // 辰时静坐
  {id:'jingzuo',name:'静坐',icon:'🧘',category:'mind',timePeriod:'morning',type:'timer',unit:'分钟',tip:'《静坐入门》：，收心养性',defaultReminder:{time:'07:00',enabled:true}},
  {id:'mindful_walking',name:'正念行走',icon:'🚶‍♀️',category:'mind',timePeriod:'morning',type:'timer',unit:'分钟',tip:'10-15分钟，觉察呼吸与脚步',defaultReminder:{time:'07:30',enabled:true}},
  // 亥时身体扫描
  {id:'body_scan',name:'身体扫描',icon:'🧍‍♀️',category:'mind',timePeriod:'evening',type:'timer',unit:'分钟',tip:'身体扫描10-15分钟放松入睡',defaultReminder:{time:'21:00',enabled:true}},
  {id:'loving_kindness',name:'慈悲冥想',icon:'❤️',category:'mind',timePeriod:'evening',type:'timer',unit:'分钟',tip:'5-10分钟，愿一切众生喜乐',defaultReminder:{time:'21:00',enabled:true}},

  // ============ 五劳五色防护 ============
  // 巳时脾经当令，护眼护身
  {id:'eye_protect',name:'闭目养神',icon:'👁️',category:'protect',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'久视伤血，',intervalReminder:{interval:20,unit:'minute',enabled:true,startTime:'08:00',endTime:'22:00',days:[0,1,2,3,4,5,6]}},
  {id:'sit_protect',name:'起身活动',icon:'🚶',category:'protect',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'久坐伤肉，',intervalReminder:{interval:45,unit:'minute',enabled:true,startTime:'09:00',endTime:'18:00',days:[1,2,3,4,5]}},
  {id:'stand_protect',name:'交替坐立',icon:'🪑',category:'protect',timePeriod:'forenoon',type:'boolean',unit:'',tip:'久立伤骨，',defaultReminder:{time:'10:00',enabled:true}},
  {id:'lie_protect',name:'扩胸运动',icon:'🏃',category:'protect',timePeriod:'forenoon',type:'count',unit:'次',tip:'久卧伤气，',defaultReminder:{time:'10:00',enabled:true}},
  // 酉时拉筋放松
  {id:'walk_protect',name:'拉筋放松',icon:'🤸',category:'protect',timePeriod:'evening',type:'timer',unit:'分钟',tip:'久行伤筋，',defaultReminder:{time:'18:00',enabled:true}},
  {id:'good_posture',name:'正确坐姿',icon:'🧘',category:'protect',timePeriod:'forenoon',type:'boolean',unit:'',tip:'保持正确坐姿助运化',defaultReminder:{time:'09:00',enabled:true}},
  {id:'eye_rest',name:'眼睛休息',icon:'👀',category:'protect',timePeriod:'forenoon',type:'count',unit:'次',defaultReminder:{time:'10:00',enabled:true},tip:'每用眼20分钟远眺20秒'},
  // 五色入五脏，午未时午餐食用
  {id:'green_food',name:'青色养肝',icon:'🥬',category:'protect',timePeriod:'afternoon',type:'count',unit:'种',foods:'菠菜、芹菜、西兰花、绿茶',tip:'春季宜多食1-2种',defaultReminder:{time:'12:00',enabled:true}},
  {id:'red_food',name:'赤色养心',icon:'🍅',category:'protect',timePeriod:'afternoon',type:'count',unit:'种',foods:'红枣、番茄、红豆、山楂',tip:'夏季宜多食1-2种',defaultReminder:{time:'12:00',enabled:true}},
  {id:'yellow_food',name:'黄色养脾',icon:'🌽',category:'protect',timePeriod:'afternoon',type:'count',unit:'种',foods:'南瓜、小米、黄豆、玉米',tip:'长夏宜多食1-2种',defaultReminder:{time:'12:00',enabled:true}},
  {id:'white_food',name:'白色养肺',icon:'🥦',category:'protect',timePeriod:'afternoon',type:'count',unit:'种',foods:'白萝卜、百合、银耳、莲藕',tip:'秋季宜多食1-2种',defaultReminder:{time:'12:00',enabled:true}},
  {id:'black_food',name:'黑色养肾',icon:'🫘',category:'protect',timePeriod:'afternoon',type:'count',unit:'种',foods:'黑豆、黑芝麻、桑葚、海带',tip:'冬季宜多食1-2种',defaultReminder:{time:'12:00',enabled:true}},
  // 辰时叩齿咽津，固肾益精
  {id:'kouchi_yanjin',name:'叩齿咽津',icon:'🦷',category:'protect',timePeriod:'morning',type:'count',unit:'次',tip:'《抱朴子》：，固肾益精',defaultReminder:{time:'07:00',enabled:true}},
  {id:'comb_head',name:'梳头按摩',icon:'🪮',category:'protect',timePeriod:'morning',type:'count',unit:'次',tip:'《养生论》：，头为诸阳之会',defaultReminder:{time:'07:00',enabled:true}},
  // 辰时搓耳
  {id:'ear_massage',name:'搓耳养生',icon:'👂',category:'protect',timePeriod:'morning',type:'count',unit:'次',tip:'耳为宗脉之所聚补肾强身10下',defaultReminder:{time:'07:00',enabled:true}},
  // 酉时肾经旺，揉腹健脾
  {id:'abdomen_massage',name:'揉腹养生',icon:'🫄',category:'protect',timePeriod:'evening',type:'timer',unit:'分钟',tip:'《千金要方》：',defaultReminder:{time:'18:00',enabled:true}},
  // 酉时搓涌泉穴补肾
  {id:'yongquan_massage',name:'搓涌泉穴',icon:'🦶',category:'protect',timePeriod:'evening',type:'count',unit:'次',tip:'滋阴补肾每侧50次',defaultReminder:{time:'18:00',enabled:true}},
  // 戌时捏脊
  {id:'nijia_massage',name:'捏脊',icon:'🩺',category:'protect',timePeriod:'evening',type:'count',unit:'遍',tip:'3-5遍',defaultReminder:{time:'19:30',enabled:true}},

  // ============ 个人护理 ============
  // 辰时护肤
  {id:'skincare',name:'护肤',icon:'🧴',category:'care',timePeriod:'morning',type:'boolean',unit:'',tip:'',defaultReminder:{time:'07:00',enabled:true}},
  // 亥时泡脚
  {id:'foot_bath',name:'泡脚',icon:'🦶',category:'care',timePeriod:'evening',type:'timer',unit:'分钟',tip:'15-20分钟，水温40℃',defaultReminder:{time:'21:00',enabled:true}},
  // 辰时随餐补充维生素
  {id:'vitamin',name:'补充维生素',icon:'💊',category:'care',timePeriod:'morning',type:'boolean',unit:'',tip:'',defaultReminder:{time:'08:00',enabled:true}},
  // 辰时刷牙
  {id:'brush_teeth',name:'认真刷牙',icon:'🪥',category:'care',timePeriod:'morning',type:'boolean',unit:'',tip:'2分钟，巴氏刷牙法',defaultReminder:{time:'07:00',enabled:true}},
  // 亥时使用牙线
  {id:'floss',name:'使用牙线',icon:'🦷',category:'care',timePeriod:'evening',type:'boolean',unit:'',tip:'',defaultReminder:{time:'21:30',enabled:true}},
  // 辰时涂防晒
  {id:'sunscreen',name:'涂防晒',icon:'🧴',category:'care',timePeriod:'morning',type:'boolean',unit:'',tip:'20分钟涂防晒SPF30+',defaultReminder:{time:'07:30',enabled:true}},
  // 戌时洗澡
  {id:'shower',name:'洗澡',icon:'🚿',category:'care',timePeriod:'evening',type:'boolean',unit:'',tip:'10-15分钟',defaultReminder:{time:'19:30',enabled:true}},
  {id:'hair_care',name:'护发',icon:'💇‍♀️',category:'care',timePeriod:'evening',type:'boolean',unit:'',tip:'定期修剪用护发素',defaultReminder:{time:'20:00',enabled:true}},
  // 辰时鼻部按摩
  {id:'nose_massage',name:'鼻部按摩',icon:'👃',category:'care',timePeriod:'morning',type:'count',unit:'次',tip:'36下',defaultReminder:{time:'07:30',enabled:true}},
  // 亥时眼部热敷
  {id:'eye_hot_compress',name:'眼部热敷',icon:'👁️‍🗨️',category:'care',timePeriod:'evening',type:'timer',unit:'分钟',tip:'5-10分钟',defaultReminder:{time:'21:00',enabled:true}},
  {id:'hand_care',name:'手部护理',icon:'🤲',category:'care',timePeriod:'evening',type:'boolean',unit:'',tip:'',defaultReminder:{time:'20:00',enabled:true}},
  {id:'nail_care',name:'指甲护理',icon:'💅',category:'care',timePeriod:'evening',type:'boolean',unit:'',tip:'',defaultReminder:{time:'20:00',enabled:true}},

  // ============ 居家生活 ============
  // 巳时脾经旺，整理打扫
  {id:'tidy_room',name:'整理房间',icon:'🧹',category:'home',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'整理房间10分钟助运化',defaultReminder:{time:'09:30',enabled:true}},
  {id:'plants_care',name:'照料植物',icon:'🪴',category:'home',timePeriod:'morning',type:'boolean',unit:'',tip:'与自然连接',defaultReminder:{time:'07:30',enabled:true}},
  // 戌时陪宠物
  {id:'pet_care',name:'陪宠物',icon:'🐕',category:'home',timePeriod:'evening',type:'timer',unit:'分钟',tip:'遛狗逗猫互相陪伴',defaultReminder:{time:'19:00',enabled:true}},
  {id:'laundry',name:'洗衣整理',icon:'🧺',category:'home',timePeriod:'forenoon',type:'boolean',unit:'',tip:'',defaultReminder:{time:'09:30',enabled:true}},
  {id:'declutter',name:'断舍离',icon:'📦',category:'home',timePeriod:'forenoon',type:'count',unit:'件',tip:'1件不需要的物品',defaultReminder:{time:'10:00',enabled:true}},
  // 辰时开窗通风
  {id:'window_ventilate',name:'开窗通风',icon:'🪟',category:'home',timePeriod:'morning',type:'timer',unit:'分钟',tip:'20分钟，《黄帝内经》：虚邪贼风避之有时',defaultReminder:{time:'08:00',enabled:true}},
  // 巳时晒太阳补阳
  {id:'sunbathe',name:'晒太阳',icon:'☀️',category:'home',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'15-20分钟补阳气促维D合成',defaultReminder:{time:'10:00',enabled:true}},
  {id:'cleaning',name:'打扫卫生',icon:'🧼',category:'home',timePeriod:'forenoon',type:'timer',unit:'分钟',tip:'15-20分钟，保持整洁',defaultReminder:{time:'10:00',enabled:true}},

  // ============ 社交人际 ============
  // 戌时心包经当令，主喜乐，宜社交
  {id:'call_family',name:'给家人打电话',icon:'📞',category:'social',timePeriod:'evening',type:'boolean',unit:'',tip:'联系家人表达关心',defaultReminder:{time:'19:30',enabled:true}},
  // 申时膀胱经旺，帮助他人
  {id:'help_others',name:'帮助他人',icon:'🤝',category:'social',timePeriod:'afternoon',type:'boolean',unit:'',tip:'',defaultReminder:{time:'15:00',enabled:true}},
  // 巳时微笑
  {id:'smile',name:'保持微笑',icon:'😊',category:'social',timePeriod:'forenoon',type:'boolean',unit:'',tip:'',defaultReminder:{time:'09:00',enabled:true}},
  // 戌时和朋友聊天
  {id:'chat_friend',name:'和朋友聊天',icon:'💬',category:'social',timePeriod:'evening',type:'boolean',unit:'',tip:'和朋友聊天分享生活',defaultReminder:{time:'20:00',enabled:true}},
  // 辰时拥抱家人
  {id:'hug_family',name:'拥抱家人',icon:'🤗',category:'social',timePeriod:'morning',type:'boolean',unit:'',tip:'拥抱释放催产素增进感情',defaultReminder:{time:'07:30',enabled:true}},
  // 申时赞美他人
  {id:'compliment',name:'赞美他人',icon:'👏',category:'social',timePeriod:'afternoon',type:'count',unit:'次',tip:'1次',defaultReminder:{time:'15:00',enabled:true}},

  // ============ 兴趣爱好 ============
  // 戌时心包经旺，宜文艺活动
  {id:'music',name:'听音乐',icon:'🎵',category:'hobby',timePeriod:'evening',type:'timer',unit:'分钟',tip:'',defaultReminder:{time:'20:00',enabled:true}},
  {id:'instrument',name:'练乐器',icon:'🎸',category:'hobby',timePeriod:'evening',type:'timer',unit:'分钟',tip:'30分钟坚持有进步',defaultReminder:{time:'20:00',enabled:true}},
  // 申时绘画摄影
  {id:'drawing',name:'绘画',icon:'🎨',category:'hobby',timePeriod:'afternoon',type:'timer',unit:'分钟',tip:'绘画自由表达',defaultReminder:{time:'15:30',enabled:true}},
  {id:'photography',name:'摄影',icon:'📷',category:'hobby',timePeriod:'afternoon',type:'boolean',unit:'',tip:'',defaultReminder:{time:'16:00',enabled:true}},
  // 酉时做新菜
  {id:'cooking_new',name:'学做新菜',icon:'👩‍🍳',category:'hobby',timePeriod:'evening',type:'boolean',unit:'',tip:'',defaultReminder:{time:'17:30',enabled:true}},
  {id:'gardening',name:'园艺种植',icon:'🌱',category:'hobby',timePeriod:'morning',type:'timer',unit:'分钟',tip:'',defaultReminder:{time:'07:30',enabled:true}},
  // 戌时书法
  {id:'calligraphy_art',name:'书法',icon:'🖌️',category:'hobby',timePeriod:'evening',type:'timer',unit:'分钟',tip:'《临池管见》：',defaultReminder:{time:'20:00',enabled:true}},
  // 申时品茶
  {id:'tea_ceremony',name:'品茶',icon:'🍵',category:'hobby',timePeriod:'afternoon',type:'timer',unit:'分钟',tip:'《茶经》最宜精行俭德之人15-20分钟',defaultReminder:{time:'15:30',enabled:true}},
  {id:'handcraft',name:'手工',icon:'🧶',category:'hobby',timePeriod:'evening',type:'timer',unit:'分钟',tip:'20-30分钟',defaultReminder:{time:'20:00',enabled:true}},

  // ============ 负向习惯 ============
  // 午时记录吸烟
  {id:'no_smoking',name:'吸烟',icon:'🚬',category:'quit',timePeriod:'afternoon',type:'boolean',unit:'',negative:true,tip:'',defaultReminder:{time:'12:00',enabled:true}},
  // 戌时记录饮酒
  {id:'no_drinking',name:'饮酒',icon:'🍺',category:'quit',timePeriod:'evening',type:'boolean',unit:'',negative:true,tip:'',defaultReminder:{time:'20:00',enabled:true}},
  // 亥时记录熬夜
  {id:'no_latenight',name:'熬夜',icon:'🌙',category:'quit',timePeriod:'evening',type:'boolean',unit:'',negative:true,tip:'23点后未睡即为熬夜',defaultReminder:{time:'22:30',enabled:true}},
  // 午时记录垃圾食品
  {id:'no_junkfood',name:'垃圾食品',icon:'🍔',category:'quit',timePeriod:'afternoon',type:'boolean',unit:'',negative:true,tip:'',defaultReminder:{time:'12:00',enabled:true}},
  // 戌时记录暴饮暴食
  {id:'no_overeat',name:'暴饮暴食',icon:'🍕',category:'quit',timePeriod:'evening',type:'boolean',unit:'',negative:true,tip:'',defaultReminder:{time:'20:00',enabled:true}},
  // 巳时记录拖延
  {id:'no_procrastinate',name:'拖延',icon:'⏳',category:'quit',timePeriod:'forenoon',type:'boolean',unit:'',negative:true,tip:'',defaultReminder:{time:'10:00',enabled:true}},
  // 巳时记录跷二郎腿
  {id:'no_cross_legs',name:'跷二郎腿',icon:'🦵',category:'quit',timePeriod:'forenoon',type:'boolean',unit:'',negative:true,tip:'久坐伤肉，跷二郎腿影响脊柱记录有没有',defaultReminder:{time:'10:00',enabled:true}},
  // 申时记录憋尿
  {id:'no_holding_urine',name:'憋尿',icon:'🚽',category:'quit',timePeriod:'afternoon',type:'boolean',unit:'',negative:true,tip:'',defaultReminder:{time:'15:00',enabled:true}},
  // 卯时记录睡懒觉
  {id:'no_stay_up_late',name:'睡懒觉',icon:'😪',category:'quit',timePeriod:'morning',type:'boolean',unit:'',negative:true,tip:'8点不起床为睡懒觉',defaultReminder:{time:'07:30',enabled:true}},

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

// 子午流注 · 十二时辰时段映射
const TIME_PERIOD_MAP = {
  morning:   {label:'卯辰时', emoji:'🌅', order:0, range:[5,9],   subLabel:'5:00-9:00  大肠·胃经'},
  forenoon:  {label:'巳时',   emoji:'🌤️', order:1, range:[9,11],  subLabel:'9:00-11:00  脾经当令'},
  afternoon: {label:'午未申', emoji:'☀️', order:2, range:[11,17], subLabel:'11:00-17:00 心·小肠·膀胱'},
  evening:   {label:'酉戌亥', emoji:'🌙', order:3, range:[17,23], subLabel:'17:00-23:00 肾·心包·三焦'}
};

const DEFAULT_HABITS = ['daily_water','morning_run','early_sleep','reading','meditation','early_rise'];
