/* Stable named stars. DOM labels keep Legacy text styling and keyboard access.
   Static constellation composition reuses the site's established star/orbit
   vocabulary; no particle library, canvas loop, or invisible background task. */
(() => {
  'use strict';
  const hash = value => {let h=2166136261;for(const char of value){h^=char.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
  function mount({users,name,selected}) {
    try {
      const ids=Object.keys(users).sort((a,b)=>hash(a)-hash(b));
      const background=document.getElementById('sky-background');
      if(background)background.innerHTML=ids.slice(0,12).map((uid,i)=>`<span class="sky-star" style="${i%2 ? 'right' : 'left'}:1%;top:${7+Math.floor(i/2)*16}%">${name(uid,false)}</span>`).join('');
      const field=document.getElementById('community-sky');
      if(field) {
        const shown=ids.slice(0,12);
        if(selected && !shown.includes(selected))shown[shown.length-1]=selected;
        field.innerHTML=shown.map((uid,i)=>`<button class="sky-star${uid===selected ? ' focused' : ''}" data-user="${uid.replace(/[^a-zA-Z0-9_-]/g,'')}" type="button" style="left:${5+(i%3)*31}%;top:${5+Math.floor(i/3)*24}%" aria-label="Select ${users[uid].username.replace(/[&<>"']/g,'')}" aria-pressed="${uid===selected}">${name(uid,false)}</button>`).join('');
        function focus(uid){for(const button of field.querySelectorAll('button')){const active=button.dataset.user===uid;button.classList.toggle('focused',active);button.setAttribute('aria-pressed',String(active));}document.getElementById('sky-selection').innerHTML=`${name(uid)} · <a href="profile.html?user=${encodeURIComponent(users[uid].username)}">Open profile ↗</a>`;}
        field.addEventListener('click',event=>{try {const button=event.target.closest('button[data-user]');if(button)focus(button.dataset.user);}catch(error){console.error('Selecting a community star failed',error);document.getElementById('sky-selection').textContent='That star could not open. Use the people directory below.';}});
        if(selected)focus(selected);
      }
    }catch(error){console.error('Drawing the named community sky failed',error);const field=document.getElementById('community-sky');if(field)field.textContent='The sky could not load. Use the people directory below.';}
  }
  window.CosmicSky={mount};
})();
