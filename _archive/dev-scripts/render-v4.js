const fs=require("fs"),path=require("path"),OUT="D:/disk/CODEX/vi手册logo";
const PptxGenJS=require("../node_modules/pptxgenjs/dist/pptxgen.cjs.js");
const pptx=new PptxGenJS();
pptx.defineLayout({name:"A4",width:8.27,height:11.69});pptx.layout="A4";
const SW=8.27,SH=11.69,M=0.6,pri="E8576C",sec="F8BBD0",acc="C9A96E";
function af(s){s.addShape(pptx.ShapeType.rect,{x:0,y:0,w:0.1,h:SH,fill:{color:pri}});s.addShape(pptx.ShapeType.rect,{x:0.1,y:SH-0.04,w:SW-0.1,h:0.04,fill:{color:pri}})}
function pn(s,n,t){s.addText(n+" / "+t,{x:SW-1.2,y:SH-0.6,w:1,h:0.4,fontSize:8,color:"999999",align:"right",fontFace:"Arial"})}
function hdr(s,t){s.addText(t,{x:M+0.15,y:0.5,w:6,h:0.7,fontSize:22,color:pri,fontFace:"Microsoft YaHei",bold:true});s.addShape(pptx.ShapeType.rect,{x:M+0.15,y:1.15,w:1.5,h:0.03,fill:{color:acc}})}
function img(s,fp,x,y,w,h){try{var b=fs.readFileSync(fp);s.addImage({data:"image/png;base64,"+b.toString("base64")},{x:x,y:y,w:w,h:h,sizing:{type:"contain",w:w,h:h}});return true}catch(e){return false}}

var T=16,n=0,sl;

// 1 COVER
n++;sl=pptx.addSlide();sl.background={fill:pri};
sl.addShape(pptx.ShapeType.ellipse,{x:SW*0.2,y:SH*0.1,w:SW*0.6,h:SW*0.6,fill:{color:sec,transparency:55}});
sl.addText("BRAND IDENTITY MANUAL",{x:M,y:SH*0.58,w:SW-M*2,h:0.5,fontSize:11,color:"FFFFFF",align:"center",fontFace:"Arial",charSpacing:6});
sl.addText("\u82b1\u989c\u7f8e\u5bb9\u9662",{x:M,y:SH*0.64,w:SW-M*2,h:1,fontSize:42,color:"FFFFFF",align:"center",fontFace:"Microsoft YaHei",bold:true});
sl.addText("HUA YAN BEAUTY",{x:M,y:SH*0.74,w:SW-M*2,h:0.5,fontSize:14,color:"FFFFFF",align:"center",fontFace:"Arial",charSpacing:6});
sl.addText("\u89c6\u89c9\u8bc6\u522b\u7cfb\u7edf\u89c4\u8303\u624b\u518c  \u00b7  2026",{x:M,y:SH*0.88,w:SW-M*2,h:0.4,fontSize:10,color:"FFFFFF",align:"center",fontFace:"Microsoft YaHei"});

// 2 BRAND INTRO
n++;sl=pptx.addSlide();af(sl);
sl.addText("\u82b1\u989c\u7f8e\u5bb9\u9662",{x:M+0.15,y:0.5,w:6,h:0.8,fontSize:28,color:pri,fontFace:"Microsoft YaHei",bold:true});
sl.addShape(pptx.ShapeType.rect,{x:M+0.15,y:1.2,w:1.5,h:0.03,fill:{color:acc}});
sl.addText("\u5317\u4eac  \u00b7  15\u5e74\u8001\u5e97  \u00b7  \u4e1c\u65b9\u8349\u672c\u62a4\u80a4",{x:M+0.15,y:1.5,w:SW-M*2-0.15,h:0.5,fontSize:12,color:"888888",fontFace:"Microsoft YaHei"});
sl.addText("\u4ee5\u82b1\u517b\u989c\uff0c\u4f20\u627f\u4e1c\u65b9\u8349\u672c\u62a4\u80a4\u667a\u6167\uff0c\u8ba9\u6bcf\u4e00\u4f4d\u5973\u6027\u7115\u53d1\u81ea\u7136\u4e4b\u7f8e\u3002\n\n\u5929\u7136  \u00b7  \u5320\u5fc3  \u00b7  \u4fe1\u8d56  \u00b7  \u4f18\u96c5\n\n28-55\u5c81\u90fd\u5e02\u5973\u6027\uff0c\u8ffd\u6c42\u5929\u7136\u62a4\u80a4\u4e0e\u8eab\u5fc3\u5e73\u8861",{x:M+0.15,y:2.5,w:SW-M*2-0.15,h:5,fontSize:13,color:"555555",fontFace:"Microsoft YaHei",lineSpacingMultiple:2});pn(sl,n,T);

