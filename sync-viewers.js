/*
  Provides createSyncedViewerPair(container, options) global function:
  - container: DOM node or selector string
  - options: {
      left: { panorama: string, pannellum: {...} },
      right:{ panorama: string, pannellum: {...} },
      size?: { width:number|string, height:number|string },
      className?: string
    }
*/

(function () {
    function resolveContainer(container) {
        if (!container) throw new Error('container is required');
        if (typeof container === 'string') {
            var el = document.querySelector(container);
            if (!el) throw new Error('Container not found: ' + container);
            return el;
        }
        return container;
    }

    function toPx(v) {
        if (v == null) return null;
        return typeof v === 'number' ? (v + 'px') : String(v);
    }

    function createEl(tag, className, styles) {
        var el = document.createElement(tag);
        if (className) el.className = className;
        if (styles) Object.assign(el.style, styles);
        return el;
    }

    function defaultPannellumConfig(src) {
        return {
            type: 'equirectangular',
            panorama: src,
            autoLoad: true,
            showFullscreenCtrl: true,
            showZoomCtrl: true,
            showCompass: false,
            hfov: 120,
            minHfov: 50,
            maxHfov: 120,
            autoRotate: -5
        };
    }

    function deepMerge(target, source) {
        var out = Object.assign({}, target);
        if (!source) return out;
        Object.keys(source).forEach(function (k) {
            var sv = source[k];
            if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
                out[k] = deepMerge(out[k] || {}, sv);
            } else {
                out[k] = sv;
            }
        });
        return out;
    }

    function createSyncedViewerPair(container, options) {
        var root = resolveContainer(container);
        var opt = options || {};
        var className = opt.className || 'synced-pair';
        var size = opt.size || { width: '600px', height: '400px' };
        var isFluid = size && (size.width === 'fluid' || size.width === '100%' || size.width === 'auto');
        var meta = opt.meta || {}; // { title, description }

        var card = createEl('div', 'sv-card', {
            border: '2px solid',
            borderImage: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(6,182,212,0.15)) 1',
            borderRadius: '18px',
            padding: '16px',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(236,254,255,0.95))',
            display: 'block',
            textAlign: 'center',
            transition: 'all 250ms ease',
            boxShadow: '0 12px 32px rgba(59,130,246,.15)',
            maxWidth: '100%',
            minHeight: '340px'
        });

        card.addEventListener('pointerenter', function () {
            card.style.transform = 'translateY(-4px) scale(1.01)';
            card.style.boxShadow = '0 20px 50px rgba(6,182,212,.25), 0 0 0 1px rgba(59,130,246,.2)';
            card.style.borderImage = 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(6,182,212,0.3)) 1';
        });
        card.addEventListener('pointerleave', function () {
            card.style.transform = 'translateY(0) scale(1)';
            card.style.boxShadow = '0 12px 32px rgba(59,130,246,.15)';
            card.style.borderImage = 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(6,182,212,0.15)) 1';
        });

        if (meta.title) {
            var titleEl = createEl('div', 'sv-card-title', {
                fontWeight: 'bold',
                fontSize: '14px',
                marginBottom: '8px'
            });
            titleEl.textContent = meta.title;
            card.appendChild(titleEl);
        }

        var group = createEl('div', 'sv-group ' + className, {
            display: isFluid ? 'flex' : 'inline-flex',
            gap: '8px',
            alignItems: 'stretch',
            verticalAlign: 'top',
            width: isFluid ? '100%' : ''
        });

        var w = toPx(size.width) || '600px';
        var h = toPx(size.height) || '400px';

        var leftStyle = isFluid ? { height: h, flex: '1 1 0', width: 'auto' } : { width: w, height: h, flex: '0 0 auto' };
        var rightStyle = isFluid ? { height: h, flex: '1 1 0', width: 'auto' } : { width: w, height: h, flex: '0 0 auto' };
        var leftDiv = createEl('div', 'sv-viewer sv-left', leftStyle);
        var rightDiv = createEl('div', 'sv-viewer sv-right', rightStyle);

        group.appendChild(leftDiv);
        group.appendChild(rightDiv);
        card.appendChild(group);

        var footer = createEl('div', 'sv-card-footer', {
            marginTop: '8px',
            color: '#334155',
            fontSize: '15px',
            lineHeight: '1.4',
            minHeight: '32px'
        });
        if (meta.description) footer.textContent = meta.description;
        card.appendChild(footer);

        root.appendChild(card);

        var leftCfg = deepMerge(defaultPannellumConfig(opt.left && opt.left.panorama), opt.left && opt.left.pannellum);
        var rightCfg = deepMerge(defaultPannellumConfig(opt.right && opt.right.panorama), opt.right && opt.right.pannellum);

        var leftViewer = pannellum.viewer(leftDiv, leftCfg);
        var rightViewer = pannellum.viewer(rightDiv, rightCfg);

        var master = null;
        var syncing = false;

        function copyState(fromViewer, toViewer) {
            try {
                var yaw = fromViewer.getYaw();
                var pitch = fromViewer.getPitch();
                var hfov = fromViewer.getHfov();
                toViewer.lookAt(pitch, yaw, hfov, false);
            } catch (e) {
            }
        }

        function syncLoop() {
            if (master === 'left') {
                copyState(leftViewer, rightViewer);
            } else if (master === 'right') {
                copyState(rightViewer, leftViewer);
            }
            if (syncing) requestAnimationFrame(syncLoop);
        }

        function startSync(which) {
            master = which;
            if (!syncing) {
                syncing = true;
                requestAnimationFrame(syncLoop);
            }
        }

        function stopSync() {
            master = null;
            syncing = false;
        }

        function attachInteraction(div, which) {
            var down = false;
            div.addEventListener('pointerdown', function () {
                down = true;
                startSync(which);
            });
            window.addEventListener('pointerup', function () {
                if (down) {
                    down = false;
                    if (which === 'left' && master === 'left') copyState(leftViewer, rightViewer);
                    if (which === 'right' && master === 'right') copyState(rightViewer, leftViewer);
                    stopSync();
                }
            });
            div.addEventListener('pointermove', function () {
                if (down) startSync(which);
            });
            div.addEventListener('wheel', function () {
                startSync(which);
                setTimeout(stopSync, 80);
            }, { passive: true });
        }

        attachInteraction(leftDiv, 'left');
        attachInteraction(rightDiv, 'right');

        var leftLoaded = false, rightLoaded = false;
        function tryInitialAlign() {
            if (leftLoaded && rightLoaded) {
                copyState(leftViewer, rightViewer);
            }
        }
        leftViewer.on('load', function () { leftLoaded = true; tryInitialAlign(); });
        rightViewer.on('load', function () { rightLoaded = true; tryInitialAlign(); });

        return {
            root: card,
            left: leftViewer,
            right: rightViewer,
            destroy: function () {
                try { leftViewer.destroy(); } catch (e) {}
                try { rightViewer.destroy(); } catch (e) {}
                if (card.parentNode) card.parentNode.removeChild(card);
            }
        };
    }

    window.createSyncedViewerPair = createSyncedViewerPair;

    function createComparisonQuad(container, options) {
        var root = resolveContainer(container);
        var opt = options || {};
        var size = opt.size || { width: 300, height: 200 };
        var isFluid = size && (size.width === 'fluid' || size.width === '100%' || size.width === 'auto');

        var card = createEl('div', 'sv-card sv-quad', {
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px',
            marginTop: '16px',
            background: '#fff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
        });

        if (opt.title) {
            var titleEl = createEl('div', 'sv-card-title', { fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' });
            titleEl.textContent = opt.title;
            card.appendChild(titleEl);
        }

        var grid = createEl('div', 'sv-quad-grid', {
            display: 'flex',
            gap: '8px',
            alignItems: 'stretch',
            width: '100%'
        });

        var w = toPx(size.width) || '300px';
        var h = toPx(size.height) || '200px';

        function makeCell(labelText, panoramaSrc) {
            var box = createEl('div', 'sv-quad-cell', { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 1 0' });
            var label = createEl('div', 'sv-quad-label', { fontSize: '13px', color: '#374151', marginBottom: '4px' });
            label.textContent = labelText || '';
            var host = createEl('div', 'sv-viewer', { height: h, width: '100%' });
            box.appendChild(label);
            box.appendChild(host);
            var cfg = deepMerge(defaultPannellumConfig(panoramaSrc), opt.pannellum);
            var v = pannellum.viewer(host, cfg);
            return { box: box, host: host, viewer: v };
        }

        var cells = [];
        cells.push(makeCell((opt.labels && opt.labels[0]) || 'Original', opt.items && opt.items[0]));
        cells.push(makeCell((opt.labels && opt.labels[1]) || 'Method A', opt.items && opt.items[1]));
        cells.push(makeCell((opt.labels && opt.labels[2]) || 'Method B', opt.items && opt.items[2]));
        cells.push(makeCell((opt.labels && opt.labels[3]) || 'Ours', opt.items && opt.items[3]));

        cells.forEach(function (c) { grid.appendChild(c.box); });
        card.appendChild(grid);
        root.appendChild(card);

        var master = null;
        var syncing = false;

        function copyState(fromViewer, toViewer) {
            try {
                toViewer.lookAt(fromViewer.getPitch(), fromViewer.getYaw(), fromViewer.getHfov(), false);
            } catch (e) {}
        }

        function syncLoop() {
            if (!syncing || master == null) return;
            var from = cells[master].viewer;
            for (var i = 0; i < cells.length; i++) {
                if (i !== master) copyState(from, cells[i].viewer);
            }
            requestAnimationFrame(syncLoop);
        }

        function startSync(which) { master = which; if (!syncing) { syncing = true; requestAnimationFrame(syncLoop); } }
        function stopSync() { syncing = false; master = null; }

        function attach(div, which) {
            var down = false;
            div.addEventListener('pointerdown', function () { down = true; startSync(which); });
            window.addEventListener('pointerup', function () { if (down) { down = false; stopSync(); } });
            div.addEventListener('pointermove', function () { if (down) startSync(which); });
            div.addEventListener('wheel', function () { startSync(which); setTimeout(stopSync, 80); }, { passive: true });
        }
        cells.forEach(function (c, idx) { attach(c.host, idx); });

        return { root: card, cells: cells.map(function (c) { return c.viewer; }) };
    }

    window.createComparisonQuad = createComparisonQuad;
})();


