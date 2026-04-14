/* ================================================================
   problems.js  -  Verifiable Problems page logic
   Handles routing, data fetching, and DOM rendering.
   ================================================================ */

'use strict';

/* ---------- Utilities ---------- */

function esc(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatBest(str) {
    if (!str) return null;
    return esc(String(str)).replace(/(\w[\w.]*)\^(\d+)/g, '$1<sup>$2</sup>');
}

async function fetchJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
    return res.json();
}

function showError(container, msg) {
    container.innerHTML = `<div class="error-state"><strong>Error:</strong> ${esc(msg)}</div>`;
}

function highlightJSON(str) {
    const escaped = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped
        .replace(/(&quot;[\w\s]+&quot;)\s*:/g, '<span class="tok-key">$1</span>:')
        .replace(/\b(-?\d+)\b/g, '<span class="tok-num">$1</span>')
        .replace(/([{}\[\],])/g, '<span class="tok-punc">$1</span>')
        .replace(/\.\.\./g, '<span class="tok-ellip">...</span>');
}

function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
}

/* ---------- Leaderboard type detection ---------- */

function detectLeaderboardType(rows) {
    if (!rows || rows.length === 0) return 'generic';
    const first = rows[0];
    if ('mod4' in first && 'best' in first) return 'hadamard';
    if ('params' in first && 'status' in first) return 'conway';
    if ('naive' in first && 'best' in first) return 'tensor';
    if ('sequence' in first && 'optimal' in first) return 'hp';
    if ('best' in first && 'pct' in first) return 'stilllife';
    return 'generic';
}

/* ---------- Problem cards (index view) ---------- */

function renderProblemCard(meta) {
    const a = document.createElement('a');
    a.className = 'problem-card-link';
    a.href = `?problem=${encodeURIComponent(meta.id)}`;
    a.innerHTML = `
        <div class="problem-card">
            <div class="problem-card__left">
                <div class="problem-card__meta">
                    <span class="tag tag--domain">${esc(meta.domain)}</span>
                </div>
                <h3>${esc(meta.title)}</h3>
                <p>${esc(meta.subtitle || '')}</p>
            </div>
            <div class="problem-card__right">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
                </svg>
            </div>
        </div>`;
    return a;
}

/* ---------- Leaderboard renderers ---------- */

function renderHadamardLeaderboard(lb, collapsed) {
    const maxVisible = collapsed ? 10 : lb.rows.length;
    const rows = lb.rows.map((row, i) => {
        const bestHTML = row.best ? formatBest(row.best) : '<span style="color:var(--text-tertiary)">-</span>';
        const pctHTML = (row.pct != null)
            ? `<div class="pct-cell">
                   <div class="pct-bar-track"><div class="pct-bar-fill" style="width:${row.pct}%"></div></div>
                   <span class="pct-value">${row.pct.toFixed(2)}%</span>
               </div>`
            : `<span class="pct-unknown">-</span>`;
        const noteHTML = row.note ? `<span class="row-note">${esc(row.note)}</span>` : '';
        const hidden = i >= maxVisible ? ' style="display:none" data-extra-row' : '';
        return `
        <tr${hidden}>
            <td class="td-n"><div class="n-label">${row.n}</div>${noteHTML}</td>
            <td class="td-mod">${row.mod4}</td>
            <td class="td-best">${bestHTML}</td>
            <td class="td-pct">${pctHTML}</td>
        </tr>`;
    }).join('');

    const showMore = (collapsed && lb.rows.length > maxVisible)
        ? `<tr class="show-more-row"><td colspan="4" style="text-align:center;padding:var(--space-3)"><button class="show-more-btn">Show all ${lb.rows.length} rows</button></td></tr>`
        : '';

    return `
        <table class="leaderboard" aria-label="Leaderboard">
            <thead><tr>
                <th>n</th><th class="td-mod">n mod 4</th><th>Best Known (factored)</th><th>% of Bound</th>
            </tr></thead>
            <tbody>${rows}${showMore}</tbody>
        </table>`;
}

