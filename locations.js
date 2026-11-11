/* Offline IPL viewer. Records: source, line/record, interior, X, Y, Z, raw, offset. */
(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=n=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:3});
  const state={id:null,token:0,records:[],filtered:[],selected:-1,page:0,cx:0,cy:0,scale:.07,width:800,height:390};
  const pending=new Map();let ready=false,drag=null;
  const image=new Image();image.src='locations/san-andreas.jpg';image.onload=()=>draw();
  function script(path){
    if(pending.has(path))return pending.get(path);
    const promise=new Promise((resolve,reject)=>{
      const tag=document.createElement('script');tag.src=path;
      tag.onload=()=>{tag.remove();resolve();};
      tag.onerror=()=>{tag.remove();pending.delete(path);reject(new Error('Не удалось прочитать локальный файл размещений.'));};
      document.head.appendChild(tag);
    });pending.set(path,promise);return promise;
  }
  function project(x,y){return [(x-state.cx)*state.scale+state.width/2,(state.cy-y)*state.scale+state.height/2];}
  function unproject(x,y){return [state.cx+(x-state.width/2)/state.scale,state.cy-(y-state.height/2)/state.scale];}
  function resize(){
    const canvas=el('location-canvas');if(!canvas||!canvas.clientWidth)return;
    state.width=canvas.clientWidth;state.height=canvas.clientHeight;
    const ratio=window.devicePixelRatio||1;canvas.width=Math.round(state.width*ratio);canvas.height=Math.round(state.height*ratio);draw();
  }
  function fit(allMap=false){
    if(allMap||!state.filtered.length){state.cx=0;state.cy=0;state.scale=Math.min(state.width,state.height)/6400;}
    else{
      const points=state.filtered.map(i=>state.records[i]);
      let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
      for(const r of points){xmin=Math.min(xmin,r[3]);xmax=Math.max(xmax,r[3]);ymin=Math.min(ymin,r[4]);ymax=Math.max(ymax,r[4]);}
      state.cx=(xmin+xmax)/2;state.cy=(ymin+ymax)/2;
      state.scale=Math.min((state.width-70)/Math.max(xmax-xmin,300),(state.height-70)/Math.max(ymax-ymin,300));
    }draw();
  }
  function draw(){
    const canvas=el('location-canvas');if(!canvas||!canvas.width)return;
    const ctx=canvas.getContext('2d'),ratio=window.devicePixelRatio||1,w=state.width,h=state.height;
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#183345';ctx.fillRect(0,0,w,h);
    if(image.complete&&image.naturalWidth){const p=project(-3000,3000);ctx.drawImage(image,p[0],p[1],6000*state.scale,6000*state.scale);}
    const low=unproject(0,h),high=unproject(w,0),step=Math.pow(10,Math.floor(Math.log10(150/state.scale)));
    ctx.strokeStyle='rgba(230,242,250,.16)';ctx.lineWidth=1;ctx.beginPath();
    for(let x=Math.ceil(low[0]/step)*step;x<=high[0];x+=step){const p=project(x,0);ctx.moveTo(p[0],0);ctx.lineTo(p[0],h);}
    for(let y=Math.ceil(low[1]/step)*step;y<=high[1];y+=step){const p=project(0,y);ctx.moveTo(0,p[1]);ctx.lineTo(w,p[1]);}ctx.stroke();
    ctx.font='11px system-ui';ctx.textAlign='center';
    for(const i of state.filtered){
      if(i===state.selected)continue;
      const r=state.records[i],p=project(r[3],r[4]);if(p[0]<-15||p[0]>w+15||p[1]<-15||p[1]>h+15)continue;
      ctx.beginPath();ctx.arc(...p,5,0,Math.PI*2);ctx.fillStyle=r[2]===0?'#ed674f':'#edbd52';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
      if(state.filtered.length<=40){ctx.fillStyle='#102330';ctx.fillRect(p[0]-11,p[1]-24,22,15);ctx.fillStyle='#fff';ctx.fillText(String(i+1),p[0],p[1]-13);}
    }
    if(state.filtered.includes(state.selected)){
      const r=state.records[state.selected],p=project(r[3],r[4]);ctx.beginPath();ctx.arc(...p,9,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.beginPath();ctx.arc(...p,6,0,Math.PI*2);ctx.fillStyle='#e44731';ctx.fill();
    }
    ctx.fillStyle='#142535e8';ctx.fillRect(8,h-25,205,19);ctx.fillStyle='#fff';ctx.textAlign='left';ctx.fillText(`Центр: X ${number(state.cx)} · Y ${number(state.cy)}`,14,h-12);
  }
  function selection(){
    const r=state.records[state.selected];
    el('location-selection').textContent=r?`Точка ${state.selected+1} · X ${number(r[3])} · Y ${number(r[4])} · Z ${number(r[5])} · Интерьер ${r[2]}${Math.abs(r[3])>3000||Math.abs(r[4])>3000?' · За границами карты San Andreas':''}`:'Выберите точку на карте или строку IPL ниже.';
  }
  function select(index,center=false){
    state.selected=index;state.page=Math.floor(state.filtered.indexOf(index)/50);
    if(center){const r=state.records[index];state.cx=r[3];state.cy=r[4];state.scale=Math.max(state.scale,Math.min(state.width,state.height)/450);}
    selection();list();
    const container=el('location-list'),row=container.querySelector('.location-row.selected');
    if(row)container.scrollTop=Math.max(0,row.offsetTop-(container.clientHeight-row.offsetHeight)/2);
    draw();
  }
  function list(){
    const files=window.IPL_LOCATION_INDEX.sources,items=state.filtered.slice(state.page*50,(state.page+1)*50);
    el('location-list').innerHTML=items.length?items.map(i=>{
      const r=state.records[i],source=files[r[0]],label=source.binary?`запись ${r[1]}`:`строка ${r[1]}`;
      const duplicates=(r[8]||[]).map((other,j)=>{
        const file=files[other[0]],place=file.binary?`запись ${other[1]}`:`строка ${other[1]}`;
        return `<div class="location-source"><div class="location-row-top"><span>${escape(file.path)} · ${place}</span><span class="location-actions"><button type="button" class="location-geo" data-location-point="${i}" aria-pressed="${i===state.selected}">Геолокация</button><button type="button" class="location-copy" data-location-copy="${i}" data-location-variant="${j}">Копировать</button></span></div>${file.binary?`<small>Бинарный IPL · смещение ${other[7]} байт · строка восстановлена из записи</small>`:''}<code>${escape(other[6])}</code></div>`;
      }).join('');
      return `<div class="location-row${i===state.selected?' selected':''}"><div class="location-row-top"><button type="button" data-location-point="${i}">${i+1}. ${escape(source.path)} · ${label}</button><span class="location-actions"><button type="button" class="location-geo" data-location-point="${i}" aria-pressed="${i===state.selected}" title="Показать точку ${i+1} на карте">Геолокация</button><button type="button" class="location-copy" data-location-copy="${i}">Копировать</button></span></div>${source.binary?`<small>Бинарный IPL · смещение ${r[7]} байт · строка восстановлена из записи</small>`:''}<code>${escape(r[6])}</code>${duplicates?`<details class="location-sources"><summary>Другие записи IPL этого размещения: ${r[8].length}</summary>${duplicates}</details>`:''}</div>`;
    }).join(''):'<div class="location-empty">Размещения в IPL не найдены.<br>Объект может использоваться в скриптах или добавляться вручную.</div>';
    const pages=Math.max(1,Math.ceil(state.filtered.length/50));el('location-page').textContent=`${state.page+1} / ${pages}`;
    el('location-prev').disabled=state.page===0;el('location-next').disabled=state.page+1>=pages;
    el('location-pager').hidden=pages===1;el('location-count').textContent=`Размещений: ${state.filtered.length}${state.filtered.length!==state.records.length?' из '+state.records.length:''}`;
  }
  function filter(){
    const value=el('location-interior').value;state.filtered=state.records.map((r,i)=>i).filter(i=>value==='all'||String(state.records[i][2])===value);
    state.page=0;state.selected=-1;selection();list();fit();
  }
  function zoom(factor,x=state.width/2,y=state.height/2){
    const before=unproject(x,y);state.scale=Math.max(.0005,Math.min(12,state.scale*factor));const after=unproject(x,y);state.cx+=before[0]-after[0];state.cy+=before[1]-after[1];draw();
  }
  function init(){
    if(ready)return;ready=true;const canvas=el('location-canvas');
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(canvas);else window.addEventListener('resize',resize);
    const position=e=>{const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
    canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.0015),...position(e));},{passive:false});
    canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;canvas.focus();drag={pointer:e.pointerId,point:position(e),cx:state.cx,cy:state.cy,moved:false};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!drag||drag.pointer!==e.pointerId)return;const p=position(e),dx=p[0]-drag.point[0],dy=p[1]-drag.point[1];drag.moved=drag.moved||Math.hypot(dx,dy)>4;state.cx=drag.cx-dx/state.scale;state.cy=drag.cy+dy/state.scale;draw();});
    canvas.addEventListener('pointerup',e=>{
      if(!drag||drag.pointer!==e.pointerId)return;const clicked=!drag.moved;drag=null;
      if(clicked){const p=position(e);let nearest=-1,distance=14;for(const i of state.filtered){const r=state.records[i],q=project(r[3],r[4]),d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<distance){nearest=i;distance=d;}}if(nearest>=0)select(nearest);}
    });canvas.addEventListener('pointercancel',()=>{drag=null;});
    canvas.addEventListener('keydown',e=>{
      if(e.key==='+'||e.key==='=')zoom(1.5);else if(e.key==='-')zoom(1/1.5);else if(e.key==='Home')fit();
      else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){state.cx+=(e.key==='ArrowLeft'?-60:e.key==='ArrowRight'?60:0)/state.scale;state.cy+=(e.key==='ArrowUp'?60:e.key==='ArrowDown'?-60:0)/state.scale;draw();}else return;e.preventDefault();
    });
    el('location-interior').addEventListener('change',filter);
    el('location-plus').onclick=()=>zoom(1.5);el('location-minus').onclick=()=>zoom(1/1.5);el('location-fit').onclick=()=>fit();el('location-world').onclick=()=>fit(true);
    el('location-prev').onclick=()=>{state.page--;list();el('location-list').scrollTop=0;};el('location-next').onclick=()=>{state.page++;list();el('location-list').scrollTop=0;};
    el('location-list').addEventListener('click',async e=>{
      const point=e.target.closest('[data-location-point]');if(point){select(Number(point.dataset.locationPoint),true);return;}
      const copy=e.target.closest('[data-location-copy]');if(!copy)return;
      const record=state.records[Number(copy.dataset.locationCopy)];
      const text=(copy.dataset.locationVariant===undefined?record:record[8][Number(copy.dataset.locationVariant)])[6];
      try{await navigator.clipboard.writeText(text);copy.textContent='Скопировано';}catch(_){const range=document.createRange();range.selectNodeContents((copy.closest('.location-source')||copy.closest('.location-row')).querySelector('code'));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);copy.textContent='Строка выделена';}
    });
  }
  async function open(id){
    init();const token=++state.token;state.id=String(id);state.records=[];state.filtered=[];state.selected=-1;state.page=0;
    el('location-list').innerHTML='<div class="location-empty">Читаем размещения IPL…</div>';el('location-count').textContent='Загрузка…';el('location-selection').textContent='';el('location-pager').hidden=true;el('location-interior').innerHTML='<option value="all">Все интерьеры</option>';resize();fit(true);
    try{
      if(!window.IPL_LOCATION_INDEX)await script('locations/index.js');if(token!==state.token)return;
      const index=window.IPL_LOCATION_INDEX,shard=Number(id)%index.shards;
      if(index.count[id]&&!(window.IPL_LOCATION_SHARDS&&window.IPL_LOCATION_SHARDS[shard]))await script(`locations/${shard}.js`);
      if(token!==state.token)return;
      state.records=(window.IPL_LOCATION_SHARDS&&window.IPL_LOCATION_SHARDS[shard]||{})[id]||[];
      const interiors=[...new Set(state.records.map(r=>r[2]))].sort((a,b)=>a-b);
      el('location-interior').innerHTML='<option value="all">Все интерьеры</option>'+interiors.map(i=>`<option value="${i}">Интерьер ${i}${i===0?' · основной мир':''}</option>`).join('');
      filter();
    }catch(error){if(token!==state.token)return;el('location-count').textContent='Ошибка загрузки';el('location-list').innerHTML=`<div class="location-empty">${escape(error.message)}<br>Переключите вкладку, чтобы повторить загрузку.</div>`;}
  }
  window.ObjectLocations={open,close:()=>{state.token++;drag=null;}};
})();
