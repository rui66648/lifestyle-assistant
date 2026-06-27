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
  {name:'《睡眠革命》',author:'现代 · Nick Littlehales',type:'modern',emoji:'🌙',desc:'R90睡眠方案与现代睡眠科学',url:'https://rui66648.github.io/lifestyle-assistant/references/睡眠革命/睡眠革命.html'},
  {name:'《运动改造大脑》',author:'现代 · John Ratey',type:'modern',emoji:'🧠',desc:'运动与脑科学',url:'https://rui66648.github.io/lifestyle-assistant/references/运动改造大脑/运动改造大脑.html'},
  {name:'《正念的奇迹》',author:'现代 · 一行禅师',type:'modern',emoji:'🧘',desc:'正念冥想与身心疗愈',url:'https://rui66648.github.io/lifestyle-assistant/references/正念的奇迹/正念的奇迹.html'},
  {name:'《抗炎生活》',author:'现代 · 池谷敏郎',type:'modern',emoji:'🔥',desc:'慢性炎症与现代疾病预防',url:'https://rui66648.github.io/lifestyle-assistant/references/抗炎生活/抗炎生活.html'},
  {name:'《肠子的小心思》',author:'现代 · 朱莉娅·恩德斯',type:'modern',emoji:'🦠',desc:'肠道菌群与健康',url:'https://rui66648.github.io/lifestyle-assistant/references/肠子的小心思/肠子的小心思.html'},
  {name:'《深度营养》',author:'现代 · 凯瑟琳·沙纳汉',type:'modern',emoji:'🥑',desc:'传统饮食智慧与现代营养学',url:'https://rui66648.github.io/lifestyle-assistant/references/深度营养/深度营养.html'},
  {name:'《控糖革命》',author:'现代 · 杰西·安佐斯佩',type:'modern',emoji:'🍬',desc:'血糖管理与健康饮食',url:'https://rui66648.github.io/lifestyle-assistant/references/控糖革命/控糖革命.html'},
  {name:'《端粒效应》',author:'现代 · 伊丽莎白·布莱克本',type:'modern',emoji:'🧬',desc:'端粒科学与抗衰老',url:'https://rui66648.github.io/lifestyle-assistant/references/端粒效应/端粒效应.html'},
  {name:'《人体运动生理学》',author:'现代 · 运动科学',type:'modern',emoji:'🏃',desc:'能量代谢与运动系统适应',url:'https://rui66648.github.io/lifestyle-assistant/references/人体运动生理学/人体运动生理学.html'},
  {name:'《高级运动营养学》',author:'现代 · 营养科学',type:'modern',emoji:'🥩',desc:'周期化营养与补剂科学',url:'https://rui66648.github.io/lifestyle-assistant/references/高级运动营养学/高级运动营养学.html'},
  {name:'《力量训练基础》',author:'现代 · 力量训练',type:'modern',emoji:'🏋️',desc:'训练原则与周期化模型',url:'https://rui66648.github.io/lifestyle-assistant/references/力量训练基础/力量训练基础.html'},
  {name:'《运动医学与康复》',author:'现代 · 运动医学',type:'modern',emoji:'🩺',desc:'损伤预防与康复方案',url:'https://rui66648.github.io/lifestyle-assistant/references/运动医学与康复/运动医学与康复.html'}
];

