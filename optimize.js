const fs=require("fs"),path=require("path"),sharp=require("sharp");
const IN="images/originals",OUT="images/photos";
fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync("data",{recursive:true});

(async()=>{
  const files=fs.existsSync(IN)?fs.readdirSync(IN).filter(f=>/\.(jpe?g|png|webp|avif|tiff?)$/i.test(f)).sort():[];
  const list=[];
  for(const f of files){
    const name=path.parse(f).name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    const out=path.join(OUT,name+".webp");
    try{
      await sharp(path.join(IN,f)).rotate().resize({width:1400,withoutEnlargement:true}).webp({quality:78}).toFile(out);
      const m=await sharp(out).metadata();
      list.push({src:out.replace(/\\/g,"/"),w:m.width,h:m.height});
    }catch(e){console.log("skip",f,e.message)}
  }
  // jis original ko hata diya, uska chhota version bhi hatao
  const keep=list.map(x=>path.basename(x.src));
  fs.readdirSync(OUT).forEach(f=>{if(!keep.includes(f))fs.unlinkSync(path.join(OUT,f))});
  fs.writeFileSync("data/photos.json",JSON.stringify(list));
  console.log("done",list.length,"photos");
})();
