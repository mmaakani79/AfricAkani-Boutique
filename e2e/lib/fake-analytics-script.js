// Stand-in for Vercel's /_vercel/insights/script.js (honours the @vercel/analytics contract).
(function(){
  var send = function(ev){
    var f = window.__beforeSend; if (f) { ev = f(ev); if (!ev) return; }
    try { fetch('/_vercel/insights/view', { method: 'POST', body: JSON.stringify({ o: ev.url, type: ev.type }), keepalive: true }).catch(function(){}); } catch(e){}
  };
  var handle = function(name, arg){
    if (name === 'beforeSend') window.__beforeSend = arg;
    if (name === 'pageview') send({ type: 'pageview', url: location.href });
    if (name === 'event') send({ type: 'event', url: location.href });
  };
  var q = window.vaq || []; window.va = function(n, a){ handle(n, a); };
  // beforeSend d'abord, puis les pages vues en attente
  q.filter(function(x){return x[0]==='beforeSend'}).forEach(function(x){handle(x[0],x[1])});
  q.filter(function(x){return x[0]!=='beforeSend'}).forEach(function(x){handle(x[0],x[1])});
})();
