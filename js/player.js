/* ===== 1. GLOBAL: no controls + popup ===== */
(function(){
  var P="controls=0&modestbranding=1&rel=0&playsinline=1&disablekb=1&iv_load_policy=3&enablejsapi=1";
  var st=document.createElement("style");
  st.textContent=
   "#vm{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;padding:4vw}"+
   "#vm .box{position:relative;width:min(1000px,100%);aspect-ratio:16/9;background:#000;cursor:pointer}"+
   "#vm iframe{width:100%;height:100%;border:0;pointer-events:none}"+
   "#vm .x{position:absolute;top:-44px;right:0;background:none;border:0;color:#fff;font-size:34px;cursor:pointer;line-height:1}"+
   ".bgv iframe{pointer-events:none}";
  document.head.appendChild(st);

  function fix(f){
    var s=f.getAttribute("src")||"";
    if(!/youtube(-nocookie)?\.com\/embed\//.test(s)||s.indexOf("controls=0")>-1)return;
    f.setAttribute("src",s+(s.indexOf("?")>-1?"&":"?")+P);
  }
  function scan(){document.querySelectorAll("iframe").forEach(fix)}
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["src"]});
  scan();

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
    var b=e.target.closest("#vm .box");
    if(b&&!e.target.closest(".x")){
      var f=b.querySelector("iframe");if(!f)return;
      var playing=f.dataset.p!=="0";f.dataset.p=playing?"0":"1";
      f.contentWindow.postMessage(JSON.stringify({event:"command",func:playing?"pauseVideo":"playVideo",args:[]}),"*");
    }
  },true);
  addEventListener("keydown",function(e){if(e.key==="Escape")closeBox()});
})();

/* ===== 2. VIDEO MANAGER (light) ===== */
(function(){
  var car=document.getElementById("car"),vids=document.getElementById("vids"),g=document.getElementById("g");
  if(!car&&!vids&&!g)return;
  var mobile=matchMedia("(max-width:800px)").matches,touch=matchMedia("(hover:none)").matches;
  var MAX=mobile?1:3,active=[],ready=document.readyState==="complete";
  if(!ready)addEventListener("load",function(){setTimeout(function(){ready=true},1000)});

  var st=document.createElement("style");
  st.textContent=
   ".vp{isolation:isolate;overflow:hidden}"+
   ".vp .vb{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:-1;background:#000 center/cover no-repeat}"+
   ".vp .vb iframe{position:absolute;top:50%;left:50%;width:100%;height:100%;border:0;opacity:0;transition:opacity .5s;transform:translate(-50%,-50%) scale(var(--s,2.5))}"+
   ".vp .vb iframe.on{opacity:1}"+
   ".vp .vb:after{content:'';position:absolute;inset:0;background:linear-gradient(transparent 40%,rgba(0,0,0,.55))}"+
   ".vp.pl .play{opacity:0}.vp .play{transition:opacity .4s}"+
   ".mi.vi{aspect-ratio:16/9;grid-column:span 2;align-self:start}.mi.vp>img{opacity:0}"+
   ".play{animation:none!important}.mv{animation:none!important}";
  document.head.appendChild(st);

  function start(h){
    if(h._f)return;
    while(active.length>=MAX)stop(active[0]);
    var f=document.createElement("iframe"),id=h._id;
    f.src="https://www.youtube-nocookie.com/embed/"+id+"?autoplay=1&mute=1&loop=1&playlist="+id+"&controls=0&modestbranding=1&rel=0&playsinline=1&disablekb=1&iv_load_policy=3";
    f.allow="autoplay; encrypted-media";f.tabIndex=-1;f.title="";
    f.onload=function(){setTimeout(function(){f.classList.add("on");h.classList.add("pl")},700)};
    h._vb.appendChild(f);h._f=f;active.push(h);
  }
  function stop(h){
    if(!h._f)return;
    h._f.remove();h._f=null;h.classList.remove("pl");
    var i=active.indexOf(h);if(i>-1)active.splice(i,1);
  }
  function go(h){if(!h._want)return;if(ready)start(h);else setTimeout(function(){go(h)},800)}

  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){var h=e.target;h._want=e.isIntersecting;e.isIntersecting?go(h):stop(h)});
  },{threshold:.6});

  function setup(h,id,scale,mode){
    if(h._id)return;h._id=id;
    var w=document.createElement("div");w.className="vb";
    w.style.backgroundImage="url(https://img.youtube.com/vi/"+id+"/hqdefault.jpg)";
    h._vb=w;h.classList.add("vp");h.style.setProperty("--s",scale);
    h.insertBefore(w,h.firstChild);
    if(mode==="view")io.observe(h);
    else if(!touch){
      h.addEventListener("mouseenter",function(){h._want=true;start(h)});
      h.addEventListener("mouseleave",function(){h._want=false;stop(h)});
    }
  }
  function scan(){
    if(car)car.querySelectorAll(".card[data-video]").forEach(function(c){var p=c.querySelector(".ph");if(p)setup(p,c.dataset.video,2.6,"hover")});
    if(vids)vids.querySelectorAll(".vid[data-video]").forEach(function(v){setup(v,v.dataset.video,1.12,"view")});
    if(g)g.querySelectorAll(".mi[data-v]").forEach(function(a){a.classList.add("vi");setup(a,a.dataset.v,1.02,"hover")});
  }
  [car,vids,g].forEach(function(n){if(n)new MutationObserver(scan).observe(n,{childList:true,subtree:true})});
  scan();
})();

/* ===== 3. HERO: scroll se bahar jaate hi pause, mobile pe sirf pehla tile ===== */
(function(){
  var hero=document.querySelector(".hero");if(!hero)return;
  var mobile=matchMedia("(max-width:800px)").matches,vis=true;
  function apply(){
    hero.querySelectorAll(".bgv iframe").forEach(function(f,i){
      var s=f.getAttribute("src");if(s&&!f.dataset.s)f.dataset.s=s;
      var want=vis&&(!mobile||i===0);
      if(want&&!f.getAttribute("src")&&f.dataset.s)f.setAttribute("src",f.dataset.s);
      if(!want&&f.getAttribute("src"))f.removeAttribute("src");
    });
  }
  new IntersectionObserver(function(es){vis=es[0].isIntersecting;apply()},{threshold:.1}).observe(hero);
  new MutationObserver(apply).observe(hero,{childList:true,subtree:true});
  apply();
})();
