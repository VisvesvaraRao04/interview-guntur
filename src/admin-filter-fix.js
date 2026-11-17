const resetCandidateFilter=()=>{
  const heading=[...document.querySelectorAll('h1')].find(item=>item.textContent.trim()==='Candidates');
  const bar=document.querySelector('.admin-page-filter');
  if(!heading||!bar)return;
  const select=bar.querySelector('select');
  if(select&&select.value){select.value='';select.dispatchEvent(new Event('change',{bubbles:true}))}
};
new MutationObserver(resetCandidateFilter).observe(document.body,{childList:true,subtree:true});
resetCandidateFilter();
