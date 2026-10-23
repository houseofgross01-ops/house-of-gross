var TOTAL=38;   // images/photos/1.jpg se TOTAL.jpg tak

(function(){
  var wall=document.getElementById("wall"),b=document.body,items=[],GAP=4;

  function load(n){return new Promise(function(res){
    var im=new Image();im.className="ph";im.alt="";im.decoding="async";
    im.onload=function(){items.push({n:n,im:im,r:im.naturalWidth/im.naturalHeight});res()};
    im.onerror=function(){res()};
    im.src="images/photos/"+n+".jpg";
  })}

  /* justified rows: har row poori width bharti hai, last row bhi */
  function layout(){
    var W=wall.clientWidth-GAP*2,target=W<600?170:W<1100?240:300;
    var rows=[],row=[],sum=0;
    items.forEach(function(it){
      row.push(it);sum+=it.r;
      if(sum*target+GAP*(row.length-1)>=W){rows.push({a:row,s:sum});row=[];sum=0}
    });
    if(row.length){
      var h=(W-GAP*(row.length-1))/sum;
      if(h>target*1.35&&rows.length){var p=rows.pop();rows.push({a:p.a.concat(row),s:p.s+sum})}
      else rows.push({a:row,s:sum});
    }
    wall.innerHTML="";var i=0;
    rows.forEach(function(rw){
      var d=document.createElement("div");d.className="row";
      d.style.height=((W-GAP*(rw.a.length-1))/rw.s)+"px";
      rw.a.forEach(function(it){
        it.im.style.setProperty("--r",it.r);it.im.style.setProperty("--i",i++);
        d.appendChild(it.im);
      });
      wall.appendChild(d);
    });
  }

  var nums=[];for(var n=1;n<=TOTAL;n++)nums.push(n);
  var ready=Promise.all(nums.map(load)).then(function(){
    items.sort(function(a,b){return a.n-b.n});
    layout();
  });
  var t;addEventListener("resize",function(){clearTimeout(t);t=setTimeout(function(){if(items.length)layout()},150)});

  /* ===== LOADER ===== */
  var l=document.getElementById("loader");
  if(sessionStorage.getItem("seen")){
    l.remove();b.classList.remove("loading");
    ready.then(function(){b.classList.add("show")});return;
  }
  var min=new Promise(function(r){setTimeout(r,2200)});
  var cap=new Promise(function(r){setTimeout(r,6000)});
  Promise.all([min,Promise.race([ready,cap])]).then(function(){
    l.classList.add("out");
    ready.then(function(){b.classList.add("show")});
    setTimeout(function(){l.remove();b.classList.remove("loading")},1000);
    sessionStorage.setItem("seen","1");
  });
})();