function renderConwayLeaderboard(lb) {
    const rows = lb.rows.map(row => {
        const statusHTML = row.status === 'Unknown'
            ? '<span class="status-open"><span class="status-dot"></span>Open</span>'
            : `<span class="status-solved">${esc(row.status)}</span>`;
        const noteHTML = row.note ? `<span class="row-note">${esc(row.note)}</span>` : '';
        return `
        <tr>
            <td class="td-n"><div class="n-label">${row.n.toLocaleString()}</div>${noteHTML}</td>
            <td class="td-best" style="font-size:0.82rem">${esc(row.params)}</td>
            <td class="td-status">${statusHTML}</td>
        </tr>`;
    }).join('');
    return `
        <table class="leaderboard" aria-label="Leaderboard">
            <thead><tr><th>Vertices</th><th>Parameters</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function renderTensorLeaderboard(lb, collapsed) {
    const maxVisible = collapsed ? 8 : lb.rows.length;
    const rows = lb.rows.map((row, i) => {
        const sizeLabel = String(row.n).replace(/,/g, ' \u00d7 ');
        const noteHTML = row.note ? `<span class="row-note">${esc(row.note)}</span>` : '';
        const pctHTML = (row.pct != null)
            ? `<div class="pct-cell">
                   <div class="pct-bar-track"><div class="pct-bar-fill" style="width:${row.pct}%"></div></div>
                   <span class="pct-value">${row.pct.toFixed(1)}%</span>
               </div>`
            : `<span class="pct-unknown">-</span>`;
        const hidden = i >= maxVisible ? ' style="display:none" data-extra-row' : '';
        return `
        <tr${hidden}>
            <td class="td-n"><div class="n-label">${esc(sizeLabel)}</div>${noteHTML}</td>
            <td class="td-mod">${row.naive}</td>
            <td class="td-best" style="font-weight:700">${row.best}</td>
            <td class="td-pct">${pctHTML}</td>
        </tr>`;
    }).join('');

    const showMore = (collapsed && lb.rows.length > maxVisible)
        ? `<tr class="show-more-row"><td colspan="4" style="text-align:center;padding:var(--space-3)"><button class="show-more-btn">Show all ${lb.rows.length} rows</button></td></tr>`
        : '';

    return `
        <table class="leaderboard" aria-label="Leaderboard">
            <thead><tr><th>Size</th><th class="td-mod">Naive</th><th>Record</th><th>% of Naive</th></tr></thead>
            <tbody>${rows}${showMore}</tbody>
        </table>`;
}

function renderStillLifeLeaderboard(lb) {
    const rows = lb.rows.map(row => {
        const noteHTML = row.note ? `<span class="row-note">${esc(row.note)}</span>` : '';
        const pctHTML = (row.pct != null)
            ? `<div class="pct-cell">
                   <div class="pct-bar-track"><div class="pct-bar-fill" style="width:${row.pct}%"></div></div>
                   <span class="pct-value">${row.pct.toFixed(1)}%</span>
               </div>`
            : `<span class="pct-unknown">-</span>`;
        return `
        <tr>
            <td class="td-n"><div class="n-label">${row.n} \u00d7 ${row.n}</div>${noteHTML}</td>
            <td class="td-best" style="font-weight:700">${row.best}</td>
            <td class="td-pct">${pctHTML}</td>
        </tr>`;
    }).join('');
    return `
        <table class="leaderboard" aria-label="Leaderboard">
            <thead><tr><th>Box Size</th><th>Live Cells</th><th>Density (%)</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function renderHPLeaderboard(lb, collapsed) {
    const maxVisible = collapsed ? 6 : lb.rows.length;
    const rows = lb.rows.map((row, i) => {
        const optLabel = row.optimal
            ? '<span class="status-solved" style="font-size:0.75rem">Proven</span>'
            : '<span class="status-open"><span class="status-dot"></span>Open</span>';
        const noteHTML = row.note ? `<span class="row-note">${esc(row.note)}</span>` : '';
        const hidden = i >= maxVisible ? ' style="display:none" data-extra-row' : '';
        const seq = esc(row.sequence || '');
        const seqHTML = seq
            ? `<code class="hp-seq" title="${seq}" style="font-size:0.7rem;word-break:break-all;line-height:1.3;display:block;max-width:320px;font-family:var(--font-mono, monospace);color:var(--color-text-secondary, #888)">${seq}</code>`
            : '';
        return `
        <tr${hidden}>
            <td class="td-n"><div class="n-label">${esc(row.id)}</div>${noteHTML}</td>
            <td class="td-mod">${row.length}</td>
            <td style="max-width:340px">${seqHTML}</td>
            <td class="td-best" style="font-weight:700">${row.best}</td>
            <td class="td-status">${optLabel}</td>
        </tr>`;
    }).join('');

    const showMore = (collapsed && lb.rows.length > maxVisible)
        ? `<tr class="show-more-row"><td colspan="5" style="text-align:center;padding:var(--space-3)"><button class="show-more-btn">Show all ${lb.rows.length} rows</button></td></tr>`
        : '';

    return `
        <table class="leaderboard" aria-label="Leaderboard">
            <thead><tr><th>ID</th><th>Length</th><th>Sequence</th><th>Best H-H</th><th>Optimal?</th></tr></thead>
            <tbody>${rows}${showMore}</tbody>
        </table>`;
}

function renderLeaderboard(lb, collapsed) {
    const type = detectLeaderboardType(lb.rows);
    let tableHTML;
    switch (type) {
        case 'hadamard':  tableHTML = renderHadamardLeaderboard(lb, collapsed); break;
        case 'conway':    tableHTML = renderConwayLeaderboard(lb); break;
        case 'tensor':    tableHTML = renderTensorLeaderboard(lb, collapsed); break;
        case 'hp':        tableHTML = renderHPLeaderboard(lb, collapsed); break;
        case 'stilllife': tableHTML = renderStillLifeLeaderboard(lb); break;
        default:          tableHTML = renderHadamardLeaderboard(lb, collapsed); break;
    }

    const section = el('div', 'leaderboard-section');
    section.innerHTML = `
        <div class="leaderboard-header">
            <h3>Current Records</h3>
            <span class="leaderboard-note">${esc(lb.note)}</span>
        </div>
        <div class="table-wrapper">${tableHTML}</div>`;

    // Wire up "Show all" button
    setTimeout(() => {
        const btn = section.querySelector('.show-more-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                section.querySelectorAll('[data-extra-row]').forEach(r => r.style.display = '');
                btn.closest('tr').remove();
            });
        }
    }, 0);

    return section;
}

