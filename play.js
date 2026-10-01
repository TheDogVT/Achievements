/* The original Star Hunt engine and cookies are retained on this dedicated page. */
(async()=>{
  try {
    const response=await fetch('community.json');
    if(!response.ok)throw new Error(`Community snapshot: HTTP ${response.status}`);
    const snapshot=await response.json();
    allUserData=snapshot.users;
    const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const identity=uid=>{
      const user=snapshot.users[uid],tier=Number(user.legacy)>=2?2:Number(user.legacy)>=1?1:0;
      return `<span class="name${tier?` legacy-${tier}`:''}">${escape(user.username)}</span>`;
    };
    window.CosmicSky.mount({users:snapshot.users,name:identity,selected:null});
    // Reuse the existing game draw loop, but skip its pairwise canvas work
    // outside active play. The idle sky uses the same named stars as the site.
    const gameDraw=drawConstellation;
    drawConstellation=function(){
      try {
        if(starGameActive || saveStarsActive)gameDraw();
        else requestAnimationFrame(drawConstellation);
      }catch(error){
        console.error('Drawing Star Hunt failed',error);
        document.getElementById('loadingScreen').hidden=false;
        setLoadProgress(100,'Star Hunt could not render. Refresh to try again.');
      }
    };
    document.getElementById('loadingScreen').hidden=true;
    document.getElementById('appContent').style.display='block';
  }catch(error){console.error('Loading Star Hunt failed',error);showDataLoadFailure(error);}
})();