const HEALTH_TIPS = [
  {habit:'morning_run',text:'晨跑30分钟，提升一整天的精力和专注力。',source:'广步于庭，被发缓形，以使志生。--《素问·四气调神大论》',refBook:'黄帝内经'},
  {habit:'early_rise',text:'规律作息，早睡早起，让生物钟保持稳定。',source:'法于阴阳，和于术数，食饮有节，起居有常，不妄作劳。--《素问·上古天真论》',refBook:'黄帝内经'},
  {habit:'reading',text:'每天阅读20分钟，一年可以读完20本书。',source:'嗜欲不能劳其目，淫邪不能惑其心。--《素问·上古天真论》',refBook:'黄帝内经'},
  {habit:'meditation',text:'冥想5分钟就能显著降低焦虑水平。',source:'恬惔虚无，真气从之，精神内守，病安从来。--《素问·上古天真论》',refBook:'黄帝内经'},
  {habit:'early_sleep',text:'晚上11点前入睡，让身体充分修复。',source:'子时胆经当令，凡十一脏取决于胆。--《子午流注》',refBook:'黄帝内经'},
  {habit:'breakfast',text:'营养均衡的早餐是一天能量的基础。',source:'辰时胃经最活跃，必须吃早餐。--《子午流注》',refBook:'黄帝内经'},
  {habit:'walk',text:'饭后散步15分钟，有助于消化和血糖控制。',source:'广步于庭，以缓其形。--《素问·四气调神大论》',refBook:'黄帝内经'},
  {habit:'breathe',text:'深呼吸练习可以激活副交感神经，缓解压力。',source:'和于术数，导引吐纳。--《素问·上古天真论》',refBook:'黄帝内经'},
  {habit:'strength',text:'力量训练不仅塑形，还能增强骨密度。',source:'志闲而少欲，心安而不惧，形劳而不倦。--《素问·上古天真论》',refBook:'黄帝内经'},
  {habit:'yoga',text:'瑜伽改善柔韧性，同时锻炼身心平衡。',source:'不妄作劳，故能形与神俱。--《素问·上古天真论》',refBook:'黄帝内经'},
  {habit:'skincare',text:'坚持护肤习惯，皮肤状态会肉眼可见地改善。',source:'肺主皮毛，白当肺。--《素问·五脏生成篇》',refBook:'黄帝内经'},
  {habit:'diary',text:'写日记是很好的情绪管理和自我反思方式。',source:'志闲而少欲，心安而不惧，形劳而不倦。--《素问·上古天真论》',refBook:'黄帝内经'},
  {habit:'foot_bath',text:'睡前泡脚15分钟，促进血液循环，改善睡眠质量。',source:'冬三月，此谓闭藏，水冰地坼，无扰乎阳。早卧晚起，必待日光，去寒就温，无泄皮肤。--《素问·四气调神大论》',refBook:'黄帝内经'},
  {habit:'daily_water',text:'成年人每天建议饮水1500-2000ml（约8杯），少量多次。起床后空腹喝一杯温水（200-300ml），促进肠胃蠕动和代谢。',source:'食饮有节，谨和五味；卯时大肠经当令，起床饮温水。--《素问·上古天真论》《子午流注》',refBook:'黄帝内经'},
  {habit:'healthy_diet',text:'均衡饮食是健康的基石，每天摄入12种以上食物。',source:'五谷为养，五果为助，五畜为益，五菜为充。--《素问·藏气法时论》',refBook:'黄帝内经'},
  {habit:'less_sit',text:'每坐45分钟站起来活动5分钟，保护腰椎。',source:'久视伤血，久卧伤气，久坐伤肉，久立伤骨，久行伤筋。--《素问·宣明五气篇》',refBook:'黄帝内经'},
  {habit:'eye_rest',text:'每用眼20分钟远眺20秒，保护视力。',source:'久视伤血，久卧伤气，久坐伤肉，久立伤骨，久行伤筋。--《素问·宣明五气篇》',refBook:'黄帝内经'},
  {habit:'good_posture',text:'保持正确坐姿，减少颈椎压力。',source:'形正则气顺。--《遵生八笺》',refBook:'遵生八笺'},
  {habit:'sunshine',text:'每天晒太阳15-20分钟，促进阳气生发。',source:'夏三月，此谓蕃秀，天地气交，万物华实。夜卧早起，无厌于日，使志无怒，使华英成秀。--《素问·四气调神大论》',refBook:'黄帝内经'},
  {habit:'vitamin',text:'秋冬注意补充维生素D和钙质。',source:'冬三月，此谓闭藏，水冰地坼，无扰乎阳。早卧晚起，必待日光，去寒就温，无泄皮肤。--《素问·四气调神大论》',refBook:'黄帝内经'},
  {habit:'fruits_veggies',text:'每天摄入300-500克蔬菜，降低慢性病风险。',source:'五谷为养，五果为助，五畜为益，五菜为充。--《素问·藏气法时论》',refBook:'黄帝内经'},
  {habit:'jump_rope',text:'跳绳10分钟消耗的热量相当于慢跑30分钟。',source:'夫四时阴阳者，万物之根本也。春夏养阳，秋冬养阴，以从其根。--《素问·四气调神大论》',refBook:'黄帝内经'},
  {habit:'stretch',text:'办公室拉伸5分钟，缓解肩颈僵硬和腰背酸痛。',source:'导引按跷，以通经气。--《黄帝内经》',refBook:'拉伸'},
  {habit:'sleep_quality',text:'右侧卧睡，屈右臂，头枕左手，安眠养神。',source:'屈膝侧卧，益人气力。--《老老恒言》',refBook:'老老恒言'},
  {habit:'acupressure',text:'每日按揉足三里、合谷穴各3分钟，调理脾胃。',source:'胃病者，胃脘当心而痛，上支两胁。--《灵枢》',refBook:'求医不如求己'},
  {habit:'emotion',text:'怒伤肝，悲伤肺，思伤脾，恐伤肾。保持情绪平和。',source:'怒伤肝，悲胜怒；喜伤心，恐胜喜；思伤脾，怒胜思；忧伤肺，喜胜忧；恐伤肾，思胜恐。--《素问·阴阳应象大论》',refBook:'黄帝内经'},
  {habit:'rest',text:'主动休息比被动休息更有效，每90分钟休息15分钟。',source:'久视伤血，久卧伤气，久坐伤肉，久立伤骨，久行伤筋。--《素问·宣明五气篇》',refBook:'科学休息'},
  {habit:'constitution',text:'了解自己的体质类型，针对性调理饮食和运动。',source:'阴阳和平之人，其骨直以和。--《灵枢·通天》',refBook:'九种体质养生全书'},
  {habit:'food_therapy',text:'食物是最好的药物，合理搭配可预防疾病。',source:'五谷为养，五果为助，五畜为益，五菜为充。--《素问·藏气法时论》',refBook:'饮膳正要'},
  {habit:'mind',text:'养生先养心，心为五脏六腑之大主。',source:'心者，君主之官也，神明出焉。--《素问·灵兰秘典论》',refBook:'闲情偶寄'},
  {habit:'longevity',text:'不伤为本，积微成损，养生在于日常点滴。',source:'善养生者，不伤为本。--《抱朴子》',refBook:'抱朴子'},
  {habit:'five_viscera',text:'五脏养生各有法：肝苦急，急食甘以缓之。',source:'五谷为养，五果为助，五畜为益，五菜为充。--《素问·藏气法时论》',refBook:'寿世青编'},
  {habit:'medicine',text:'大医精诚，养性之道在于日常修身。',source:'安生之本，必资于食。--《备急千金要方》',refBook:'备急千金要方'},
  {habit:'body_form',text:'形神相亲，养生贵在形神兼养。',source:'精神之于形骸，犹国之有君也。--《养生论》',refBook:'养生论'},
  {habit:'sleep_quality',text:'R90睡眠方案：以90分钟为一个睡眠周期，每晚睡4-5个周期即可。',source:'不是睡够8小时，而是睡够睡眠周期。--《睡眠革命》',refBook:'睡眠革命'},
  {habit:'morning_run',text:'有氧运动30分钟可提升脑源性神经营养因子(BDNF)，改善记忆力和情绪。',source:'运动是最接近万能药的东西。--《运动改造大脑》',refBook:'运动改造大脑'},
  {habit:'meditation',text:'正念呼吸7分钟就能降低皮质醇水平，效果堪比一次短暂休假。',source:'呼吸是连接身与心的桥梁。--《正念的奇迹》',refBook:'正念的奇迹'},
  {habit:'healthy_diet',text:'控糖的关键不是少吃甜食，而是改变进食顺序：先吃蔬菜→再吃蛋白质→最后吃碳水。',source:'正确的进食顺序能降低血糖峰值73%。--《控糖革命》',refBook:'控糖革命'},
  {habit:'fruits_veggies',text:'每天摄入30种不同植物性食物，肠道菌群多样性可提升40%。',source:'肠道是人体的第二个大脑。--《肠子的小心思》',refBook:'肠子的小心思'},
  {habit:'foot_bath',text:'慢性炎症是万病之源，通过饮食、运动、睡眠三管齐下可有效降低体内炎症水平。',source:'90%的慢性病都与慢性炎症有关。--《抗炎生活》',refBook:'抗炎生活'},
  {habit:'daily_water',text:'细胞需要优质油脂（如橄榄油、鱼油）和天然电解质，而非单纯的低脂饮食。',source:'现代营养学正在回归传统饮食智慧。--《深度营养》',refBook:'深度营养'},
  {habit:'early_sleep',text:'慢性压力会加速端粒缩短，冥想和正念可显著延缓细胞衰老速度。',source:'端粒长度决定细胞寿命。--《端粒效应》',refBook:'端粒效应'},
  {habit:'breathe',text:'现代人最常见的亚健康状态是"上热下寒"，需要通过调整饮食和作息来恢复阴阳平衡。',source:'《黄帝内经》的核心是教人如何顺应自然节律生活。--《黄帝内经说什么》',refBook:'黄帝内经说什么'},
  {habit:'reading',text:'每周150分钟中等强度运动，可将阿尔茨海默病风险降低45%。',source:'运动是对大脑最好的投资。--《运动改造大脑》',refBook:'运动改造大脑'},
  {habit:'sunshine',text:'早晨接触自然光10分钟，可调节褪黑素分泌，改善夜间睡眠质量。',source:'光线是调节生物钟最重要的信号。--《睡眠革命》',refBook:'睡眠革命'},
  {habit:'emotion',text:'正念练习8周可改变大脑结构，前额叶皮层增厚，杏仁核缩小。',source:'每一刻的觉察都是奇迹。--《正念的奇迹》',refBook:'正念的奇迹'},
  {habit:'less_sit',text:'久坐1小时，寿命缩短22分钟。每30分钟起身活动2分钟即可抵消久坐危害。',source:'久坐是最接近吸烟的健康杀手。--《运动改造大脑》',refBook:'运动改造大脑'},
  {habit:'vitamin',text:'Omega-3脂肪酸可降低体内炎症标志物C反应蛋白水平达30%。',source:'好的油脂是抗炎的关键。--《抗炎生活》',refBook:'抗炎生活'},
  {habit:'stretch',text:'肠道菌群影响情绪和认知，益生菌补充可改善焦虑和抑郁症状。',source:'肠道被称为"第二大脑"。--《肠子的小心思》',refBook:'肠子的小心思'},
  {habit:'acupressure',text:'食物中添加天然香料（姜黄、生姜、大蒜）可有效抑制慢性炎症反应。',source:'厨房是最好的药房。--《抗炎生活》',refBook:'抗炎生活'},
  {habit:'yoga',text:'每天12分钟正念冥想，坚持8周即可检测到端粒酶活性提升。',source:'压力管理是最有效的抗衰老策略。--《端粒效应》',refBook:'端粒效应'},
  {habit:'diary',text:'血糖波动过大会导致注意力不集中和情绪波动，控糖即控情绪。',source:'稳定的血糖带来稳定的情绪。--《控糖革命》',refBook:'控糖革命'},
  {habit:'eye_rest',text:'传统发酵食品（泡菜、酸奶、味噌）富含益生菌，是肠道健康的最佳来源。',source:'发酵食品是人类最古老的营养智慧。--《深度营养》',refBook:'深度营养'},
  {habit:'strength',text:'运动后立即学习，记忆巩固效率提升20%，这是运动对大脑最直接的馈赠。',source:'运动让大脑准备好学习。--《运动改造大脑》',refBook:'运动改造大脑'},
  {habit:'jump_rope',text:'睡眠质量由睡眠周期决定，而非单纯的小时数。了解周期比追求时长更重要。',source:'90分钟是一个完整的睡眠周期。--《睡眠革命》',refBook:'睡眠革命'}
];

