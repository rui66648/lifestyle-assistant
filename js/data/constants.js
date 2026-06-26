const DAY_NAMES = ['日','一','二','三','四','五','六'];

const SOLAR_TERMS = [
  {name:'立春',month:2,day:4,emoji:'🌱',season:'spring',tip:'春季开始，养肝护阳，夜卧早起'},
  {name:'雨水',month:2,day:19,emoji:'🌧️',season:'spring',tip:'降水增多，健脾祛湿，少吃生冷'},
  {name:'惊蛰',month:3,day:5,emoji:'🐛',season:'spring',tip:'万物复苏，疏肝理气，适当运动'},
  {name:'春分',month:3,day:20,emoji:'⚖️',season:'spring',tip:'昼夜平分，阴阳平衡，调和气血'},
  {name:'清明',month:4,day:4,emoji:'🌿',season:'spring',tip:'肝气旺盛，宜清淡饮食，踏青运动'},
  {name:'谷雨',month:4,day:20,emoji:'🌾',season:'spring',tip:'湿气加重，健脾祛湿，少食油腻'},
  {name:'立夏',month:5,day:5,emoji:'☀️',season:'summer',tip:'夏季开始，养心清火，晚睡早起'},
  {name:'小满',month:5,day:21,emoji:'🌾',season:'summer',tip:'湿热加重，清热利湿，饮食清淡'},
  {name:'芒种',month:6,day:5,emoji:'🌾',season:'summer',tip:'阳气最盛，养心健脾，午休补觉'},
  {name:'夏至',month:6,day:21,emoji:'☀️',season:'summer',tip:'白昼最长，养心安神，适当出汗'},
  {name:'小暑',month:7,day:7,emoji:'🔥',season:'summer',tip:'暑热初现，清热解暑，多饮水'},
  {name:'大暑',month:7,day:22,emoji:'🌡️',season:'summer',tip:'一年最热，防暑降温，清淡饮食'},
  {name:'立秋',month:8,day:7,emoji:'🍂',season:'autumn',tip:'秋季开始，养肺润燥，早卧早起'},
  {name:'处暑',month:8,day:23,emoji:'🍃',season:'autumn',tip:'暑气渐消，滋阴润燥，防秋燥'},
  {name:'白露',month:9,day:7,emoji:'💧',season:'autumn',tip:'昼夜温差大，保暖防凉，养肺'},
  {name:'秋分',month:9,day:23,emoji:'⚖️',season:'autumn',tip:'昼夜平分，阴阳平衡，收敛神气'},
  {name:'寒露',month:10,day:8,emoji:'🍂',season:'autumn',tip:'寒气加重，保暖防寒，滋阴润肺'},
  {name:'霜降',month:10,day:23,emoji:'❄️',season:'autumn',tip:'气温骤降，防寒保暖，温补脾胃'},
  {name:'立冬',month:11,day:7,emoji:'❄️',season:'winter',tip:'冬季开始，养肾藏精，早卧晚起'},
  {name:'小雪',month:11,day:22,emoji:'❄️',season:'winter',tip:'气温下降，温补阳气，防寒保暖'},
  {name:'大雪',month:12,day:7,emoji:'❄️',season:'winter',tip:'寒冷加剧，补肾温阳，适当进补'},
  {name:'冬至',month:12,day:21,emoji:'❄️',season:'winter',tip:'白昼最短，养肾补阳，去寒就温'},
  {name:'小寒',month:1,day:5,emoji:'🧊',season:'winter',tip:'寒冷初现，温肾助阳，保暖防寒'},
  {name:'大寒',month:1,day:20,emoji:'🧊',season:'winter',tip:'一年最冷，温补养肾，适度运动'}
];

const LEVELS = [
  {level:1,name:'养生小白',icon:'🌱',minDays:0},
  {level:2,name:'养生学徒',icon:'🌿',minDays:3},
  {level:3,name:'养生达人',icon:'🌳',minDays:7},
  {level:4,name:'养生专家',icon:'🏆',minDays:14},
  {level:5,name:'养生大师',icon:'👑',minDays:30}
];

const LUNAR_INFO = [0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,0x06ca0,0x0b550,0x15355,0x04da0,0x0a5d0,0x14573,0x052d0,0x0a9a8,0x0e950,0x06aa0,0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b5a0,0x195a6,0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,0x05aa0,0x076a3,0x096d0,0x04bd7,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0];
const LUNAR_MONTHS = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
const LUNAR_DAYS = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];

const AI_WORKER_URL = 'https://ai-proxy.3487331518.workers.dev';

const POMO_WORK = 25 * 60;
const POMO_SHORT = 5 * 60;
const POMO_LONG = 15 * 60;

if (!window.App) window.App = {};
if (!App.Data) App.Data = {};

App.Data.DAY_NAMES = DAY_NAMES;
App.Data.SOLAR_TERMS = SOLAR_TERMS;
App.Data.LEVELS = LEVELS;
App.Data.LUNAR_INFO = LUNAR_INFO;
App.Data.LUNAR_MONTHS = LUNAR_MONTHS;
App.Data.LUNAR_DAYS = LUNAR_DAYS;
App.Data.AI_WORKER_URL = AI_WORKER_URL;
App.Data.POMO_WORK = POMO_WORK;
App.Data.POMO_SHORT = POMO_SHORT;
App.Data.POMO_LONG = POMO_LONG;