/* ---------- Section renderers ---------- */

function renderAttribution(data) {
    const attr = data.attribution;
    if (!attr) return null;
    const reviewers = (attr.reviewers && attr.reviewers.length > 0)
        ? attr.reviewers.join(', ')
        : 'CAISc 2026 Program Committee';
    const div = el('div', 'attribution-block');
    div.innerHTML = `
        <div class="attribution-row">
            <span class="attribution-label">Reviewed by</span>
            <span class="attribution-names">${esc(reviewers)}</span>
        </div>`;
    return div;
}

function renderSubmitCTA() {
    const div = el('div', 'submit-cta');
    div.innerHTML = `
        <span class="btn btn--disabled">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right:5px">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
            Submit (opens April 15, 2026)
        </span>`;
    return div;
}

function renderOrigin(data) {
    const div = el('div', 'context-box');
    div.innerHTML = `<h3 class="section-heading">Origin</h3><p>${esc(data.origin)}</p>`;
    return div;
}

function renderInstance(data) {
    const p = el('p', 'problem-description');
    p.textContent = data.instance;
    return p;
}

function renderWarmup(warmup) {
    if (!warmup) return null;
    const div = el('div', 'section-block warmup-block');
    let dataHTML = '';

    if (warmup.matrix) {
        const matrixStr = warmup.matrix.map(row => '  [' + row.join(', ') + ']').join('\n');
        dataHTML = `<div class="code-block" style="font-size:0.78rem;line-height:1.5">[\\n${matrixStr}\\n]</div>`;
    } else if (warmup.target) {
        dataHTML = `<div class="code-block" style="font-size:0.82rem;line-height:1.6"><span class="tok-key">Target:</span>   ${esc(warmup.target)}\n<span class="tok-key">Solution:</span> ${esc(warmup.solution || '')}</div>`;
    } else if (warmup.sequence) {
        const coordStr = warmup.solution
            ? JSON.stringify(warmup.solution).replace(/\],/g, '],\n  ')
            : '';
        dataHTML = `<div class="code-block" style="font-size:0.82rem;line-height:1.6"><span class="tok-key">Sequence:</span> ${esc(warmup.sequence)}${coordStr ? `\n<span class="tok-key">Coords:</span>   ${coordStr}` : ''}</div>`;
    }

    div.innerHTML = `
        <h3>${esc(warmup.title)}</h3>
        <p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.6;margin-bottom:var(--space-4)">${esc(warmup.body)}</p>
        ${dataHTML}`;
    return div;
}