const BODY_CLOCK = [
  {id:'zishi',name:'子时',start:23,end:1,meridian:'胆经',action:'必须入睡',detail:'凡十一脏取决于胆',icon:'🌙',color:'#2d3436'},
  {id:'choushi',name:'丑时',start:1,end:3,meridian:'肝经',action:'深度睡眠',detail:'血归于肝，肝排毒修复',icon:'🌙',color:'#2d3436'},
  {id:'yinshi',name:'寅时',start:3,end:5,meridian:'肺经',action:'保持深睡',detail:'肺主气，不宜醒来',icon:'🌙',color:'#2d3436'},
  {id:'maoshi',name:'卯时',start:5,end:7,meridian:'大肠经',action:'起床·喝温水·排便',detail:'大肠经当令，阳气初生',icon:'🌅',color:'#F4A683'},
  {id:'chenshi',name:'辰时',start:7,end:9,meridian:'胃经',action:'必须吃早餐',detail:'胃最活跃，营养吸收佳',icon:'☀️',color:'#7CB69D'},
  {id:'sishi',name:'巳时',start:9,end:11,meridian:'脾经',action:'高效工作学习',detail:'脾运化，精力充沛',icon:'☀️',color:'#7CB69D'},
  {id:'wushi',name:'午时',start:11,end:13,meridian:'心经',action:'午休小睡15-30分钟',detail:'养心安神，小憩最佳',icon:'🌤️',color:'#F4A683'},
  {id:'weishi',name:'未时',start:13,end:15,meridian:'小肠经',action:'午餐吸收营养',detail:'小肠泌别清浊',icon:'🌤️',color:'#7CB69D'},
  {id:'shenshi',name:'申时',start:15,end:17,meridian:'膀胱经',action:'多喝水·适合运动',detail:'代谢旺盛，排毒最佳',icon:'☀️',color:'#7CB69D'},
  {id:'youshi',name:'酉时',start:17,end:19,meridian:'肾经',action:'休息养肾',detail:'肾藏精，不宜过劳',icon:'🌅',color:'#F4A683'},
  {id:'xushi',name:'戌时',start:19,end:21,meridian:'心包经',action:'放松心情',detail:'适合娱乐社交、舒缓情绪',icon:'🌙',color:'#2d3436'},
  {id:'haishi',name:'亥时',start:21,end:23,meridian:'三焦经',action:'泡脚静心·准备入睡',detail:'三焦通百脉，宜静养',icon:'🌙',color:'#2d3436'}
];

