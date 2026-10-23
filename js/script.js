/* ===== PHOTOS: yahan apni photos ke naam likho ===== */
var PHOTOS=[
  // "images/photos/1.jpg",
  // "images/photos/2.jpg",
  // "images/photos/3.jpg",
];

(function(){
  var wall=document.getElementById("wall");

  if(PHOTOS.length){
    wall.innerHTML=PHOTOS.map(function(p,i){
      return '<img class="ph" style="--i:'+i+'" src="'+p+'" alt="" decoding="async"'+(i<6?'':' loading="lazy"')+' onerror="this.remove()">';
    }).join("");
  }else{
    // photos nahi hain toh layout dikhane ke liye placeholders
    var C=[["#ff2e63","#7a0f2e"],["#222","#666"],["#d9a441","#5a2d00"],["#7a0f2e","#222"],["#444","#111"]];
    var H=[320,440,380,520,300,460,400,360,500];
    wall.innerHTML=H.map(function(h,i){
      var c=C[i%C.length];
      return '<div class="ph" style="--i:'+i+';--h:'+h+'px;--a:'+c[0]+';--b:'+c[1]+'"></div>';
    }).join("");
  }

  /* ===== LOADER ===== */
  var l=document.getElementById("loader"),b=document.body;
  if(sessionStorage.getItem("seen")){l.remove();b.classList.remove("loading");b.classList.add("show");return}

  var min=new Promise(function(r){setTimeout(r,2200)});
  var load=Promise.race([
    new Promise(function(r){if(document.readyState==="complete")r();else addEventListener("load",r)}),
    new Promise(function(r){setTimeout(r,4500)})   // photos der se aayein toh bhi 4.5s ke baad khul jaaye
  ]);

  Promise.all([min,load]).then(function(){
    l.classList.add("out");
    b.classList.add("show");
    setTimeout(function(){l.remove();b.classList.remove("loading")},1000);
    sessionStorage.setItem("seen","1");
  });
})();