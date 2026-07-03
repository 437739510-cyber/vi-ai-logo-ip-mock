import json
basedir = 'D:\\disk\\HermesDisk\\bb-clean\\comfyui-workflows\\'
for name in ['stationery','packaging']:
    fp = basedir + 'vi-scene-' + name + '.json'
    with open(fp,'r',encoding='utf-8') as f:
        d = json.load(f)
    n = d['nodes']
    cn_apply = [k for k,v in n.items() if v['class_type']=='ControlNetApply']
    if cn_apply:
        n['8']['inputs']['positive'] = [cn_apply[0], 0]
        print(name + ': KSampler -> CN(' + cn_apply[0] + ')')
    with open(fp,'w',encoding='utf-8') as f:
        json.dump(d,f,indent=2,ensure_ascii=False)
print('Done')