// 3 BRAND PHILOSOPHY
n++;sl=pptx.addSlide();af(sl);hdr(sl,"\u54c1\u724c\u6838\u5fc3\u7406\u5ff5");
sl.addText("\u4ee5\u82b1\u4e3a\u9b42\uff0c\u4ee5\u989c\u4e3a\u7f8e",{x:M+0.15,y:1.6,w:SW-M*2-0.15,h:0.7,fontSize:18,color:pri,fontFace:"Microsoft YaHei",italic:true});
sl.addText("\u82b1\u989c\u7f8e\u5bb9\u9662\u7684\u54c1\u724c\u89c6\u89c9\u4ee5\u300c\u82b1\u74e3\u300d\u4e3a\u6838\u5fc3\u8bbe\u8ba1\u5143\u7d20\uff0c\u878d\u5408\u4e1c\u65b9\u5973\u6027\u7684\u67d4\u7f8e\u66f2\u7ebf\u4e0e\u81ea\u7136\u751f\u547d\u529b\u3002\u6574\u4f53\u98ce\u683c\u8ffd\u6c42\u300c\u65b0\u4e2d\u5f0f\u4f18\u96c5\u300d\u2014\u2014\u65e2\u4f20\u627f\u53e4\u5178\u4e1c\u65b9\u7f8e\u5b66\uff0c\u53c8\u8d4b\u4e88\u73b0\u4ee3\u7b80\u7ea6\u6c14\u8d28\u3002\n\n\u8272\u5f69\u4f53\u7cfb\u4ee5\u82b1\u989c\u7c89\u4e3a\u4e3b\u8c03\uff0c\u642d\u914d\u6d45\u6a31\u7c89\u7684\u67d4\u548c\u8fc7\u6e21\u4e0e\u6697\u91d1\u7684\u9ad8\u7ea7\u70b9\u7f00\uff0c\u8425\u9020\u6e29\u6696\u3001\u4fe1\u8d56\u3001\u4f18\u96c5\u7684\u54c1\u724c\u611f\u53d7\u3002",{x:M+0.15,y:2.6,w:SW-M*2-0.15,h:5,fontSize:12,color:"555555",fontFace:"Microsoft YaHei",lineSpacingMultiple:1.8});pn(sl,n,T);

// 4 LOGO INTERPRETATION
n++;sl=pptx.addSlide();af(sl);hdr(sl,"\u6807\u8bc6\u91ca\u4e49");
sl.addText("\u82b1\u989c\u6807\u8bc6\u4ee5\u300c\u82b1\u74e3\u300d\u4e0e\u300c\u5973\u6027\u4fa7\u8138\u8f6e\u5ed3\u300d\u4e3a\u6838\u5fc3\u5143\u7d20\uff0c\u91c7\u7528\u5706\u5f62\u5fbd\u7ae0\u6784\u56fe\uff0c\u4f20\u8fbe\u5b8c\u6ee1\u548c\u8c10\u7684\u54c1\u724c\u7cbe\u795e\u3002\u82b1\u74e3\u5c42\u53e0\u8212\u5c55\uff0c\u5bd3\u610f\u808c\u80a4\u5982\u82b1\u822c\u81ea\u7136\u7efd\u653e\uff1b\u4fa7\u8138\u7ebf\u6761\u67d4\u7f8e\u6d41\u7545\uff0c\u4f53\u73b0\u4e1c\u65b9\u5973\u6027\u4f18\u96c5\u6c14\u8d28\u3002\u6574\u4f53\u9020\u578b\u7b80\u7ea6\u514b\u5236\uff0c\u5728\u73b0\u4ee3\u611f\u4e0e\u4f20\u7edf\u97f5\u5473\u4e4b\u95f4\u53d6\u5f97\u7cbe\u5999\u5e73\u8861\u3002",{x:M+0.15,y:1.6,w:SW-M*2-0.15,h:3.5,fontSize:12,color:"555555",fontFace:"Microsoft YaHei",lineSpacingMultiple:1.8});
sl.addShape(pptx.ShapeType.rect,{x:SW*0.15,y:5.5,w:SW*0.7,h:SW*0.7,fill:{color:"FAFAFA"},rectRadius:0.08});
sl.addText("\u54c1\u724c\u6807\u8bc6\n\u5c55\u793a\u533a\u57df",{x:SW*0.15,y:5.9,w:SW*0.7,h:0.8,fontSize:13,color:"CCCCCC",align:"center",fontFace:"Microsoft YaHei"});pn(sl,n,T);

