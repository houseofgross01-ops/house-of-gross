/* HOGS — edit VIDEOS and WORK below. Each line = one card. */
/* Paste your work here: title, tag, line, url (YouTube/Vimeo/Instagram) */
var WORK=[
{t:"USDF · AI Ustaad",g:"Apna Hunar, AI Ka Hunar",tag:"Campaign",u:"https://www.youtube.com/@YOUR_CHANNEL",c:"#ff2e63,#400"},
{t:"Project 2",g:"One-line result",tag:"Brand film",u:"https://www.youtube.com/@YOUR_CHANNEL",c:"#222,#666"},
{t:"Project 3",g:"One-line result",tag:"Sonic",u:"https://www.youtube.com/@YOUR_CHANNEL",c:"#d9a441,#5a2d00"},
{t:"Project 4",g:"One-line result",tag:"Reel",u:"https://www.youtube.com/@YOUR_CHANNEL",c:"#7a0f2e,#222"},
{t:"Project 5",g:"One-line result",tag:"Campaign",u:"https://www.youtube.com/@YOUR_CHANNEL",c:"#444,#111"},
{t:"Project 6",g:"One-line result",tag:"Brand film",u:"https://www.youtube.com/@YOUR_CHANNEL",c:"#ff2e63,#d9a441"}
];
var car=document.getElementById("car");
var html=WORK.map(function(w){return '<a class="card" target="_blank" rel="noopener" href="'+w.u+'"><div class="ph mv" style="background-image:linear-gradient(160deg,'+w.c+')"><span class="play"></span>'+w.g+'</div><span class="tag">'+w.tag+'</span><h3>'+w.t+'</h3><p>Watch &rarr;</p></a>'}).join("");
car.innerHTML=html+html;
var pos=0,boost=0,hov=false,rm=matchMedia("(prefers-reduced-motion:reduce)").matches,t;
function slide(d){boost+=d*22}
function hold(){hov=true;clearTimeout(t)}function rel(ms){clearTimeout(t);t=setTimeout(function(){hov=false},ms)}
car.onmouseenter=hold;car.onmouseleave=function(){rel(0)};
car.addEventListener("touchstart",hold,{passive:true});car.addEventListener("touchend",function(){rel(1500)},{passive:true});
car.addEventListener("scroll",function(){if(hov)pos=car.scrollLeft},{passive:true});
(function loop(){var h=car.scrollWidth/2;if(h>0){if(!hov&&!rm)pos+=0.5;pos+=boost;boost*=0.92;if(Math.abs(boost)<0.05)boost=0;
if(pos>=h)pos-=h;if(pos<0)pos+=h;if(!hov||boost)car.scrollLeft=pos}requestAnimationFrame(loop)})();
/* Paste your links here: title, tag, url (YouTube, Vimeo, Instagram, anything) */
var VIDEOS=[
{title:"Apna Hunar, AI Ka Hunar",tag:"USDF Campaign",url:"https://www.youtube.com/@YOUR_CHANNEL"},
{title:"Video title 2",tag:"Sonic",url:"https://www.youtube.com/@YOUR_CHANNEL"},
{title:"Video title 3",tag:"Brand film",url:"https://www.youtube.com/@YOUR_CHANNEL"}
];
var G=["#ff2e63,#400","#222,#666","#d9a441,#5a2d00","#7a0f2e,#222","#444,#111","#ff2e63,#d9a441"];
document.getElementById("vids").innerHTML=VIDEOS.map(function(v,i){
return '<a class="vid" target="_blank" rel="noopener" href="'+v.url+'" style="background:linear-gradient(160deg,'+G[i%G.length]+')"><span class="play"></span><small>'+v.tag+'</small><b>'+v.title+'</b></a>'}).join("");
/* ===== ANIMATIONS ===== */
(function(){
  if(matchMedia("(prefers-reduced-motion:reduce)").matches)return;

  // scroll reveal
  var sel=".eyebrow,h2.sec,.mod,.lang div,.member,.vid,.people div,.visit > div,.dark > p";
  var io=new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}
    });
  },{threshold:.15});
  document.querySelectorAll(sel).forEach(function(el){
    var i=Array.prototype.indexOf.call(el.parentNode.children,el);
    el.style.setProperty("--d",(i%6*0.08)+"s");
    el.classList.add("rv");
    io.observe(el);
  });

  // nav shrink + progress bar
  var nav=document.querySelector("nav");
  var pg=document.createElement("div");pg.id="pg";document.body.appendChild(pg);
  function onScroll(){
    var y=window.scrollY,h=document.documentElement.scrollHeight-innerHeight;
    nav.classList.toggle("s",y>60);
    pg.style.width=(h>0?y/h*100:0)+"%";
  }
  addEventListener("scroll",onScroll,{passive:true});onScroll();
})();