function renderGameOfLifeWidget() {
    const ROWS = 20, COLS = 20, CELL = 15;
    const W = COLS * CELL, H = ROWS * CELL;
    let grid = Array.from({ length: ROWS }, () => new Uint8Array(COLS));
    let running = false, timer = null, gen = 0;

    const wrap = el('div', 'section-block warmup-block gol-widget');
    const heading = el('h3', null, 'Try It: Game of Life');
    const desc = el('p', null);
    desc.style.cssText = 'font-size:0.9rem;color:var(--text-secondary);line-height:1.6;margin-bottom:var(--space-4)';
    desc.innerHTML = 'Each cell has 8 neighbors (horizontal, vertical, diagonal). A live cell survives if it has 2 or 3 live neighbors, otherwise it dies. A dead cell becomes alive if it has exactly 3 live neighbors. Click cells to toggle alive/dead. Press Space or Play to run. A still life stays unchanged. Try building one!';

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    function getColor(varName) {
        return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    }

    function draw() {
        const alive = getColor('--accent') || '#6c63ff';
        const dead = getColor('--bg-secondary') || '#1a1a2e';
        const line = getColor('--border') || '#333';
        ctx.fillStyle = dead;
        ctx.fillRect(0, 0, W, H);
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (grid[r][c]) {
                    ctx.fillStyle = alive;
                    ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
                }
            }
        }
        ctx.strokeStyle = line;
        ctx.lineWidth = 0.5;
        for (let r = 0; r <= ROWS; r++) {
            ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke();
        }
        for (let c = 0; c <= COLS; c++) {
            ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke();
        }
    }

    function countNeighbors(r, c) {
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) n += grid[nr][nc];
            }
        }
        return n;
    }

    function step() {
        const next = Array.from({ length: ROWS }, () => new Uint8Array(COLS));
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const nb = countNeighbors(r, c);
                if (grid[r][c]) next[r][c] = (nb === 2 || nb === 3) ? 1 : 0;
                else next[r][c] = (nb === 3) ? 1 : 0;
            }
        }
        grid = next;
        gen++;
        draw();
        status.textContent = 'Generation ' + gen;
    }

    function toggleRun() {
        running = !running;
        if (running) {
            timer = setInterval(step, 150);
            playBtn.textContent = 'Pause';
            playBtn.classList.add('gol-btn--active');
        } else {
            clearInterval(timer);
            playBtn.textContent = 'Play';
            playBtn.classList.remove('gol-btn--active');
        }
    }

    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const c = Math.floor((e.clientX - rect.left) / CELL);
        const r = Math.floor((e.clientY - rect.top) / CELL);
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
            grid[r][c] = grid[r][c] ? 0 : 1;
            draw();
        }
    });

    const controls = el('div', 'gol-controls');
    const playBtn = el('button', 'gol-btn', 'Play');
    const stepBtn = el('button', 'gol-btn', 'Step');
    const randomBtn = el('button', 'gol-btn', 'Random');
    const clearBtn = el('button', 'gol-btn', 'Clear');

    playBtn.addEventListener('click', toggleRun);
    stepBtn.addEventListener('click', () => { if (!running) step(); });
    randomBtn.addEventListener('click', () => {
        grid = Array.from({ length: ROWS }, () => {
            const row = new Uint8Array(COLS);
            for (let c = 0; c < COLS; c++) row[c] = Math.random() < 0.3 ? 1 : 0;
            return row;
        });
        gen = 0; draw(); status.textContent = 'Generation 0';
    });
    clearBtn.addEventListener('click', () => {
        if (running) toggleRun();
        grid = Array.from({ length: ROWS }, () => new Uint8Array(COLS));
        gen = 0; draw(); status.textContent = 'Generation 0';
    });

    controls.append(playBtn, stepBtn, randomBtn, clearBtn);

    const status = el('div', 'gol-status', 'Generation 0');

    wrap.append(heading, desc, canvas, controls, status);

    // Keyboard: spacebar toggles play/pause
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && document.activeElement === document.body) {
            e.preventDefault();
            toggleRun();
        }
    });

    // Redraw on theme change
    const observer = new MutationObserver(() => draw());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    setTimeout(draw, 0);
    return wrap;
}

