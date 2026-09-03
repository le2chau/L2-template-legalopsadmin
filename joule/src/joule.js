/**
 * Joule Conversation Engine
 *
 * Parses a markdown-like DSL and renders messages with SAPUI5 components
 * into the Joule panel. Handles playback (Enter/Space to advance), typing
 * indicators, and smooth scrolling.
 */
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────
  let parsedConversation = null;
  let currentStep = 0;
  let isPlaying = false;
  let ui5Ready = false;
  let pendingUI5Renders = [];
  let isAdvancing = false;
  // Dynamic header title (Tweak D): one-shot latch. Status cards are NOT once-per-conversation
  // (laptop-request 2, reorder-supplies 2), so State 2 ("New Conversation") must fire only on the
  // FIRST card; State 3 latches the conversation title so later cards never revert it. Reset in
  // Joule.load (the sole re-init entry point; a conv: jump reloads the iframe, resetting naturally).
  let titleLatched = false;

  // SAP Token Resolution — resolved post-theme-ready inside onUI5Ready().
  // SAPUI5 bootstraps async (data-sap-ui-async="true"); joule.js loads synchronously
  // before theme CSS applies, so getComputedStyle at IIFE time returns empty and falls
  // back to hardcoded hex. Resolution is deferred to onUI5Ready(), which SAPUI5 fires
  // only after theme CSS is applied — guaranteeing the correct per-theme values.
  // Fallback hex values (inside _resolveTokens) are dead paths post-fix — they only fire
  // on catastrophic load failure, since _resolveTokens() runs inside onUI5Ready() which
  // SAPUI5 fires after theme CSS applies.
  // Initialized to fallback hex (DNA-kit originals = sap_horizon morning values).
  // _resolveTokens() overwrites these with live --sap token values inside onUI5Ready(),
  // guaranteeing correct per-theme colors for all rendered output.
  // Fallback values are only active on catastrophic load failure (UI5 never calls onUI5Ready).
  var _tokPositive    = '#256f3a',
      _tokCritical    = '#e76500',
      _tokNegative    = '#aa0808',
      _tokInformative = '#0070f2',
      _tokNeutral     = '#556b82',
      _tokLink        = '#0064d9',
      _tokText        = '#131e29',
      _tokContentBg   = '#fff',
      _tokBtnBg       = '#fff',
      _tokListBorder  = '#e5e5e5';

  function _resolveTokens() {
    var el = document.createElement('div');
    el.style.display = 'none';
    document.body.appendChild(el);
    function tok(name, fallback) {
      var v = getComputedStyle(el).getPropertyValue(name).trim();
      return v || fallback;
    }
    // Status / semantic colors — verified against theming-base-content css_variables.css
    _tokPositive    = tok('--sapPositiveColor',          '#256f3a');
    _tokCritical    = tok('--sapCriticalColor',          '#e76500');
    _tokNegative    = tok('--sapNegativeColor',          '#aa0808');
    _tokInformative = tok('--sapInformativeColor',       '#0070f2');
    _tokNeutral     = tok('--sapContent_LabelColor',     '#556b82');
    _tokLink        = tok('--sapLinkColor',              '#0064d9');
    _tokText        = tok('--sapTextColor',              '#131e29');
    // Surface / structural colors
    _tokContentBg   = tok('--sapGroup_ContentBackground','#fff');
    _tokBtnBg       = tok('--sapButton_Background',      '#fff');
    _tokListBorder  = tok('--sapList_BorderColor',       '#e5e5e5');
    document.body.removeChild(el);
    // EXCEPTIONS - genuinely flat-hardcoded; no --sap token equivalent in sap_horizon 1.148.1 (verified).
    // NOTE: #32363a, rgba(0,0,0,0.06/0.12), #ddd/#556b82 are NOT listed — they were tokenized this pass.
    // #d1d1d1  - decorative button border; lighter than --sapNeutralColor (#788fa6); no match
    // #e0e0e0  - SVG flow-label stroke; lighter than --sapNeutralColor; no match
    // #e8e8e8  - progress bar track (fallback path only); no structural track token
    // #f0f5ff  - option-button hover bg; --sapContent_Selected_Hover_Background (#e3f0ff) different hue
    // rgba(27,144,255,...) - decorative blue box-shadow tints on option buttons
    // rgba(0,0,0,0.03)  - code block bg; no token for pure alpha overlays
    // rgba(0,0,0,0.04)  - fallback container bg (fallback path only); same — no token
  }


  // ── DOM refs ───────────────────────────────────────────────────────
  const panel            = document.getElementById('joulePanel');
  const welcomeScreen    = document.getElementById('welcomeScreen');
  const welcomeBody      = document.getElementById('welcomeBody');
  const welcomeContent   = document.getElementById('welcomeContent');
  // welcomeGreeting: element removed from Sapphire layout; reference retained as null guard
  const conversationScr  = document.getElementById('conversationScreen');
  const conversationEl   = document.getElementById('conversationContent');
  const jouleMesh        = document.getElementById('jouleMesh');
  const inputEl          = document.getElementById('jouleInput');
  const sendBtn          = document.getElementById('jouleSend');
  const overflowBtn      = document.getElementById('btnOverflow');
  const headerTitleEl    = document.querySelector('.joule-header-title');

  // Tweak D header-title states. "New Conversation" is an engine constant (a live-matching
  // string, NOT a token and NOT an authorable DSL field). State machine is gated on
  // frontmatter.title truthiness in advanceConversation; this helper just sets the text.
  function setHeaderTitle(text) {
    if (headerTitleEl) headerTitleEl.textContent = text;
  }

  // ── DSL Parser ─────────────────────────────────────────────────────
  function parseDSL(raw) {
    const lines = raw.split('\n');
    let i = 0;

    // Skip any leading blank lines before the frontmatter delimiter
    while (i < lines.length && lines[i].trim() === '') i++;

    // --- Frontmatter ---
    const frontmatter = {};
    if (lines[i] && lines[i].trim() === '---') {
      i++;
      while (i < lines.length && lines[i].trim() !== '---') {
        const match = lines[i].match(/^(\w+)\s*:\s*(.+)$/);
        if (match) {
          frontmatter[match[1].trim()] = match[2].trim();
        }
        i++;
      }
      i++; // skip closing ---
    }

    // --- Messages ---
    const messages = [];
    let current = null;

    for (; i < lines.length; i++) {
      const line = lines[i];
      const roleMatch = line.match(/^@(user|joule)\s*$/);
      if (roleMatch) {
        if (current) messages.push(current);
        current = { role: roleMatch[1], blocks: [] };
        continue;
      }
      // Check for bg: directive at the start of a message block
      if (current && current.blocks.length === 0) {
        var bgMatch = line.match(/^bg:\s*(.+)$/);
        if (bgMatch) {
          current.bg = bgMatch[1].trim();
          continue;
        }
      }
      if (current) {
        current.blocks.push(line);
      }
    }
    if (current) messages.push(current);

    // Parse block content for each message
    messages.forEach(msg => {
      msg.content = parseBlocks(msg.blocks.join('\n'));
      delete msg.blocks;
    });

    return {
      greeting: frontmatter.greeting || 'Hello,', // vestigial — greeting no longer rendered in Sapphire layout; retained for backward-compat with existing conversation files
      chips: frontmatter.chips ? frontmatter.chips.split('|').map(s => s.trim()) : [],
      contextMessage: frontmatter.context || '',
      timestamp: frontmatter.timestamp || '',
      title: frontmatter.title || '', // Tweak D: conversation title for the dynamic header. Empty ⇒ header stays "Joule" (state machine gated on truthiness).
      messages
    };
  }

  function parseBlocks(raw) {
    const parts = [];
    const regex = /\{\{(\w+)([\s\S]*?)\}\}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(raw)) !== null) {
      // Text before this block
      const textBefore = raw.slice(lastIndex, match.index).trim();
      if (textBefore) parts.push({ type: 'text', value: textBefore });

      const blockType = match[1].toLowerCase();
      const blockBody = match[2].trim();
      parts.push(parseComponent(blockType, blockBody));
      lastIndex = regex.lastIndex;
    }

    const remaining = raw.slice(lastIndex).trim();
    if (remaining) parts.push({ type: 'text', value: remaining });

    return parts;
  }

  function parseComponent(type, body) {
    switch (type) {
      case 'table': return parseTable(body);
      case 'list':  return parseList(body);
      case 'objectheader': return parseObjectHeader(body);
      case 'messagestrip': return parseMessageStrip(body);
      case 'options': return parseOptions(body);
      case 'pre': return parsePre(body);
      case 'richlist': return parseRichList(body);
      case 'chips': return parseChips(body);
      case 'progress': return parseProgress(body);
      case 'statuscard': return parseStatusCard(body);
      case 'flowlist': return parseFlowList(body);
      case 'flow': return parseFlow(body);
      default: return { type: 'text', value: body };
    }
  }

  function parseTable(body) {
    const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
    let columns = [], rows = [];
    lines.forEach(line => {
      if (line.startsWith('columns:')) {
        columns = line.replace('columns:', '').split('|').map(s => s.trim());
      } else if (line.startsWith('row:')) {
        rows.push(line.replace('row:', '').split('|').map(s => s.trim()));
      }
    });
    return { type: 'table', columns, rows };
  }

  function parseList(body) {
    const items = body.split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('-'))
      .map(l => l.replace(/^-\s*/, ''));
    return { type: 'list', items };
  }

  function parseObjectHeader(body) {
    const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
    const data = {};
    const attributes = [];
    const statuses = [];
    lines.forEach(line => {
      if (line.startsWith('title:')) data.title = line.replace('title:', '').trim();
      else if (line.startsWith('number:')) data.number = line.replace('number:', '').trim();
      else if (line.startsWith('numberUnit:')) data.numberUnit = line.replace('numberUnit:', '').trim();
      else if (line.startsWith('attr:')) attributes.push(line.replace('attr:', '').trim());
      else if (line.startsWith('status:')) {
        const parts = line.replace('status:', '').trim().split('|').map(s => s.trim());
        statuses.push({ text: parts[0], state: parts[1] || 'None' });
      }
    });
    return { type: 'objectheader', ...data, attributes, statuses };
  }

  function parseMessageStrip(body) {
    const firstLine = body.split('\n')[0];
    const typeMatch = firstLine.match(/type\s*:\s*(\w+)/i);
    const msgType = typeMatch ? typeMatch[1] : 'Information';
    const text = body.split('\n').slice(typeMatch ? 1 : 0).join('\n').trim() || firstLine.replace(/type\s*:\s*\w+/i, '').trim();
    return { type: 'messagestrip', msgType, text };
  }

  function parseOptions(body) {
    var items = body.split('\n')
      .map(function(l) { return l.trim(); })
      .filter(function(l) { return l.startsWith('-'); })
      .map(function(l) { return l.replace(/^-\s*/, ''); });
    return { type: 'options', items: items };
  }

  function parsePre(body) {
    return { type: 'pre', value: body };
  }

  function parseRichList(body) {
    var lines = body.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
    var header = null, headerCount = null, subtitle = null, headerBullets = [];
    var items = [], footer = [];
    lines.forEach(function(line) {
      if (line.startsWith('header:')) {
        var parts = line.replace('header:', '').split('|').map(function(s) { return s.trim(); });
        header = parts[0];
        headerCount = parts[1] || null;
      } else if (line.startsWith('subtitle:')) {
        subtitle = line.replace('subtitle:', '').trim();
      } else if (line.startsWith('bullet:')) {
        headerBullets.push(line.replace('bullet:', '').trim());
      } else if (line.startsWith('item:')) {
        var parts = line.replace('item:', '').split('|').map(function(s) { return s.trim(); });
        var item = { title: parts[0] || '' };
        // Parse remaining parts for subtitle, description, status, button
        for (var i = 1; i < parts.length; i++) {
          var p = parts[i];
          if (!p) continue;
          if (p.startsWith('status:')) {
            var statusParts = p.replace('status:', '').split(',');
            item.statusText = statusParts[0].trim();
            item.statusState = statusParts[1] ? statusParts[1].trim() : 'Success';
          } else if (p.startsWith('button:')) {
            item.button = p.replace('button:', '').trim();
          } else if (!item.subtitle) {
            item.subtitle = p;
          } else {
            item.description = p;
          }
        }
        items.push(item);
      } else if (line.startsWith('footer:')) {
        footer = line.replace('footer:', '').split('|').map(function(s) { return s.trim(); });
      }
    });
    return { type: 'richlist', header: header, headerCount: headerCount, subtitle: subtitle, headerBullets: headerBullets, items: items, footer: footer };
  }

  function parseChips(body) {
    var rows = body.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
    var chipRows = rows.map(function(row) {
      return row.split('|').map(function(s) { return s.trim(); });
    });
    return { type: 'chips', rows: chipRows };
  }

  function parseProgress(body) {
    var lines = body.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
    var data = { value: 0, text: '', state: 'None' };
    lines.forEach(function(line) {
      if (line.startsWith('value:')) data.value = parseInt(line.replace('value:', '').trim()) || 0;
      else if (line.startsWith('text:')) data.text = line.replace('text:', '').trim();
      else if (line.startsWith('state:')) data.state = line.replace('state:', '').trim();
    });
    return { type: 'progress', value: data.value, text: data.text, state: data.state };
  }

  // Joule Sapphire Status Card — the thinking-state affordance live renders while Joule works.
  // FORK = TRANSIENT stub (D1 revised): the card renders as the thinking state, dwells ~2600ms,
  // then is removed just before the answer bubble (see advanceConversation). Closer to live's
  // remove-on-completion, with a visible dwell so it's demonstrable. Stage-3 state only (shimmer
  // bar + one completed step + chevron tab). All geometry/tokens LIVE-MEASURED from CSSOM
  // 2026-07-16. Only the fields the Stage-3 stub needs are parsed (step label + icon).
  function parseStatusCard(body) {
    var lines = body.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
    var data = { step: '', stepIcon: 'accept' };
    lines.forEach(function(line) {
      if (line.startsWith('step:')) data.step = line.replace('step:', '').trim();
      else if (line.startsWith('icon:')) data.stepIcon = line.replace('icon:', '').trim();
    });
    return { type: 'statuscard', step: data.step, stepIcon: data.stepIcon };
  }

  function parseFlowList(body) {
    var lines = body.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
    var nodes = [];
    lines.forEach(function(line) {
      if (line.startsWith('node:')) {
        var parts = line.replace('node:', '').split('|').map(function(s) { return s.trim(); });
        var node = {
          title: parts[0] || '',
          subtitle: parts[1] || '',
          description: parts[2] || ''
        };
        // Check for status in description or as separate part
        for (var i = 2; i < parts.length; i++) {
          if (parts[i] && parts[i].startsWith('status:')) {
            var statusParts = parts[i].replace('status:', '').split(',');
            node.statusText = statusParts[0].trim();
            node.statusState = statusParts[1] ? statusParts[1].trim() : 'Success';
            node.description = parts[2] && !parts[2].startsWith('status:') ? parts[2] : '';
            break;
          }
        }
        nodes.push(node);
      } else if (line.startsWith('arrow:') || line.startsWith('connector:')) {
        // Parse arrow labels: "arrow: Join by store_id"
        var label = line.replace(/^(arrow|connector):\s*/, '').trim();
        nodes.push({ type: 'arrow', label: label });
      }
    });
    return { type: 'flowlist', nodes: nodes };
  }

  function parseFlow(body) {
    var lines = body.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
    var rows = [];
    var connections = [];
    var nodeDefinitions = {};

    lines.forEach(function(line) {
      if (line.startsWith('row:')) {
        // Parse row: NodeId1 | NodeId2 | NodeId3
        var nodeIds = line.replace('row:', '').split('|').map(function(s) { return s.trim(); });
        rows.push(nodeIds);
      } else if (line.startsWith('connect:')) {
        // Parse connect: FromId -> ToId | Label
        var parts = line.replace('connect:', '').split('|').map(function(s) { return s.trim(); });
        var connectionPart = parts[0];
        var label = parts[1] || '';
        var match = connectionPart.match(/(\w+)\s*->\s*(\w+)/);
        if (match) {
          connections.push({ from: match[1], to: match[2], label: label });
        }
      } else if (line.startsWith('node:')) {
        // Parse node: NodeId | Title | Subtitle | Description | status:State,Color
        var parts = line.replace('node:', '').split('|').map(function(s) { return s.trim(); });
        var nodeId = parts[0];
        var node = {
          id: nodeId,
          title: parts[1] || nodeId,
          subtitle: parts[2] || '',
          description: parts[3] || ''
        };
        // Check for status
        for (var i = 3; i < parts.length; i++) {
          if (parts[i] && parts[i].startsWith('status:')) {
            var statusParts = parts[i].replace('status:', '').split(',');
            node.statusText = statusParts[0].trim();
            node.statusState = statusParts[1] ? statusParts[1].trim() : 'Success';
            node.description = parts[3] && !parts[3].startsWith('status:') ? parts[3] : '';
            break;
          }
        }
        nodeDefinitions[nodeId] = node;
      }
    });

    return { type: 'flow', rows: rows, connections: connections, nodes: nodeDefinitions };
  }

  // ── SAPUI5 Component Factory ───────────────────────────────────────
  function renderUI5Component(component, container) {
    if (!ui5Ready) {
      // Queue for re-render once UI5 is ready
      pendingUI5Renders.push({ component: component, container: container });
      renderFallback(component, container);
      return;
    }

    switch (component.type) {
      case 'table':   renderUI5Table(component, container); break;
      case 'list':    renderUI5List(component, container); break;
      case 'objectheader': renderUI5ObjectHeader(component, container); break;
      case 'messagestrip': renderUI5MessageStrip(component, container); break;
      case 'options': renderOptions(component, container); break;
      case 'pre': renderPre(component, container); break;
      case 'richlist': renderRichList(component, container); break;
      case 'flowlist': renderFlowList(component, container); break;
      case 'flow': renderFlow(component, container); break;
      case 'chips': renderChipsBlock(component, container); break;
      case 'progress': renderUI5Progress(component, container); break;
      case 'statuscard': renderStatusCard(component, container); break;
    }
  }

  function renderUI5Table(data, container) {
    container.classList.add('sapUiSizeCompact');

    var columns = data.columns.map(function(col) {
      return new sap.m.Column({
        header: new sap.m.Label({ text: col }),
        hAlign: 'Begin'
      });
    });

    var items = data.rows.map(function(row) {
      var cells = row.map(function(cell) {
        return new sap.m.Text({ text: cell });
      });
      return new sap.m.ColumnListItem({ cells: cells });
    });

    var table = new sap.m.Table({
      columns: columns,
      items: items,
      showSeparators: 'Inner',
      backgroundDesign: 'Transparent',
      fixedLayout: false
    });

    table.placeAt(container);
  }

  function renderUI5List(data, container) {
    container.classList.add('sapUiSizeCompact');

    var items = data.items.map(function(item) {
      // Support "Key: Value" format — only split on first colon
      var colonIdx = item.indexOf(':');
      if (colonIdx > 0 && colonIdx < 40) {
        return new sap.m.StandardListItem({
          title: item.substring(0, colonIdx).trim(),
          description: item.substring(colonIdx + 1).trim(),
          type: 'Inactive'
        });
      }
      return new sap.m.StandardListItem({
        title: item,
        type: 'Inactive'
      });
    });

    var list = new sap.m.List({
      items: items,
      showSeparators: 'Inner',
      backgroundDesign: 'Transparent'
    });

    list.placeAt(container);
  }

  function renderUI5ObjectHeader(data, container) {
    var attrs = (data.attributes || []).map(function(a) {
      return new sap.m.ObjectAttribute({ text: a });
    });

    var stats = (data.statuses || []).map(function(s) {
      return new sap.m.ObjectStatus({ text: s.text, state: s.state });
    });

    var header = new sap.m.ObjectHeader({
      title: data.title || '',
      number: data.number || '',
      numberUnit: data.numberUnit || '',
      attributes: attrs,
      statuses: stats,
      backgroundDesign: 'Transparent'
    });

    header.placeAt(container);
  }

  function renderUI5MessageStrip(data, container) {
    var typeMap = {
      'info': 'Information', 'information': 'Information',
      'warning': 'Warning', 'error': 'Error', 'success': 'Success'
    };
    var strip = new sap.m.MessageStrip({
      text: data.text,
      type: typeMap[data.msgType.toLowerCase()] || 'Information',
      showIcon: true,
      showCloseButton: false
    });

    strip.placeAt(container);
  }

  function renderOptions(data, container) {
    var div = document.createElement('div');
    div.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:4px 0;';
    data.items.forEach(function(item) {
      var btn = document.createElement('button');
      btn.style.cssText = 'background:' + _tokBtnBg + ';border:1px solid #d1d1d1;border-radius:12px;padding:8px 16px;font-family:72,sans-serif;font-size:14px;color:' + _tokLink + ';cursor:pointer;text-align:left;transition:all 0.15s;box-shadow:0px 0px 1px rgba(27,144,255,0.12),0px 2px 4px rgba(27,144,255,0.12);';
      btn.textContent = item;
      btn.onmouseenter = function() { btn.style.background = '#f0f5ff'; btn.style.borderColor = _tokLink; };
      btn.onmouseleave = function() { btn.style.background = _tokBtnBg; btn.style.borderColor = '#d1d1d1'; };
      btn.onclick = function(e) { e.stopPropagation(); };
      div.appendChild(btn);
    });
    container.appendChild(div);
  }

  function renderPre(data, container) {
    var pre = document.createElement('pre');
    pre.style.cssText = 'font-family:"72 Mono","Courier New",monospace;font-size:11px;line-height:1.45;background:rgba(0,0,0,0.03);border-radius:8px;padding:12px;overflow-x:auto;white-space:pre;color:' + _tokText + ';margin:4px 0;';
    pre.textContent = data.value;
    container.appendChild(pre);
  }

  function renderRichList(data, container) {
    var card = document.createElement('div');
    card.className = 'joule-richlist';

    // Header
    if (data.header) {
      var headerEl = document.createElement('div');
      headerEl.className = 'joule-richlist-header';
      var titleRow = document.createElement('div');
      titleRow.className = 'joule-richlist-title-row';
      var title = document.createElement('span');
      title.className = 'joule-richlist-title';
      title.textContent = data.header;
      titleRow.appendChild(title);
      if (data.headerCount) {
        var count = document.createElement('span');
        count.className = 'joule-richlist-count';
        count.textContent = data.headerCount;
        titleRow.appendChild(count);
      }
      headerEl.appendChild(titleRow);
      if (data.subtitle) {
        var sub = document.createElement('p');
        sub.className = 'joule-richlist-subtitle';
        sub.textContent = data.subtitle;
        headerEl.appendChild(sub);
      }
      if (data.headerBullets.length > 0) {
        var ul = document.createElement('ul');
        ul.className = 'joule-richlist-bullets';
        data.headerBullets.forEach(function(b) {
          var li = document.createElement('li');
          li.textContent = b;
          ul.appendChild(li);
        });
        headerEl.appendChild(ul);
      }
      card.appendChild(headerEl);
    }

    // Items
    var content = document.createElement('div');
    content.className = 'joule-richlist-content';
    data.items.forEach(function(item) {
      var row = document.createElement('div');
      row.className = 'joule-richlist-item';

      // Avatar
      var avatar = document.createElement('div');
      avatar.className = 'joule-richlist-avatar';
      avatar.innerHTML = '<span style="font-family:SAP-icons;font-size:18px;color:' + _tokPositive + ';">&#xe1a8;</span>';
      row.appendChild(avatar);

      // Text content
      var textArea = document.createElement('div');
      textArea.className = 'joule-richlist-text';
      var t = document.createElement('div');
      t.className = 'joule-richlist-item-title';
      t.textContent = item.title;
      textArea.appendChild(t);
      if (item.subtitle) {
        var s = document.createElement('div');
        s.className = 'joule-richlist-item-subtitle';
        s.textContent = item.subtitle;
        textArea.appendChild(s);
      }
      if (item.description) {
        var d = document.createElement('div');
        d.className = 'joule-richlist-item-desc';
        d.innerHTML = formatInline(item.description);
        textArea.appendChild(d);
      }
      row.appendChild(textArea);

      // Status + action area
      var actionArea = document.createElement('div');
      actionArea.className = 'joule-richlist-action';
      if (item.statusText) {
        var stateColorMap = { Success: _tokPositive, Warning: _tokCritical, Error: _tokNegative, Information: _tokInformative, None: _tokNeutral };
        var statusEl = document.createElement('span');
        statusEl.className = 'joule-richlist-status';
        statusEl.style.color = stateColorMap[item.statusState] || stateColorMap.None;
        statusEl.textContent = item.statusText;
        actionArea.appendChild(statusEl);
      }
      if (item.button) {
        var btn = document.createElement('button');
        btn.className = 'joule-richlist-btn';
        btn.textContent = item.button;
        btn.onclick = function(e) { e.stopPropagation(); };
        actionArea.appendChild(btn);
      }
      row.appendChild(actionArea);

      content.appendChild(row);
    });
    card.appendChild(content);

    // Footer
    if (data.footer.length > 0) {
      var footerEl = document.createElement('div');
      footerEl.className = 'joule-richlist-footer';
      data.footer.forEach(function(label) {
        var btn = document.createElement('button');
        btn.className = 'joule-richlist-footer-btn';
        btn.textContent = label;
        btn.onclick = function(e) { e.stopPropagation(); };
        footerEl.appendChild(btn);
      });
      card.appendChild(footerEl);
    }

    container.appendChild(card);
  }

  function renderFlowList(data, container) {
    var flowContainer = document.createElement('div');
    flowContainer.className = 'joule-flowlist';

    data.nodes.forEach(function(node, index) {
      if (node.type === 'arrow') {
        // Render connector/arrow between nodes
        var connector = document.createElement('div');
        connector.className = 'joule-flowlist-connector';

        var arrowIcon = document.createElement('div');
        arrowIcon.className = 'joule-flowlist-arrow';
        arrowIcon.innerHTML = '&#xe1ed;'; // SAP icon: arrow-down
        connector.appendChild(arrowIcon);

        if (node.label) {
          var label = document.createElement('div');
          label.className = 'joule-flowlist-connector-label';
          label.textContent = node.label;
          connector.appendChild(label);
        }

        flowContainer.appendChild(connector);
      } else {
        // Render flow node (card)
        var card = document.createElement('div');
        card.className = 'joule-flowlist-node';

        var title = document.createElement('div');
        title.className = 'joule-flowlist-node-title';
        title.textContent = node.title;
        card.appendChild(title);

        if (node.subtitle) {
          var subtitle = document.createElement('div');
          subtitle.className = 'joule-flowlist-node-subtitle';
          subtitle.textContent = node.subtitle;
          card.appendChild(subtitle);
        }

        if (node.description) {
          var desc = document.createElement('div');
          desc.className = 'joule-flowlist-node-desc';
          desc.textContent = node.description;
          card.appendChild(desc);
        }

        if (node.statusText) {
          var stateColorMap = {
            Success: _tokPositive,
            Warning: _tokCritical,
            Error: _tokNegative,
            Information: _tokInformative,
            None: _tokNeutral
          };
          var statusEl = document.createElement('div');
          statusEl.className = 'joule-flowlist-node-status';
          statusEl.style.color = stateColorMap[node.statusState] || stateColorMap.Success;
          statusEl.textContent = node.statusText;
          card.appendChild(statusEl);
        }

        flowContainer.appendChild(card);
      }
    });

    container.appendChild(flowContainer);
  }

  function renderFlow(data, container) {
    var flowDiagram = document.createElement('div');
    flowDiagram.className = 'joule-flow-diagram';

    // Create a map to store node elements and their positions
    var nodeElements = {};
    var nodePositions = {};

    // Render rows of nodes
    data.rows.forEach(function(rowNodeIds, rowIndex) {
      var rowEl = document.createElement('div');
      rowEl.className = 'joule-flow-row';

      rowNodeIds.forEach(function(nodeId) {
        var nodeDef = data.nodes[nodeId];
        if (!nodeDef) return;

        var nodeEl = document.createElement('div');
        nodeEl.className = 'joule-flow-node';
        nodeEl.setAttribute('data-node-id', nodeId);

        var titleEl = document.createElement('div');
        titleEl.className = 'joule-flow-node-title';
        titleEl.textContent = nodeDef.title;
        nodeEl.appendChild(titleEl);

        if (nodeDef.subtitle) {
          var subtitleEl = document.createElement('div');
          subtitleEl.className = 'joule-flow-node-subtitle';
          subtitleEl.textContent = nodeDef.subtitle;
          nodeEl.appendChild(subtitleEl);
        }

        if (nodeDef.description) {
          var descEl = document.createElement('div');
          descEl.className = 'joule-flow-node-desc';
          descEl.textContent = nodeDef.description;
          nodeEl.appendChild(descEl);
        }

        if (nodeDef.statusText) {
          var stateColorMap = {
            Success: _tokPositive,
            Warning: _tokCritical,
            Error: _tokNegative,
            Information: _tokInformative,
            None: _tokNeutral
          };
          var statusEl = document.createElement('div');
          statusEl.className = 'joule-flow-node-status';
          statusEl.style.color = stateColorMap[nodeDef.statusState] || stateColorMap.Success;
          statusEl.textContent = nodeDef.statusText;
          nodeEl.appendChild(statusEl);
        }

        rowEl.appendChild(nodeEl);
        nodeElements[nodeId] = nodeEl;
      });

      flowDiagram.appendChild(rowEl);
    });

    container.appendChild(flowDiagram);

    // After DOM insertion, calculate positions and draw connectors
    setTimeout(function() {
      // Calculate node center positions
      Object.keys(nodeElements).forEach(function(nodeId) {
        var el = nodeElements[nodeId];
        var rect = el.getBoundingClientRect();
        var containerRect = flowDiagram.getBoundingClientRect();
        nodePositions[nodeId] = {
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top + rect.height / 2,
          bottom: rect.bottom - containerRect.top,
          top: rect.top - containerRect.top
        };
      });

      // Create SVG overlay for connectors
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'joule-flow-svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', flowDiagram.offsetHeight);
      svg.style.position = 'absolute';
      svg.style.top = '0';
      svg.style.left = '0';
      svg.style.pointerEvents = 'none';

      // Draw connectors
      data.connections.forEach(function(conn, connIndex) {
        var fromPos = nodePositions[conn.from];
        var toPos = nodePositions[conn.to];
        if (!fromPos || !toPos) return;

        // Calculate horizontal offset for parallel connections
        // Check if multiple connections go to same target
        var parallelConns = data.connections.filter(function(c) {
          return c.to === conn.to && nodePositions[c.from];
        });

        var offsetMultiplier = 0;
        if (parallelConns.length > 1) {
          // Find index of current connection among parallel ones
          var myIndex = parallelConns.indexOf(conn);
          // Spread connections horizontally (reduced for smaller nodes)
          var totalSpread = Math.min(parallelConns.length - 1, 3) * 20; // Max 60px spread
          offsetMultiplier = (myIndex - (parallelConns.length - 1) / 2) * (totalSpread / (parallelConns.length - 1));
        }

        // Create straight path from bottom of source to top of target
        var startX = fromPos.x;
        var startY = fromPos.bottom;
        var endX = toPos.x + offsetMultiplier;
        var endY = toPos.top;

        // Create straight line path
        var d = 'M ' + startX + ' ' + startY +
                ' L ' + endX + ' ' + endY;

        // Create path
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', 'joule-flow-connector');
        svg.appendChild(path);

        // Add arrowhead - rotated to match line angle
        var arrowSize = 4;

        // Calculate angle of the line
        var dx = endX - startX;
        var dy = endY - startY;
        var angle = Math.atan2(dy, dx) * 180 / Math.PI;

        // Create arrow polygon pointing right (0 degrees)
        var arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        var points = '0,0 ' +
                     (-arrowSize * 1.5) + ',' + (-arrowSize) + ' ' +
                     (-arrowSize * 1.5) + ',' + arrowSize;
        arrow.setAttribute('points', points);
        arrow.setAttribute('class', 'joule-flow-arrow');

        // Rotate and position the arrow at the end point
        var transform = 'translate(' + endX + ',' + endY + ') rotate(' + angle + ')';
        arrow.setAttribute('transform', transform);

        svg.appendChild(arrow);

        // Add label if present
        if (conn.label) {
          // Position label along the curve
          var labelX, labelY;

          if (parallelConns.length > 1) {
            // For parallel connections, place label offset from center
            labelX = (startX + endX) / 2 + offsetMultiplier * 0.7;
            labelY = (startY + endY) / 2;
          } else {
            // For single connection, center the label
            labelX = (startX + endX) / 2;
            labelY = (startY + endY) / 2;
          }

          // Background rect for label
          var bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          var labelWidth = Math.max(60, conn.label.length * 4.5);
          bgRect.setAttribute('x', labelX - labelWidth / 2);
          bgRect.setAttribute('y', labelY - 9);
          bgRect.setAttribute('width', labelWidth);
          bgRect.setAttribute('height', 16);
          bgRect.setAttribute('fill', _tokContentBg);
          bgRect.setAttribute('fill-opacity', '0.95');
          bgRect.setAttribute('rx', '4');
          bgRect.setAttribute('stroke', '#e0e0e0');
          bgRect.setAttribute('stroke-width', '0.5');

          var textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          textEl.setAttribute('x', labelX);
          textEl.setAttribute('y', labelY + 3);
          textEl.setAttribute('class', 'joule-flow-label');
          textEl.setAttribute('text-anchor', 'middle');
          textEl.textContent = conn.label;

          svg.appendChild(bgRect);
          svg.appendChild(textEl);
        }
      });

      flowDiagram.style.position = 'relative';
      flowDiagram.appendChild(svg);
    }, 100);
  }

  function renderChipsBlock(data, container) {
    var wrapper = document.createElement('div');
    wrapper.className = 'joule-chips-block';
    data.rows.forEach(function(row) {
      var rowEl = document.createElement('div');
      rowEl.className = 'joule-chips-row';
      row.forEach(function(label) {
        var btn = document.createElement('button');
        btn.className = 'joule-chip';
        btn.textContent = label;
        btn.onclick = function(e) { e.stopPropagation(); };
        rowEl.appendChild(btn);
      });
      wrapper.appendChild(rowEl);
    });
    container.appendChild(wrapper);
  }

  function renderUI5Progress(data, container) {
    if (ui5Ready) {
      // Restructure: render the label as a separate wrapping element ABOVE a value-less
      // ProgressIndicator. displayValue is a SHORT-value slot (white-space:nowrap +
      // ellipsis) — the Ariba `progress text:` DSL passes full sentences, which the
      // ~380px panel truncated (e.g. "…used this quarter" -> "…used"). Horizon also
      // absolutely-positions the in-bar text at top:2px inside the 32px control, which
      // overlapped the bar. Both defects are eliminated by moving the text out of the
      // control (showValue:false) into a wrapping .joule-progress-label (styled in
      // index.html). No specific Fiori pattern exists for label-above-progress in a chat
      // card (progress is an Ariba-fork DSL addition); label-as-body-text-above-bar is a
      // reasoned default matching what Horizon renders visually.
      var wrap = document.createElement('div');
      wrap.className = 'joule-progress';
      var label = document.createElement('div');
      label.className = 'joule-progress-label';
      label.textContent = data.text || (data.value + '%');
      wrap.appendChild(label);
      var barSlot = document.createElement('div');
      wrap.appendChild(barSlot);
      container.appendChild(wrap);
      var pi = new sap.m.ProgressIndicator({
        percentValue: data.value,
        state: data.state || 'None',
        showValue: false
      });
      pi.placeAt(barSlot);
    } else {
      renderProgressFallback(data, container);
    }
  }

  // renderProgressFallback and renderFallback are retained upstream fallback renderers.
  // They fire when a component renders BEFORE onUI5Ready — a real visible window on slow
  // loads (brief flash, then re-rendered post-ready via pendingUI5Renders). Not "dead code."
  // Status colors are tokenized via stateColors / stateColorMap above.
  // Remaining hardcoded values below are transient-accepted or genuine exceptions:
  //   #32363a: replaced with _tokText (progress fallback text — see renderProgressFallback below)
  //   #e8e8e8: progress bar track — no structural track token; transient-accepted
  //   rgba(0,0,0,0.04): alpha overlay — untokenizable; transient-accepted
  //   #ffd6d6/#fff3b8/#d1f0d1/#d6e8ff: fallback MessageStrip tints — transient-accepted
  //     (real sap.m.MessageStrip renders post-ready with correct theme-aware colors)
  function renderProgressFallback(data, container) {
    var stateColors = { None: _tokLink, Success: _tokPositive, Warning: _tokCritical, Error: _tokNegative, Critical: _tokCritical };
    var barColor = stateColors[data.state] || stateColors.None;
    var div = document.createElement('div');
    div.style.cssText = 'margin:4px 0;';
    div.innerHTML = '<div style="font-size:13px;color:' + _tokText + ';margin-bottom:4px;">' + escapeHtml(data.text || data.value + '%') + '</div>' +
      '<div style="height:6px;background:#e8e8e8;border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + data.value + '%;background:' + barColor + ';border-radius:4px;"></div></div>';
    container.appendChild(div);
  }

  // Joule Sapphire Status Card renderer — pure DOM/CSS (no sap.m control exists for a
  // shimmer-bar + step + chevron-tab composite). Stage-3 stub only: bar + one completed step
  // + chevron. Geometry/tokens LIVE-MEASURED (CSSOM 2026-07-16); all CSS lives in the
  // .joule-statuscard* rules in index.html. INERT (D2) — no hover/focus, no press handler.
  //
  // STEP ICON + CHEVRON codepoints are GATE-2 items. Live's step-icon `name` attr was never
  // captured (bounce-path card). Codepoints below are from IconPool.getIconInfo() with the icon
  // name recorded (SAPUI5 1.148.1) — NOT guessed hex (verification-hygiene). Glyph identity still
  // pending Will's visual confirmation: step = sap-icon://accept (U+E05B), chevron =
  // sap-icon://slim-arrow-down (U+E1EF) — collapsed one-step state points DOWN (expand affordance).
  // A wrong codepoint renders as a different valid glyph, not
  // a box — no DOM read catches it; confirm visually before merge. If you change either, re-source
  // from IconPool (never a synonym) and re-confirm the glyph.
  var _statusCardIcons = { accept: '\uE05B' }; // sap-icon://accept — IconPool 1.148.1
  var _statusCardChevron = '\uE1EF';           // sap-icon://slim-arrow-down — IconPool 1.148.1
  function renderStatusCard(data, container) {
    var iconGlyph = _statusCardIcons[data.stepIcon] || _statusCardIcons.accept;

    var card = document.createElement('div');
    card.className = 'joule-statuscard';

    // Indeterminate shimmer bar: transparent track + full-width token-colored fill + ::before shimmer
    var bar = document.createElement('div');
    bar.className = 'joule-statuscard-bar';
    var fill = document.createElement('div');
    fill.className = 'joule-statuscard-fill';
    bar.appendChild(fill);
    card.appendChild(bar);

    // One completed step (the sole step on the captured bounce path)
    var stepList = document.createElement('div');
    stepList.className = 'joule-statuscard-steplist';
    var step = document.createElement('div');
    step.className = 'joule-statuscard-step';
    var content = document.createElement('div');
    content.className = 'joule-statuscard-step-content';
    var icon = document.createElement('span');
    icon.className = 'joule-statuscard-step-icon';
    icon.textContent = iconGlyph;
    icon.setAttribute('aria-hidden', 'true');
    var label = document.createElement('span');
    label.className = 'joule-statuscard-step-text';
    label.textContent = data.step || '';
    content.appendChild(icon);
    content.appendChild(label);
    step.appendChild(content);
    stepList.appendChild(step);
    card.appendChild(stepList);

    // Chevron toggle tab — overhangs the card bottom edge (absolute). INERT stub: live's is a
    // working ui5-button that expands/collapses the step list; here it is decorative only.
    var toggle = document.createElement('div');
    toggle.className = 'joule-statuscard-toggle';
    var chevron = document.createElement('span');
    chevron.className = 'joule-statuscard-toggle-glyph';
    chevron.textContent = _statusCardChevron; // sap-icon://slim-arrow-down (U+E1EF) — GATE-2, confirm glyph
    chevron.setAttribute('aria-hidden', 'true');
    toggle.appendChild(chevron);
    card.appendChild(toggle);

    container.appendChild(card);
  }


  // Fallback rendering when UI5 is not yet loaded
  function renderFallback(component, container) {
    var div = document.createElement('div');
    div.style.cssText = 'padding:8px; font-size:13px; background:rgba(0,0,0,0.04); border-radius:4px; margin:4px 0;';

    switch (component.type) {
      case 'table':
        var html = '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
        html += '<tr>' + component.columns.map(function(c) { return '<th style="text-align:left;padding:6px 8px;border-bottom:2px solid ' + _tokListBorder + ';color:' + _tokNeutral + ';">' + escapeHtml(c) + '</th>'; }).join('') + '</tr>';
        component.rows.forEach(function(row) {
          html += '<tr>' + row.map(function(cell) { return '<td style="padding:6px 8px;border-bottom:1px solid ' + _tokListBorder + ';">' + escapeHtml(cell) + '</td>'; }).join('') + '</tr>';
        });
        html += '</table>';
        div.innerHTML = html;
        break;
      case 'list':
        div.innerHTML = '<ul style="margin:0;padding-left:20px;">' + component.items.map(function(item) { return '<li style="padding:2px 0;">' + escapeHtml(item) + '</li>'; }).join('') + '</ul>';
        break;
      case 'messagestrip':
        var colors = { error: '#ffd6d6', warning: '#fff3b8', success: '#d1f0d1', information: '#d6e8ff' };
        var bg = colors[component.msgType.toLowerCase()] || colors.information;
        div.style.background = bg;
        div.textContent = component.text;
        break;
      case 'options':
        renderOptions(component, div);
        div.style.background = 'none';
        div.style.padding = '0';
        break;
      case 'pre':
        renderPre(component, div);
        div.style.background = 'none';
        div.style.padding = '0';
        break;
      case 'richlist':
        renderRichList(component, div);
        div.style.background = 'none';
        div.style.padding = '0';
        break;
      case 'flowlist':
        renderFlowList(component, div);
        div.style.background = 'none';
        div.style.padding = '0';
        break;
      case 'flow':
        renderFlow(component, div);
        div.style.background = 'none';
        div.style.padding = '0';
        break;
      case 'chips':
        renderChipsBlock(component, div);
        div.style.background = 'none';
        div.style.padding = '0';
        break;
      case 'progress':
        renderProgressFallback(component, div);
        div.style.background = 'none';
        div.style.padding = '0';
        break;
      case 'statuscard':
        // Pure DOM/CSS card (no sap.m control) — fallback output is identical to the ready
        // path, so a pre-onUI5Ready flash re-renders identically. renderFallback is NOT dead
        // code (see comment above renderProgressFallback).
        renderStatusCard(component, div);
        div.style.background = 'none';
        div.style.padding = '0';
        break;
      default:
        div.textContent = JSON.stringify(component);
    }

    container.appendChild(div);
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function formatInline(text) {
    var escaped = escapeHtml(text);
    // Bold: **text**
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Inline code: `text`
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Background switching links: [text](bg:image.png)
    escaped = escaped.replace(/\[([^\]]+)\]\(bg:([^)]+)\)/g, function(match, linkText, bgImage) {
      return '<a href="#" class="joule-bg-link" data-bg="' + bgImage + '">' + linkText + '</a>';
    });
    // Conversation-switch links: [text](conv:conversation-name)
    // Mirrors the bg: link above. The target name is author-controlled literal DSL, not
    // user input. Note escapeHtml (textContent→innerHTML) escapes & < > but NOT double
    // quotes, so it is not an attribute-value guard here. The real sanitization happens at
    // navigation time: the click handler does a full iframe reload and index.html's loader
    // strips the name via convFile.replace(/[^a-zA-Z0-9_-]/g,'') before use.
    escaped = escaped.replace(/\[([^\]]+)\]\(conv:([^)]+)\)/g, function(match, linkText, conv) {
      return '<a href="#" class="joule-conv-link" data-conv="' + conv + '">' + linkText + '</a>';
    });
    // External links: [text](https://…) — open in a new tab. Registered AFTER bg:/conv: so
    // those internal-link rules match first; the https?:// anchor prevents this rule from
    // swallowing a bg:/conv: target and rejects javascript: and other schemes by construction.
    // target=_blank is structural, not cosmetic: the conversation renders inside an iframe
    // (joule-panel.js), so an untargeted <a> would navigate the panel itself to the external
    // site, leaving the shell wrapped around it with no return path. The href is an author-
    // controlled literal https URL (no raw double quote); no user input reaches it.
    escaped = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, function(match, linkText, url) {
      return '<a href="' + url + '" class="joule-ext-link" target="_blank" rel="noopener">' + linkText + '</a>';
    });
    return escaped;
  }

  function renderTextContent(text, container) {
    // First, check for code blocks and split by them
    var codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    var lastIndex = 0;
    var match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Render text before code block
      var beforeText = text.substring(lastIndex, match.index);
      if (beforeText.trim()) {
        renderTextParagraphs(beforeText, container);
      }

      // Render code block with line numbers
      var language = match[1] || '';
      var code = match[2];
      var pre = document.createElement('pre');
      pre.className = 'joule-code-block';
      if (language) {
        pre.setAttribute('data-language', language);
      }

      // Split code into lines and add line numbers
      var lines = code.split('\n');
      if (lines[lines.length - 1] === '') lines.pop(); // Remove empty last line

      var lineNumbersEl = document.createElement('div');
      lineNumbersEl.className = 'joule-code-line-numbers';

      var codeContentEl = document.createElement('div');
      codeContentEl.className = 'joule-code-content';

      var codeEl = document.createElement('code');
      lines.forEach(function(line, index) {
        var lineNum = document.createElement('span');
        lineNum.className = 'joule-code-line-number';
        lineNum.textContent = (index + 1);
        lineNumbersEl.appendChild(lineNum);

        var codeLine = document.createElement('span');
        codeLine.className = 'joule-code-line';
        codeLine.textContent = line || '\n';
        codeEl.appendChild(codeLine);
      });

      codeContentEl.appendChild(codeEl);
      pre.appendChild(lineNumbersEl);
      pre.appendChild(codeContentEl);
      container.appendChild(pre);

      lastIndex = codeBlockRegex.lastIndex;
    }

    // Render remaining text after last code block
    var remainingText = text.substring(lastIndex);
    if (remainingText.trim()) {
      renderTextParagraphs(remainingText, container);
    }
  }

  function renderTextParagraphs(text, container) {
    var paragraphs = text.split('\n\n');
    paragraphs.forEach(function(para) {
      var trimmed = para.trim();
      if (!trimmed) return;

      var lines = trimmed.split('\n');
      var currentList = null;
      var currentListType = null;

      function flushList() {
        if (!currentList) return;
        var el = document.createElement(currentListType);
        el.style.margin = '4px 0';
        el.style.paddingLeft = '20px';
        currentList.forEach(function(item) {
          var li = document.createElement('li');
          li.style.padding = '2px 0';
          li.innerHTML = formatInline(item);
          el.appendChild(li);
        });
        container.appendChild(el);
        currentList = null;
        currentListType = null;
      }

      lines.forEach(function(line) {
        var t = line.trim();
        if (!t) return;

        var olMatch = t.match(/^(\d+)\.\s+(.+)/);
        var ulMatch = t.match(/^[-•]\s+(.+)/);

        if (olMatch) {
          if (currentListType !== 'ol') { flushList(); currentList = []; currentListType = 'ol'; }
          currentList.push(olMatch[2]);
        } else if (ulMatch) {
          if (currentListType !== 'ul') { flushList(); currentList = []; currentListType = 'ul'; }
          currentList.push(ulMatch[1]);
        } else {
          flushList();
          var p = document.createElement('p');
          p.innerHTML = formatInline(t);
          container.appendChild(p);
        }
      });

      flushList();
    });
  }

  // ── Message Renderer ───────────────────────────────────────────────
  function createMessageElement(msg) {
    var wrapper = document.createElement('div');
    wrapper.className = 'joule-msg joule-msg--' + msg.role;

    var bubble = document.createElement('div');
    bubble.className = 'joule-msg-bubble';

    // Separate blocks that go outside the bubble (chips, options)
    var outsideBlocks = [];
    // Status card (D1 transient): NOT rendered inline here. The playback loop (advanceConversation)
    // renders the card alone, dwells, removes it, THEN builds this message without the card. So the
    // statuscard block is skipped in this builder — see renderStatusCardElement + advanceConversation.
    msg.content.forEach(function(block) {
      if (block.type === 'chips' || block.type === 'options') {
        outsideBlocks.push(block);
      } else if (block.type === 'statuscard') {
        // Skip: playback-owned transient affordance, rendered/removed before this bubble exists.
      } else if (block.type === 'text') {
        renderTextContent(block.value, bubble);
      } else {
        // Rich component — create a container div
        var richDiv = document.createElement('div');
        richDiv.className = 'joule-msg-rich';
        var componentContainer = document.createElement('div');
        componentContainer.id = 'ui5_' + Math.random().toString(36).substr(2, 9);
        richDiv.appendChild(componentContainer);
        bubble.appendChild(richDiv);

        // Render the UI5 component
        renderUI5Component(block, componentContainer);
      }
    });

    wrapper.appendChild(bubble);

    // Action row: Joule messages only — always-visible inert stubs (deliberate divergence from
    // live's hover-reveal; fork has no hover interaction model so hover-reveal would be invisible)
    if (msg.role === 'joule') {
      wrapper.appendChild(renderMessageActions());
    }

    // Render chips/options outside the bubble
    outsideBlocks.forEach(function(block) {
      var outerDiv = document.createElement('div');
      outerDiv.className = 'joule-msg-outside';
      var componentContainer = document.createElement('div');
      componentContainer.id = 'ui5_' + Math.random().toString(36).substr(2, 9);
      outerDiv.appendChild(componentContainer);
      renderUI5Component(block, componentContainer);
      wrapper.appendChild(outerDiv);
    });

    return wrapper;
  }

  // D1 transient: builds the standalone status-card element (the thinking-state affordance) as a
  // .joule-statuscard-outside wrapper. The playback loop appends this, dwells, then removes it and
  // renders the answer bubble. Own outside class (NOT .joule-msg-outside): under a flex column with
  // align-items:flex-start the wrapper is the flex item, so it must align-self:stretch (in CSS) to
  // reach 384 — the card's own align-self is inert (its parent is this block wrapper).
  function renderStatusCardElement(block) {
    var wrapper = document.createElement('div');
    wrapper.className = 'joule-msg joule-msg--joule visible';
    var cardOuter = document.createElement('div');
    cardOuter.className = 'joule-statuscard-outside';
    var cardContainer = document.createElement('div');
    cardContainer.id = 'ui5_' + Math.random().toString(36).substr(2, 9);
    cardOuter.appendChild(cardContainer);
    wrapper.appendChild(cardOuter);
    renderUI5Component(block, cardContainer);
    return wrapper;
  }

  function renderMessageActions() {
    var row = document.createElement('div');
    row.className = 'joule-action-row';
    // Five buttons matching live's DOM (GATE-A: div.dasMessageWidgets, one.int.sap 2026-07-15).
    // Codepoints are SOURCE LOOKUPS from SAPUI5 1.148.1 IconPool — NOT render-verified by probe.
    // A wrong codepoint renders as a different valid SAP icon, not a box, so no DOM read can catch it.
    // Glyph identity confirmed visually by Will 2026-07-15. If you change a codepoint, re-confirm visually.
    // History: the original spec substituted sap-icon://hint for live's icon name="lightbulb" and dropped
    // refresh entirely. Both shipped through every review because the artifacts were self-consistent.
    // Carry live's measured icon name verbatim — never a synonym.
    var buttons = [
      { icon: '\uE245', label: 'Copy',        icon_name: 'copy' },
      { icon: '\uE222', label: 'Helpful',     icon_name: 'thumb-up' },
      { icon: '\uE223', label: 'Not helpful', icon_name: 'thumb-down' },
      { icon: '\uE010', label: 'Regenerate',  icon_name: 'refresh' },
      { icon: '\uE024', label: 'Lightbulb',   icon_name: 'lightbulb' }
    ];
    buttons.forEach(function(b) {
      var btn = document.createElement('button');
      btn.className = 'joule-action-btn';
      btn.setAttribute('aria-label', b.label);
      /* STUB: live's action buttons are enabled <button class="dasResponseActionButton"> with working
         handlers (copy → ui5-toast, thumbs → dasResponseActionButton--selected). disabled="" here marks
         these inert for the prototype — it is NOT a live-measured state. Remove when behavior is wired. */
      btn.setAttribute('disabled', '');
      btn.textContent = b.icon;
      row.appendChild(btn);
    });
    return row;
  }

  function createTypingIndicator() {
    var div = document.createElement('div');
    div.className = 'joule-typing';
    div.innerHTML = '<div class="joule-typing-bubble"><div class="joule-typing-dot"></div><div class="joule-typing-dot"></div><div class="joule-typing-dot"></div></div>';
    return div;
  }

  function createChips(chips) {
    var wrapper = document.createElement('div');
    wrapper.className = 'joule-chips';
    chips.forEach(function(label) {
      var btn = document.createElement('button');
      btn.className = 'joule-chip';
      btn.textContent = label;
      btn.addEventListener('click', function() {
        startConversation(label);
      });
      wrapper.appendChild(btn);
    });
    return wrapper;
  }

  // ── Welcome Screen ─────────────────────────────────────────────────
  function renderWelcome(conv) {
    // Help bubble
    var helpContainer = document.getElementById('welcomeHelp');
    if (helpContainer) {
      var helpBubble = document.createElement('div');
      helpBubble.className = 'joule-welcome-help-bubble';
      helpBubble.textContent = conv.contextMessage || 'Talk to me naturally. For example, \u201cwhat are my tasks for today?\u201d';
      helpContainer.appendChild(helpBubble);
    }

    // Quick reply chips
    if (conv.chips.length > 0) {
      var chipsEl = createChips(conv.chips);
      chipsEl.classList.add('visible');
      welcomeContent.appendChild(chipsEl);
    }

    // Auto-focus input field so user can press Enter to start
    inputEl.focus();
  }

  // ── Conversation Playback ──────────────────────────────────────────
  function startConversation(chipText) {
    // JUMP-CUT (LIVE-MEASURED 2026-07-17): welcome→conversation is a jump-cut, not a fade.
    // Hide welcome and show conversation on the SAME tick — no 500ms fade-wait (which would now
    // leave a blank-panel gap since .leaving hides instantly via CSS). .joule-body.entering still
    // animates the conversation IN (untouched — no live finding against it).
    welcomeScreen.classList.add('leaving');
    welcomeScreen.classList.add('hidden');

    // Show conversation screen (entering animation plays it in)
    conversationScr.style.display = 'flex';
    conversationScr.classList.add('entering');
    if (overflowBtn) { overflowBtn.style.display = ''; }

    // mesh belongs to the welcome state only — remove it once conversation begins
    if (jouleMesh) { jouleMesh.classList.add('joule-mesh-hidden'); }

    // next tick: trigger the conversation-enter animation + begin playback
    setTimeout(function() {
      conversationScr.classList.add('visible');

      // Timestamp
      if (parsedConversation.timestamp) {
        var tsDiv = document.createElement('div');
        tsDiv.className = 'joule-timestamp';
        tsDiv.innerHTML = parsedConversation.timestamp;
        conversationEl.appendChild(tsDiv);
      }

      currentStep = 0;
      isPlaying = true;

      // If a chip was clicked, show that as the first user message
      if (chipText && parsedConversation.messages.length > 0 && parsedConversation.messages[0].role === 'user') {
        // Replace first user message text with chip text if desired, or just advance
      }

      // Small delay before first message for smooth feeling
      setTimeout(function() {
        advanceConversation();
      }, 300);
    }, 20);
  }

  function advanceConversation() {
    if (isAdvancing) return;
    if (currentStep >= parsedConversation.messages.length) {
      isPlaying = false;
      isAdvancing = false;
      enableInput();
      return;
    }

    isAdvancing = true;
    var msg = parsedConversation.messages[currentStep];
    currentStep++;

    // Update background image if specified
    if (msg.bg) {
      document.body.style.backgroundImage = "url('assets/" + msg.bg + "')";
    }

    if (msg.role === 'user') {
      var el = createMessageElement(msg);
      conversationEl.appendChild(el);
      requestAnimationFrame(function() {
        el.classList.add('visible');
        scrollToBottom(conversationScr);
      });

      // Auto-advance to Joule response after a short delay
      setTimeout(function() { isAdvancing = false; advanceConversation(); }, 400);
    } else {
      // Show typing indicator
      var typing = createTypingIndicator();
      conversationEl.appendChild(typing);
      scrollToBottom(conversationScr);

      setTimeout(function() {
        // Remove typing indicator
        typing.remove();

        // Renders the answer message (bubble + action row + chips). Extracted so the transient
        // status card can run BEFORE it (card → dwell → remove → this).
        function renderJouleMessage() {
          var el = createMessageElement(msg);
          conversationEl.appendChild(el);

          // If there are chips after this message (last Joule message before a gap or end)
          var nextMsg = parsedConversation.messages[currentStep];
          var showChipsAfter = !nextMsg; // chips at end

          requestAnimationFrame(function() {
            el.classList.add('visible');
            // Scroll to show the previous USER message (the request) along with Joule's response
            var allMessages = conversationEl.querySelectorAll('.joule-msg');
            if (allMessages.length >= 2) {
              // Find the previous message (should be the user's request)
              var previousMsg = allMessages[allMessages.length - 2];
              scrollToShowElement(conversationScr, previousMsg);
            } else {
              // Fallback: show top of Joule's message if no previous message
              scrollToShowElement(conversationScr, el);
            }
          });

          // Wait for user to press Enter/Space to advance (if more messages)
          if (nextMsg) {
            isAdvancing = false;
            waitForAdvance();
          } else {
            isPlaying = false;
            isAdvancing = false;
            enableInput();
          }
        }

        // D1 transient: if this turn has a status card, show it as the thinking-state affordance,
        // dwell, then remove it and render the answer. Reuses the typing-indicator remove idiom
        // (append → setTimeout → .remove() → append next). Card and bubble never coexist.
        var STATUS_CARD_DWELL_MS = 2600; // fork-added, Will-confirmed; not live-measured
        var cardBlock = null;
        for (var ci = 0; ci < msg.content.length; ci++) {
          if (msg.content[ci].type === 'statuscard') { cardBlock = msg.content[ci]; break; }
        }
        if (cardBlock) {
          var cardEl = renderStatusCardElement(cardBlock);
          // Tweak D State 2: the thinking-state card is showing → "New Conversation".
          // Gated on title truthiness AND !titleLatched, so it fires only on the FIRST card
          // of a titled conversation (untitled conversations never touch the header).
          if (parsedConversation.title && !titleLatched) {
            setHeaderTitle('New Conversation');
          }
          conversationEl.appendChild(cardEl);
          scrollToBottom(conversationScr);
          setTimeout(function() {
            cardEl.remove(); // instant remove (Will-confirmed; matches typing-indicator precedent)
            // Tweak D State 3: answer replaces the card → show the conversation title and LATCH,
            // so subsequent status cards do not re-trigger State 2.
            if (parsedConversation.title && !titleLatched) {
              setHeaderTitle(parsedConversation.title);
              titleLatched = true;
            }
            renderJouleMessage();
          }, STATUS_CARD_DWELL_MS);
        } else {
          // Tweak D known gap: this no-card branch is intentionally NOT hooked. A title: script
          // with zero {{statuscard}} blocks holds "Joule" (State 2/3 fire only on a card). No
          // current script hits this (all examples have ≥1 card); the authoring-facing note that
          // title takes effect at the first status card lands in PR-D-content / ARIBA-AUTHORING.md.
          renderJouleMessage();
        }
      }, 800 + Math.random() * 600);
    }
  }

  function waitForAdvance() {
    // Advance on Enter or Space key while input field is focused
    inputEl.disabled = false;
    inputEl.focus();
    var handled = false;
    function keyHandler(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (handled) return;
        handled = true;
        inputEl.removeEventListener('keydown', keyHandler);
        inputEl.value = '';
        sendBtn.disabled = true;
        advanceConversation();
      }
    }
    inputEl.addEventListener('keydown', keyHandler);
  }

  function enableInput() {
    inputEl.disabled = false;
    inputEl.focus();
  }

  function scrollToBottom(container) {
    container.scrollTop = container.scrollHeight;
  }

  function scrollToShowElement(container, element) {
    // Scroll to show the top of the element with a small offset
    var elementTop = element.offsetTop;
    var offset = 20; // Small padding from top
    container.scrollTop = elementTop - offset;
  }

  // ── Input Handling ─────────────────────────────────────────────────
  inputEl.addEventListener('input', function() {
    sendBtn.disabled = !inputEl.value.trim();
  });

  inputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      // On welcome screen, Enter or Space starts conversation even with empty input
      if (!welcomeScreen.classList.contains('hidden')) {
        e.preventDefault();
        startConversation('');
        inputEl.value = '';
        sendBtn.disabled = true;
        return;
      }

      // If playing, don't interfere - waitForAdvance handler will deal with it
      if (isPlaying) {
        return;
      }

      // After playback, Enter sends user message if there's text
      // Space should not trigger send (to avoid accidental sends while typing)
      if (e.key === 'Enter' && inputEl.value.trim()) {
        sendMessage();
      }
    }
  });

  sendBtn.addEventListener('click', function() {
    if (inputEl.value.trim()) sendMessage();
  });

  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text) return;

    // If still on welcome screen, start conversation
    if (!welcomeScreen.classList.contains('hidden')) {
      startConversation(text);
      inputEl.value = '';
      sendBtn.disabled = true;
      return;
    }

    // Add user message
    var msg = { role: 'user', content: [{ type: 'text', value: text }] };
    var el = createMessageElement(msg);
    conversationEl.appendChild(el);
    requestAnimationFrame(function() {
      el.classList.add('visible');
      scrollToBottom(conversationScr);
    });

    inputEl.value = '';
    sendBtn.disabled = true;

    // If there are still messages in the queue, continue playback
    if (currentStep < parsedConversation.messages.length) {
      setTimeout(function() { advanceConversation(); }, 400);
    }
  }

  // ── SAPUI5 Ready ───────────────────────────────────────────────────
  function onUI5Ready() {
    // Resolve --sap tokens now that theme CSS is applied (SAPUI5 guarantees
    // theme-applied before firing require callbacks)
    _resolveTokens();
    ui5Ready = true;
    // Re-render any components that were queued with fallback HTML
    pendingUI5Renders.forEach(function(entry) {
      entry.container.innerHTML = '';
      renderUI5Component(entry.component, entry.container);
    });
    pendingUI5Renders = [];
  }

  // Wait for SAPUI5 to load
  if (typeof sap !== 'undefined' && sap.ui) {
    sap.ui.require(['sap/m/Table', 'sap/m/Column', 'sap/m/ColumnListItem',
                     'sap/m/Text', 'sap/m/Label', 'sap/m/List',
                     'sap/m/StandardListItem', 'sap/m/ObjectHeader',
                     'sap/m/ObjectAttribute', 'sap/m/ObjectStatus',
                     'sap/m/MessageStrip'], onUI5Ready);
  } else {
    // SAPUI5 may not be loaded yet — will be initialized from conversation.js
    window._jouleUI5Check = setInterval(function() {
      if (typeof sap !== 'undefined' && sap.ui && sap.ui.require) {
        clearInterval(window._jouleUI5Check);
        sap.ui.require(['sap/m/Table', 'sap/m/Column', 'sap/m/ColumnListItem',
                         'sap/m/Text', 'sap/m/Label', 'sap/m/List',
                         'sap/m/StandardListItem', 'sap/m/ObjectHeader',
                         'sap/m/ObjectAttribute', 'sap/m/ObjectStatus',
                         'sap/m/MessageStrip'], onUI5Ready);
      }
    }, 200);
  }

  // ── Panel Size States ───────────────────────────────────────────────
  var panelStates = ['default', 'docked', 'fullscreen'];
  var currentStateIndex = 0;

  function cycleSize() {
    var panel = document.getElementById('joulePanel');
    var icon = document.getElementById('resizeIcon');
    // Remove current state class
    panel.classList.remove('joule-docked', 'joule-fullscreen');
    // Advance to next state
    currentStateIndex = (currentStateIndex + 1) % panelStates.length;
    var state = panelStates[currentStateIndex];
    if (state !== 'default') {
      panel.classList.add('joule-' + state);
    }
    // Update icon: fullscreen uses exit-fullscreen icon
    // \ue1f5 = full-screen for all states
    icon.innerHTML = '\ue1f5';
  }

  // ── Background Link Handler ─────────────────────────────────────────
  // Handle clicks on background-switching links
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('joule-bg-link')) {
      e.preventDefault();
      var bgImage = e.target.getAttribute('data-bg');
      if (bgImage) {
        document.body.style.backgroundImage = "url('assets/" + bgImage + "')";
      }
    }
    // Conversation-switch links: navigate the iframe to the chosen conversation.
    // A full reload (not an in-place DOM swap) is deliberate — it re-runs index.html's
    // bootstrap, which (a) re-reads and re-validates ?theme= against its allowlist and
    // (b) sanitizes ?conv= through the single existing cleaner. We carry the current
    // ?theme= forward so a dark/HC session is preserved across the jump; if absent, the
    // bootstrap falls back to sap_horizon (identical to today). No back-nav within the
    // panel: closing and reopening restores the default conversation, because the host
    // controller's _toggleJoulePanel rebuilds the iframe src on every open.
    if (e.target.classList.contains('joule-conv-link')) {
      e.preventDefault();
      var conv = e.target.getAttribute('data-conv');
      if (conv) {
        var theme = new URLSearchParams(window.location.search).get('theme');
        var url = 'index.html?conv=' + encodeURIComponent(conv);
        if (theme) url += '&theme=' + encodeURIComponent(theme);
        window.location.href = url;
      }
    }
  });

  // ── Public API ─────────────────────────────────────────────────────
  window.Joule = {
    /**
     * Initialize the Joule panel with a conversation DSL string.
     * Call this from conversation.js.
     */
    load: function(dsl) {
      parsedConversation = parseDSL(dsl);
      // Tweak D State 1: every (re)init starts at "Joule" with the latch cleared. This is the
      // sole re-init entry point — a conv: jump reloads the iframe, so the latch resets naturally.
      titleLatched = false;
      setHeaderTitle('Joule');
      renderWelcome(parsedConversation);
    },
    cycleSize: cycleSize
  };

})();

