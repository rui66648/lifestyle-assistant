// ============================================================
// charts.js — ECharts 图表初始化
//生活习惯小助手 · 从零到付费商业发展计划
// ============================================================

(function () {
  'use strict';

  // ---------- 工具函数 ----------
  function getCSS(prop) {
    return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  }

  function initChart(domId) {
    var dom = document.getElementById(domId);
    if (!dom) return null;
    return echarts.init(dom);
  }

  // ---------- 图表 1：市场规模增长图（柱状 + 折线混合） ----------
  function renderMarketScaleChart() {
    var chart = initChart('chart-market-scale');
    if (!chart) return;

    var accent  = getCSS('--accent')  || '#2D8C5A';
    var accent2 = getCSS('--accent2') || '#D4864E';
    var muted   = getCSS('--muted')   || '#6B6B6B';
    var ink     = getCSS('--ink')     || '#1A1A1A';

    var years = ['2024', '2025', '2026E'];

    var option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: '#fff',
        borderColor: '#E0D8C8',
        textStyle: { color: ink, fontSize: 13 }
      },
      legend: {
        data: ['习惯追踪APP市场（亿元）', '健康订阅盒市场（亿元）', '习惯追踪同比增速', '订阅盒同比增速'],
        bottom: 0,
        textStyle: { color: muted, fontSize: 12 }
      },
      grid: {
        left: 60,
        right: 60,
        top: 40,
        bottom: 60
      },
      xAxis: {
        type: 'category',
        data: years,
        axisLine: { lineStyle: { color: '#E0D8C8' } },
        axisTick: { show: false },
        axisLabel: { color: muted, fontSize: 13 }
      },
      yAxis: [
        {
          type: 'value',
          name: '市场规模（亿元）',
          nameTextStyle: { color: muted, fontSize: 12 },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: '#E0D8C8', type: 'dashed' } },
          axisLabel: { color: muted, fontSize: 12 }
        },
        {
          type: 'value',
          name: '同比增速（%）',
          nameTextStyle: { color: muted, fontSize: 12 },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { color: muted, fontSize: 12 }
        }
      ],
      series: [
        {
          name: '习惯追踪APP市场（亿元）',
          type: 'bar',
          barWidth: '28%',
          itemStyle: { color: accent, borderRadius: [4, 4, 0, 0] },
          data: [35.8, 42.3, 50.1]
        },
        {
          name: '健康订阅盒市场（亿元）',
          type: 'bar',
          barWidth: '28%',
          itemStyle: { color: accent2, borderRadius: [4, 4, 0, 0] },
          data: [108.5, 127.6, 147.2]
        },
        {
          name: '习惯追踪同比增速',
          type: 'line',
          yAxisIndex: 1,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { color: accent, width: 2 },
          itemStyle: { color: accent },
          data: [null, 18.2, 18.4]
        },
        {
          name: '订阅盒同比增速',
          type: 'line',
          yAxisIndex: 1,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { color: accent2, width: 2 },
          itemStyle: { color: accent2 },
          data: [null, 17.6, 15.4]
        }
      ]
    };

    chart.setOption(option);
    return chart;
  }

  // ---------- 图表 2：变现模式对比雷达图 ----------
  function renderMonetizationRadar() {
    var chart = initChart('chart-monetization-radar');
    if (!chart) return;

    var accent  = getCSS('--accent')  || '#2D8C5A';
    var accent2 = getCSS('--accent2') || '#D4864E';
    var ink     = getCSS('--ink')     || '#1A1A1A';

    var option = {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#fff',
        borderColor: '#E0D8C8',
        textStyle: { color: ink, fontSize: 13 }
      },
      legend: {
        data: ['电商变现', '订阅制', '买断制', '私域社群', 'AI增值服务'],
        bottom: 0,
        textStyle: { color: '#6B6B6B', fontSize: 12 }
      },
      radar: {
        indicator: [
          { name: '收入潜力', max: 100 },
          { name: '用户粘性', max: 100 },
          { name: '启动成本\n（越高越容易启动）', max: 100 },
          { name: '持续性', max: 100 }
        ],
        center: ['50%', '46%'],
        radius: '58%',
        shape: 'circle',
        splitNumber: 4,
        axisName: { color: '#6B6B6B', fontSize: 12 },
        splitArea: {
          areaStyle: { color: ['#FFFFFF', '#FAF6EE', '#F5F0E8', '#F0EAE0'] }
        },
        axisLine: { lineStyle: { color: '#E0D8C8' } },
        splitLine: { lineStyle: { color: '#E0D8C8' } }
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              name: '电商变现',
              value: [95, 55, 30, 70],
              lineStyle: { color: accent2, width: 2 },
              areaStyle: { color: accent2, opacity: 0.08 },
              itemStyle: { color: accent2 }
            },
            {
              name: '订阅制',
              value: [78, 90, 72, 95],
              lineStyle: { color: accent, width: 2 },
              areaStyle: { color: accent, opacity: 0.08 },
              itemStyle: { color: accent }
            },
            {
              name: '买断制',
              value: [40, 35, 90, 50],
              lineStyle: { color: '#8B7EC8', width: 2 },
              areaStyle: { color: '#8B7EC8', opacity: 0.08 },
              itemStyle: { color: '#8B7EC8' }
            },
            {
              name: '私域社群',
              value: [65, 82, 60, 75],
              lineStyle: { color: '#C75B7A', width: 2 },
              areaStyle: { color: '#C75B7A', opacity: 0.08 },
              itemStyle: { color: '#C75B7A' }
            },
            {
              name: 'AI增值服务',
              value: [85, 75, 50, 88],
              lineStyle: { color: '#4A90D9', width: 2 },
              areaStyle: { color: '#4A90D9', opacity: 0.08 },
              itemStyle: { color: '#4A90D9' }
            }
          ]
        }
      ]
    };

    chart.setOption(option);
    return chart;
  }

  // ---------- 图表 3：收入结构饼图 ----------
  function renderRevenuePieChart() {
    var chart = initChart('chart-revenue-pie');
    if (!chart) return;

    var accent  = getCSS('--accent')  || '#2D8C5A';
    var accent2 = getCSS('--accent2') || '#D4864E';
    var ink     = getCSS('--ink')     || '#1A1A1A';

    var option = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c}万/月 ({d}%)',
        backgroundColor: '#fff',
        borderColor: '#E0D8C8',
        textStyle: { color: ink, fontSize: 13 }
      },
      legend: {
        bottom: 0,
        textStyle: { color: '#6B6B6B', fontSize: 12 }
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '68%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: {
            show: true,
            formatter: '{b}\n{d}%',
            color: ink,
            fontSize: 12,
            lineHeight: 18
          },
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: 'bold' }
          },
          data: [
            { name: '会员订阅（约41万/月）',  value: 41, itemStyle: { color: accent } },
            { name: '养生商城（约35万/月）',  value: 35, itemStyle: { color: accent2 } },
            { name: '订阅盒（约33万/月）',    value: 33, itemStyle: { color: '#8B7EC8' } },
            { name: 'AI咨询（约8万/月）',     value: 8,  itemStyle: { color: '#4A90D9' } }
          ]
        }
      ]
    };

    chart.setOption(option);
    return chart;
  }

  // ---------- 初始化 & 响应式 ----------
  var charts = [];

  function initAll() {
    charts.push(renderMarketScaleChart());
    charts.push(renderMonetizationRadar());
    charts.push(renderRevenuePieChart());
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // 窗口 resize 时自适应
  window.addEventListener('resize', function () {
    charts.forEach(function (c) {
      if (c) c.resize();
    });
  });
})();