function renderSubmissionBlock(data) {
    const div = el('div', 'section-block');
    div.innerHTML = `
        <h3>Submission Format</h3>
        <div class="code-block">${highlightJSON(data.submissionExample)}</div>
        <div class="verify-note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            ${esc(data.verification)}
        </div>`;
    return div;
}

function renderBounds(bounds) {
    if (!bounds || bounds.length === 0) return null;
    const rows = bounds.map(b => `
        <li>
            <span class="mod-key">${esc(b.label)}</span>
            <span class="bound-detail">
                <span class="bound-name">${esc(b.name)}:</span> ${esc(b.formula)}
            </span>
        </li>`).join('');

    const details = document.createElement('details');
    details.className = 'accordion';
    details.open = true;
    details.innerHTML = `
        <summary>Bounds &amp; Constraints</summary>
        <div class="accordion-body"><ul class="bounds-list">${rows}</ul></div>`;
    return details;
}

function renderScoring(scoring) {
    if (!scoring) return null;
    const metrics = scoring.metrics ? scoring.metrics.map(m =>
        `<li><strong>${esc(m.name)}:</strong> ${esc(m.description)}</li>`
    ).join('') : '';

    const div = el('div', 'section-block scoring-block');
    div.innerHTML = `
        <h3>Scoring &amp; Evaluation</h3>
        <p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.6;margin-bottom:var(--space-3)">${esc(scoring.summary)}</p>
        ${metrics ? `<ul class="scoring-metrics">${metrics}</ul>` : ''}
        ${scoring.note ? `<p class="scoring-note">${esc(scoring.note)}</p>` : ''}`;
    return div;
}

function renderApproachSection(data) {
    const steps = data.suggestedApproach || [];
    const items = steps.map(s =>
        `<li><p><strong>${esc(s.title)}:</strong> ${esc(s.body)}</p></li>`
    ).join('');

    const div = el('div', 'section-block');
    let html = '';
    if (items) html += `<ol class="steps">${items}</ol>`;

    if (data.agentPrompt) {
        html += `
            <div style="margin-top:var(--space-6)">
                <h4 style="margin-bottom:var(--space-3);font-size:var(--text-base)">AI Agent Instructions</h4>
                <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-3);line-height:1.5">
                    Click the button below to get a complete prompt you can paste into your AI agent. It includes the problem description, constraints, references, and task instructions.
                </p>
                <button class="copy-agent-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right:5px">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                    Copy agent.md
                </button>
            </div>`;
    }

    div.innerHTML = html;
    return div;
}

