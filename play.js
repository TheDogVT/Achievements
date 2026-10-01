/* The original Star Hunt engine and cookies are retained on this dedicated page. */
(async()=>{
  try {
    const response=await fetch('community.json');
    if(!response.ok)throw new Error(`Community snapshot: HTTP ${response.status}`);
    const snapshot=await response.json();
    allUserData=snapshot.users;
    document.getElementById('loadingScreen').hidden=true;
    document.getElementById('appContent').style.display='block';
  }catch(error){console.error('Loading Star Hunt failed',error);showDataLoadFailure(error);}
})();
