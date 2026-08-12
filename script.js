let records = JSON.parse(localStorage.getItem('fuelRecords')) || [];
let chart;
let inputMode = localStorage.getItem('inputMode') || 'trip'; // 'trip' = 直接輸入里程, 'odo' = 總公里數相減

// 初始化
window.onload = () => {
    setCurrentTime();
    recalc();
    initChart();
    setMode(inputMode);
    render();
    loadSavedCarrier();
};

function setCurrentTime() {
    const now = new Date();
    document.getElementById('date').value = now.toISOString().split('T')[0];
    document.getElementById('time').value = now.toTimeString().slice(0, 5);
}

// 里程輸入模式：直接輸入單次里程，或輸入總公里數（里程表讀數）自動相減
function setMode(mode) {
    inputMode = mode === 'odo' ? 'odo' : 'trip';
    localStorage.setItem('inputMode', inputMode);

    document.getElementById('mode0').classList.toggle('active', inputMode === 'trip');
    document.getElementById('mode1').classList.toggle('active', inputMode === 'odo');
    document.getElementById('rowDistance').style.display = inputMode === 'trip' ? '' : 'none';
    document.getElementById('rowOdo').style.display = inputMode === 'odo' ? '' : 'none';
    document.getElementById('odoHint').style.display = inputMode === 'odo' ? '' : 'none';

    updateOdoHint();
}

// 找出這個時間點之前、最近一筆有總公里數的紀錄
function prevOdoRecord(d, t, excludeIdx) {
    const key = d + (t || '');
    let best = null;
    records.forEach((r, i) => {
        if (i === excludeIdx) return;
        if (r.odo == null || isNaN(r.odo)) return;
        const rk = r.d + (r.t || '');
        if (rk < key && (!best || rk > best.d + (best.t || ''))) best = r;
    });
    return best;
}

// 即時顯示「現在總公里 - 上次總公里 ÷ 公升」的試算結果
function updateOdoHint() {
    if (inputMode !== 'odo') return;

    const hint = document.getElementById('odoHint');
    const d = document.getElementById('date').value;
    const t = document.getElementById('time').value;
    const odo = parseFloat(document.getElementById('odo').value);
    const l = parseFloat(document.getElementById('liters').value);
    const idx = parseInt(document.getElementById('editIdx').value);
    const prev = prevOdoRecord(d, t, idx);

    if (!prev) {
        hint.innerHTML = '目前沒有更早的總公里數，這筆會存成<b>起始基準</b>，下次加油即可算出油耗。';
        return;
    }

    let html = `上次總公里數：<b>${prev.odo} km</b>（${prev.d}）`;
    if (!isNaN(odo)) {
        if (odo <= prev.odo) {
            html += `<br><span class="warn">總公里數必須大於 ${prev.odo}</span>`;
        } else {
            const km = Number((odo - prev.odo).toFixed(1));
            html += `<br>行駛里程：<b>${km} km</b>`;
            if (!isNaN(l) && l > 0) html += `　油耗：<b>${(km / l).toFixed(2)} km/L</b>`;
        }
    }
    hint.innerHTML = html;
}

// 依總公里數重算里程與油耗（紀錄新增、編輯、刪除後都要跑）
function recalc() {
    let prevOdo = null;
    records.forEach(r => {
        if (r.odo != null && !isNaN(r.odo)) {
            r.km = (prevOdo != null && r.odo > prevOdo) ? Number((r.odo - prevOdo).toFixed(1)) : null;
            prevOdo = r.odo;
        }
        r.cons = (r.km != null && !isNaN(r.km) && r.l > 0) ? Number((r.km / r.l).toFixed(2)) : null;
    });
}

// 頁籤切換
function tab(i) {
    document.querySelectorAll('#mainTabs .segment').forEach((s, x) => s.classList.toggle('active', x === i));
    document.querySelectorAll('.sec').forEach((s, x) => s.classList.toggle('active', x === i));
    if (i === 1) updateChart();
    if (i === 0) { renderInlineBarcode(); updateOdoHint(); }
}

