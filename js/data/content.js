const QUOTES = [
  "法于阴阳，和于术数，食饮有节，起居有常，不妄作劳。--《素问·上古天真论》",
  "恬惔虚无，真气从之，精神内守，病安从来。--《素问·上古天真论》",
  "圣人不治已病，治未病；不治已乱，治未乱。--《素问·四气调神大论》",
  "虚邪贼风，避之有时。--《素问·上古天真论》",
  "夫四时阴阳者，万物之根本也。春夏养阳，秋冬养阴，以从其根。--《素问·四气调神大论》",
  "春三月，此谓发陈，天地俱生，万物以荣。--《素问·四气调神大论》",
  "夏三月，此谓蕃秀，天地气交，万物华实。--《素问·四气调神大论》",
  "秋三月，此谓容平，天气以急，地气以明。--《素问·四气调神大论》",
  "冬三月，此谓闭藏，水冰地坼，无扰乎阳。--《素问·四气调神大论》",
  "五谷为养，五果为助，五畜为益，五菜为充。--《素问·藏气法时论》",
  "饮食自倍，肠胃乃伤。--《素问·痹论》",
  "食饮者，热无灼灼，寒无沧沧。寒温中适，故气将持。--《灵枢·师传》",
  "百病生于气也。怒则气上，喜则气缓，悲则气消，恐则气下，思则气结。--《素问·举痛论》",
  "怒伤肝，悲胜怒；喜伤心，恐胜喜；思伤脾，怒胜思；忧伤肺，喜胜忧；恐伤肾，思胜恐。--《素问·阴阳应象大论》",
  "心藏神，肺藏魄，肝藏魂，脾藏意，肾藏志。--《素问·宣明五气篇》",
  "人与天地相参也，与日月相应也。--《灵枢·岁露论》",
  "阳气者，若天与日，失其所，则折寿而不彰。--《素问·生气通天论》",
  "久视伤血，久卧伤气，久坐伤肉，久立伤骨，久行伤筋。--《素问·宣明五气篇》",
  "志闲而少欲，心安而不惧，形劳而不倦。--《素问·上古天真论》",
  "阴阳者，天地之道也，万物之纲纪，变化之父母。--《素问·阴阳应象大论》",
  "逆之则灾害生，从之则苛疾不起。--《素问·四气调神大论》",
  "嗜欲不能劳其目，淫邪不能惑其心。--《素问·上古天真论》",
  "以酒为浆，以妄为常，起居无节，故半百而衰也。--《素问·上古天真论》",
  "不妄作劳，故能形与神俱。--《素问·上古天真论》",
  "春伤于风，夏生飧泄；夏伤于暑，秋必痎疟。--《素问·阴阳应象大论》",
  "秋伤于湿，冬生咳嗽。--《素问·阴阳应象大论》",
  "正气存内，邪不可干。--《素问·刺法论》",
  "形与神俱，而尽终其天年，度百岁乃去。--《素问·上古天真论》",
  "四时阴阳者，从之则苛疾不起，逆之则灾害生。--《素问·四气调神大论》",
  "上工治未病，不治已病。--《灵枢·逆顺》"
];