// 5 LOGO COMBINATION (4 variants)
n++;sl=pptx.addSlide();af(sl);hdr(sl,"Logo\u7ec4\u5408\u89c4\u8303");
sl.addText("\u54c1\u724c\u6807\u8bc6\u63d0\u4f9b4\u79cd\u7ec4\u5408\u53d8\u4f53\uff0c\u9002\u7528\u4e8e\u4e0d\u540c\u5e94\u7528\u573a\u666f",{x:M+0.15,y:1.4,w:SW-M*2-0.15,h:0.5,fontSize:11,color:"888888",fontFace:"Microsoft YaHei"});
var logos=["yang_logo_01.png","yang_logo_02.png","yang_logo_03.png","yang_logo_04.png"];
var labels=["\u53d8\u4f53 A","\u53d8\u4f53 B","\u53d8\u4f53 C","\u53d8\u4f53 D"];
logos.forEach(function(f,i){
  var col=i%2,row=Math.floor(i/2);
  var x=M+0.15+col*(SW/2-M-0.05),y=2.1+row*4.2,w=SW/2-M-0.2,h=3.6;
  sl.addShape(pptx.ShapeType.rect,{x:x,y:y,w:w,h:h,fill:{color:"FAFAFA"},rectRadius:0.05,line:{color:"E0E0E0",width:0.5}});
  var fp=path.join(OUT,f);
  if(img(sl,fp,x+0.1,y+0.15,w-0.2,h-0.7)){
    console.log("  [OK] Logo "+f);
  }else{
    sl.addText("[ "+f+" ]",{x:x+0.1,y:y+1.5,w:w-0.2,h:0.5,fontSize:11,color:"CCCCCC",align:"center",fontFace:"Arial"});
  }
  sl.addText(labels[i],{x:x,y:y+h-0.55,w:w,h:0.4,fontSize:10,color:"999999",align:"center",fontFace:"Arial"});
});pn(sl,n,T);

// 6 LOGO MISUSE
n++;sl=pptx.addSlide();af(sl);hdr(sl,"Logo\u8bef\u7528\u89c4\u8303");
sl.addText("\u4ee5\u4e0b\u4e3a\u6807\u8bc6\u4f7f\u7528\u7981\u5fcc\uff0c\u8bf7\u4e25\u683c\u907f\u514d\uff1a",{x:M+0.15,y:1.4,w:SW-M*2-0.15,h:0.5,fontSize:11,color:"888888",fontFace:"Microsoft YaHei"});
var misuse=["\u2605 \u7981\u6b62\u62c9\u4f38\u6216\u538b\u7f29\u6807\u8bc6","\u2605 \u7981\u6b62\u66f4\u6539\u6807\u8bc6\u914d\u8272","\u2605 \u7981\u6b62\u65cb\u8f6c\u6216\u503e\u659c\u6807\u8bc6","\u2605 \u7981\u6b62\u5728\u590d\u6742\u80cc\u666f\u4e0a\u4f7f\u7528","\u2605 \u7981\u6b62\u6dfb\u52a0\u9634\u5f71\u6216\u7279\u6548","\u2605 \u7981\u6b62\u4f7f\u7528\u975e\u54c1\u724c\u89c4\u5b9a\u5b57\u4f53","\u2605 \u4fdd\u6301\u6700\u5c0f\u4f7f\u7528\u5c3a\u5bf8 20mm","\u2605 \u4fdd\u7559\u6807\u8bc6\u56db\u5468 1/4 \u9ad8\u5ea6\u4fdd\u62a4\u7a7a\u95f4"];
misuse.forEach(function(t,i){
  sl.addShape(pptx.ShapeType.rect,{x:M+0.15,y:2.2+i*1.05,w:SW-M*2-0.15,h:0.8,fill:{color:"FFF5F5"},rectRadius:0.05});
  sl.addText(t,{x:M+0.5,y:2.35+i*1.05,w:SW-M*2-1,w:5,h:0.5,h:0.5,fontSize:12,color:"CC5555",fontFace:"Microsoft YaHei"});
});pn(sl,n,T);

