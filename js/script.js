(function(){
  var wall=document.getElementById("wall"),b=document.body;

  function placeholders(){
    var C=[["#ff2e63","#7a0f2e"],["#222","#666"],["#d9a441","#5a2d00"],["#7a0f2e","#222"],["#444","#111"]];
    var H=[320,440,380,520,300,460,400,360,500];
    wall.innerHTML=H.map(function(h,i){
      var c=C[i%C.length];
      return '<div class="ph" style="--i:'+i+';--h:'+h+'px;--a:'+c[0]+';--b:'+c[1]+'"></div>';
    }).join("");
  }

  /* photos.json se wall banao */
  var ready=fetch("data/photos.json?t="+Date.now()).then(function(r){return r.json()}).then(function(list){
    if(!list.length){placeholders();return}
    wall.innerHTML=list.map(function(p,i){
      return '<img class="ph" style="--i:'+i+'" src="'+p.src+'" width="'+p.w+'" height="'+p.h+'" alt="" decoding="async"'+(i<6?'':' loading="lazy"')+'>';
    }).join("");
    /* pehli 6 photos load hone tak ruko (max 3.5s) */
    var first=[].slice.call(wall.querySelectorAll("img")).slice(0,6).map(function(im){
      return im.decode?im.decode().catch(function(){}):Promise.resolve();
    });
    return Promise.race([Promise.all(first),new Promise(function(r){setTimeout(r,3500)})]);
  }).catch(placeholders);

  /* ===== LOADER ===== */
  var l=document.getElementById("loader");
  if(sessionStorage.getItem("seen")){l.remove();b.classList.remove("loading");b.classList.add("show");return}

  var min=new Promise(function(r){setTimeout(r,2200)});
  var cap=new Promise(function(r){setTimeout(r,5000)});
  Promise.all([min,Promise.race([ready,cap])]).then(function(){
    l.classList.add("out");b.classList.add("show");
    setTimeout(function(){l.remove();b.classList.remove("loading")},1000);
    sessionStorage.setItem("seen","1");
  });
})();
