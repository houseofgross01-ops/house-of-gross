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

/* ===== 2. MOST LOVED + SHOWREEL: autoplay ===== */
(function(){
  var car=document.getElementById("car"),vids=document.getElementById("vids");
  if(!car&&!vids)return;
  var st=document.createElement("style");
  st.textContent=
   ".ph.vp,.vid.vp{isolation:isolate;overflow:hidden}"+
   ".vp .play{display:none}"+
   ".vp .vb{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:-1;background:#000}"+
   ".vp .vb iframe{position:absolute;top:50%;left:50%;width:100%;height:100%;border:0;transform:translate(-50%,-50%) scale(var(--s,2.5))}"+
   ".vp .vb:after{content:'';position:absolute;inset:0;background:linear-gradient(transparent 40%,rgba(0,0,0,.6))}";
  document.head.appendChild(st);

  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){
      var f=e.target.querySelector("iframe");if(!f)return;
      if(e.isIntersecting){if(!f.getAttribute("src"))f.setAttribute("src",f.dataset.src)}
      else f.removeAttribute("src");
    });
  },{rootMargin:"0px 120px"});

  function setup(host,id,scale){
    if(host.dataset.ap)return;host.dataset.ap=1;
    var w=document.createElement("div");w.className="vb";
    var f=document.createElement("iframe");
    f.dataset.src="https://www.youtube-nocookie.com/embed/"+id+"?autoplay=1&mute=1&loop=1&playlist="+id+"&controls=0&modestbranding=1&rel=0&playsinline=1&disablekb=1&iv_load_policy=3";
    f.setAttribute("allow","autoplay; encrypted-media");
    f.setAttribute("tabindex","-1");f.setAttribute("title","");
    w.appendChild(f);host.classList.add("vp");host.style.setProperty("--s",scale);
    host.insertBefore(w,host.firstChild);io.observe(host);
  }
  function scan(){
    if(car)car.querySelectorAll(".card[data-video]").forEach(function(c){
      var p=c.querySelector(".ph");if(p)setup(p,c.dataset.video,2.6);
    });
    if(vids)vids.querySelectorAll(".vid[data-video]").forEach(function(v){setup(v,v.dataset.video,1.12)});
  }
  [car,vids].forEach(function(n){if(n)new MutationObserver(scan).observe(n,{childList:true})});
  scan();
})();

/* ===== 3. GALLERY: autoplay ===== */
(function(){
  var g=document.getElementById("g");if(!g)return;
  var st=document.createElement("style");
  st.textContent=
    ".mi.vi{aspect-ratio:16/9;grid-column:span 2;align-self:start}"+
    ".mi.vi iframe{position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none;transform:scale(1.02)}"+
    ".mi.vi .play{display:none}";
  document.head.appendChild(st);
  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){
      var f=e.target.querySelector("iframe");if(!f)return;
      if(e.isIntersecting){if(!f.getAttribute("src"))f.src=f.dataset.src}
      else f.removeAttribute("src");
    });
  },{rootMargin:"200px"});
  function setup(a){
    if(a.dataset.ready)return;a.dataset.ready=1;
    var id=a.dataset.v,f=document.createElement("iframe");
    f.dataset.src="https://www.youtube-nocookie.com/embed/"+id+"?autoplay=1&mute=1&loop=1&playlist="+id+"&controls=0&modestbranding=1&rel=0&playsinline=1&disablekb=1&iv_load_policy=3";
    f.setAttribute("allow","autoplay; encrypted-media");
    f.setAttribute("tabindex","-1");f.setAttribute("title","");
    a.classList.add("vi");a.appendChild(f);io.observe(a);
  }
  function scan(){g.querySelectorAll(".mi[data-v]").forEach(setup)}
  new MutationObserver(scan).observe(g,{childList:true,subtree:true});scan();
})();