// 7 AUXILIARY GRAPHICS
n++;sl=pptx.addSlide();af(sl);hdr(sl,"\u8f85\u52a9\u56fe\u5f62");
sl.addText("\u54c1\u724c\u8f85\u52a9\u56fe\u5f62\u63d0\u53d6\u81ea\u82b1\u74e3\u5f62\u6001\uff0c\u901a\u8fc7\u91cd\u590d\u3001\u65cb\u8f6c\u3001\u6e10\u53d8\u7b49\u65b9\u5f0f\u5f62\u6210\u54c1\u724c\u72ec\u7279\u7684\u89c6\u89c9\u7eb9\u6837\uff0c\u5e94\u7528\u4e8e\u5305\u88c5\u3001\u5e97\u9762\u3001\u793e\u5a92\u7b49\u591a\u79cd\u573a\u666f\u3002",{x:M+0.15,y:1.6,w:SW-M*2-0.15,h:2,fontSize:12,color:"555555",fontFace:"Microsoft YaHei",lineSpacingMultiple:1.8});
// decorative pattern placeholder
for(var i=0;i<3;i++){
  for(var j=0;j<3;j++){
    sl.addShape(pptx.ShapeType.ellipse,{x:M+0.5+j*2.2,y:4+i*2.2,w:1.8,h:1.8,fill:{color:sec,transparency:30+Math.random()*40},rectRadius:0.05});
  }
}
sl.addText("\u82b1\u74e3\u56fe\u5f62\u5ef6\u4f38  \u00b7  \u54c1\u724c\u7eb9\u6837\u7cfb\u7edf",{x:M+0.15,y:9.5,w:SW-M*2-0.15,h:0.5,fontSize:10,color:"AAAAAA",align:"center",fontFace:"Microsoft YaHei"});pn(sl,n,T);

// 8-9 SCENE FULL IMAGE (2 pages)
var fullScenes=[{fp:path.join(OUT,"yang_scene_stationery.png"),label:"\u54c1\u724c\u7269\u6599"},{fp:path.join(OUT,"yang_scene_packaging-1.png"),label:"\u5305\u88c5\u7cfb\u7edf"}];
fullScenes.forEach(function(sc){
  n++;sl=pptx.addSlide();af(sl);
  if(img(sl,sc.fp,M+0.15,0.2,SW-M*2-0.15,SH-0.8)){
    console.log("  [OK] Full scene: "+sc.label);
  }else{
    sl.addShape(pptx.ShapeType.rect,{x:M+0.15,y:0.5,w:SW-M*2-0.15,h:SH-2,fill:{color:"F5F5F5"}});
    sl.addText("[ "+sc.label+" ]",{x:M+0.15,y:4,w:SW-M*2-0.15,h:0.5,fontSize:14,color:"CCCCCC",align:"center",fontFace:"Microsoft YaHei"});
  }
  sl.addText(sc.label,{x:M+0.15,y:SH-0.55,w:4,h:0.4,fontSize:9,color:"999999",fontFace:"Microsoft YaHei"});pn(sl,n,T);
});

