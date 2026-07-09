const fs=require("fs"),path=require("path"),OUT="D:/disk/CODEX/vi手册logo";
const PptxGenJS=require("../node_modules/pptxgenjs/dist/pptxgen.cjs.js");
const pptx=new PptxGenJS();
pptx.defineLayout({name:"A4",width:8.27,height:11.69});pptx.layout="A4";
const SW=8.27,SH=11.69,M=0.6,pri="E8576C",sec="F8BBD0",acc="C9A96E";
function af(s){s.addShape(pptx.ShapeType.rect,{x:0,y:0,w:0.1,h:SH,fill:{color:pri}});s.addShape(pptx.ShapeType.rect,{x:0.1,y:SH-0.04,w:SW-0.1,h:0.04,fill:{color:pri}})}
function pn(s,n){s.addText(n+" / 13",{x:SW-1.2,y:SH-0.6,w:1,h:0.4,fontSize:8,color:"999999",align:"right",fontFace:"Arial"})}
var n=0,sl;
// 1 cover
n++;sl=pptx.addSlide();sl.background={fill:pri};
sl.addShape(pptx.ShapeType.ellipse,{x:SW*0.25,y:SH*0.15,w:SW*0.5,h:SW*0.5,fill:{color:sec,transparency:60}});
sl.addText("BRAND IDENTITY MANUAL",{x:M,y:SH*0.55,w:SW-M*2,h:0.5,fontSize:11,color:"FFFFFF",align:"center",fontFace:"Arial",charSpacing:6});
sl.addText("\u82b1\u989c\u7f8e\u5bb9\u9662",{x:M,y:SH*0.62,w:SW-M*2,h:1,fontSize:42,color:"FFFFFF",align:"center",fontFace:"Microsoft YaHei",bold:true});
sl.addText("HUA YAN BEAUTY",{x:M,y:SH*0.72,w:SW-M*2,h:0.6,fontSize:14,color:"FFFFFF",align:"center",fontFace:"Arial",charSpacing:6});
sl.addText("\u89c6\u89c9\u8bc6\u522b\u7cfb\u7edf\u89c4\u8303\u624b\u518c",{x:M,y:SH*0.82,w:SW-M*2,h:0.5,fontSize:12,color:"FFFFFF",align:"center",fontFace:"Microsoft YaHei"});
sl.addText("2026.06",{x:M,y:SH*0.9,w:SW-M*2,h:0.4,fontSize:10,color:"FFFFFF",align:"center",fontFace:"Arial"});
// 2 toc
n++;sl=pptx.addSlide();af(sl);
sl.addText("\u76ee  \u5f55",{x:M+0.15,y:0.6,w:4,h:0.8,fontSize:28,color:pri,fontFace:"Microsoft YaHei",bold:true});
["01  \u54c1\u724c\u6982\u8ff0","02  \u8bbe\u8ba1\u7406\u5ff5","03  \u6807\u8bc6\u91ca\u4e49","04  \u6807\u8bc6\u89c4\u8303","05  \u8272\u5f69\u7cfb\u7edf","06  \u5b57\u4f53\u7cfb\u7edf","07  \u54c1\u724c\u7269\u6599","08  \u5305\u88c5\u7cfb\u7edf","09  \u4ea7\u54c1\u5305\u88c5","10  \u5ba3\u4f20\u6d77\u62a5","11  \u4f1a\u5458\u5361\u8bbe\u8ba1","12  \u5e94\u7528\u573a\u666f"].forEach(function(t,i){sl.addText(t,{x:M+0.15+(i<6?0:3.2),y:1.8+(i%6)*1.2,w:3,h:0.8,fontSize:13,color:"555555",fontFace:"Microsoft YaHei"})});pn(sl,n);
// 3 overview
n++;sl=pptx.addSlide();af(sl);
sl.addText("01  \u54c1\u724c\u6982\u8ff0",{x:M+0.15,y:0.5,w:6,h:0.7,fontSize:22,color:pri,fontFace:"Microsoft YaHei",bold:true});
sl.addShape(pptx.ShapeType.rect,{x:M+0.15,y:1.15,w:1.5,h:0.03,fill:{color:acc}});
[["\u54c1\u724c\u540d\u79f0","\u82b1\u989c\u7f8e\u5bb9\u9662"],["\u884c\u4e1a\u7c7b\u522b","\u7f8e\u5bb9/\u517b\u751f"],["\u7ecf\u8425\u5e74\u9650","15 \u5e74"],["\u6240\u5728\u57ce\u5e02","\u5317\u4eac"],["\u54c1\u724c\u613f\u666f","\u4ee5\u82b1\u517b\u989c\uff0c\u4f20\u627f\u4e1c\u65b9\u8349\u672c\u62a4\u80a4\u667a\u6167"],["\u6838\u5fc3\u4ef7\u503c","\u5929\u7136\u3001\u5320\u5fc3\u3001\u4fe1\u8d56\u3001\u4f18\u96c5"],["\u76ee\u6807\u5ba2\u7fa4","28-55\u5c81\u90fd\u5e02\u5973\u6027\uff0c\u8ffd\u6c42\u5929\u7136\u62a4\u80a4"]].forEach(function(lv,i){sl.addText(lv[0],{x:M+0.15,y:1.5+i*1,w:1.8,h:0.6,fontSize:12,color:pri,fontFace:"Microsoft YaHei",bold:true});sl.addText(lv[1],{x:M+2,y:1.5+i*1,w:5.2,h:0.6,fontSize:12,color:"333333",fontFace:"Microsoft YaHei"})});pn(sl,n);
// 4 philosophy
n++;sl=pptx.addSlide();af(sl);
sl.addText("02  \u8bbe\u8ba1\u7406\u5ff5",{x:M+0.15,y:0.5,w:6,h:0.7,fontSize:22,color:pri,fontFace:"Microsoft YaHei",bold:true});
sl.addShape(pptx.ShapeType.rect,{x:M+0.15,y:1.15,w:1.5,h:0.03,fill:{color:acc}});
sl.addText("\u4ee5\u82b1\u4e3a\u9b42\uff0c\u4ee5\u989c\u4e3a\u7f8e",{x:M+0.15,y:1.6,w:SW-M*2-0.15,h:0.8,fontSize:20,color:pri,fontFace:"Microsoft YaHei",italic:true});
sl.addText("\u82b1\u989c\u7f8e\u5bb9\u9662\u7684\u54c1\u724c\u89c6\u89c9\u4ee5\u300c\u82b1\u74e3\u300d\u4e3a\u6838\u5fc3\u8bbe\u8ba1\u5143\u7d20\uff0c\u878d\u5408\u4e1c\u65b9\u5973\u6027\u7684\u67d4\u7f8e\u66f2\u7ebf\u4e0e\u81ea\u7136\u751f\u547d\u529b\u3002\u6574\u4f53\u98ce\u683c\u8ffd\u6c42\u300c\u65b0\u4e2d\u5f0f\u4f18\u96c5\u300d\u2014\u2014\u65e2\u4f20\u627f\u53e4\u5178\u4e1c\u65b9\u7f8e\u5b66\uff0c\u53c8\u8d4b\u4e88\u73b0\u4ee3\u7b80\u7ea6\u6c14\u8d28\u3002\n\n\u8272\u5f69\u4f53\u7cfb\u4ee5\u82b1\u989c\u7c89\u4e3a\u4e3b\u8c03\uff0c\u642d\u914d\u6d45\u6a31\u7c89\u7684\u67d4\u548c\u8fc7\u6e21\u4e0e\u6697\u91d1\u7684\u9ad8\u7ea7\u70b9\u7f00\uff0c\u8425\u9020\u6e29\u6696\u3001\u4fe1\u8d56\u3001\u4f18\u96c5\u7684\u54c1\u724c\u611f\u53d7\u3002",{x:M+0.15,y:2.6,w:SW-M*2-0.15,h:5,fontSize:12,color:"555555",fontFace:"Microsoft YaHei",lineSpacingMultiple:1.8});pn(sl,n);
// 5 logo-interp
n++;sl=pptx.addSlide();af(sl);
sl.addText("03  \u6807\u8bc6\u91ca\u4e49",{x:M+0.15,y:0.5,w:6,h:0.7,fontSize:22,color:pri,fontFace:"Microsoft YaHei",bold:true});
sl.addShape(pptx.ShapeType.rect,{x:M+0.15,y:1.15,w:1.5,h:0.03,fill:{color:acc}});
sl.addText("\u82b1\u989c\u6807\u8bc6\u4ee5\u300c\u82b1\u74e3\u300d\u4e0e\u300c\u5973\u6027\u4fa7\u8138\u8f6e\u5ed3\u300d\u4e3a\u6838\u5fc3\u5143\u7d20\uff0c\u91c7\u7528\u5706\u5f62\u5fbd\u7ae0\u6784\u56fe\uff0c\u4f20\u8fbe\u5b8c\u6ee1\u548c\u8c10\u7684\u54c1\u724c\u7cbe\u795e\u3002\u82b1\u74e3\u5c42\u53e0\u8212\u5c55\uff0c\u5bd3\u610f\u808c\u80a4\u5982\u82b1\u822c\u81ea\u7136\u7efd\u653e\uff1b\u4fa7\u8138\u7ebf\u6761\u67d4\u7f8e\u6d41\u7545\uff0c\u4f53\u73b0\u4e1c\u65b9\u5973\u6027\u4f18\u96c5\u6c14\u8d28\u3002\u6574\u4f53\u9020\u578b\u7b80\u7ea6\u514b\u5236\uff0c\u5728\u73b0\u4ee3\u611f\u4e0e\u4f20\u7edf\u97f5\u5473\u4e4b\u95f4\u53d6\u5f97\u7cbe\u5999\u5e73\u8861\u3002",{x:M+0.15,y:1.6,w:SW-M*2-0.15,h:3.5,fontSize:12,color:"555555",fontFace:"Microsoft YaHei",lineSpacingMultiple:1.8});
sl.addText("Visual DNA:",{x:M+0.15,y:5.5,w:2,h:0.5,fontSize:11,color:pri,fontFace:"Arial",bold:true});
sl.addText("Circular emblem blending petals with female profile silhouette, flowing lines, soft pink rose gold tones, minimalist Chinese aesthetic, elegant symmetrical composition",{x:M+0.15,y:5.9,w:SW-M*2-0.15,h:1.2,fontSize:10,color:"777777",fontFace:"Arial",italic:true});pn(sl,n);
// 6 logo-specs
n++;sl=pptx.addSlide();af(sl);
sl.addText("04  \u6807\u8bc6\u89c4\u8303",{x:M+0.15,y:0.5,w:6,h:0.7,fontSize:22,color:pri,fontFace:"Microsoft YaHei",bold:true});
sl.addShape(pptx.ShapeType.rect,{x:M+0.15,y:1.15,w:1.5,h:0.03,fill:{color:acc}});
sl.addShape(pptx.ShapeType.rect,{x:SW*0.2,y:1.8,w:SW*0.6,h:SW*0.6,fill:{color:"F5F5F5"},rectRadius:0.1});
sl.addText("\u54c1\u724c\u6807\u8bc6\n\u5c55\u793a\u533a\u57df",{x:SW*0.2,y:2.5,w:SW*0.6,h:1,fontSize:14,color:"CCCCCC",align:"center",fontFace:"Microsoft YaHei"});
sl.addText("\u6700\u5c0f\u4f7f\u7528\u5c3a\u5bf8\uff1a\u9ad8\u5ea6\u4e0d\u4f4e\u4e8e 20mm\n\u4fdd\u62a4\u7a7a\u95f4\uff1a\u6807\u8bc6\u56db\u5468\u4fdd\u7559 1/4 \u6807\u8bc6\u9ad8\u5ea6\u7684\u7a7a\u767d\u533a\u57df\n\u80cc\u666f\u63a7\u5236\uff1a\u6d45\u8272\u80cc\u666f\u4f7f\u7528\u6807\u51c6\u7248\uff0c\u6df1\u8272\u80cc\u666f\u4f7f\u7528\u53cd\u767d\u7248",{x:M+0.15,y:6.2,w:SW-M*2-0.15,h:2,fontSize:11,color:"555555",fontFace:"Microsoft YaHei",lineSpacingMultiple:1.6});pn(sl,n);
// 7 color
n++;sl=pptx.addSlide();af(sl);
sl.addText("05  \u8272\u5f69\u7cfb\u7edf",{x:M+0.15,y:0.5,w:6,h:0.7,fontSize:22,color:pri,fontFace:"Microsoft YaHei",bold:true});
sl.addShape(pptx.ShapeType.rect,{x:M+0.15,y:1.15,w:1.5,h:0.03,fill:{color:acc}});
[{h:pri,n:"\u82b1\u989c\u7c89",r:"\u4e3b\u8272 / Primary",u:"\u54c1\u724c\u6838\u5fc3\u8bc6\u522b\u8272\uff0cLogo\u4e3b\u8272\u8c03\u3001\u91cd\u8981\u6807\u9898\u3001\u54c1\u724c\u88c5\u9970\u6761"},{h:sec,n:"\u6d45\u6a31\u7c89",r:"\u8f85\u52a9\u8272 / Secondary",u:"\u80cc\u666f\u8272\u3001\u5927\u9762\u79ef\u5e95\u8272\u3001\u67d4\u548c\u8fc7\u6e21\u533a\u57df"},{h:acc,n:"\u6697\u91d1",r:"\u5f3a\u8c03\u8272 / Accent",u:"\u70b9\u7f00\u7ebf\u6761\u3001\u56fe\u6807\u9ad8\u4eae\u3001\u9ad8\u7aef\u8d28\u611f\u8868\u8fbe"}].forEach(function(c,i){var y=1.6+i*2.5;sl.addShape(pptx.ShapeType.rect,{x:M+0.15,y:y,w:1.5,h:1.8,fill:{color:c.h},rectRadius:0.05});sl.addText(c.n,{x:M+1.9,y:y,w:4,h:0.5,fontSize:16,color:"333333",fontFace:"Microsoft YaHei",bold:true});sl.addText(c.r+"    "+c.h,{x:M+1.9,y:y+0.5,w:5,h:0.4,fontSize:10,color:"888888",fontFace:"Arial"});sl.addText(c.u,{x:M+1.9,y:y+1,w:5,h:0.7,fontSize:10,color:"666666",fontFace:"Microsoft YaHei"})});pn(sl,n);
// 8 typo
n++;sl=pptx.addSlide();af(sl);
sl.addText("06  \u5b57\u4f53\u7cfb\u7edf",{x:M+0.15,y:0.5,w:6,h:0.7,fontSize:22,color:pri,fontFace:"Microsoft YaHei",bold:true});
sl.addShape(pptx.ShapeType.rect,{x:M+0.15,y:1.15,w:1.5,h:0.03,fill:{color:acc}});
sl.addText("\u54c1\u724c\u4e13\u7528\u5b57\u4f53",{x:M+0.15,y:1.6,w:4,h:0.5,fontSize:14,color:pri,fontFace:"Microsoft YaHei",bold:true});
sl.addText("\u6807\u9898\u5b57\u4f53\uff1a\u601d\u6e90\u9ed1\u4f53 Bold / Noto Sans SC Bold\n\u6b63\u6587\u5b57\u4f53\uff1a\u601d\u6e90\u9ed1\u4f53 Regular / Noto Sans SC Regular\n\u88c5\u9970\u5b57\u4f53\uff1a\u601d\u6e90\u5b8b\u4f53 / Noto Serif SC\uff08\u4ec5\u54c1\u724c\u7406\u5ff5\u7b49\u7279\u6b8a\u9875\u9762\uff09",{x:M+0.15,y:2.2,w:SW-M*2-0.15,h:2.5,fontSize:11,color:"555555",fontFace:"Microsoft YaHei",lineSpacingMultiple:1.8});
sl.addText("\u5b57\u4f53\u5c42\u7ea7\u89c4\u8303",{x:M+0.15,y:4.8,w:4,h:0.5,fontSize:14,color:pri,fontFace:"Microsoft YaHei",bold:true});
[["\u5c01\u9762\u6807\u9898","42pt","Bold"],["\u7ae0\u8282\u6807\u9898","22pt","Bold"],["\u5c0f\u6807\u9898","16pt","Bold"],["\u6b63\u6587","12pt","Regular"],["\u6ce8\u91ca/\u9875\u7801","8pt","Regular"]].forEach(function(r,i){sl.addText(r[0],{x:M+0.15,y:5.4+i*0.5,w:2,h:0.4,fontSize:11,color:"333333",fontFace:"Microsoft YaHei"});sl.addText(r[1],{x:M+2.3,y:5.4+i*0.5,w:1.5,h:0.4,fontSize:11,color:"888888",fontFace:"Arial"});sl.addText(r[2],{x:M+3.8,y:5.4+i*0.5,w:1.5,h:0.4,fontSize:11,color:"888888",fontFace:"Arial"})});pn(sl,n);
// 9-13 scenes
var sd=[["07  \u54c1\u724c\u7269\u6599","Brand Stationery","\u7f8e\u5bb9\u4ea7\u54c1\u74f6\u8eab\u4e0e\u5305\u88c5\u5957\u88c5\uff0c\u5ef6\u7eed\u82b1\u989c\u7c89\u4e3b\u8272\u8c03\uff0c\u8425\u9020\u7edf\u4e00\u4f18\u96c5\u7684\u4ea7\u54c1\u9648\u5217\u6548\u679c\u3002","stationery"],["08  \u5305\u88c5\u7cfb\u7edf","Packaging System","\u54c1\u724c\u793c\u54c1\u888b\u91c7\u7528\u6d45\u6a31\u7c89\u57fa\u8c03\u642d\u914d\u6697\u91d1\u7f0e\u5e26\uff0c\u7cbe\u81f4\u82b1\u5349\u538b\u7eb9\u5de5\u827a\uff0c\u4f53\u73b0\u9ad8\u7aef\u7f8e\u5bb9\u4f1a\u6240\u54c1\u724c\u8d28\u611f\u3002","packaging-1"],["09  \u4ea7\u54c1\u5305\u88c5","Product Packaging","\u4ea7\u54c1\u7f50\u88c5\u91c7\u7528\u82b1\u989c\u7c89\u6807\u7b7e\u642d\u914d\u73ab\u7470\u91d1\u74f6\u76d6\uff0c\u690d\u7269\u5143\u7d20\u70b9\u7f00\u5176\u95f4\uff0c\u4f20\u8fbe\u5929\u7136\u62a4\u80a4\u7406\u5ff5\u3002","packaging-2"],["10  \u5ba3\u4f20\u6d77\u62a5","Promotional Poster","\u54c1\u724c\u5ba3\u4f20\u6d77\u62a5\u878d\u5408\u4e2d\u5f0f\u7f8e\u5b66\u4e0e\u82b1\u5349\u5143\u7d20\uff0c\u6696\u8c03\u706f\u5149\u8425\u9020\u6e29\u99a8\u8212\u9002\u7684\u7f8e\u5bb9\u7a7a\u95f4\u6c1b\u56f4\u3002","marketing-1"],["11  \u4f1a\u5458\u5361\u8bbe\u8ba1","VIP Membership Card","VIP\u4f1a\u5458\u5361\u91c7\u7528\u6697\u91d1\u70eb\u5370\u5de5\u827a\uff0c\u82b1\u5349\u7eb9\u7406\u642d\u914d\u9ad8\u7ea7\u7eb9\u7406\u7eb8\uff0c\u5f70\u663e\u5c0a\u8d35\u4f1a\u5458\u8eab\u4efd\u3002","marketing-2"]];
sd.forEach(function(d){n++;sl=pptx.addSlide();af(sl);sl.addText(d[0],{x:M+0.15,y:0.5,w:6,h:0.6,fontSize:22,color:pri,fontFace:"Microsoft YaHei",bold:true});sl.addText(d[1],{x:M+0.15,y:1,w:6,h:0.4,fontSize:10,color:"999999",fontFace:"Arial",charSpacing:2});sl.addShape(pptx.ShapeType.rect,{x:M+0.15,y:1.4,w:1.5,h:0.03,fill:{color:acc}});var fp=path.join(OUT,"yang_scene_"+d[3]+".png");try{var b=fs.readFileSync(fp);sl.addImage({data:"image/png;base64,"+b.toString("base64")},{x:M+0.15,y:1.8,w:SW-M*2-0.15,h:5.5,sizing:{type:"contain",w:SW-M*2-0.15,h:5.5}});console.log("  [OK] "+d[3])}catch(e){console.log("  [MISS] "+d[3]+": "+fp);sl.addShape(pptx.ShapeType.rect,{x:M+0.15,y:1.8,w:SW-M*2-0.15,h:5.5,fill:{color:"F5F5F5"}});sl.addText("[ "+d[3]+" ]",{x:M+0.15,y:4.2,w:SW-M*2-0.15,h:0.5,fontSize:12,color:"CCCCCC",align:"center",fontFace:"Microsoft YaHei"})}sl.addText(d[2],{x:M+0.15,y:7.5,w:SW-M*2-0.15,h:1,fontSize:10,color:"777777",fontFace:"Microsoft YaHei"});pn(sl,n)});
// 13 back
n++;sl=pptx.addSlide();sl.background={fill:pri};
sl.addText("\u82b1\u989c\u7f8e\u5bb9\u9662",{x:M,y:SH*0.38,w:SW-M*2,h:0.8,fontSize:32,color:"FFFFFF",align:"center",fontFace:"Microsoft YaHei",bold:true});
sl.addText("HUA YAN BEAUTY",{x:M,y:SH*0.48,w:SW-M*2,h:0.5,fontSize:14,color:"FFFFFF",align:"center",fontFace:"Arial",charSpacing:6});
sl.addShape(pptx.ShapeType.rect,{x:SW*0.35,y:SH*0.56,w:SW*0.3,h:0.01,fill:{color:"FFFFFF"}});
sl.addText("\u89c6\u89c9\u8bc6\u522b\u7cfb\u7edf\u89c4\u8303\u624b\u518c",{x:M,y:SH*0.6,w:SW-M*2,h:0.5,fontSize:12,color:"FFFFFF",align:"center",fontFace:"Microsoft YaHei"});
sl.addText("BrandBrain \u00b7 \u54c1\u724c\u5927\u8111 \u00b7 2026",{x:M,y:SH*0.85,w:SW-M*2,h:0.4,fontSize:9,color:"FFFFFF",align:"center",fontFace:"Arial",charSpacing:4});
// SAVE
var outPath=path.join(OUT,"\u82b1\u989c\u7f8e\u5bb9\u9662-VI\u624b\u518c-v3.pptx");
pptx.writeFile({fileName:outPath}).then(function(){var s=fs.statSync(outPath);console.log("DONE: "+outPath+" ("+(s.size/1024).toFixed(0)+" KB)")}).catch(function(e){console.error("FAIL:",e.message)});
