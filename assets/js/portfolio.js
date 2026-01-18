// assets/portfolio.js

const packageMap={}; // store package id → name

function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]))} // basic HTML escape

async function loadAndRenderPortfolio(basePath="."){ // load portfolio & prices
  try{ // catch fetch errors
    const normalizedBase = basePath.replace(/\/+$/,''); // trim trailing slashes
    const [pfRes,priceRes]=await Promise.all([ // fetch both configs
      fetch(`${normalizedBase}/config/portfolio.json?ts=${Date.now()}`), // portfolio data
      fetch(`${normalizedBase}/config/prices.json?ts=${Date.now()}`) // prices for packages
    ]); // end fetch
    const data=await pfRes.json(); // parse portfolio json
    const priceData=await priceRes.json(); // parse prices json
    const assetBase = normalizedBase === "." ? "" : `${normalizedBase}/`;
    (priceData.packages||[]).forEach(pkg=>{packageMap[pkg.id]=pkg.name;}); // build id→name map
    renderPortfolio(data.items||[],assetBase); // render portfolio items
  }catch(e){ console.error("Portfolio load error:",e); } // log errors
}

function highlightPackages(text){ // replace placeholders with labels
  return text.replace(/:pkg(\d+):/g,(_,id)=>{ // find :pkg<ID>:
    const name=packageMap[id]??`:pkg${id}:`; // fallback if id unknown
    return `<span class="pkg-highlight">${name}</span>`; // wrap with badge span
  }); // end replace
} // end helper

function toDrivePreviewLink(url){
  if(typeof url!=="string" || !/drive\.google\.com/.test(url)) return url;
  const idParam = url.match(/[?&]id=([^&]+)/);
  const idPath = url.match(/\/d\/([^\/]+)/);
  const id = idParam ? idParam[1] : idPath ? idPath[1] : null;
  return id ? `https://drive.google.com/file/d/${id}/preview` : url;
}

function renderPortfolio(items,assetBase=""){
  const container = document.getElementById('portfolio');
  if(!container) return;
  container.innerHTML='';
  const statusMap={ // map payment status to icon data
    paid:{src:`${assetBase}img/paid.png`,alt:'Lunas',title:'Lunas',cls:''}, // added cls for optional styling
    free:{src:`${assetBase}img/free.png`,alt:'Gratis',title:'Gratis',cls:'free'}, // added cls to invert color
    unpaid:{src:`${assetBase}img/unpaid.png`,alt:'Belum Bayar',title:'Belum Bayar',cls:''} // added cls for consistency
  }; // end of map
  items.forEach(it=>{
    const el=document.createElement('div');
    el.className='portfolio-item';
    const videoUrl=toDrivePreviewLink(it.video); // ensure preview link
    const isDrive=/drive\.google\.com/.test(videoUrl||''); // check gdrive
    const media=isDrive
      ? `<iframe src="${escapeHtml(videoUrl)}" allow="autoplay" allowfullscreen></iframe>` // use drive preview
      : `<video controls src="${escapeHtml(videoUrl)}"></video>`; // no custom poster
    const st=statusMap[it.paymentStatus]||statusMap.unpaid; // resolve icon based on paymentStatus
    el.innerHTML=`
      <div class="video-wrapper">
        ${media}
      </div>
      <p class="desc"><img class="flag ${st.cls}" src="${st.src}" alt="${st.alt}" title="${st.title}"> – ${highlightPackages(escapeHtml(it.description))}</p> <!-- icon moved before text & package labels -->
    `; // icon now inside description with highlights
    if(!isDrive){ // handle non-drive videos
      const v=el.querySelector('video'); // video element
      const w=el.querySelector('.video-wrapper'); // wrapper
      if(v&&w){
        v.addEventListener('error',()=>{
          w.innerHTML=`Video tidak tersedia <a href="${escapeHtml(it.video)}" download>Download video</a>`; // error message
        });
      }
    }
    container.appendChild(el);
  });

  // if portfolio already visible, animate items after DOM update
  if(container.style.display !== 'none'){
    animatePortfolioItems();
  }
}

function animatePortfolioItems(){
  const container=document.getElementById('portfolio');
  if(!container) return;
  const items=container.querySelectorAll('.portfolio-item');
  setTimeout(()=>{ // allow reflow before starting
    items.forEach((el,i)=>{
      el.classList.remove('hide');
      setTimeout(()=>{
        el.classList.add('show');
      },i*150);
    });
  },50);
}

function hidePortfolioItems(){
  const container=document.getElementById('portfolio');
  if(!container) return;
  const items=container.querySelectorAll('.portfolio-item');
  items.forEach((el,i)=>{
    setTimeout(()=>{
      el.classList.remove('show');
      el.classList.add('hide');
    },i*100);
  });
  setTimeout(()=>{
    container.innerHTML='';
    container.style.display='none';
  },500);
}
window.Portfolio = {
  loadAndRender: loadAndRenderPortfolio,
  animate: animatePortfolioItems,
  hide: hidePortfolioItems
};