const EMOTION_DATA = [
  {id:'anger',name:'怒',emoji:'😠',organ:'肝',damage:'气上冲',cure:'悲',cureEmoji:'😢',cureDesc:'想悲伤的事来平息怒气',quote:'怒伤肝，悲胜怒'},
  {id:'joy',name:'喜',emoji:'😂',organ:'心',damage:'气涣散',cure:'恐',cureEmoji:'😨',cureDesc:'用冷静思考收敛过度兴奋',quote:'喜伤心，恐胜喜'},
  {id:'thinking',name:'思',emoji:'🤔',organ:'脾',damage:'气郁滞',cure:'怒',cureEmoji:'😠',cureDesc:'适当发怒来打破过度思虑',quote:'思伤脾，怒胜思'},
  {id:'sorrow',name:'悲',emoji:'😢',organ:'肺',damage:'气消耗',cure:'喜',cureEmoji:'😂',cureDesc:'做开心的事来缓解悲伤',quote:'忧伤肺，喜胜忧'},
  {id:'fear',name:'恐',emoji:'😨',organ:'肾',damage:'气下陷',cure:'思',cureEmoji:'🤔',cureDesc:'用理性思考来化解恐惧',quote:'恐伤肾，思胜恐'}
];

const WULAO_DATA = [
  {id:'jiushi',name:'久视伤血',emoji:'👀',organ:'肝',scene:'长时间看手机、电脑',action:'闭目养肝',tip:'每20分钟远眺20秒，闭目养神'},
  {id:'jiuzuo',name:'久坐伤肉',emoji:'🪑',organ:'脾',scene:'办公室久坐',action:'脾经活动',tip:'每45分钟起身活动5分钟，拉伸'},
  {id:'jiuli',name:'久立伤骨',emoji:'🧍',organ:'肾',scene:'长期站立工作',action:'抖腿活动',tip:'交替坐立，踮脚尖活动'},
  {id:'jiuwo',name:'久卧伤气',emoji:'🛏️',organ:'肺',scene:'长期躺床不动',action:'扩胸运动',tip:'适度活动，不可赖床过久'},
  {id:'jiuxing',name:'久行伤筋',emoji:'🚶',organ:'肝',scene:'过度行走跑步',action:'拉筋放松',tip:'量力而行，运动后拉伸'}
];

