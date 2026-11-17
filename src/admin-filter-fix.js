const resetCandidateFilter=()=>{
  const activeHeading=[...document.querySelectorAll('h1')].find(item=>['Interview slots','Overview','Help center'].includes(item.textContent.trim()));
  if(activeHeading)document.querySelectorAll('.admin-page-filter').forEach(item=>item.remove());
  const overview=[...document.querySelectorAll('h1')].some(item=>['Overview','Help center'].includes(item.textContent.trim()));
  const headerSearch=document.querySelector('.header-actions>.icon-btn:not(.notification)');
  if(headerSearch)headerSearch.style.display=overview?'none':'';
  const heading=[...document.querySelectorAll('h1')].find(item=>item.textContent.trim()==='Candidates');
  const bookingsHeading=[...document.querySelectorAll('h1')].find(item=>item.textContent.trim()==='Bookings');
  const bar=document.querySelector('.admin-page-filter');
  if(!bar)return;
  const select=bar.querySelector('select');
  if(select)select.style.display=heading?'none':'';
  if(!heading&&!bookingsHeading)return;
  if(select&&select.value){select.value='';select.dispatchEvent(new Event('change',{bubbles:true}))}
};
new MutationObserver(resetCandidateFilter).observe(document.body,{childList:true,subtree:true});
resetCandidateFilter();
document.addEventListener('click',event=>{
  const row=event.target.closest?.('.table-panel tbody tr');
  if(!row||!row.querySelector('.slot-more-btn'))return;
  const date=row.querySelector('td strong')?.textContent?.trim();
  const time=row.querySelector('td span')?.textContent?.trim();
  const slot=(window.__interviewSlots||[]).find(item=>item.date===date&&item.time===time);
  if(!slot)return;
  if(event.target.closest('.slot-inline-actions')){event.preventDefault();event.stopPropagation();window.dispatchEvent(new CustomEvent(event.target.closest('.slot-inline-delete')?'slot-delete-request':'slot-edit-request',{detail:slot}));return}
  if(event.target.closest('.slot-more-btn'))return;
  document.querySelector('.slot-direct-dialog')?.remove();
  const booked=(window.__interviewBookings||[]).filter(item=>item.slotId===slot.id);
  const dialog=document.createElement('div');dialog.className='slot-direct-dialog';
  dialog.innerHTML=`<div><button class="slot-close">×</button><p class="eyebrow">INTERVIEW DETAILS</p><h2>${slot.date} · ${slot.time}</h2><p class="muted">${slot.interviewer||''} · ${slot.role||''} · ${slot.mode||''}</p><div class="slot-direct-actions"><button class="slot-edit-request">Edit slot</button><button class="slot-delete-request">Delete slot</button></div><h3>Booked candidates (${booked.length})</h3>${booked.length?booked.map(item=>`<div class="slot-booked-row"><strong>${item.candidateId||'Candidate'}</strong><span>${item.selectedStartTime||slot.startTime||''}${item.selectedEndTime?' – '+item.selectedEndTime:''} · ${item.status||'Booked'}</span></div>`).join(''):'<p class="muted">No candidates have booked this interview yet.</p>'}</div>`;
  document.body.appendChild(dialog);dialog.querySelector('.slot-close').onclick=()=>dialog.remove();dialog.onclick=e=>{if(e.target===dialog)dialog.remove()};dialog.querySelector('.slot-edit-request').onclick=()=>{dialog.remove();window.dispatchEvent(new CustomEvent('slot-edit-request',{detail:slot}))};dialog.querySelector('.slot-delete-request').onclick=()=>{dialog.remove();window.dispatchEvent(new CustomEvent('slot-delete-request',{detail:slot}))};
},true);
document.addEventListener('input',event=>{
  const input=event.target.closest?.('.admin-page-filter input');
  const heading=[...document.querySelectorAll('h1')].find(item=>['Bookings','Candidates'].includes(item.textContent.trim()));
  if(!input||!heading)return;
  const value=input.value.trim().toLowerCase();
  const panel=document.querySelector('.table-panel');
  panel?.querySelectorAll('tbody tr').forEach(row=>{row.style.display=!value||row.textContent.toLowerCase().includes(value)?'':'none'});
});
