(function(){
  var st=document.createElement("style");
  st.textContent=
    ".mi.vi{aspect-ratio:16/9;grid-column:span 2;align-self:start}"+
    ".mi.vi iframe{position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none;transform:scale(1.02)}"+
    ".mi.vi .play{display:none}";
  document.head.appendChild(st);

  /* sirf screen pe dikhne wale videos load honge, baaki rukein */
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
  function scan(){document.querySelectorAll("#g .mi[data-v]").forEach(setup)}

  var g=document.getElementById("g");
  if(g){new MutationObserver(scan).observe(g,{childList:true,subtree:true});scan()}
})();