// 儲存邏輯
function save() {
    const d = document.getElementById('date').value;
    const t = document.getElementById('time').value;
    const l = parseFloat(document.getElementById('liters').value);
    const km = parseFloat(document.getElementById('distance').value);
    const odo = parseFloat(document.getElementById('odo').value);
    const idx = parseInt(document.getElementById('editIdx').value);

    if (!d || !t || isNaN(l) || l <= 0) return alert("請正確輸入數值");

    let entry;
    if (inputMode === 'odo') {
        if (isNaN(odo)) return alert("請輸入現在的總公里數");
        const prev = prevOdoRecord(d, t, idx);
        if (prev && odo <= prev.odo) return alert(`總公里數必須大於上次的 ${prev.odo} km`);
        // km / cons 由 recalc() 依「現在總公里數 - 上次總公里數」算出
        entry = { d, t, l, odo, km: null, cons: null };
    } else {
        if (isNaN(km)) return alert("請正確輸入數值");
        entry = { d, t, l, km, cons: Number((km / l).toFixed(2)) };
    }

    if (idx === -1) {
        records.push(entry);
    } else {
        records[idx] = entry;
    }

    // 依日期時間排序
    records.sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
    recalc();

    localStorage.setItem('fuelRecords', JSON.stringify(records));

    // 重置欄位
    document.getElementById('editIdx').value = "-1";
    document.getElementById('liters').value = '';
    document.getElementById('distance').value = '';
    document.getElementById('odo').value = '';

    setCurrentTime();
    updateOdoHint();
    render();
    tab(2); // 跳轉到明細頁
}

