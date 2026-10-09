(function(){
  /* popup ka CSS yahin se inject hota hai, alag se kuch paste nahi karna */
  var st=document.createElement("style");
  st.textContent="#vm iframe{pointer-events:none}#vm .box{cursor:pointer}";
  document.head.appendChild(st);

  var P="&controls=0&modestbranding=1&playsinline=1&disablekb=1&iv_load_policy=3&enablejsapi=1&rel=0";

  /* popup khulte hi iframe ke link mein controls=0 wagairah jod do */
  new MutationObserver(function(ms){
    ms.forEach(function(m){
      m.addedNodes.forEach(function(n){
        if(n.nodeType!==1||n.id!=="vm")return;
        var f=n.querySelector("iframe");
        if(f&&f.src.indexOf("controls=0")<0)f.src=f.src+P;
      });
    });
  }).observe(document.body,{childList:true});

  /* video pe click = pause / play */
  document.addEventListener("click",function(e){
    var b=e.target.closest("#vm .box");
    if(!b||e.target.closest(".x"))return;
    var f=b.querySelector("iframe");if(!f)return;
    var playing=f.dataset.p!=="0";
    f.dataset.p=playing?"0":"1";
    f.contentWindow.postMessage(JSON.stringify({event:"command",func:playing?"pauseVideo":"playVideo",args:[]}),"*");
  });
})();