const REF_BOOKS = [
  {name:'《黄帝内经》',author:'先秦 · 黄帝/岐伯',type:'ancient',emoji:'🏛️',desc:'中医养生理论之源',url:'https://rui66648.github.io/lifestyle-assistant/references/黄帝内经/黄帝内经.html'},
  {name:'《遵生八笺》',author:'明代 · 高濂',type:'ancient',emoji:'🌿',desc:'古代养生百科全书',url:'https://rui66648.github.io/lifestyle-assistant/references/遵生八笺/遵生八笺.html'},
  {name:'《老老恒言》',author:'清代 · 曹庭栋',type:'ancient',emoji:'👴',desc:'老年养生专著',url:'https://rui66648.github.io/lifestyle-assistant/references/老老恒言/老老恒言.html'},
  {name:'《饮膳正要》',author:'元代 · 忽思慧',type:'ancient',emoji:'🍲',desc:'宫廷营养学专著',url:'https://rui66648.github.io/lifestyle-assistant/references/饮膳正要/饮膳正要.html'},
  {name:'《养生论》',author:'三国 · 嵇康',type:'ancient',emoji:'📜',desc:'首创系统养生专论',url:'https://rui66648.github.io/lifestyle-assistant/references/养生论/养生论.html'},
  {name:'《寿世青编》',author:'清代 · 尤乘',type:'ancient',emoji:'💚',desc:'五脏养生心药之说',url:'https://rui66648.github.io/lifestyle-assistant/references/寿世青编/寿世青编.html'},
  {name:'《备急千金要方》',author:'唐代 · 孙思邈',type:'ancient',emoji:'💊',desc:'药王养性治未病',url:'https://rui66648.github.io/lifestyle-assistant/references/备急千金要方/备急千金要方.html'},
  {name:'《抱朴子》',author:'晋代 · 葛洪',type:'ancient',emoji:'🔮',desc:'道家养生不伤为本',url:'https://rui66648.github.io/lifestyle-assistant/references/抱朴子/抱朴子.html'},
  {name:'《闲情偶寄》',author:'清代 · 李渔',type:'ancient',emoji:'🎋',desc:'生活美学养生先养心',url:'https://rui66648.github.io/lifestyle-assistant/references/闲情偶寄/闲情偶寄.html'},
  {name:'《你是你吃出来的》',author:'现代 · 夏萌',type:'modern',emoji:'🥗',desc:'细胞营养与七大营养素',url:'https://rui66648.github.io/lifestyle-assistant/references/你是你吃出来的/你是你吃出来的.html'},
  {name:'《九种体质养生全书》',author:'现代 · 王琦',type:'modern',emoji:'🧬',desc:'九种体质辨识调理',url:'https://rui66648.github.io/lifestyle-assistant/references/九种体质养生全书/九种体质养生全书.html'},
  {name:'《科学休息》',author:'现代 · 亚历克斯',type:'modern',emoji:'🧠',desc:'注意力网络与四种休息',url:'https://rui66648.github.io/lifestyle-assistant/references/科学休息/科学休息.html'},
  {name:'《求医不如求己》',author:'现代 · 中里巴人',type:'modern',emoji:'💆',desc:'穴位按摩经络保健',url:'https://rui66648.github.io/lifestyle-assistant/references/求医不如求己/求医不如求己.html'},
  {name:'《拉伸》',author:'现代 · 鲍勃',type:'modern',emoji:'🤸',desc:'拉伸动作与办公室拉伸',url:'https://rui66648.github.io/lifestyle-assistant/references/拉伸/拉伸.html'},
  {name:'《黄帝内经说什么》',author:'现代 · 徐文兵/梁冬',type:'modern',emoji:'💬',desc:'对话体解读黄帝内经',url:'https://rui66648.github.io/lifestyle-assistant/references/黄帝内经说什么/黄帝内经说什么.html'},
  {name:'《睡眠革命》',author:'现代 ·  Nick Littlehales',type:'modern',emoji:'🌙',desc:'R90睡眠方案与现代睡眠科学',url:'https://rui66648.github.io/lifestyle-assistant/references/睡眠革命/睡眠革命.html'},
  {name:'《救命饮食》',author:'现代 · 柯林·坎贝尔',type:'modern',emoji:'🥦',desc:'中国健康调查与植物性饮食',url:'https://rui66648.github.io/lifestyle-assistant/references/救命饮食/救命饮食.html'},
  {name:'《免疫功能90天复原方案》',author:'现代 · 苏珊·布卢姆',type:'modern',emoji:'🛡️',desc:'免疫系统修复与功能医学',url:'https://rui66648.github.io/lifestyle-assistant/references/免疫功能90天复原方案/免疫功能90天复原方案.html'},
  {name:'《掌控习惯》',author:'现代 · 詹姆斯·克利尔',type:'modern',emoji:'📈',desc:'习惯养成四定律与行为设计',url:'https://rui66648.github.io/lifestyle-assistant/references/掌控习惯/掌控习惯.html'},
  {name:'《久坐急救运动》',author:'现代 · 埃里克·古德曼',type:'modern',emoji:'🏃',desc:'Foundation Training核心训练',url:'https://rui66648.github.io/lifestyle-assistant/references/久坐急救运动/久坐急救运动.html'}
];