function renderReferences(refs) {
    if (!refs || refs.length === 0) return null;
    const items = refs.map((r, i) => {
        const num = i + 1;
        if (typeof r === 'object' && r.text) {
            if (r.url) {
                return `<li><span class="ref-num">[${num}]</span> <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.text)}</a></li>`;
            }
            return `<li><span class="ref-num">[${num}]</span> ${esc(r.text)}</li>`;
        }
        return `<li><span class="ref-num">[${num}]</span> ${esc(r)}</li>`;
    }).join('');

    const div = el('div', 'references-section');
    div.innerHTML = `<h3>References</h3><ol class="refs-list refs-list--numbered">${items}</ol>`;
    return div;
}

function renderCiteBlock(data) {
    const attr = data.attribution;
    if (!attr) return null;
    const authors = attr.authors ? attr.authors.join(', ') : 'CAISc 2026';
    const reviewers = (attr.reviewers && attr.reviewers.length > 0)
        ? attr.reviewers.join(', ')
        : 'CAISc 2026 Program Committee';
    const year = '2026';
    const title = data.title;

    const div = el('div', 'cite-block');
    div.innerHTML = `
        <h3>Cite This Problem</h3>
        <div class="code-block cite-bibtex">Curated by ${esc(authors)} (${year}). ${esc(title)}. Reviewed by ${esc(reviewers)}. CAISc 2026 Verifiable Problems Track. https://caisc2026.github.io/problems/?problem=${esc(data.id)}</div>`;
    return div;
}

function renderWitnessExample(witness) {
    if (!witness) return null;
    const details = document.createElement('details');
    details.className = 'accordion';

    let matrixHTML = '';
    if (witness.matrix) {
        const rows = witness.matrix.map(row =>
            '  [' + row.map(v => v === 1 ? '+1' : '-1').join(', ') + ']'
        ).join('\n');
        matrixHTML = `<div class="code-block" style="font-size:0.72rem;line-height:1.4;max-height:300px;overflow:auto;margin-top:var(--space-3)">[\n${rows}\n]</div>`;
    }

    details.innerHTML = `
        <summary>Record-Holding Matrix</summary>
        <div class="accordion-body">
            <p style="font-size:0.875rem;color:var(--text-secondary);line-height:1.6">${esc(witness.note)}</p>
            ${matrixHTML}
        </div>`;
    return details;
}

/* ---------- Build agent.md content ---------- */

function buildAgentMD(data) {
    let md = `# ${data.title}\n\n`;

    md += `## Task\n${data.agentPrompt}\n\n`;
    md += `## Problem\n${data.instance}\n\n`;
    md += `## Background\n${data.origin}\n\n`;

    if (data.bounds && data.bounds.length > 0) {
        md += `## Bounds & Constraints\n`;
        data.bounds.forEach(b => { md += `- **${b.name}** (${b.label}): ${b.formula}\n`; });
        md += '\n';
    }

    if (data.scoring) {
        md += `## Scoring\n${data.scoring.summary}\n`;
        if (data.scoring.metrics) {
            data.scoring.metrics.forEach(m => { md += `- **${m.name}:** ${m.description}\n`; });
        }
        md += '\n';
    }

    md += `## Submission Format\n\`\`\`json\n${data.submissionExample}\n\`\`\`\n\n`;
    md += `## Verification\n${data.verification}\n\n`;

    if (data.references && data.references.length > 0) {
        md += `## References\n`;
        data.references.forEach((r, i) => {
            const text = (typeof r === 'object') ? r.text : r;
            const url = (typeof r === 'object' && r.url) ? ` ${r.url}` : '';
            md += `[${i + 1}] ${text}${url}\n`;
        });
    }

    return md;
}

/* ---------- Divider ---------- */

function renderDivider() {
    const hr = document.createElement('hr');
    hr.className = 'section-divider';
    return hr;
}

