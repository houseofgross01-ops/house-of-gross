/* ===== CATEGORIES + BRANDS: yahan naam badlo / add karo ===== */
var CATS=[
 {id:"fashion",name:"Fashion",c:"#ff2e63,#7a0f2e",brands:["Raakhdi","Rama's Kurti","Litloom"]},
 {id:"concerts",name:"Concerts",c:"#222,#666",brands:["Farhan Akhtar","B Praak","King","Bella","Panther","Raftaar","Vishal & Shekhar","Seedhe Maut","Saaz","Prakhar"]},
 {id:"brand-films",name:"Brand Films",c:"#d9a441,#5a2d00",brands:["Jaipur Rugs","Raakhdi","Amarpali","Ikaki","Honda"]},
 {id:"food-beverages",name:"Food & Beverages",c:"#7a0f2e,#222",brands:["Native","Cabana Resort","Ikaki","Merlot","Archive Table","Osaka"]},
 {id:"hospitality",name:"Hospitality",c:"#444,#111",brands:["Radisson","Cabana Resort","Rami Tarang","Siroko"]},
 {id:"standup",name:"Standup",c:"#ff2e63,#d9a441",brands:["Harsh Gujral","Zakir Khan"]}
];

/* ===== PHOTOS + VIDEOS: brand ke naam ke neeche add karo =====
   {p:"images/work/raakhdi/1.jpg"}  = photo
   {v:"YOUTUBE_VIDEO_ID"}           = video
*/
var MEDIA={
 // "Raakhdi":[{p:"images/work/raakhdi/1.jpg"},{p:"images/work/raakhdi/2.jpg"},{v:"Y1qsWPtTbLs"}],
};

/* Cover photos (optional, naam auto-match hota hai):
   category cover -> images/work/cat-fashion.jpg
   brand cover    -> images/work/raakhdi.jpg  (naam lowercase, space = "-")  */

function slug(s){return s.toLowerCase().replace(/'/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
function im(src){return '<img src="'+src+'" alt="" loading="lazy" onerror="this.remove()">'}
var g=document.getElementById("g"),back=document.getElementById("back");
function head(eb,t,s,bk){
  document.getElementById("crumb").textContent=eb;
  document.getElementById("gt").textContent=t;
  document.getElementById("gs").textContent=s||"";
  back.hidden=!bk;if(bk)back.href=bk;
}
function tile(href,i,grad,src,small,title){
  return '<a class="gt" href="'+href+'" style="--i:'+i+';--g:linear-gradient(160deg,'+grad+')">'+im(src)+'<small>'+small+'</small><h3>'+title+'</h3></a>';
}
function route(){
  var h=location.hash.slice(1).split("/"),c=CATS.filter(function(x){return x.id===h[0]})[0];
  window.scrollTo(0,0);
  if(!c){
    head("Gallery","Our Work","Photos and films from the brands we've crossed the line with.");
    g.innerHTML='<div class="gg">'+CATS.map(function(x,i){return tile("#"+x.id,i,x.c,"images/work/cat-"+x.id+".jpg",x.brands.length+" brands",x.name)}).join("")+'</div>';
    return;
  }
  var b=c.brands.filter(function(x){return slug(x)===h[1]})[0];
  if(!b){
    head("Gallery",c.name,"Pick a brand.","gallery.html");
    g.innerHTML='<div class="gg b4">'+c.brands.map(function(x,i){return tile("#"+c.id+"/"+slug(x),i,c.c,"images/work/"+slug(x)+".jpg",c.name,x)}).join("")+'</div>';
    return;
  }
  head(c.name,b,"","#"+c.id);
  var m=MEDIA[b]||[];
  g.innerHTML=m.length?'<div class="gm">'+m.map(function(x){
    return x.v?'<a class="mi" data-v="'+x.v+'"><img src="https://img.youtube.com/vi/'+x.v+'/hqdefault.jpg" alt="" loading="lazy"><span class="play"></span></a>'
              :'<a class="mi" data-p="'+x.p+'"><img src="'+x.p+'" alt="" loading="lazy"></a>';
  }).join("")+'</div>':'<div class="soon">Work from '+b+' is coming soon.</div>';
}
function closeBox(){var m=document.getElementById("vm");if(m)m.remove()}
document.addEventListener("click",function(e){
  var t=e.target.closest(".mi");if(!t)return;
  closeBox();
  var m=document.createElement("div");m.id="vm";
  m.innerHTML=t.dataset.v
    ?'<div class="box"><button class="x">&times;</button><iframe src="https://www.youtube-nocookie.com/embed/'+t.dataset.v+'?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>'
    :'<div class="box pic"><button class="x">&times;</button><img src="'+t.dataset.p+'" alt=""></div>';
  m.addEventListener("click",function(ev){if(ev.target===m||ev.target.className==="x")closeBox()});
  document.body.appendChild(m);
});
addEventListener("keydown",function(e){if(e.key==="Escape")closeBox()});
addEventListener("hashchange",route);route();