const HEALTH_TIPS = {
  morning: [
    {type:'diet',text:'辰时(7-9点)胃经当令，宜食温热早餐，忌空腹冷饮',source:'黄帝内经'},
    {type:'diet',text:'卯时(5-7点)大肠经当令，宜排宿便，饮温水一杯',source:'黄帝内经'},
    {type:'exercise',text:'晨间宜轻度运动如八段锦、散步，忌剧烈运动',source:'养生论'},
    {type:'mood',text:'晨起保持心情愉悦，有助肝气疏泄',source:'遵生八笺'},
    {type:'sleep',text:'早起顺应阳气生发，不宜赖床',source:'黄帝内经'}
  ],
  afternoon: [
    {type:'diet',text:'午时(11-13点)心经当令，午餐宜七分饱，饭后小憩',source:'黄帝内经'},
    {type:'work',text:'未时(13-15点)小肠经当令，宜工作学习，效率最高',source:'黄帝内经'},
    {type:'exercise',text:'申时(15-17点)膀胱经当令，宜饮水运动',source:'黄帝内经'},
    {type:'diet',text:'下午茶宜选坚果、水果，忌高糖零食',source:'你是你吃出来的'},
    {type:'work',text:'久坐后起身活动，做眼保健操',source:'久坐急救运动'}
  ],
  evening: [
    {type:'diet',text:'酉时(17-19点)肾经当令，晚餐宜清淡，七分饱',source:'黄帝内经'},
    {type:'sleep',text:'戌时(19-21点)心包经当令，宜放松身心，准备入睡',source:'黄帝内经'},
    {type:'exercise',text:'亥时(21-23点)三焦经当令，宜泡脚按摩',source:'遵生八笺'},
    {type:'mood',text:'睡前静心，避免情绪波动',source:'老老恒言'},
    {type:'sleep',text:'亥时入睡最佳，利于胆经排毒',source:'黄帝内经'}
  ]
};

const BODY_CLOCK = [
  {time:'23:00-01:00',name:'子时',organ:'胆经',desc:'胆经当令，宜深睡，养胆气'},
  {time:'01:00-03:00',name:'丑时',organ:'肝经',desc:'肝经当令，宜熟睡，养肝血'},
  {time:'03:00-05:00',name:'寅时',organ:'肺经',desc:'肺经当令，宜深睡，养肺气'},
  {time:'05:00-07:00',name:'卯时',organ:'大肠经',desc:'大肠经当令，宜排便，饮温水'},
  {time:'07:00-09:00',name:'辰时',organ:'胃经',desc:'胃经当令，宜食早餐，温养脾胃'},
  {time:'09:00-11:00',name:'巳时',organ:'脾经',desc:'脾经当令，宜工作，脾主运化'},
  {time:'11:00-13:00',name:'午时',organ:'心经',desc:'心经当令，宜小憩，养心神'},
  {time:'13:00-15:00',name:'未时',organ:'小肠经',desc:'小肠经当令，宜工作，分清泌浊'},
  {time:'15:00-17:00',name:'申时',organ:'膀胱经',desc:'膀胱经当令，宜运动，排尿排毒'},
  {time:'17:00-19:00',name:'酉时',organ:'肾经',desc:'肾经当令，宜晚餐，补肾藏精'},
  {time:'19:00-21:00',name:'戌时',organ:'心包经',desc:'心包经当令，宜放松，护心脏'},
  {time:'21:00-23:00',name:'亥时',organ:'三焦经',desc:'三焦经当令，宜入睡，通百脉'}
];

const EMOTION_DATA = {
  quotes: [
    {text:'恬淡虚无，真气从之，精神内守，病安从来。',source:'黄帝内经'},
    {text:'怒伤肝，喜伤心，思伤脾，忧伤肺，恐伤肾。',source:'黄帝内经'},
    {text:'志闲而少欲，心安而不惧，形劳而不倦。',source:'黄帝内经'},
    {text:'是以圣人为无为之事，乐恬淡之能，从欲快志于虚无之守。',source:'黄帝内经'},
    {text:'高下不相慕，其民故曰朴。',source:'黄帝内经'}
  ],
  exercises: [
    {name:'呼吸调息',desc:'深呼吸6次，吸气4秒-屏息4秒-呼气6秒',emoji:'🫁'},
    {name:'正念冥想',desc:'静坐5分钟，专注呼吸，不评判念头',emoji:'🧘'},
    {name:'情志相胜',desc:'怒伤肝悲胜怒，喜伤心恐胜喜，思伤脾怒胜思',emoji:'⚖️'},
    {name:'音乐疗法',desc:'听宫调音乐(脾)、角调音乐(肝)调理情志',emoji:'🎵'},
    {name:'书写宣泄',desc:'将情绪写在纸上然后撕掉，释放压力',emoji:'📝'}
  ]
};