// 10 TYPOGRAPHY
n++;sl=pptx.addSlide();af(sl);hdr(sl,"\u5b57\u4f53\u89c4\u8303");
sl.addText("\u54c1\u724c\u4e13\u7528\u5b57\u4f53",{x:M+0.15,y:1.6,w:4,h:0.5,fontSize:14,color:pri,fontFace:"Microsoft YaHei",bold:true});
sl.addText("\u6807\u9898\u5b57\u4f53\uff1a\u601d\u6e90\u9ed1\u4f53 Bold / Noto Sans SC Bold\n\u6b63\u6587\u5b57\u4f53\uff1a\u601d\u6e90\u9ed1\u4f53 Regular / Noto Sans SC Regular\n\u88c5\u9970\u5b57\u4f53\uff1a\u601d\u6e90\u5b8b\u4f53 / Noto Serif SC\uff08\u4ec5\u54c1\u724c\u7406\u5ff5\u7b49\u7279\u6b8a\u9875\u9762\uff09",{x:M+0.15,y:2.2,w:SW-M*2-0.15,h:2.5,fontSize:11,color:"555555",fontFace:"Microsoft YaHei",lineSpacingMultiple:1.8});
sl.addText("\u5b57\u4f53\u5c42\u7ea7",{x:M+0.15,y:5,w:4,h:0.5,fontSize:14,color:pri,fontFace:"Microsoft YaHei",bold:true});
[["\u5c01\u9762\u6807\u9898","42pt Bold"],["\u7ae0\u8282\u6807\u9898","22pt Bold"],["\u5c0f\u6807\u9898","16pt Bold"],["\u6b63\u6587","12pt Regular"],["\u6ce8\u91ca/\u9875\u7801","8pt Regular"]].forEach(function(r,i){sl.addText(r[0],{x:M+0.15,y:5.5+i*0.5,w:2,h:0.4,fontSize:11,color:"333333",fontFace:"Microsoft YaHei"});sl.addText(r[1],{x:M+2.5,y:5.5+i*0.5,w:2,h:0.4,fontSize:11,color:"888888",fontFace:"Arial"})});pn(sl,n,T);

// 11-13 APPLICATION SYSTEMS
var apps=[["\u7f8e\u5bb9\u5e94\u7528\u7cfb\u7edf","Beauty Application System","\u4ea7\u54c1\u74f6\u8eab\u3001\u6807\u7b7e\u3001\u5e97\u5185\u5c55\u793a\u7b49\u65e5\u5e38\u7ecf\u8425\u7269\u6599\u7684\u89c6\u89c9\u7edf\u4e00\u89c4\u8303\u3002","packaging-2"],["\u7f8e\u5bb9\u5305\u88c5\u7cfb\u7edf","Beauty Packaging System","\u793c\u54c1\u888b\u3001\u4ea7\u54c1\u76d2\u3001\u7f0e\u5e26\u7b49\u5305\u88c5\u8bbe\u8ba1\u7684\u54c1\u724c\u5316\u5ef6\u4f38\u3002","marketing-1"],["\u7f8e\u5bb9\u8425\u9500\u7cfb\u7edf","Beauty Marketing System","\u6d77\u62a5\u3001\u4f1a\u5458\u5361\u3001\u793e\u5a92\u7d20\u6750\u7b49\u8425\u9500\u573a\u666f\u89c6\u89c9\u89c4\u8303\u3002","marketing-2"]];
apps.forEach(function(a){
  n++;sl=pptx.addSlide();af(sl);hdr(sl,a[0]);
  sl.addText(a[1],{x:M+0.15,y:1.3,w:6,h:0.4,fontSize:10,color:"999999",fontFace:"Arial",charSpacing:2});
  var fp=path.join(OUT,"yang_scene_"+a[3]+".png");
  if(img(sl,fp,M+0.15,1.9,SW-M*2-0.15,5.5)){
    console.log("  [OK] App: "+a[0]);
  }else{
    sl.addShape(pptx.ShapeType.rect,{x:M+0.15,y:1.9,w:SW-M*2-0.15,h:5.5,fill:{color:"F5F5F5"}});
    sl.addText("[ "+a[3]+" ]",{x:M+0.15,y:4.2,w:SW-M*2-0.15,h:0.5,fontSize:12,color:"CCCCCC",align:"center",fontFace:"Microsoft YaHei"});
  }
  sl.addText(a[2],{x:M+0.15,y:7.6,w:SW-M*2-0.15,h:1,fontSize:10,color:"777777",fontFace:"Microsoft YaHei"});pn(sl,n,T);
});

// 14 BRAND SLOGAN
n++;sl=pptx.addSlide();sl.background={fill:pri};
sl.addText("\u201c\u8ba9\u6bcf\u4e00\u4f4d\u5973\u6027\u7115\u53d1\u81ea\u7136\u4e4b\u7f8e\u201d",{x:M,y:SH*0.38,w:SW-M*2,h:1,fontSize:20,color:"FFFFFF",align:"center",fontFace:"Microsoft YaHei",italic:true});
sl.addShape(pptx.ShapeType.rect,{x:SW*0.3,y:SH*0.5,w:SW*0.4,h:0.01,fill:{color:"FFFFFF"}});
sl.addText("\u82b1\u989c\u7f8e\u5bb9\u9662",{x:M,y:SH*0.55,w:SW-M*2,h:0.8,fontSize:28,color:"FFFFFF",align:"center",fontFace:"Microsoft YaHei",bold:true});
sl.addText("\u4e1c\u65b9\u8349\u672c\u62a4\u80a4  \u00b7  15\u5e74\u5320\u5fc3\u4f20\u627f",{x:M,y:SH*0.68,w:SW-M*2,h:0.5,fontSize:12,color:"FFFFFF",align:"center",fontFace:"Microsoft YaHei"});

