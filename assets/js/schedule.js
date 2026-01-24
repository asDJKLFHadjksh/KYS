(function(){
  const TIME_ZONE="Asia/Jakarta";
  const DAY_NAMES=["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const TIME_OPTIONS={timeZone:TIME_ZONE,hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"};

  function formatJam(value){
    const numericValue=typeof value==="number"?value:parseInt(value,10);
    if(Number.isNaN(numericValue)){
      return "--.--";
    }
    return `${String(numericValue).padStart(2,"0")}.00`;
  }

  function getNormalizedTimeString(date){
    const raw=date.toLocaleTimeString("id-ID",TIME_OPTIONS);
    return raw.replace(/\./g,":");
  }

  function normalizeDayName(name){
    if(!name){
      return "";
    }
    const lower=String(name).toLowerCase();
    const matched=DAY_NAMES.find((day)=>day.toLowerCase()===lower);
    return matched||name;
  }

  function getCurrentDayName(){
    const formatted=new Intl.DateTimeFormat("id-ID",{timeZone:TIME_ZONE,weekday:"long"}).format(new Date());
    return normalizeDayName(formatted);
  }

  function parseTimeToMinutes(timeString){
    const [hourStr,minuteStr]=timeString.split(":");
    const hours=parseInt(hourStr,10);
    const minutes=parseInt(minuteStr,10);
    if(Number.isNaN(hours)||Number.isNaN(minutes)){
      return null;
    }
    return hours*60+minutes;
  }

  function highlightCurrentDay(listElement,currentDayName){
    if(!listElement){
      return;
    }
    const target=String(currentDayName||"").toLowerCase();
    listElement.querySelectorAll(".jadwal-item").forEach((item)=>{
      const itemDay=String(item.dataset.dayName||"").toLowerCase();
      item.classList.toggle("hari-ini",itemDay===target);
    });
  }

  function getScheduleState(schedule,normalizedTime,dayName){
    const todaySchedule=schedule&&schedule[dayName];
    if(todaySchedule&&typeof todaySchedule.buka!=="undefined"&&typeof todaySchedule.tutup!=="undefined"){
      const bukaMinutes=Number(todaySchedule.buka)*60;
      const tutupMinutes=Number(todaySchedule.tutup)*60;
      const currentMinutes=parseTimeToMinutes(normalizedTime);
      const isOpen=currentMinutes!==null&&currentMinutes>=bukaMinutes&&currentMinutes<tutupMinutes;
      return isOpen?"open":"closed";
    }
    return "unavailable";
  }

  function updateIndicator(indicatorElement,state){
    if(!indicatorElement){
      return;
    }
    indicatorElement.classList.toggle("is-open",state==="open");
    indicatorElement.classList.toggle("is-closed",state==="closed");
    indicatorElement.classList.toggle("is-unavailable",state==="unavailable");
    const label=state==="open"?"Buka":state==="closed"?"Tutup":"Tidak tersedia";
    indicatorElement.setAttribute("data-status",label);
  }

  function updateView(schedule,statusElement,clockElement,listElement,indicatorElement){
    const now=new Date();
    const normalizedTime=getNormalizedTimeString(now);
    if(clockElement){
      clockElement.textContent=`Jam sekarang: ${normalizedTime} WIB`;
    }

    const dayName=getCurrentDayName();
    if(listElement){
      highlightCurrentDay(listElement,dayName);
    }

    const scheduleState=getScheduleState(schedule,normalizedTime,dayName);
    updateIndicator(indicatorElement,scheduleState);

    if(!statusElement){
      return;
    }

    statusElement.classList.remove("status-open","status-closed","status-unavailable");

    if(scheduleState==="open"){
      statusElement.textContent="Buka";
      statusElement.classList.add("status-open");
    }else if(scheduleState==="closed"){
      statusElement.textContent="Tutup";
      statusElement.classList.add("status-closed");
    }else{
      statusElement.textContent="Jadwal tidak tersedia";
      statusElement.classList.add("status-unavailable");
    }
  }

  function renderFullSchedule(schedule,listElement){
    if(!listElement){
      return;
    }

    listElement.innerHTML="";
    listElement.classList.add("jadwal-list");
    DAY_NAMES.forEach((dayName)=>{
      const item=document.createElement("li");
      item.className="jadwal-item";
      const dayLabel=document.createElement("span");
      dayLabel.className="jadwal-hari";
      dayLabel.textContent=dayName;
      const timeLabel=document.createElement("span");
      timeLabel.className="jadwal-jam";
      const info=schedule&&schedule[dayName];
      if(info&&typeof info.buka!=="undefined"&&typeof info.tutup!=="undefined"){
        timeLabel.textContent=`${formatJam(info.buka)} – ${formatJam(info.tutup)}`;
      }else{
        timeLabel.textContent="-";
      }
      item.dataset.dayName=dayName;
      item.append(dayLabel,timeLabel);
      listElement.appendChild(item);
    });
    highlightCurrentDay(listElement,getCurrentDayName());
  }

  function setupScheduleIntro(){
    const introElement=document.getElementById("scheduleIntro");
    if(!introElement){
      return;
    }
    if(localStorage.getItem("schedule_intro_seen")==="true"){
      return;
    }

    introElement.classList.add("is-visible");

    const closeIntro=()=>{
      introElement.classList.remove("is-visible");
      localStorage.setItem("schedule_intro_seen","true");
      if(autoHideTimer){
        window.clearTimeout(autoHideTimer);
        autoHideTimer=null;
      }
    };

    let autoHideTimer=window.setTimeout(()=>{
      closeIntro();
    },60000);

    introElement.addEventListener("click",closeIntro);
    introElement.addEventListener("keydown",(event)=>{
      if(event.key==="Enter"||event.key===" "){
        event.preventDefault();
        closeIntro();
      }
    });
  }

  function initSchedule(){
    const popup=document.getElementById("popup-jadwal");
    if(!popup){
      return;
    }
    if(popup.dataset.scheduleReady==="true"){
      return;
    }
    popup.dataset.scheduleReady="true";

    const statusElement=document.getElementById("status-jadwal");
    const clockElement=document.getElementById("jam-realtime");
    const listElement=document.getElementById("jadwal-lengkap");
    const closeButton=document.getElementById("tutup-jadwal");
    const indicatorElement=document.querySelector("[data-open-schedule]");

    setupScheduleIntro();

    const lockScroll=()=>{
      if(window.__ModalScrollLock?.lock){
        window.__ModalScrollLock.lock();
      }
    };

    const unlockScroll=()=>{
      if(window.__ModalScrollLock?.unlock){
        window.__ModalScrollLock.unlock();
      }
    };

    const openScheduleModal=()=>{
      if(popup.classList.contains("tersembunyi")){
        popup.classList.remove("tersembunyi");
        popup.setAttribute("aria-hidden","false");
        lockScroll();
      }
    };

    const closeScheduleModal=()=>{
      if(!popup.classList.contains("tersembunyi")){
        popup.classList.add("tersembunyi");
        popup.setAttribute("aria-hidden","true");
        unlockScroll();
      }
    };

    if(closeButton){
      closeButton.addEventListener("click",closeScheduleModal);
    }

    document.querySelectorAll("[data-open-schedule]").forEach((trigger)=>{
      trigger.addEventListener("click",(event)=>{
        event.preventDefault();
        openScheduleModal();
      });
    });

    let scheduleData={};
    const update=()=>updateView(scheduleData,statusElement,clockElement,listElement,indicatorElement);

    fetch("../config/prices.json")
      .then((response)=>{
        if(!response.ok){
          throw new Error("Gagal mengambil data jadwal kerja.");
        }
        return response.json();
      })
      .then((data)=>{
        if(data&&data.workSchedule){
          scheduleData=data.workSchedule;
        }
        renderFullSchedule(scheduleData,listElement);
        update();
      })
      .catch((error)=>{
        console.error(error);
        if(statusElement){
          statusElement.textContent="Jadwal tidak tersedia";
          statusElement.classList.add("status-unavailable");
        }
        update();
      })
      .finally(()=>{
        update();
        setInterval(update,1000);
      });
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",initSchedule);
  }else{
    initSchedule();
  }
})();