const WULAO_DATA = [
  {name:'久视伤血',organ:'肝',symptom:'眼睛干涩、视物模糊、头晕',solution:'每20分钟远眺20秒，闭目养神，做眼保健操'},
  {name:'久卧伤气',organ:'肺',symptom:'乏力、气短、精神萎靡',solution:'睡眠时间7-8小时，避免白天长时间卧床'},
  {name:'久坐伤肉',organ:'脾',symptom:'肌肉松弛、消化不良、肥胖',solution:'每小时起身活动5分钟，做拉伸运动'},
  {name:'久立伤骨',organ:'肾',symptom:'腰膝酸软、足跟痛、骨质疏松',solution:'避免长时间站立，适当走动，穿舒适鞋子'},
  {name:'久行伤筋',organ:'肝',symptom:'小腿酸痛、足底筋膜炎、关节损伤',solution:'控制步行量，穿运动鞋，泡脚放松'}
];

const CONSTITUTION_TYPES = [
  {id:'pinghe',name:'平和质',emoji:'😊',color:'#7CB69D',desc:'阴阳气血调和，体态适中，面色红润，精力充沛。',advice:'继续保持，注意劳逸结合，饮食均衡。',habits:['early_rise','morning_run','breakfast','walk','reading','meditation','early_sleep']},
  {id:'qixu',name:'气虚质',emoji:'😮‍💨',color:'#F4A683',desc:'元气不足，容易疲乏，气短懒言，出汗多。',advice:'宜食用黄芪、山药、红枣等补气食物，避免过度劳累。',habits:['early_rise','breakfast','breathe','walk','foot_bath','early_sleep','less_sit']},
  {id:'yangxu',name:'阳虚质',emoji:'❄️',color:'#A8D8EA',desc:'阳气不足，畏寒怕冷，手足不温，喜热饮食。',advice:'宜温补，食用羊肉、生姜、桂圆，忌生冷。',habits:['sunshine','foot_bath','warm_water','early_sleep','breakfast','walk']},
  {id:'yinxu',name:'阴虚质',emoji:'🔥',color:'#F4E04D',desc:'阴液亏少，口燥咽干，手足心热，易失眠。',advice:'宜滋阴润燥，食用银耳、百合、梨，忌辛辣。',habits:['meditation','reading','early_sleep','cool_drink','yoga']},
  {id:'tanshi',name:'痰湿质',emoji:'💧',color:'#C7CEEA',desc:'痰湿凝聚，形体肥胖，腹部肥满，口黏苔腻。',advice:'宜清淡饮食，少食甜腻，多运动排湿。',habits:['walk','healthy_diet','water','less_sit','exercise','early_sleep']},
  {id:'shire',name:'湿热质',emoji:'🌡️',color:'#F8B500',desc:'湿热内蕴，面垢油光，易生痤疮，口苦口干。',advice:'宜清热利湿，食用绿豆、苦瓜、冬瓜，忌辛辣油腻。',habits:['water','healthy_diet','exercise','cool_drink','early_sleep']},
  {id:'xueyu',name:'血瘀质',emoji:'🩸',color:'#D4A5A5',desc:'血行不畅，肤色晦暗，易有瘀斑，舌质紫暗。',advice:'宜活血化瘀，食用山楂、玫瑰花、黑木耳，适量运动。',habits:['walk','exercise','foot_bath','healthy_diet','meditation']},
  {id:'qiyu',name:'气郁质',emoji:'😔',color:'#B5EAD7',desc:'气机郁滞，闷闷不乐，多愁善感，易失眠。',advice:'宜疏肝解郁，多与人交流，适量运动，保持心情舒畅。',habits:['meditation','reading','walk','sunshine','social','exercise']},
  {id:'tebing',name:'特禀质',emoji:'🤧',color:'#B8B8D1',desc:'先天失常，过敏体质，易荨麻疹、哮喘、花粉症。',advice:'避免接触过敏原，饮食清淡，增强体质，注意季节变化。',habits:['early_rise','breakfast','walk','sunshine','healthy_diet','vitamin']}
];

/* 王琦九种体质辨识量表（标准版67题） */
const OPTS = [
  {text:'没有(根本不会)',score:1},
  {text:'很少(有一点)',score:2},
  {text:'有时(有些)',score:3},
  {text:'经常(相当)',score:4},
  {text:'总是(非常)',score:5}
];