// 15 COLOR SYSTEM
n++;sl=pptx.addSlide();af(sl);hdr(sl,"\u8272\u5f69\u89c4\u8303");
[{h:pri,n:"\u82b1\u989c\u7c89",r:"\u4e3b\u8272 / Primary",u:"\u54c1\u724c\u6838\u5fc3\u8bc6\u522b\u8272\uff0cLogo\u4e3b\u8272\u8c03\u3001\u91cd\u8981\u6807\u9898\u3001\u54c1\u724c\u88c5\u9970\u6761"},{h:sec,n:"\u6d45\u6a31\u7c89",r:"\u8f85\u52a9\u8272 / Secondary",u:"\u80cc\u666f\u8272\u3001\u5927\u9762\u79ef\u5e95\u8272\u3001\u67d4\u548c\u8fc7\u6e21\u533a\u57df"},{h:acc,n:"\u6697\u91d1",r:"\u5f3a\u8c03\u8272 / Accent",u:"\u70b9\u7f00\u7ebf\u6761\u3001\u56fe\u6807\u9ad8\u4eae\u3001\u9ad8\u7aef\u8d28\u611f\u8868\u8fbe"}].forEach(function(c,i){var y=1.6+i*2.5;sl.addShape(pptx.ShapeType.rect,{x:M+0.15,y:y,w:1.5,h:1.8,fill:{color:c.h},rectRadius:0.05});sl.addText(c.n,{x:M+1.9,y:y,w:4,h:0.5,fontSize:16,color:"333333",fontFace:"Microsoft YaHei",bold:true});sl.addText(c.r+"    "+c.h,{x:M+1.9,y:y+0.5,w:5,h:0.4,fontSize:10,color:"888888",fontFace:"Arial"});sl.addText(c.u,{x:M+1.9,y:y+1,w:5,h:0.7,fontSize:10,color:"666666",fontFace:"Microsoft YaHei"})});pn(sl,n,T);

// 16 BACK COVER
n++;sl=pptx.addSlide();sl.background={fill:pri};
sl.addText("\u82b1\u989c\u7f8e\u5bb9\u9662",{x:M,y:SH*0.35,w:SW-M*2,h:0.8,fontSize:32,color:"FFFFFF",align:"center",fontFace:"Microsoft YaHei",bold:true});
sl.addText("HUA YAN BEAUTY",{x:M,y:SH*0.46,w:SW-M*2,h:0.5,fontSize:14,color:"FFFFFF",align:"center",fontFace:"Arial",charSpacing:6});
sl.addShape(pptx.ShapeType.rect,{x:SW*0.35,y:SH*0.54,w:SW*0.3,h:0.01,fill:{color:"FFFFFF"}});
sl.addText("\u89c6\u89c9\u8bc6\u522b\u7cfb\u7edf\u89c4\u8303\u624b\u518c",{x:M,y:SH*0.58,w:SW-M*2,h:0.5,fontSize:12,color:"FFFFFF",align:"center",fontFace:"Microsoft YaHei"});
sl.addText("BrandBrain \u00b7 \u54c1\u724c\u5927\u8111 \u00b7 2026",{x:M,y:SH*0.85,w:SW-M*2,h:0.4,fontSize:9,color:"FFFFFF",align:"center",fontFace:"Arial",charSpacing:4});

// SAVE
var outPath=path.join(OUT,"\u82b1\u989c\u7f8e\u5bb9\u9662-VI\u624b\u518c-v4.pptx");
pptx.writeFile({fileName:outPath}).then(function(){var s=fs.statSync(outPath);console.log("DONE: "+outPath+" ("+(s.size/1024).toFixed(0)+" KB, "+T+" pages)")}).catch(function(e){console.error("FAIL:",e.message)});
