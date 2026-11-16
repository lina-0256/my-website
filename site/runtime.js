const loadingSession=false;
const canEdit=()=>false;
function bootstrap(){}
function setupPublicRefresh(){}
function refreshPublishedCatalog(){location.reload()}
function cloudHeader(){
  const route=location.hash||'#list';
  document.getElementById('header').innerHTML=`<div class="header-inner"><a class="brand" href="./">${icon('compass')}<span class="brand-wordmark">ATLAS V</span><small>团队旅行目的地</small></a><nav class="nav"><a href="#list" class="${route.startsWith('#picks')?'':'current'}">目的地</a><a href="#picks" class="${route.startsWith('#picks')?'current':''}">候选清单 <span>${selected().length||''}</span></a></nav></div>`;
}
function cloudRender(){
  header();const route=location.hash||'#list';let html;
  if(route==='#picks')html=candidates();
  else if(route.startsWith('#city/')){
    const city=byId(route.slice(6).split('?')[0]);
    html=city?.published?detail(city):'<div class="wrap empty"><p>未找到该目的地</p><a href="#list">返回目的地列表</a></div>';
  }else html=list();
  document.getElementById('app').innerHTML=html;bind();
}
