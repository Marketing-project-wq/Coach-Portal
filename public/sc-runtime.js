'use strict';
/* Tiny dependency-free template runtime for the recovered DC design.
 * Supports: {{ expr }} interpolation, <sc-if value>, <sc-for list as>, on* handlers.
 * A logic object provides state + renderVals(); setState() triggers a full re-render. */
(function () {
  function evalExpr(expr, scope) {
    try { return new Function('$s', 'with($s){ return (' + expr + '); }')(scope); }
    catch (e) { return undefined; }
  }
  function interpolate(str, scope) {
    return str.replace(/\{\{([\s\S]*?)\}\}/g, function (_, e) {
      var v = evalExpr(e.trim(), scope); return (v == null ? '' : String(v));
    });
  }
  var HAS = function (s) { return s.indexOf('{{') >= 0; };
  function firstExpr(str) { var m = str.match(/\{\{([\s\S]*?)\}\}/); return m ? m[1].trim() : str; }
  // Boolean attributes must be OMITTED when false — `disabled="false"` still disables in HTML.
  var BOOL_ATTRS = { disabled: 1, checked: 1, readonly: 1, required: 1, selected: 1, multiple: 1, hidden: 1, autofocus: 1 };

  function processNodes(nodes, scope, out) {
    for (var i = 0; i < nodes.length; i++) processNode(nodes[i], scope, out);
  }
  function processNode(node, scope, out) {
    if (node.nodeType === 3) { var t = node.nodeValue; out.push(document.createTextNode(HAS(t) ? interpolate(t, scope) : t)); return; }
    if (node.nodeType === 8) return;
    if (node.nodeType !== 1) { out.push(node.cloneNode(true)); return; }
    var tag = node.tagName.toLowerCase();
    if (tag === 'helmet') return;
    if (tag === 'sc-if') {
      if (evalExpr(firstExpr(node.getAttribute('value') || 'false'), scope)) processNodes(node.childNodes, scope, out);
      return;
    }
    if (tag === 'sc-for') {
      var list = evalExpr(firstExpr(node.getAttribute('list') || '[]'), scope) || [];
      var as = node.getAttribute('as') || 'item';
      for (var k = 0; k < list.length; k++) {
        var cs = Object.create(scope); cs[as] = list[k]; cs[as + '_i'] = k;
        processNodes(node.childNodes, cs, out);
      }
      return;
    }
    var el = document.createElement(node.tagName);
    var attrs = node.attributes;
    for (var a = 0; a < attrs.length; a++) {
      var name = attrs[a].name, val = attrs[a].value;
      if (/^on[a-z]+$/i.test(name) && HAS(val)) {
        (function (evName, expr) {
          el.addEventListener(evName.slice(2).toLowerCase(), function (e) {
            var fn = evalExpr(expr, scope); if (typeof fn === 'function') fn.call(null, e);
          });
        })(name, firstExpr(val));
        continue;
      }
      if (name === 'style-hover') {
        (function (hoverCss, baseStyle) {
          el.addEventListener('mouseenter', function () { el.style.cssText = baseStyle + ';' + interpolate(hoverCss, scope); });
          el.addEventListener('mouseleave', function () { el.style.cssText = baseStyle; });
        })(val, HAS(node.getAttribute('style') || '') ? interpolate(node.getAttribute('style'), scope) : (node.getAttribute('style') || ''));
        continue;
      }
      if (BOOL_ATTRS[name.toLowerCase()] && HAS(val)) {
        var bv = evalExpr(firstExpr(val), scope);
        if (bv && bv !== 'false') el.setAttribute(name, '');
        continue;
      }
      el.setAttribute(name, HAS(val) ? interpolate(val, scope) : val);
    }
    if (el.tagName === 'INPUT' && el.hasAttribute('value')) el.value = el.getAttribute('value');
    var kids = []; processNodes(node.childNodes, scope, kids);
    for (var c = 0; c < kids.length; c++) el.appendChild(kids[c]);
    out.push(el);
  }

  window.SC = {
    mount: function (tplEl, logic, mountEl) {
      var content = tplEl.content ? tplEl.content : tplEl;
      logic.__render = function () {
        var vals = logic.renderVals();
        // Preserve the main scroll position across a full re-render so an in-page
        // update (e.g. clicking a calendar date) doesn't snap back to the top.
        // Only when staying on the same screen — switching nav items starts at top.
        var prev = mountEl.querySelector('[data-scroll]');
        var prevTop = prev ? prev.scrollTop : 0;
        // The sidebar nav persists across every screen, so keep its scroll position on
        // ANY re-render (switching nav items must not snap the navbar back to the top).
        var prevNav = mountEl.querySelector('[data-navscroll]');
        var prevNavTop = prevNav ? prevNav.scrollTop : 0;
        // A scrollable modal (e.g. the menu builder) must not jump back to the top when
        // adding a block/exercise re-renders it.
        var prevModal = mountEl.querySelector('[data-modalscroll]');
        var prevModalTop = prevModal ? prevModal.scrollTop : 0;
        var scr = logic.state ? logic.state.screen : null;
        var same = logic.__lastScreen === scr;
        logic.__lastScreen = scr;
        var out = []; processNodes(content.childNodes, vals, out);
        mountEl.innerHTML = '';
        for (var i = 0; i < out.length; i++) mountEl.appendChild(out[i]);
        if (same && prevTop) { var next = mountEl.querySelector('[data-scroll]'); if (next) next.scrollTop = prevTop; }
        if (prevNavTop) { var nn = mountEl.querySelector('[data-navscroll]'); if (nn) nn.scrollTop = prevNavTop; }
        if (prevModalTop) { var mm = mountEl.querySelector('[data-modalscroll]'); if (mm) mm.scrollTop = prevModalTop; }
        if (logic.__afterRender) logic.__afterRender(mountEl);
      };
      logic.__render();
    },
  };
  window.DCLogic = class {
    // State updates apply synchronously, but the (expensive) full re-render is coalesced to
    // once per animation frame — so a nav switch that fires several setState/setD calls only
    // rebuilds the DOM once instead of 4–5 times. Keeps the UI snappy.
    setState(patch) {
      Object.assign(this.state, patch);
      if (!this.__render || this.__renderQueued) return;
      this.__renderQueued = true;
      var self = this;
      var raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function (cb) { return setTimeout(cb, 0); };
      raf(function () { self.__renderQueued = false; self.__render(); });
    }
  };
})();