const CONSTITUTION_QUIZ = [
  /* ========== 一、阳虚质（Q1-Q7） ========== */
  {type:'yangxu',num:1,question:'您手脚发凉吗？',options:[...OPTS]},
  {type:'yangxu',num:2,question:'您胃脘部、背部或腰膝部怕冷吗？',options:[...OPTS]},
  {type:'yangxu',num:3,question:'您感到怕冷、衣服比别人穿得多吗？',options:[...OPTS]},
  {type:'yangxu',num:4,question:'您比一般人受不了寒冷（冬天的寒冷，夏天的冷空调、电扇等）吗？',options:[...OPTS]},
  {type:'yangxu',num:5,question:'您比别人容易患感冒吗？',options:[...OPTS]},
  {type:'yangxu',num:6,question:'您吃（喝）凉的东西会感到不舒服或者怕吃（喝）凉东西吗？',options:[...OPTS]},
  {type:'yangxu',num:7,question:'您受凉或吃（喝）凉的东西后容易腹泻（拉肚子）吗？',options:[...OPTS]},

  /* ========== 二、阴虚质（Q8-Q15） ========== */
  {type:'yinxu',num:8,question:'您感到手脚心发热吗？',options:[...OPTS]},
  {type:'yinxu',num:9,question:'您感觉身体、脸上发热吗？',options:[...OPTS]},
  {type:'yinxu',num:10,question:'您皮肤或口唇干吗？',options:[...OPTS]},
  {type:'yinxu',num:11,question:'您口唇的颜色比一般人红吗？',options:[...OPTS]},
  {type:'yinxu',num:12,question:'您容易便秘或大便干燥吗？',options:[...OPTS]},
  {type:'yinxu',num:13,question:'您面部两颧潮红或偏红吗？',options:[...OPTS]},
  {type:'yinxu',num:14,question:'您感到眼睛干涩吗？',options:[...OPTS]},
  {type:'yinxu',num:15,question:'您活动量稍大就容易出虚汗吗？',options:[...OPTS]},

  /* ========== 三、气虚质（Q16-Q23） ========== */
  {type:'qixu',num:16,question:'您容易疲乏吗？',options:[...OPTS]},
  {type:'qixu',num:17,question:'您容易气短（呼吸短促，接不上气）吗？',options:[...OPTS]},
  {type:'qixu',num:18,question:'您容易心慌吗？',options:[...OPTS]},
  {type:'qixu',num:19,question:'您容易头晕或站起时晕眩吗？',options:[...OPTS]},
  {type:'qixu',num:20,question:'您比别人容易患感冒吗？',options:[...OPTS]},
  {type:'qixu',num:21,question:'您喜欢安静、懒得说话吗？',options:[...OPTS]},
  {type:'qixu',num:22,question:'您说话声音无力吗？',options:[...OPTS]},
  {type:'qixu',num:23,question:'您活动量稍大就容易出虚汗吗？',options:[...OPTS]},

  /* ========== 四、痰湿质（Q24-Q31） ========== */
  {type:'tanshi',num:24,question:'您感到胸闷或腹部胀满吗？',options:[...OPTS]},
  {type:'tanshi',num:25,question:'您感到身体不轻松或不爽快吗？',options:[...OPTS]},
  {type:'tanshi',num:26,question:'您腹部肥满松软吗？',options:[...OPTS]},
  {type:'tanshi',num:27,question:'您有额部油脂分泌多的现象吗？',options:[...OPTS]},
  {type:'tanshi',num:28,question:'您上眼睑比别人肿（有轻微隆起）吗？',options:[...OPTS]},
  {type:'tanshi',num:29,question:'您嘴里有黏黏的感觉吗？',options:[...OPTS]},
  {type:'tanshi',num:30,question:'您平时痰多，特别是咽喉部总感到有痰堵着吗？',options:[...OPTS]},
  {type:'tanshi',num:31,question:'您舌苔厚腻或有舌苔厚厚的感觉吗？',options:[...OPTS]},

  /* ========== 五、湿热质（Q32-Q37） ========== */
  {type:'shire',num:32,question:'您面部或鼻部有油腻感或者油亮发光吗？',options:[...OPTS]},
  {type:'shire',num:33,question:'您容易生痤疮或疮疖吗？',options:[...OPTS]},
  {type:'shire',num:34,question:'您感到口苦或嘴里有异味吗？',options:[...OPTS]},
  {type:'shire',num:35,question:'您大便黏滞不爽、有解不尽的感觉吗？',options:[...OPTS]},
  {type:'shire',num:36,question:'您小便时尿道有发热感、尿色浓（深）吗？',options:[...OPTS]},
  {type:'shire',num:37,gender:'female',question:'您带下色黄（白带颜色发黄）吗？（限女性回答）',options:[...OPTS]},
  {type:'shire',num:38,gender:'male',question:'您阴囊潮湿吗？（限男性回答）',options:[...OPTS]},

  /* ========== 六、血瘀质（Q39-Q45） ========== */
  {type:'xueyu',num:39,question:'您的皮肤在不知不觉中会出现青紫瘀斑（皮下出血）吗？',options:[...OPTS]},
  {type:'xueyu',num:40,question:'您两颧部有细微红丝吗？',options:[...OPTS]},
  {type:'xueyu',num:41,question:'您身体上有哪里疼痛吗？',options:[...OPTS]},
  {type:'xueyu',num:42,question:'您面色晦黯或容易出现褐斑吗？',options:[...OPTS]},
  {type:'xueyu',num:43,question:'您容易有黑眼圈吗？',options:[...OPTS]},
  {type:'xueyu',num:44,question:'您容易忘事（健忘）吗？',options:[...OPTS]},
  {type:'xueyu',num:45,question:'您口唇颜色偏黯吗？',options:[...OPTS]},

  /* ========== 七、特禀质（Q46-Q52） ========== */
  {type:'tebing',num:46,question:'您没有感冒时也会打喷嚏吗？',options:[...OPTS]},
  {type:'tebing',num:47,question:'您没有感冒时也会鼻塞、流鼻涕吗？',options:[...OPTS]},
  {type:'tebing',num:48,question:'您有因季节变化、温度变化或异味等原因而咳喘的现象吗？',options:[...OPTS]},
  {type:'tebing',num:49,question:'您容易过敏（对药物、食物、气味、花粉或在季节交替、气候变化时）吗？',options:[...OPTS]},
  {type:'tebing',num:50,question:'您的皮肤容易起荨麻疹（风团、风疹块、风疙瘩）吗？',options:[...OPTS]},
  {type:'tebing',num:51,question:'您因过敏出现过紫癜（紫红色瘀点、瘀斑）吗？',options:[...OPTS]},
  {type:'tebing',num:52,question:'您的皮肤一抓就红，并出现抓痕吗？',options:[...OPTS]},

  /* ========== 八、气郁质（Q53-Q59） ========== */
  {type:'qiyu',num:53,question:'您感到闷闷不乐吗？',options:[...OPTS]},
  {type:'qiyu',num:54,question:'您容易精神紧张、焦虑不安吗？',options:[...OPTS]},
  {type:'qiyu',num:55,question:'您多愁善感、感情脆弱吗？',options:[...OPTS]},
  {type:'qiyu',num:56,question:'您容易感到害怕或受到惊吓吗？',options:[...OPTS]},
  {type:'qiyu',num:57,question:'您胁肋部或乳房胀痛吗？',options:[...OPTS]},
  {type:'qiyu',num:58,question:'您无缘无故叹气吗？',options:[...OPTS]},
  {type:'qiyu',num:59,question:'您咽喉部有异物感，且吐之不出、咽之不下吗？',options:[...OPTS]},

  /* ========== 九、平和质（Q60-Q67，反向计分） ========== */
  {type:'pinghe',num:60,question:'您精力充沛吗？',reverse:true,options:[
    {text:'精力充沛',score:5},
    {text:'比较充沛',score:4},
    {text:'一般',score:3},
    {text:'比较容易疲乏',score:2},
    {text:'非常容易疲乏',score:1}
  ]},
  {type:'pinghe',num:61,question:'您能适应外界自然环境和社会环境的变化吗？',reverse:true,options:[
    {text:'能适应',score:5},
    {text:'比较能适应',score:4},
    {text:'一般',score:3},
    {text:'比较不能适应',score:2},
    {text:'不能适应',score:1}
  ]},
  {type:'pinghe',num:62,question:'您能耐受寒冷吗？',reverse:true,options:[
    {text:'能耐受',score:5},
    {text:'比较能耐受',score:4},
    {text:'一般',score:3},
    {text:'比较不能耐受',score:2},
    {text:'不能耐受',score:1}
  ]},
  {type:'pinghe',num:63,question:'您能耐受炎热吗？',reverse:true,options:[
    {text:'能耐受',score:5},
    {text:'比较能耐受',score:4},
    {text:'一般',score:3},
    {text:'比较不能耐受',score:2},
    {text:'不能耐受',score:1}
  ]},
  {type:'pinghe',num:64,question:'您睡眠良好吗？',reverse:true,options:[
    {text:'睡眠好',score:5},
    {text:'比较好',score:4},
    {text:'一般',score:3},
    {text:'比较差',score:2},
    {text:'很差',score:1}
  ]},
  {type:'pinghe',num:65,question:'您二便正常吗？',reverse:true,options:[
    {text:'正常',score:5},
    {text:'比较正常',score:4},
    {text:'一般',score:3},
    {text:'比较不正常',score:2},
    {text:'很不正常',score:1}
  ]},
  {type:'pinghe',num:66,question:'您舌苔薄白吗？',reverse:true,options:[
    {text:'舌苔薄白',score:5},
    {text:'比较薄白',score:4},
    {text:'一般',score:3},
    {text:'比较厚腻',score:2},
    {text:'很厚腻',score:1}
  ]},
  {type:'pinghe',num:67,question:'您容易忘事（健忘）吗？',reverse:true,options:[
    {text:'不容易忘事',score:5},
    {text:'比较不容易忘事',score:4},
    {text:'有时容易忘事',score:3},
    {text:'比较容易忘事',score:2},
    {text:'非常容易忘事',score:1}
  ]}
];

