(function(){
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;")}
  function yid(s){var m=String(s||"").match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);return m?m[1]:null}
  var G=["#ff2e63,#400","#222,#666","#d9a441,#5a2d00","#7a0f2e,#222","#444,#111","#ff2e63,#d9a441"];

  fetch("data/gallery.json?t="+Date.now()).then(function(r){return r.json()}).then(function(d){

    // Hero: Crossing Strike background video
    if(d.hero&&d.hero.v){
      var t=document.querySelector(".tile.t1"),id=d.hero.v;
      if(t){
        t.href="https://www.youtube.com/watch?v="+id;t.dataset.video=id;
        var f=t.querySelector(".bgv iframe");
        if(f)f.src="https://www.youtube-nocookie.com/embed/"+id+"?autoplay=1&mute=1&loop=1&playlist="+id+"&controls=0&modestbranding=1&rel=0&playsinline=1&disablekb=1";
      }
    }

    // Showreel
    var v=document.getElementById("vids");
    if(v&&d.reel){
      v.innerHTML=d.reel.map(function(x,i){
        var id=yid(x.url);
        return '<a class="vid" target="_blank" rel="noopener" href="'+esc(x.url)+'"'+(id?' data-video="'+id+'"':'')+' style="background:linear-gradient(160deg,'+G[i%G.length]+')"><span class="play"></span><small>'+esc(x.tag)+'</small><b>'+esc(x.title)+'</b></a>';
      }).join("");
    }

    // Most Loved carousel
    var car=document.getElementById("car");
    if(car&&d.work&&d.work.length){
      var html=d.work.map(function(w,i){
        var id=yid(w.u);
        return '<a class="card" target="_blank" rel="noopener" href="'+esc(w.u)+'"'+(id?' data-video="'+id+'"':'')+'><div class="ph mv" style="background-image:linear-gradient(160deg,'+(w.c||G[i%G.length])+')"><span class="play"></span>'+esc(w.g)+'</div><span class="tag">'+esc(w.tag)+'</span><h3>'+esc(w.t)+'</h3><p>Watch &rarr;</p></a>';
      }).join("");
      car.innerHTML=html+html;
    }
  }).catch(function(){});
})();