const CONSTITUTION_TYPES = [
  {id:'pinghe',name:'平和质',emoji:'😊',color:'#7CB69D',desc:'阴阳气血调和，体态适中，面色红润，精力充沛。',advice:'继续保持，注意劳逸结合，饮食均衡。',habits:['early_rise','morning_run','breakfast','walk','reading','meditation','early_sleep']},
  {id:'qixu',name:'气虚质',emoji:'😮‍💨',color:'#F4A683',desc:'元气不足，容易疲乏，气短懒言，出汗多。',advice:'宜食用黄芪、山药、红枣等补气食物，避免过度劳累。',habits:['early_rise','breakfast','breathe','walk','foot_bath','early_sleep','less_sit']},
  {id:'yangxu',name:'阳虚质',emoji:'🥶',color:'#5B8DB8',desc:'阳气不足，畏寒怕冷，手足不温，喜热饮食。',advice:'宜食用生姜、羊肉、桂圆等温阳食物，注意保暖，多晒太阳。',habits:['early_rise','breakfast','walk','sunshine','foot_bath','early_sleep','vitamin']},
  {id:'yinxu',name:'阴虚质',emoji:'🔥',color:'#E07A5F',desc:'阴液亏少，口燥咽干，手足心热，喜冷饮。',advice:'宜食用银耳、百合、梨等滋阴食物，避免熬夜，多喝水。',habits:['daily_water','reading','meditation','early_sleep','skincare','breathe']},
  {id:'tanshi',name:'痰湿质',emoji:'💧',color:'#8B9A8B',desc:'痰湿凝聚，形体肥胖，腹部肥满，口黏苔腻。',advice:'宜食用薏米、冬瓜、山楂等祛湿食物，多运动，少吃油腻。',habits:['morning_run','walk','less_sit','healthy_diet','fruits_veggies','jump_rope']},
  {id:'shire',name:'湿热质',emoji:'🌡️',color:'#D4A373',desc:'湿热内蕴，面垢油光，易生痤疮，口苦口干。',advice:'宜食用绿豆、苦瓜、芹菜等清热利湿食物，忌辛辣油腻。',habits:['daily_water','morning_run','walk','healthy_diet','skincare','foot_bath']},
  {id:'xueyu',name:'血瘀质',emoji:'🩸',color:'#A44A4A',desc:'血行不畅，肤色晦暗，色素沉着，易出瘀斑。',advice:'宜食用山楂、红花、黑豆等活血食物，适度运动，保持心情舒畅。',habits:['morning_run','walk','stretch','yoga','breathe','meditation']},
  {id:'qiyu',name:'气郁质',emoji:'😔',color:'#6B5B95',desc:'气机郁滞，神情抑郁，情感脆弱，烦闷不乐。',advice:'宜多参加社交活动，多晒太阳，饮用玫瑰花茶，保持心情舒畅。',habits:['reading','walk','meditation','yoga','breathe','sunshine','diary']},
  {id:'tebing',name:'特禀质',emoji:'🤧',color:'#B8B8D1',desc:'先天失常，过敏体质，易荨麻疹、哮喘、花粉症。',advice:'避免接触过敏原，饮食清淡，增强体质，注意季节变化。',habits:['early_rise','breakfast','walk','sunshine','healthy_diet','vitamin']}
];

