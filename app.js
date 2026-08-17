/* app.js - 赛题成果展示页交互逻辑
 * 数据来自 data/data.js (window.APP_DATA), 由 scripts/export_web_data.py 生成
 * 口径: 727版规则 + A1策略 + win-adapt (7月30日版说明书)
 */
(function () {
  "use strict";
  var D = window.APP_DATA;
  if (!D) { document.body.insertAdjacentHTML("afterbegin", "<div style='padding:20px;color:#ff5c5c'>数据加载失败: 缺少 data/data.js</div>"); return; }

  var LV_COLOR = { 0: "#4b5875", 1: "#ffd166", 2: "#ff9e42", 3: "#ff5c5c" };
  var LV_NAME = { 0: "无预警", 1: "关注", 2: "警告", 3: "危险" };
  function fmtTs(t) {
    return t.length === 14 ? t.slice(0, 4) + "-" + t.slice(4, 6) + "-" + t.slice(6, 8) + " " + t.slice(8, 10) + ":" + t.slice(10, 12) : t;
  }

  /* ===== Hero ===== */
  var dg = D.metrics.danger;
  document.getElementById("hs-prec").textContent = dg["精确率"] + "%";
  document.getElementById("hs-rec").textContent = dg["召回率"] + "%";
  document.getElementById("hs-lead").textContent = dg["平均提前时间_min"] + "min";
  document.getElementById("hs-cvar").textContent = dg["平均CVaR改善率"] + "%";

  /* ===== 回测看板 ===== */
  var curPeriod = "danger";
  var cardDefs = [
    { k: "精确率", unit: "%", goal: "≥ 50%" },
    { k: "召回率", unit: "%", goal: "≥ 60%" },
    { k: "平均提前时间_min", unit: "min", goal: "≥ 30min" },
    { k: "平均CVaR改善率", unit: "%", goal: "> 10%" },
  ];
  var gateMap = { "精确率": "精确率>=50%", "召回率": "召回率>=60%", "平均提前时间_min": "提前>=30min", "平均CVaR改善率": "CVaR改善>=10%" };

  function renderMetrics() {
    var m = D.metrics[curPeriod];
    var html = "";
    cardDefs.forEach(function (c) {
      var ok = m["门槛"] && m["门槛"][gateMap[c.k]];
      html += "<div class='mcard'><div class='mcard-v " + (ok ? "pass" : "fail") + "'>" +
        m[c.k] + c.unit + "<span class='mcard-tag " + (ok ? "tag-pass" : "tag-fail") + "'>" +
        (ok ? "达标" : "未达标·待DRL优化") + "</span></div><div class='mcard-k'>" + c.k.replace("_min", "(min)") +
        "</div><div class='mcard-goal'>赛题门槛: " + c.goal + "</div></div>";
    });
    html += "<div class='mcard'><div class='mcard-v pass'>" + m["多头改善率"] + "%</div><div class='mcard-k'>多头方向 CVaR 改善率</div></div>";
    html += "<div class='mcard'><div class='mcard-v pass'>" + m["空头改善率"] + "%</div><div class='mcard-k'>空头方向 CVaR 改善率</div></div>";
    html += "<div class='mcard'><div class='mcard-v'>" + m["正确报警数"] + " / " + (m["正确报警数"] + m["错误报警数"]) + "</div><div class='mcard-k'>正确报警数 / 总报警事件</div></div>";
    html += "<div class='mcard'><div class='mcard-v'>" + m["风险区间段数(测试期)"] + "</div><div class='mcard-k'>测试期风险区间段数（赛题口径）</div></div>";
    document.getElementById("metric-cards").innerHTML = html;

    document.getElementById("metrics-meta").textContent =
      m["时段"] + " · " + m["策略"] + " · 自适应: " + m["自适应方案"] + " · 回测区间 " + m["回测区间"] +
      " · 测试时刻 " + m["测试时刻数"] + " · 首次报警 " + m["首次报警事件日"];

    // 等级分布
    var dist = m["测试期等级分布"];
    echarts.init(document.getElementById("chart-lvldist")).setOption({
      backgroundColor: "transparent",
      grid: { left: 50, right: 20, top: 30, bottom: 30 },
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: ["0级", "1级", "2级", "3级"], axisLabel: { color: "#aebad0" } },
      yAxis: { type: "value", axisLabel: { color: "#6b7a99" }, splitLine: { lineStyle: { color: "#1e2a45" } } },
      series: [{
        type: "bar", barWidth: "55%",
        data: [0, 1, 2, 3].map(function (l) {
          return { value: dist[String(l)] || 0, itemStyle: { color: LV_COLOR[l] } };
        }),
        label: { show: true, position: "top", color: "#aebad0" },
      }],
    });

    // 11指标触发统计(堆叠)
    var stat = m["11指标触发统计(测试期)"];
    var inds = Object.keys(stat);
    echarts.init(document.getElementById("chart-indstat")).setOption({
      backgroundColor: "transparent",
      grid: { left: 110, right: 30, top: 30, bottom: 30 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { top: 0, textStyle: { color: "#aebad0" } },
      xAxis: { type: "value", axisLabel: { color: "#6b7a99" }, splitLine: { lineStyle: { color: "#1e2a45" } } },
      yAxis: { type: "category", data: inds, axisLabel: { color: "#aebad0" } },
      series: [1, 2, 3].map(function (lv) {
        return {
          name: lv + "级", type: "bar", stack: "x", barWidth: "60%",
          itemStyle: { color: LV_COLOR[lv] },
          data: inds.map(function (k) { return (stat[k] && stat[k][lv + "级"]) || 0; }),
        };
      }),
    });
  }

  document.querySelectorAll("#period-toggle .seg-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll("#period-toggle .seg-btn").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      curPeriod = b.dataset.p;
      renderMetrics();
    });
  });
  renderMetrics();

  /* ===== 预警时间线 ===== */
  var tlChart = echarts.init(document.getElementById("chart-timeline"));
  var curTl = "danger";

  function renderTimeline() {
    var t = D.timeline[curTl];
    var n = t.rows.length;
    var lvlData = t.rows.map(function (r, i) {
      return {
        value: r.lv,
        itemStyle: { color: LV_COLOR[r.lv] },
        // 悬浮信息编码在自定义属性里, tooltip formatter 使用
        _i2: r.i2, _al: r.al, _rz: r.rz, _ex: r.ex, _t: r.t,
      };
    });
    var markAreas = [];
    t.risk_segs.forEach(function (s) { markAreas.push([{ xAxis: s[0], itemStyle: { color: "rgba(255,92,92,.10)" } }, { xAxis: s[1] }]); });

    tlChart.setOption({
      backgroundColor: "transparent",
      grid: { left: 40, right: 20, top: 30, bottom: 60 },
      tooltip: {
        trigger: "item",
        formatter: function (p) {
          var d = p.data;
          return "<b>" + fmtTs(d._t) + "</b><br>等级: <b style='color:" + LV_COLOR[d.value] + "'>" + d.value + " " + LV_NAME[d.value] + "</b>" +
            (d._ex ? " · <span style='color:#ff9e42'>极端行情模式</span>" : "") +
            (d._al ? " · <span style='color:#ffd166'>报警活跃</span>" : "") +
            (d._rz ? " · <span style='color:#ff5c5c'>风险区间内</span>" : "") +
            (d._i2 && d._i2.length ? "<br>≥2级指标: " + d._i2.join("、") : "");
        },
      },
      dataZoom: [{ type: "slider", height: 18, bottom: 12, borderColor: "#26355a", backgroundColor: "#101828", textStyle: { color: "#6b7a99" } }, { type: "inside" }],
      xAxis: { type: "category", data: t.ts, axisLabel: { color: "#6b7a99", interval: Math.floor(n / 10), formatter: function (v) { return v.slice(4, 8); } } },
      yAxis: { type: "value", min: 0, max: 3, interval: 1, axisLabel: { color: "#6b7a99", formatter: function (v) { return v + "级"; } }, splitLine: { lineStyle: { color: "#1e2a45" } } },
      series: [{
        type: "bar", data: lvlData, barWidth: "100%",
        markArea: { silent: true, data: markAreas },
      }],
    }, true);
  }

  document.querySelectorAll("#tl-toggle .seg-btn").forEach(function (b) {
    b.addEventListener("click", function () {
      document.querySelectorAll("#tl-toggle .seg-btn").forEach(function (x) { x.classList.remove("active"); });
      b.classList.add("active");
      curTl = b.dataset.p;
      renderTimeline();
    });
  });
  renderTimeline();

  /* ===== 曲面演示 ===== */
  var SF = D.surface;
  var sfFrames = SF.frames;
  var sfIdx = 0;
  var sfPlaying = false;
  var sfTimer = null;
  var sfPlot = document.getElementById("sf-plot");
  document.getElementById("sf-count").textContent = sfFrames.length;
  var slider = document.getElementById("sf-slider");
  slider.max = String(sfFrames.length - 1);

  var surfaceLayout = {
    margin: { l: 0, r: 0, b: 0, t: 30 },
    paper_bgcolor: "transparent", plot_bgcolor: "transparent",
    font: { color: "#aebad0", family: "PingFang SC, Microsoft YaHei, sans-serif" },
    scene: {
      xaxis: { title: { text: "Moneyness (K/S)" }, gridcolor: "#1e2a45", backgroundcolor: "rgba(0,0,0,0)" },
      yaxis: { title: { text: "剩余期限" }, gridcolor: "#1e2a45", backgroundcolor: "rgba(0,0,0,0)" },
      zaxis: { title: { text: "IV" }, gridcolor: "#1e2a45", backgroundcolor: "rgba(0,0,0,0)" },
      camera: { eye: { x: 1.7, y: -1.4, z: 0.9 } },
      aspectmode: "manual", aspectratio: { x: 1.3, y: 1, z: 0.7 },
    },
    showlegend: false,
    margin_pad: 0,
  };

  function sfRender() {
    var f = sfFrames[sfIdx];
    // 网格: -1 -> null
    var z = f.grid.map(function (row) { return row.map(function (v) { return v < 0 ? null : v; }); });
    var bad = { x: [], y: [], z: [], text: [] };
    f.pts.forEach(function (p) {
      bad.x.push(p[0]); bad.y.push(p[1]); bad.z.push(p[2]);
      bad.text.push("肇事点 · 等级" + p[3] + "<br>Moneyness " + p[0] + " · 剩余期限 " + p[1] + "天<br>IV " + (p[2] * 100).toFixed(1) + "%");
    });
    var atmPts = f.atm.map(function (a) { return [1.0, a[0], a[1]]; });

    var data = [{
      type: "surface",
      x: SF.mny, y: SF.dte, z: z,
      colorscale: [[0, "#1a3a6e"], [0.5, "#2e86ab"], [1, "#ffd166"]],
      showscale: false, opacity: 0.92,
      contours: { x: { show: true, color: "#0d1220", width: 1 }, y: { show: true, color: "#0d1220", width: 1 } },
      hovertemplate: "Moneyness %{x}<br>%{y}<br>IV %{z:.2%}<extra></extra>",
    }];
    if (bad.x.length) data.push({
      type: "scatter3d", mode: "markers", x: bad.x, y: bad.y, z: bad.z,
      text: bad.text, hoverinfo: "text",
      marker: { size: 5, color: "#ffd166", line: { color: "#0d1220", width: 1 } },
    });
    if (atmPts.length) data.push({
      type: "scatter3d", mode: "lines+markers", x: atmPts.map(function (p) { return p[0]; }),
      y: atmPts.map(function (p) { return p[1]; }), z: atmPts.map(function (p) { return p[2]; }),
      line: { color: "#ff5c5c", width: 5 }, marker: { size: 3, color: "#ff5c5c" },
      hovertemplate: "ATM · %{y}<br>IV %{z:.2%}<extra></extra>",
    });

    Plotly.react(sfPlot, data, surfaceLayout, { displayModeBar: false, responsive: true });

    var lv = f.lv;
    document.getElementById("sf-meta").innerHTML =
      "<b>" + fmtTs(f.t) + "</b> · 预警等级 <b style='color:" + LV_COLOR[lv] + "'>" + lv + " " + LV_NAME[lv] + "</b>" +
      (f.ex ? " · <span style='color:#ff9e42'>极端行情</span>" : "") +
      (f.rz ? " · <span style='color:#ff5c5c'>风险区间</span>" : "") +
      (f.i2.length ? " · ≥2级: " + f.i2.join("、") : "");
    slider.value = String(sfIdx);
  }

  function sfShow(i) { sfIdx = Math.max(0, Math.min(sfFrames.length - 1, i)); sfRender(); }
  slider.addEventListener("input", function () { sfShow(parseInt(slider.value, 10)); });

  document.getElementById("sf-play").addEventListener("click", function () {
    sfPlaying = !sfPlaying;
    this.textContent = sfPlaying ? "⏸ 暂停" : "▶ 播放";
    if (sfPlaying) {
      sfTimer = setInterval(function () {
        sfShow((sfIdx + 1) % sfFrames.length);
      }, 450);
    } else { clearInterval(sfTimer); }
  });
  sfShow(0);

  /* ===== 传导图谱 ===== */
  var kg = D.kg;
  var catOrder = ["指标", "机制", "后果", "证据", "模式"];
  var catColor = { "指标": "#7eb3ff", "机制": "#ffd166", "后果": "#ff5c5c", "证据": "#6ee7a0", "模式": "#c792ea" };
  var kgNodes = kg.nodes.map(function (n) {
    return {
      id: n.id, name: n.name, category: catOrder.indexOf(n.cat),
      symbolSize: n.size, desc: n.desc, cat: n.cat,
      itemStyle: { color: catColor[n.cat] || "#8fa3c8" },
      label: { color: "#e8ecf4", fontSize: 11 },
    };
  });
  var kgLinks = kg.links.map(function (l) {
    return { source: l.s, target: l.t, value: l.rel, lineStyle: { color: "#3d5484", width: 1.2, curveness: 0.15 } };
  });
  echarts.init(document.getElementById("chart-kg")).setOption({
    backgroundColor: "transparent",
    tooltip: {
      formatter: function (p) {
        if (p.dataType === "edge") return p.data.value || "";
        var d = p.data;
        return "<b>[" + d.cat + "] " + d.name + "</b>" + (d.desc ? "<br>" + d.desc : "");
      },
    },
    legend: { data: catOrder, textStyle: { color: "#aebad0" }, top: 0 },
    series: [{
      type: "graph", layout: "force", roam: true, draggable: true,
      force: { repulsion: 380, edgeLength: [90, 180], gravity: 0.06 },
      categories: catOrder.map(function (c) { return { name: c }; }),
      data: kgNodes, links: kgLinks,
      lineStyle: { opacity: 0.7 },
      emphasis: { focus: "adjacency", lineStyle: { color: "#ffd166", width: 2.5 } },
    }],
  });

  document.getElementById("mm-narrative").textContent = kg.mm_narrative;
  document.getElementById("kg-sample-text").textContent = kg.sample.text;

  /* ===== 窗口自适应 ===== */
  window.addEventListener("resize", function () {
    tlChart.resize();
    document.querySelectorAll(".chart").forEach(function (el) {
      var inst = echarts.getInstanceByDom(el);
      if (inst) inst.resize();
    });
  });
})();
