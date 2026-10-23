/* Kitni photos hain (1.jpg se N.jpg tak) */
var TOTAL=20;

(function(){
  var wall=document.getElementById("wall"),b=document.body,html="";
  for(var n=1;n<=TOTAL;n++){
    html+='<img class="ph" style="--i:'+(n-1)+';height:auto" src="images/photos/'+n+'.jpg" alt="" decoding="async"'+(n>6?' loading="lazy"':'')+' onerror="this.remove()">';
  }
  wall.innerHTML=html;

  /* pehli 6 photos load hone tak ruko (max 3.5s) */
  var first=[].slice.call(wall.querySelectorAll("img")).slice(0,6).map(function(im){
    return im.decode?im.decode().catch(function(){}):Promise.resolve();
  });
  var ready=Promise.race([Promise.all(first),new Promise(function(r){setTimeout(r,3500)})]);

  /* ===== LOADER ===== */
  var l=document.getElementById("loader");
  if(sessionStorage.getItem("seen")){l.remove();b.classList.remove("loading");b.classList.add("show");return}

  var min=new Promise(function(r){setTimeout(r,2200)});
  Promise.all([min,ready]).then(function(){
    l.classList.add("out");b.classList.add("show");
    setTimeout(function(){l.remove();b.classList.remove("loading")},1000);
    sessionStorage.setItem("seen","1");
  });
})();