/* ========== 快筛版：10题（约1分钟） ========== */
const CONSTITUTION_QUICK_QUIZ = [
  {type:'yangxu',question:'您手脚发凉、怕冷吗？',options:[...OPTS]},
  {type:'yinxu',question:'您感到手脚心发热、口干咽燥吗？',options:[...OPTS]},
  {type:'qixu',question:'您容易疲乏、气短懒言吗？',options:[...OPTS]},
  {type:'tanshi',question:'您体型偏胖、腹部肥满、舌苔厚腻吗？',options:[...OPTS]},
  {type:'shire',question:'您面部油腻、易生痤疮、口苦口干吗？',options:[...OPTS]},
  {type:'xueyu',question:'您肤色晦暗、易有黑眼圈或瘀斑吗？',options:[...OPTS]},
  {type:'qiyu',question:'您容易闷闷不乐、多愁善感吗？',options:[...OPTS]},
  {type:'tebing',question:'您容易过敏（食物、花粉、药物等）吗？',options:[...OPTS]},
  {type:'pinghe',question:'您精力充沛、不容易疲乏吗？',reverse:true,options:[
    {text:'精力充沛',score:5},
    {text:'比较充沛',score:4},
    {text:'一般',score:3},
    {text:'比较容易疲乏',score:2},
    {text:'非常容易疲乏',score:1}
  ]},
  {type:'pinghe',question:'您适应外界环境变化的能力好吗？',reverse:true,options:[
    {text:'很好',score:5},
    {text:'比较好',score:4},
    {text:'一般',score:3},
    {text:'比较差',score:2},
    {text:'很差',score:1}
  ]}
];

