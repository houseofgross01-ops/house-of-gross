/* ===== EDIT HERE: email aur social links ===== */
var SITE={
  email:"work@houseofgross.com",
  instagram:"https://www.instagram.com/YOUR_HANDLE",
  linkedin:"https://www.linkedin.com/company/YOUR_PAGE"
};

(function(){
  var page=location.pathname.split("/").pop()||"index.html";
  var links=[["about.html","About us"],["team.html","Team"],["work.html","Work"]];

  var header='<header class="site"><a class="logo" href="index.html"><img src="images/logo-hogs.png" alt="HOGS"></a><nav>'+
    links.map(function(l){return '<a href="'+l[0]+'"'+(page===l[0]?' class="on"':'')+'>'+l[1]+'</a>'}).join("")+
    '</nav></header>';

  var footer='<footer class="site">'+
    '<div><h3><a href="mailto:'+SITE.email+'">Contact us</a></h3><a class="em" href="mailto:'+SITE.email+'">'+SITE.email+'</a></div>'+
    '<div class="fs"><a href="'+SITE.instagram+'" target="_blank" rel="noopener">Instagram</a><a href="'+SITE.linkedin+'" target="_blank" rel="noopener">LinkedIn</a></div>'+
    '<div class="fb">© 2026 HOGS · House of Gross · Jaipur</div></footer>';

  document.body.insertAdjacentHTML("afterbegin",header);
  document.body.insertAdjacentHTML("beforeend",footer);
})();