const CONSTITUTION_QUIZ = [
  {
    question:'你平时容易感到疲劳吗？',
    options:[
      {text:'精力充沛，很少疲劳',scores:{pinghe:2,qixu:0,yangxu:0,yinxu:0}},
      {text:'容易疲劳，气短懒言',scores:{pinghe:0,qixu:2,yangxu:1,yinxu:0}},
      {text:'容易疲劳，怕冷喜热',scores:{pinghe:0,qixu:1,yangxu:2,yinxu:0}},
      {text:'容易疲劳，手足心热',scores:{pinghe:0,qixu:0,yangxu:0,yinxu:2}}
    ]
  },
  {
    question:'你的体型特征更接近哪种？',
    options:[
      {text:'体态适中，不胖不瘦',scores:{pinghe:2,tanshi:0,qixu:0,tebing:0}},
      {text:'形体偏胖，腹部肥满',scores:{pinghe:0,tanshi:2,qixu:0,tebing:0}},
      {text:'形体偏瘦，肌肉松软',scores:{pinghe:0,tanshi:0,qixu:2,tebing:0}},
      {text:'体型正常但容易过敏',scores:{pinghe:0,tanshi:0,qixu:0,tebing:2}}
    ]
  },
  {
    question:'你的面色和皮肤状态如何？',
    options:[
      {text:'面色红润，皮肤正常',scores:{pinghe:2,xueyu:0,shire:0,yinxu:0}},
      {text:'肤色晦暗，有色斑',scores:{pinghe:0,xueyu:2,shire:0,yinxu:0}},
      {text:'面垢油光，易长痘',scores:{pinghe:0,xueyu:0,shire:2,yinxu:0}},
      {text:'皮肤干燥，易起皮',scores:{pinghe:0,xueyu:0,shire:0,yinxu:2}}
    ]
  },
  {
    question:'你的情绪状态通常是？',
    options:[
      {text:'心情平和，情绪稳定',scores:{pinghe:2,qiyu:0,qixu:0,xueyu:0}},
      {text:'容易抑郁，闷闷不乐',scores:{pinghe:0,qiyu:2,qixu:0,xueyu:0}},
      {text:'容易烦躁，易怒',scores:{pinghe:0,qiyu:0,qixu:0,xueyu:0,yinxu:2}},
      {text:'容易紧张，焦虑不安',scores:{pinghe:0,qiyu:2,qixu:0,xueyu:0}}
    ]
  },
  {
    question:'你的耐寒耐热情况如何？',
    options:[
      {text:'耐寒耐热，适应力好',scores:{pinghe:2,yangxu:0,yinxu:0,tanshi:0}},
      {text:'特别怕冷，手足不温',scores:{pinghe:0,yangxu:2,yinxu:0,tanshi:0}},
      {text:'怕热，手足心热',scores:{pinghe:0,yangxu:0,yinxu:2,tanshi:0}},
      {text:'怕热又怕冷，不耐寒热',scores:{pinghe:0,yangxu:1,yinxu:1,tanshi:0}}
    ]
  },
  {
    question:'你的饮食偏好是？',
    options:[
      {text:'饮食均衡，不偏不挑',scores:{pinghe:2,tanshi:0,shire:0,yangxu:0}},
      {text:'喜食油腻，口重',scores:{pinghe:0,tanshi:2,shire:1,yangxu:0}},
      {text:'喜食辛辣，口渴想喝凉',scores:{pinghe:0,tanshi:0,shire:2,yangxu:0}},
      {text:'喜食温热，不爱冷饮',scores:{pinghe:0,tanshi:0,shire:0,yangxu:2}}
    ]
  },
  {
    question:'你的大便情况通常是？',
    options:[
      {text:'正常成形，每日1次',scores:{pinghe:2,tanshi:0,shire:0,qixu:0}},
      {text:'大便黏滞，不成形',scores:{pinghe:0,tanshi:2,shire:1,qixu:0}},
      {text:'容易便秘，大便干结',scores:{pinghe:0,tanshi:0,shire:0,yinxu:2}},
      {text:'容易腹泻，大便稀溏',scores:{pinghe:0,tanshi:0,shire:0,yangxu:2,qixu:1}}
    ]
  },
  {
    question:'你的睡眠情况如何？',
    options:[
      {text:'睡眠良好，入睡快',scores:{pinghe:2,qiyu:0,yinxu:0,qixu:0}},
      {text:'入睡困难，多梦易醒',scores:{pinghe:0,qiyu:1,yinxu:1,qixu:0}},
      {text:'睡眠质量差，早醒',scores:{pinghe:0,qiyu:0,yinxu:2,qixu:0}},
      {text:'嗜睡，睡不醒',scores:{pinghe:0,qiyu:0,yinxu:0,qixu:2,tanshi:1}}
    ]
  }
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
App.Data.GUIDE_STEPS = GUIDE_STEPS;

if (App.registerModule) {
  App.registerModule('data.content', 'data', null);
}