/* ========== 标准版：30题（约3分钟） ========== */
const CONSTITUTION_STD_QUIZ = [
  /* 阳虚质 3题 */
  {type:'yangxu',question:'您手脚发凉吗？',options:[...OPTS]},
  {type:'yangxu',question:'您胃脘部、背部或腰膝部怕冷吗？',options:[...OPTS]},
  {type:'yangxu',question:'您吃（喝）凉的东西会感到不舒服吗？',options:[...OPTS]},
  /* 阴虚质 3题 */
  {type:'yinxu',question:'您感到手脚心发热吗？',options:[...OPTS]},
  {type:'yinxu',question:'您皮肤或口唇干吗？',options:[...OPTS]},
  {type:'yinxu',question:'您容易便秘或大便干燥吗？',options:[...OPTS]},
  /* 气虚质 3题 */
  {type:'qixu',question:'您容易疲乏吗？',options:[...OPTS]},
  {type:'qixu',question:'您容易气短（呼吸短促）吗？',options:[...OPTS]},
  {type:'qixu',question:'您比别人容易患感冒吗？',options:[...OPTS]},
  /* 痰湿质 3题 */
  {type:'tanshi',question:'您腹部肥满松软吗？',options:[...OPTS]},
  {type:'tanshi',question:'您嘴里有黏黏的感觉吗？',options:[...OPTS]},
  {type:'tanshi',question:'您平时痰多，咽喉部总有痰堵着吗？',options:[...OPTS]},
  /* 湿热质 3题 */
  {type:'shire',question:'您面部或鼻部有油腻感吗？',options:[...OPTS]},
  {type:'shire',question:'您容易生痤疮或疮疖吗？',options:[...OPTS]},
  {type:'shire',question:'您感到口苦或嘴里有异味吗？',options:[...OPTS]},
  /* 血瘀质 3题 */
  {type:'xueyu',question:'您的皮肤会出现青紫瘀斑吗？',options:[...OPTS]},
  {type:'xueyu',question:'您面色晦黯或容易出现褐斑吗？',options:[...OPTS]},
  {type:'xueyu',question:'您口唇颜色偏黯吗？',options:[...OPTS]},
  /* 气郁质 3题 */
  {type:'qiyu',question:'您感到闷闷不乐吗？',options:[...OPTS]},
  {type:'qiyu',question:'您容易精神紧张、焦虑不安吗？',options:[...OPTS]},
  {type:'qiyu',question:'您咽喉部有异物感，吐之不出、咽之不下吗？',options:[...OPTS]},
  /* 特禀质 3题 */
  {type:'tebing',question:'您容易过敏（对药物、食物、气味、花粉等）吗？',options:[...OPTS]},
  {type:'tebing',question:'您的皮肤容易起荨麻疹吗？',options:[...OPTS]},
  {type:'tebing',question:'您没有感冒时也会鼻塞、流鼻涕吗？',options:[...OPTS]},
  /* 平和质 3题（反向计分） */
  {type:'pinghe',question:'您精力充沛吗？',reverse:true,options:[
    {text:'精力充沛',score:5},
    {text:'比较充沛',score:4},
    {text:'一般',score:3},
    {text:'比较容易疲乏',score:2},
    {text:'非常容易疲乏',score:1}
  ]},
  {type:'pinghe',question:'您能适应外界环境变化吗？',reverse:true,options:[
    {text:'能适应',score:5},
    {text:'比较能适应',score:4},
    {text:'一般',score:3},
    {text:'比较不能适应',score:2},
    {text:'不能适应',score:1}
  ]},
  {type:'pinghe',question:'您睡眠质量好吗？',reverse:true,options:[
    {text:'很好',score:5},
    {text:'比较好',score:4},
    {text:'一般',score:3},
    {text:'比较差',score:2},
    {text:'很差',score:1}
  ]}
];

