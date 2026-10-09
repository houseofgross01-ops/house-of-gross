(function(){
  var $=function(s){return document.querySelector(s)};
  var PAL=["#ff2e63,#400","#222,#666","#d9a441,#5a2d00","#7a0f2e,#222","#444,#111","#ff2e63,#d9a441"];
  var FW=[["t","Title"],["g","Big text on card"],["tag","Tag"],["u","Video link"]];
  var FR=[["title","Title"],["tag","Tag"],["url","Video link"]];
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;")}
  function yid(s){var m=String(s||"").match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);return m?m[1]:(/^[\w-]{11}$/.test(String(s).trim())?String(s).trim():null)}
  function mark(){data._d=1;dirty()}

  function rows(k,F){
    return (data[k]||[]).map(function(it,i){
      var a='data-k="'+k+'" data-i="'+i+'"';
      return '<div class="sr">'+F.map(function(f){
        return '<input '+a+' data-f="'+f[0]+'" value="'+esc(it[f[0]])+'" placeholder="'+f[1]+'">';
      }).join("")+'<span class="sb"><button '+a+' data-m="up">&uarr;</button><button '+a+' data-m="dn">&darr;</button><button '+a+' data-m="x">&times;</button></span></div>';
    }).join("")||'<span style="color:var(--mut)">Empty.</span>';
  }
  function draw(){
    $("#hl").value=data.hero&&data.hero.v?"https://youtu.be/"+data.hero.v:"";
    $("#wl").innerHTML=rows("work",FW);
    $("#rl").innerHTML=rows("reel",FR);
  }

  function init(){
    var seeded=false;
    if(!data.hero){data.hero={v:"Y1qsWPtTbLs"};seeded=true}
    if(!data.work){data.work=[
      {t:"USDF · AI Ustaad",g:"Apna Hunar, AI Ka Hunar",tag:"Campaign",u:"https://www.youtube.com/@YOUR_CHANNEL",c:PAL[0]},
      {t:"Project 2",g:"One-line result",tag:"Brand film",u:"https://www.youtube.com/@YOUR_CHANNEL",c:PAL[1]},
      {t:"Project 3",g:"One-line result",tag:"Sonic",u:"https://www.youtube.com/@YOUR_CHANNEL",c:PAL[2]}
    ];seeded=true}
    if(!data.reel){data.reel=[
      {title:"Apna Hunar, AI Ka Hunar",tag:"USDF Campaign",url:"https://www.youtube.com/@YOUR_CHANNEL"},
      {title:"Video title 2",tag:"Sonic",url:"https://www.youtube.com/@YOUR_CHANNEL"},
      {title:"Video title 3",tag:"Brand film",url:"https://www.youtube.com/@YOUR_CHANNEL"}
    ];seeded=true}

    $("#app").insertAdjacentHTML("afterbegin",
    '<style>.sr{display:grid;grid-template-columns:repeat(4,1fr) auto;gap:6px;margin-bottom:6px;align-items:center}.sr.r3{grid-template-columns:repeat(3,1fr) auto}.sb{display:flex;gap:4px}.sb button{width:34px;height:40px;border:1px solid var(--line);background:var(--bg);color:var(--fg);cursor:pointer}.sb button:hover{background:var(--acc);color:#fff}@media(max-width:800px){.sr,.sr.r3{grid-template-columns:1fr 1fr}.sb{grid-column:1/-1}}</style>'+
    '<div id="site"><h2>Site videos</h2>'+
    '<div class="box"><label>Hero: Crossing Strike background video (YouTube link)</label><input id="hl" placeholder="https://youtu.be/..."></div>'+
    '<div class="box"><label>Most Loved carousel</label><div id="wl"></div><p style="margin:10px 0 0"><button class="btn" id="aw">+ Add card</button></p></div>'+
    '<div class="box"><label>Showreel</label><div id="rl" class="r3w"></div><p style="margin:10px 0 0"><button class="btn" id="ar">+ Add video</button></p></div>'+
    '<h2 style="margin-top:40px">Gallery (photos &amp; videos by brand)</h2></div>');

    draw();
    document.querySelectorAll("#rl").forEach(function(){});
    var s=$("#site");

    s.addEventListener("input",function(e){
      var t=e.target;
      if(t.id==="hl"){var id=yid(t.value);if(id){data.hero={v:id};mark()}return}
      if(t.dataset&&t.dataset.k){data[t.dataset.k][+t.dataset.i][t.dataset.f]=t.value;mark()}
    });
    s.addEventListener("click",function(e){
      var b=e.target.closest("button");if(!b)return;
      if(b.id==="aw"){data.work.push({t:"New project",g:"One-line result",tag:"Campaign",u:"",c:PAL[data.work.length%PAL.length]});mark();draw();return}
      if(b.id==="ar"){data.reel.push({title:"New video",tag:"Film",url:""});mark();draw();return}
      var m=b.dataset.m;if(!m)return;
      var l=data[b.dataset.k],i=+b.dataset.i;
      if(m==="x"){if(!confirm("Remove this?"))return;l.splice(i,1)}
      if(m==="up"&&i>0){l.splice(i-1,0,l.splice(i,1)[0])}
      if(m==="dn"&&i<l.length-1){l.splice(i+1,0,l.splice(i,1)[0])}
      mark();draw();
    });
    // 3-column layout for showreel rows
    new MutationObserver(function(){$("#rl").querySelectorAll(".sr").forEach(function(r){r.classList.add("r3")})}).observe($("#rl"),{childList:true});
    $("#rl").querySelectorAll(".sr").forEach(function(r){r.classList.add("r3")});

    if(seeded)mark();
  }

  var t=setInterval(function(){
    if(window.data&&$("#app")&&!$("#app").hidden){clearInterval(t);init()}
  },300);
})();
/* ===== HERO TILES 2 & 3 ===== */
(function(){
  function yid(s){var m=String(s||"").match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);return m?m[1]:(/^[\w-]{11}$/.test(String(s).trim())?String(s).trim():null)}
  var t=setInterval(function(){
    var h=document.getElementById("hl");
    if(!window.data||!h)return;clearInterval(t);
    var ref=h.closest(".box");
    [["hero2","The Gross Line"],["hero3","Language Bible"]].forEach(function(x){
      var d=document.createElement("div");d.className="box";
      d.innerHTML='<label>Hero: '+x[1]+' background video (YouTube link, khali = sirf colour)</label><input id="'+x[0]+'" placeholder="https://youtu.be/...">';
      ref.after(d);ref=d;
      var inp=d.querySelector("input");
      inp.value=data[x[0]]&&data[x[0]].v?"https://youtu.be/"+data[x[0]].v:"";
      inp.addEventListener("input",function(){
        var v=inp.value.trim();
        if(!v){delete data[x[0]];data._d=1;dirty();return}
        var id=yid(v);if(id){data[x[0]]={v:id};data._d=1;dirty()}
      });
    });
  },300);
})();
