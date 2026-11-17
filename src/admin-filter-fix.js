const resetCandidateFilter=()=>{
  const activeHeading=[...document.querySelectorAll('h1')].find(item=>item.textContent.trim()==='Interview slots');
  if(activeHeading)document.querySelectorAll('.admin-page-filter').forEach(item=>item.remove());
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
  if(!row||!row.querySelector('.slot-more-btn')||event.target.closest('.slot-inline-actions')||event.target.closest('.slot-more-btn'))return;
  const date=row.querySelector('td strong')?.textContent?.trim();
  const time=row.querySelector('td span')?.textContent?.trim();
  const slot=(window.__interviewSlots||[]).find(item=>item.date===date&&item.time===time);
  if(!slot)return;
  document.querySelector('.slot-direct-dialog')?.remove();
  const booked=(window.__interviewBookings||[]).filter(item=>item.slotId===slot.id);
  const dialog=document.createElement('div');dialog.className='slot-direct-dialog';
  dialog.innerHTML=`<div><button class="slot-close">×</button><p class="eyebrow">INTERVIEW DETAILS</p><h2>${slot.date} · ${slot.time}</h2><p class="muted">${slot.interviewer||''} · ${slot.role||''} · ${slot.mode||''}</p><h3>Booked candidates (${booked.length})</h3>${booked.length?booked.map(item=>`<div class="slot-booked-row"><strong>${item.candidateId||'Candidate'}</strong><span>${item.selectedStartTime||slot.startTime||''}${item.selectedEndTime?' – '+item.selectedEndTime:''} · ${item.status||'Booked'}</span></div>`).join(''):'<p class="muted">No candidates have booked this interview yet.</p>'}</div>`;
  document.body.appendChild(dialog);dialog.querySelector('.slot-close').onclick=()=>dialog.remove();dialog.onclick=e=>{if(e.target===dialog)dialog.remove()};
},true);