const GUIDE_STEPS = [
  { emoji: '🌿', title: '欢迎使用生活习惯小助手', text: '基于《黄帝内经》的AI养生习惯追踪应用，让千年中医智慧融入日常生活。' },
  { emoji: '🩺', title: '先测体质，个性化推荐', text: '通过8道简单问题，辨识你的中医体质类型，获取专属养生习惯推荐。' },
  { emoji: '📦', title: '从黄帝内经习惯包开始', text: '一键导入四季养生、五色饮食、情志调理等经典养生习惯，零基础入门。' }
];

if (!window.App) window.App = {};
if (!App.Data) App.Data = {};

App.Data.QUOTES = QUOTES;
App.Data.REF_BOOKS = REF_BOOKS;
App.Data.HEALTH_TIPS = HEALTH_TIPS;
App.Data.BODY_CLOCK = BODY_CLOCK;
App.Data.EMOTION_DATA = EMOTION_DATA;
App.Data.WULAO_DATA = WULAO_DATA;
App.Data.CONSTITUTION_TYPES = CONSTITUTION_TYPES;
App.Data.CONSTITUTION_QUIZ = CONSTITUTION_QUIZ;
App.Data.CONSTITUTION_QUICK_QUIZ = CONSTITUTION_QUICK_QUIZ;
App.Data.CONSTITUTION_STD_QUIZ = CONSTITUTION_STD_QUIZ;
App.Data.GUIDE_STEPS = GUIDE_STEPS;

if (App.registerModule) {
  App.registerModule('data.content', 'data', null);
}
