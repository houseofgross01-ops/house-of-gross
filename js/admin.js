var $=function(s){return document.querySelector(s)};
var CFG=JSON.parse(localStorage.getItem("hogs_admin")||"{}");
var data,cat,brand,up=[],del=[],pv={};
function slug(s){return s.toLowerCase().replace(/'/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
function msg(t){$("#msg").textContent=t}
function dirty(){$("#pub").hidden=!(up.length||del.length||data&&data._d)}
if(CFG.repo){$("#repo").value=CFG.repo;$("#branch").value=CFG.branch;$("#token").value=CFG.token}

function gh(path,method,body){
  var u="https://api.github.com/repos/"+CFG.repo+"/contents/"+path+(method==="GET"?"?ref="+CFG.branch+"&t="+Date.now():"");
  return fetch(u,{method:method,headers:{Authorization:"Bearer "+CFG.token,Accept:"application/vnd.github+json"},body:body?JSON.stringify(body):undefined})
  .then(function(r){
    if(r.status===404)return null;
    if(!r.ok)return r.json().then(function(e){throw new Error(e.message||r.status)});
    return r.json();
  });
}
function put(path,b64,m){return gh(path,"GET").then(function(f){return gh(path,"PUT",{message:m,content:b64,branch:CFG.branch,sha:f?f.sha:undefined})})}
function rm(path){return gh(path,"GET").then(function(f){return f?gh(path,"DELETE",{message:"admin: remove "+path,sha:f.sha,branch:CFG.branch}):0})}

$("#connect").onclick=function(){
  CFG={repo:$("#repo").value.trim(),branch:$("#branch").value.trim()||"main",token:$("#token").value.trim()};
  msg("Connecting...");
  gh("data/gallery.json","GET").then(function(f){
    if(!f)throw new Error("data/gallery.json not found");
    data=JSON.parse(decodeURIComponent(escape(atob(f.content.replace(/\n/g,"")))));
    data.media=data.media||{};
    localStorage.setItem("hogs_admin",JSON.stringify(CFG));
    $("#login").hidden=true;$("#app").hidden=false;
    cat=data.cats[0];drawCats();msg("Connected. Make changes, then Publish.");
  }).catch(function(e){msg("Error: "+e.message)});
};

function drawCats(){
  $("#cats").innerHTML=data.cats.map(function(c){return '<button class="chip'+(c===cat?' on':'')+'" data-c="'+c.id+'">'+c.name+'</button>'}).join("");
  if(!cat.brands.includes(brand))brand=null;
  drawBrands();
}
function drawBrands(){
  $("#brands").innerHTML=cat.brands.map(function(b){return '<button class="chip'+(b===brand?' on':'')+'" data-b="'+b.replace(/"/g,'&quot;')+'">'+b+'</button>'}).join("")||'<span style="color:var(--mut)">No brands yet.</span>';
  drawMedia();
}
function drawMedia(){
  $("#work").hidden=!brand;if(!brand)return;
  $("#wt").textContent=brand;
  var l=data.media[brand]||[];
  $("#mg").innerHTML=l.map(function(x,i){
    var src=x.v?"https://img.youtube.com/vi/"+x.v+"/hqdefault.jpg":(pv[x.p]||x.p);
    return '<div class="it"><img src="'+src+'" alt="">'+(x.v?'<em>video</em>':'')+'<button data-i="'+i+'" title="Remove">&times;</button></div>';
  }).join("")||'<span style="color:var(--mut)">Nothing here yet.</span>';
  dirty();
}
$("#cats").onclick=function(e){var b=e.target.closest("[data-c]");if(!b)return;cat=data.cats.filter(function(c){return c.id===b.dataset.c})[0];drawCats()};
$("#brands").onclick=function(e){var b=e.target.closest("[data-b]");if(!b)return;brand=b.dataset.b;drawBrands()};
$("#mg").onclick=function(e){
  var b=e.target.closest("[data-i]");if(!b||!confirm("Remove this item?"))return;
  var it=data.media[brand].splice(+b.dataset.i,1)[0];
  if(it.p){var k=up.findIndex(function(u){return u.path===it.p});if(k>-1)up.splice(k,1);else del.push(it.p)}
  drawMedia();
};
$("#addb").onclick=function(){
  var n=$("#nb").value.trim();if(!n||cat.brands.includes(n))return;
  cat.brands.push(n);data._d=1;brand=n;$("#nb").value="";drawBrands();
};
$("#delb").onclick=function(){
  if(!brand||!confirm("Remove brand "+brand+" from "+cat.name+"? (its photos stay in the repo)"))return;
  cat.brands.splice(cat.brands.indexOf(brand),1);data._d=1;brand=null;drawBrands();
};

function prep(file,max){return new Promise(function(res){
  var img=new Image(),u=URL.createObjectURL(file);
  img.onload=function(){
    var s=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");
    c.width=img.width*s;c.height=img.height*s;c.getContext("2d").drawImage(img,0,0,c.width,c.height);
    var d=c.toDataURL("image/jpeg",.82);URL.revokeObjectURL(u);res({b64:d.split(",")[1],url:d});
  };img.src=u;
})}
$("#ph").onchange=async function(e){
  msg("Preparing photos...");
  var l=data.media[brand]=data.media[brand]||[];
  for(var f of e.target.files){
    var r=await prep(f,1600),p="images/work/"+slug(brand)+"/"+Date.now()+"-"+Math.random().toString(36).slice(2,6)+".jpg";
    up.push({path:p,b64:r.b64});pv[p]=r.url;l.push({p:p});
  }
  e.target.value="";msg("Photos added. Click Publish to go live.");drawMedia();
};
function yid(s){var m=s.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/);return m?m[1]:(/^[\w-]{11}$/.test(s.trim())?s.trim():null)}
$("#addy").onclick=function(){
  var id=yid($("#yt").value);if(!id){msg("Valid YouTube link daalo.");return}
  (data.media[brand]=data.media[brand]||[]).push({v:id});$("#yt").value="";data._d=1;drawMedia();
};
async function cover(file,path){
  var r=await prep(file,1200);
  up=up.filter(function(u){return u.path!==path});up.push({path:path,b64:r.b64});
  msg("Cover ready. Click Publish.");dirty();
}
$("#cvb").onchange=function(e){if(e.target.files[0])cover(e.target.files[0],"images/work/"+slug(brand)+".jpg")};
$("#cvc").onchange=function(e){if(e.target.files[0])cover(e.target.files[0],"images/work/cat-"+cat.id+".jpg")};

$("#pub").onclick=async function(){
  var b=$("#pub");b.disabled=true;
  try{
    for(var i=0;i<up.length;i++){msg("Uploading "+(i+1)+"/"+up.length+"...");await put(up[i].path,up[i].b64,"admin: add "+up[i].path)}
    for(var j=0;j<del.length;j++){msg("Removing files...");await rm(del[j])}
    msg("Saving gallery data...");
    delete data._d;
    await put("data/gallery.json",btoa(unescape(encodeURIComponent(JSON.stringify(data,null,1)))),"admin: update gallery");
    up=[];del=[];dirty();
    msg("Published. Site 1-2 min mein update hogi (Ctrl+Shift+R).");
  }catch(e){msg("Error: "+e.message)}
  b.disabled=false;
};