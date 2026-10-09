(function(){
  if(window.__hogsVideo)return;window.__hogsVideo=1;

  var P="controls=0&modestbranding=1&rel=0&playsinline=1&disablekb=1&iv_load_policy=3&enablejsapi=1";

  /* styles: popup + background videos par click na jaaye */
  var st=document.createElement("style");
  st.textContent=
   "#vm{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;padding:4vw}"+
   "#vm .box{position:relative;width:min(1000px,100%);aspect-ratio:16/9;background:#000;cursor:pointer}"+
   "#vm iframe{width:100%;height:100%;border:0;pointer-events:none}"+
   "#vm .x{position:absolute;top:-44px;right:0;background:none;border:0;color:#fff;font-size:34px;cursor:pointer;line-height:1}"+
   ".bgv iframe{pointer-events:none}";
  document.head.appendChild(st);

  /* kisi bhi YouTube iframe me controls=0 zabardasti lagao */
  function fix(f){
    var s=f.getAttribute("src")||"";
    if(!/youtube(-nocookie)?\.com\/embed\//.test(s)||s.indexOf("controls=0")>-1)return;
    f.setAttribute("src",s+(s.indexOf("?")>-1?"&":"?")+P);
  }
  function scan(){document.querySelectorAll("iframe").forEach(fix)}
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["src"]});
  scan();

  /* popup */
  function closeBox(){var m=document.getElementById("vm");if(m)m.remove()}
  function openBox(id){
    closeBox();
    var m=document.createElement("div");m.id="vm";
    m.innerHTML='<div class="box"><button class="x" aria-label="Close">&times;</button><iframe src="https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&'+P+'&origin='+encodeURIComponent(location.origin)+'" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>';
    m.addEventListener("click",function(ev){if(ev.target===m||ev.target.className==="x")closeBox()});
    document.body.appendChild(m);
  }

  document.addEventListener("click",function(e){
    var t=e.target.closest("[data-video]");
    if(t){e.preventDefault();e.stopImmediatePropagation();openBox(t.dataset.video);return}
    /* popup ke video pe click = pause / play */
    var b=e.target.closest("#vm .box");
    if(b&&!e.target.closest(".x")){
      var f=b.querySelector("iframe");if(!f)return;
      var playing=f.dataset.p!=="0";f.dataset.p=playing?"0":"1";
      f.contentWindow.postMessage(JSON.stringify({event:"command",func:playing?"pauseVideo":"playVideo",args:[]}),"*");
    }
  },true);
  addEventListener("keydown",function(e){if(e.key==="Escape")closeBox()});
})();
