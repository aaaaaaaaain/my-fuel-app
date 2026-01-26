let records = JSON.parse(localStorage.getItem('fuelRecords')) || [];
let chart;

// 初始化
window.onload = () => {
    setCurrentTime();
    initChart();
    render();
};

function setCurrentTime() {
    const now = new Date();
    document.getElementById('date').value = now.toISOString().split('T')[0];
    document.getElementById('time').value = now.toTimeString().slice(0, 5);
}

// 頁籤切換
function tab(i) {
    document.querySelectorAll('.segment').forEach((s, x) => s.classList.toggle('active', x === i));
    document.querySelectorAll('.sec').forEach((s, x) => s.classList.toggle('active', x === i));
    if (i === 1) updateChart();
}

// 儲存邏輯
function save() {
    const d = document.getElementById('date').value;
    const t = document.getElementById('time').value;
    const l = parseFloat(document.getElementById('liters').value);
    const km = parseFloat(document.getElementById('distance').value);
    const idx = parseInt(document.getElementById('editIdx').value);

    if (!d || !t || isNaN(l) || isNaN(km)) return alert("請正確輸入數值");

    const entry = { d, t, l, km, cons: Number((km / l).toFixed(2)) };

    if (idx === -1) {
        records.push(entry);
    } else {
        records[idx] = entry;
    }

    // 依日期時間排序
    records.sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
    
    localStorage.setItem('fuelRecords', JSON.stringify(records));
    
    // 重置欄位
    document.getElementById('editIdx').value = "-1";
    document.getElementById('liters').value = '';
    document.getElementById('distance').value = '';
    
    setCurrentTime();
    render();
    tab(2); // 跳轉到明細頁
}

// 渲染列表
function render() {
    const valid = records.filter(r => !isNaN(r.cons));
    document.getElementById('avgVal').innerText = valid.length ? 
        (valid.reduce((s, r) => s + r.cons, 0) / valid.length).toFixed(2) : "0.00";
    document.getElementById('countVal').innerText = records.length;

    const container = document.getElementById('list');
    container.innerHTML = '';

    [...records].reverse().forEach((r) => {
        const i = records.indexOf(r);
        
        // 油耗對比
        let diffHtml = '';
        if (i > 0) {
            const diff = Number((r.cons - records[i-1].cons).toFixed(2));
            if (diff > 0) diffHtml = `<span class="diff-tag diff-up">↑${diff}</span>`;
            else if (diff < 0) diffHtml = `<span class="diff-tag diff-down">↓${Math.abs(diff)}</span>`;
        }

        // 天數計算
        let daysHtml = '';
        if (i > 0) {
            const diffDays = Math.ceil(Math.abs(new Date(r.d) - new Date(records[i-1].d)) / (1000 * 60 * 60 * 24));
            daysHtml = `<span class="days-tag">${diffDays}天</span>`;
        }

        container.innerHTML += `
            <div class="record-row">
                <div>
                    <b>${r.d} <small style="color:var(--ios-gray); margin-left:5px;">${r.t || ''}</small></b>
                    ${daysHtml}<br>
                    <small style="color:var(--ios-gray)">${r.l}L / ${r.km}km</small>
                </div>
                <div style="text-align:right">
                    <span class="record-val">${r.cons}</span>${diffHtml}<br>
                    <small style="color:var(--ios-blue)" onclick="editRecord(${i})">編輯</small>
                    <small style="color:var(--ios-red);margin-left:10px" onclick="del(${i})">刪除</small>
                </div>
            </div>`;
    });
}

// 編輯與刪除
function editRecord(i) {
    const r = records[i];
    document.getElementById('date').value = r.d;
    document.getElementById('time').value = r.t || "00:00";
    document.getElementById('liters').value = r.l;
    document.getElementById('distance').value = r.km;
    document.getElementById('editIdx').value = i;
    tab(0);
}

function del(i) {
    if (confirm("確定刪除這筆紀錄？")) {
        records.splice(i, 1);
        localStorage.setItem('fuelRecords', JSON.stringify(records));
        render();
    }
}

// 圖表邏輯
function initChart() {
    const ctx = document.getElementById('chart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ data: [], borderColor: '#007AFF', tension: 0.4, fill: false }] },
        options: { plugins: { legend: { display: false } } }
    });
}

function updateChart() {
    chart.data.labels = records.map(r => r.d);
    chart.data.datasets[0].data = records.map(r => r.cons);
    chart.update();
}

// 匯出與清除
function exportXLS() {
    // 1. 整理明細資料（中文標題）
    const exportedData = records.map(r => ({
        "日期": r.d,
        "時間": r.t,
        "加油公升 (L)": r.l,
        "行駛里程 (km)": r.km,
        "當次油耗 (km/L)": r.cons
    }));

    // 2. 計算總和邏輯
    const totalLiters = records.reduce((sum, r) => sum + (r.l || 0), 0);
    const totalKm = records.reduce((sum, r) => sum + (r.km || 0), 0);
    const avgCons = records.length ? (totalKm / totalLiters).toFixed(2) : 0;

    // 3. 插入「總計列」到陣列最後面
    exportedData.push({
        "日期": "【總計統計】",
        "時間": "",
        "加油公升 (L)": Number(totalLiters.toFixed(2)), // 這裡就是你要的總油耗
        "行駛里程 (km)": Number(totalKm.toFixed(1)),
        "當次油耗 (km/L)": "總平均:" + avgCons
    });

    // 4. 執行匯出
    const ws = XLSX.utils.json_to_sheet(exportedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "油耗記錄");
    
    // 檔名加上日期，方便管理
    const fileName = `油耗記錄_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

function clearAll() {
    if (confirm("確定清除所有資料？這無法復原。")) {
        localStorage.clear();
        records = [];
        render();
    }
}
