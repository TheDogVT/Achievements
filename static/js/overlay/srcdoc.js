/* Shared widget srcdoc builder — the single source of truth for how a widget
 * bundle (HTML/CSS/JS + field values + initial state) becomes an isolated iframe
 * document exposing the PuppyOverlay lifecycle API. Raw stream envelopes use
 * the separate onStreamEvent channel so existing widgets do not receive the
 * same event through onEvent as well.
 *
 * Used by both the live overlay runtime (runtime.js) and the dashboard widget
 * preview, so "what you preview is what OBS renders." The frame listens for
 * postMessage {kind:"state"|"event"|"stream-event"} just like the live SSE
 * bridge delivers.
 */
(function () {
    'use strict';

    window.buildOverlaySrcdoc = function (widget, values, initialState, layout) {
        const scriptSafeJson = function (value) {
            return JSON.stringify(value || {})
                .replace(/</g, '\\u003c')
                .replace(/\u2028/g, '\\u2028')
                .replace(/\u2029/g, '\\u2029');
        };
        const fieldsJson = scriptSafeJson(values);
        const stateJson = scriptSafeJson(initialState);
        const buffer = Math.max(0, Number(layout && layout.buffer) || 0);
        const contentWidth = Math.max(1, Number(layout && layout.contentWidth) || 0);
        const contentHeight = Math.max(1, Number(layout && layout.contentHeight) || 0);
        const bufferStyle = buffer > 0 && contentWidth && contentHeight
            ? [
                'html{overflow:hidden!important;}',
                'body{position:relative!important;width:', contentWidth, 'px!important;height:', contentHeight,
                'px!important;overflow:visible!important;transform:translate(', buffer, 'px,', buffer,
                'px);transform-origin:top left;}'
            ].join('')
            : '';
        const bootstrap = [
            '<script>(function(){',
            'function reportError(context,error){try{console.error("[PuppyOverlay] "+context+": "+(error&&error.stack||error));}catch(_){}}',
            'function invoke(list,context,args){list.slice().forEach(function(fn){try{fn.apply(null,args);}catch(error){reportError(context,error);}});}',
            'var PO={fields:', fieldsJson, ',state:', stateJson, ',',
            '_load:[],_state:[],_event:[],_stream:[],_signal:[],',
            'onLoad:function(cb){this._load.push(cb);},',
            'onState:function(cb){this._state.push(cb);},',
            'onEvent:function(cb){this._event.push(cb);},',
            'onStreamEvent:function(cb){this._stream.push(cb);},',
            'onSignal:function(cb){this._signal.push(cb);},',
            'emitSignal:function(name,data){parent.postMessage({kind:"widget-signal",name:String(name||""),data:data||{}},"*");},',
            'emitHostEvent:function(name,data){parent.postMessage({kind:"widget-host-event",name:String(name||""),data:data||{}},"*");},',
            'invalidate:function(){parent.postMessage({kind:"widget-invalidate"},"*");},',
            'getState:function(k){return this.state?this.state[k]:undefined;}};',
            'window.PuppyOverlay=PO;',
            'window.addEventListener("message",function(e){var m=e.data||{};',
            'if(m.kind==="state"){PO.state=PO.state||{};PO.state[m.key]=m.value;',
            'invoke(PO._state,"state callback",[m.key,m.value,PO.state]);}',
            'else if(m.kind==="event"){',
            'invoke(PO._event,"event callback",[m.name,m.data||{}]);}',
            'else if(m.kind==="stream-event"){',
            'invoke(PO._stream,"stream callback",[m.data||{}]);}',
            'else if(m.kind==="signal"){',
            'invoke(PO._signal,"signal callback",[m.name,m.data||{}]);}});',
            'function fireLoad(){invoke(PO._load,"load callback",[{fields:PO.fields,state:PO.state}]);parent.postMessage({kind:"widget-ready"},"*");}',
            'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",fireLoad);',
            'else setTimeout(fireLoad,0);',
            '})();<\/script>'
        ].join('');

        return [
            '<!DOCTYPE html><html><head><meta charset="utf-8">',
            '<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;}',
            (widget.css || ''),
            bufferStyle,
            '</style></head><body>',
            (widget.html || ''),
            bootstrap,
            '<script>', (widget.js || ''), '<\/script>',
            '</body></html>'
        ].join('');
    };
})();