// 渲染列表
function render() {
    const valid = records.filter(r => typeof r.cons === 'number' && !isNaN(r.cons));
    document.getElementById('avgVal').innerText = valid.length ?
        (valid.reduce((s, r) => s + r.cons, 0) / valid.length).toFixed(2) : "0.00";
    document.getElementById('countVal').innerText = records.length;
    document.getElementById('lowVal').innerText = valid.length ?
        Math.min(...valid.map(r => r.cons)).toFixed(2) : "--";

    const container = document.getElementById('list');
    container.innerHTML = '';

    [...records].reverse().forEach((r) => {
        const i = records.indexOf(r);
        
        // 油耗對比（往前找最近一筆有油耗的紀錄）
        let diffHtml = '';
        if (typeof r.cons === 'number') {
            let prev = null;
            for (let j = i - 1; j >= 0; j--) {
                if (typeof records[j].cons === 'number') { prev = records[j]; break; }
            }
            if (prev) {
                const diff = Number((r.cons - prev.cons).toFixed(2));
                if (diff > 0) diffHtml = `<span class="diff-tag diff-up">↑${diff}</span>`;
                else if (diff < 0) diffHtml = `<span class="diff-tag diff-down">↓${Math.abs(diff)}</span>`;
            }
        }

        // 天數計算
        let daysHtml = '';
        if (i > 0) {
            const diffDays = Math.ceil(Math.abs(new Date(r.d) - new Date(records[i-1].d)) / (1000 * 60 * 60 * 24));
            daysHtml = `<span class="days-tag">${diffDays}天</span>`;
        }

        const odoHtml = r.odo != null ? `<span class="odo-tag">總 ${r.odo}km</span>` : '';
        const kmText = r.km != null ? `${r.km}km/${r.l}L` : `起始基準 / ${r.l}L`;
        const consText = typeof r.cons === 'number' ? r.cons : '--';

        container.innerHTML += `
            <div class="record-row">
                <div>
                    <b>${r.d} <small style="color:var(--ios-gray); margin-left:5px;">${r.t || ''}</small></b>
                    ${daysHtml}<br>
                    <small style="color:var(--ios-gray)">${kmText}</small>${odoHtml}
                </div>
                <div style="text-align:right">
                    <span class="record-val">${consText}</span>${diffHtml}<br>
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
    document.getElementById('editIdx').value = i;

    if (r.odo != null) {
        document.getElementById('odo').value = r.odo;
        document.getElementById('distance').value = '';
        setMode('odo');
    } else {
        document.getElementById('distance').value = r.km;
        document.getElementById('odo').value = '';
        setMode('trip');
    }
    tab(0);
}

function del(i) {
    if (confirm("確定刪除這筆紀錄？")) {
        records.splice(i, 1);
        recalc();
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
    const valid = records.filter(r => typeof r.cons === 'number' && !isNaN(r.cons));
    chart.data.labels = valid.map(r => r.d);
    chart.data.datasets[0].data = valid.map(r => r.cons);
    chart.update();
}

// 匯出與清除
function exportXLS() {
    // 1. 整理明細資料（中文標題）
    const exportedData = records.map(r => ({
        "日期": r.d,
        "時間": r.t,
        "總公里數 (km)": r.odo != null ? r.odo : "",
        "加油公升 (L)": r.l,
        "行駛里程 (km)": r.km != null ? r.km : "",
        "當次油耗 (km/L)": typeof r.cons === 'number' ? r.cons : ""
    }));

    // 2. 計算總和邏輯（只有算得出里程的紀錄才納入平均）
    const counted = records.filter(r => r.km != null && !isNaN(r.km));
    const totalLiters = records.reduce((sum, r) => sum + (r.l || 0), 0);
    const totalKm = counted.reduce((sum, r) => sum + r.km, 0);
    const countedLiters = counted.reduce((sum, r) => sum + (r.l || 0), 0);
    const avgCons = countedLiters ? (totalKm / countedLiters).toFixed(2) : 0;

    // 3. 插入「總計列」到陣列最後面
    exportedData.push({
        "日期": "【總計統計】",
        "時間": "",
        "總公里數 (km)": "",
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
        const carrier = localStorage.getItem('carrierCode');
        localStorage.clear();
        if (carrier) localStorage.setItem('carrierCode', carrier);
        localStorage.setItem('inputMode', inputMode);
        records = [];
        render();
    }
}

// 載具條碼
function loadSavedCarrier() {
    const saved = localStorage.getItem('carrierCode');
    if (saved) {
        document.getElementById('carrierInput').value = saved;
        JsBarcode('#carrierBarcode', '/' + saved, barcodeOpts);
        document.getElementById('carrierCodeDisplay').textContent = '/' + saved;
        document.getElementById('barcodeSection').style.display = 'block';
        renderInlineBarcode();
    }
}

function generateBarcode() {
    const raw = document.getElementById('carrierInput').value.trim().toUpperCase();
    if (!/^[A-Z0-9+\-.]{7}$/.test(raw)) {
        alert('請輸入正確的 7 碼載具代碼\n（英文大寫、數字、+、-、.）');
        return;
    }
    const code = '/' + raw;
    localStorage.setItem('carrierCode', raw);
    showBarcode(code);
}

const barcodeOpts = {
    format: 'CODE128',
    width: 2.8,
    height: 110,
    displayValue: false,
    margin: 8,
    background: '#FFFFFF',
    lineColor: '#000000'
};

function showBarcode(code) {
    JsBarcode('#carrierBarcode', code, barcodeOpts);
    document.getElementById('carrierCodeDisplay').textContent = code;
    document.getElementById('barcodeSection').style.display = 'block';
    renderInlineBarcode();
}

function renderInlineBarcode() {
    const saved = localStorage.getItem('carrierCode');
    if (!saved) return;
    const code = '/' + saved;
    JsBarcode('#inlineBarcodeImg', code, barcodeOpts);
    document.getElementById('inlineCodeDisplay').textContent = code;
    document.getElementById('inlineBarcode').style.display = 'block';
}