/* ---------- Video map for manim animations ---------- */
const VIDEO_MAP = {
    'hadamard-maximal-determinant': { src: 'videos/HadamardScene.mp4', poster: 'videos/thumbs/HadamardScene.jpg' },
    'conways-99-graph': { src: 'videos/ConwayScene.mp4', poster: 'videos/thumbs/ConwayScene.jpg' },
    'matrix-multiplication-tensor-rank': { src: 'videos/TensorRankScene.mp4', poster: 'videos/thumbs/TensorRankScene.jpg' },
    'connected-still-life': { src: 'videos/StillLifeScene.mp4', poster: 'videos/thumbs/StillLifeScene.jpg' }
};

function renderVideo(problemId) {
    const entry = VIDEO_MAP[problemId];
    if (!entry) return null;
    const div = el('div', 'video-block');
    div.innerHTML = `
        <video controls preload="metadata" playsinline poster="${entry.poster}">
            <source src="${entry.src}" type="video/mp4">
        </video>`;
    return div;
}

/* ---------- Detail page ---------- */

async function renderDetail(container, meta, showBack) {
    let data;
    try { data = await fetchJSON(meta.file); }
    catch (e) { showError(container, e.message); return; }

    // Collapse hero when viewing detail
    const hero = document.querySelector('.problems-hero');
    if (hero) hero.style.display = 'none';

    const section = el('section', 'problem-detail');

    // Back link
    if (showBack) {
        const back = el('a', 'back-link');
        back.href = 'index.html';
        back.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z"/></svg> All Problems`;
        section.appendChild(back);
    }

    /* 1. HEADER: title only, clean */
    const header = el('div', 'problem-header');
    header.innerHTML = `<h2>${esc(data.title)}</h2>`;
    section.appendChild(header);

    /* 1b. ATTRIBUTION: Curated by / Reviewed by */
    const attrEl = renderAttribution(data);
    if (attrEl) section.appendChild(attrEl);

    /* 2. THE PROBLEM: instance text + collapsible context */
    const problemCard = el('div', 'section-card');
    const problemHeading = el('h3', 'section-card__title');
    problemHeading.textContent = 'The Problem';
    problemCard.appendChild(problemHeading);

    problemCard.appendChild(renderInstance(data));

    if (data.warmup) {
        const warmupEl = renderWarmup(data.warmup);
        if (warmupEl) problemCard.appendChild(warmupEl);
    }

    // Interactive Game of Life widget (connected-still-life only)
    if (data.id === 'connected-still-life') {
        const golWidget = renderGameOfLifeWidget();
        if (golWidget) problemCard.appendChild(golWidget);
    }

    // Collapsible "Additional Context" with origin + video
    const videoEl = renderVideo(data.id);
    if (data.origin || videoEl) {
        const contextDetails = document.createElement('details');
        contextDetails.className = 'accordion';
        contextDetails.open = true;
        const summary = document.createElement('summary');
        summary.textContent = 'Background and Context';
        contextDetails.appendChild(summary);

        const body = el('div', 'accordion-body');
        if (data.origin) {
            const originP = el('p', 'context-origin');
            originP.style.cssText = 'font-size:0.9rem;color:var(--text-secondary);line-height:1.7;margin-bottom:var(--space-4)';
            originP.textContent = data.origin;
            body.appendChild(originP);
        }
        if (videoEl) {
            body.appendChild(videoEl);
        }
        contextDetails.appendChild(body);
        problemCard.appendChild(contextDetails);
    }

    section.appendChild(problemCard);

    /* 3. HOW TO SUBMIT (single-column rows) */
    const submitCard = el('div', 'section-card');
    const solHeading = el('h3', 'section-card__title');
    solHeading.textContent = 'How to Submit';
    submitCard.appendChild(solHeading);

    // Submission format (full width)
    submitCard.appendChild(renderSubmissionBlock(data));

    // Witness example (Hadamard) right after submission format
    if (data.witnessExample) {
        submitCard.appendChild(renderWitnessExample(data.witnessExample));
    }

    // Bounds (full width, with explanatory note)
    const boundsEl = renderBounds(data.bounds);
    if (boundsEl) {
        const boundsWrap = el('div', 'section-block bounds-section');
        boundsWrap.appendChild(boundsEl);
        const boundsNote = el('p', 'bounds-explanation');
        boundsNote.textContent = 'These constraints and theoretical bounds define the problem space. Your submission is verified and scored within these limits.';
        boundsWrap.appendChild(boundsNote);
        submitCard.appendChild(boundsWrap);
    }

    // Scoring
    const scoringEl = renderScoring(data.scoring);
    if (scoringEl) submitCard.appendChild(scoringEl);

    // Submit button at bottom of this section
    const submitBtnWrap = el('div', 'submit-cta-section');
    submitBtnWrap.innerHTML = `
        <span class="btn btn--disabled">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
            Submit (opens April 15, 2026)
        </span>`;
    submitCard.appendChild(submitBtnWrap);

    section.appendChild(submitCard);

    /* 4. HOW TO APPROACH */
    const approachCard = el('div', 'section-card');
    const appHeading = el('h3', 'section-card__title');
    appHeading.textContent = 'How to Approach';
    approachCard.appendChild(appHeading);
    approachCard.appendChild(renderApproachSection(data));
    section.appendChild(approachCard);

    /* 5. CURRENT RECORDS (leaderboard, moved down) */
    if (data.leaderboard) {
        const lbCard = el('div', 'section-card');
        lbCard.appendChild(renderLeaderboard(data.leaderboard, true));
        section.appendChild(lbCard);
    }

    /* 6. REFERENCES (flat numbered list) */
    if (data.references) {
        const refsCard = el('div', 'section-card');
        refsCard.appendChild(renderReferences(data.references));
        section.appendChild(refsCard);
    }

    /* 7. CITE THIS PROBLEM */
    const citeCard = el('div', 'section-card');
    const citeEl = renderCiteBlock(data);
    if (citeEl) citeCard.appendChild(citeEl);
    section.appendChild(citeCard);

    container.replaceWith(section);

    // Wire up "Copy agent.md" button
    const copyBtn = section.querySelector('.copy-agent-btn');
    if (copyBtn && data.agentPrompt) {
        copyBtn.addEventListener('click', () => {
            const md = buildAgentMD(data);
            navigator.clipboard.writeText(md).then(() => {
                copyBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right:5px">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    Copied!`;
                setTimeout(() => {
                    copyBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right:5px">
                            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                        </svg>
                        Copy agent.md`;
                }, 2000);
            });
        });
    }
}

/* ---------- Index view ---------- */

async function renderIndex(container) {
    let index;
    try { index = await fetchJSON('index.json'); }
    catch (e) { showError(container, e.message); return; }

    // Show hero on index view
    const hero = document.querySelector('.problems-hero');
    if (hero) hero.style.display = '';

    if (!index.problems || index.problems.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);padding:var(--space-8) var(--content-padding)">No problems published yet. Check back April 15, 2026.</p>';
        return;
    }

    if (index.problems.length === 1) {
        await renderDetail(container, index.problems[0], false);
        return;
    }

    const section = el('section', 'problems-index');
    for (const meta of index.problems) {
        section.appendChild(renderProblemCard(meta));
    }
    container.replaceWith(section);
}

/* ---------- Bootstrap ---------- */

async function init() {
    const container = document.getElementById('main-content');
    const params = new URLSearchParams(location.search);
    const problemId = params.get('problem');

    let index;
    try { index = await fetchJSON('index.json'); }
    catch (e) { showError(container, e.message); return; }

    if (problemId) {
        const meta = index.problems.find(p => p.id === problemId);
        if (!meta) { showError(container, `Problem "${esc(problemId)}" not found.`); return; }
        await renderDetail(container, meta, index.problems.length > 1);
    } else {
        await renderIndex(container);
    }
}

document.addEventListener('DOMContentLoaded', init);
